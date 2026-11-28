# OpenAI Coordinator — Copiloto V7 (Phase 2, preview)

A standalone backend service that gives the OpenAI side a safe runtime
against the Copiloto V7 Agent Gateway. It exists because the ChatGPT
conversation runtime cannot store a private key or inject the `x-agent-key`
header (verified 2026-11-27): the Coordinator is the server-side process that
holds the OpenAI-side gateway identity, talks to the OpenAI API, and exchanges
tasks, messages and events with Muse (Amani) through the gateway.

**Status (2026-11-27):** built and proven against synthetic mocks
(14/14 acceptance assertions, see `test/`). **Live end-to-end is NOT yet
demonstrated** — it is blocked on two secrets Miguel must still configure
(below). Do not claim bidirectional live communication until the live run
happens and is registered in Issue #87.

## Architecture

```
                ┌──────────────────────────┐
                │      OpenAI API          │
                │  (Responses API + tools) │
                └────────────▲─────────────┘
                             │ tool calls = gateway ops only
                ┌────────────┴─────────────┐        ┌────────────────────┐
                │   OpenAI Coordinator     │  HTTPS │   Agent Gateway    │
                │   (this service, Node)   ├───────►│ Supabase Edge Fn   │
                │  src/index.ts  poll loop │ x-agent│ CRM project        │
                │  src/openai.ts tool loop │  -key  │ mimgwleghecseoymgdug│
                │  src/gateway.ts client   │        └─────────┬──────────┘
                └──────────────────────────┘                  │ tasks / messages / events
                                                     ┌────────▼──────────┐
                                                     │  Muse (Amani)   │
                                                     │  own identity +   │
                                                     │  own connector    │
                                                     └───────────────────┘
```

Flow: the Coordinator polls its gateway inbox → each instruction runs through
the OpenAI Responses API with a bounded tool loop whose only tools are
gateway operations (`get_status`, `get_continuity`, `list_tasks`,
`create_task_for_claude`, `send_message`, `ack_message`, `append_event`,
`request_approval`) → outcomes are acknowledged and appended to the
persistent event store → responses to Coordinator-created tasks are detected
in continuity events and registered as checkpoints.

## Run it (preview)

Railway: create a service from this folder (`services/openai-coordinator`)
in the review project; build `npm install && npm run build`, start
`npm start`. Locally the same commands work. Configuration is env-only —
copy `.env.example` names into the service's secret store; never commit a
real `.env`.

## Secrets still to configure (both pending Miguel)

1. **OpenAI API key** — create in the OpenAI platform and deposit it through
   the Secure Vault card Amani already created (connector `custom.openai-api`);
   then set it as this service's `OPENAI_API_KEY` secret in Railway review.
2. **Coordinator gateway identity** — a NEW row in `agent_identities`
   (CRM Supabase) for the Coordinator with its own 256-bit key, the raw value
   stored in Supabase Vault (e.g. `copiloto_v7_coordinator_agent_key`) and
   deposited into this service's secret store as `COORDINATOR_GATEWAY_KEY`.
   Miguel performs the Vault retrieval/deposit. The Coordinator must NOT
   reuse the `chatgpt` key or Muse's key.

## Security properties

- Separate identity and least scopes: the Coordinator authenticates only as
  itself; the gateway resolves actor/scopes from its key hash and ignores
  caller-supplied identity. Event payloads containing identity fields are
  rejected by the gateway.
- Fail closed: missing/invalid config or a rejected key stops the process
  with a clear, value-free error.
- Idempotency: every write carries a fresh key matching the gateway's
  format; retries of one logical call reuse its key, so retries cannot
  duplicate records.
- Retry policy: network errors and HTTP 5xx only, exponential backoff;
  HTTP 4xx is never retried.
- Bounded model: the tool loop has a hard step cap; the model's only tools
  are gateway operations — it has no direct network, shell, SMS, WhatsApp or
  payment capability. Consequential actions go through `approval.request`
  for Miguel's decision.
- No secrets in the repo: config is env-only; logs print redacted summaries.

## Tests

```
npm test   # builds, then runs test/harness.ts against mock servers
```

The harness starts a mock Agent Gateway (a faithful in-memory mirror of the
deployed Edge Function contract) and a mock OpenAI Responses API on
localhost, runs the real compiled coordinator process, and asserts the eight
Phase-2 acceptance points: authentication, gateway communication, task
creation for Muse, Muse claim + response, response registration, ordered
event persistence, unauthorized rejection (401), and error/disconnect
logging with retry. Synthetic data only.

## Not implemented (do not claim)

- **Remote MCP face**: planned over the same `GatewayClient` so MCP clients
  can invoke the same operations later. It does not exist yet.
- Live E2E with the real gateway + real OpenAI key (pending the two secrets
  above, and Miguel's architecture decision in Issue #87).
- The pending Muse → ChatGPT message ACK from Phase 1 is a separate,
  still-open item; this service does not impersonate the `chatgpt` identity.
