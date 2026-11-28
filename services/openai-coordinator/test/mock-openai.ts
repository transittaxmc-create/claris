/**
 * Mock OpenAI Responses API for the synthetic acceptance harness.
 *
 * Implements just enough of POST /v1/responses for the Coordinator's tool
 * loop: it inspects the accumulated input, and answers with the next scripted
 * function_call (get_status -> create_task_for_claude -> append_event) and
 * finally an assistant message. Requires a Bearer header, like the real API.
 * Synthetic only; no real model, no real key.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

export interface MockOpenAI {
  url: string;
  requestCount: () => number;
  close: () => Promise<void>;
}

interface InputItem {
  type?: string;
  role?: string;
  name?: string;
  call_id?: string;
  content?: unknown;
  output?: unknown;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function extractUserText(input: InputItem[]): string {
  for (const item of input) {
    if (item.role === "user" && typeof item.content === "string") return item.content;
  }
  return "";
}

function completedTools(input: InputItem[]): { name: string; output: string }[] {
  const callNames = new Map<string, string>();
  for (const item of input) {
    if (item.type === "function_call" && item.call_id) callNames.set(item.call_id, String(item.name ?? ""));
  }
  const done: { name: string; output: string }[] = [];
  for (const item of input) {
    if (item.type === "function_call_output" && item.call_id) {
      done.push({ name: callNames.get(item.call_id) ?? "", output: typeof item.output === "string" ? item.output : "" });
    }
  }
  return done;
}

let callCounter = 0;
function functionCall(name: string, args: Record<string, unknown>): Record<string, unknown> {
  callCounter++;
  return {
    type: "function_call",
    id: `fc_mock_${callCounter}`,
    call_id: `call_mock_${callCounter}`,
    name,
    arguments: JSON.stringify(args),
    status: "completed",
  };
}

export async function startMockOpenAI(): Promise<MockOpenAI> {
  let requests = 0;
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: Record<string, unknown>): void => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method !== "POST" || url.pathname !== "/v1/responses") {
      send(404, { error: { message: "not_found" } });
      return;
    }
    const auth = req.headers["authorization"];
    if (typeof auth !== "string" || !auth.startsWith("Bearer ") || auth.length < 10) {
      send(401, { error: { message: "missing or invalid api key", type: "invalid_request_error" } });
      return;
    }
    requests++;
    const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
    const input = Array.isArray(body.input) ? (body.input as InputItem[]) : [];
    const done = completedTools(input);
    const doneNames = done.map((d) => d.name);

    let output: Record<string, unknown>[];
    if (!doneNames.includes("get_status")) {
      output = [functionCall("get_status", {})];
    } else if (!doneNames.includes("create_task_for_claude")) {
      const userText = extractUserText(input);
      const titled = userText.match(/titled\s*\\?"([^"]{3,120})"/);
      const quoted = userText.match(/"([^"]{3,120})"/);
      const title = (titled ? titled[1] : quoted ? quoted[1] : "Synthetic task for Muse").replace(/\\+$/, "");
      output = [
        functionCall("create_task_for_claude", {
          title,
          description: "Synthetic acceptance-test task. Review the synthetic payload and answer with a synthetic verdict. No real data.",
          domain: "platform",
        }),
      ];
    } else if (!doneNames.includes("append_event")) {
      output = [
        functionCall("append_event", {
          type: "agent.checkpoint.recorded",
          payload: { summary: "Task delegated to Muse (synthetic)", synthetic: true },
        }),
      ];
    } else {
      const createOutput = done.find((d) => d.name === "create_task_for_claude")?.output ?? "{}";
      let taskId = "unknown";
      try {
        const parsed = JSON.parse(createOutput) as Record<string, unknown>;
        const task = parsed.task as Record<string, unknown> | undefined;
        if (task && typeof task.id === "string") taskId = task.id;
      } catch {
        /* keep fallback */
      }
      output = [
        {
          type: "message",
          id: `msg_mock_${requests}`,
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: `Delegated task ${taskId} to Muse and recorded the checkpoint.` }],
        },
      ];
    }

    send(200, {
      id: `resp_mock_${requests}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: String(body.model ?? "mock-model"),
      output,
      usage: { input_tokens: 42, output_tokens: 17, total_tokens: 59 },
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requestCount: () => requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
