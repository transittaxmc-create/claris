export const AGENT_IDS = ["chatgpt", "muse", "amani", "system"] as const
export type AgentId = (typeof AGENT_IDS)[number]

export const AGENT_EVENT_TYPES = [
  "task.created", "task.claimed", "task.heartbeat", "task.progress", "task.blocked",
  "task.completed", "task.failed", "approval.requested", "approval.granted", "approval.denied",
  "agent.checkpoint.recorded", "channel.status.changed", "deployment.observed", "test.completed",
] as const
export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number]

export type TaskStatus =
  | "pending" | "claimed" | "in_progress" | "awaiting_approval"
  | "blocked" | "completed" | "failed" | "cancelled"

export type ChannelDeliveryState =
  | "not_connected" | "unknown" | "queued" | "sending" | "sent"
  | "delivered" | "failed" | "disabled"

export type ChannelState = {
  provider: string
  connection: "not_connected" | "connected" | "degraded" | "unknown"
  delivery: ChannelDeliveryState
  lastEventAt: string | null
  lastConfirmedAt: string | null
  lastErrorCode: string | null
}

export type IndependentChannelStates = { smsAmani: ChannelState; whatsappZapClaw: ChannelState }

export type AgentEventInput = {
  idempotencyKey: string
  type: AgentEventType
  taskId?: string
  payload: Record<string, unknown>
}

export type AgentEventRecord = AgentEventInput & {
  id: string
  projectId: "copiloto-v7"
  actorAgentId: AgentId
  actorAuthUserId: string
  sequence: number
  createdAt: string
  requestId: string
}

export type AgentCheckpoint = {
  agentId: AgentId
  eventId: string
  sequence: number
  summary: string
  pendingTaskIds: string[]
  nextAction: string
  createdAt: string
}

export type AgentTask = {
  id: string
  title: string
  domain: "platform" | "transport" | "taxes" | "communications" | "documents"
  status: TaskStatus
  assignedAgentId: AgentId | null
  leaseOwnerAgentId: AgentId | null
  leaseExpiresAt: string | null
  heartbeatAt: string | null
  attemptCount: number
  maxAttempts: number
  idempotencyKey: string
}

export type AgentScope =
  | "continuity:read" | "tasks:read" | "tasks:claim"
  | "tasks:heartbeat" | "events:append" | "approvals:request"

export type AuthenticatedAgent = {
  agentId: AgentId
  authUserId: string
  scopes: AgentScope[]
  domainScopes: Array<"transport" | "taxes" | "communications" | "documents">
}
