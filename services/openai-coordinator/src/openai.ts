/**
 * OpenAI Responses API client for the Coordinator, with tool calling.
 *
 * The model never touches the network or any secret directly: every tool it
 * can call is one Agent Gateway operation, executed by this process through
 * GatewayClient with the Coordinator's own identity. The loop is bounded
 * (maxSteps) and every tool call + result is recorded and logged.
 *
 * A remote MCP face can later be exposed over the same GatewayClient; this
 * file intentionally does NOT implement MCP.
 */
import { GatewayClient, Domain } from "./gateway";

export interface ToolCallRecord {
  tool: string;
  arguments: Record<string, unknown>;
  ok: boolean;
  output: string;
}

export interface RunResult {
  text: string;
  toolCalls: ToolCallRecord[];
  responseId: string | null;
}

export class OpenAIError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

interface FunctionToolDef {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

const NO_PARAMS: Record<string, unknown> = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

/** The complete tool surface the model is allowed to use. Nothing else exists. */
export const GATEWAY_TOOLS: FunctionToolDef[] = [
  {
    type: "function",
    name: "get_status",
    description: "Read the Coordinator's own Agent Gateway identity and scopes.",
    parameters: NO_PARAMS,
    strict: true,
  },
  {
    type: "function",
    name: "get_continuity",
    description:
      "Read the persistent continuity state: project state, recent events, open tasks, pending approvals and this agent's pending inbox.",
    parameters: NO_PARAMS,
    strict: true,
  },
  {
    type: "function",
    name: "list_tasks",
    description: "List open Agent Gateway tasks in the Coordinator's allowed domains.",
    parameters: NO_PARAMS,
    strict: true,
  },
  {
    type: "function",
    name: "create_task_for_claude",
    description:
      "Create an Agent Gateway task assigned to the Muse (Amani) agent. Use for work Muse must claim and answer.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short task title, max 240 chars." },
        description: { type: "string", description: "What Muse should do and return." },
        domain: {
          type: "string",
          enum: ["platform", "transport", "taxes", "communications", "documents"],
          description: "Task domain. Default platform.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "send_message",
    description: "Send an internal Agent Gateway message to another agent (internal only; never an external channel).",
    parameters: {
      type: "object",
      properties: {
        recipientAgentId: { type: "string", description: "Recipient agent id, e.g. 'Muse'." },
        subject: { type: "string", description: "Message subject, max 200 chars." },
        bodyText: { type: "string", description: "Message body text." },
      },
      required: ["recipientAgentId", "subject", "bodyText"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "ack_message",
    description: "Acknowledge an Agent Gateway message addressed to the Coordinator.",
    parameters: {
      type: "object",
      properties: {
        messageId: { type: "string" },
        status: { type: "string", enum: ["acknowledged", "rejected", "completed"] },
        note: { type: "string" },
      },
      required: ["messageId", "status"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "append_event",
    description:
      "Append an event to the persistent Agent Gateway event store. Only progress, blocked, failed and checkpoint events are permitted.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["task.progress", "task.blocked", "task.failed", "agent.checkpoint.recorded"],
        },
        payload: { type: "object", additionalProperties: true },
      },
      required: ["type", "payload"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "request_approval",
    description:
      "Request human (Miguel) approval for a consequential action. The Coordinator must never perform important actions without a granted approval.",
    parameters: {
      type: "object",
      properties: {
        actionName: { type: "string" },
        target: { type: "string" },
        payload: { type: "object", additionalProperties: true },
      },
      required: ["actionName", "target", "payload"],
      additionalProperties: false,
    },
    strict: true,
  },
];

export interface OpenAIClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  gateway: GatewayClient;
  maxSteps?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  logger?: (message: string) => void;
}

const MAX_TOOL_OUTPUT_CHARS = 8_000;

export class OpenAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly gateway: GatewayClient;
  private readonly maxSteps: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: (message: string) => void;

  constructor(options: OpenAIClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.gateway = options.gateway;
    this.maxSteps = options.maxSteps ?? 8;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? (() => undefined);
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const gw = this.gateway;
    switch (name) {
      case "get_status":
        return gw.getStatus();
      case "get_continuity":
        return gw.getContinuity();
      case "list_tasks":
        return gw.listTasks();
      case "create_task_for_claude":
        return gw.createTask({
          title: String(args.title ?? ""),
          description: typeof args.description === "string" ? args.description : "",
          domain: (typeof args.domain === "string" ? args.domain : "platform") as Domain,
          assignedAgentId: "Muse",
        });
      case "send_message":
        return gw.sendMessage(String(args.recipientAgentId ?? ""), String(args.subject ?? ""), {
          text: typeof args.bodyText === "string" ? args.bodyText : "",
        });
      case "ack_message":
        return gw.ackMessage(
          String(args.messageId ?? ""),
          (typeof args.status === "string" ? args.status : "acknowledged") as "acknowledged" | "rejected" | "completed",
          typeof args.note === "string" ? args.note : undefined,
        );
      case "append_event":
        return gw.appendEvent(
          (typeof args.type === "string" ? args.type : "agent.checkpoint.recorded") as
            | "task.progress"
            | "task.blocked"
            | "task.failed"
            | "agent.checkpoint.recorded",
          typeof args.payload === "object" && args.payload !== null ? (args.payload as Record<string, unknown>) : {},
        );
      case "request_approval":
        return gw.requestApproval(
          String(args.actionName ?? ""),
          String(args.target ?? ""),
          typeof args.payload === "object" && args.payload !== null ? (args.payload as Record<string, unknown>) : {},
        );
      default:
        throw new Error(`unknown_tool: ${name}`);
    }
  }

  /**
   * Run one instruction through the Responses API tool loop.
   * Returns the final assistant text plus the full tool-call record.
   */
  async runInstruction(instruction: string): Promise<RunResult> {
    const input: Record<string, unknown>[] = [{ role: "user", content: instruction }];
    const toolCalls: ToolCallRecord[] = [];
    let lastResponseId: string | null = null;
    let finalText = "";

    for (let step = 0; step < this.maxSteps; step++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let responseJson: Record<string, unknown>;
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/responses`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            tools: GATEWAY_TOOLS,
            tool_choice: "auto",
            input,
          }),
          signal: controller.signal,
        });
        const text = await res.text();
        try {
          responseJson = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          throw new OpenAIError(res.status, `OpenAI returned an unparseable response (HTTP ${res.status})`);
        }
        if (!res.ok) {
          const errObj = (responseJson.error as Record<string, unknown> | undefined) ?? {};
          throw new OpenAIError(res.status, `OpenAI HTTP ${res.status}: ${String(errObj.message ?? "unknown_error")}`);
        }
      } finally {
        clearTimeout(timer);
      }

      lastResponseId = typeof responseJson.id === "string" ? responseJson.id : lastResponseId;
      const output = Array.isArray(responseJson.output) ? (responseJson.output as Record<string, unknown>[]) : [];
      let sawFunctionCall = false;

      for (const item of output) {
        input.push(item);
        if (item.type === "function_call") {
          sawFunctionCall = true;
          const name = String(item.name ?? "");
          const callId = String(item.call_id ?? item.id ?? "");
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(typeof item.arguments === "string" ? item.arguments : "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }
          let resultText: string;
          let ok = true;
          try {
            const result = await this.executeTool(name, args);
            resultText = JSON.stringify(result ?? {});
          } catch (err) {
            ok = false;
            resultText = JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) });
          }
          if (resultText.length > MAX_TOOL_OUTPUT_CHARS) {
            resultText = resultText.slice(0, MAX_TOOL_OUTPUT_CHARS) + "…[truncated]";
          }
          toolCalls.push({ tool: name, arguments: args, ok, output: resultText });
          this.logger(`tool ${name} -> ${ok ? "ok" : "ERROR"}`);
          input.push({ type: "function_call_output", call_id: callId, output: resultText });
        } else if (item.type === "message") {
          const content = Array.isArray(item.content) ? (item.content as Record<string, unknown>[]) : [];
          for (const part of content) {
            if (part.type === "output_text" && typeof part.text === "string") finalText += part.text;
          }
        }
      }

      if (!sawFunctionCall) {
        return { text: finalText.trim(), toolCalls, responseId: lastResponseId };
      }
    }

    throw new OpenAIError(0, `Tool loop exceeded the bound of ${this.maxSteps} steps; aborted without further actions.`);
  }
}
