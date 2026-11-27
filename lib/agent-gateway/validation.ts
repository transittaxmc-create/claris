import { AGENT_EVENT_TYPES, type AgentCheckpoint, type AgentEventInput, type AgentEventRecord, type AgentId } from "./contracts"

const FORBIDDEN_CALLER_FIELDS = new Set([
  "actorAgentId", "actorAuthUserId", "actorId", "userId", "ownerId", "createdAt", "sequence", "projectId",
])

export type ValidationResult =
  | { ok: true; value: AgentEventInput }
  | { ok: false; error: "invalid_event" | "untrusted_identity_field" | "invalid_idempotency_key" | "invalid_payload" }

export function validateAgentEventInput(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "invalid_event" }
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => FORBIDDEN_CALLER_FIELDS.has(key))) return { ok: false, error: "untrusted_identity_field" }
  if (typeof input.idempotencyKey !== "string" || !/^[a-zA-Z0-9._:-]{8,128}$/.test(input.idempotencyKey)) {
    return { ok: false, error: "invalid_idempotency_key" }
  }
  if (typeof input.type !== "string" || !AGENT_EVENT_TYPES.includes(input.type as never)) return { ok: false, error: "invalid_event" }
  if (input.taskId !== undefined && (typeof input.taskId !== "string" || input.taskId.length > 128)) return { ok: false, error: "invalid_event" }
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) return { ok: false, error: "invalid_payload" }
  if (JSON.stringify(input.payload).length > 16_384) return { ok: false, error: "invalid_payload" }
  const allowed = new Set(["idempotencyKey", "type", "taskId", "payload"])
  if (Object.keys(input).some((key) => !allowed.has(key))) return { ok: false, error: "invalid_event" }
  return {
    ok: true,
    value: {
      idempotencyKey: input.idempotencyKey,
      type: input.type as AgentEventInput["type"],
      ...(typeof input.taskId === "string" ? { taskId: input.taskId } : {}),
      payload: input.payload as Record<string, unknown>,
    },
  }
}

/** Derives one checkpoint per agent from persisted, server-stamped events. */
export function deriveLatestCheckpoints(events: AgentEventRecord[]): AgentCheckpoint[] {
  const latest = new Map<AgentId, AgentEventRecord>()
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    if (event.type !== "agent.checkpoint.recorded") continue
    const current = latest.get(event.actorAgentId)
    if (!current || event.sequence > current.sequence) latest.set(event.actorAgentId, event)
  }
  return [...latest.values()].map((event) => ({
    agentId: event.actorAgentId,
    eventId: event.id,
    sequence: event.sequence,
    summary: typeof event.payload.summary === "string" ? event.payload.summary : "",
    pendingTaskIds: Array.isArray(event.payload.pendingTaskIds)
      ? event.payload.pendingTaskIds.filter((id): id is string => typeof id === "string")
      : [],
    nextAction: typeof event.payload.nextAction === "string" ? event.payload.nextAction : "",
    createdAt: event.createdAt,
  }))
}
