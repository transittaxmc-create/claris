import test from "node:test"
import assert from "node:assert/strict"
import { validateAgentEventInput, deriveLatestCheckpoints } from "../lib/agent-gateway/validation.ts"
import { DisabledAgentGatewayStore } from "../lib/agent-gateway/store.ts"
import type { AgentEventRecord, IndependentChannelStates } from "../lib/agent-gateway/contracts.ts"

test("accepts a valid synthetic event", () => {
  const result = validateAgentEventInput({ idempotencyKey: "chatgpt-20261127-0001", type: "task.progress", taskId: "task-1", payload: { note: "synthetic" } })
  assert.equal(result.ok, true)
})

test("rejects caller-supplied actor, owner, user and server timestamps", () => {
  for (const field of ["actorAgentId", "actorAuthUserId", "userId", "ownerId", "createdAt", "sequence"]) {
    const result = validateAgentEventInput({ idempotencyKey: "chatgpt-20261127-0002", type: "task.progress", payload: {}, [field]: "forged" })
    assert.deepEqual(result, { ok: false, error: "untrusted_identity_field" })
  }
})

test("rejects malformed idempotency keys, unknown types and unknown fields", () => {
  assert.equal(validateAgentEventInput({ idempotencyKey: "short", type: "task.progress", payload: {} }).ok, false)
  assert.equal(validateAgentEventInput({ idempotencyKey: "chatgpt-20261127-0003", type: "unknown", payload: {} }).ok, false)
  assert.equal(validateAgentEventInput({ idempotencyKey: "chatgpt-20261127-0004", type: "task.progress", payload: {}, admin: true }).ok, false)
})

test("derives the latest checkpoint independently for each agent", () => {
  const events = [
    { id: "e1", projectId: "copiloto-v7", actorAgentId: "chatgpt", actorAuthUserId: "u1", sequence: 1, createdAt: "2026-11-27T10:00:00Z", requestId: "r1", idempotencyKey: "chatgpt-00000001", type: "agent.checkpoint.recorded", payload: { summary: "old", nextAction: "old" } },
    { id: "e2", projectId: "copiloto-v7", actorAgentId: "muse", actorAuthUserId: "u2", sequence: 2, createdAt: "2026-11-27T10:01:00Z", requestId: "r2", idempotencyKey: "muse-00000001", type: "agent.checkpoint.recorded", payload: { summary: "Muse", pendingTaskIds: ["t2"], nextAction: "review" } },
    { id: "e3", projectId: "copiloto-v7", actorAgentId: "chatgpt", actorAuthUserId: "u1", sequence: 3, createdAt: "2026-11-27T10:02:00Z", requestId: "r3", idempotencyKey: "chatgpt-00000002", type: "agent.checkpoint.recorded", payload: { summary: "latest", pendingTaskIds: ["t1"], nextAction: "build" } },
  ] as AgentEventRecord[]
  const checkpoints = deriveLatestCheckpoints(events)
  assert.equal(checkpoints.length, 2)
  assert.equal(checkpoints.find((c) => c.agentId === "chatgpt")?.summary, "latest")
  assert.equal(checkpoints.find((c) => c.agentId === "muse")?.summary, "Muse")
})

test("SMS/Amani and WhatsApp/ZapClaw state remain separate", () => {
  const states: IndependentChannelStates = {
    smsAmani: { provider: "Amani phone bridge", connection: "unknown", delivery: "unknown", lastEventAt: null, lastConfirmedAt: null, lastErrorCode: null },
    whatsappZapClaw: { provider: "ZapClaw", connection: "not_connected", delivery: "not_connected", lastEventAt: null, lastConfirmedAt: null, lastErrorCode: null },
  }
  assert.notEqual(states.smsAmani, states.whatsappZapClaw)
  assert.equal(states.smsAmani.provider, "Amani phone bridge")
  assert.equal(states.whatsappZapClaw.provider, "ZapClaw")
})

test("disabled event store fails closed", async () => {
  const result = await new DisabledAgentGatewayStore().appendEvent(null as never, { idempotencyKey: "chatgpt-20261127-0005", type: "task.progress", payload: {} }, "req-test")
  assert.deepEqual(result, { ok: false, status: 503, error: "agent_event_store_not_configured" })
})
