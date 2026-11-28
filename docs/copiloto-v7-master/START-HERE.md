# EMPIEZA AQUÍ — Copiloto V7 (punto fijo de arranque)

**Esta es la única puerta de entrada. No cambia de sitio ni de forma.**
El estado se actualiza EN ESTA MISMA PÁGINA, en su sitio. Nada de crear secciones
nuevas para decir el estado: el historial vive en el Issue #87 y en CURRENT-STATE.md;
aquí vive SOLO el estado actual.

Última actualización: 2026-11-27 — CRM Design Preview creado en rama de trabajo (ChatGPT).

## Estado ahora

- **Producción:** `f06c125` — intacta. Nadie despliega ni fusiona sin orden de Miguel.
- **Rama de trabajo:** `feat/copiloto-v7-phase1-foundation` — divergente de main; no merge/rebase.
- **Agentes ↔ Gateway:** CERRADO Y PROBADO — ChatGPT autenticó con su identidad propia,
  confirmó (ACK) los mensajes y respondió; Muse confirmó de vuelta (Issue #87, Verificación #22).
  Vía vigente: Amani opera las API, atribución `chatgpt (via amani)`.
- **OpenAI Coordinator:** construido en la rama (servicio + pruebas 14/14 contra simuladores).
  Su E2E en vivo espera SU identidad (`coordinator`): el SQL está preparado, no ejecutado.
- **DeepSeek:** conectado vía Amani y probado con llamada real (segundas opiniones de código/lógica).
- **Claude (Anthropic):** solo diseño, por decisión de Miguel; su llave de API aún no se deposita.
- **Gemini:** conectado vía Amani por API.
- **CRM Design Preview:** NUEVA ruta aislada `/copiloto-v7-crm-design`, en commits
  `569626d`, `afd8da8` y `8117caf` (Inter cargada mediante next/font/google). Incluye Overview, Clients, Transport, Taxes, Documents y
  Communications con bandejas SMS/WhatsApp separadas, filtros Transport/Taxes,
  borrador editable, aprobación humana simulada, estados explícitos y timeline de cliente.
  Todo es sintético/local; no usa backend ni proveedores. GitHub Actions build del HEAD `8117caf` en estado QUEUED; QA de build/browser aún pendiente.


## Alcance de esta etapa (cerrado por Miguel, 2026-11-27 22:06 EST)

- **SOLO el CRM. El resto de la aplicación NO se toca.**
- Trabajo: conectar el diseño del CRM + la funcionalidad de sus comunicaciones.
- Canales: **1 SMS y 2 WhatsApp** (Transporte (934) 208-1400 e Impuestos, el segundo número), carriles separados, nunca mezclados.

## Qué falta (dueño entre paréntesis)

1. Identidad `coordinator` creada + su llave depositada (Miguel corre el SQL; Amani verifica).
2. Llave de OpenAI en su conector, como secreto del servicio del Coordinator (Miguel deposita).
3. CRM Design Preview: ejecutar build/typecheck y QA visual responsive; corregir hallazgos
   sin tocar lógica, cálculos, datos ni logos originales (ChatGPT).
4. Integración incremental del diseño en la aplicación original, mañana, después de revisión
   y autorización específica de Miguel; no sustituir wholesale `CopilotoApp`.
5. SMS/WhatsApp de clientes: diseño preparado solamente en esta entrega. No activar proveedores,
   webhooks ni envíos reales; requieren fase posterior y aprobación específica.
6. Prueba SMS de Carlos y prueba WhatsApp de ZapClaw siguen en sus carriles separados y
   no se consideran realizadas por este diseño.
7. Decisión de arquitectura llave+hash vs JWT (Miguel) — la desviación sigue documentada.

## Reglas que no cambian

- Design System V1.0 de Miguel: Inter; fondo `#050505`; tarjetas `#191919`;
  ámbar `#FFB900`; verde `#00C76A`; cyan `#08B9ED`; rojo `#E64B55`.
- Los logos existentes se usan sin redibujar, recolorear ni sustituir. No se crea un logo nuevo.
- SMS y WhatsApp son carriles separados. Sin Twilio. Sin cambiar números ni cuentas.
- Bandejas SMS y WhatsApp separadas; dentro de cada una, clasificación All / Transport / Taxes.
  La aprobación en preview nunca dispara un envío. Los estados de entrega son ejemplos sintéticos.
- **A Mr. Shah no le llega NINGÚN mensaje sin aprobación específica de Miguel.**
  Toda prueba es ficticia y solo con los números propios de Miguel.
- Ninguna llave en chats, issues ni documentos: solo Secure Vault / Supabase Vault.
- Todo avance se registra en el Issue #87 (fecha, agente, evidencia, commit, estado, siguiente paso)
  y el estado de ESTA página se actualiza en su sitio en el mismo paso.
- El CRM Design Preview no cambia lógica, cálculos ni datos existentes. No conecta Supabase,
  Amani, ZapClaw, SMS, WhatsApp ni APIs externas.
- Una pantalla de preview NO es un módulo conectado: los previews usan datos sintéticos;
  el CRM real vive en la aplicación original/producción.

## Dónde está cada cosa (sitios fijos)

- **Estado actual:** esta página.
- **Registro e historial completo:** GitHub Issue #87 (SMS: #85 · WhatsApp: #86).
- **CRM Design Preview:** `app/copiloto-v7-crm-design/page.tsx` →
  `components/copiloto-v7-preview/crm-design-workspace.tsx`.
- **Historia técnica por hitos:** `docs/copiloto-v7-master/CURRENT-STATE.md`.
- **Contrato del Gateway:** `docs/copiloto-v7-master/AGENT-GATEWAY-API.md` (+ OPENAPI.yaml).
- **Manual dentro de la app:** `components/copiloto/how-it-works-screen.tsx` (un solo índice).
