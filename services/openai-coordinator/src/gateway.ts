/**
 * Agent Gateway client for the OpenAI Coordinator.
 *
 * Mirrors the deployed contract in supabase/functions/agent-gateway/index.ts:
 * - GET  ?op=status|continuity|tasks|inbox
 * - POST actions: task.create, task.claim, task.heartbeat, task.complete,
 *   event.append, message.send, message.ack, approval.request
 *   (channel.update exists but the gateway always rejects it with 403
 *   provider_confirmation_required, so it is intentionally not exposed here.)
 * - Auth: the agent's own machine key in the `x-agent-key` header.
 * - Writes carry idempotency keys matching /^[a-zA-Z0-9._:-]{8,128}$/.
 *
 * Retry policy: retries ONLY on network errors and HTTP 5xx, with exponential
 * backoff. HTTP 4xx is never retried (auth/scope/validation will not heal).
 * A write's idempotency key is generated once per logical call and reused
 * across its retries, so a retried write cannot duplicate a record.
 */
import { randomBytes } from "node:crypto";

export class GatewayError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? `Gateway request failed: HTTP ${status} ${code}`);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
  }
}

export class GatewayAuthError extends GatewayError {
  constructor(code = "agent_authentication_failed") {
    super(401, code, `Gateway authentication failed (401 ${code}). The coordinator key is missing, invalid, revoked or disabled.`);
    this.name = "GatewayAuthError";
  }
}

export type Domain = "platform" | "transport" | "taxes" | "communications" | "documents";
export type AppendedEventType = "task.progress" | "task.blocked" | "task.failed" | "agent.checkpoint.recorded";
export type MessageType = "task_handoff" | "status" | "question" | "result" | "checkpoint" | "system";
export type AckStatus = "acknowledged" | "rejected" | "completed";

export interface GatewayClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  fetchImpl?: typeof fetch;
  logger?: (message: string) => void;
  /** Prefix for generated idempotency keys; keep it agent-specific. */
  idPrefix?: string;
}

const IDEMPOTENCY_SAFE = /[^a-zA-Z0-9._:-]/g;

export function newIdempotencyKey(prefix: string): string {
  const rand = randomBytes(8).toString("hex");
  const key = `${prefix}-${Date.now().toString(36)}-${rand}`.replace(IDEMPOTENCY_SAFE, "-");
  return key.slice(0, 128);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: (message: string) => void;
  private readonly idPrefix: string;

  constructor(options: GatewayClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.backoffBaseMs = options.backoffBaseMs ?? 250;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? (() => undefined);
    this.idPrefix = options.idPrefix ?? "coordinator";
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            "x-agent-key": this.apiKey,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        let payload: Record<string, unknown> = {};
        try {
          payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          payload = { ok: false, error: "unparseable_response" };
        }
        if (res.status === 401) {
          throw new GatewayAuthError(typeof payload.error === "string" ? payload.error : undefined);
        }
        if (res.status >= 500) {
          // Retryable server-side failure.
          lastError = new GatewayError(res.status, String(payload.error ?? "gateway_5xx"));
          if (attempt < this.maxRetries) {
            const wait = this.backoffBaseMs * 2 ** attempt;
            this.logger(`gateway ${method} ${path} -> HTTP ${res.status}; retry ${attempt + 1}/${this.maxRetries} in ${wait}ms`);
            await sleep(wait);
            continue;
          }
          throw lastError;
        }
        if (!res.ok || payload.ok === false) {
          // 4xx and explicit ok:false are terminal for this call. Never retried.
          throw new GatewayError(res.status, String(payload.error ?? `http_${res.status}`));
        }
        return payload as T;
      } catch (err) {
        if (err instanceof GatewayError) throw err; // includes auth + terminal 4xx/5xx-after-retries
        // Network error / timeout / abort: retryable.
        lastError = err;
        if (attempt < this.maxRetries) {
          const wait = this.backoffBaseMs * 2 ** attempt;
          const detail = err instanceof Error ? err.message : String(err);
          this.logger(`gateway ${method} ${path} network error (${detail}); retry ${attempt + 1}/${this.maxRetries} in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw new GatewayError(0, "network_error", `Gateway unreachable after ${this.maxRetries + 1} attempts: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new GatewayError(0, "network_error");
  }

  // ---- Reads -------------------------------------------------------------

  getStatus(): Promise<Record<string, unknown>> {
    return this.request("GET", "?op=status");
  }

  getContinuity(): Promise<Record<string, unknown>> {
    return this.request("GET", "?op=continuity");
  }

  listTasks(): Promise<Record<string, unknown>> {
    return this.request("GET", "?op=tasks");
  }

  getInbox(): Promise<Record<string, unknown>> {
    return this.request("GET", "?op=inbox");
  }

  // ---- Writes ------------------------------------------------------------

  createTask(input: {
    title: string;
    domain: Domain;
    description?: string;
    assignedAgentId?: string;
    maxAttempts?: number;
    idempotencyKey?: string;
  }): Promise<Record<string, unknown>> {
    return this.request("POST", "", {
      action: "task.create",
      title: input.title,
      domain: input.domain,
      description: input.description ?? "",
      assignedAgentId: input.assignedAgentId,
      maxAttempts: input.maxAttempts,
      idempotencyKey: input.idempotencyKey ?? newIdempotencyKey(`${this.idPrefix}-task`),
    });
  }

  claimTask(taskId: string, leaseSeconds?: number): Promise<Record<string, unknown>> {
    return this.request("POST", "", { action: "task.claim", taskId, leaseSeconds });
  }

  heartbeatTask(taskId: string, leaseSeconds?: number): Promise<Record<string, unknown>> {
    return this.request("POST", "", { action: "task.heartbeat", taskId, leaseSeconds });
  }

  completeTask(taskId: string, result: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "", { action: "task.complete", taskId, result });
  }

  appendEvent(
    type: AppendedEventType,
    payload: Record<string, unknown>,
    opts?: { taskId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "", {
      action: "event.append",
      type,
      payload,
      taskId: opts?.taskId,
      idempotencyKey: opts?.idempotencyKey ?? newIdempotencyKey(`${this.idPrefix}-event`),
    });
  }

  sendMessage(
    recipientAgentId: string,
    subject: string,
    body: Record<string, unknown>,
    opts?: { messageType?: MessageType; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "", {
      action: "message.send",
      recipientAgentId,
      subject,
      body,
      messageType: opts?.messageType,
      idempotencyKey: opts?.idempotencyKey ?? newIdempotencyKey(`${this.idPrefix}-msg`),
    });
  }

  ackMessage(messageId: string, status: AckStatus, note?: string): Promise<Record<string, unknown>> {
    return this.request("POST", "", { action: "message.ack", messageId, status, note });
  }

  requestApproval(
    actionName: string,
    target: string,
    payload: Record<string, unknown>,
    expiresInMinutes?: number,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "", {
      action: "approval.request",
      actionName,
      target,
      payload,
      expiresInMinutes,
    });
  }
}
