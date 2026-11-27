# Copiloto V7 — Agent Gateway y Registro Maestro de Continuidad

**Versión:** 0.1.0 · **Fecha:** 2026-11-27 · **Estado:** contrato propuesto + lector de continuidad en preview.

## Objetivo
ChatGPT, Muse/Amani y futuros agentes deben recuperar el mismo estado confirmado desde una conversación nueva, sin depender de memoria conversacional. Git conserva documentación versionada; el Gateway será la interfaz común para leer continuidad, coordinar tareas y registrar eventos.

## Estado real de esta entrega
- Implementado: contratos TypeScript, validación estricta, interfaz de almacenamiento, endpoint público de solo lectura para documentos ya públicos y endpoint de escritura que falla cerrado.
- CONTINUITY-REGISTER.json es una semilla versionada, no un event store dinámico.
- NO implementado: identidades individuales de agentes, persistencia de eventos, claim/lease/heartbeat, approvals, auditoría dinámica ni comunicación agente-a-agente.
- No hay migraciones ni DDL. La base CRM inspeccionada no contiene tablas de agentes.
- SMS/Amani y WhatsApp/ZapClaw siguen separados y sin conexión E2E verificada.

## Fuentes de verdad
1. Código, commits y pruebas actuales.
2. Registro persistente de eventos (cuando se apruebe e implemente).
3. CONTINUITY-REGISTER.json: snapshot derivado, nunca autoridad por encima de eventos.
4. CURRENT-STATE.md, AGENT-HANDOFF.md, DECISION-LOG.md, FOCUS-AND-EXECUTION-BASELINE.md.
5. Issues: seguimiento, no fuente única.
6. Memoria conversacional: pista auxiliar, nunca evidencia.

## Orden de recuperación obligatorio
1. Leer docs/copiloto-v7-master/README.md.
2. Leer FOCUS, CURRENT-STATE, DECISION-LOG y este contrato.
3. Consultar GET /api/agent-gateway/continuity.
4. Confirmar rama, HEAD, commit desplegado y entorno.
5. Consultar tareas/eventos/checkpoints persistentes cuando el store esté habilitado.
6. Leer por separado SMS/Amani y WhatsApp/ZapClaw.
7. Determinar la siguiente acción autorizada; sin aprobación explícita, solo lectura, análisis o preparación.
8. Al terminar, registrar resultado, evidencia, commit, pruebas, bloqueos y próximo paso. El checkpoint futuro se deriva de eventos persistidos, no del texto de chat.

## Identidad individual
Cada agente tendrá un usuario Supabase Auth dedicado, no compartido con Miguel ni con otro agente.
- Asociar agente/estado/scopes mediante app_metadata administrada por un proceso confiable.
- Nunca usar user_metadata para autorización.
- Verificar JWT en servidor. No confiar en agent_id, actor_id, user_id, scopes o timestamps enviados por cliente.
- El servidor deriva actor y hora del token verificado y del reloj servidor.
- No usar service_role como identidad de agente ni entregar JWT legacy secret.
- Tokens de corta duración, revocación, rate limits y registro de sesión.
- Hasta crear y probar identidades dedicadas, las llamadas de agentes quedan deshabilitadas.

## Scopes mínimos propuestos
continuity:read, tasks:read, tasks:claim, tasks:heartbeat, events:append, approvals:request.
Transport, Taxes, Communications y Documents tienen scopes separados. Ningún scope permite aprobar en nombre de Miguel, enviar comunicaciones, aceptar trabajos, cobrar, reembolsar o leer expedientes sin permiso explícito.

## Modelo de datos consolidado propuesto — NO APLICADO

| Entidad | Propósito | Reglas |
|---|---|---|
| agent_identities | Mapa Auth user ↔ agente | identidad única, estado, scopes; sin secretos |
| agent_tasks | Cola compartida | dominio, asignación, estado, prioridad, idempotency key, lease, intentos |
| agent_task_events | Registro append-only | actor autenticado, tarea, tipo, payload validado, timestamp servidor, request ID, idempotency key |
| agent_approvals | Aprobación humana | actor humano, acción/payload/destino exactos, expiración y decisión |
| agent_channel_states | Estado de proveedores | una fila por canal/proveedor; SMS y WhatsApp independientes |

Los checkpoints se derivan de los últimos eventos válidos agent.checkpoint.recorded por agente; no se mantienen como una segunda fuente mutable. El JSON se regenera desde eventos y decisiones confirmadas.

### Estados y cola
Tareas: pending → claimed → in_progress → completed|failed, además blocked, cancelled, awaiting_approval. Claim atómico, lease con vencimiento, heartbeat solo por dueño del lease, reintentos limitados y dead-letter/blocked. Idempotencia obligatoria.

### Eventos
task.created, task.claimed, task.heartbeat, task.progress, task.blocked, task.completed, task.failed, approval.requested, approval.granted, approval.denied, agent.checkpoint.recorded, channel.status.changed, deployment.observed, test.completed.
Agentes agregan eventos permitidos; no editan ni borran los previos. Correcciones son nuevos eventos que referencian el anterior. Append-only protege frente a agentes, no frente a administradores privilegiados; documentar el límite y evaluar anclaje externo.

## Separación SMS y WhatsApp
- **SMS/Amani:** puente/teléfono, cola, claim, dispatch, callback, confirmación auténtica, fallos y último evento.
- **WhatsApp/ZapClaw:** cuenta Business, API/webhook, consentimiento, envío, callback proveedor, confirmación, fallos y último evento.
- El estado de un canal nunca cambia el otro. queued no es sent; sent no es delivered sin recibo verificable.
- No enviar mensajes reales durante esta fase.

## Aprobación y seguridad
Aprobación humana ligada a acción, contenido, destinatario, canal, expiración y actor. Si cambia el contenido, la aprobación queda invalidada. Kill switch global/por canal; límites de coste, tiempo, concurrencia y frecuencia. Logs sin secretos, tokens, datos fiscales ni documentos.

## API y estado
| Método | Ruta | Estado |
|---|---|---|
| GET | /api/agent-gateway/continuity | Implementado: documentos versionados públicos, solo lectura |
| GET | /api/agent-gateway/status | Pendiente |
| GET | /api/agent-gateway/tasks | Pendiente de identidad + store |
| POST | /api/agent-gateway/tasks/claim | Pendiente de identidad + store |
| POST | /api/agent-gateway/tasks/:id/heartbeat | Pendiente de identidad + store |
| POST | /api/agent-gateway/events | 503 hasta aprobar e implementar store |
| POST | /api/agent-gateway/approvals | Pendiente; aprobación siempre humana |

## Pruebas de aceptación
1. ChatGPT y Muse recuperan idéntico commit, decisiones, pendientes y próximo paso desde sesión nueva.
2. Agente no lee fuera de sus scopes/dominio.
3. Token ausente/inválido/expirado/revocado → rechazo.
4. Agente no suplanta actor ni fija user_id/timestamp.
5. Dos claims simultáneos → exactamente un lease.
6. Heartbeat de otro agente → rechazo.
7. Idempotency key duplicada → un efecto.
8. Eventos previos no editables/borrables por agentes.
9. SMS y WhatsApp mantienen estados independientes.
10. Acción sensible sin aprobación exacta → bloqueada.
11. Kill switch bloquea ejecución.
12. Recuperación nueva coincide con event log.

## Próximo paso autorizado
Revisar y aprobar/corregir este modelo consolidado. Después preparar migración nueva solo en entorno de desarrollo aislado, identidades dedicadas y pruebas sintéticas. No aplicar DDL ni desplegar producción antes de aprobación y gates de seguridad.
