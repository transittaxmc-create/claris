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
