# Copiloto V7 — Punto 1: Auditoría inicial del sistema
Fecha: 2026-11-27
Rama: `feat/copiloto-v7-phase1-foundation`
Repositorio: `transittaxmc-create/claris`

## Resultado ejecutivo
La auditoría confirma que el producto existente es una aplicación operativa real con flujos importantes que deben preservarse. La nueva experiencia V7 está aislada en una ruta de preview y todavía es principalmente demostrativa. No se debe reemplazar la ruta raíz ni activar integraciones reales hasta completar arquitectura, seguridad y pruebas.

## Estado del repositorio
- Comparación `main...feat/copiloto-v7-phase1-foundation`: 13 commits por delante, 0 por detrás en el momento de la revisión.
- Los cambios de la rama comparados con main son cinco archivos: workflow CI de preview, página `/copiloto-v7-preview`, actualización de How This Works y dos documentos de fase/preview.
- `app/page.tsx` continúa renderizando `CopilotoApp`; no fue reemplazada por el nuevo preview.
- La página V7 usa datos sintéticos y estados React locales. Las interacciones no persisten ni llaman a proveedores.

## Inventario funcional verificado por inspección de código
### Aplicación existente
- Navegación principal: TODAY/ENTRY, EARNINGS/REGISTER, MONEY/FINANCE, REPORTS; MORE incluye CRM, TAX 2026, Expenses, Credit, Summary, Dashboard, AI, Data & Backup, Envelopes, Toll Audit y How It Works.
- `CopilotoApp` integra viajes, gastos, turno/GPS, detección de peajes, escaneo de dispatch/recibos, reconciliación, backups, sincronización de datos y módulos de finanzas.
- CRM incluye clientes, reservas, mensajes, fotos y conexión opcional a Supabase CRM; el código conserva modo local si la nube no está configurada.
- Tax 2026 contiene checklist y cálculo preliminar de Schedule C; los documentos/checklist inspeccionados usan localStorage y los archivos grandes no quedan guardados íntegramente en ese almacenamiento.
- Finanzas: `finance-cloud.ts` declara explícitamente `FINANCE_CLOUD_ENABLED = false`; la sincronización de MONEY/Projections con Supabase está apagada. No prometer sincronización financiera en nube ni recuperación automática desde otro teléfono hasta reimplementar y probar un flujo seguro.

### APIs y comunicaciones
- `POST /api/crm/send` autentica sesión CRM y valida/encola un borrador; el comentario y la respuesta aclaran que NO envía SMS.
- `POST /api/crm/send/dispatch` devuelve 501 `phone_dispatch_not_connected`; no hay puente de envío conectado.
- WhatsApp, SMS productivo, ingestión automática de grupos y Square no están demostrados como conectados por esta auditoría.
- El preview V7 contiene bandejas y registros de muestra; no es un centro de comunicaciones operativo.

### Base de datos y seguridad CRM (auditoría Supabase de solo lectura)
Proyecto CRM `mimgwleghecseoymgdug`: ACTIVE_HEALTHY, región us-east-2, PostgreSQL 17.12.
Tablas públicas observadas: `crm_clients` (7 filas), `crm_reservations` (2), `crm_messages` (1), `finance_sync_doc` (1); RLS habilitado en las cuatro.
Migraciones registradas en Supabase: `20261126024701`, `20261126033314`, `20261126035245`.
Hallazgos de advisors:
- Seguridad: protección de contraseñas filtradas deshabilitada.
- Rendimiento: dos FK sin índice en crm_messages; cuatro advertencias initplan en políticas RLS de finance_sync_doc; dos índices sin uso; posible índice duplicado en crm_clients.
- Health advisor: sin hallazgos.
- Sigue pendiente reconciliar los archivos de migración del repositorio con las tres migraciones registradas. No ejecutar DDL ni migraciones hasta completar esa comparación.

## Riesgos y decisiones de protección
1. Mantener intactos los flujos existentes de viajes, peajes, ingresos, gastos, MONEY, backups, CRM y Tax 2026.
2. No mezclar el Supabase CRM `mimgwleghecseoymgdug` con el Supabase legado de finanzas `zrcnpmipdhpjdjkfrrgt`.
3. No cargar datos reales de clientes ni documentos fiscales en la ruta de preview.
4. No enviar comunicaciones, aceptar trabajos ni procesar pagos reales durante desarrollo.
5. Square debe comenzar en Sandbox; cada acción externa debe tener aprobación humana.
6. Completar MFA, controles de sesión/dispositivo, separación Transport/Taxes, políticas RLS, almacenamiento privado, auditoría y recuperación antes de producción.

## Estado de verificación
- Inspección de código fuente: realizada para rutas raíz, shell, navegación, CRM, Tax 2026, sincronización financiera, preview y endpoints SMS descritos arriba.
- Estado de base de datos/advisors: inspección de solo lectura completada.
- Build de Next.js, ejecución CI, pruebas de navegador, pruebas iPhone/desktop y pruebas de integración: NO verificados en esta auditoría.
- Vercel Preview: el intento anterior fue bloqueado por límite diario HTTP 402; no existe URL de Preview confirmada para esta rama.
- Producción: no se modificó.
- Base de datos: no se modificó.

## Criterio para cerrar el Punto 1
Esta entrega es la auditoría inicial documentada y establece el mapa de riesgos. La auditoría exhaustiva de cada ruta/API/migración, junto con revisión de secretos/configuración sin exponer valores, continúa como parte del trabajo técnico antes de cerrar definitivamente la etapa de auditoría y pasar a cambios estructurales.
