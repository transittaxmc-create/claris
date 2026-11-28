# Copiloto V7 — carpeta maestra

**Fuente de continuidad del proyecto.** Leer este índice antes de modificar código, base de datos, integraciones o despliegues.

- [Plan maestro y alcance](./MASTER-PLAN.md)
- [Estado técnico verificado](./CURRENT-STATE.md)
- [Instrucciones para el siguiente agente](./AGENT-HANDOFF.md)
- [Registro de decisiones y requisitos del usuario](./DECISION-LOG.md)
- [Agent Gateway y Registro Maestro de Continuidad](./AGENT-GATEWAY.md)
- [API y credenciales de agentes](./AGENT-GATEWAY-API.md)
- [OpenAPI para configurar ChatGPT Actions](./AGENT-GATEWAY-OPENAPI.yaml)
- [Protocolo de recuperación en conversación nueva](./AGENT-RECOVERY-PROMPT.md)
- [Snapshot versionado del Registro Maestro](./CONTINUITY-REGISTER.json)

## Regla de prioridad documental
1. Esta carpeta contiene la visión integrada, estado consolidado y orden de trabajo.
2. components/copiloto/how-it-works-screen.tsx contiene el manual operativo dentro de Copiloto; actualizarlo en cada hito.
3. Los informes docs/copiloto-v7-punto-*.md contienen evidencia detallada de cada etapa.
4. El código, migraciones y resultados actuales de herramientas son la autoridad para afirmar qué está implementado. La documentación no convierte un plan en una integración activa.

## Identificadores de proyecto
- Repo: transittaxmc-create/claris
- Rama: feat/copiloto-v7-phase1-foundation
- Proyecto CRM Supabase: mimgwleghecseoymgdug
- Supabase financiero legado (NO tocar): zrcnpmipdhpjdjkfrrgt
- Railway preview: copiloto-v7-temporal / entorno review / servicio copiloto-v7-preview
- Preview: https://copiloto-v7-preview-review.up.railway.app

**Última consolidación:** 2026-11-27. No merge a main, no despliegue productivo ni uso con clientes reales autorizado.


## Documento prioritario de enfoque (27-11-2026)
- **Leer primero:** [FOCUS-AND-EXECUTION-BASELINE.md](./FOCUS-AND-EXECUTION-BASELINE.md). Consolida visión, decisiones, límites, estado real, por qué se repite trabajo, orden obligatorio y próxima acción exacta.
- No abrir un frente nuevo ni repetir auditorías ya completadas sin evidencia nueva. Trabajar una vertical funcional a la vez.


## Estado de continuidad — cierre E2E ChatGPT↔Muse (2026-11-27)
- La Verificación #22 del Issue #87 confirma comunicación bidireccional en vivo por API operada por Amani: identidad `chatgpt` autenticada (HTTP 200), dos mensajes de Muse recibidos y ACK (HTTP 200), respuesta enviada (HTTP 201), y recepción/ACK de vuelta por Muse.
- La app de ChatGPT no presenta por sí sola la credencial privada; la atribución probada es `chatgpt (via amani)`. No confundir esto con el OpenAI Coordinator, cuyo E2E propio sigue pendiente.
- La documentación anterior que marque el ACK o la comunicación ChatGPT↔Muse como pendiente queda supersedida por Issue #87, Verificación #22.
- Fase 1 sigue IN PROGRESS: la conciliación documental está en curso; el typecheck permanece FAILED (76 diagnósticos en run 46081558172) y la relación entre `main` y la rama feature está divergente (170 ahead / 1 behind; no merge autorizado).
