/**
 * OpenAI Coordinator — main loop (Copiloto V7, Phase 2, preview only).
 *
 * What it does:
 * - Authenticates to the Agent Gateway with the Coordinator's OWN identity
 *   (never the chatgpt key, never Muse's key) and fails closed if the
 *   gateway rejects it.
 * - Polls the gateway inbox: each pending instruction message addressed to
 *   the Coordinator is run through the OpenAI Responses API tool loop
 *   (src/openai.ts), then acknowledged, with the outcome appended to the
 *   persistent event store.
 * - Polls continuity: when a task the Coordinator created is completed by
 *   Muse, the response is received and registered as a checkpoint event.
 * - Every error is logged and, where the gateway is reachable, recorded as
 *   an event. Nothing here sends SMS/WhatsApp, touches payments, or reads
 *   real client data — agent messages are internal only.
 *
 * Future work (NOT implemented): a remote MCP face can be exposed over the
 * same GatewayClient so MCP clients can invoke the same operations. Do not
 * treat MCP as available until it is built and tested.
 */
import { loadConfig, redactedSummary, ConfigError, CoordinatorConfig } from "./config";
import { GatewayClient, GatewayAuthError } from "./gateway";
import { OpenAIClient, RunResult } from "./openai";

const log = (msg: string): void => {
  console.log(`[coordinator ${new Date().toISOString()}] ${msg}`);
};
const logError = (msg: string): void => {
  console.error(`[coordinator ${new Date().toISOString()}] ERROR ${msg}`);
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInstruction(message: Record<string, unknown>, agentId: string): string {
  const sender = String(message.sender_agent_id ?? "unknown");
  const subject = String(message.subject ?? "(no subject)");
  const body = typeof message.body === "object" && message.body !== null ? JSON.stringify(message.body) : String(message.body ?? "");
  return [
    `You are the OpenAI Coordinator for Copiloto V7 (preview environment), agent id "${agentId}".`,
    `An internal Agent Gateway message from agent "${sender}" needs handling.`,
    `Subject: ${subject}`,
    `Body: ${body}`,
    "Standing orders: use only the provided gateway tools; work only with synthetic/preview data;",
    "never request real-world actions (no SMS, WhatsApp, payments, or production changes);",
    "for anything consequential, use request_approval and wait for the human;",
    "when the instruction asks you to delegate work to Muse, create the task with create_task_for_claude;",
    "finish with a short plain-language summary of what you did.",
  ].join("\n");
}

function extractCreatedTaskIds(result: RunResult): string[] {
  const ids: string[] = [];
  for (const call of result.toolCalls) {
    if (call.tool !== "create_task_for_claude" || !call.ok) continue;
    try {
      const parsed = JSON.parse(call.output) as Record<string, unknown>;
      const task = parsed.task as Record<string, unknown> | undefined;
      if (task && typeof task.id === "string") ids.push(task.id);
    } catch {
      /* non-JSON tool output cannot carry a task id */
    }
  }
  return ids;
}

async function main(): Promise<number> {
  let cfg: CoordinatorConfig;
  try {
    cfg = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      logError(err.message);
      return 2;
    }
    throw err;
  }

  log(`starting with config ${JSON.stringify(redactedSummary(cfg))}`);

  const gateway = new GatewayClient({
    baseUrl: cfg.gatewayUrl,
    apiKey: cfg.coordinatorGatewayKey,
    timeoutMs: cfg.requestTimeoutMs,
    logger: (m) => log(m),
    idPrefix: "coordinator",
  });
  const openai = new OpenAIClient({
    apiKey: cfg.openaiApiKey,
    baseUrl: cfg.openaiBaseUrl,
    model: cfg.openaiModel,
    gateway,
    maxSteps: cfg.maxToolSteps,
    timeoutMs: cfg.requestTimeoutMs,
    logger: (m) => log(m),
  });

  // Boot check: prove the Coordinator identity authenticates BEFORE looping.
  let agentId = "coordinator";
  try {
    const status = await gateway.getStatus();
    agentId = String(status.agentId ?? agentId);
    log(`authenticated to Agent Gateway as "${agentId}" with scopes ${JSON.stringify(status.scopes ?? [])}`);
  } catch (err) {
    logError(`boot authentication failed: ${err instanceof Error ? err.message : String(err)}`);
    return 3; // fail closed
  }

  const processedMessageIds = new Set<string>();
  const recordedTaskIds = new Set<string>();
  const createdTaskIds = new Set<string>();

  let stopping = false;
  const onSignal = (sig: string): void => {
    log(`received ${sig}; shutting down gracefully after the current cycle`);
    stopping = true;
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  while (!stopping) {
    try {
      // ---- Inbox: run instructions addressed to the Coordinator ----------
      const inbox = await gateway.getInbox();
      const messages = Array.isArray(inbox.messages) ? (inbox.messages as Record<string, unknown>[]) : [];
      for (const message of messages) {
        if (stopping) break;
        const id = String(message.id ?? "");
        if (!id || message.status !== "pending" || processedMessageIds.has(id)) continue;
        processedMessageIds.add(id);
        log(`processing inbox message ${id} from ${String(message.sender_agent_id ?? "?")}: "${String(message.subject ?? "")}"`);
        try {
          const result = await openai.runInstruction(buildInstruction(message, agentId));
          for (const taskId of extractCreatedTaskIds(result)) {
            createdTaskIds.add(taskId);
            log(`registered delegated task ${taskId} for response tracking`);
          }
          await gateway.ackMessage(id, "completed", result.text.slice(0, 900) || "Processed.");
          await gateway.appendEvent("agent.checkpoint.recorded", {
            summary: "Instruction processed by OpenAI Coordinator",
            messageId: id,
            toolsUsed: result.toolCalls.map((t) => t.tool),
            summaryText: result.text.slice(0, 500),
          });
          log(`message ${id} processed and acknowledged`);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          logError(`message ${id} processing failed: ${detail}`);
          try {
            await gateway.appendEvent("task.failed", { summary: "Instruction processing failed", messageId: id, error: detail.slice(0, 500) });
          } catch (eventErr) {
            logError(`could not record failure event for ${id}: ${eventErr instanceof Error ? eventErr.message : String(eventErr)}`);
          }
          try {
            await gateway.ackMessage(id, "rejected", `Processing failed: ${detail.slice(0, 400)}`);
          } catch (ackErr) {
            logError(`could not reject message ${id}: ${ackErr instanceof Error ? ackErr.message : String(ackErr)}`);
          }
        }
      }

      // ---- Continuity: register responses to tasks we created ------------
      const continuity = await gateway.getContinuity();
      const openTasks = Array.isArray(continuity.tasks) ? (continuity.tasks as Record<string, unknown>[]) : [];
      for (const task of openTasks) {
        if (String(task.created_by_agent_id ?? "") === agentId && typeof task.id === "string") {
          createdTaskIds.add(task.id);
        }
      }
      const events = Array.isArray(continuity.events) ? (continuity.events as Record<string, unknown>[]) : [];
      for (const event of events) {
        const taskId = typeof event.task_id === "string" ? event.task_id : null;
        if (event.event_type !== "task.completed" || !taskId) continue;
        if (!createdTaskIds.has(taskId) || recordedTaskIds.has(taskId)) continue;
        recordedTaskIds.add(taskId);
        const payload = (event.payload as Record<string, unknown> | undefined) ?? {};
        log(`response received for delegated task ${taskId}: ${JSON.stringify(payload).slice(0, 400)}`);
        try {
          await gateway.appendEvent(
            "agent.checkpoint.recorded",
            {
              summary: "Response received from Claude for a Coordinator-created task",
              taskId,
              result: payload.result ?? payload,
            },
            { taskId },
          );
        } catch (err) {
          logError(`could not register response for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      if (err instanceof GatewayAuthError) {
        logError(`gateway authentication lost mid-run: ${err.message}. Failing closed.`);
        return 4;
      }
      // Any other cycle error (network, 5xx after retries, OpenAI outage) is
      // logged and the loop continues on the next poll; nothing is hidden.
      logError(`poll cycle failed (will retry next cycle): ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!stopping) await sleep(cfg.pollIntervalMs);
  }

  log("shutdown complete");
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      logError(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      process.exit(1);
    });
}
