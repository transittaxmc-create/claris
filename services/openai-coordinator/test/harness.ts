/**
 * Synthetic acceptance harness for the OpenAI Coordinator.
 *
 * Runs the REAL compiled coordinator process against a mock Agent Gateway
 * and a mock OpenAI Responses API on localhost. No live secrets, no external
 * network, synthetic data only.
 *
 * Demonstrates the 8 Phase-2 acceptance points:
 *  1. Coordinator authenticates securely (and fails closed on a bad key).
 *  2. Coordinator <-> Gateway communication works.
 *  3. Coordinator sends a task to Muse.
 *  4. Muse (mock worker) claims it and responds.
 *  5. Coordinator receives and registers the response.
 *  6. Events and states persist in order.
 *  7. An unauthorized request is rejected (401).
 *  8. Errors/disconnections are logged and retried per policy.
 */
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import { startMockGateway, MOCK_SCOPES, MOCK_DOMAINS } from "./mock-gateway";
import { startMockOpenAI } from "./mock-openai";
import { GatewayClient } from "../src/gateway";

const COORD_KEY = "coord-key-" + "c".repeat(40);
const CLAUDE_KEY = "claude-key-" + "d".repeat(40);
const BAD_KEY = "bad-key-" + "x".repeat(44);
const OPENAI_KEY = "sk-mock-openai-key-for-tests-only";

const results: { name: string; ok: boolean; evidence: string }[] = [];
function check(name: string, ok: boolean, evidence: string): void {
  results.push({ name, ok, evidence });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${evidence}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(label: string, cond: () => boolean, timeoutMs = 20_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (cond()) return true;
    await sleep(100);
  }
  console.log(`  (timeout waiting for: ${label})`);
  return false;
}

interface RunningCoordinator {
  child: ChildProcess;
  output: () => string;
  exited: Promise<number | null>;
}

function startCoordinator(env: Record<string, string>): RunningCoordinator {
  const serviceRoot = path.resolve(__dirname, "..", "..");
  let buffer = "";
  const child = spawn(process.execPath, [path.join(serviceRoot, "dist", "src", "index.js")], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d: Buffer) => (buffer += d.toString()));
  child.stderr?.on("data", (d: Buffer) => (buffer += d.toString()));
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  return { child, output: () => buffer, exited };
}

async function main(): Promise<number> {
  console.log("=== Copiloto V7 — OpenAI Coordinator synthetic acceptance harness ===");
  console.log("Synthetic data only. Mocks on localhost. No live secrets.\n");

  const gateway = await startMockGateway([
    { agentId: "coordinator", displayName: "OpenAI Coordinator (mock)", key: COORD_KEY, scopes: MOCK_SCOPES, domainScopes: MOCK_DOMAINS },
    { agentId: "Muse", displayName: "Muse / Amani (mock)", key: CLAUDE_KEY, scopes: MOCK_SCOPES, domainScopes: MOCK_DOMAINS },
  ]);
  const openai = await startMockOpenAI();
  const store = gateway.store;
  console.log(`mock gateway: ${gateway.url}`);
  console.log(`mock openai:  ${openai.url}\n`);

  const baseEnv: Record<string, string> = {
    GATEWAY_URL: gateway.url,
    OPENAI_API_KEY: OPENAI_KEY,
    OPENAI_BASE_URL: openai.url,
    OPENAI_MODEL: "mock-model",
    POLL_INTERVAL_MS: "300",
    MAX_TOOL_STEPS: "8",
    REQUEST_TIMEOUT_MS: "5000",
  };

  // ---- 7 (part 1): unauthorized requests are rejected ---------------------
  const noKey = await fetch(`${gateway.url}?op=status`);
  const noKeyBody = (await noKey.json()) as Record<string, unknown>;
  check(
    "7a. Request without a key is rejected",
    noKey.status === 401 && noKeyBody.error === "agent_authentication_failed",
    `HTTP ${noKey.status} error=${String(noKeyBody.error)}`,
  );
  const badKeyRes = await fetch(`${gateway.url}?op=status`, { headers: { "x-agent-key": BAD_KEY } });
  const badKeyBody = (await badKeyRes.json()) as Record<string, unknown>;
  check(
    "7b. Request with a wrong key is rejected",
    badKeyRes.status === 401 && badKeyBody.error === "agent_authentication_failed",
    `HTTP ${badKeyRes.status} error=${String(badKeyBody.error)}`,
  );

  // ---- Start the real coordinator -----------------------------------------
  const coord = startCoordinator({ ...baseEnv, COORDINATOR_GATEWAY_KEY: COORD_KEY });

  // ---- 1: coordinator authenticates ----------------------------------------
  const authed = await waitFor(
    "coordinator boot auth",
    () => coord.output().includes('authenticated to Agent Gateway as "coordinator"'),
  );
  check("1. Coordinator authenticates to the gateway with its own identity", authed,
    authed ? 'boot log: authenticated to Agent Gateway as "coordinator"' : "boot log line not found");

  // ---- 2: coordinator <-> gateway communication ----------------------------
  const communicated = await waitFor(
    "coordinator read ops",
    () =>
      store.requestLog.some((r) => r.agentId === "coordinator" && r.op === "status" && r.status === 200) &&
      store.requestLog.some((r) => r.agentId === "coordinator" && r.op === "inbox" && r.status === 200) &&
      store.requestLog.some((r) => r.agentId === "coordinator" && r.op === "continuity" && r.status === 200),
  );
  check("2. Coordinator <-> gateway communication (status + inbox + continuity polls)", communicated,
    communicated ? "request log shows coordinator 200s for status, inbox and continuity" : "expected polls not observed");

  // ---- Instruction arrives for the coordinator (sent by mock Muse) -------
  const claudeClient = new GatewayClient({ baseUrl: gateway.url, apiKey: CLAUDE_KEY, idPrefix: "claude-mock" });
  await claudeClient.sendMessage(
    "coordinator",
    "Synthetic instruction",
    { instruction: 'Create a task for Muse titled "Synthetic design check" and confirm the delegation.' },
    { messageType: "task_handoff" },
  );

  // ---- 3: coordinator creates a task for Muse -----------------------------
  const taskCreated = await waitFor(
    "task created for Muse",
    () =>
      [...store.tasks.values()].some(
        (t) => t.created_by_agent_id === "coordinator" && t.assigned_agent_id === "Muse",
      ),
  );
  const task = [...store.tasks.values()].find(
    (t) => t.created_by_agent_id === "coordinator" && t.assigned_agent_id === "Muse",
  );
  check("3. Coordinator creates a task assigned to Muse (via the OpenAI tool loop)", taskCreated && !!task,
    task ? `task ${String(task.id)} title="${String(task.title)}" status=${String(task.status)}` : "no coordinator->Muse task found");

  const instructionMessage = [...store.messages.values()].find((m) => m.recipient_agent_id === "coordinator");
  const acked = await waitFor(
    "instruction acked",
    () => instructionMessage?.status === "completed",
  );
  check("2b. Instruction message is acknowledged by the coordinator after processing", acked,
    acked ? `message ${String(instructionMessage?.id)} status=completed` : `message status=${String(instructionMessage?.status)}`);

  // ---- 4: mock Muse claims and responds -----------------------------------
  let claimOk = false;
  let completeOk = false;
  if (task) {
    const taskId = String(task.id);
    try {
      await claudeClient.claimTask(taskId, 120);
      claimOk = store.tasks.get(taskId)?.status === "claimed";
      await claudeClient.heartbeatTask(taskId, 120);
      const done = await claudeClient.completeTask(taskId, {
        verdict: "synthetic-ok",
        detail: "Mock Muse reviewed the synthetic payload. No real data.",
      });
      completeOk = (done.task as Record<string, unknown> | undefined)?.status === "completed";
    } catch (err) {
      console.log(`  mock Muse worker error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  check("4. Muse claims the task (lease) and responds with task.complete", claimOk && completeOk,
    `claim=${claimOk} complete=${completeOk} result=${JSON.stringify(store.tasks.get(String(task?.id))?.result ?? null)}`);

  // ---- 5: coordinator receives and registers the response -------------------
  const taskId = String(task?.id ?? "");
  const responseRegistered = await waitFor(
    "response registered by coordinator",
    () =>
      store.events.some(
        (e) =>
          e.actor_agent_id === "coordinator" &&
          e.event_type === "agent.checkpoint.recorded" &&
          isResponseCheckpoint(e, taskId),
      ),
  );
  check("5. Coordinator receives the response and registers it as a checkpoint event", responseRegistered,
    responseRegistered ? `checkpoint event found for task ${taskId}` : "no response checkpoint event found");
  check("5b. Coordinator log shows the received response",
    coord.output().includes(`response received for delegated task ${taskId}`),
    coord.output().includes(`response received for delegated task ${taskId}`) ? "stdout contains the response-received line" : "log line missing");

  // ---- 6: events/states persisted in order -----------------------------------
  const seq = (type: string, pred?: (e: Record<string, unknown>) => boolean): number => {
    const e = store.events.find((ev) => ev.event_type === type && (!pred || pred(ev)));
    return e ? Number(e.sequence) : -1;
  };
  const sMsg = seq("agent.message.sent", (e) => (e.payload as Record<string, unknown>)?.recipientAgentId === "coordinator");
  const sCreated = seq("task.created", (e) => e.task_id === taskId);
  const sClaimed = seq("task.claimed", (e) => e.task_id === taskId);
  const sCompleted = seq("task.completed", (e) => e.task_id === taskId);
  const sRegistered = seq("agent.checkpoint.recorded", (e) => isResponseCheckpoint(e, taskId));
  const allSeq = store.events.map((e) => Number(e.sequence));
  const strictlyIncreasing = allSeq.every((v, i) => i === 0 || v > allSeq[i - 1]);
  check(
    "6. Events persist in order (message -> created -> claimed -> completed -> registered)",
    sMsg > 0 && sCreated > sMsg && sClaimed > sCreated && sCompleted > sClaimed && sRegistered > sCompleted && strictlyIncreasing,
    `sequences: message=${sMsg} created=${sCreated} claimed=${sClaimed} completed=${sCompleted} registered=${sRegistered}; total events=${store.events.length}; strictlyIncreasing=${strictlyIncreasing}`,
  );

  // ---- 8: faults are logged and retried --------------------------------------
  const logBefore = store.requestLog.length;
  gateway.setFault(2, "500");
  const retried = await waitFor(
    "500s retried and recovered",
    () => {
      const faults = store.requestLog.slice(logBefore).filter((r) => r.status === 500).length;
      const recovered = store.requestLog.slice(logBefore).some((r) => r.agentId === "coordinator" && r.status === 200);
      return faults >= 2 && recovered;
    },
    25_000,
  );
  check("8a. Injected HTTP 500s are retried and the coordinator recovers", retried && coord.child.exitCode === null,
    `fault responses seen=${store.requestLog.slice(logBefore).filter((r) => r.status === 500).length}; coordinator alive=${coord.child.exitCode === null}; retry logged=${coord.output().includes("retry")}`);

  const logBeforeDrop = store.requestLog.length;
  gateway.setFault(1, "drop");
  const dropRecovered = await waitFor(
    "dropped connection retried and recovered",
    () => {
      const drops = store.requestLog.slice(logBeforeDrop).filter((r) => r.status === 0).length;
      const recovered = store.requestLog.slice(logBeforeDrop).some((r) => r.agentId === "coordinator" && r.status === 200);
      return drops >= 1 && recovered;
    },
    25_000,
  );
  check("8b. A dropped connection is logged and retried; coordinator keeps running", dropRecovered && coord.child.exitCode === null,
    `drops seen=${store.requestLog.slice(logBeforeDrop).filter((r) => r.status === 0).length}; coordinator alive=${coord.child.exitCode === null}`);

  // ---- 1b/7c: a coordinator with a bad key fails closed -----------------------
  const badCoord = startCoordinator({ ...baseEnv, COORDINATOR_GATEWAY_KEY: BAD_KEY });
  const badExit = await Promise.race([badCoord.exited, sleep(15_000).then(() => "timeout" as const)]);
  if (badExit === "timeout") badCoord.child.kill("SIGKILL");
  check(
    "1b/7c. Coordinator with a wrong key fails closed (non-zero exit, auth error logged)",
    badExit === 3 && badCoord.output().includes("agent_authentication_failed"),
    `exit=${String(badExit)}; auth error in output=${badCoord.output().includes("agent_authentication_failed")}`,
  );

  // ---- Graceful shutdown -------------------------------------------------------
  coord.child.kill("SIGTERM");
  const goodExit = await Promise.race([coord.exited, sleep(10_000).then(() => "timeout" as const)]);
  if (goodExit === "timeout") coord.child.kill("SIGKILL");
  check("9. Graceful shutdown on SIGTERM (exit 0)", goodExit === 0, `exit=${String(goodExit)}`);

  await gateway.close();
  await openai.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== SUMMARY: ${passed}/${results.length} assertions passed; OpenAI mock requests=${openai.requestCount()}; gateway requests=${store.requestLog.length}; events persisted=${store.events.length} ===`);
  const byPrefix = (prefix: string): boolean => {
    const r = results.find((x) => x.name.startsWith(prefix));
    return !!r && r.ok;
  };
  const areas: [string, boolean][] = [
    ["1 auth", byPrefix("1.") && byPrefix("1b/7c.")],
    ["2 comms", byPrefix("2.") && byPrefix("2b.")],
    ["3 task->Muse", byPrefix("3.")],
    ["4 claude responds", byPrefix("4.")],
    ["5 response registered", byPrefix("5.") && byPrefix("5b.")],
    ["6 ordered persistence", byPrefix("6.")],
    ["7 unauthorized rejected", byPrefix("7a.") && byPrefix("7b.")],
    ["8 errors logged+retried", byPrefix("8a.") && byPrefix("8b.")],
  ];
  for (const [label, ok] of areas) console.log(`  acceptance ${label}: ${ok ? "DEMONSTRATED" : "NOT DEMONSTRATED"}`);
  return results.every((r) => r.ok) ? 0 : 1;
}

function isResponseCheckpoint(e: Record<string, unknown>, taskId: string): boolean {
  const payload = e.payload as Record<string, unknown> | undefined;
  return !!payload && payload.taskId === taskId && typeof payload.summary === "string" && payload.summary.includes("Response received");
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`HARNESS FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    process.exit(1);
  });
