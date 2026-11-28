# EMPIEZA AQUÍ — Copiloto V7 (punto fijo de arranque)

**Esta es la única puerta de entrada. No cambia de sitio ni de forma.**
El estado se actualiza EN ESTA MISMA PÁGINA, en su sitio. El historial vive en Issue #87 y CURRENT-STATE.md; aquí vive SOLO el estado actual.

Última actualización: 2026-11-28 — auditoría maestra registrada; Railway build del CRM Preview falló por JSX en How This Works.

## Estado ahora

- **Producción:** Vercel f06c125 — sin cambios por esta auditoría. No merge ni despliegue productivo sin orden específica de Miguel.
- **Rama de trabajo:** feat/copiloto-v7-phase1-foundation; HEAD revisado: 8c9dfb20b0e0f6e643524d4050fecbe90c716a9a. Comparación actual con main: diverged, 195 ahead / 1 behind; no merge/rebase/reset.
- **Railway Review:** proyecto copiloto-v7-temporal, entorno review, servicio copiloto-v7-preview, dominio https://copiloto-v7-preview-review.up.railway.app. Fuente conectada a la rama feature. Build del commit 8c9dfb20 = FAILED; último SUCCESS activo sigue en commit anterior 9867adf. El CRM Design Preview nuevo aún no está confirmado visible en Railway.
- **Bloqueo de build:** components/copiloto/how-it-works-screen.tsx:2287 — falta cerrar un componente Section antes de abrir la sección siguiente. Corregir de forma mínima y volver a desplegar a Railway Review; no modificar producción.
- **Agentes ↔ Gateway:** ChatGPT↔Muse CERRADO Y PROBADO por Amani API (Issue #87, Verificación #22). No repetir setup ni ACK.
- **OpenAI Coordinator:** construido en la rama; pruebas sintéticas 14/14. E2E live separado pendiente de identidad/credenciales propias y configuración segura.
- **DeepSeek:** conectado vía Amani y probado según el registro.
- **Claude (Anthropic):** solo diseño; no integración activa.
- **Gemini:** integración vía Amani documentada; no asumir que el CRM V7 ya la usa.
- **CRM Design Preview:** ruta aislada /copiloto-v7-crm-design; commits de construcción 569626d, afd8da8, 8117caf. Incluye Overview, Clients, Transport, Taxes, Documents y Communications con bandejas SMS/WhatsApp separadas, filtros Transport/Taxes, borrador editable, aprobación humana simulada, estados y timeline. Todo sintético/local, sin backend ni proveedores. Build actual falló; QA visual desktop/iPhone pendiente.

## Alcance confirmado

- **Fase 1:** plataforma Copiloto + Centro de Comunicaciones preparado, con datos sintéticos. Activación de proveedores, mensajes reales, webhooks y recibos reales queda para fase posterior y requiere aprobación específica.
- Integración incremental en la app original después de revisión/aprobación. No sustituir wholesale CopilotoApp ni alterar módulos existentes.
- **Canales, siempre separados:**
  - **SMS/Amani** → Transport (clientes/pasajeros).
  - **WhatsApp Business 934-208-1400** → Transport.
  - **WhatsApp personal 934-200-8109** → Taxes y grupos de Work Opportunities.
  - No scraping no oficial de grupos ni respuestas YES automáticas; investigar reenvío/compartido manual.
- “CMS” aparece en chats, pero su significado exacto no está confirmado. El alcance técnico canónico registrado es CRM Copiloto V7 + Centro de Comunicaciones; no inventar una equivalencia.
- El E2E ChatGPT↔Muse del Gateway no es el SMS/WhatsApp de clientes.

## Qué falta (responsable)

1. Corregir el JSX de How This Works y re-ejecutar build Railway Review (ChatGPT).
2. Verificar que /copiloto-v7-crm-design responde en Railway y hacer QA visual desktop/iPhone; corregir hallazgos (ChatGPT).
3. Presentar el preview a Miguel para comentarios y aprobación; no integrar antes (ChatGPT/Miguel).
4. Integrar incrementalmente el diseño aprobado en la app original, preservando navegación y flujos existentes (equipo, con autorización de Miguel).
5. Coordinator: resolver identidad/credenciales propias y E2E live, sin confundirlo con el E2E ya cerrado ChatGPT↔Muse (Miguel/Amani).
6. Decisión pendiente de Miguel: Auth+JWT (arquitectura aprobada en el checkpoint original) vs la desviación implementada de claves de máquina + hash SHA-256; no ampliar uso sin resolver.
7. SMS/Amani: recuperar el contrato real del puente externo; callback antiguo no reactivar; dispatch actual sigue 501 y la cola no transmite (Amani).
8. WhatsApp Business/ZapClaw y WhatsApp personal/grupos: auditar por separado; no conexión/ingestión/envío real verificado (Amani).
9. Seguridad antes de clientes reales: MFA/enforcement, aislamiento Transport/Taxes, memberships/RLS, almacenamiento documental privado, pruebas de escritura/aislamiento, backups/restore y auditoría.
10. Typecheck global sigue con baseline histórico de 76 diagnósticos; no declarar PASS sin corrida reproducible actual.

## Reglas que no cambian

- Design System V1.0: Inter; fondo #050505; tarjetas #191919; ámbar #FFB900; verde #00C76A; cyan #08B9ED; rojo #E64B55.
- Logos originales intactos. Sin redibujar, recolorear ni sustituir.
- Sin Twilio. No cambiar números, cuentas ni proveedores.
- Aprobación humana antes de mensajes salientes; ningún mensaje a clientes/Mr. Shah sin autorización específica.
- No datos reales de clientes ni pagos reales en desarrollo.
- No secretos en chats, issues, código o documentos.
- No tocar Supabase financiero legado zrcnpmipdhpjdjkfrrgt; CRM Supabase es mimgwleghecseoymgdug.
- Una pantalla Preview no equivale a un módulo conectado, persistente, seguro ni listo para clientes.
- Cada agente lee este START-HERE + Issue #87 + issue del canal antes de actuar; no repetir trabajo verificado; cada avance registra commit, evidencia, prueba, estado, responsable y siguiente paso aquí y en Issue #87.

## Dónde está cada cosa

- **Auditoría maestra actual:** AUDIT-REPORT-2026-11-28.md.
- **Registro e historial:** Issue #87; SMS #85; WhatsApp #86.
- **CRM Design Preview:** app/copiloto-v7-crm-design/page.tsx → components/copiloto-v7-preview/crm-design-workspace.tsx.
- **Historia técnica:** docs/copiloto-v7-master/CURRENT-STATE.md.
- **Contrato Gateway:** docs/copiloto-v7-master/AGENT-GATEWAY-API.md (+ OpenAPI).
- **Manual en la app:** components/copiloto/how-it-works-screen.tsx; actualmente tiene el error JSX descrito arriba y NO debe marcarse como validado hasta corregirlo.

## Lista de cierre de esta etapa (fija — solo se tacha; nada nuevo sin orden de Miguel)

**ORDEN POR PARTES (Miguel, 2026-11-27 22:24 EST): la Fase 1 del CRM es SOLO MENSAJERÍA.**
Nada de tarifas ni de las demás partes del CRM hasta que Miguel dé la mensajería por terminada.
La fase se da por terminada cuando MIGUEL compruebe que SMS y los dos WhatsApp **envían, reciben,
no pierden ningún mensaje y se responden desde el CRM** con su aprobación y sus estados.
El resto del CRM (diseño completo y demás partes) queda EN ESPERA detrás de esta lista.

**Regla de reporte (Miguel, 2026-11-27):** cada agente reporta lo que TERMINA y ese reporte va al registro del Gateway. ChatGPT, al completar cada pieza, envía su reporte por el Gateway (message.send a Muse) y lo registra en el Issue #87. DeepSeek reporta a través de Amani, que asienta su reporte en el mismo registro. Amani verifica cada reporte contra la evidencia (commit/preview) antes de tachar el punto de esta lista, y entrega a Miguel UN solo reporte consolidado. Miguel no persigue a nadie: los reportes llegan al Gateway y Amani los recoge.

- [ ] 1. SMS — recepción y captura total en el CRM: ningún mensaje se pierde
- [ ] 2. SMS — envío desde el CRM con aprobación de Miguel y estados honestos, probado de punta a punta
- [ ] 3. WhatsApp Business — recepción y captura en el CRM, en su carril
- [ ] 4. WhatsApp Business — envío desde el CRM con aprobación y estados, probado de punta a punta
- [ ] 5. WhatsApp personal — recepción y captura en su carril (Impuestos + grupos de trabajos)
- [ ] 6. WhatsApp personal — respuesta desde el CRM en su carril, con aprobación
- [ ] 7. Prueba integral con Miguel en los tres canales (ida y vuelta, sin pérdidas) → Miguel da la Fase 1 por terminada
