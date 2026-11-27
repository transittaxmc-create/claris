# Copiloto V7 — Reconciliación de migraciones y preparación de protecciones

Fecha: 2026-11-27  
Proyecto Supabase: `mimgwleghecseoymgdug` (CRM; separado del proyecto financiero legado `zrcnpmipdhpjdjkfrrgt`).  
Rama: `feat/copiloto-v7-phase1-foundation`

## Alcance y seguridad de esta revisión

Inspección de solo lectura de Supabase y GitHub. No se ejecutó DDL, no se aplicaron ni marcaron migraciones, no se alteraron datos, usuarios, permisos, buckets, Auth ni settings, y no se hizo deployment.

## Reconciliación: evidencia actual

- Supabase registra exactamente tres versiones: `20261126024701`, `20261126033314` y `20261126035245`.
- La rama contiene seis archivos SQL:
  1. `20261126024701_crm_auth_clients_reservations_rls.sql`
  2. `20261126120000_crm_account_photos_messages.sql`
  3. `20261126150000_finance_sync_doc.sql`
  4. `20261126170000_crm_message_follow_up.sql`
  5. `20261126180000_crm_message_send.sql`
  6. `20261126190000_crm_reservation_stop.sql`
- El primer archivo coincide con una versión del ledger. Los archivos de versiones `20261126033314` y `20261126035245` no están presentes en esta rama.
- Las otras cinco migraciones no aparecen como versiones en el ledger consultado. Sin embargo, sus efectos relevantes están presentes en el esquema activo:
  - `crm_clients.account_number`, `crm_clients.photos`, `crm_reservations.photos`, `crm_messages` y el bucket privado `crm-client-photos`.
  - `finance_sync_doc`.
  - `crm_messages.needs_follow_up`.
  - `crm_messages.send_state`, `send_error`, `send_via`, `dispatched_at`.
  - `crm_reservations.stop_address`.
- Además, el esquema activo contiene el índice `crm_reservations_client_owner_idx` y la restricción `crm_reservations_airport_flight_required`, cuyos nombres coinciden con el propósito descrito de las dos versiones registradas que no tienen archivo en la rama. Esto confirma que sus efectos están presentes, pero no recupera su SQL original ni demuestra qué procedimiento los aplicó.
- Se encontraron índices duplicados sobre `crm_clients(id,user_id)`: `crm_clients_id_user_id_key` y `crm_clients_id_user_uidx`. No eliminar ninguno sin revisar dependencias y origen.
- El bucket `crm-client-photos` está configurado como privado; no tiene límite de tamaño ni allowlist MIME. Las cuatro políticas verificadas limitan operaciones al primer segmento de ruta igual al UUID de la sesión autenticada.

## Decisión de reconciliación

**No ejecutar de nuevo ninguno de los cinco scripts ya reflejados en el esquema. No insertar manualmente versiones en el ledger.** Primero recuperar del historial Git o de una copia verificable el SQL exacto de las versiones `20261126033314` y `20261126035245`; comparar hash/contenido con la definición activa; reconstruir el origen de las cinco migraciones reflejadas pero no registradas; y documentar el mecanismo real con el que se aplicaron. Hasta entonces el historial se considera divergente y bloquea nuevas migraciones productivas.

## Protecciones preparadas para el siguiente ciclo

### Transport
- Toda fila operacional deberá tener propietario autenticado y unidad de negocio `transport`.
- RLS por propietario más membresía/permisos explícitos de la unidad; claves foráneas compuestas donde se enlacen clientes, reservas, viajes, mensajes y documentos.
- Validar cada endpoint del servidor; RLS no sustituye autorización del endpoint.
- No permitir que el cliente envíe o modifique por sí mismo roles, owner_id o business_unit sin validación del servidor.

### Taxes
- Unidad `taxes` aislada de Transport, con permisos y políticas propias.
- Expedientes, formularios, identificaciones y documentos fiscales en almacenamiento privado dedicado; nunca en el bucket de fotos CRM.
- URLs firmadas de corta duración, MIME/tamaño validados en servidor, acceso auditado y pruebas negativas entre unidades.
- No usar `user_metadata` editable para decisiones de autorización; usar membresías/claims controlados por servidor o tablas de permisos protegidas.

### Documents
- Bóveda documental separada por unidad, cliente y expediente, con propietario, clasificación, versión, hash, estado OCR, retención y eventos de auditoría.
- Capturas temporales de OCR separadas de documentos finales; no borrar el original hasta verificar extracción y persistencia del documento final.
- Almacenamiento privado, rutas no adivinables, signed URLs breves, límites MIME/tamaño y política de backup/restore probada.
- El bucket actual `crm-client-photos` se mantiene limitado a fotografías CRM; no convertirlo en bóveda fiscal por conveniencia.

## Pruebas requeridas antes de producción

1. Dos usuarios sintéticos: A no puede leer, insertar con owner B, actualizar, borrar ni enlazar registros de B.
2. Un usuario con acceso Transport pero sin Taxes no puede consultar expedientes, filas ni archivos Taxes.
3. Un usuario sin permiso de Documents no puede obtener listado, signed URL ni descargar archivos de esa unidad.
4. Probar upload, download, overwrite y delete con rutas propias y ajenas; confirmar INSERT/SELECT/UPDATE según el modo de upload.
5. Probar endpoints API con sesión ausente, expirada, usuario sin membresía y unidad manipulada.
6. Confirmar MFA, recuperación, revocación de sesión/dispositivo, política de contraseña filtrada, límites de archivo, auditoría y restore.
7. Ejecutar Security/Performance Advisors y build/tests después de cada cambio.

## Estado

- Revisión de esquema, ledger, índices, restricciones, RLS y Storage: **completada en modo read-only**.
- Historial de migraciones: **divergencia confirmada; reconciliación documental aún pendiente de recuperar SQL faltante y procedencia**.
- Diseño de protecciones Transport / Taxes / Documents: **preparado; no implementado ni probado**.
- Base de datos activa, Auth, Storage y producción: **sin cambios**.
- Punto 3 global: **no cerrado**. No usar datos reales ni abrir a clientes hasta implementar y verificar los controles anteriores.
