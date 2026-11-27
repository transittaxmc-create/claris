# Copiloto V7 — Agent Coordination Architecture

**Date:** 2026-11-27  
**Owner decision:** Preserve SMS phone dispatch with strengthened authentication.  
**Authorized scope:** Architecture design and continuity documentation only. No implementation, migration, credential changes, production changes, customer messages or deployment.

## 1. Executive decision

Copiloto V7 remains the single operational CRM and coordination center. Muse/Amani, ChatGPT and Gemini participate through a narrowly scoped Agent Gateway in the existing Claris application. The dedicated CRM Supabase project remains the only CRM database. GitHub is for source code and non-sensitive technical documentation, not customer data or private task context.

The design must not introduce another CRM, another database, Twilio, another phone number, or a second WhatsApp provider. ZapClaw remains the intended WhatsApp channel. The legacy Finance Supabase remains separate from the CRM.

## 2. Evidence and unresolved version divergence

Muse/Amani's read-only audit supplied on 2026-11-27 reports:
- Production `GET /api/version` = `f06c125`, built 2026-11-27 10:10 UTC.
- GitHub `main` = `51cb521`, with no confirmed Vercel deployment.
- Production reportedly has a phone-dispatch callback; main disables `POST /api/crm/send/dispatch` with HTTP 501.

Independent source inspection performed while recording this design fetched:
- `app/api/crm/send/dispatch/route.ts`: the current `main` source returns `501 phone_dispatch_not_connected`.
- `app/api/crm/send/route.ts`: authenticates the CRM session, validates and queues the draft; it does not send an SMS.
- `lib/crm/supabase-server.ts`: uses the dedicated CRM publishable key and the authenticated user's cookie session; no CRM service-role key is used.
- `lib/crm/push-auth.ts` and `lib/crm/push-validation.ts`: push owner authentication and trusted push endpoint validation are present in the inspected source.

The live Production endpoint was not independently queried during this documentation update. Therefore `f06c125` behavior remains based on the supplied audit until a fresh live version check and a synthetic-only verification are performed. Do not assume Production and GitHub main are equivalent. Do not merge or deploy HEAD until the dispatch discrepancy is resolved.

## 3. Goals and non-goals

### Goals
1. One task ledger and shared, task-scoped context inside Copiloto.
2. Separate identities, scopes, credentials, audit records and revocation for each agent.
3. Keep owner-scoped RLS as the database authorization boundary.
4. Let ChatGPT submit/read/complete only authorized tasks through an authenticated API.
5. Let Amani orchestrate work and call Gemini using the existing connector, recording Gemini's result against the same task.
6. Preserve the paired-phone SMS dispatch workflow while making its callback trustworthy and auditable.
7. Keep Transport and Tax permissions isolated.
8. Preserve chat-to-chat continuity in versioned project documentation.

### Non-goals
- No autonomous customer messaging, payments, refunds, exports or production deployments.
- No direct unrestricted CRM access for any model.
- No storing customer documents, tax IDs, full message bodies or secrets in GitHub.
- No migration or implementation during this design phase.
- No direct Gemini-to-CRM access in the first release.

## 4. Target architecture

```text
                    Miguel (owner / final approver)
                                |
                         Copiloto V7 UI
                                |
                  Agent Gateway — Claris API
                   /          |           \
          Muse/Amani       ChatGPT        Gemini
          orchestrator    GPT Action     via Amani
              |               |              |
              +---------------+--------------+
                              |
                  Task API + policy checks
                              |
              CRM Supabase (existing project)
              agent_memberships / agent_tasks
              agent_task_events / RLS policies
                              |
          +-------------------+-------------------+
          |                   |                   |
     CRM Transport       CRM Tax scope      Private files
     (separate grant)    (separate grant)   owner-scoped only

   SMS lane (separate permission boundary):
   Copiloto approved outbox -> Amani on paired Android
       -> phone send attempt -> authenticated dispatch callback
       -> append-only dispatch event -> CRM message status

   WhatsApp lane (separate provider boundary):
   ZapClaw <-> future signed webhook bridge <-> Copiloto
   (not present in inspected repository; pending provider test)
```

All external agents call the Gateway, never Supabase tables directly. The Gateway exposes business operations, not arbitrary database queries.

## 5. Agent identities and authentication

Each agent has an independent identity:
- `muse_amani`: task orchestration, task claim/progress, approved SMS phone-bridge callback only when separately authorized.
- `chatgpt`: task creation, scoped context read, progress/result submission; no phone dispatch, customer CRUD, payment or deployment permission.
- `gemini`: initially invoked by Amani only; no direct Gateway credential in the first release.

The preferred database authorization model is a dedicated Supabase Auth identity for each machine agent, represented in an owner-managed `agent_memberships` record. Trusted authorization claims, if used, must come from server-managed `app_metadata` or a Custom Access Token Hook. Never use user-editable `user_metadata` for authorization.

The external ChatGPT Action credential and the Supabase machine identity are different credentials. The Gateway validates the external credential, maps it to one agent identity and uses only that agent's short-lived Supabase Auth context for database operations. RLS must remain enabled and effective. No CRM `service_role` key may be introduced.

**Credential feasibility gate:** before implementation, prove how each machine identity is provisioned, how its short-lived access token is refreshed, where refresh credentials are stored, and how they are rotated/revoked. If the only workable option requires a broad service-role key, direct database superuser credential, or bypassing RLS, stop and return for a new design decision. Do not create a SECURITY DEFINER shortcut to evade this gate.

For a single-owner private GPT, a per-agent Bearer API key on the GPT Action may be evaluated. OAuth is preferred if the GPT will be shared, used by multiple users, or needs user-specific authorization. Keys must be stored only in the relevant secure credential settings, never in the OpenAPI schema, repository, task payloads or chat transcripts. Revoke/rotate each agent independently.

## 6. Agent Gateway API contract (proposed)

The final OpenAPI document and payload schemas are a later approval item. Proposed operations:

| Method and route | Purpose | Allowed actors |
|---|---|---|
| GET `/api/agents/v1/capabilities` | List the caller's permitted operations and schema version | All authenticated agents |
| POST `/api/agents/v1/tasks` | Submit a task with a minimal, redacted context | Miguel, Muse/Amani, ChatGPT |
| GET `/api/agents/v1/tasks` | List tasks visible to the caller, filtered by state/assignment | Owner, assigned agent |
| GET `/api/agents/v1/tasks/:id` | Read task and explicitly granted context | Owner, assigned agent |
| POST `/api/agents/v1/tasks/:id/claim` | Atomically claim a queued task with a lease | Assigned agent |
| POST `/api/agents/v1/tasks/:id/events` | Append progress, evidence, blocker or handoff | Owner, assigned agent |
| POST `/api/agents/v1/tasks/:id/complete` | Submit result and proposed next step | Assigned agent |
| POST `/api/agents/v1/tasks/:id/approve` | Approve an owner-controlled action | Miguel only |

No endpoint may expose generic SQL, unrestricted CRM search, unrestricted file download, credentials, arbitrary HTTP proxying, raw customer exports, or unrestricted customer CRUD.

Every write requires schema validation, maximum body size, scope check, owner derivation from authenticated identity (never from caller-supplied `owner_id`), idempotency, audit event and rate limit.

## 7. Proposed CRM data model

All tables are proposed for the existing CRM Supabase project only. No migration has been created or applied.

### `agent_memberships`
- `id` UUID primary key
- `owner_id` UUID, CRM owner
- `agent_user_id` UUID, dedicated Supabase Auth identity
- `agent_code` constrained to registered agent names
- `scopes` constrained list of allowed operations/domains
- `active` boolean
- `created_at`, `revoked_at`

### `agent_tasks`
- `id` UUID primary key
- `owner_id` UUID
- `created_by_agent` registered identity or owner
- `assigned_to_agent` nullable registered identity
- `task_type`, `title`, `priority`
- `status`: queued, claimed, in_progress, blocked, completed, failed, cancelled
- `domain_scope`: transport, tax, or explicitly approved shared task
- `context_refs`: references to permitted CRM records, not copied full records
- `context_summary`: minimal redacted text
- `result_summary`: redacted outcome
- `idempotency_key`
- `lease_until`, `created_at`, `updated_at`, `completed_at`

### `agent_task_events`
- `id` UUID primary key
- `task_id`, `owner_id`, `actor_agent`
- `event_type`: created, claimed, heartbeat, progress, blocked, result, approved, rejected, failed, cancelled
- `payload_redacted` JSONB with a strict allowlist
- `created_at`

Events are append-only. Updates/deletes are denied to agents. Indexes should cover owner/status/created_at, assigned_to/status and task_id/created_at. Retention, constraints and grants require review before migration.

## 8. RLS and permission rules

1. Enable RLS on every exposed table.
2. Owner identity comes from the verified JWT subject, not request JSON.
3. Owner can see and manage their own tasks and memberships.
4. An agent can see only tasks assigned to its machine identity and only within its granted domain/scope.
5. An agent may append events to tasks it is assigned; it cannot change owner, assignment, scope, approval state or membership.
6. Only Miguel can approve customer-facing actions or grant/revoke scopes.
7. Transport and Tax are distinct grants. A Transport agent must not read Tax records and vice versa.
8. Use `app_metadata` or a trusted membership lookup for authorization. Never trust `user_metadata`.
9. Do not expose service-role or secret keys to browser code.
10. Review grants as well as RLS policies; RLS does not remove broad SQL grants by itself.

## 9. Task lifecycle and coordination semantics

Lifecycle: `queued -> claimed -> in_progress -> blocked | completed | failed | cancelled`.

- Claim is atomic and creates a short lease.
- The agent renews its lease with heartbeat events.
- A second agent cannot claim a live lease.
- An expired lease becomes eligible for re-claim or owner review; no task is silently lost.
- Each event has an idempotency key to prevent duplicate writes.
- Results include evidence references, uncertainty, blockers and a recommended next action.
- Amani may delegate a sub-question to Gemini and attach Gemini's answer to the same task as a separately attributed event.
- ChatGPT sees only the context returned for that task; it does not inherit Amani's private memory or device permissions.
- Copiloto UI shows task owner, assigned agent, current status, last activity, blockers and approval state.

## 10. SMS dispatch — preserve with stronger authentication

Keep the owner-session route `POST /api/crm/send` as the approval/queue operation. It does not contact the carrier and does not prove a send occurred.

The phone-bridge callback `POST /api/crm/send/dispatch` may be re-enabled only after all of the following are designed, implemented and tested:
- Dedicated credential for the paired, authorized Amani/phone bridge, distinct from the user session and task API key.
- Request authentication using HMAC over HTTP method, canonical path, body hash, timestamp and unique nonce; constant-time signature comparison.
- Tight timestamp tolerance, nonce/replay storage, per-device rate limit and credential revocation.
- Strict body schema and maximum size.
- Server-side lookup of the CRM message and owner; never trust caller-supplied owner ID, destination or message text.
- Idempotency key per dispatch attempt.
- Explicit legal state transitions and append-only dispatch event.
- Device identity and actor recorded for every callback.
- Kill switch that stops dispatch while preserving queued records.

State semantics:
- `queued`: approved and waiting for the phone bridge.
- `sending`: phone bridge has claimed/started the attempt.
- `sent`: phone OS accepted the SMS send operation. This is not carrier delivery confirmation.
- `failed`: phone bridge reports a failed attempt with a sanitized reason.
- No `delivered` state unless a future provider supplies a verified delivery receipt.

A browser CRM session alone must never be sufficient to mark a message sent. A callback retry must not create a second SMS. Opt-out/STOP and consent checks must be verified as hard pre-send gates before any real send is enabled. All tests use synthetic numbers and a test-only device.

## 11. ChatGPT and Gemini integration

### ChatGPT
- Start with a private Custom GPT Action calling the Agent Gateway.
- Give it a narrow scope: create tasks, read assigned task context, append progress, submit results.
- Use Bearer API key for a private single-owner proof of concept only if key rotation/revocation and audit identity are in place; use OAuth for multi-user or personalized access.
- Do not expose CRM data via public GitHub or an unauthenticated endpoint.
- The Action must not be allowed to approve messages, send SMS/WhatsApp, modify customer records, access Tax without an explicit scope, or deploy code.

### Gemini
- Keep the existing Amani-to-Gemini connector in the first release.
- Amani sends only task-scoped, redacted context.
- Store the question, model identifier, result summary and source attribution as task events.
- Gemini has no direct CRM, GitHub, device or document-store credential in this phase.
- Consider a direct Gemini Gateway identity only after the common auth and RLS model is proven.

## 12. ZapClaw, push and phone boundaries

- ZapClaw remains the WhatsApp provider. The inspected repo has no ZapClaw webhook/API integration. Do not claim WhatsApp messages are automatically synchronized with Copiloto until a signed provider webhook, inbound message verification, idempotency and opt-out handling are implemented and tested.
- The pending ZapClaw send test remains a separate provider-access task. Do not send a real customer message as part of architecture verification.
- The audit reports push subscription storage in a suspended Vercel Blob. Evaluate moving subscription records to the CRM Supabase with owner-scoped RLS and encrypted sensitive endpoint/key material. This is a separate workstream and not a prerequisite for the task API design.
- The paired Android remains the SMS device bridge only if its actual permission, background execution, callback protocol and credential storage are verified. iOS is not assumed to provide SMS inbox access.

## 13. Security, privacy and operational controls

- No real customer data in development or testing. Use synthetic CRM users, clients, reservations, messages and phone numbers.
- No real SMS, WhatsApp, email, push broadcast, payment or bank operation in testing.
- Separate dev/preview/production credentials; never reuse production tokens in preview.
- Encrypt secrets at rest in a supported secret store; never log Authorization headers, HMAC secrets, refresh tokens or full message content.
- Keep audit events tamper-resistant and owner-scoped.
- Add per-agent rate limits, payload limits, timeout budgets and emergency revocation.
- Keep a global agent kill switch and a separate SMS dispatch kill switch.
- Keep Transport and Tax isolated by scope and RLS.
- Maintain document storage as private central storage; devices are capture/consultation clients, not the master copy.
- Security review includes cross-owner IDOR tests, token theft/replay, expired/revoked identity, scope escalation, prompt injection through task context, malicious attachment references, duplicate task claims, duplicate dispatch callbacks and log redaction.

## 14. Delivery phases and approval gates

| Phase | Deliverable | Gate |
|---|---|---|
| 0 — Reconcile evidence | Verify live `/api/version`, main SHA, Vercel deployment, and exact production/main dispatch behavior | Read-only; no deploy |
| 1 — Auth proof | Demonstrate separate machine identities, token refresh/rotation/revocation and RLS using synthetic users; no service_role | Miguel approves identity model |
| 2 — Contract | Final API/OpenAPI schemas, task state machine, RLS matrix, data retention and threat model | Miguel approves schema and contract |
| 3 — Build in isolation | Implement Gateway, task ledger, UI and agent adapters on a non-production branch | Separate implementation approval |
| 4 — Synthetic verification | Negative security tests and full preview E2E with synthetic records and test-only phone bridge | Miguel approves test report |
| 5 — SMS callback restoration | Re-enable hardened dispatch only after replay, idempotency, ownership and STOP/consent tests pass | Separate explicit SMS approval |
| 6 — Production | Deploy exact approved commit, verify READY and live behavior, update manual | Separate explicit deployment approval |

No phase automatically authorizes the next.

## 15. Acceptance criteria

The architecture is ready for implementation review only when:
- Every agent has an independently revocable identity and minimal scopes.
- No service-role key or broad database credential is required.
- RLS tests prove cross-owner and cross-domain access is denied.
- Task claim/lease and idempotency prevent duplicate work.
- All task and dispatch state changes are attributable and auditable.
- ChatGPT can access only the task context granted to it.
- Gemini participates through Amani with attributed results.
- No agent can approve or send customer-facing communications on Miguel's behalf.
- SMS callback authentication rejects forged, expired, replayed, duplicate and cross-owner requests.
- The UI clearly distinguishes queued, phone-send accepted, failed and provider-delivered (only if actually supported).
- Preview tests use synthetic data only; no production deployment or real customer message occurs without separate approval.

## 16. Current continuity checkpoint

**Approved by Miguel (2026-11-27):** preserve SMS phone dispatch with strengthened authentication; design the complete agent coordination architecture; no deployment; maintain all security controls and continuity documentation.

**Verified in repository source during this turn:** main's dispatch route returns 501; the queue route does not send SMS; CRM server client uses authenticated session + publishable key; no service-role key is used in that client.

**Based on supplied Muse/Amani audit, not independently re-verified live here:** Production is at `f06c125`; its dispatch callback still records phone dispatch results; GitHub main was reported at `51cb521`; Vercel rate limiting blocked deployment of later main changes.

**Not done:** no source implementation, migration, secret/credential change, Vercel configuration change, live SMS/WhatsApp/push test or production deployment.

**Next step:** reconcile Production and main against a fresh live version check, then ask Muse/Amani for the exact phone callback protocol and credential custody. Present the final identity/RLS/token-refresh proof and exact endpoint/schema contract to Miguel before any implementation.

## 17. References

- Supabase Auth custom access token hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase JWT concepts: https://supabase.com/docs/guides/auth/jwts
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- OpenAI GPT Action authentication: https://developers.openai.com/api/docs/actions/authentication
- Repository: https://github.com/transittaxmc-create/claris
- Procedures manual: `components/copiloto/how-it-works-screen.tsx`, §24
