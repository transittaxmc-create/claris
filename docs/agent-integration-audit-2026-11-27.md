# Auditoría de integración — Copiloto V7 como centro de coordinación de agentes

**Fecha:** 2026-11-27 ~16:15 EST · **Tipo:** solo lectura (sin cambios en producción, sin mensajes reales, sin credenciales expuestas — solo nombres de variables y estados).
**Orden de Miguel:** nueva etapa de integración; Copiloto V7 = centro de control; comunicación estructurada Muse/Amani ↔ ChatGPT ↔ Gemini. Primera misión = auditar lo existente y proponer, NO implementar.

---

## 0. Hallazgo previo: producción ≠ HEAD de GitHub

- **Producción verificada** (`GET https://claris-lime.vercel.app/api/version`): commit **`f06c125`**, built 2026-11-27T10:10Z.
- **HEAD de `main` en GitHub: `51cb521`** — más nuevo que producción y **sin despliegue confirmado** (el propio commit se titula "docs(crm): record merge and Vercel deployment rate limit"; la §22 del manual registra un deploy bloqueado por rate limit de Vercel, 403).
- **Qué trajo hoy `f06c125`** (desde `cc852d9` de anoche, 11 archivos): barrido final de inglés en pantallas y manual, y **`app/api/ai-chat/route.ts`: el prompt del Copilot interno pasó a inglés profesional** (commits 6f7e8ce, df02721, 1fb1024, f06c125). La decisión de idioma del AI interno que estaba marcada como pendiente **ya se ejecutó hoy**: el prompt ya no ordena español; ordena responder *"in the user's language"*. (Queda un resto: el mensaje de error `Error en servicio Gemini AI (...)` si Gemini falla.)
- **Qué trae HEAD sin desplegar (`51cb521`):** endurecimiento de push y de la cola SMS (nuevos `lib/crm/push-auth.ts`, `lib/crm/push-validation.ts`, CI nuevo) y **`/api/crm/send/dispatch` DESACTIVADO** (501 `phone_dispatch_not_connected`).

> ⚠️ **Decisión pendiente de Miguel:** si HEAD se despliega tal cual, desaparece la única vía API con la que Amani registra el resultado de un despacho SMS (sending/sent/failed). La cola seguiría encolando, pero los mensajes quedarían en `queued` para siempre. Hay que resolver esta divergencia ANTES de que HEAD llegue a producción: o se conserva un registro de despacho autenticado, o se acepta el cambio a sabiendas.

---

## 1. Cómo está conectado Amani (Muse) con Copiloto V7 hoy

| Pieza | Estado | Mecanismo real |
|---|---|---|
| Código (repo `transittaxmc-create/claris`) | FUNCIONA | Conector GitHub (MCP oficial). Lectura libre; **toda escritura pide aprobación fresca de Miguel por llamada**. Push a `main` = auto-deploy en Vercel. Solo texto UTF-8 (binarios van envueltos en .svg). |
| Deploys (Vercel) | FUNCIONA (lectura) | Conector custom `custom.legacy-vercel` (`vercel_api.py`): consultar deploys de claris (`prj_EaOp8GqqgF0i4BBEp3CJSY8phcKW`). No se despliega directo: se empuja a GitHub. |
| Datos CRM | FUNCIONA vía app | Supabase proyecto **`mimgwleghecseoymgdug`** ("Copiloto V7 CRM"). La app entra con sesión de Miguel + publishable key + **RLS por dueño**. **No existe service-role key del CRM en ningún sitio, por diseño.** Amani NO tiene vía propia directa contra el CRM: las migraciones las pega Miguel en el SQL Editor (entrada "Continue with GitHub"). |
| Datos finanzas | PARCIAL / CONGELADO | Supabase financiero `zrcnpmipdhpjdjkfrrgt` vía scripts `~/workspace/plaid-sync/` (url + anon_key). **Bloqueado por cuota de egress (HTTP 402) desde el 10-nov; se reinicia el 6-dic.** Plaid en sí está sano; lo caído es la subida a esa nube. |
| Teléfonos | FUNCIONA | S26 Ultra pareado con permiso SMS y "Run in background": por ahí llegan los SMS de clientes al instante y desde ahí despacha Amani. iPhone pareado sin fuente SMS (iOS no la expone) y sin permiso de contactos. |
| Gemini (agente) | FUNCIONA, una dirección | Conector custom `custom.legacy-google-gemini` (`gemini_api.py`, modelo por defecto `gemini-3-flash-preview`). Amani → Gemini por prompt, **sin memoria entre llamadas**. Gemini no tiene acceso a repo, Supabase, app ni dispositivos. |
| ChatGPT | **NO EXISTE** | Búsqueda de conectores "openai"/"chatgpt": cero resultados. Ninguna vía en ningún sentido. |
| ZapClaw | **SIN CONECTOR** | No hay API/CLI de ZapClaw aquí. El número (934) 208-1400 quedó enlazado por Miguel vía coexistencia; bloqueo de pago de Meta resuelto (tarjeta registrada por él el 26-nov); **prueba de envío de ZapClaw aún pendiente**; el acceso de Amani al panel está bloqueado por la recuperación de Google de 48 h (hasta ~28-nov). |

**Cómo funciona "Amani" como agente:** es Muse (este asistente) operando con memoria persistente del proyecto (`~/MEMORY.md`, lista de pendientes, notas por trabajo), conectores (GitHub, Vercel, Gemini, Plaid, Gmail/Outlook), dispositivos pareados, trabajos programados (sync de Plaid cada 10 min, auditoría horaria, chequeo de finanzas 09:05) y un hook vigilante del botón SYNC (poll 60 s en Supabase). La continuidad entre chats vive en esos archivos y en la memoria, no en cada conversación.

## 2. La app por dentro (código verificado en el repo real)

**Endpoints:** 34 rutas `app/api/**`. Principales:
- `GET /api/version` — público; sha/env/deployment (así se verifica producción).
- Banco: `GET /api/bank/snapshot` (público, sin auth; fuentes Blob → Supabase financiero → Plaid → proxy legado), `POST /api/bank/publish` (header `x-bank-key`), `POST|GET /api/bank/sync-request` (marca del botón SYNC; **depende del Blob suspendido**), `POST /api/bank/refresh` (no-op deliberado), `POST /api/bank/edit-tx` (sin auth de usuario), rutas Plaid legadas (`/api/plaid/*`, rechazadas por Miguel como vía).
- CRM: `GET|POST /api/crm/state` (**sesión CRM**, el user_id sale de la sesión, nunca del body), `POST /api/crm/send`, `POST /api/crm/send/dispatch`, push (`config`, `subscribe`, `test`, `send`), `GET /api/crm/flights/track` (adsb.lol por callsign; sin horario/gate).
- Sync dos teléfonos: `POST /api/data/publish` + `GET /api/data/snapshot` — **doble auth** (header `x-data-key` + sesión CRM, RLS sobre `finance_sync_doc`). En producción desde `05d2d4d`; falta solo la confirmación de Miguel en sus dos teléfonos.
- Google Drive: `/api/gdrive/*` (OAuth scope `drive.file`; tokens guardados en el Blob suspendido → Connect/upload/restore no completan).
- Escáneres (todos llaman a Gemini, sin auth de usuario): `/api/scan-receipt`, `/api/scan-balance`, `/api/scan-bank-shot`, `/api/scan-toll-statement`, `/api/scan-inbox` (header `x-scan-key`), `/api/receipt-image`.
- `POST /api/ai-chat` — el Copilot interno (ver §4).
- **Seguridad (hecho ya conocido, sin cambios):** el repo es público y varias rutas no llevan autenticación de usuario (`/api/bank/snapshot`, `/api/finance/state`, `/api/bank/edit-tx`, escáneres, `/api/ai-chat`, gdrive). Decisión de Miguel pendiente desde antes.

**CRM ↔ Supabase — FUNCIONA.** Tablas: `crm_clients`, `crm_reservations` (migración 20261126024701, RLS con 4 políticas por tabla), `crm_messages` + bucket privado `crm-client-photos` (20261126120000), `finance_sync_doc` (20261126150000), `needs_follow_up` (20261126170000), columnas de despacho (20261126180000), `stop_address` (20261126190000). Mapeos en `lib/crm/crm-cloud.ts`; la pantalla sube cambios con debounce de 800 ms vía `/api/crm/state`.

**Bandeja SMS — PARCIAL.**
- *Entrada:* **no existe webhook ni endpoint de entrada SMS en la app.** Un mensaje entra por (a) el formulario manual "Log message" de la bandeja, o (b) inserción externa vía `/api/crm/state` con la sesión de Miguel (así entraron Shah/Carlos, sembrados por Amani). El SMS real llega al teléfono de Miguel; el reenvío a Amani ocurre **fuera del repo** (teléfono pareado).
- *Lectura:* estado local (localStorage) + **una sola carga de nube por sesión de pantalla**. **Sin Realtime, sin polling, sin refresco por foco.** → El hueco conocido sigue abierto: un mensaje nuevo no aparece en la bandeja abierta hasta volver a entrar. La §22 del manual lo lista como pendiente.

**Cola de salida y despacho SMS — PARCIAL (y con la divergencia de HEAD).**
- Approve & Send → `POST /api/crm/send` valida sesión, teléfono y texto, y verifica que el mensaje exista en la nube (si no, 409). La cola **es** el conjunto de filas `crm_messages` con `send_state='queued'` (el estado sube por la sync normal). **Ningún proceso automático vacía la cola.**
- Despacha **Amani desde el teléfono de Miguel** (permiso SMS del S26). En **producción** el resultado se registra con `POST /api/crm/send/dispatch`: `sending` → `sent` (único paso que puede marcar "sent"; pone `sent_at`, `dispatched_at`, `send_via='phone'`) o `failed` + motivo. La app nunca llama a dispatch: lo llama Amani tras despachar. El indicador en pantalla es honesto: "SENT FROM YOUR PHONE — DELIVERY NOT CONFIRMED".
- En **HEAD (sin desplegar)** dispatch está desactivado y las etiquetas pasaron a "APPROVED — NOT SENT" / "SENT STATUS RECORDED — NOT VERIFIED" (ver la advertencia del §0).

**Notificaciones push — PARCIAL.** Service worker `public/sw.js`; VAPID propio implementado a mano en `lib/crm-push.ts` (sin librerías). Las suscripciones se guardan **cifradas en el Vercel Blob** (`crm-private/push-subscriptions.enc`) → **el Blob está suspendido desde el 19-nov (403)** → la persistencia falla y el push con la app cerrada no es fiable. Pendiente: mover el almacén de push al Supabase del CRM (ítems 59–60 de la lista). En HEAD, subscribe/test ya exigen mismo origen + sesión CRM y validan endpoints de push.

**WhatsApp / ZapClaw — NO EXISTE en el código.** Cero referencias a ZapClaw en todo el repo: ni rutas, ni webhooks, ni variables. Lo único es el valor `'WhatsApp'` en el enum `channel` de `crm_messages` (etiqueta manual). La integración vive 100% fuera de la app (cuenta ZapClaw + coexistencia). Tampoco hay nada del carril de impuestos en código.

**Copilot AI interno — FUNCIONA.** `POST /api/ai-chat` → **Google Gemini `gemini-3.5-flash-lite`** (variable `GEMINI_API_KEY`; el nombre legado `OPENAI_API_KEY` es solo fallback de nombre — **no hay ninguna llamada a OpenAI en el repo**). El prompt vive dentro del propio `route.ts` y desde hoy está en inglés, respondiendo en el idioma del usuario. Modos: chat, banco/reconciliación, gastos, schedules, foto de bill.

**Gemini dentro de la app — FUNCIONA.** 5 endpoints con `gemini-3.5-flash-lite`: ai-chat + 4 escáneres. (La ruta vieja `/api/reconcile/ocr` ya no existe.)

**How It Works — FUNCIONA.** `components/copiloto/how-it-works-screen.tsx` (~1,948 líneas en HEAD), **un solo índice**, §1–§22. §21 = lista de prioridades; **§22 (nueva hoy) = inventario y auditoría de arquitectura**, con baseline `cc852d9` → `f06c125` y la advertencia del deploy bloqueado. Ojo: el manual de HEAD ya describe el endurecimiento de push/outbox; el de producción describe el despacho por teléfono como vigente. Coincidirán cuando se resuelva la divergencia.

## 3. Qué funciona / qué es parcial / qué falta

**FUNCIONA:** Amani ↔ GitHub (lectura libre, escritura con aprobación) · Amani → Gemini por API · CRM ↔ Supabase con RLS sin service key · cola SMS (`queued`) · registro de despacho en producción · Copilot interno y escáneres Gemini · sync de finanzas dos teléfonos (código en producción) · endpoints de versión/verificación.

**PARCIAL:** bandeja SMS (sin refresco en vivo; entrada sin webhook) · push (almacén en Blob suspendido) · finanzas (Supabase financiero congelado hasta el 6-dic) · Google Drive (tokens en el Blob) · WhatsApp (número enlazado en ZapClaw, sin prueba de envío y sin puente a la app) · Gemini como "agente" (solo consultor sin memoria, vía Amani).

**NO EXISTE:** cualquier canal con ChatGPT · cualquier canal entrante hacia Amani desde otro agente (nadie puede "despertar" a Amani excepto los hooks/crons propios y los mensajes de Miguel) · registro de coordinación entre agentes dentro de Copiloto · webhook de ZapClaw hacia Copiloto · servidor MCP de Copiloto.

## 4. Propuesta: cómo se comunican los tres asistentes con Copiloto en el centro

Principio: **GitHub por sí solo NO comunica agentes** — nadie avisa a nadie; alguien tiene que ir a leer. Y ni ChatGPT ni Gemini tienen hoy acceso a nada del proyecto: **todo canal pasa por una pieza que Copiloto exponga con autenticación, y Amani actúa como orquestador** (es el único con memoria persistente, dispositivos y permisos verificados).

**Fase 0 — Registro compartido (cero construcción, disponible ya).**
GitHub como tablero: un archivo de contexto de agentes en el repo + issues para tareas entre asistentes. Amani trae y lleva: consulta a Gemini por API con el contexto armado y guarda las respuestas en el registro. ChatGPT queda fuera hasta la Fase 2 (solo podría leer lo público, que es unilateral y riesgoso). Continuidad: el registro vive en el repo, no en un chat.

**Fase 1 — Copiloto como centro real (la pieza clave).**
Una tabla más en el **mismo** Supabase del CRM (no es otra base ni otro CRM): `agent_tasks` — tarea, autor (Miguel/Amani/ChatGPT/Gemini), estado, contexto, resultado. Es el registro de actividades y decisiones **dentro** de Copiloto, con una pantalla mínima en la app. Amani la vigila con el patrón ya probado del botón SYNC (hook que revisa marcas cada 60 s y despierta al agente). Miguel aplica la migración en el SQL Editor, como las anteriores. Gemini participa vía Amani (Amani le pasa el contexto de la tarea y escribe su respuesta en la misma fila).

**Fase 2 — Abrir la puerta con llave.**
Un endpoint de agentes **autenticado con token** en la app existente (token en variables de Vercel, cargado por flujo seguro — nunca en el repo público), que lea/escriba la cola de la Fase 1. Recién entonces:
- **Amani → modelos de OpenAI:** conector custom con la llave de API de OpenAI entregada por Miguel vía Secure Vault (mismo patrón que Gemini/Vercel). Llamadas de un solo tiro, sin memoria — el contexto lo arma Amani desde la cola.
- **ChatGPT → Copiloto:** un GPT personalizado con Actions apuntando a ese endpoint, o ChatGPT como cliente MCP si su cuenta lo soporta.
Sin este endpoint autenticado, exponer datos a ChatGPT significaría apoyarse en que el repo es público — inaceptable para datos de clientes.

**Fase 3 — MCP de Copiloto (evaluar después).** Un servidor MCP "Copiloto" con herramientas de contexto/tareas. Es el estándar con más futuro y el de mayor obra; solo tiene sentido con las Fases 1–2 vivas.

**Reglas que se mantienen en todas las fases:** nada se envía a clientes sin aprobación de Miguel · un solo agente empuja a `main` a la vez · ningún secreto en el repo ni en chats · sin Twilio, sin otro número, sin otra app ni otra base CRM · ZapClaw sigue siendo el carril de WhatsApp.

## 5. Pasos concretos (en orden, cada uno con la autorización que requiere)

1. **Resolver la divergencia de HEAD** (`51cb521`): decidir si el registro de despacho SMS se conserva (recomendado: endpoint autenticado) antes de cualquier despliegue nuevo. *(Decisión de Miguel.)*
2. **Fase 0:** crear el archivo de contexto/registro de agentes en el repo y abrir los primeros issues de coordinación. *(Push con su aprobación, como siempre.)*
3. **Fase 1:** diseñar `agent_tasks` (columnas y RLS por dueño, mismo patrón del CRM) → Miguel pega la migración en el SQL Editor → pantalla mínima en Copiloto → hook vigilante de Amani. *(Su sí para construir; migración la aplica él.)*
4. **Fase 2a:** endpoint de agentes con token en `claris` + deploy verificado en vivo. *(Su sí + él carga el token por flujo seguro.)*
5. **Fase 2b:** conector custom de OpenAI (llave vía Secure Vault) para que Amani consulte a los modelos de ChatGPT con contexto de la cola. *(Él entrega la llave por la tarjeta segura.)*
6. **Fase 2c (opcional):** GPT personalizado con Actions contra el endpoint de la Fase 2a. *(Desde la cuenta de ChatGPT de Miguel.)*
7. **Documentación:** este informe se sube a GitHub y se resume en How It Works (nueva sección o apéndice de la §22, en el mismo deploy, un solo índice) **cuando Miguel lo autorice** — hoy no se tocó producción.
8. **En paralelo, sin mezclar:** cerrar la prueba de envío de ZapClaw (cuando el acceso lo permita, ~28-nov) y decidir el almacén de push (moverlo al Supabase del CRM, ítems 59–60).

## 6. Archivos y endpoints que intervienen (referencia rápida)

- App: `app/api/version/route.ts` · `app/api/crm/state/route.ts` · `app/api/crm/send/route.ts` · `app/api/crm/send/dispatch/route.ts` · `app/api/crm/push/*` · `lib/crm/crm-cloud.ts` · `lib/crm/supabase-browser.ts` / `supabase-server.ts` · `lib/crm-push.ts` (+ en HEAD: `lib/crm/push-auth.ts`, `lib/crm/push-validation.ts`) · `components/copiloto/crm-screen.tsx` · `components/copiloto/how-it-works-screen.tsx` · `supabase/migrations/` (20261126024701 → 20261126190000).
- Agente: `~/workspace/custom-connectors/custom.legacy-google-gemini/bin/gemini_api.py` · `~/workspace/custom-connectors/custom.legacy-vercel/bin/vercel_api.py` · conector GitHub (MCP) · `~/workspace/plaid-sync/` · hook `plaid-sync-on-demand`.
- Externo sin puente: panel de ZapClaw (coexistencia, número (934) 208-1400).
