/**
 * Mock Agent Gateway for the synthetic acceptance harness.
 *
 * Faithfully mirrors the deployed contract in
 * supabase/functions/agent-gateway/index.ts (auth by SHA-256 key hash,
 * scopes, domain checks, idempotency dedupe, lease semantics, restricted
 * event types, message ack rules, channel.update always 403) backed by an
 * in-memory store. Test-only control endpoints live under /__control and
 * /__state and are NOT part of the gateway contract.
 *
 * Synthetic data only. No real keys, no real records.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";

export interface MockIdentity {
  agentId: string;
  displayName: string;
  key: string;
  scopes: string[];
  domainScopes: string[];
}

export interface MockStore {
  events: Record<string, unknown>[];
  tasks: Map<string, Record<string, unknown>>;
  messages: Map<string, Record<string, unknown>>;
  approvals: Record<string, unknown>[];
  requestLog: { method: string; op: string; agentId: string | null; status: number }[];
}

const ALL_SCOPES = [
  "continuity:read",
  "tasks:read",
  "tasks:create",
  "tasks:claim",
  "tasks:heartbeat",
  "events:append",
  "messages:read",
  "messages:send",
  "messages:ack",
  "approvals:request",
];
const ALL_DOMAINS = ["platform", "transport", "taxes", "communications", "documents"];
const EVENT_TYPES = new Set([
  "task.created", "task.claimed", "task.heartbeat", "task.progress", "task.blocked",
  "task.completed", "task.failed", "approval.requested", "approval.granted", "approval.denied",
  "agent.checkpoint.recorded", "agent.message.sent", "agent.message.acknowledged",
  "channel.status.changed", "deployment.observed", "test.completed",
]);
const APPENDABLE = new Set(["task.progress", "task.blocked", "task.failed", "agent.checkpoint.recorded"]);

const sha256 = (v: string): string => createHash("sha256").update(v).digest("hex");
const validIdempotency = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(v);
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const cleanPayload = (v: unknown): v is Record<string, unknown> =>
  isObject(v) && JSON.stringify(v).length <= 16_384;

export interface MockGateway {
  url: string;
  store: MockStore;
  setFault: (failNext: number, mode: "500" | "drop") => void;
  close: () => Promise<void>;
}

export async function startMockGateway(identities: MockIdentity[]): Promise<MockGateway> {
  const byHash = new Map<string, MockIdentity>();
  for (const idn of identities) byHash.set(sha256(idn.key), idn);

  const store: MockStore = { events: [], tasks: new Map(), messages: new Map(), approvals: [], requestLog: [] };
  let sequence = 0;
  let faultRemaining = 0;
  let faultMode: "500" | "drop" = "500";

  const appendEvent = (
    actor: string,
    type: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    taskId: string | null,
  ): Record<string, unknown> => {
    if (!EVENT_TYPES.has(type)) throw new Error("invalid_event_type");
    const existing = store.events.find((e) => e.actor_agent_id === actor && e.idempotency_key === idempotencyKey);
    if (existing) return existing;
    const row: Record<string, unknown> = {
      sequence: ++sequence,
      id: randomUUID(),
      actor_agent_id: actor,
      event_type: type,
      payload,
      idempotency_key: idempotencyKey,
      task_id: taskId,
      request_id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    store.events.push(row);
    return row;
  };

  const inDomain = (agent: MockIdentity, domain: string): boolean =>
    agent.domainScopes.includes(domain) || agent.domainScopes.includes("platform");
  const hasScope = (agent: MockIdentity, scope: string): boolean => agent.scopes.includes(scope);

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: Record<string, unknown>): void => {
      const data = JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(data);
    };
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    // ---- test-only control surface (not part of the gateway contract) ----
    if (url.pathname === "/__state") {
      send(200, {
        events: store.events,
        tasks: [...store.tasks.values()],
        messages: [...store.messages.values()],
        approvals: store.approvals,
        requestLog: store.requestLog,
      });
      return;
    }
    if (url.pathname === "/__control" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
      faultRemaining = Number(body.failNext ?? 0);
      faultMode = body.mode === "drop" ? "drop" : "500";
      send(200, { ok: true, failNext: faultRemaining, mode: faultMode });
      return;
    }

    // ---- fault injection for gateway traffic ------------------------------
    if (faultRemaining > 0) {
      faultRemaining--;
      store.requestLog.push({ method: req.method ?? "?", op: url.searchParams.get("op") ?? "POST", agentId: null, status: faultMode === "drop" ? 0 : 500 });
      if (faultMode === "drop") {
        req.socket.destroy();
        return;
      }
      send(500, { ok: false, error: "injected_fault" });
      return;
    }

    const rawKey = req.headers["x-agent-key"];
    const key = typeof rawKey === "string" ? rawKey : "";
    const agent = key.length >= 40 && key.length <= 200 ? byHash.get(sha256(key)) : undefined;
    const opLabel = req.method === "GET" ? url.searchParams.get("op") ?? "continuity" : "POST";
    const logged = (status: number): void => {
      store.requestLog.push({ method: req.method ?? "?", op: opLabel, agentId: agent?.agentId ?? null, status });
    };
    if (!agent) {
      logged(401);
      send(401, { ok: false, error: "agent_authentication_failed" });
      return;
    }

    try {
      if (req.method === "GET") {
        const op = url.searchParams.get("op") ?? "continuity";
        if (op === "status") {
          logged(200);
          send(200, { ok: true, project: "copiloto-v7", agentId: agent.agentId, displayName: agent.displayName, scopes: agent.scopes, domainScopes: agent.domainScopes });
          return;
        }
        if (op === "continuity") {
          if (!hasScope(agent, "continuity:read")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          logged(200);
          send(200, {
            ok: true,
            project: "copiloto-v7",
            source: "mock-persistent-event-store",
            recoveredFor: agent.agentId,
            recoveredAt: new Date().toISOString(),
            projectState: null,
            events: [...store.events],
            tasks: [...store.tasks.values()].filter(
              (t) => !["completed", "failed", "cancelled"].includes(String(t.status)) && inDomain(agent, String(t.domain)),
            ),
            checkpoints: [],
            decisions: store.approvals,
            pendingApprovals: store.approvals.filter((a) => a.status === "pending"),
            inbox: [...store.messages.values()].filter((m) => m.recipient_agent_id === agent.agentId && m.status === "pending"),
            channels: [],
          });
          return;
        }
        if (op === "tasks") {
          if (!hasScope(agent, "tasks:read")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          logged(200);
          send(200, {
            ok: true,
            tasks: [...store.tasks.values()].filter(
              (t) => !["completed", "failed", "cancelled"].includes(String(t.status)) && inDomain(agent, String(t.domain)),
            ),
          });
          return;
        }
        if (op === "inbox") {
          if (!hasScope(agent, "messages:read")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          logged(200);
          send(200, { ok: true, messages: [...store.messages.values()].filter((m) => m.recipient_agent_id === agent.agentId) });
          return;
        }
        logged(400);
        send(400, { ok: false, error: "unknown_operation" });
        return;
      }

      if (req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
        const action = body.action;

        if (action === "event.append") {
          if (!hasScope(agent, "events:append")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          if (typeof body.type !== "string" || !APPENDABLE.has(body.type) || !validIdempotency(body.idempotencyKey) || !cleanPayload(body.payload)) {
            logged(400); send(400, { ok: false, error: "invalid_event" }); return;
          }
          if (["actorAgentId", "actorAuthUserId", "userId", "ownerId", "createdAt", "sequence", "projectId"].some((k) => k in (body.payload as Record<string, unknown>))) {
            logged(400); send(400, { ok: false, error: "untrusted_identity_field" }); return;
          }
          const event = appendEvent(agent.agentId, body.type, body.payload, body.idempotencyKey, typeof body.taskId === "string" ? body.taskId : null);
          logged(200);
          send(200, { ok: true, event, confirmed: true });
          return;
        }

        if (action === "task.create") {
          if (!hasScope(agent, "tasks:create")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          if (
            typeof body.title !== "string" || !body.title.trim() || body.title.length > 240 ||
            typeof body.domain !== "string" || !ALL_DOMAINS.includes(body.domain) || !inDomain(agent, body.domain) ||
            !validIdempotency(body.idempotencyKey)
          ) { logged(400); send(400, { ok: false, error: "invalid_task" }); return; }
          const assigned = typeof body.assignedAgentId === "string" ? body.assignedAgentId : null;
          if (assigned && ![...byHash.values()].some((i) => i.agentId === assigned)) {
            logged(400); send(400, { ok: false, error: "unknown_assignee" }); return;
          }
          const existing = [...store.tasks.values()].find(
            (t) => t.created_by_agent_id === agent.agentId && t.idempotency_key === body.idempotencyKey,
          );
          if (existing) { logged(200); send(200, { ok: true, task: existing, duplicate: true, confirmed: true }); return; }
          const task: Record<string, unknown> = {
            id: randomUUID(),
            title: body.title.trim(),
            description: typeof body.description === "string" ? body.description.slice(0, 4000) : "",
            domain: body.domain,
            assigned_agent_id: assigned,
            created_by_agent_id: agent.agentId,
            idempotency_key: body.idempotencyKey,
            max_attempts: Number.isInteger(body.maxAttempts) ? Math.min(10, Math.max(1, Number(body.maxAttempts))) : 3,
            status: "pending",
            result: null,
            lease_owner_agent_id: null,
            lease_expires_at: null,
            heartbeat_at: null,
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          store.tasks.set(String(task.id), task);
          appendEvent(agent.agentId, "task.created", { title: task.title, domain: task.domain, assignedAgentId: assigned }, "task-created:" + task.id, String(task.id));
          logged(201);
          send(201, { ok: true, task, confirmed: true });
          return;
        }

        if (action === "task.claim" || action === "task.heartbeat") {
          const scope = action === "task.claim" ? "tasks:claim" : "tasks:heartbeat";
          if (!hasScope(agent, scope)) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          const task = typeof body.taskId === "string" ? store.tasks.get(body.taskId) : undefined;
          if (!task) { logged(404); send(404, { ok: false, error: "task_not_found" }); return; }
          if (!inDomain(agent, String(task.domain))) { logged(403); send(403, { ok: false, error: "domain_denied" }); return; }
          const seconds = Number.isInteger(body.leaseSeconds) ? Number(body.leaseSeconds) : 120;
          const now = Date.now();
          const leaseAlive = typeof task.lease_expires_at === "string" && new Date(task.lease_expires_at).getTime() > now;
          if (action === "task.claim") {
            if (["completed", "failed", "cancelled"].includes(String(task.status)) || (leaseAlive && task.lease_owner_agent_id !== agent.agentId)) {
              logged(409); send(409, { ok: false, error: "task_not_claimable" }); return;
            }
            task.status = "claimed";
          } else if (!leaseAlive || task.lease_owner_agent_id !== agent.agentId) {
            logged(409); send(409, { ok: false, error: "lease_not_owned" }); return;
          }
          task.lease_owner_agent_id = agent.agentId;
          task.lease_expires_at = new Date(now + seconds * 1000).toISOString();
          task.heartbeat_at = new Date(now).toISOString();
          task.updated_at = new Date(now).toISOString();
          appendEvent(agent.agentId, action === "task.claim" ? "task.claimed" : "task.heartbeat", { leaseExpiresAt: task.lease_expires_at }, `${action}:${task.id}:${task.heartbeat_at}`, String(task.id));
          logged(200);
          send(200, { ok: true, task, confirmed: true });
          return;
        }

        if (action === "task.complete") {
          if (!hasScope(agent, "tasks:heartbeat")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          const task = typeof body.taskId === "string" ? store.tasks.get(body.taskId) : undefined;
          if (!task || !inDomain(agent, String(task.domain))) { logged(403); send(403, { ok: false, error: "domain_denied" }); return; }
          const leaseAlive = typeof task.lease_expires_at === "string" && new Date(task.lease_expires_at).getTime() > Date.now();
          if (!leaseAlive || task.lease_owner_agent_id !== agent.agentId) {
            logged(409); send(409, { ok: false, error: "lease_not_owned" }); return;
          }
          task.status = "completed";
          task.result = isObject(body.result) ? body.result : {};
          task.completed_at = new Date().toISOString();
          task.lease_owner_agent_id = null;
          task.lease_expires_at = null;
          task.updated_at = new Date().toISOString();
          appendEvent(agent.agentId, "task.completed", { result: task.result }, "task-completed:" + task.id, String(task.id));
          logged(200);
          send(200, { ok: true, task, confirmed: true });
          return;
        }

        if (action === "message.send") {
          if (!hasScope(agent, "messages:send")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          if (
            typeof body.recipientAgentId !== "string" || typeof body.subject !== "string" ||
            !body.subject.trim() || body.subject.length > 200 || !validIdempotency(body.idempotencyKey) ||
            !cleanPayload(body.body ?? {})
          ) { logged(400); send(400, { ok: false, error: "invalid_message" }); return; }
          const recipient = [...byHash.values()].find((i) => i.agentId === body.recipientAgentId);
          if (!recipient || recipient.agentId === agent.agentId) { logged(400); send(400, { ok: false, error: "invalid_recipient" }); return; }
          const existing = [...store.messages.values()].find(
            (m) => m.sender_agent_id === agent.agentId && m.idempotency_key === body.idempotencyKey,
          );
          if (existing) { logged(200); send(200, { ok: true, message: existing, duplicate: true, confirmed: true }); return; }
          const message: Record<string, unknown> = {
            id: randomUUID(),
            sender_agent_id: agent.agentId,
            recipient_agent_id: recipient.agentId,
            message_type: typeof body.messageType === "string" ? body.messageType : "status",
            subject: body.subject.trim(),
            body: body.body ?? {},
            status: "pending",
            sent_at: new Date().toISOString(),
            acknowledged_at: null,
            acknowledgement: null,
            idempotency_key: body.idempotencyKey,
          };
          store.messages.set(String(message.id), message);
          appendEvent(agent.agentId, "agent.message.sent", { messageId: message.id, recipientAgentId: recipient.agentId, subject: message.subject }, "message-sent:" + message.id, null);
          logged(201);
          send(201, { ok: true, message, confirmed: true });
          return;
        }

        if (action === "message.ack") {
          if (!hasScope(agent, "messages:ack")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          const message = typeof body.messageId === "string" ? store.messages.get(body.messageId) : undefined;
          if (!message || message.recipient_agent_id !== agent.agentId || message.status !== "pending" ||
              !["acknowledged", "rejected", "completed"].includes(String(body.status))) {
            logged(409); send(409, { ok: false, error: "message_not_pending_or_not_yours" }); return;
          }
          message.status = String(body.status);
          message.acknowledged_at = new Date().toISOString();
          message.acknowledgement = typeof body.note === "string" ? body.note.slice(0, 1000) : "";
          appendEvent(agent.agentId, "agent.message.acknowledged", { messageId: message.id, senderAgentId: message.sender_agent_id, status: message.status }, "message-ack:" + message.id, null);
          logged(200);
          send(200, { ok: true, message, confirmed: true });
          return;
        }

        if (action === "approval.request") {
          if (!hasScope(agent, "approvals:request")) { logged(403); send(403, { ok: false, error: "scope_denied" }); return; }
          if (typeof body.actionName !== "string" || typeof body.target !== "string" || !cleanPayload(body.payload)) {
            logged(400); send(400, { ok: false, error: "invalid_approval_request" }); return;
          }
          const approval: Record<string, unknown> = {
            id: randomUUID(),
            requested_by_agent_id: agent.agentId,
            action: body.actionName.slice(0, 120),
            target: body.target.slice(0, 500),
            payload: body.payload,
            status: "pending",
            requested_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 1440 * 60_000).toISOString(),
          };
          store.approvals.push(approval);
          appendEvent(agent.agentId, "approval.requested", { approvalId: approval.id, action: approval.action, target: approval.target }, "approval-request:" + approval.id, null);
          logged(201);
          send(201, { ok: true, approval, confirmed: true });
          return;
        }

        if (action === "channel.update") {
          logged(403);
          send(403, { ok: false, error: "provider_confirmation_required" });
          return;
        }

        logged(400);
        send(400, { ok: false, error: "unknown_action" });
        return;
      }

      logged(405);
      send(405, { ok: false, error: "method_not_allowed" });
    } catch (err) {
      logged(500);
      send(500, { ok: false, error: err instanceof Error ? err.message : "mock_internal_error" });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    store,
    setFault: (failNext: number, mode: "500" | "drop") => {
      faultRemaining = failNext;
      faultMode = mode;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export const MOCK_SCOPES = ALL_SCOPES;
export const MOCK_DOMAINS = ALL_DOMAINS;
