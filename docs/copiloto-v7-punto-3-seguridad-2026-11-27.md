# Copiloto V7 — Punto 3: auditoría de base de datos y seguridad

Fecha: 2026-11-27  
Proyecto Supabase: `mimgwleghecseoymgdug` (CRM; no confundir con el proyecto financiero legado `zrcnpmipdhpjdjkfrrgt`).  
Rama: `feat/copiloto-v7-phase1-foundation`

## Resultado ejecutivo

La auditoría de solo lectura confirma una base inicial funcional, pero **el punto 3 no está cerrado ni listo para clientes reales**. Se verificaron tablas, políticas RLS, bucket de fotos y alertas de seguridad. No se aplicó DDL, no se modificaron usuarios ni ajustes de Auth y no se cambiaron permisos de producción.

## Evidencia verificada

- Proyecto ACTIVE_HEALTHY, región us-east-2, PostgreSQL 17.12.
- Tablas públicas actuales: `crm_clients` (7 filas), `crm_reservations` (2), `crm_messages` (1) y `finance_sync_doc` (1). No son todavía el modelo completo de Transport, Taxes, Work Opportunities, Communications, Square y Documents.
- RLS está habilitado en las cuatro tablas públicas. Las políticas SELECT/INSERT/UPDATE/DELETE existentes limitan CRM por `auth.uid() = user_id`; `finance_sync_doc` usa `owner_id = auth.uid()`. Las relaciones compuestas de mensajes/reservas con cliente y reserva incluyen el propietario, lo que evita enlazar registros ajenos.
- El bucket `crm-client-photos` existe y es privado. Sus cuatro políticas Storage limitan lectura/escritura/actualización/borrado al usuario autenticado cuya UUID ocupa el primer segmento de la ruta.
- El bucket no tiene límite de tamaño ni lista de MIME permitidos configurados. La ruta de fotos debe validar tipo/tamaño también en servidor antes de aceptarse como almacenamiento documental general.
- En Auth se contaron dos usuarios y cero factores MFA verificados o pendientes. Esto no demuestra que el requisito MFA esté configurado ni que se exija en la aplicación; la configuración de proveedores y enforcement no es visible por las herramientas disponibles en esta sesión.
- Security Advisor: `auth_leaked_password_protection` — protección contra contraseñas filtradas desactivada.
- Performance Advisor: dos claves foráneas de `crm_messages` sin índice de cobertura y cuatro avisos de initplan RLS en `finance_sync_doc`; revisar también los avisos adicionales del advisor antes de una corrección de rendimiento.
- Health Advisor: sin hallazgos.
- `proxy.ts` refresca claims/cookies cuando están configuradas las variables públicas CRM, pero si faltan continúa sin bloquear rutas. Por tanto, no es una barrera de autorización por sí sola; cada endpoint privado debe validar sesión y autorización.
- La búsqueda de código encontró uso de `SUPABASE_SERVICE_ROLE_KEY` en rutas del sistema financiero heredado. Esta auditoría no verificó valores de secretos ni confirmó la configuración de variables del entorno desplegado. La clave service-role nunca debe llegar al navegador ni ser usada como sustituto de RLS para endpoints de usuario.

## Bloqueo de migraciones — no aplicar todavía

La rama contiene seis archivos SQL. Supabase registra tres versiones aplicadas. Solo coincide el archivo `20261126024701_crm_auth_clients_reservations_rls`; las versiones aplicadas `20261126033314_crm_reservations_owner_fk_index` y `20261126035245_crm_database_hardening_airport_validation` no están presentes en el directorio de migraciones de esta rama. Los otros cinco archivos de la rama no aparecen como aplicados en el historial de Supabase.

Esta diferencia debe reconciliarse con el historial completo de Git y el SQL real de producción antes de preparar una migración correctiva. No ejecutar en bloque ni marcar versiones como aplicadas sin comprobar su contenido y efectos.

## Brechas para cerrar

1. Reconciliar migraciones y establecer un historial único verificable.
2. Confirmar Auth: confirmación de email, política de contraseñas, protección contra contraseñas filtradas, MFA TOTP/passkeys, recuperación y duración/revocación de sesiones.
3. Diseñar aislamiento de datos por unidad de negocio: `transport`, `taxes` y `work_opportunities`; el esquema actual solo demuestra separación por propietario, no por área.
4. Crear un modelo de autorización para roles, membresías y permisos por unidad; nunca confiar en `user_metadata` editable para autorizar.
5. Diseñar el vault privado de documentos fiscales y de transporte separado del bucket actual de fotos; incluir rutas por unidad/cliente/expediente, MIME/tamaño, versiones, URLs firmadas breves, retención y auditoría.
6. Verificar que secretos service-role solo existan en servidor; revisar endpoints y políticas de autorización.
7. Definir y probar backups, recuperación y revocación de dispositivos/sesiones.
8. Añadir pruebas automatizadas negativas: usuario A no puede leer, cambiar, borrar ni enlazar filas/archivos del usuario B o de otra unidad.

## Próximos pasos seguros

- Comparar las seis migraciones de la rama, el historial aplicado y el esquema real; recuperar los dos SQL aplicados ausentes desde el historial de Git o una fuente verificable.
- Preparar migraciones revisables en la rama, sin aplicarlas a producción hasta resolver el drift.
- Preparar cambios de código para MFA y autorización por unidad; probar con usuarios y documentos sintéticos.
- Activar y verificar la protección de contraseñas filtradas y los controles Auth desde el panel/API autorizado, una vez comprobado el impacto sobre los usuarios actuales.
- Ejecutar Security/Performance Advisors y pruebas RLS/Storage después de cada cambio en un entorno de desarrollo.

## Estado honesto

**Auditoría de punto 3: completada en modo de solo lectura. Implementación de seguridad: pendiente.** No se puede declarar el punto 3 terminado ni autorizar datos reales, mensajes reales o pagos hasta cerrar las brechas y completar pruebas verificables. No se hizo deployment ni se alteró la base de datos.
