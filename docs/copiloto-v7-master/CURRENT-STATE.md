# Copiloto V7 — estado técnico verificado

**Corte:** 2026-11-27  
**Rama:** feat/copiloto-v7-phase1-foundation  
**Nota:** estado de demo/preview no equivale a CRM productivo.

## 1. GitHub y despliegue
- Repo transittaxmc-create/claris; default branch main; visibilidad actual PUBLIC.
- Feature branch feat/copiloto-v7-phase1-foundation.
- Railway project copiloto-v7-temporal ID a27e9703-8ee8-4650-ac57-c966a7301ca1; environment review ID 6b472376-3905-42d1-9e5b-58321f8caf12; service copiloto-v7-preview ID cd3e119a-0a24-4412-adc0-a0ae56f1e893.
- Deployment vigente 6a948e27-3a11-4f60-97ca-918914c55056, SUCCESS, commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e, región iad. Deployment anterior 6c2ac0c8 fue retirado.
- Preview: https://copiloto-v7-preview-review.up.railway.app, target port 8080.
- Runtime Next.js 16.3.3 Ready en puerto 8080.
- Curl: / y /copiloto-v7-preview HTTP 200. HTML incluye Communications, Transport, Taxes, Work Opportunities, Square y meta viewport móvil.
- No se completó screenshot/browser visual QA. Playwright Chromium falló por incompatibilidad del instalador con Ubuntu 26.04. El cambio reciente de navegación aún no se ha desplegado a Railway; el deployment activo sigue en el commit anterior.
- No merge a main, no Vercel production, no cambios productivos.
- Autorización Railway↔GitHub resuelta; servicio sigue rama feature.

## 2. Verificación de código
- Instalación limpia: Corepack pnpm 12.3.4 + pnpm install --frozen-lockfile completó.
- pnpm run test:crm-push: PASS, 4/4 tests.
- pnpm exec tsc --noEmit: FAIL, 66 diagnósticos en feature.
- Comparación clean clone de main: también 66 diagnósticos; líneas ordenadas idénticas; no se observaron diagnósticos adicionales en feature. Typecheck global sigue fallando.
- Railway Next build compiló y generó 10/10 páginas, pero Next informó “Skipping validation of types”; no presentar como typecheck.
- No se verificaron todos los tests funcionales, auth, integración, seguridad ni restore.

## 3. UI existente
- Ruta aislada: app/copiloto-v7-preview/page.tsx.
- Componentes demo: components/copiloto-v7-preview/transport-workspace.tsx, tax-workspace.tsx, work-opportunities-workspace.tsx, square-workspace.tsx.
- Overview, Communications, Clients y Documents se presentan dentro de la page preview.
- Interacciones nuevas son React state local; no persisten ni llaman CRM DB/proveedores.
- Ruta raíz app/page.tsx continúa en app existente CopilotoApp; no sustituida.
- Se añadió CRM como quinto acceso directo de la navegación inferior (sin quitar TODAY, EARNINGS, MONEY, REPORTS ni MORE) y se retiró CRM de la lista duplicada de MORE. CRMScreen usa next/dynamic con ssr:false y estado Loading CRM; carga al seleccionar CRM. Commits 0e0104cba9bf606220f5d16ed62ff77125467d27 y cf1caace273e2ad26dd13766a53631af3330d2c6. En el clon limpio actualizado: pnpm run test:crm-push PASS 4/4 y pnpm run build PASS (Next.js 16.3.3, compilación y generación 10/10). pnpm exec tsc --noEmit sigue con 66 errores; mismo conjunto de problemas que main, con posiciones de línea desplazadas por el nuevo código, sin nuevos diagnósticos/categorías. Ancho visual de seis accesos en iPhone pendiente.

## 4. CRM existente y API
- components/copiloto/crm-screen.tsx y lib/crm/crm-cloud.ts representan CRM existente con clientes, reservas, mensajes/fotos y mapeos.
- lib/crm/supabase-server.ts usa NEXT_PUBLIC_CRM_SUPABASE_URL y NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY; sesión SSR y RLS; no usa service role CRM.
- POST /api/crm/send valida sesión, teléfono, texto y existencia del mensaje del usuario; solo devuelve queued=true, NO envía SMS.
- POST /api/crm/send/dispatch responde 501 phone_dispatch_not_connected; no existe sender/bridge verificado.
- Push routes existen: /api/crm/push/subscribe, /api/crm/push/send, /api/crm/push/test, /api/crm/push/config; suscripción requiere sesión y same-origin, envío requiere secreto. No se verificó registro remoto actual ni entrega push con app cerrada.
- Conversación anterior confirma prueba push local en iPhone; no equivale a push remoto verificado.

## 5. Base de datos / seguridad
- Proyecto CRM correcto: mimgwleghecseoymgdug; distinto de zrcnpmipdhpjdjkfrrgt.
- Auditoría previa: ACTIVE_HEALTHY, us-east-2, PG17.12.
- Tablas vistas: crm_clients 7 filas; crm_reservations 2; crm_messages 1; finance_sync_doc 1; RLS ON en las cuatro.
- Auth: dos usuarios; no se observaron MFA factors; eso no prueba que MFA no esté configurado o no sea exigible. Password leaked protection estaba deshabilitada.
- Storage bucket crm-client-photos privado, políticas por primer folder UUID; sin allowlist MIME/tamaño en auditoría.
- Ledger: 20261126024701, 20261126033314, 20261126035245. Rama con seis SQL, dos versiones del ledger sin archivo exacto y cinco scripts sin registro aunque efectos visibles. NO ejecutar migraciones, DDL ni insertar ledger entries hasta recuperar SQL y procedencia.
- Dos índices duplicados potenciales en crm_clients; no borrar sin revisar dependencias.
- No se hicieron cambios en DB, Auth, Storage o datos durante auditoría.

## 6. Integraciones
| Integración | Estado |
|---|---|
| Supabase CRM | Base existe y código CRM usa sesión/RLS; modelo multiárea V7 pendiente |
| Supabase finanzas/Plaid | Separado; no tocar |
| Twilio SMS | No conexión CRM verificada; sender y callbacks pendientes |
| WhatsApp Business | API/coexistencia no verificada; sin ingestión grupos |
| WhatsApp Personal/grupos | Sin API oficial de lectura de grupos; no scraping |
| ZapClaw | No verificado; token expuesto antes debe rotarse |
| Email | No conexión de la app verificada |
| Square | No conectado; Sandbox pendiente |
| Push | Rutas/código existen; entrega remota/app cerrada no verificada |
| Tax software/e-file | No integración verificada |
| OCR/doc vault | No bóveda fiscal ni OCR final verificados |

## 7. Seguridad y despliegue
- No introducir secretos de producción en Railway. Service variableNames estaba vacío en revisión.
- No usar datos reales, SSN/ITIN, W-2/1099, documentos, comunicaciones ni pagos reales.
- Aprobación humana para mensajes salientes, aceptación de ofertas y acciones de dinero.
- Railway SUCCESS. Push registration: no verificada. Notification tests: prueba local previa solamente; remote/app-closed pendientes.
- Vercel team tuvo límite diario de despliegues; no crear otro proyecto permanente.

## 8. Hito 1 — deploy y QA inicial (2026-11-27)
- Railway SUCCESS: deployment 6a948e27-3a11-4f60-97ca-918914c55056; commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e; branch feature; runtime Ready; URL temporal verificada.
- Checks: / y /copiloto-v7-preview HTTP 200; build Next compila y genera 10/10 páginas; test:crm-push PASS 4/4; TypeScript FAIL con 66 diagnósticos baseline compartidos con main.
- UI: CRM acceso directo lazy; Today/Earnings/Money/Reports/More preservados.
- Límite: screenshot/browser QA responsive e interacción visual no completados por falta de navegador. No marcar QA visual PASS.
- Push remoto/app cerrada no verificado.

## 9. Hito 2 — conciliación de migraciones (2026-11-27)
- Proyecto confirmado ACTIVE_HEALTHY: mimgwleghecseoymgdug, us-east-2, PostgreSQL 17.12. No se consultó ni modificó la base financiera zrcnpmipdhpjdjkfrrgt.
- Ledger Supabase: 20261126024701, 20261126033314, 20261126035245. Archivos exactos presentes en feature: 20261126024701 y 20261126120000, 20261126150000, 20261126170000, 20261126180000, 20261126190000. Los archivos 20261126033314_crm_reservations_owner_fk_index.sql y 20261126035245_crm_database_hardening_airport_validation.sql no existen en la rama; búsqueda de archivos/commits tampoco recuperó el original.
- Efectos visibles en DB: índice crm_reservations_client_owner_idx; índice único crm_reservations_id_user_uidx (id,user_id); CHECK crm_reservations_airport_flight_required que exige flight_number cuando pickup_kind='airport'. Los efectos concuerdan con el propósito/nombre de las dos migraciones, pero no se puede certificar que el SQL original fuera idéntico.
- Los seis scripts restantes fueron comparados con columnas/índices/constraints visibles; sus efectos están presentes. No se ejecutó DDL, no se reinsertó ledger, no se alteraron tablas/índices/policies/storage ni datos.
- Hallazgos actuales del advisor: leaked-password protection disabled (WARN); dos FKs de crm_messages sin índice covering (INFO); cuatro policies de finance_sync_doc con auth.uid() re-evaluado por fila (WARN); duplicate unique indexes crm_clients_id_user_id_key y crm_clients_id_user_uidx (WARN); dos índices sin uso. Ningún índice se borró ni optimizó durante reconciliación.
- Resultado: reconciliación de solo lectura completada; procedencia SQL histórica sigue bloqueando cualquier migración/DDL adicional. No confundir auditoría completada con schema completamente limpio.

## 10. Hito 3 — auditoría Auth/MFA/RLS (2026-11-27)
- Auth CRM: 2 usuarios, 0 factores en auth.mfa_factors, 8 sesiones activas observadas. No se consultaron correos ni datos personales. Cero factores no demuestra por sí solo configuración global, pero no hay enrolamiento MFA visible. Advisor confirma leaked-password protection DISABLED (WARN). No existe herramienta conectada para cambiar Auth settings/enforcement desde esta sesión.
- Tablas públicas CRM: crm_clients, crm_reservations, crm_messages, finance_sync_doc. Todas con RLS enabled, ninguna con FORCE ROW LEVEL SECURITY. No existen crm_memberships, organizations/business_units ni roles de negocio; el modelo actual es owner-only user_id.
- Dos principales Auth existentes probados bajo SET ROLE authenticated y JWT sub simulado, en transacciones rollback: ambos vieron solo sus filas en crm_clients, crm_reservations, crm_messages y finance_sync_doc; cross_owner_rows=0 en las cuatro tablas. Resultados visibles: A clients=5/reservations=1/messages=0/finance_sync_doc=0; B clients=2/reservations=1/messages=1/finance_sync_doc=1. Prueba de lectura aislada; no equivale a test de insert/update/delete ni a prueba HTTP/browser.
- APIs inspeccionadas: crmSupabaseServer usa publishable key y cookie session; /api/crm/state valida auth.getClaims y toma user_id de claims sub, filtra por owner; /api/crm/send solo cola y no envía; /api/crm/send/dispatch devuelve 501. No hay verificación AAL2 ni permisos Transport/Taxes por membership. proxy.ts solo refresca claims y no bloquea rutas.
- Storage: crm-client-photos es privado; políticas select/insert/update/delete restringen primer folder a auth.uid(); file_size_limit y allowed_mime_types son NULL. No hay bóveda fiscal privada separada.
- Resultado: SELECT A/B RLS PASS en 4 tablas. Etapa 3 NO CERRADA: falta MFA enrollment + enforcement, leaked-password protection, memberships y separación Transport/Taxes, FORCE RLS/negative write tests, límites MIME/tamaño y authz por unidad. No se cambiaron Auth settings, sesiones, tablas, políticas ni Storage. Continuar solo tras diseño/migración revisada y pruebas sintéticas completas.

## 11. Hito 4 — vertical Clients + Transport + Communications (2026-11-27)
- Preview UI disponible en /copiloto-v7-preview; contiene Overview, Communications, Clients, Documents, Transport, Taxes, Work Opportunities y Square. Los workspaces de preview usan estado React local; no hacen fetch, no conectan Supabase y no persisten al refrescar.
- CRMScreen existente sí implementa sign-in Supabase, lectura/sync de crm_clients, crm_reservations y crm_messages vía /api/crm/state; la API deriva user_id de auth.getClaims y filtra por dueño. Es un módulo anterior y separado del diseño preview V7.
- Railway review no tiene NEXT_PUBLIC_CRM_SUPABASE_URL ni NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY (solo variables internas Railway). Prueba HTTP GET /api/crm/state devuelve 503 crm_cloud_not_configured. POST /api/crm/send es solo outbox queued, no SMS; /api/crm/send/dispatch permanece 501.
- Resultado: demo visual/interacciones locales están presentes; vertical end-to-end persistente NO CERRADO. Bloqueado por etapa 3 (MFA/memberships/unidades de negocio) y configuración segura de Auth/entorno; no se conectó Railway a DB con MFA pendiente ni se cargaron clientes reales.
- Requisitos para cerrar: schema multi-unit revisado, test A/B read/write/delete, enrolamiento+enforcement MFA, variables public URL/key en review, test de login con cuenta sintética autorizada, CRUD de cliente/reserva/mensaje verificado contra DB, persistencia tras reload y no cross-unit leakage. SMS/WhatsApp envío real pertenece a etapa 8 y sigue desactivado.

## 12. Hito 5 — Documents vault (2026-11-27)
- UI preview muestra un registro metadata-only con datos de ejemplo y estado local; no hay carga de archivos en /copiloto-v7-preview.
- Único bucket existente: crm-client-photos, privado, owner-folder policies; file_size_limit y allowed_mime_types NULL. Código crm-photos.ts solo gestiona fotos JPEG de cliente/reserva y signed URL temporal.
- No existe bucket separado para documentos fiscales/civiles, tabla de documentos/versiones, hashes, OCR pipeline, retención, auditoría de descargas ni flujo de recuperación. No hay OCR/e-file integrado.
- Resultado: etapa 5 NO CERRADA. Requiere etapa 3 (MFA/memberships), reconciliación de esquema, bucket privado independiente, MIME/tamaño allowlist, clasificación temporal OCR vs original final, versioning/hash, audit trail, retención y test de restore en segundo dispositivo. No se subieron ni modificaron archivos.

## 13. Hito 6 — Taxes workflow (2026-11-27)
- components/copiloto-v7-preview/tax-workspace.tsx tiene lista de casos seed, filtro/búsqueda, formulario local, cambios de status y checklist en useState. No fetch, Supabase, almacenamiento ni persistencia al refrescar.
- No hay tablas tax_cases/tax_documents, bóveda fiscal, OCR, conexión con software tributario, e-file, firma, formularios reales ni workflow de revisión con auditoría.
- Separación legal/operativa Taxes (Brakha Group Tax Services) vs Transport no está implementada en memberships/RLS; no usar datos fiscales reales.
- Resultado: etapa 6 NO CERRADA. Demo UI local disponible; persistencia y seguridad bloqueadas por etapas 3 y 5. No se usaron SSN/ITIN, W-2/1099 ni documentos reales.

## 14. Hito 7 — Work Opportunities intake/evaluation (2026-11-27)
- WorkOpportunitiesWorkspace usa seed local + useState para filtros, selección, drafts y clasificación fit; aviso explícito de que no se envía respuesta ni se acepta trabajo. No fetch, webhook, DB ni persistencia.
- No existe ingestión WhatsApp conectada. WhatsApp Personal/grupos no se pueden leer por API oficial; ZapClaw Coexistence no lee grupos personales. No scraping de WhatsApp Web. Captura viable para demo: compartir/reenviar/manual capture con consentimiento y revisión humana.
- Evaluación de oportunidad todavía no está conectada a datos reales ni motor de rentabilidad; demo no verifica disponibilidad, deadhead, tolls, combustible, tiempo, fare ni margen real.
- Resultado: etapa 7 NO CERRADA. Diseño local disponible; falta intake manual seguro y almacenamiento con audit trail, clasificador y evaluación de rentabilidad con datos sintéticos, y conectores oficiales donde soportados. No se envió ni aceptó ninguna oferta.

## 15. Hito 8 — Integraciones SMS/WhatsApp/email/push (2026-11-27)
- Railway review no tiene CRM Supabase URL/key ni credenciales de Twilio/WhatsApp/email/push. /api/crm/push/config devuelve enabled=false, publicKey=null.
- POST /api/crm/send devuelve 503 crm_cloud_not_configured en preview; el código solo crea/valida outbox queued y no contacta carrier. POST /api/crm/send/dispatch devuelve 501 phone_dispatch_not_connected. No hay SMS enviado.
- WhatsApp Business API/Coexistence no verificada ni conectada. WhatsApp Personal/grupos no se pueden leer mediante API oficial; no scraping. Email no conectado. ZapClaw no verificado y token previo comprometido requiere rotación antes de cualquier uso.
- Push routes existen pero no VAPID/secret config; no hay registro remoto ni delivery test ni app-closed proof. Tests locales de validación 4/4 no demuestran envío remoto.
- Resultado: etapa 8 NO CERRADA. Falta credenciales/proveedores, webhooks autenticados, persistencia de subscriptions, consentimiento/opt-out, pruebas Sandbox/test numbers, idempotencia, logs y aprobación humana. No se enviaron mensajes ni notificaciones.

## 16. Hito 9 — Square Sandbox (2026-11-27)
- components/copiloto-v7-preview/square-workspace.tsx muestra pestañas/listados seed con estado local; no llamadas fetch, OAuth, SDK/API ni persistencia. No existen rutas Square ni env vars Square en Railway review.
- No hay conexión de cuenta Square ni Sandbox credentials/webhook verification. Plugin Directory search no devolvió conector Square disponible en esta sesión; Stripe/Shopify no sustituyen Square.
- No se creó invoice, customer, payment ni se movió dinero. No hay acción real conectada.
- Resultado: etapa 9 NO CERRADA. Diseño/demo disponible; falta Sandbox app credentials, OAuth scopes, webhook signature verification, idempotency, read-only sync inicial y pruebas de customers/invoices/payment links/compatible actions con dinero simulado. Mantener Square como sistema de registro y Copiloto como cockpit, sin inventar compatibilidad.


## 17. Hito de experiencia móvil — Copiloto Go (2026-11-27)
- Se creó la ruta aislada /copiloto-v7-go en app/copiloto-v7-go/page.tsx como prototipo mobile-first de operaciones rápidas, sin sustituir /copiloto-v7-preview ni la app Claris actual.
- Enfoque móvil: Today, Inbox, Trips, Clients y More; acceso prioritario a Quick trip entry con pickup, destination, fare y cliente opcional; mensajes agrupados por canal/área con borrador y aprobación simulada; búsqueda y alta de contactos de muestra; oportunidad de trabajo con revisión y borrador sin envío.
- En escritorio el mismo prototipo muestra panel lateral Field Workflow con la secuencia mensaje → cliente → viaje/oportunidad → aprobación → historial. Diseño negro/amarillo alineado con Claris; navegación inferior compacta en móvil.
- Todas las interacciones son React state local con datos sintéticos. La acción Save trip y Add client NO persisten en Supabase ni sobreviven reload; approve draft NO envía mensajes; no hay geolocalización/GPS real, proveedor de mensajería ni Square conectado. Etiquetas de demo visibles.
- Commit de creación: d9be60e07dd3ad649825c6c40f15c0fed1490e23. Aún no hay build/TypeScript/browser QA de este nuevo archivo ni deployment Railway confirmado. No marcar como funcionalidad de producción ni QA aprobado.
- Siguiente: revisar build y tipos, desplegar solo a Railway review si el servicio sigue vinculado a la feature branch, abrir ruta en teléfono y escritorio, probar flujo; después conectar con APIs/backend una vez cerrados bloqueos Stage 2/3 y persistencia segura. Mantener main y producción intactos.


## 18. Re-enfoque y continuidad — 2026-11-27
- Documento rector nuevo: docs/copiloto-v7-master/FOCUS-AND-EXECUTION-BASELINE.md. Consolida la misión, alcance de Transport/Taxes/Communications/Clients/Documents/Work Opportunities/Square/Agenda, decisiones, límites, estado real, bloqueos, criterios de terminado y secuencia de ejecución.
- La revisión de conversaciones y documentación confirma que el principal problema de avance es que hay prototipos visuales y auditorías, pero todavía no una vertical CRM V7 persistente de extremo a extremo. No seguir agregando pantallas ni repetir inventarios.
- Orden obligatorio: (1) terminar el deployment actual y QA desktop/iPhone; (2) resolver la procedencia de las migraciones históricas y cerrar Auth/MFA/memberships/RLS/Storage; (3) construir Clients + Transport + Communications con persistencia, permisos, auditoría y pruebas A/B; (4) Documents vault + Taxes; (5) Work Opportunities; (6) conectores SMS/WhatsApp/email/push; (7) Square Sandbox; (8) QA integral y release readiness.
- HEAD conocido al momento de crear el documento rector: f8c559ff59ba09038bdb64d966e67d42e83a61a4. La documentación de enfoque se agregó después en commits separados; confirmar el nuevo HEAD y deployment antes de continuar.
- Deployment Railway observado antes de estos commits documentales: 3accbe2e-e61c-410c-91aa-be114cf82f18, commit f8c559ff..., BUILDING. No inferir que el nuevo HEAD está desplegado. Volver a consultar estado, SHA, logs y URL.
- Push registration remoto: no verificada. Tests locales de validación push: 4/4; no prueban entrega real ni app cerrada.
- No hubo autorización para merge a main, Vercel production, uso de datos reales, mensajes reales o pagos reales. Supabase financiero/Plaid zrcnpmipdhpjdjkfrrgt permanece fuera de alcance.


## 10. Continuidad del plan maestro — 2026-11-27 14:10 ET
- Se recuperó contexto de conversaciones del 2026-11-26 y 2026-11-27 y se amplió el documento rector existente `docs/copiloto-v7-master/FOCUS-AND-EXECUTION-BASELINE.md`, sección 10 (decisiones de producto, UX desktop/móvil, Copiloto Go, flujo Clients+Transport+Communications, mensajería, Square Terminal, restricciones y orden de ejecución).
- Commit de actualización del documento maestro: `838b696c319f6b5d0367e46419c49ae3233b2f73` en `feat/copiloto-v7-phase1-foundation`.
- Esta actualización es documentación solamente: no cambia código funcional, base de datos, Railway, Vercel, producción ni servicios externos.
- Próximo foco: verificar HEAD/deployment vigente y cerrar QA responsive; después avanzar al primer flujo persistente Clients + Transport + Communications conforme al documento maestro. No repetir auditorías ya documentadas sin evidencia nueva.
- Pendiente de sincronización: reflejar esta continuidad en la sección correspondiente de `components/copiloto/how-it-works-screen.tsx` en el siguiente cambio documental coordinado.


## 11. Corte de continuidad verificado — 2026-11-27 (sesión de handoff)
- Se releyó el índice y los documentos maestros existentes. No se creó otro proyecto ni otra carpeta maestra; el punto de entrada sigue siendo `docs/copiloto-v7-master/README.md`, que dirige primero a `FOCUS-AND-EXECUTION-BASELINE.md`.
- Railway review fue consultado nuevamente: proyecto `copiloto-v7-temporal`, entorno `review`, servicio `copiloto-v7-preview`; deployment vigente `3accbe2e-e61c-410c-91aa-be114cf82f18`, estado **SUCCESS**, commit desplegado `f8c559ff59ba09038bdb64d966e67d42e83a61a4`, región `iad`, 1 réplica, sin cambios staged. La URL de deployment devuelta por Railway fue null; usar el preview conocido solo después de comprobar HTTP/rutas. Este deployment no incluye commits documentales posteriores si la rama HEAD está más adelante.
- El último commit de continuidad previamente registrado es `2ab7e662c716417e49c67d7e64ff7577e911d91b` (actualización documental de CURRENT-STATE). El deployment SUCCESS está en `f8c559f...`; por tanto existe desfase entre código desplegado y documentación posterior. Reconsultar HEAD de la rama antes de cualquier cambio o afirmación sobre el commit actual.
- No se hizo QA visual real en navegador/escritorio/iPhone en esta sesión; no declarar esa etapa aprobada. No se cambió código funcional, base de datos, Auth, Storage, integraciones, Vercel ni producción.
- Próxima acción: cerrar QA visual real de las rutas Preview y Go en escritorio/iPhone; luego continuar con recuperación de procedencia SQL de `20261126033314` y `20261126035245` y diseño MFA/memberships/RLS/Storage. No ejecutar DDL mientras falte el SQL/procedencia. Después entregar Clients + Transport + Communications persistente, con datos sintéticos.
- Restricciones intactas: feature branch solamente; no merge a `main`, no Vercel production, no datos reales, no comunicaciones/pagos reales; no tocar Supabase financiero/Plaid `zrcnpmipdhpjdjkfrrgt`.
- Esta sesión solo revisó y consolidó continuidad; no se hicieron pruebas push remotas. Push registration/delivery remota sigue **no verificada**.


## 16. Corrección de proveedor SMS — 2026-11-27
- Corrección explícita del usuario: **NO se está usando Twilio y NO debe configurarse Twilio para Copiloto V7**. El proveedor correcto que el usuario identifica es **ZapClaw** (escrito con “Claw”, no “Cloud”). Esta decisión prevalece sobre la sección histórica que proponía “Twilio primero”.
- Estado técnico confirmado en el código inspeccionado: `POST /api/crm/send` no contacta a ningún carrier y solo encola; `POST /api/crm/send/dispatch` devuelve `501 phone_dispatch_not_connected`. En Railway review, el estado documentado más reciente para `/api/crm/send` es `503 crm_cloud_not_configured`. No hay evidencia de SMS entrante/saliente operativo desde Copiloto.
- ZapClaw todavía NO está verificado ni conectado al CRM. Antes de programar el adaptador, confirmar la documentación/API/webhooks oficiales de ZapClaw, el mecanismo de autenticación, estados/callbacks, límites y compatibilidad con el número/cuenta existente. No asumir que una API de SMS existe ni que ZapClaw es intercambiable con Twilio.
- No pedir ni copiar tokens al chat. La credencial previamente expuesta se considera comprometida; rotarla desde el panel oficial del proveedor antes de cualquier uso y guardarla únicamente como secreto en el entorno autorizado, después de verificar dependencias.
- Próximo paso: investigar ZapClaw (no Twilio), mapear capacidades reales y diseñar envío/recepción, callbacks, opt-out STOP/HELP, consentimiento, idempotencia, auditoría y aprobación humana. Mantener pruebas sintéticas/sandbox; no enviar mensajes reales ni cambiar números/cuentas sin autorización expresa.
