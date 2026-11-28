# OpenAI Coordinator — Copiloto V7 Phase 2 (2026-11-27)

Status: **BUILT in preview; synthetic acceptance PASSED; live end-to-end NOT
yet demonstrated** (blocked on two secrets Miguel must configure — see
"Pending secrets"). This document is the factual record. Do not read it as
proof of bidirectional live communication: that requires the live run with
the real gateway and the real OpenAI key, registered in Issue #87.

## Why this service exists

Phase 1 proved the Agent Gateway from Amani's side (Muse authenticated,
first real HTTP message stored pending for `chatgpt`), and proved the
ChatGPT conversation runtime cannot complete its side: it has no supported
persistent secret store and cannot inject the `x-agent-key` header in future
conversations. Miguel decided (2026-11-27) that the ChatGPT side connects in
Phase 2 via API, with no paid plan. The Coordinator is the server-side
runtime for that route: it holds the OpenAI-side gateway identity in server
secrets, calls the OpenAI API (Responses API + tool calling), and exchanges
tasks, messages and events with Muse through the gateway, so results can
be reviewed before any important action and Miguel's approvals gate
consequential steps.

## Architecture

```
                ┌──────────────────────────┐
                │      OpenAI API          │
                │  (Responses API + tools) │
                └────────────▲─────────────┘
                             │ tool calls = gateway ops only
                ┌────────────┴─────────────┐        ┌────────────────────┐
                │   OpenAI Coordinator     │  HTTPS │   Agent Gateway    │
                │   services/openai-       ├───────►│ Supabase Edge Fn   │
                │   coordinator (Node 20,  │ x-agent│ CRM project        │
                │   TypeScript, standalone)│  -key  │ mimgwleghecseoymgdug│
                └──────────────────────────┘        └─────────┬──────────┘
                                                     tasks / messages / events
                                                     ┌────────▼──────────┐
                                                     │  Muse (Amani)   │
                                                     └───────────────────┘
```

- Poll loop (`src/index.ts`): authenticates at boot (fail closed), polls
  continuity + inbox, runs each unprocessed instruction through the model,
  acknowledges the message (completed, or rejected with the error), appends
  checkpoint events, and registers responses to Coordinator-created tasks
  when their `task.completed` events appear in continuity (the tasks read op
  excludes completed tasks by design). Graceful SIGINT/SIGTERM shutdown;
  exit codes distinguish config error (2), boot auth failure (3) and auth
  lost mid-run (4).
- OpenAI client (`src/openai.ts`): Responses API with exactly eight tools,
  all gateway operations: `get_status`, `get_continuity`, `list_tasks`,
  `create_task_for_claude` (always assigns `Muse`), `send_message`,
  `ack_message`, `append_event` (gateway-allowed event types only),
  `request_approval`. Bounded loop (`MAX_TOOL_STEPS`, default 8); every tool
  call and result is logged; tool outputs are truncated before returning to
  the model.
- Gateway client (`src/gateway.ts`): mirrors the deployed contract in
  AGENT-GATEWAY-API.md — GET `?op=status|continuity|tasks|inbox`; POST
  `task.create|claim|heartbeat|complete`, `event.append`, `message.send`,
  `message.ack`, `approval.request`. `channel.update` is deliberately not
  exposed (the gateway always 403s it pending provider confirmation).
  Idempotency keys are generated once per logical call and reused across its
  retries; retries happen only on network errors and HTTP 5xx with
  exponential backoff; 4xx is never retried. Typed errors
  (`GatewayError`, `GatewayAuthError`).
- Config (`src/config.ts`): environment only — `OPENAI_API_KEY`,
  `COORDINATOR_GATEWAY_KEY`, `GATEWAY_URL` (default the deployed function
  URL), `OPENAI_BASE_URL`, `OPENAI_MODEL` (default `gpt-5`),
  `POLL_INTERVAL_MS`, `MAX_TOOL_STEPS`, `REQUEST_TIMEOUT_MS`. Missing
  variables fail closed with an error listing names only; log summaries are
  redacted; no secret is hardcoded anywhere; `.env.example` carries
  placeholders only.

**MCP:** a remote MCP face over the same gateway client is the planned next
step for MCP clients. It is **not implemented** and must not be described as
implemented.

## Files (this commit, branch feat/copiloto-v7-phase1-foundation)

New — `services/openai-coordinator/`:
- `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `README.md`
- `src/config.ts`, `src/gateway.ts`, `src/openai.ts`, `src/index.ts`
- `test/mock-gateway.ts` (in-memory mirror of the deployed gateway contract,
  incl. key-hash auth, scope checks, idempotency, leases, event-type rules,
  ack rules, channel.update 403, and fault injection)
- `test/mock-openai.ts` (scripted Responses API: status check → delegate →
  checkpoint)
- `test/harness.ts` (acceptance harness; spawns the real compiled service)

New — `docs/copiloto-v7-master/OPENAI-COORDINATOR.md` (this file).

Modified:
- `docs/copiloto-v7-master/CURRENT-STATE.md` — new section 28.
- `components/copiloto/how-it-works-screen.tsx` — manual §42 added at the
  end plus exactly one index line; no renumbering, no other manual changes.
- `tsconfig.json` — root `exclude` gains `"services"` so the standalone
  service stays outside the Next app typecheck (see verification below).

The service has its own `package-lock.json` (dev tooling only: typescript,
@types/node) and is not part of the Next app build or the pnpm workspace.

## Tests — real results (2026-11-27)

Commands (in `services/openai-coordinator/`):
- `npm install` → added 3 packages (typescript 5.7.x, @types/node).
- `npm run build` → `tsc -p tsconfig.json` exit 0 (strict, zero diagnostics).
- `node dist/test/harness.js` → exit 0, **14/14 assertions passed**:

```
PASS  7a. Request without a key is rejected — HTTP 401 agent_authentication_failed
PASS  7b. Request with a wrong key is rejected — HTTP 401 agent_authentication_failed
PASS  1.  Coordinator authenticates to the gateway with its own identity
PASS  2.  Coordinator <-> gateway communication (status + inbox + continuity polls)
PASS  3.  Coordinator creates a task assigned to Muse (via the OpenAI tool loop)
          — title="Synthetic design check"
PASS  2b. Instruction message is acknowledged after processing (status=completed)
PASS  4.  Muse claims the task (lease) and responds with task.complete
          — result {"verdict":"synthetic-ok", ...}
PASS  5.  Coordinator receives the response and registers it (checkpoint event)
PASS  5b. Coordinator log shows the received response
PASS  6.  Events persist in order — sequences message=1 created=2 claimed=6
          completed=8 registered=9; 9 events; strictly increasing
PASS  8a. Injected HTTP 500s are retried and the coordinator recovers
PASS  8b. A dropped connection is logged and retried; coordinator keeps running
PASS  1b/7c. Coordinator with a wrong key fails closed — exit 3, auth error logged
PASS  9.  Graceful shutdown on SIGTERM — exit 0
SUMMARY: 14/14; OpenAI mock requests=4; gateway requests=27; events persisted=9
```

All eight acceptance areas are demonstrated against the mocks: (1) secure
authentication, (2) coordinator↔gateway communication, (3) task sent to
Muse, (4) Muse claims and responds, (5) response received and
registered, (6) ordered persistence, (7) unauthorized rejection,
(8) errors/disconnections logged and retried. **Synthetic data only** — the
mock gateway mirrors the deployed contract but is not the live gateway, and
the mock model is scripted, not the real OpenAI API.

App typecheck (root, `./node_modules/.bin/tsc --noEmit`, run locally in the
working clone): **76 diagnostics, exit 2, before AND after this change —
the diagnostic sets are byte-identical and none originate in `services/`**.
This matches the branch's verified CI baseline (76 = 69 pre-existing + 7
from the Deno function source).

## Pending secrets (both are Miguel's hand; outside this build's limits)

1. **OpenAI API key** — deposit into the existing Secure Vault card
   (`custom.openai-api`), then set `OPENAI_API_KEY` in the Coordinator's
   Railway review service secrets.
2. **Coordinator gateway identity** — create a NEW identity row in
   `agent_identities` (CRM Supabase) with its own 256-bit key; store the raw
   value in Supabase Vault (suggested name
   `copiloto_v7_coordinator_agent_key`); Miguel retrieves it in the trusted
   SQL Editor and deposits it as `COORDINATOR_GATEWAY_KEY` in the service
   secrets. Creating this identity is a Supabase change and needs Miguel's
   express approval; it was NOT done here.

The Coordinator must never reuse the `chatgpt` identity/key (whose current
deposit is defective and untouched) or Muse's key.

## Risks and open items

- Live E2E could still surface contract drift between the mock and the real
  Edge Function (the mock mirrors the published contract + deployed source
  summary; only the live run proves parity).
- The key+hash vs Auth+JWT architecture decision is still Miguel's; the
  Coordinator works with either future auth as long as the gateway keeps
  accepting its credential at the same endpoint shape.
- Railway review is a trial workspace; the service needs a durable home
  before any reliance.
- Historical status note: message `f9aab76d-2a38-4841-904f-033352b3bbf5`
  was later ACKed as part of the ChatGPT↔Muse E2E. See the Phase 1 addendum
  at the end of this document and Issue #87 Verification #22. The Coordinator
  service still does not impersonate `chatgpt`.

## Next steps

1. Miguel deposits the OpenAI key and approves/creates the Coordinator
   identity (above).
2. Create the Railway review service from `services/openai-coordinator`
   with the five+ env secrets; start it; verify boot auth against the real
   gateway (`GET ?op=status` as the Coordinator identity).
3. Live synthetic round trip: Amani sends an instruction → Coordinator
   delegates a task to `Muse` → Amani claims/completes → Coordinator
   registers the response; register every step in Issue #87. Only then may
   bidirectional live communication be claimed.
4. The Phase-1 ChatGPT↔Muse ACK is CLOSED by Issue #87 Verification #22
   via Amani's API route. Do not repeat this setup; keep Coordinator's own
   identity and live E2E as a separate Phase 2 task.


## Addendum — Phase 1 ChatGPT↔Muse E2E closed (2026-11-27)

Issue #87 Verification #22 supersedes the earlier pending-message statements in this document: the live message `f9aab76d-2a38-4841-904f-033352b3bbf5` was ACKed, the second checkpoint `a30b3bb0-316c-40a6-9af9-e9e8ffd762d4` was ACKed, and ChatGPT sent a reply that Muse received and ACKed. The verified route is Amani-operated API with attribution `chatgpt (via amani)`. Do not repeat or reopen the ChatGPT↔Muse connection setup.

This does **not** close the Coordinator's separate live E2E. The Coordinator's own Gateway identity and key, plus `OPENAI_API_KEY` in its service runtime, remain separate prerequisites. The Coordinator SQL is prepared but not executed. MCP remains planned, not implemented. The key+hash vs Auth+JWT architecture decision remains open to Miguel.
