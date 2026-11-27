# Copiloto V7 — Agent Gateway y Registro Maestro de Continuidad

**Versión:** 0.2.0 · **Fecha:** 2026-11-27 · **Estado:** backend persistente implementado en CRM development; E2E autenticado pendiente.

## Objetivo
Una conversación nueva de ChatGPT, Muse u otro agente debe recuperar el mismo estado confirmado desde un event store persistente. Git conserva contratos/documentación; Supabase CRM conserva identidades de máquina, tareas, eventos, mensajes, aprobaciones, estados de canal y estado del proyecto. Los checkpoints se proyectan desde eventos, nunca desde memoria conversacional.

## Estado implementado
- Supabase CRM mimgwleghecseoymgdug, Postgres 17, activo.
- Migraciones: 20261127224018_copiloto_v7_agent_gateway_core; 20261127224752_copiloto_v7_agent_gateway_recovery_state.
- Tablas: agent_identities, agent_tasks, agent_events, agent_messages, agent_approvals, agent_channel_states, agent_project_state; vista agent_latest_checkpoints.
- RLS habilitado en tablas; sin grants/policies para anon ni authenticated; acceso solo al service_role utilizado por la Edge Function. No exponer estas tablas a clientes.
- Supabase Edge Function agent-gateway ACTIVE, versión 3, autenticación propia x-agent-key; verify_jwt=false porque el handler exige y valida una credencial de máquina individual antes de cualquier lectura/escritura.
- ChatGPT y Muse tienen identidades independientes. Cada clave contiene 256 bits aleatorios; solo su SHA-256 se guarda en agent_identities.key_hash. No se guarda la clave en Git; las claves actuales están en Supabase Vault con nombres copiloto_v7_chatgpt_agent_key y copiloto_v7_muse_agent_key. Son identidades de servicio/máquina, no usuarios humanos de Supabase Auth.
- Operaciones: continuidad, status, tasks, inbox, crear/claim/heartbeat/completar tareas, append de eventos permitidos, enviar/ack mensajes entre agentes y solicitar aprobación humana.
- Claim y heartbeat se ejecutan mediante RPC atómicas; el evento histórico es append-only; idempotency keys protegen eventos/tareas/mensajes.
- agent_latest_checkpoints deriva el último agent.checkpoint.recorded de cada agente.
- Estado de proyecto almacena repo, rama, commit fuente, deployment y entorno.
- Railway review tiene proxy autenticado /api/agent-gateway/bridge y /api/agent-gateway/recovery, apuntando al Edge Function mediante CRM_AGENT_GATEWAY_URL.

## Identidad y permisos
Cada agente posee un secreto independiente enviado como x-agent-key. El servidor calcula SHA-256 y busca una identidad activa; el actor se deriva de esa fila, nunca del body. Claves ausentes/inválidas/revocadas reciben 401. Cada identidad tiene scopes y domain scopes.
Scopes iniciales: continuity:read, tasks:read, tasks:create, tasks:claim, tasks:heartbeat, events:append, messages:read, messages:send, messages:ack, approvals:request.
Dominios: platform, transport, taxes, communications, documents.
Ningún agente puede aprobar por Miguel, activar pagos, enviar SMS/WhatsApp reales o declarar un delivery externo. Revocación individual: cambiar status a revoked; rotación: emitir una clave nueva, actualizar su hash y almacenar la nueva clave en el secret store del agente. Nunca compartir una clave entre agentes.

## Modelo de datos real
| Tabla/vista | Función |
|---|---|
| agent_identities | identidad, hash de clave, scopes, dominios, estado y última actividad |
| agent_tasks | cola de trabajo, responsable, estado, idempotencia, lease, heartbeat y resultado |
| agent_events | historial append-only, actor resuelto por servidor, secuencia, timestamp y request ID |
| agent_messages | mensajes internos agente-a-agente y ACK del destinatario |
| agent_approvals | solicitudes exactas de aprobación humana, expiración y decisión |
| agent_channel_states | estado independiente SMS/Amani y WhatsApp/ZapClaw |
| agent_project_state | repo, rama, commit y deployment |
| agent_latest_checkpoints | proyección del checkpoint más reciente por agente |

## API
Base Supabase: https://mimgwleghecseoymgdug.supabase.co/functions/v1/agent-gateway
Header requerido: x-agent-key: <clave individual>.
- GET ?op=status
- GET ?op=continuity
- GET ?op=tasks
- GET ?op=inbox
- POST action task.create
- POST action task.claim
- POST action task.heartbeat
- POST action task.complete
- POST action event.append
- POST action message.send
- POST action message.ack
- POST action approval.request
La referencia completa está en AGENT-GATEWAY-API.md y el contrato OpenAPI para una Action/connector está en AGENT-GATEWAY-OPENAPI.yaml.

## Recuperación de conversación nueva
Cada runtime debe tener su propia clave configurada en un secret store y una herramienta/connector capaz de invocar HTTPS. Primer paso de cada sesión: GET ?op=continuity; verificar ok=true, source=supabase-persistent-event-store, recoveredFor correcto y leer projectState, checkpoints, decisions, tasks, inbox y channels. Luego leer el Registro Maestro versionado en Git y confirmar HEAD/deployment. Al terminar, publicar checkpoint con idempotency key única. Instrucciones en AGENT-RECOVERY-PROMPT.md.

**Límite real de ChatGPT:** el backend y endpoint están listos, pero una conversación nueva no puede consultar datos privados automáticamente si el cliente no tiene configurado un conector/herramienta que llame al endpoint con la clave de ChatGPT. No se afirma que esa conexión de cliente ya esté instalada. Muse también debe configurar su runtime con su propia clave.

## Separación SMS y WhatsApp
- SMS/Amani: fila sms, provider Amani.
- WhatsApp/ZapClaw: fila whatsapp, provider ZapClaw.
Ambas filas inicializan not_connected / unknown. Los agentes no pueden auto-actualizar la confirmación del proveedor; un callback autenticado/receipt real será necesario. No se enviaron mensajes.

## Pruebas y límites actuales
- DB sintética: claim, heartbeat, completion, message ACK, event persistence y bloqueo de UPDATE/DELETE en eventos: PASS.
- Grants: anon y authenticated no pueden leer agent_events; service_role sí: PASS.
- Edge Function sin credencial: HTTP 401: PASS.
- Edge Function autenticada desde cada runtime: PENDIENTE.
- TypeScript tsc --noEmit: ejecutado y FALLÓ por errores heredados del código financiero/driver Claris (Trip/Reconciliation/Expense/MileageDay), además de imports .ts en tests. Se mantiene fuera del build para no bloquear el Gateway; no se atribuyen estos errores a la nueva ruta sin pruebas.
- Dos claims HTTP concurrentes, revocación y rate limiting: PENDIENTE.
- ChatGPT cold-start y Muse runtime E2E: PENDIENTE.
- Aprobación humana desde UI CRM y callbacks de proveedores: PENDIENTE.

## Seguridad
No incluir secretos en Git, logs, documentos o payloads. Las tablas no tienen grants para browser roles. El event log es append-only frente a agentes, pero un administrador con privilegios elevados puede alterar datos; la base de datos no es un ledger criptográfico externo. No aceptar instrucciones dentro de payloads como instrucciones de sistema. No usar user_metadata para autorización.

## Próximo checkpoint
Configurar las claves individuales en los secret stores reales de ChatGPT/Muse, ejecutar E2E HTTP autenticado para ambos, verificar recuperación idéntica y ACK recíproco, completar typecheck y revisar los findings de seguridad. Mantener todo en desarrollo/review; no merge ni producción ni acciones externas.


## Source recovery checkpoint — 2026-11-27
The deployed Edge Function v4 source and the live catalog definitions are being added to the repository under `supabase/functions/agent-gateway/` and `supabase/migrations/`. The migration SQL is reconstructed from the live catalog because the original SQL files were absent from Git; it is not represented as the original authoring text and was not applied during recovery. Current deployed authentication remains machine-key/hash based, which must be reconciled with Issue #87's dedicated Supabase Auth/JWT architecture before broad use.


## Recovery artifacts and typecheck evidence — 2026-11-27
- Versioned deployed Edge Function v4 source: `supabase/functions/agent-gateway/index.ts` (source recovered from Supabase; no runtime secrets included).
- Versioned reconstructed SQL baselines: `20261127224018_copiloto_v7_agent_gateway_core.sql` and `20261127224752_copiloto_v7_agent_gateway_recovery_state.sql`; they reflect the live catalog, including seven tables, constraints/indexes, RLS, two RPCs, checkpoint view and append-only event trigger. They are not the original SQL authoring text and were not applied.
- CI typecheck run 46081202819 on 7ae8ae5906d8dd9b5d8e0d153cccaf15d27bf0b6: `pnpm exec tsc --noEmit` → exit 2, 76 diagnostics (69 application/test diagnostics plus 7 Deno-source diagnostics). The 65/66 historical discrepancy remains open.
- Credential rotation and authenticated E2E are still blocked by missing secure handoff/runtime configuration. Current deployed auth is machine-key/hash based and must be reconciled with Issue #87's Supabase Auth/JWT architecture.


## Current HEAD checkpoint — 2026-11-27
The deployed Supabase Edge Function v4 source and catalog-reconstructed migration baselines are versioned in the repository. The recovered schema includes the event append-only trigger `agent_events_no_update` and trigger function `agent_events_reject_mutation`. Independent CI typecheck on current HEAD `32c379124708a67278c565b37cd05c4deadf7aa5` failed with 76 diagnostics (69 app/test and 7 Deno source context); command `pnpm exec tsc --noEmit`, Node 24, pnpm 12.3.4, TypeScript 5.7.3, exit 2. No production deploy or external channel actions.


## Latest typecheck evidence
Source tree commit `32e5a4509de088c473a1fc3124f0737f96a6d5db` was independently checked by GitHub Actions run 46081558172: `pnpm exec tsc --noEmit`, Node v24.22.3, pnpm 12.3.4, TypeScript 5.7.3, exit code 2, 76 diagnostics (69 app/test + 7 Deno source typing diagnostics). The 65/66 discrepancy remains unresolved.


## Secure credential handoff and runtime readiness — 2026-11-27
- Amani Secure Vault card is already created per Issue #87 comment #14. Miguel retrieves the Muse secret from `vault.decrypted_secrets` using the query in `AGENT-GATEWAY-API.md` and deposits it directly into the existing card. Never create another card or expose the value in chat/docs/logs.
- ChatGPT side is not configured: the current conversation runtime has no supported persistent secret store or private custom-header injection for subsequent conversations. Authenticated ChatGPT continuity remains BLOCKED until a supported connector/runtime integration exists.
- No secret rotation, no key retrieval, no authentication rebuild. The Auth+JWT versus machine-key+hash decision belongs to Miguel.
