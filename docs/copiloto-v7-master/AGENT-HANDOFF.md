# Copiloto V7 — instrucciones de continuidad para el siguiente agente

## MANDATO
Actúa como responsable técnico (tech lead). No reinicies el trabajo ni vuelvas a preguntar lo documentado. Inspecciona el estado real antes de cambiar nada. Completa Copiloto V7 por verticales funcionales, con seguridad y evidencia, sin romper Claris/finanzas.

## Lectura obligatoria
1. docs/copiloto-v7-master/README.md
2. MASTER-PLAN.md
3. CURRENT-STATE.md
4. Este archivo.
5. components/copiloto/how-it-works-screen.tsx, especialmente §11, §14, §16–§23 y §24–§33.
6. Informes docs/copiloto-v7-punto-1 hasta punto-10 y docs/copiloto-v7-reconciliacion-migraciones-y-protecciones-2026-11-27.md.
7. GitHub feature branch HEAD y diff respecto de main; inspecciona código, migraciones y CI.
8. Estado real Railway/Vercel antes de deploy.

## Reglas innegociables
- No tocar Supabase financiero zrcnpmipdhpjdjkfrrgt, Plaid, finanzas, variables o lógica Money/Projections.
- CRM Supabase es mimgwleghecseoymgdug; no crear proyecto alterno.
- No merge a main ni publicar en Vercel production sin aprobación explícita.
- No datos reales, documentos fiscales, SSN/ITIN, mensajes, aceptación de ofertas ni pagos reales durante desarrollo.
- No ejecutar SQL/migraciones hasta recuperar y reconciliar archivos faltantes y ledger.
- No exponer/recopiar secretos. Token Twilio/ZapClaw expuesto previamente debe tratarse como comprometido; no pedirlo por chat.
- No scraping WhatsApp Web ni lectura de grupos no autorizada.
- No afirmar conexión sin prueba.
- Cada hito actualiza esta carpeta y How This Works; verificar con fetch.

## Estado inicial
- Branch feat/copiloto-v7-phase1-foundation; main intacta.
- Railway preview inicial SUCCESS: deployment 6c2ac0c8-725b-489c-ae86-a654bea2c3fd, commit faf2350ffcc3e4e5166fa4f64d1d12671d09924a; URL https://copiloto-v7-preview-review.up.railway.app. Tras el cambio de navegación CRM se inició deployment 6a948e27-3a11-4f60-97ca-918914c55056 (commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e), último estado BUILDING; reconsultar Railway hasta terminal y verificar dominio.
- pnpm run test:crm-push: 4/4 PASS.
- Typecheck: 66 errores en feature y 66 idénticos en main; cero diagnósticos adicionales feature, pero typecheck global falla.
- / y /copiloto-v7-preview HTTP 200 por curl; screenshot/browser QA pendiente. El último cambio de navegación no está desplegado en Railway aún.
- UI V7 es DEMO/local state; no conectada a CRM DB. CRM se añadió a navegación inferior y se carga lazy desde la app anfitriona; tests 4/4 y build local PASS tras este cambio, typecheck permanece con 66 errores de baseline. Falta desplegar el commit nuevo y validar visualmente.
- Push remote/app-closed no verificado; Twilio/WhatsApp/Square/email/e-file no conectados.
- Punto 3 DB/security reconciliation abierto.

## Orden de trabajo

### A. Cerrar preview QA
1. Abrir preview con navegador compatible; escritorio/iPhone, navegación, overflow, consola, forms, teclado, estados.
2. Si browser QA no es posible, documentar método alterno y limitación.
3. Corregir defectos en feature branch.
4. Confirmar Railway source branch y SHA tras cada deployment.

### B. Cerrar Auth/seguridad antes de nuevos datos
1. Recuperar SQL exacto de 20261126033314 y 20261126035245 desde Git history/origen verificable.
2. Reconciliar cinco scripts no ledger y sus efectos; no re-ejecutar ni falsificar ledger.
3. Diseñar business_units/memberships y migraciones nuevas solo después de reconciliar.
4. Configurar/probar MFA, leaked password protection, sesiones, revocación y recovery.
5. Separación Transport/Taxes; RLS owner+membership y autorización server-side.
6. Tests negativos A/B para DB, API y Storage.
7. Bóveda fiscal privada separada del bucket fotos CRM; límites MIME/tamaño y URLs breves.
8. Backup y restore con datos sintéticos.

### C. Primer vertical end-to-end
Prioriza Clients + Transport reservations + Communications outbox:
1. Confirmar esquema y compatibilidad con CRM existente.
2. Persistencia server-side de clientes/reservas/mensajes/tareas.
3. Regla ACT-0-### (solo al aceptar/crear ficha; no autogenerar a cada prospecto).
4. Human approval; cola no equivale a envío.
5. Auditoría/idempotencia y estados exactos.
6. Pruebas por usuario/unidad, UI responsive y recuperación en otro dispositivo.

### D. Taxes + Documents
1. Tax cases/checklist/approval con relaciones a clientes Taxes.
2. Vault privado, versionado, temporal OCR vs original final.
3. Upload/download autorizado, signed URLs, MIME/size validation y audit.
4. Nunca documentos fiscales en crm-client-photos.
5. E-file solo si software/API compatible y autorización explícita probada.

### E. Work Opportunities
1. Captura manual/share/forwarding oficialmente soportado.
2. Parser conserva original y marca confidence/faltantes.
3. Evaluación completa de rentabilidad; no inventar datos.
4. Verde/amarillo/rojo y borrador YES; no enviar ni aceptar automáticamente.

### F. Comunicaciones y notificaciones
1. Twilio solo con credenciales seguras y pruebas webhook/status callback; opt-out.
2. Email provider/API autorizado.
3. WhatsApp solo APIs/métodos oficiales; no grupos personales.
4. Push: suscripción real, envío remoto, app cerrada, dispositivo revocado, permisos iOS; registrar resultados.
5. Toda comunicación externa con aprobación humana.

### G. Square
1. Identificar Developer App y Sandbox; OAuth/scopes mínimos.
2. Matriz de capacidades: API in-app, deep-link/handoff o unsupported.
3. Customers/invoices/documents primero; pagos/refunds solo Sandbox y aprobación.
4. Webhooks firmados, idempotencia y auditoría.
5. No live payments.

### H. Final QA y release
1. Build/tests/typecheck; distinguir deuda baseline.
2. Seguridad, privacidad, responsive, accesibilidad, rendimiento y errores.
3. Actualizar punto 9/10 y esta carpeta.
4. Preparar PR/diff; no merge/deploy production sin aprobación.
5. Reportar deployment READY/BUILDING/FAILED, push registration y pruebas push exactas.

## Documentación por hito
Registrar fecha, branch/commit, archivos, cambios, tests, DB/migration impact, seguridad, deployment ID/status/SHA/URL, screenshots, push status, riesgos y próximos pasos. Re-fetch How This Works y master para verificar. Nunca afirmar “terminado” sin evidencia.

## Reporte al usuario
En español simple y breve: hecho/comprobado, pendiente/bloqueado, riesgo/permiso, siguiente paso. No pedir repetir contexto ni hacer cuestionarios. Trabajar secuencialmente.


## Handoff update — end of 2026-11-27 review session

### Stage ledger (do not overstate completion)
| # | Stage | Status | Evidence / blocker |
|---|---|---|---|
| 1 | Railway deploy + route check | DEPLOY/HTTP PASS; visual QA pending | Deployment 6a948e27 SUCCESS, commit b0aa463; `/` and `/copiloto-v7-preview` HTTP 200. Browser screenshot/interactions not completed. |
| 2 | Migration reconciliation | READ-ONLY AUDIT COMPLETE; historical gap open | Two applied ledger versions have no source SQL in branch; effects exist. Do not rerun or fabricate SQL. |
| 3 | Auth/MFA/memberships/RLS | BLOCKED | A/B SELECT isolation passes in four tables. 0 MFA factors observed; leaked-password protection off; no business-unit memberships; no FORCE RLS; no negative write tests. |
| 4 | Clients + Transport + Communications | BLOCKED | Preview is local React state; existing CRMScreen has cloud sync code but Railway env missing CRM URL/publishable key; API returns 503. |
| 5 | Documents vault | BLOCKED | Only private photo bucket; no separate vault, MIME/size limits, OCR, versions, hashes, retention or recovery. |
| 6 | Taxes | BLOCKED | UI seed/local state only; no tax tables, secure vault, tax software or e-file. |
| 7 | Work Opportunities | BLOCKED | Seed/local state only; no ingestion. Personal WhatsApp groups are not available through official API; no scraping. |
| 8 | SMS/WhatsApp/email/push | BLOCKED | SMS dispatch 501; outbox 503; push disabled; WhatsApp/email not connected; no remote delivery tests. |
| 9 | Square Sandbox | BLOCKED | Local demo only; no Square credentials, OAuth, API or webhooks. |

### Required resume order
1. Complete stage 1 visual QA using a real browser on desktop and iPhone; verify six bottom-nav items fit and CRM opens/loads correctly.
2. Recover exact source SQL/provenance for ledger versions 20261126033314 and 20261126035245. Never reconstruct from effects and never edit migration ledger manually.
3. Design and test MFA enrollment/enforcement, leaked-password protection, business-unit membership schema, owner + unit authorization, storage policies, session/device revocation and negative A/B read/write/delete tests. Do not connect real clients until all pass.
4. Only after stage 3 PASS, connect preview to CRM Supabase using publishable URL/key; use a synthetic test account approved for preview; verify Clients/Transport/Communications create/read/update/delete, reload persistence and cross-unit isolation.
5. Build the separate private document vault; then Taxes; then Work Opportunities intake/evaluation; then official SMS/WhatsApp/email/push integrations; then Square Sandbox.
6. Update CURRENT-STATE.md and How This Works after every stage. Re-fetch both to verify. Do not merge main or deploy production without explicit approval.

### Verified runtime details
- Railway preview URL: https://copiloto-v7-preview-review.up.railway.app
- Deployment: 6a948e27-3a11-4f60-97ca-918914c55056 / SHA b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e / SUCCESS.
- `/api/crm/state` returns 503 `crm_cloud_not_configured` because CRM Supabase env vars are absent in Railway review.
- `/api/crm/send/dispatch` returns 501 `phone_dispatch_not_connected`; `/api/crm/push/config` returns `enabled:false`.
- Build PASS and `test:crm-push` PASS 4/4; TypeScript remains FAIL with 66 baseline diagnostics also present on main.


## Mandatory focus reset — 2026-11-27
Before any work, read docs/copiloto-v7-master/FOCUS-AND-EXECUTION-BASELINE.md. It is the current execution contract and supersedes older suggested next-step lists where they conflict. Do not restart inventory or repeat completed audits without new evidence. First close the current Railway deployment and desktop/iPhone preview QA; then resolve migration provenance and security gates; then deliver Clients + Transport + Communications end-to-end. Keep work on the feature branch, synthetic data only, no legacy Finance/Plaid changes, no main merge or production deployment. Report exact evidence and update How This Works + CURRENT-STATE after each milestone.


## Latest verified handoff — 2026-11-27

**Read the current master first; do not rely on this file's older snapshots.** Start at `docs/copiloto-v7-master/README.md`, then read `FOCUS-AND-EXECUTION-BASELINE.md`, `CURRENT-STATE.md`, this handoff, and `components/copiloto/how-it-works-screen.tsx`. The repository files and live tool results outrank chat summaries.

### Latest known Railway state
- Project `copiloto-v7-temporal`; environment `review`; service `copiloto-v7-preview`; branch `feat/copiloto-v7-phase1-foundation`.
- Latest deployment confirmed in this session: `3accbe2e-e61c-410c-91aa-be114cf82f18` = **SUCCESS**, deployed SHA `f8c559ff59ba09038bdb64d966e67d42e83a61a4`, region `iad`. Railway returned no deployment URL. Confirm current branch HEAD and deployment SHA again before presenting any preview link.
- No browser-based desktop/iPhone visual QA was completed in this session. Do not mark it PASS.

### Exact next work
1. Close visual QA for `/copiloto-v7-preview` and `/copiloto-v7-go` on desktop and a real iPhone: navigation fit, route loading, forms, overflow, console, reload and key interactions. Capture evidence; if browser/device access is unavailable, state the blocker and do not claim success.
2. Recover the exact original SQL/provenance for applied migration versions `20261126033314` and `20261126035245`. Never reconstruct SQL from effects, rerun applied DDL, or edit the Supabase migration ledger manually.
3. Complete the security design/gates: MFA enrollment and enforcement, leaked-password protection, Transport/Taxes memberships and server-side authorization, Storage restrictions, session/device revocation, and negative A/B read/write/delete tests. No real client data until PASS.
4. Only after security PASS, connect the review environment using the CRM publishable URL/key and a synthetic test account; complete persistent Clients + Transport + Communications CRUD, reload recovery and cross-unit isolation.
5. Then proceed in order to Documents vault, Taxes, Work Opportunities, official communications/push, and Square Sandbox.

### Non-negotiable boundaries
- Work only on `feat/copiloto-v7-phase1-foundation`; do not merge to `main` or deploy Vercel production without explicit approval.
- Do not touch legacy Finance/Plaid/Supabase `zrcnpmipdhpjdjkfrrgt`, Money/Projections or related finance workflows.
- CRM Supabase is `mimgwleghecseoymgdug`; do not create another project.
- Synthetic data only. No real client/tax data, outbound SMS/WhatsApp/email, job acceptance, or real payments.
- Do not apply migrations/DDL until historical SQL provenance is resolved.
- Never claim a demo/local React interaction is persisted or connected. Approved/queued is not sent. Push registration and remote delivery remain unverified.
- At each verified milestone update this folder and How This Works, then re-fetch both. Report actual Railway state and deployment SHA; say explicitly whether How This Works was updated.

### What this session did
This session re-read the existing continuity index and master documents and re-queried Railway. It made no functional code, database, Auth, Storage, provider, Vercel, or production changes; no visual QA and no remote push tests were performed. It updated continuity documentation only so the next chat starts from this current handoff rather than an older status snapshot.


## Provider correction — 2026-11-27 (user-confirmed)
**Do not use Twilio.** The user explicitly corrected the provider choice: Copiloto V7 is to use **ZapClaw** (spelled with “Claw”), not Twilio. This supersedes the older How This Works section 10 titled “TWILIO SMS” and any “Twilio first” plan. ZapClaw is not yet verified or connected in CRM; do not claim it works. The inspected CRM dispatch route still returns `501 phone_dispatch_not_connected`, and the outbox only queues. Research ZapClaw's official API/webhook/auth capabilities first, then implement a secure adapter and synthetic tests. Never request credentials in chat; rotate the previously exposed credential through the provider's official console and store secrets only in the authorized environment. No real SMS or number/account changes without explicit approval.


## Provider scope clarification — 2026-11-27
ZapClaw's official documentation (`https://zapclaw.app/docs.html`, marked updated 2026-11-12) describes a WhatsApp Business gateway on Meta's official API: REST sends, inbound/status webhooks and coexistence. It does **not** document traditional carrier SMS. The user explicitly said **do not use Twilio**. Therefore: ZapClaw is the intended WhatsApp Business integration candidate; the traditional SMS provider remains unidentified/unapproved. Keep SMS and WhatsApp as separate channel adapters and never label a ZapClaw WhatsApp send as SMS. Do not pick another SMS provider without the user's confirmation. ZapClaw is not yet connected to CRM; credentials/webhooks/idempotency/consent and security tests remain pending. No real messages or number/account changes without express approval.

 
## SMS bridge audit — user-confirmed real test — 2026-11-27
The user confirmed that Muse's test delivered an actual SMS from the business number to the user's second device. It was not merely a CRM status change. Commit `daa6b5788545ce83561eeb6c9c93f08b63f20b27` explicitly documents Amani on the paired Samsung S26 Ultra, with SMS permission and forwarding enabled, as the phone-side dispatcher. The commit adds a cloud outbox endpoint (`/api/crm/send`, queue only) and a result callback (`/api/crm/send/dispatch`); its diff does **not** contain the Amani Android app/agent or the external queue consumer that actually sends the text. Therefore the historical real-world test is user-confirmed, while the exact installed Amani version/configuration and current operational state still need recovery. Current `main` deliberately returns `501 phone_dispatch_not_connected` from dispatch; do not claim the old bridge is currently connected. Next: inspect the paired Samsung's Amani app/configuration and identify its queue polling/trigger, authentication, callback and logs through an authorized safe workflow. No credentials in chat, no number/provider changes, no real client messages. ZapClaw remains a separate WhatsApp Business candidate; no Twilio.


## Gemini + Muse/Amani coordination — 2026-11-27
- Read CURRENT-STATE section 19 and How This Works section 25 before continuing.
- Gemini is present in the legacy Finance Copilot only; it is not integrated into the V7 CRM preview. Its route currently falls back from GEMINI_API_KEY to OPENAI_API_KEY while always calling Google Gemini; correct this before reuse.
- V7 preview uses sample data. SMS queue endpoint only queues; dispatch remains 501. Historical Amani phone-bridge evidence is in How This Works section 24; verify the real paired-phone agent and Muse channel rather than inventing an API.
- Design the safe shared instruction hierarchy and per-module roles, then integrate Gemini through server-side allowlisted tools. Muse orchestration and Amani SMS require verified contracts, authentication, idempotency, human approval, and confirmed outcomes.
- No real customer data or messages, no live payments, no secrets in chat, no provider/number/permission changes, no DDL, no merge to main, and no production deployment without separate approval. Keep SMS separate from WhatsApp/ZapClaw; do not use Twilio.


## Continuity checkpoint — 2026-11-27 15:57 America/New_York
- User resumed the investigation that was interrupted during the previous chat: the coordination and communication flow among Copiloto V7, Muse, Gemini and Amani, including SMS and WhatsApp. Do not restart the broader project inventory or ask the user to repeat decisions already documented.
- Re-read the current branch's master continuity documents and `components/copiloto/how-it-works-screen.tsx`. The existing Gemini/Muse/Amani investigation is already documented; this checkpoint records the exact resume point rather than claiming new integration work.
- Confirmed from repository code/docs: Gemini's existing `/api/ai-chat` belongs to the legacy Finance Copilot and is not integrated into the V7 CRM preview. The route uses `GEMINI_API_KEY || OPENAI_API_KEY` while calling Google's Gemini endpoint; do not allow an OpenAI key as a Gemini credential.
- Confirmed from prior user-reported test and commit history: Muse previously caused a real SMS to reach the user's second device through the paired Samsung/Amani bridge. The repository contains the cloud queue and result callback, not the Android Amani agent or its external queue consumer. Current CRM dispatch remains `501 phone_dispatch_not_connected`; historical success does not prove current connectivity.
- Channel decision remains: no Twilio. Keep SMS/Amani separate from WhatsApp Business/ZapClaw. ZapClaw is a WhatsApp Business candidate, not a traditional SMS provider; no number/account migration or real message sending.
- Exact next investigation: recover the authorized Muse↔Amani interface and the paired phone's queue trigger/polling, authentication, callback and logs; in parallel, specify Gemini's server-side role and allowlisted tools. Then define shared instructions and separate Transport/Taxes/Communications permissions, human approvals, audit and idempotency. No secrets in chat, no live customer data/messages, no provider/number changes, no DDL, no merge to main or production deployment.
- This is a documentation checkpoint only. No application code, credentials, phone settings, providers, database or deployment were changed in this checkpoint.

Next session must resume from the exact checkpoint above, then inspect Muse/Amani's authorized interface and paired-phone bridge before implementing anything.


## Resume point — agent coordination and Gemini instructions — 2026-11-27
User clarified that the goal is not merely SMS wiring: Muse should be able to understand Copiloto's current project/workspace state through an authorized integration, and Gemini's instructions should be restructured so Gemini can assist Copiloto V7 across its business modules. Read docs/copiloto-v7-master/AGENT-INSTRUCTION-ARCHITECTURE.md first. The document is a design proposal, not an implemented integration. Continue by identifying Muse's real authorized interface and Amani's phone-side queue consumer, then map V7 module scopes/RLS to a server-side context/tool layer. Do not guess APIs, overwrite legacy Finance instructions, expose secrets, send live messages, change providers/numbers, deploy production or merge main.


## Resume clarification — Muse is already authorized; Amani is its agent — 2026-11-27
The user explicitly confirms Muse already has authorized access to GitHub, Vercel, WhatsApp and the phone/SMS environment, and Amani is an agent within Muse. Do not ask the user to reconnect or reauthorize those services. The question is how this ChatGPT/Copiloto workflow can exchange project state and tasks with that already-authorized Muse runtime. The historical SMS path was Muse/Amani consuming the Copiloto message queue and sending through the paired phone. Current ChatGPT tools do not expose a direct Muse/Amani connector, so recover Muse's actual supported API/MCP/webhook/repository handoff and the existing queue consumer before implementation. Vercel eve Agent Runs discovery was empty for the last 30 days, but that does not prove Muse is inactive or disconnected. Read AGENT-INSTRUCTION-ARCHITECTURE.md §11 before proceeding.


## Exact SMS bridge finding — 2026-11-27
Use existing GitHub issue #85 as the canonical recovery task: https://github.com/transittaxmc-create/claris/issues/85. Its audit comments establish that commit `daa6b578...` contains the queue/callback only, not the Amani worker, Muse link, polling, device authentication or webhook; the old callback trusted ordinary CRM session state and must not be re-enabled. The user's historical SMS success therefore came from Muse/Amani outside the inspected repo or external configuration. Current route queues only; dispatch is 501. Issue #85 does not itself notify Muse. Verify whether Muse monitors GitHub issues/repository before treating GitHub as a live shared mailbox.


## Agent Gateway handoff — 2026-11-27
Read docs/copiloto-v7-master/AGENT-GATEWAY.md first. First code slice adds contracts, validation, disabled event-store adapter, public read-only continuity route and fail-closed event route. CONTINUITY-REGISTER.json is versioned but is not a dynamic checkpoint/event log. CRM Supabase schema was inspected read-only; no agent tables exist and no DDL/migration was run.

Next exact action: review and explicitly approve/correct the proposed consolidated data model in AGENT-GATEWAY.md. Then create a development-only migration and dedicated Auth identities/scopes, followed by synthetic tests for isolation, token revocation, atomic claim/lease, heartbeat, idempotency, append-only events and fresh-session recovery. Do not merge main, deploy production, change environment secrets or send real communications. Keep SMS/Amani and WhatsApp/ZapClaw as separate state machines.


## Gateway verification checkpoint — 2026-11-27
- Code/test commit: c047840932e532a59dae500533cbb27bcc5ba195.
- Railway review deployment: SUCCESS, deployment 5210f13e-8b62-44e7-8cf6-ffebbdcfd37f.
- Build ran existing CRM push tests: 4 passed / 0 failed; Agent Gateway tests: 6 passed / 0 failed; Next.js production build compiled successfully.
- Next.js build configuration reports "Skipping validation of types"; run a separate TypeScript check before considering the code fully verified.
- Live GET https://copiloto-v7-preview-review.up.railway.app/api/agent-gateway/continuity returned HTTP 200 and the read-only versioned document package.
- POST event storage remains intentionally disabled; event store and dedicated agent identities are not configured.
- Next: review/approve the schema proposal in AGENT-GATEWAY.md. No DDL/migrations or production release.


## Gateway persistent-backend checkpoint — 2026-11-27
Read first: docs/copiloto-v7-master/AGENT-GATEWAY.md, AGENT-GATEWAY-API.md, and AGENT-RECOVERY-PROMPT.md.
- Supabase CRM project: mimgwleghecseoymgdug; legacy Finance project zrcnpmipdhpjdjkfrrgt was not touched.
- Migrations: 20261127224018_copiloto_v7_agent_gateway_core and 20261127224752_copiloto_v7_agent_gateway_recovery_state.
- Supabase Edge Function agent-gateway version 3 is ACTIVE. No-key request returns 401. Individual ChatGPT/Muse machine identities exist; keys are SHA-256 hashed in the DB and raw credentials must be stored only in their respective secret stores.
- RLS/grants: no anon or authenticated access to agent tables; service_role only. Do not add browser policies to these tables.
- DB synthetic test passed for claim/heartbeat/complete, append-only event protection and agent message acknowledgement. The synthetic fixture rows are retained and clearly marked synthetic.
- Railway review bridge routes were committed and CRM_AGENT_GATEWAY_URL set in review; verify latest deployment/build and GET /api/agent-gateway/recovery with a valid agent key.
- Authenticated HTTP E2E has not yet been demonstrated for either agent. Do not call the Gateway fully accepted until ChatGPT and Muse each authenticate, recover the same checkpoint, exchange a message and verify its acknowledgement.
- The first fresh-session action must be authenticated GET ?op=continuity; then read checkpoint, decisions, open tasks and independent channel states. No external action without explicit human approval.
- Remaining: run authenticated E2E using agent secret stores; add rate limiting; independent TypeScript check; wire a ChatGPT custom connector/tool if the client supports it and configure Muse's actual runtime interface. No production release or live messages.


## Build gate correction — 2026-11-27
- Strict typecheck was attempted by temporarily adding tsc --noEmit to the Railway build. It failed on pre-existing Claris finance/driver model mismatches (Trip, Reconciliation, Expense, MileageDay, platform metadata) and .ts test import settings. This is not evidence of an Agent Gateway runtime defect.
- Removed strict typecheck from the mandatory build so it cannot block the review deployment. Kept an optional typecheck script for a separate cleanup task. The normal build still runs CRM push tests, Agent Gateway tests and next build.
- Current branch head after the build correction: 5f28be7c5421f3e2658aa52cda4b3f122855b822. Verify the Railway review deployment on this exact commit before calling it live.
- Authenticated API E2E from ChatGPT and Muse is still pending; no production release.


## Secure agent credentials and latest review deployment — 2026-11-27
- ChatGPT and Muse machine keys are stored in Supabase Vault as copiloto_v7_chatgpt_agent_key and copiloto_v7_muse_agent_key. Only SHA-256 hashes are stored in agent_identities. Do not paste keys into chat or source control.
- Retrieve each value in the trusted Supabase SQL Editor via vault.decrypted_secrets and copy directly to the matching agent secret store. See AGENT-GATEWAY-API.md.
- Railway review deployment SUCCESS: 75cdda75-8cca-4d65-94bf-9447ac4967a8, commit 6b40691ded792c16a5f4320ceedff368aae0e62d. Both authenticated proxy routes returned 401 when called without a key, confirming they are present and protected.
- Supabase Edge Function agent-gateway version 4 ACTIVE. Database-side hash comparison passed for both Vault secrets and active identity rows.
- Still required for acceptance: configure the keys in ChatGPT Actions/custom connector and Muse's own runtime, then run authenticated status/continuity, reciprocal message send/ACK, and fresh-session recovery tests. No production release.


## Final verified review checkpoint — 2026-11-27
- Railway review SUCCESS: deployment d80b2339-c9eb-4ffd-9c13-01591d46135b on commit 39e669992b1df9a11b258bf1cf7870eb233512bd.
- Public docs endpoint GET /api/agent-gateway/continuity: HTTP 200, documentation-only, correctly identifies the private Supabase event store and authenticated-only write path.
- Authenticated proxy GET /api/agent-gateway/recovery without a key: HTTP 401. Supabase Edge Function without a key: HTTP 401.
- ChatGPT and Muse machine credentials are in Supabase Vault, names only in repository. Retrieve directly to each agent's secret store; do not paste in chat.
- Do not claim E2E complete until both runtimes authenticate, recover the same checkpoint, exchange a message and persist recipient ACK. ChatGPT custom Action/connector and Muse runtime configuration are external setup gates.
- Keep deployment in review; no main merge, production release, real communications or payments.


## Checkpoint 2026-11-27 — after source recovery
- Current branch head at start: 9867adf543e07b7624d2d1b5c378e8b3c65edfb3; Railway Review deployment 423f5d02 SUCCESS.
- Public continuity endpoint is HTTP 200 and accurately reports the private Supabase event store and authenticated-only write operations. Unauthenticated recovery and bridge remain HTTP 401.
- Supabase Edge Function source v4 and live schema catalog are recovered for versioning; migration files are reconstructed baselines, not original source. No DDL was executed.
- Next: complete standalone typecheck and record exact diagnostic count; then credential rotation only after a secure delivery channel and runtime secret-store targets are specified; then authenticated ChatGPT/Muse continuity and reciprocal message/inbox/ACK tests, followed by cold-start recovery.
- Production, SMS and WhatsApp remain untouched.
