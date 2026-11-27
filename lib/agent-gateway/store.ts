import type { AgentEventInput, AgentEventRecord, AgentTask, AuthenticatedAgent } from "./contracts"

export type StoreUnavailable = { ok: false; status: 503; error: "agent_event_store_not_configured" }

export interface AgentGatewayStore {
  appendEvent(actor: AuthenticatedAgent, input: AgentEventInput, requestId: string): Promise<AgentEventRecord | StoreUnavailable>
  listTasks(actor: AuthenticatedAgent): Promise<AgentTask[] | StoreUnavailable>
  claimTask(actor: AuthenticatedAgent, taskId: string, leaseSeconds: number): Promise<AgentTask | StoreUnavailable>
  heartbeat(actor: AuthenticatedAgent, taskId: string, leaseSeconds: number): Promise<AgentTask | StoreUnavailable>
}

/** Fail-closed until the schema and individual agent identities are approved. */
export class DisabledAgentGatewayStore implements AgentGatewayStore {
  private unavailable(): StoreUnavailable {
    return { ok: false, status: 503, error: "agent_event_store_not_configured" }
  }
  async appendEvent(): Promise<StoreUnavailable> { return this.unavailable() }
  async listTasks(): Promise<StoreUnavailable> { return this.unavailable() }
  async claimTask(): Promise<StoreUnavailable> { return this.unavailable() }
  async heartbeat(): Promise<StoreUnavailable> { return this.unavailable() }
}
