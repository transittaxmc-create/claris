# Copiloto V7 — estado técnico verificado

**Corte:** 2026-11-27  
**Rama:** feat/copiloto-v7-phase1-foundation  
**Nota:** estado de demo/preview no equivale a CRM productivo.

## 1. GitHub y despliegue
- Repo transittaxmc-create/claris; default branch main; visibilidad actual PUBLIC.
- Feature branch feat/copiloto-v7-phase1-foundation.
- Railway project copiloto-v7-temporal ID a27e9703-8ee8-4650-ac57-c966a7301ca1; environment review ID 6b472376-3905-42d1-9e5b-58321f8caf12; service copiloto-v7-preview ID cd3e119a-0a24-4412-adc0-a0ae56f1e893.
- Deployment V7 inicial 6c2ac0c8-725b-489c-ae86-a654bea2c3fd, SUCCESS, commit faf2350ffcc3e4e5166fa4f64d1d12671d09924a, región iad. Tras añadir el acceso directo CRM/lazy loading se disparó un deployment nuevo 6a948e27-3a11-4f60-97ca-918914c55056, commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e, rama feature; último estado consultado BUILDING, sin URL ni región confirmada. El build local de ese código ya pasó.
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
