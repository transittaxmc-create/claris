# EMPIEZA AQUÍ — Copiloto V7 (punto fijo de arranque)

**Esta es la única puerta de entrada. No cambia de sitio ni de forma.**
El estado se actualiza EN ESTA MISMA PÁGINA, en su sitio. El historial vive en Issue #87 y CURRENT-STATE.md; aquí vive SOLO el estado actual.


## Checkpoint ejecutado — 2026-11-28 00:40 EST

- **HEAD de código:** `3c6877fe859d0fc4bbf9663725c6a52175061b80`; después, workflow CI actualizado en `f9e44c904e37935b6ce309ccd416f62958b9abb3`.
- **SMS outbox:** `app/api/crm/send/route.ts` ahora registra en `crm_messages` la aprobación explícita y la cola durable (`status=approved`, `approved_at`, `draft_reply`, `send_state=queued`, `send_via=phone`). Verifica sesión del dueño, pertenencia del mensaje, canal SMS, que el destino coincida con el teléfono del remitente entrante y que no esté enviado/descartado/en despacho. El cliente manda `approve: true` desde la acción de aprobación. Esto guarda en la nube; **NO transmite SMS**.
- **SMS dispatch:** `/api/crm/send/dispatch` sigue deliberadamente en 501 `phone_dispatch_not_connected`. La búsqueda completa del repo y la Issue #85 confirman que no hay worker/cliente Amani, contrato de polling, autenticación del teléfono ni callback seguro dentro del repo. El puente histórico vivió fuera del repo y su contrato actual sigue sin recuperarse. No reactivar el callback antiguo.
- **WhatsApp:** no se encontró conector de entrada/salida, webhook ni integración ZapClaw operativa en la rama. Issue #86 mantiene prohibido migrar/desconectar/registar cuentas sin aprobación; los grupos personales siguen por compartir/reenviar manualmente, sin scraping ni respuestas automáticas.
- **CI del commit `f9e44c9`:** instalación PASS; `pnpm test:crm-push` PASS; build Next.js PASS (compilación y 12/12 páginas). TypeScript FAIL con 76 diagnósticos en archivos preexistentes/legacy, ninguno en `app/api/crm/send/route.ts` ni `components/copiloto/crm-screen.tsx`. El workflow ahora ejecuta pruebas y build aunque el typecheck falle; el fallo de tipos sigue visible y no se oculta.
- **Despliegue:** el código aún NO está verificado en Railway Preview. El deployment Railway SUCCESS conocido sigue en el commit documental `28f00fc4a06e94fd5eade580b60859e1ac230af7`; no afirmar que esta mejora ya está desplegada ni que se ha probado contra Supabase.
- **Seguridad/alcance:** sin mensajes reales, sin cambios de números/cuentas, sin DDL/migraciones, sin producción y sin tocar el Supabase financiero legado.

Última actualización: 2026-11-28 — verificación en vivo Railway Review: deployment SUCCESS/Online en 1096040; build Next compiló y pruebas Gateway 6/6 PASS; TypeScript sigue sin validación porque Next omite typecheck. Detectado /api/scan-inbox 503 por falta de BLOB_READ_WRITE_TOKEN; Coordinator aún no tiene servicio Railway ni secretos.

## Estado ahora

- **Producción:** Vercel f06c125 — sin cambios por esta auditoría. No merge ni despliegue productivo sin orden específica de Miguel.
- **Rama de trabajo:** feat/copiloto-v7-phase1-foundation; HEAD documental actual: ff1b0de3e79f5a8a8e38569bba60f1a23a3b2669; último commit de código: d92ae9dc73343ad5e575fc51e27d0a64862b4bda (código: ad326b1 JSX; 5afbbcd tres carriles; 084da52 UI; 822bff SMS limitado a Transport y sin estados de entrega ficticios; d92ae9 timelines alineados). Comparación actual con main: diverged, 195 ahead / 1 behind; no merge/rebase/reset.
- **Railway Review (verificado 2026-11-28):** proyecto copiloto-v7-temporal, entorno review, servicio copiloto-v7-preview, dominio https://copiloto-v7-preview-review.up.railway.app. Deployment actual `a3d1f64f-ff3e-48a6-ae0a-bd825de40b49` SUCCESS/Online, commit `1096040e1c1514ab897112fe491887b0e04893bb`. Build: Next.js compiled successfully, 12/12 static pages, Agent Gateway tests 6/6 PASS. El build muestra `Skipping validation of types`; esto NO es typecheck PASS. Hay dos deployments FAILED históricos. Logs HTTP recientes muestran /api/scan-inbox 503.
- **Build/JSX:** el arreglo JSX está incluido en la rama desplegada. El build Railway actual compiló correctamente y generó 12/12 páginas; Agent Gateway tests 6/6 PASS. Next omitió validación de tipos, así que el typecheck global sigue pendiente y no se declara PASS.
- **Agentes ↔ Gateway:** ChatGPT↔Muse CERRADO Y PROBADO por Amani API (Issue #87, Verificación #22). No repetir setup ni ACK. La verificación previa fue vía Amani; en esta sesión no hay una acción Gateway autenticada disponible para emitir nuevos message.send.
- **OpenAI Coordinator:** código independiente construido; harness sintético 14/14 documentado. Servicio Railway `openai-coordinator` creado en estado **STAGED, NO LIVE** (ID `d2a25fd9-3038-4037-9736-3fa4975ee835`, patch `ab7a1ad9-6cfa-4015-9d9b-386153399e1e`); source/branch/root/build/start y variables no secretas preparados. No aceptar/deploy todavía. Faltan `OPENAI_API_KEY` y `COORDINATOR_GATEWAY_KEY`; no se deben inventar ni pegar en chat. La identidad `coordinator` tampoco existe aún en Supabase `agent_identities`; SQL revisado por Amani está fuera del repo y NO ejecutado. E2E live no demostrado.
- **DeepSeek:** conectado vía Amani y probado según el registro.
- **Corrección de nombre (Miguel, 2026-11-27):** no existe un agente llamado Dixie en este equipo; la referencia correcta es DeepSeek. No crear tareas, menciones ni reportes bajo el nombre Dixie.
- **Claude (Anthropic):** solo diseño; no integración activa.
- **Gemini:** integración vía Amani documentada; no asumir que el CRM V7 ya la usa.
- **CRM Design Preview:** ruta aislada /copiloto-v7-crm-design; commits base 569626d, afd8da8, 8117caf. El Centro de Comunicaciones ahora muestra tres carriles separados: SMS/Amani → Transport; WhatsApp Business 934-208-1400 → Transport; WhatsApp personal 934-200-8109 → Taxes + Work Opportunities. Se añadieron datos sintéticos de oportunidad compartida manualmente, filtro dedicado y pantalla Work Opportunities. Commits 5afbbcd14a81726f8140393c44d91e1af1c8c52e, 084da52c0f0697b67e773cdaff156035680edbbe y 822bff21b73d7e8d78c1b90365eb84248e3e7362. SMS/Amani muestra solo Transport; se retiró el ejemplo SMS clasificado como Taxes y se evitó cualquier estado que pudiera sugerir entrega real. No hay persistencia ni conexión de proveedores; build/QA desktop/iPhone pendientes.

## Alcance confirmado — CRM Copiloto V7 completo

La aclaración posterior de Miguel en Issue #87, comentario 7234067711, fija que «CMS» significa el CRM Copiloto V7 completo, no un CMS separado. El objetivo es completar el CRM como centro operativo del negocio, con continuidad/maestro compartido entre agentes, coordinación autenticada y auditable entre Muse, Amani, Gemini y ChatGPT, SMS mediante el puente original Muse/Amani y WhatsApp Business mediante ZapClaw. Los canales, cuentas y permisos de Transport y Taxes deben permanecer separados. Esta aclaración posterior actualiza el alcance más limitado de la decisión anterior de Fase 1.

**Prioridad de ejecución:** terminar por partes, empezando por la mensajería y sus carriles; después continuar con las demás partes del CRM en orden. No detener el proyecto en una preview visual.

**Canales, siempre separados:**
- **SMS/Amani** → Transport.
- **WhatsApp Business 934-208-1400** → Transport.
- **WhatsApp personal 934-200-8109** → Taxes y grupos de Work Opportunities.
- El carril personal recibe oportunidades compartidas manualmente; no scraping no oficial de grupos ni respuestas YES automáticas.

**Salvaguardas vigentes:** no Twilio, no cambiar números ni cuentas, no tocar el Supabase financiero legado `zrcnpmipdhpjdjkfrrgt`, no producción, no datos reales de clientes, no pagos reales ni mensajes salientes reales sin aprobación específica. Un botón local o HTTP 2xx no demuestra entrega. Las pruebas deben demostrar los ciclos de extremo a extremo, persistencia, auditoría y no pérdida de mensajes cuando se habilite cada proveedor.

El E2E ChatGPT↔Muse del Agent Gateway (#87 Verificación #22) es coordinación interna entre agentes; no demuestra que SMS o WhatsApp de clientes estén conectados.

## Reglas que no cambian

- Design System V1.0: Inter; fondo #050505; tarjetas #191919; ámbar #FFB900; verde #00C76A; cyan #08B9ED; rojo #E64B55.
- Logos originales intactos. Sin redibujar, recolorear ni sustituir.
- Sin Twilio. No cambiar números, cuentas ni proveedores.
- Aprobación humana antes de mensajes salientes; ningún mensaje a clientes/Mr. Shah sin autorización específica.
- No datos reales de clientes ni pagos reales en desarrollo.
- No secretos en chats, issues, código o documentos.
- No tocar Supabase financiero legado zrcnpmipdhpjdjkfrrgt; CRM Supabase es mimgwleghecseoymgdug.
- Una pantalla Preview no equivale a un módulo conectado, persistente, seguro ni listo para clientes.
- **Incidencia operativa detectada 2026-11-28:** `/api/scan-inbox` devuelve 503 `inbox_not_configured` porque el servicio Railway no tiene `BLOB_READ_WRITE_TOKEN`. La ruta también requiere `SCAN_INBOX_KEY` para POST; no configurar con valores inventados. Resolver mediante almacenamiento/secretos aprobados y probar POST/GET en Review.
- Cada agente lee este START-HERE + Issue #87 + issue del canal antes de actuar; no repetir trabajo verificado; cada avance registra commit, evidencia, prueba, estado, responsable y siguiente paso aquí y en Issue #87.

## Dónde está cada cosa

- **Auditoría maestra actual:** AUDIT-REPORT-2026-11-28.md.
- **Registro e historial:** Issue #87; SMS #85; WhatsApp #86.
- **CRM Design Preview:** app/copiloto-v7-crm-design/page.tsx → components/copiloto-v7-preview/crm-design-workspace.tsx.
- **Historia técnica:** docs/copiloto-v7-master/CURRENT-STATE.md.
- **Contrato Gateway:** docs/copiloto-v7-master/AGENT-GATEWAY-API.md (+ OpenAPI).
- **Manual en la app:** components/copiloto/how-it-works-screen.tsx; actualmente tiene el error JSX descrito arriba y NO debe marcarse como validado hasta corregirlo.

## Lista de cierre de esta etapa (fija — solo se tacha; nada nuevo sin orden de Miguel)

**EL OBJETIVO ES TERMINAR EL CRM COMPLETO. El orden es POR PARTES, dentro del CRM (Miguel, 2026-11-27):**
**Parte 1 = MENSAJERÍA.** Nada de tarifas ni de las demás partes hasta cerrar esta parte.
La Parte 1 se cierra cuando MIGUEL compruebe que SMS y los dos WhatsApp **envían, reciben,
no pierden ningún mensaje y se responden desde el CRM** con su aprobación y sus estados.
Cerrada la Parte 1, se continúa con las partes siguientes del CRM en orden hasta completarlo — el CRM no se pospone; se termina por partes.

**Regla de reporte (Miguel, 2026-11-27):** cada agente reporta lo que TERMINA y ese reporte va al registro del Gateway. ChatGPT, al completar cada pieza, envía su reporte por el Gateway (message.send a Muse) y lo registra en el Issue #87. DeepSeek reporta a través de Amani, que asienta su reporte en el mismo registro. Amani verifica cada reporte contra la evidencia (commit/preview) antes de tachar el punto de esta lista, y entrega a Miguel UN solo reporte consolidado. Miguel no persigue a nadie: los reportes llegan al Gateway y Amani los recoge.

- [ ] 1. SMS — recepción y captura total en el CRM: ningún mensaje se pierde
- [ ] 2. SMS — envío desde el CRM con aprobación de Miguel y estados honestos, probado de punta a punta
- [ ] 3. WhatsApp Business — recepción y captura en el CRM, en su carril
- [ ] 4. WhatsApp Business — envío desde el CRM con aprobación y estados, probado de punta a punta
- [ ] 5. WhatsApp personal — recepción y captura en su carril (Impuestos + grupos de trabajos)
- [ ] 6. WhatsApp personal — respuesta desde el CRM en su carril, con aprobación
- [ ] 7. Prueba integral con Miguel en los tres canales (ida y vuelta, sin pérdidas) → Miguel da la Fase 1 por terminada
**PLAZO: HOY (Miguel, 2026-11-27 22:30 EST).** Esto se termina HOY, no mañana — mañana no tiene tiempo. Por eso existe Railway: verlo funcionando hoy. Orden urgente ya enviada a ChatGPT por el Gateway: reparar el error de build (how-it-works-screen.tsx, línea 2287) y redesplegar hasta que /copiloto-v7-crm-design responda 200 (verificado 404 a las 22:27 EST).
**BARRA DE DISEÑO:** espectacular, profesional y limpio. ChatGPT enseñó un diseño temprano y Miguel aprobó ESA dirección ("vamos a hacerlo así") — se mantiene esa dirección, sin inventar otra.



## Checkpoint de continuidad verificado — 2026-11-28 05:51 EST (ChatGPT)

- **Rama/HEAD GitHub:** `feat/copiloto-v7-phase1-foundation` en `8484bc8f791d842978a1ab419a520ca3237f6a9b`. El commit HEAD es documental (`docs(copiloto): record verified SMS outbox progress and blockers`); no asumir que el código de esa rama está desplegado.
- **Railway Review en vivo:** proyecto `copiloto-v7-temporal`, entorno `review`, servicio `copiloto-v7-preview` ONLINE (1/1 réplica). Deployment `9f820a6c-8d27-4b4f-8e3b-3157e3bdea5a` SUCCESS, creado 2026-11-28 05:16:53 UTC, commit desplegado `28f00fc4a06e94fd5eade580b60859e1ac230af7`, dominio `https://copiloto-v7-preview-review.up.railway.app`. El deployment previo `a3d1f64f-ff3e-48a6-ae0a-bd825de40b49` aparece REMOVED; no citarlo como activo.
- **Separación código/despliegue:** los commits SMS outbox `36dbef5d9b764e7d519b304eb772b7798bd6609c`, UI approval `3c6877fe859d0fc4bbf9663725c6a52175061b80` y CI `f9e44c904e37935b6ce309ccd416f62958b9abb3` están documentados, pero no hay evidencia de que estén en el deployment live de Railway ni de que la cola se haya probado contra Supabase en vivo. SMS dispatch continúa 501; no transmite SMS.
- **CI:** run `46113117926`: install PASS, `pnpm test:crm-push` PASS, Next build PASS (12/12 páginas); TypeScript FAIL con 76 diagnósticos globales legacy/Gateway/tests. El workflow global queda FAILED. No afirmar typecheck PASS.
- **Coordinator:** servicio `openai-coordinator` ID `d2a25fd9-3038-4037-9736-3fa4975ee835` permanece STAGED/NO LIVE en patch `ab7a1ad9-6cfa-4015-9d9b-386153399e1e`. Faltan `OPENAI_API_KEY`, `COORDINATOR_GATEWAY_KEY` y provisionar la identidad dedicada `coordinator`; no aceptar el patch ni inventar credenciales/SQL.
- **Scanner:** `/api/scan-inbox` sigue 503 `inbox_not_configured`; faltan `BLOB_READ_WRITE_TOKEN` y, para POST, `SCAN_INBOX_KEY`. No se añadieron variables ni secretos.
- **Variables del servicio Preview:** Railway muestra únicamente el nombre `CRM_AGENT_GATEWAY_URL`; no revelar ni solicitar valores.
- **Documentación:** el checkpoint previo en esta página contenía referencias históricas inconsistentes (incluido error JSX pendiente y deployment a3d1 como activo). Esta sección es la referencia más reciente: build del deployment live SUCCESS, typecheck independiente NO PASS, deployment activo 28f00fc y código SMS outbox aún no desplegado/verificado en Supabase.
- **Próxima acción técnica segura:** auditar el historial de la ruta SMS/Amani y del contrato externo Muse/Amani para recuperar evidencia del polling/ACK/autenticación; en paralelo preparar pruebas reproducibles de la cola en Preview solo cuando el commit de código correspondiente se despliegue a Review. No activar dispatch, no migrar WhatsApp, no SQL/DDL, no producción, no mensajes reales ni cambios externos sin aprobación específica.
- **Límites confirmados:** solo rama/Review; no merge/main/producción; no Supabase financiero `zrcnpmipdhpjdjkfrrgt`; no DDL/migraciones; no secretos en chats/issues/docs; no clientes reales, pagos ni mensajes reales; SMS/Amani, WhatsApp Business/ZapClaw y WhatsApp Personal permanecen separados.
