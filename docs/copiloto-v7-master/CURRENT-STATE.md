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


## 17. Alcance real de ZapClaw y SMS — verificado 2026-11-27
- Documentación oficial de ZapClaw (`https://zapclaw.app/docs.html`, última actualización indicada 2026-11-12) describe una pasarela de **WhatsApp Business** basada en la API oficial de Meta: REST API para enviar mensajes WhatsApp, webhooks para mensajes entrantes y estados, y soporte de coexistencia. La documentación consultada NO presenta ZapClaw como proveedor de SMS telefónico tradicional.
- Decisión de proveedor: **no usar Twilio**. ZapClaw se considera el candidato/proveedor para **WhatsApp Business**, sujeto a validar la cuenta y configuración existentes. **Proveedor de SMS tradicional: todavía no identificado ni aprobado**; no seleccionar ni integrar uno sin confirmación del usuario.
- No confundir los canales en UI, backend, estados ni documentación. WhatsApp y SMS tendrán adaptadores, consentimientos, registros y estados separados, aunque se presenten en una bandeja común.
- ZapClaw no está conectado al CRM todavía. Su integración futura requiere validar API key, firma del webhook, eventos, idempotencia, límites, coexistencia y números permitidos. Nunca copiar secretos al chat.
- Próximo paso para cerrar mensajería: terminar el adaptador ZapClaw para WhatsApp en pruebas sintéticas cuando seguridad lo permita; para SMS, identificar el servicio realmente usado por el usuario. No enviar comunicaciones reales ni cambiar números/cuentas sin autorización expresa.

 
## 18. Prueba SMS real confirmada por el usuario — 2026-11-27
- El usuario confirmó que la prueba de Muse **sí transmitió un SMS real**: el mensaje llegó a su segundo teléfono/dispositivo. Esto descarta que aquella prueba fuera únicamente un cambio visual de estado dentro del CRM.
- La evidencia de código/documentación del commit `daa6b5788545ce83561eeb6c9c93f08b63f20b27` identifica el mecanismo previsto como **Amani en el Samsung S26 Ultra pareado**, con permiso SMS y reenvío activados. Amani es el puente telefónico documentado; no se debe confundir con ZapClaw ni describirlo como proveedor SMS API sin más evidencia.
- Inspección del diff del commit: se añadieron `/api/crm/send` (valida y devuelve `queued=true`, sin contactar al carrier) y `/api/crm/send/dispatch` (registra el resultado reportado por el teléfono). El repositorio no contiene el cliente/app Android de Amani ni el componente externo que consume la cola y ejecuta el SMS. La prueba real confirma que el flujo externo funcionó en aquel momento, pero no identifica por sí sola versión/configuración actual del puente.
- Estado actual: en `main`, `/api/crm/send/dispatch` está deliberadamente deshabilitado y devuelve `501 phone_dispatch_not_connected`; `/api/crm/send` solo encola. No asumir que la prueba histórica sigue operativa en la versión actual.
- Próximo paso de auditoría: recuperar/verificar la configuración del Amani instalado en el Samsung pareado y cómo consume la cola CRM (permisos, URL/endpoint, autenticación, polling/trigger, callback y logs). No solicitar secretos por chat, no reinstalar ni cambiar el número, y no enviar pruebas a clientes. La confirmación histórica del usuario no autoriza comunicaciones reales durante el desarrollo.
- Canales separados: ZapClaw continúa como candidato WhatsApp Business según su documentación oficial; Amani/puente telefónico es la pista SMS confirmada por la prueba. No usar Twilio.


## 19. Auditoría de Gemini y coordinación Muse/Amani — 2026-11-27
- Rama revisada: `feat/copiloto-v7-phase1-foundation`, HEAD `32e68229db8183700c463a8032acac85e282e62a`. Railway `copiloto-v7-preview` en `review`: deployment SUCCESS `3accbe2e-e61c-410c-91aa-be114cf82f18`, pero corresponde al commit anterior `f8c559ff59ba09038bdb64d966e67d42e83a61a4`; el HEAD actual aún no está demostrado como desplegado. Dominio de preview configurado: `copiloto-v7-preview-review.up.railway.app`.
- Gemini existente: `components/copiloto/ai-screen.tsx` llama a `POST /api/ai-chat`; `app/api/ai-chat/route.ts` construye un prompt amplio de finanzas/Claris y llama directamente a Google Gemini. No hay evidencia de que este asistente esté conectado al workspace CRM V7.
- Hallazgo de credenciales que requiere corrección antes de reutilizar: el endpoint usa `GEMINI_API_KEY || OPENAI_API_KEY`, pero la solicitud se envía a Google Gemini con el header `x-goog-api-key`. No usar una clave OpenAI como fallback de Gemini; separar y validar proveedores/credenciales por servidor.
- V7 preview: `app/copiloto-v7-preview/page.tsx` contiene datos de demostración y no muestra integración de Gemini/Muse/Amani. No tratar los datos de ejemplo como clientes o actividad real.
- SMS: `POST /api/crm/send` valida y encola; no transmite. `POST /api/crm/send/dispatch` devuelve 501 `phone_dispatch_not_connected`. El commit histórico `daa6b5788545ce83561eeb6c9c93f08b63f20b27` y la sección 24 de How This Works identifican el puente externo Amani en el Samsung pareado, pero su consumidor/cliente y configuración no están en el repositorio. La prueba real histórica fue confirmada por el usuario; no demuestra estado operativo actual.
- Separación de responsabilidades propuesta para implementación: Gemini = interfaz conversacional y razonamiento con contexto mínimo autorizado; Muse = coordinador externo si su API/canal autorizado se confirma; Amani = agente/puente móvil para la acción SMS y su confirmación. No asumir endpoint, token, webhook o protocolo de Muse/Amani hasta obtener evidencia del sistema real.
- Próximo orden: (1) auditar el contrato de integración disponible de Muse y Amani sin pedir secretos; (2) definir instrucciones base compartidas y perfiles por módulo Transport/Taxes, permisos y límites; (3) conectar Gemini a V7 con API server-side, herramientas explícitas y aprobación humana por acción; (4) recuperar el puente Amani con autenticación, firma/nonce, idempotencia, estados queued/sending/sent/failed y confirmación del teléfono; (5) pruebas sintéticas y negativas. No permitir a Gemini o Muse saltarse MFA, RLS, aislamiento Transport/Taxes ni aprobación humana.
- Límites vigentes: sin datos reales de clientes, SMS/WhatsApp/email reales, pagos reales, cambios de número/proveedor/permisos/credenciales, DDL/migraciones, merge a main o despliegue de producción. No sustituir el canal SMS por Twilio. No revelar secretos ni copiar tokens al chat.


## Continuity checkpoint — 2026-11-27 15:57 America/New_York
- User resumed the investigation that was interrupted during the previous chat: the coordination and communication flow among Copiloto V7, Muse, Gemini and Amani, including SMS and WhatsApp. Do not restart the broader project inventory or ask the user to repeat decisions already documented.
- Re-read the current branch's master continuity documents and `components/copiloto/how-it-works-screen.tsx`. The existing Gemini/Muse/Amani investigation is already documented; this checkpoint records the exact resume point rather than claiming new integration work.
- Confirmed from repository code/docs: Gemini's existing `/api/ai-chat` belongs to the legacy Finance Copilot and is not integrated into the V7 CRM preview. The route uses `GEMINI_API_KEY || OPENAI_API_KEY` while calling Google's Gemini endpoint; do not allow an OpenAI key as a Gemini credential.
- Confirmed from prior user-reported test and commit history: Muse previously caused a real SMS to reach the user's second device through the paired Samsung/Amani bridge. The repository contains the cloud queue and result callback, not the Android Amani agent or its external queue consumer. Current CRM dispatch remains `501 phone_dispatch_not_connected`; historical success does not prove current connectivity.
- Channel decision remains: no Twilio. Keep SMS/Amani separate from WhatsApp Business/ZapClaw. ZapClaw is a WhatsApp Business candidate, not a traditional SMS provider; no number/account migration or real message sending.
- Exact next investigation: recover the authorized Muse↔Amani interface and the paired phone's queue trigger/polling, authentication, callback and logs; in parallel, specify Gemini's server-side role and allowlisted tools. Then define shared instructions and separate Transport/Taxes/Communications permissions, human approvals, audit and idempotency. No secrets in chat, no live customer data/messages, no provider/number changes, no DDL, no merge to main or production deployment.
- This is a documentation checkpoint only. No application code, credentials, phone settings, providers, database or deployment were changed in this checkpoint.


## 20. Agent coordination and Gemini instruction redesign — 2026-11-27
- User clarified the intended work: determine how ChatGPT/Muse can exchange authorized context about Copiloto's actual state, and restructure Gemini's instructions so it can assist across Copiloto V7 rather than only the legacy finance/driver workflow.
- Repository review confirms the existing Gemini route and prompt are legacy Finance Copilot-specific; the V7 preview is not yet connected. The route's OpenAI-key fallback to a Google Gemini endpoint is a credential-selection defect to fix before reuse.
- Created design proposal: docs/copiloto-v7-master/AGENT-INSTRUCTION-ARCHITECTURE.md. It defines Copiloto as source of truth, a scoped context/tool service, Muse as a coordinator only after its real interface is verified, Gemini as the in-app reasoning assistant, and Amani as a separate phone-side SMS executor only after recovery. SMS/Amani and WhatsApp/ZapClaw remain separate.
- Gemini's new instructions are proposed as layered, versioned policy + Copiloto mission + shared principles + authorized module profile + minimal task context + tool contracts + response contract. Do not overwrite the legacy Finance prompt until the V7 profile and regression strategy are reviewed.
- This is design/documentation only. No app code, credentials, phone settings, providers, database schema, real communications or deployment were changed.
- Next: identify Muse's actual authorized integration surface; recover Amani's paired-phone queue consumer/auth/callback; map V7 module permissions and RLS to scoped context/tools; then implement the versioned prompt builder and Gemini adapter in the development branch with synthetic security tests.


## 21. User clarification — Muse authorization and Amani ownership — 2026-11-27
- User clarified Muse is already fully authorized in their environment for GitHub, Vercel, WhatsApp and phone/SMS; Amani is part of Muse, not a separate SMS provider. The earlier real SMS path was Muse/Amani consuming the Copiloto message outbox/queue and using the paired phone to send to the user's second device/number.
- Correct distinction: the user's Muse authorization is confirmed by the user; this ChatGPT session does not currently expose a direct Muse/Amani connector/tool. This is a technical visibility/interface gap for our session, not a request for the user to re-authorize Muse.
- A Vercel Agent Runs discovery for the connected island-city team returned no eve-framework agent projects in the last 30 days. This checks only Vercel eve observability and is not evidence that Muse is disconnected or inactive.
- Next: inspect existing repo history/config and the precise outbox-to-Amani handoff; identify Muse's supported API/MCP/webhook/repository interface; then provide Muse a scoped Copiloto project/context brief and design the reciprocal handoff. Do not ask for reauthorization or credentials; do not change the phone, number, providers or send live messages.


## 22. GitHub issue #85 — exact SMS bridge audit boundary — 2026-11-27
- Located the existing open issue #85: https://github.com/transittaxmc-create/claris/issues/85. It is the canonical task for recovering Copiloto/Claris ↔ Muse/Amani SMS coordination.
- Its audit comment confirms historical commit `daa6b578...` contains the queue and a callback, but no Amani worker/client, Muse connection, polling trigger, device authentication or webhook. The callback used a normal CRM session and is unsafe to reactivate without authenticated device/service proof.
- User-confirmed historical SMS success means Muse/Amani ran externally or was configured outside this repo; it does not prove current runtime connectivity. Current code still queues only and dispatch returns 501.
- Issue #85 is a tracking record, not a notification to Muse. GitHub can become a shared handoff channel only if Muse is configured to monitor/respond to the issue or repository. Do not claim direct agent contact until a response is observed.


## 23. Agent Gateway — first code slice (2026-11-27)
- Miguel redirected immediate priority to the Agent Gateway to prevent continuity loss between fresh ChatGPT/Muse conversations.
- Added docs/copiloto-v7-master/AGENT-GATEWAY.md, typed contracts/validation/store interface, a read-only continuity API and a fail-closed event-write API.
- Added CONTINUITY-REGISTER.json as a repository seed; it is explicitly repository-seed-only, not a dynamic event store.
- CRM Supabase schema inspected read-only: public tables are crm_clients, crm_reservations, crm_messages and finance_sync_doc; no agent identity/task/event tables exist. No SQL/DDL/migration was run.
- Event store and agent identities are not active. The write route returns 503 until schema and auth model are approved and implemented.
- SMS/Amani and WhatsApp/ZapClaw remain separate, unverified channels. No messages were sent.
- Existing Railway review deployment before this change: SUCCESS on service copiloto-v7-preview, commit f8c559ff59ba09038bdb64d966e67d42e83a61a4. Gateway code commit c047840932e532a59dae500533cbb27bcc5ba195 deployed successfully to Railway review (deployment 5210f13e-8b62-44e7-8cf6-ffebbdcfd37f).
- Verified in Railway build commit c047840932e532a59dae500533cbb27bcc5ba195: existing CRM push tests 4/4 passed; Agent Gateway tests 6/6 passed; Next.js production build compiled; Railway review deployment SUCCESS; GET /api/agent-gateway/continuity returned HTTP 200 and the read-only document package. The Next.js build configuration skips TypeScript type validation, so a separate tsc check remains pending.
- No production deployment, main merge, environment-variable changes, database changes or external provider actions.


## 24. Agent Gateway — persistent development backend (2026-11-27)
- CRM Supabase project mimgwleghecseoymgdug is ACTIVE_HEALTHY (Postgres 17); legacy Finance project zrcnpmipdhpjdjkfrrgt was not touched.
- Applied migrations: 20261127224018_copiloto_v7_agent_gateway_core and 20261127224752_copiloto_v7_agent_gateway_recovery_state.
- Created six RLS-enabled coordination tables: agent_identities, agent_tasks, agent_events, agent_messages, agent_approvals, agent_channel_states; plus agent_project_state and view agent_latest_checkpoints.
- Browser roles anon and authenticated have no SELECT privilege on the event store; service_role does. RLS is enabled and no browser policies exist by design.
- ChatGPT and Muse have independent machine identities with 256-bit keys; only SHA-256 hashes are stored. Each has 10 scopes and explicit domain scopes. These are machine credentials, not human Supabase Auth accounts. Raw keys are issued once and must be stored in the respective agent secret store.
- Supabase Edge Function agent-gateway ACTIVE, version 3, custom x-agent-key authentication; no key returns HTTP 401. Operations include continuity/status/tasks/inbox, event append, task create/claim/heartbeat/complete, internal message send/ack, and approval request.
- Task claim and heartbeat are atomic Postgres RPC operations. Event rows are append-only. Checkpoints are projected from agent.checkpoint.recorded events. Idempotency keys are enforced for event/task/message creation.
- Synthetic DB assertions passed for claim, heartbeat, completion, event persistence/immutability and internal message acknowledgement. One synthetic completed task, two events and one acknowledged message remain as test fixtures; no client data or external messages.
- SMS/Amani and WhatsApp/ZapClaw remain independent not_connected / unknown states. Agent self-attestation of provider delivery is blocked.
- Added authenticated Railway proxy routes /api/agent-gateway/bridge and /api/agent-gateway/recovery; Railway review variable CRM_AGENT_GATEWAY_URL points to the Supabase Edge Function. Deployment/build verification is pending.
- Not yet verified: successful HTTP request using each real agent key, end-to-end cold-start recovery from a fresh ChatGPT conversation, direct Muse runtime connection, human approval UI, provider callbacks, rate limiting, and independent tsc --noEmit.
- No production deployment, main merge, real communications, payment actions, or financial database changes.


## 25. Verificación de build y conexión de agentes — 2026-11-27
- Railway review source branch se corrigió para apuntar a feat/copiloto-v7-phase1-foundation, no a main. Deployment de commit b0c18a47c1f26fd89789de597205c15a6d45fa97 alcanzó SUCCESS; luego se preparó el commit e69c1e509e0d907db1c1cc60420b486ec6d61a89 con proxy bearer corregido.
- Se intentó añadir tsc --noEmit al build. Falló por numerosos errores preexistentes en módulos Claris de finanzas/driver (Trip, Reconciliation, Expense, MileageDay, platform metadata) y por imports .ts en tests. Se retiró del build obligatorio; el script typecheck queda disponible para una reparación separada. No se ocultó ni se atribuyó falsamente al Gateway.
- El build de review con el script de typecheck falló; se revirtió el gate para restaurar el build normal con las suites CRM push y Agent Gateway y Next.js. El deployment del commit más reciente queda pendiente de verificación.
- OpenAPI de Agent Gateway se añadió para facilitar configuración de ChatGPT Actions/custom connector; el conector no se instala automáticamente desde esta sesión.
- Autenticación HTTP válida con ambos agentes sigue pendiente de verificación desde los runtimes seguros. No afirmar que ChatGPT/Muse ya han ejecutado el handshake real.


## 26. Vault credentials and Railway review deployment — 2026-11-27
- ChatGPT and Muse agent keys were rotated and stored in Supabase Vault as copiloto_v7_chatgpt_agent_key and copiloto_v7_muse_agent_key. The database stores only SHA-256 hashes. A database-side comparison confirmed each Vault secret hashes to the active identity's key_hash; raw values were not returned or committed.
- The API documentation now provides SQL retrieval snippets for the owner to copy each value directly into its own runtime secret store. Do not paste either key into chat, GitHub or issues.
- Railway review deployment 75cdda75-8cca-4d65-94bf-9447ac4967a8 is SUCCESS on commit 6b40691ded792c16a5f4320ceedff368aae0e62d. GET /api/agent-gateway/recovery and GET /api/agent-gateway/bridge?op=status both returned HTTP 401 without a key, confirming the proxy routes are live and protected.
- Supabase Edge Function agent-gateway v4 is ACTIVE. Its no-key request returns HTTP 401. The endpoint rejects untrusted actor identity fields and agent self-attestation of provider channel delivery.
- Successful authenticated HTTP calls from the ChatGPT and Muse runtimes remain pending because the credentials must be installed directly into their separate secure runtime settings. Fresh ChatGPT conversation recovery also requires a supported custom Action/connector to be configured.


## 19. Agent Gateway — Railway Review y smoke test HTTP (2026-11-27)
- Verificación Railway posterior a la implementación: entorno review, servicio copiloto-v7-preview en estado live, sin staged changes. Deployment vigente 75cdda75-8cca-4d65-94bf-9447ac4967a8, SUCCESS, commit 6b40691ded792c16a5f4320ceedff368aae0e62d, rama feat/copiloto-v7-phase1-foundation, región iad; dominio https://copiloto-v7-preview-review.up.railway.app.
- Smoke test HTTP desde navegador externo: GET /api/agent-gateway/recovery sin credencial => HTTP 401 JSON agent_authentication_required; GET /api/agent-gateway/bridge?op=status sin credencial => HTTP 401 JSON agent_authentication_required. Esto verifica que ambas rutas están desplegadas y no permiten acceso anónimo; NO verifica autenticación válida ni lectura de continuidad.
- GitHub confirma que AGENT-GATEWAY.md, AGENT-GATEWAY-API.md, AGENT-RECOVERY-PROMPT.md, CURRENT-STATE.md, AGENT-HANDOFF.md, README.md y CONTINUITY-REGISTER.json existen en esta rama. La documentación anterior tenía un deployment y un source commit obsoletos; este hito los corrige.
- Pendiente bloqueante del Gateway: ejecutar GET continuity/status autenticado con las claves individuales sin exponerlas, demostrar ChatGPT→Gateway y Muse→Gateway, completar message.send + inbox + ACK HTTP entre ambos runtimes y probar recuperación real desde una conversación nueva. No se ha demostrado conexión automática del runtime ChatGPT ni de Muse.
- Pendiente técnico general: typecheck independiente, visual QA responsive, auditoría de seguridad restante y cierre de etapas de producto. SMS/Amani y WhatsApp/ZapClaw siguen estados independientes not_connected/unknown. Sin envío externo.
- Alcance del deploy: Railway Review únicamente. No merge a main, no Vercel production, no clientes/datos reales, mensajes reales ni pagos.


## 27. Final review verification — 2026-11-27
- Final Railway review deployment: SUCCESS, deployment d80b2339-c9eb-4ffd-9c13-01591d46135b, source commit 39e669992b1df9a11b258bf1cf7870eb233512bd.
- Live public GET /api/agent-gateway/continuity returned HTTP 200 and correctly reports access=public-documentation-only, eventStore=private-supabase-agent-gateway, writeOperations=authenticated-only, plus the Edge Function base URL. It returns versioned docs only, not private task/event data.
- Live GET /api/agent-gateway/recovery without a key returned HTTP 401 agent_authentication_required. Direct Supabase Edge Function GET without a key returned HTTP 401 agent_authentication_failed.
- Vault secret/hash checks passed for both ChatGPT and Muse; raw keys remain in Vault only. Retrieve them directly into their respective runtime secret stores as documented.
- Remaining external acceptance gates: authenticated request from ChatGPT and Muse, reciprocal message ACK, fresh-chat ChatGPT Action/connector setup, Muse runtime configuration. These require the two agent runtimes to load their separate Vault secrets; not claimed complete.
- No production deployment, main merge, real customer data, external communications or payment action.


## 20. Agent Gateway — source recovery from live Supabase (2026-11-27)
- Supabase CRM project mimgwleghecseoymgdug: agent-gateway Edge Function ACTIVE version 4. Source recovered from deployed function API; exact source will be versioned at supabase/functions/agent-gateway/index.ts. No environment secret values are part of the file.
- Live catalog confirms seven persistent gateway tables (agent_identities, agent_tasks, agent_events, agent_messages, agent_approvals, agent_channel_states, agent_project_state), RLS enabled on all seven, no row policies, and grants limited to postgres/service_role; view agent_latest_checkpoints exists. RPCs agent_claim_task and agent_heartbeat_task recovered from pg_get_functiondef. The SQL files are catalog-reconstructed baselines, not the original migration authoring text, and were NOT applied in this operation.
- Railway Review deployment 423f5d02 SUCCESS on 9867adf543e07b7624d2d1b5c378e8b3c65edfb3. GET /api/agent-gateway/continuity => HTTP 200, eventStore=private-supabase-agent-gateway, writeOperations=authenticated-only. GET recovery and bridge without credentials => HTTP 401.
- Authentication still follows deployed x-agent-key/hash code. This is not the dedicated Supabase Auth/JWT architecture described in Issue #87; keep the mismatch explicit and do not silently redesign. Credential rotation remains blocked until a secure handoff channel is designated and both runtimes can store secrets.
- Standalone tsc remains pending. Railway build log explicitly says "Skipping validation of types"; no new error count is asserted.


## 21. Independent TypeScript check — exact result on commit 7ae8ae5 (2026-11-27)
- GitHub Actions run 46081202819, workflow `Copiloto V7 preview branch build`, commit `7ae8ae5906d8dd9b5d8e0d153cccaf15d27bf0b6`, completed FAILURE at TypeScript check.
- Exact command: `pnpm exec tsc --noEmit`; environment from workflow: Node 24, pnpm 12.3.4, TypeScript 5.7.3; dependencies installed using `pnpm install --frozen-lockfile`.
- Exact diagnostics: 76 TypeScript errors, process exit code 2. Of these, 69 match the prior check on commit 9867adf; 7 additional diagnostics are from the recovered Deno Edge Function source being included by the root tsconfig (Deno global/npm: specifier plus inferred any). This makes the current count 76; it does not resolve the historical 65/66 divergence.
- Categories among the 69 existing application/test diagnostics: AI chat input type; ScheduledEntry/ExpenseUpdate/BackupInput model mismatches; missing ScheduleOverride/newBillPayment/backupFileName; Trip pickup/dropoff/notes shape mismatches; MileageDay required fields; Platform metadata keys; Reconciliation field shape; report data contract; test .ts extension settings and test constructor signature. Exact source diagnostics are preserved in workflow run 46081202819 logs.
- No TypeScript fixes were made in this checkpoint; no errors are hidden or waived. Next: decide whether Deno functions get a separate Deno check and exclude that folder from app tsconfig, then resolve the existing 69 app/test errors in a controlled batch.


## 22. Current HEAD typecheck re-run — 2026-11-27
- Exact branch HEAD under test: `32c379124708a67278c565b37cd05c4deadf7aa5` (`chore(copiloto): recover and version deployed agent gateway source` + follow-up schema/documentation checkpoint in this branch lineage).
- GitHub Actions run `46081404731` completed FAILURE at step `TypeScript check`.
- Command: `pnpm exec tsc --noEmit`; Node 24; pnpm 12.3.4; TypeScript 5.7.3; install `pnpm install --frozen-lockfile`; process exit code 2.
- Exact diagnostic count: **76**. Same count as prior run 46081202819 on 7ae8ae5. 69 diagnostics are the existing app/test errors; 7 are Deno Edge Function errors caused by the root tsconfig including `supabase/functions/agent-gateway/index.ts` (Deno global and npm: import typing/inferred any). No diagnostics were suppressed. Historical 65/66 discrepancy remains unresolved.
- The core migration reconstruction now includes the `agent_events_reject_mutation()` trigger function and `agent_events_no_update` trigger recovered from live catalog.


## 23. Typecheck verification on source HEAD 32e5a450 (2026-11-27)
- GitHub Actions run 46081558172 checked exact source HEAD `32e5a4509de088c473a1fc3124f0737f96a6d5db` after the master docs checkpoint.
- Command `pnpm exec tsc --noEmit`; Node `v24.22.3`; pnpm `12.3.4`; TypeScript `5.7.3`; exit code 2; exactly **76** diagnostics.
- 69 application/test diagnostics remain from the earlier set; 7 additional diagnostics are Deno runtime/type-resolution issues because the root tsconfig includes `supabase/functions/agent-gateway/index.ts`. The historic 65/66 divergence is not resolved. This is the latest exact source-tree check; subsequent changes in this record are documentation-only.


## 25. Amani Secure Vault card and ChatGPT runtime gate — 2026-11-27
- Issue #87 comment #14 confirms the Amani Secure Vault intake card already exists under connector `custom.copiloto-agent-gateway`, for identity `claude/amani` and header `x-agent-key`. Do not create another channel. Miguel will retrieve `copiloto_v7_muse_agent_key` directly from the CRM Supabase Vault using the query in `AGENT-GATEWAY-API.md`, then deposit it directly into that existing card. No secret was retrieved, copied, or displayed in this session.
- No credential was re-issued. Do not extract secret values into chat, logs, repository, or documents.
- ChatGPT runtime is BLOCKED: this conversation runtime has no supported persistent secret store or mechanism to inject a private `x-agent-key` header into subsequent/fresh conversations. Do not claim the ChatGPT key is configured. A supported ChatGPT connector/runtime credential path is still required.
- Authentication architecture remains Miguel's decision. The deployed machine-key + SHA-256 implementation is not silently converted to or declared equivalent to Supabase Auth + JWT. No auth rebuild is authorized here.
- No production, main merge, DDL, real messages, SMS, WhatsApp, or payments.

## 28. OpenAI Coordinator — Phase 2 bridge service (2026-11-27)
- Built `services/openai-coordinator/`: a standalone Node/TypeScript backend service (its own package.json and tsconfig; the root tsconfig now excludes `services/` so the app typecheck file set is unchanged) that gives the OpenAI side a safe runtime against the Agent Gateway, because the ChatGPT conversation runtime cannot store a private key or inject the `x-agent-key` header.
- Design: env-only secrets (fail closed, values never logged); a gateway client mirroring the deployed contract with idempotent writes and retries only on network/5xx; an OpenAI **Responses API** client whose only tools are gateway operations, with a bounded tool loop; a poll loop that processes inbox instructions, acknowledges them, appends checkpoint events, and registers Muse's responses to Coordinator-created tasks from continuity events. A remote MCP face is planned over the same client and is **not** implemented.
- Synthetic acceptance harness (mock gateway + mock OpenAI on localhost, real compiled service): **14/14 assertions passed**, demonstrating authentication, gateway communication, task creation for Muse, Muse claim + response, response registration, ordered event persistence, unauthorized rejection (401) and error/disconnect logging with retry. Synthetic data only; no live keys.
- **Live E2E is NOT demonstrated.** It remains blocked on two secrets Miguel must configure: (1) the OpenAI API key deposit (Secure Vault card already created by Amani), and (2) creation of the Coordinator's OWN gateway identity in `agent_identities` plus its key in Supabase Vault and deposit into the service secret store. The Coordinator never reuses the `chatgpt` key; that identity and its defective deposit are untouched, and the Phase-1 Muse → ChatGPT message ACK remains a separate open item.
- No Supabase changes, no migrations, no merge to main, no production deploy, no real client data, no SMS/WhatsApp/payments. Full record: docs/copiloto-v7-master/OPENAI-COORDINATOR.md; manual §42.
