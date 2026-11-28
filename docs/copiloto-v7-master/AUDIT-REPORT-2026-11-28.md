# Auditoría maestra de continuidad — Copiloto V7
**Corte:** 2026-11-28 (EST)  
**Repositorio:** `transittaxmc-create/claris`  
**Rama revisada:** `feat/copiloto-v7-phase1-foundation`  
**HEAD verificado:** `8c9dfb20b0e0f6e643524d4050fecbe90c716a9a`  
**Estado:** auditoría documental y técnica; no es certificación de producto terminado.

## 1. Para qué existe este informe
Miguel pidió que el equipo deje de reconstruir el proyecto conversación por conversación. Este informe consolida los requisitos, decisiones, evidencia, pendientes y contradicciones detectadas. No sustituye el historial: START-HERE sigue siendo la única puerta de entrada; Issue #87 conserva el historial y los checkpoints; #85 es el carril SMS; #86 es el carril WhatsApp.

## 2. Alcance de la revisión y límites
Se revisaron los registros de conversación y resúmenes recuperables en este espacio de trabajo; Issue #87 y sus 40 comentarios disponibles; los cuerpos y comentarios disponibles de Issues #85 y #86; START-HERE.md, CURRENT-STATE.md, AGENT-HANDOFF.md, AGENT-GATEWAY.md, AGENT-GATEWAY-API.md, OPENAI-COORDINATOR.md y el manual How This Works; la rama GitHub y su comparación con main; y el proyecto, servicio, deployment y logs de Railway.
**Límite:** esto cubre las fuentes recuperables y enlazadas al proyecto. No afirmo haber inspeccionado conversaciones privadas que no estén disponibles en este contexto ni registros externos no conectados. Si existe un chat histórico no enlazado, debe incorporarse al Registro Maestro antes de considerarlo reconciliado.

## 3. Decisiones firmes de Miguel — no volver a preguntar ni reabrir
1. Proyecto: **Copiloto V7**, dentro del repositorio/app original `transittaxmc-create/claris`. No crear una segunda aplicación permanente.
2. Producción: Vercel/main permanecen protegidos. No merge, reset, rebase destructivo ni despliegue productivo sin autorización específica.
3. Railway es el entorno temporal de trabajo/revisión para que Miguel pueda ver avances, probar visualmente, opinar y aprobar antes de transferirlos a la aplicación original. No es un destino de producción.
4. Supabase CRM correcto: `mimgwleghecseoymgdug`. La base financiera antigua `zrcnpmipdhpjdjkfrrgt` es independiente y no se toca.
5. No usar Twilio. No cambiar, migrar ni desconectar números/cuentas de WhatsApp. No exponer secretos en chats, código, issues o documentación.
6. Canales confirmados y separados:
   - SMS/Amani → Transport (clientes/pasajeros).
   - WhatsApp Business, número 934-208-1400 → Transport.
   - WhatsApp personal, número 934-200-8109 → Taxes y grupos de Work Opportunities (ofertas de trabajo).
   - Los grupos no se extraen mediante scraping no oficial ni se automatizan respuestas YES. La alternativa documentada para investigar es reenvío/compartido manual a Copiloto.
7. No mezclar Transport y Taxes. Mantener bandejas por canal y clasificación por área. Aprobación humana de Miguel antes de cualquier comunicación saliente; ningún mensaje a Mr. Shah ni a clientes sin autorización expresa.
8. **Alcance definitivo de Fase 1:** plataforma Copiloto y Centro de Comunicaciones preparado, probado con datos sintéticos. La activación de proveedores, recepción/envío real de SMS/WhatsApp, webhooks y recibos de entrega reales queda para fase posterior con aprobación específica. La coordinación ChatGPT↔Muse no equivale a mensajería de clientes.
9. Integrar incrementalmente en la app original. No reemplazar wholesale `CopilotoApp` ni romper TODAY, EARNINGS, MONEY, REPORTS o MORE.
10. Design System V1.0: Inter; fondo #050505; tarjetas #191919; ámbar #FFB900; verde #00C76A; cyan #08B9ED; rojo #E64B55. Logos existentes exactos, sin redibujar/recolorear/sustituir.

## 4. Aclaración pendiente: “CMS”
En conversaciones del 27-nov Miguel usó “CMS” junto a WhatsApp. En los registros técnicos canónicos la iniciativa se llama CRM Copiloto V7 y Communications Center. No hay una definición inequívoca de “CMS” que confirme si significa el CRM, un Content Management System u otro módulo. **No se debe inventar una equivalencia.** Hasta que Miguel lo precise, el alcance técnico verificable es CRM + Centro de Comunicaciones + carriles de WhatsApp descritos arriba.

## 5. Equipo y responsabilidades registradas
| Integrante | Responsabilidad / estado |
|---|---|
| Miguel | Product owner. Decide alcance, prioridades y aprobaciones de riesgo, migraciones, secretos, canales reales y producción. No debe seguir siendo mensajero entre agentes. |
| ChatGPT | Construcción/revisión del CRM visual y código asignado; lectura de continuidad antes de actuar; informar evidencia real y dejar handoff. |
| Muse/Amani | Coordinación operativa, continuidad/Gateway, verificación independiente de commits, estado de servicios y checkpoints; SMS pertenece a este carril, sujeto a recuperar contrato real. |
| DeepSeek | Segunda revisión de código/lógica vía Amani; conectado y probado según el registro del 27-nov. |
| OpenAI Coordinator | Servicio backend construido en la rama; pruebas sintéticas 14/14. Su E2E vivo sigue pendiente de identidad/credenciales propias y configuración segura en Railway. No confundir con el E2E ChatGPT↔Muse. |
| Claude/Anthropic | Solo diseño; no tratar como integración activa. |
| Gemini | Integración/API vía Amani documentada; no confundir con el `/api/ai-chat` legado del Copilot financiero ni asumir que ya está integrado al CRM V7. |

## 6. Estado real por área
Estados: VERIFIED = evidencia específica; PREVIEW = interfaz/prototipo, no sistema operativo; BLOCKED/PENDING = falta prueba o dependencia.

| Área | Estado | Evidencia / faltante |
|---|---|---|
| Continuidad ChatGPT↔Muse por Amani API | VERIFIED (alcance de #87 Verificación #22) | status 200; recepción y ACK de dos mensajes; respuesta 201; recepción/ACK de Muse 200. No repetir setup. |
| Agent Gateway en Supabase CRM | PARCIALMENTE IMPLEMENTADO | Siete tablas, Edge Function y contratos versionados; pruebas sintéticas de DB/RLS y rechazo anónimo 401 documentadas. No confundir con autorización final de arquitectura. |
| Arquitectura de identidad Gateway | DECISIÓN ABIERTA | La arquitectura aprobada en el checkpoint #87 fue Supabase Auth + JWT. El código desplegado/documentado usa clave de máquina + hash SHA-256 (`x-agent-key`). Miguel debe resolver si acepta esa desviación solo para review o exige migrar a Auth+JWT antes de ampliar uso. No asumir que quedó aprobada. |
| OpenAI Coordinator | BUILT / SYNTHETIC PASS / LIVE E2E PENDING | Build independiente y 14/14 assertions contra mocks. Falta identidad propia `coordinator`, clave correcta y `OPENAI_API_KEY` en runtime. MCP remoto está planeado, no implementado. |
| CRM Design Preview | PREVIEW IMPLEMENTED IN BRANCH | Ruta `/copiloto-v7-crm-design`; Overview, Clients, Transport, Taxes, Documents y Communications; canales SMS/WhatsApp separados; filtros Transport/Taxes; borrador editable, aprobación simulada, estado simulado e historial sintético. Estado local, sin backend ni persistencia. |
| CRM Preview build / Railway | FAILED EN ÚLTIMO COMMIT | Ver sección 7. El último SUCCESS sirve un commit anterior, no el diseño nuevo. |
| Visual QA desktop/iPhone | NOT DONE | No existe evidencia de browser QA completa ni screenshots aceptados. |
| Integración CRM visual en app original | NOT STARTED | Debe hacerse incrementalmente después de revisión/aprobación. |
| CRM cloud existente | PARCIAL | CRMScreen anterior usa Supabase session/RLS; no equivale al CRM V7 multiárea completo. Railway review carece de variables CRM documentadas; `/api/crm/state` devolvía 503 en la auditoría registrada. |
| Transport / Taxes / Work Opportunities / Square | PREVIEW | Interfaces y datos sintéticos/locales; no CRUD persistente ni integraciones completas. |
| Documents / OCR / Tax vault | NOT IMPLEMENTED | No bóveda fiscal completa, versionado/hash/retención/restore ni OCR/e-file verificados. |
| Seguridad Transport/Taxes | NOT READY FOR REAL CLIENTS | RLS owner-only probado para SELECT en cuatro tablas, pero no hay memberships/unidades de negocio, MFA enforcement demostrado, AAL2 ni tests completos de escritura/aislamiento. Leaked-password protection estaba deshabilitada en la auditoría. |
| SMS/Amani clientes | BLOCKED | `/api/crm/send` solo encola; `/api/crm/send/dispatch` devuelve 501 `phone_dispatch_not_connected`. Contrato real Muse/Amani (polling, auth, payload, ACK, retry) sigue sin recuperarse. Callback viejo no reactivar. |
| WhatsApp Business/ZapClaw | NOT VERIFIED / NOT CONNECTED | No E2E actual, no webhook/entrada/salida verificados. No migrar ni cambiar número/cuenta. |
| WhatsApp personal + grupos | NOT IMPLEMENTED | Se conoce el uso para Taxes y grupos de trabajos; no hay ingestión automática oficial de grupos demostrada. No scraping ni automatización de respuestas. |
| Push | PARTIAL / REMOTE PENDING | Rutas existen; entrega remota con app cerrada no verificada. |
| Email / Square / tax software | NOT CONNECTED | Sandbox, APIs y flujos reales pendientes. |
| TypeScript global | HISTORICAL FAIL | Último registro independiente: 76 diagnósticos (69 app/tests + 7 Deno). No afirmar PASS. La nueva falla de build actual ocurre antes, por sintaxis JSX. |

## 7. Railway — comprobación actual del 2026-11-28
- Proyecto: `copiloto-v7-temporal`; entorno: `review`; servicio: `copiloto-v7-preview`.
- Dominio: https://copiloto-v7-preview-review.up.railway.app
- La conexión de fuente del servicio fue ajustada a `transittaxmc-create/claris` y rama `feat/copiloto-v7-phase1-foundation`.
- HEAD de rama verificado: `8c9dfb20b0e0f6e643524d4050fecbe90c716a9a`.
- Último deployment: `4c7355c4-25fc-4016-bc8c-bbda200d2df3`, commit `8c9dfb20`, **FAILED**.
- Último deployment SUCCESS aún activo: `423f5d02-3547-47f0-8557-f4e64829df52`, commit `9867adf543e07b7624d2d1b5c378e8b3c65edfb3`. Ese deployment no incluye el CRM Design Preview nuevo. No afirmar que la ruta nueva está visible.
- Error exacto de build: `components/copiloto/how-it-works-screen.tsx:2287:7`, “Expected corresponding JSX closing tag for <Section>”. La sección 44 no está cerrada antes de abrir la sección 45. El error afecta la compilación de la app completa porque How It Works está importado por CopilotoApp.
- En el mismo log, las pruebas sintéticas del Gateway dieron 6/6 PASS y otras pruebas existentes dieron 4/4 PASS; esto no compensa el build general FAILED.
- No se hizo deployment a Vercel ni a producción. No se cambió Supabase en esta auditoría.

## 8. Divergencia Git y documentación
- Comparación actual GitHub: `main` @ `6540fc96a2e5acc1f26be8ba7e869bf3f5d6a2b5` vs feature HEAD @ `8c9dfb20b0e0f6e643524d4050fecbe90c716a9a`: **diverged, feature 195 ahead / 1 behind**, merge-base `51cb5217cdb9b938678428b51ea64bc8e1300408`.
- No merge/rebase/reset. Requiere plan de reconciliación que preserve cambios de ambos lados y aprobación.
- START-HERE estaba desactualizado: seguía indicando HEAD `8117caf` y CI QUEUED; no registraba el deployment fallido del commit `8c9dfb20`. CURRENT-STATE también contiene checkpoints históricos que no deben presentarse como estado de hoy.
- How This Works no se debe marcar como actualizado/validado mientras conserve el error JSX señalado. Este informe no repara ni altera ese archivo.

## 9. Círculos y contradicciones que quedan resueltos como regla
1. **“Terminar SMS/WhatsApp ahora” vs Fase 1 aprobada:** Fase 1 entrega diseño y centro preparado con datos sintéticos; operación real va a fase posterior. El diseño visual sí debe mostrar los canales separados y el flujo de aprobación.
2. **Gateway E2E vs mensajes a clientes:** la Verificación #22 cierra ChatGPT↔Muse; no cierra SMS, WhatsApp ni Communications Center.
3. **Coordinator vs ChatGPT↔Muse:** son servicios/pruebas distintos. Coordinator 14/14 mock no es E2E live.
4. **Railway SUCCESS vs versión actual:** SUCCESS del commit 9867adf es versión anterior. El commit 8c9dfb20 falló. No reutilizar el estado SUCCESS como prueba del CRM nuevo.
5. **Preview vs integración:** UI con useState/datos seed no equivale a módulo conectado, persistente o seguro.
6. **CMS vs CRM:** el término CMS queda sin resolver hasta que Miguel defina el significado. No generar otra línea de trabajo basándose en una suposición.
7. **Registro maestro vs conversaciones:** manda el estado documentado y la evidencia más reciente; no reiniciar inventarios ya cerrados.

## 10. Orden de ejecución recomendado — sin volver a empezar
1. Reparar el cierre JSX de How This Works de forma mínima y revisar el índice/estructura del manual; no cambiar contenido ni diseño fuera de lo necesario.
2. Re-ejecutar Railway build en la misma rama y confirmar SUCCESS para HEAD actual. Luego comprobar HTTP de la ruta `/copiloto-v7-crm-design`.
3. Hacer QA visual desktop/iPhone y probar navegación, bandejas SMS/WhatsApp, filtros, borrador, aprobación simulada e historial.
4. Registrar el resultado exacto en START-HERE y Issue #87 en el mismo paso.
5. Presentar a Miguel el preview para revisión y cambios. No integrar en la app original hasta aprobación.
6. Después de aprobar: integración incremental del CRM en la app original, preservando módulos actuales; pruebas de regresión y seguridad.
7. Tratar Gateway/Coordinator, SMS y WhatsApp en tareas separadas según sus compuertas. No repetir Verificación #22 ni el inventario ya completado.

## 11. Reglas de handoff para todos los agentes
Antes de actuar: leer START-HERE, Issue #87 y la issue del canal correspondiente; verificar HEAD y deployment actuales.  
Al terminar: registrar objetivo, archivos, commit, pruebas con comandos/resultados, Railway deployment/URL, estado real, decisiones, bloqueos, responsable y próximo paso. Actualizar START-HERE en el mismo paso.  
Prohibido: “terminado” sin evidencia; repetir pruebas cerradas; confundir simulación con entrega real; cambiar producción, números, cuentas, secretos, DB o proveedores sin aprobación.

## 12. Fuentes canónicas
- [Issue #87 — maestro y continuidad](https://github.com/transittaxmc-create/claris/issues/87)
- [Issue #85 — SMS/Amani](https://github.com/transittaxmc-create/claris/issues/85)
- [Issue #86 — WhatsApp](https://github.com/transittaxmc-create/claris/issues/86)
- [START-HERE](https://github.com/transittaxmc-create/claris/blob/feat/copiloto-v7-phase1-foundation/docs/copiloto-v7-master/START-HERE.md)
- [CURRENT-STATE](https://github.com/transittaxmc-create/claris/blob/feat/copiloto-v7-phase1-foundation/docs/copiloto-v7-master/CURRENT-STATE.md)
- [How This Works](https://github.com/transittaxmc-create/claris/blob/feat/copiloto-v7-phase1-foundation/components/copiloto/how-it-works-screen.tsx)
- [CRM Design Preview component](https://github.com/transittaxmc-create/claris/blob/feat/copiloto-v7-phase1-foundation/components/copiloto-v7-preview/crm-design-workspace.tsx)

**Conclusión:** Copiloto V7 no está terminado. La continuidad entre ChatGPT y Muse está probada; el Coordinator está construido pero su E2E live está pendiente; el CRM visual está en la rama pero no está publicado en Railway porque el build actual falla por JSX en How This Works. La prioridad inmediata es reparar ese único bloqueo, conseguir un deployment visible y permitir que Miguel revise/apruebe antes de integrar.
