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
