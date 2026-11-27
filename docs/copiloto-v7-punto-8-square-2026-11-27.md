# Copiloto V7 — Punto 8: Square Operations Preview
Fecha: 2026-11-27

## Alcance implementado
Se creó `components/copiloto-v7-preview/square-workspace.tsx` y se integró como sección Square en la navegación de `app/copiloto-v7-preview/page.tsx`.

La vista incluye pestañas de muestra:
- Overview y estado de preparación de integración.
- Customers, Invoices, Payments y Documents.
- Búsqueda y vista local de registros sintéticos.
- Diseño de futuro panel operativo de Copiloto con Square como sistema conectado y Copiloto como interfaz de control.

## Estado real de la integración
- Square no está conectado ni autorizado en este proyecto.
- No hay Developer App/Sandbox configurado o probado aquí.
- No se ejecuta OAuth, API de Square, webhooks, lectura ni escritura de clientes/facturas/pagos.
- No se emiten cargos, capturas, reembolsos ni notificaciones.
- Los registros de ejemplo no proceden de Square.

## Diseño de seguridad y operación
- Usar Square Sandbox primero.
- Credenciales solo del lado servidor y permisos mínimos.
- Verificar firmas de webhooks, idempotencia y auditoría.
- Clasificar cada acción futura como API compatible, handoff al dashboard externo o no soportada.
- Exigir aprobación humana para movimiento de dinero y operaciones sensibles.
- Organizar documentos mediante referencias y bóveda privada de Copiloto; no usar carpetas públicas.

## Cambios
- Commit del componente: `e216e2783f7decc70622971b404ce931bb981a6a`
- Commit de integración: `7c50dea918814ca9ff39488c4b5326a9ee80d46c`

## Verificación pendiente
No hay credenciales ni conexión Square disponibles. Build, typecheck, pruebas de Sandbox y QA visual pendientes. No se modificó Supabase.

## Estado
Diseño de demostración implementado. Integración API real, permisos, Sandbox, webhooks y pruebas transaccionales pendientes. No usar para pagos reales.
