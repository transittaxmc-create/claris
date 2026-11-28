# EMPIEZA AQUÍ — Copiloto V7 (punto fijo de arranque)

**Esta es la única puerta de entrada. No cambia de sitio ni de forma.**
El estado se actualiza EN ESTA MISMA PÁGINA, en su sitio. El historial vive en Issue #87 y CURRENT-STATE.md; aquí vive SOLO el estado actual.

Última actualización: 2026-11-28 — checkpoint de ejecución: corrección JSX y diseño de tres carriles registrados; build de los commits nuevos aún pendiente de verificación.

## Estado ahora

- **Producción:** Vercel f06c125 — sin cambios por esta auditoría. No merge ni despliegue productivo sin orden específica de Miguel.
- **Rama de trabajo:** feat/copiloto-v7-phase1-foundation; HEAD documental actual: ff1b0de3e79f5a8a8e38569bba60f1a23a3b2669; último commit de código: d92ae9dc73343ad5e575fc51e27d0a64862b4bda (código: ad326b1 JSX; 5afbbcd tres carriles; 084da52 UI; 822bff SMS limitado a Transport y sin estados de entrega ficticios; d92ae9 timelines alineados). Comparación actual con main: diverged, 195 ahead / 1 behind; no merge/rebase/reset.
- **Railway Review:** proyecto copiloto-v7-temporal, entorno review, servicio copiloto-v7-preview, dominio https://copiloto-v7-preview-review.up.railway.app. Fuente conectada a la rama feature. El último deployment consultado sigue FAILED en el commit antiguo 8c9dfb20; el SUCCESS activo continúa en 9867adf. Los commits nuevos aún no aparecen como deployment, por lo que el build corregido NO está validado ni el preview nuevo confirmado en Railway.
- **Build/JSX:** la estructura huérfana de §44–45 en components/copiloto/how-it-works-screen.tsx fue corregida en commit ad326b1155fc8bbeb8b27cbb987a23d71309664e; §44–45 permanecen dentro del retorno del manual. Pendiente build/CI y deployment Railway Review; no declarar PASS.
- **Agentes ↔ Gateway:** ChatGPT↔Muse CERRADO Y PROBADO por Amani API (Issue #87, Verificación #22). No repetir setup ni ACK. La verificación previa fue vía Amani; en esta sesión no hay una acción Gateway autenticada disponible para emitir nuevos message.send.
- **OpenAI Coordinator:** construido en la rama; pruebas sintéticas 14/14. E2E live separado pendiente de identidad/credenciales propias y configuración segura.
- **DeepSeek:** conectado vía Amani y probado según el registro.
- **Claude (Anthropic):** solo diseño; no integración activa.
- **Gemini:** integración vía Amani documentada; no asumir que el CRM V7 ya la usa.
- **CRM Design Preview:** ruta aislada /copiloto-v7-crm-design; commits base 569626d, afd8da8, 8117caf. El Centro de Comunicaciones ahora muestra tres carriles separados: SMS/Amani → Transport; WhatsApp Business 934-208-1400 → Transport; WhatsApp personal 934-200-8109 → Taxes + Work Opportunities. Se añadieron datos sintéticos de oportunidad compartida manualmente, filtro dedicado y pantalla Work Opportunities. Commits 5afbbcd14a81726f8140393c44d91e1af1c8c52e, 084da52c0f0697b67e773cdaff156035680edbbe y 822bff21b73d7e8d78c1b90365eb84248e3e7362. SMS/Amani muestra solo Transport; se retiró el ejemplo SMS clasificado como Taxes y se evitó cualquier estado que pudiera sugerir entrega real. No hay persistencia ni conexión de proveedores; build/QA desktop/iPhone pendientes.

## Alcance confirmado

- **Fase 1:** plataforma Copiloto + Centro de Comunicaciones preparado, con datos sintéticos. Activación de proveedores, mensajes reales, webhooks y recibos reales queda para fase posterior y requiere aprobación específica.
- Integración incremental en la app original después de revisión/aprobación. No sustituir wholesale CopilotoApp ni alterar módulos existentes.
- **Canales, siempre separados:**
  - **SMS/Amani** → Transport (clientes/pasajeros).
  - **WhatsApp Business 934-208-1400** → Transport.
  - **WhatsApp personal 934-200-8109** → Taxes y grupos de Work Opportunities.
  - No scraping no oficial de grupos ni respuestas YES automáticas; investigar reenvío/compartido manual.
- Aclaración de Miguel en Issue #87: cuando dice «CMS» se refiere al CRM Copiloto V7 completo, no a un CMS separado.
- El E2E ChatGPT↔Muse del Gateway no es el SMS/WhatsApp de clientes. En esta sesión se confirmó que la API está documentada, pero no hay una acción directa disponible para emitir ahora un message.send autenticado; no declarar nuevas órdenes entregadas a Muse/DeepSeek/Gemini. El intento de lanzar cloud agents de Railway fue rechazado porque el dashboard de agentes no está activado.

## Qué falta (responsable)

1. Validar build/CI y deployment Railway Review después del arreglo JSX (ChatGPT).
2. Verificar que /copiloto-v7-crm-design responde 200 en Railway y hacer QA visual desktop/iPhone; corregir hallazgos (ChatGPT).
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

