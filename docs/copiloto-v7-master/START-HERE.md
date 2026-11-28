# EMPIEZA AQUÍ — Copiloto V7 (punto fijo de arranque)

**Esta es la única puerta de entrada. No cambia de sitio ni de forma.**
El estado se actualiza EN ESTA MISMA PÁGINA, en su sitio. Nada de crear secciones
nuevas para decir el estado: el historial vive en el Issue #87 y en CURRENT-STATE.md;
aquí vive SOLO el estado actual.

Última actualización: 2026-11-27 21:55 EST (Amani/Muse, por orden de Miguel).

## Estado ahora

- **Producción:** `f06c125` — intacta. Nadie despliega ni fusiona sin orden de Miguel.
- **Rama de trabajo:** `feat/copiloto-v7-phase1-foundation` — divergente (186 adelante / 1 detrás de main).
- **Agentes ↔ Gateway:** CERRADO Y PROBADO — ChatGPT autenticó con su identidad propia,
  confirmó (ACK) los mensajes y respondió; Muse confirmó de vuelta (Issue #87, Verificación #22).
  Vía vigente: Amani opera las API, atribución `chatgpt (via amani)`.
- **OpenAI Coordinator:** construido en la rama (servicio + pruebas 14/14 contra simuladores).
  Su E2E en vivo espera SU identidad (`coordinator`): el SQL está preparado, no ejecutado.
- **DeepSeek:** conectado vía Amani y probado con llamada real (segundas opiniones de código/lógica).
- **Claude (Anthropic):** solo diseño, por decisión de Miguel; su llave de API aún no se deposita.
- **Gemini:** conectado vía Amani por API, como siempre.

## Qué falta (dueño entre paréntesis)

1. Identidad `coordinator` creada + su llave depositada (Miguel corre el SQL; Amani verifica).
2. Llave de OpenAI en su conector, como secreto del servicio del Coordinator (Miguel deposita).
3. Diseño del CRM completo (ChatGPT, en curso) — se verifica contra el Design System V1.0.
4. Prueba SMS de Carlos en el teléfono (Miguel) — cierra el carril SMS.
5. WhatsApp real: fase posterior por decisión de Miguel. En esta etapa NO se activa.
6. Decisión de arquitectura llave+hash vs JWT (Miguel) — la desviación sigue documentada.

## Reglas que no cambian

- SMS y WhatsApp son carriles separados. Sin Twilio. Sin cambiar números ni cuentas.
- **A Mr. Shah no le llega NINGÚN mensaje sin aprobación específica de Miguel.**
  Toda prueba es ficticia y solo con los números propios de Miguel.
- Ninguna llave en chats, issues ni documentos: solo Secure Vault / Supabase Vault.
- Todo avance se registra en el Issue #87 (fecha, agente, evidencia, commit, estado, siguiente paso)
  y el estado de ESTA página se actualiza en su sitio en el mismo paso.
- Una pantalla de preview NO es un módulo conectado: los previews usan datos sintéticos;
  el CRM real vive en producción.

## Dónde está cada cosa (sitios fijos)

- **Estado actual:** esta página.
- **Registro e historial completo:** GitHub Issue #87 (SMS: #85 · WhatsApp: #86).
- **Historia técnica por hitos:** `docs/copiloto-v7-master/CURRENT-STATE.md`.
- **Contrato del Gateway:** `docs/copiloto-v7-master/AGENT-GATEWAY-API.md` (+ OPENAPI.yaml).
- **Manual dentro de la app:** `components/copiloto/how-it-works-screen.tsx` (un solo índice).
