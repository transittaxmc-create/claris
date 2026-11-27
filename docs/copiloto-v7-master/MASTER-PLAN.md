# Copiloto V7 — plan maestro integral

**Fecha de consolidación:** 2026-11-27  
**Producto:** Copiloto V7 (CRM + centro de operaciones)  
**Aplicación anfitriona:** Claris / repositorio transittaxmc-create/claris  
**Rama de trabajo:** feat/copiloto-v7-phase1-foundation

## 1. Visión del producto
Copiloto debe ser la consola central desde la que Miguel gestione las operaciones de sus negocios, sin saltar entre aplicaciones para las funciones que los proveedores permiten integrar. Copiloto conserva la identidad del producto y conecta sistemas externos mediante adaptadores transparentes. No simular control sobre operaciones que el proveedor no permite.

La plataforma agrupa:
- **Transport — Island City Transit:** clientes, solicitudes, reservas, viajes, asignaciones, seguimiento, cargos operativos y servicio al pasajero.
- **Taxes — Brakha Group Tax Services:** clientes fiscales, expedientes por año, organizer, documentos, preparación, revisión, autorización del cliente y seguimiento de presentación.
- **Work Opportunities:** recepción/captura de ofertas, extracción de datos, evaluación de vehículo/horario/ruta/costos/ganancia, decisión del usuario y borrador de respuesta.
- **Communications Center:** bandeja unificada de canales autorizados, originales inmutables, clasificación, asignación al área, borradores, aprobación humana y estado real de entrega.
- **Clients:** registro de relación/contacto con vínculos independientes por unidad de negocio.
- **Documents:** índice documental y bóveda privada, versiones, OCR, clasificación, acceso y auditoría.
- **Square:** consola en Copiloto para operaciones que Square API realmente permita; Square permanece como sistema conectado de pagos.
- **Agenda / Tasks:** citas, recordatorios, seguimientos, tareas y vencimientos.
- **Overview / Dashboard:** resumen de trabajo pendiente, operaciones y alertas agregadas, sin duplicar libros contables.
- **Identity, Notifications, Audit & Recovery:** identidad, roles, membresías, MFA, sesiones/dispositivos, notificaciones, auditoría, backups y restauración.

## 2. Identidad y marca
- Producto: **Copiloto**. No renombrar.
- Transport: **Island City Transit**.
- Taxes: **Brakha Group Tax Services**.
- Nombre corporativo Transitax: pendiente; no imponer cambio.
- No cambiar ni migrar números/cuentas WhatsApp existentes durante esta fase.
- Transport WhatsApp Business: 934-208-1400.
- Taxes WhatsApp personal utilizado en comunicaciones: 934-200-8109.
- No tocar el caso de Mr. Shah.

## 3. Arquitectura y límites
Sistemas:
- Next.js en Claris: shell y experiencia.
- Supabase CRM mimgwleghecseoymgdug: nueva base CRM independiente.
- Supabase legado zrcnpmipdhpjdjkfrrgt: finanzas/Plaid; preservar, no migrar ni cambiar variables/tablas.
- GitHub: fuente de código y documentación.
- Railway: preview temporal aislado.
- Vercel claris: destino definitivo después de aprobación; no crear otro proyecto permanente.

Capas:
1. UI responsive Next.js.
2. Route handlers/acciones servidor con sesión, autorización, validación, rate limits, idempotencia y auditoría.
3. Servicios de dominio por módulo.
4. Adaptadores de proveedores con matriz explícita de capacidades.
5. Persistencia Supabase CRM y Storage privado.
6. Webhook inbox/outbox, notificaciones, logs seguros, backups y restauración.

Flujo: UI → endpoint autenticado → autorización por usuario/unidad → servicio de dominio → transacción/outbox → adaptador proveedor → webhook firmado → actualización de estado y auditoría → UI/notificación. El navegador nunca recibe claves secretas. RLS no sustituye la autorización de cada endpoint.

## 4. Experiencia y navegación
- CRM como icono/módulo independiente en la navegación inferior de la app anfitriona, sin quitar ni reordenar opciones actuales.
- Carga bajo demanda/lazy al entrar.
- Mantener intactos TODAY/ENTRY, EARNINGS/REGISTER, MONEY/FINANCE, REPORTS y flujos actuales de viajes, peajes, gastos, proyecciones, backups y Plaid.
- Escritorio con sidebar y áreas de trabajo; móvil con navegación compacta y controles táctiles accesibles.
- Cada workspace muestra identidad, área, estados, carga, error, vacío y permisos.
- No reemplazar app/page.tsx con el preview hasta transferencia revisada y aprobada.
- Datos sintéticos marcados DEMO/PREVIEW.

## 5. Separación de datos y acceso
Cada fila de negocio debe tener unidad explícita: transport, taxes o work_opportunities, salvo entidades globales estrictamente necesarias. Una persona puede relacionarse con más de un área, pero compartir teléfono/email no concede acceso cruzado a reservas, expedientes ni documentos.

Requisitos:
- Auth real, MFA obligatorio antes de clientes reales.
- Roles/memberships gestionados en servidor; no confiar en user_metadata editable.
- RLS owner + membresía/permisos de unidad.
- Claves foráneas compuestas para impedir relaciones entre propietarios/unidades no autorizadas.
- Pruebas negativas con usuarios sintéticos A/B.
- Revocación independiente de dispositivo perdido, cierre de sesión y recuperación segura.
- Cifrado en tránsito/reposo según servicios gestionados; secretos solo servidor.
- Auditoría append-only.
- Backups y restore comprobado.

## 6. Documents — bóveda y continuidad
Los teléfonos son dispositivos de captura/consulta, nunca el almacenamiento maestro. Al cambiar, perder, borrar o resetear un iPhone, el usuario inicia sesión en otro y recupera registros/documentos desde almacenamiento central privado, con MFA y revocación independiente.

Separar:
1. **Capturas temporales OCR:** se conservan hasta verificar extracción, clasificación y persistencia del documento final.
2. **Documentos originales/finales:** bóveda central privada, versionada y recuperable.

Cada documento necesita propietario, unidad, cliente/expediente, tipo, versión, hash, MIME/tamaño validado, estado OCR, retención y eventos de acceso. URLs firmadas cortas; rutas no adivinables; acceso auditado. Documentos fiscales nunca en el bucket de fotos CRM. No borrar originales hasta verificar copia final y metadatos.

## 7. Módulos y criterios de aceptación

### 7.1 Communications Center
- Inbox unificado para canales oficialmente conectados.
- Conservar original, remitente, destinatario, canal/cuenta, timestamp, IDs proveedor y adjuntos.
- Clasificación IA separada del original, con área, confianza y explicación.
- Asignar Transport, Taxes o Work Opportunities.
- Buscar/filtrar, marcar leído, asignar responsable, crear tarea/recordatorio y vincular cliente/reserva/expediente.
- Borrador editable, historial y aprobación humana explícita.
- Estados inequívocos: Draft / Pending approval / Approved / Queued / Sent (solo con confirmación proveedor) / Failed / Not sent.
- Opt-out, consentimiento, límites y cumplimiento por canal.
- Queued/Approved nunca se muestra como Sent sin confirmación real.

### 7.2 Transport
- Clientes y reservas, pasajeros, pickup, paradas, drop-off, vuelo/aerolínea/terminal cuando aplique.
- Solicitud → disponibilidad → cotización/confirmación → asignación → en curso → completado/cancelado/no-show → conciliación.
- Historial de servicio y comunicación; tareas/seguimientos.
- Vehículos/capacidad y asignaciones.
- Direcciones/mapa/navegación bajo acción del usuario; seguimiento de vuelo con proveedor aprobado.
- Integración Square cuando aplique; no inventar pagos ni disponibilidad.
- Auditoría de cambios, persistencia y permisos Transport.

### 7.3 Taxes
- Expediente por cliente y tax year; intake, engagement, filing status, checklist, documentos, preparación, revisión, aprobación cliente, filing y seguimiento.
- Checklist configurable por tipo de declaración/año.
- OCR en área temporal; original final a bóveda fiscal privada.
- Reconciliación de ingresos/deducciones y fuente documental.
- Registrar preparador/revisor, cambios, fechas y pendientes.
- Autorización expresa del cliente antes de e-file; Filed solo tras confirmación real de proveedor.
- No SSN/ITIN ni documentos reales en previews.
- E-file solo si API/software y permisos están identificados y probados.

### 7.4 Work Opportunities
- Ingesta solo por métodos autorizados; guardar fuente y mensaje original.
- Extraer fecha/hora, pickup, destino, pasajeros, equipaje, vehículo, tarifa, deadhead, millas, duración, peajes, combustible, parking, espera, gastos y deadline.
- Comparar vehículo/capacidad, disponibilidad real, ruta y rentabilidad completa.
- No inventar datos; faltantes → amarillo / Review.
- Estados: verde Interested, amarillo Review, rojo Not interested; rojo fuera de cola activa.
- Preparar respuesta YES editable; jamás auto-enviar ni auto-aceptar.
- Aceptación solo tras aprobación humana y confirmación operativa.

### 7.5 Clients
- Perfil de identidad/contacto, consentimiento/preferencias, fuente, notas, historial y seguimiento.
- Vínculos independientes Transport y Taxes.
- Prospecto/mensaje nuevo no recibe número de cuenta automáticamente.
- ACT-0-### se asigna solo cuando usuario acepta mensaje y crea ficha, o crea ficha manualmente; comienza en ACT-0-100 según regla documentada. Nunca reescribir números existentes; conservar IDs históricos ICT.
- Evitar duplicados mediante revisión/merge auditado, nunca mezclar expedientes fiscales automáticamente.

### 7.6 Documents
- Búsqueda por cliente, unidad, expediente, año, tipo, estado y fecha.
- Carpetas lógicas/categorías claras; metadatos persistentes, versionado y permisos.
- Captura temporal OCR y bóveda de originales separadas.
- Descargar/compartir solo mediante permisos y URLs cortas; auditoría.

### 7.7 Square
- Square Sandbox primero.
- Copiloto administra desde su interfaz las operaciones compatibles: clientes, invoices, documentos/adjuntos y recursos transaccionales permitidos por scopes/API.
- Square permanece sistema conectado de pagos; no duplicar ni fingir su ledger.
- Por acción documentar: API compatible, deep link/handoff externo o no soportada.
- OAuth/scopes mínimos, webhooks firmados, idempotencia y auditoría.
- Cobros, capturas, reembolsos y cambios sensibles requieren aprobación humana; solo Sandbox en desarrollo.

### 7.8 Agenda / Tasks
- Captura de citas/solicitudes desde WhatsApp, SMS, llamadas, compartir o copiar/pegar.
- Recordatorios y seguimientos incluso sin fecha; sin fecha permanece en cola de completar.
- Vínculo a cliente, unidad, reserva, expediente u oportunidad.
- Tareas vencidas y push interno cuando entrega esté verificada.

### 7.9 Notifications
- Eventos: nuevo cliente/prospecto, seguimiento, cita, documento, tarea vencida, cambio de estado y asignación.
- Preferencias, quiet hours, deduplicación, intentos y confirmación.
- Distinguir push local de push remoto con app cerrada; probar ambos físicamente.
- No mostrar contenido fiscal sensible en notificaciones de pantalla bloqueada.

## 8. Integraciones y límites
- **WhatsApp:** no scraping WhatsApp Web. WhatsApp Personal no ofrece API oficial equivalente para leer grupos. ZapClaw Coexistence no lee grupos ni soporta WhatsApp Personal directamente. Los grupos de ofertas llegan al WhatsApp personal 934-200-8109; no prometer ingestión automática. Evaluar compartir/reenviar/captura manual u otra API oficial. No migrar cuentas/números.
- **Twilio:** cuenta existe según conversaciones, pero CRM no tiene integración productiva verificada. Token compartido anteriormente comprometido: no repetirlo; rotar tras revisar dependencias y usar API Key segura. Webhooks inbound, respuestas aprobadas, callbacks, historial, opt-out y scheduling pendientes.
- **Email:** no hay conexión de la app verificada. Un conector Gmail de ChatGPT no prueba acceso de Claris.
- **ZapClaw:** MCP tuvo error DNS; no probado. Token anterior comprometido; rotar. No afirmar lectura de grupos.
- **Square:** no conectado ni Sandbox probado.
- **Tax/e-file y OCR:** no integraciones verificadas.

## 9. Base de datos conocida
Proyecto CRM mimgwleghecseoymgdug (ACTIVE_HEALTHY, us-east-2, PG17.12 en auditoría previa). Tablas observadas: crm_clients (7 filas), crm_reservations (2), crm_messages (1), finance_sync_doc (1); RLS habilitado en las cuatro.

Ledger registra 20261126024701, 20261126033314, 20261126035245. La rama tiene seis SQL; falta recuperar SQL exacto de dos versiones del ledger y hay cinco scripts cuyos efectos existen pero no aparecen en ledger. No re-ejecutar scripts reflejados ni insertar versiones manualmente. Reconciliar SQL exacto, hashes, procedencia y esquema antes de nuevas migraciones.

Bucket crm-client-photos privado y limitado a fotos CRM. No usarlo para documentos fiscales. No había límite MIME/tamaño en revisión previa; corregir antes de uploads reales.

## 10. Fases de entrega

### Fase 1 — Fundación segura y CRM usable
1. Inventario y arquitectura de la aplicación.
2. Reconciliación DB/migraciones y modelo de permisos.
3. Auth, MFA, sesiones, unidades y RLS.
4. Persistencia de clientes, contactos, reservas, expedientes, tareas y comunicaciones.
5. Documents vault privado, versiones, OCR temporal y recuperación.
6. UI responsive e integración de navegación lazy sin afectar finanzas.
7. Communications approval queue y estado real.
8. Pruebas seguridad, aislamiento, backups y restore.
9. Preview y QA completa con datos sintéticos.

### Fase 2 — Operaciones y conectores
1. Transport completo y agenda.
2. Taxes workflow/documentos/revisión.
3. Work Opportunities captura y análisis.
4. Twilio/email/WhatsApp oficial donde sea posible.
5. Push remoto y recordatorios.
6. Square Sandbox y revisión de acciones compatibles.
7. Auditoría de eventos, observabilidad y soporte.

### Fase 3 — Preparación de producción
1. Resolver hallazgos críticos/altos de seguridad.
2. MFA y recuperación/dispositivo verificados.
3. Pruebas A/B, aislamiento Transport/Taxes, Storage y endpoints.
4. Restore desde backup probado.
5. QA iPhone/escritorio, accesibilidad, rendimiento y errores.
6. PR/diff revisados; aprobación explícita de merge.
7. Vercel Preview cuando cuota permita.
8. Producción únicamente con aprobación explícita y checklist firmado.

**Expectativa realista:** hoy se puede avanzar mucho en fundación, persistencia segura, estructura y flujos demo; no es responsable prometer que integraciones externas, e-file, WhatsApp grupos, Square y auditoría completa de producción queden listas hoy sin credenciales, permisos y pruebas reales en Sandbox. Dejar cada límite claramente indicado.

## 11. Criterio global de terminado
Una función está terminada solo si UI y estados loading/empty/error/accessibility están listos; persistencia y relaciones funcionan; autorización servidor + RLS validada; auditoría/idempotencia implementadas; pruebas automatizadas y negativas aprobadas; proveedor probado en Sandbox y límites documentados; QA escritorio/iPhone completada; How This Works y carpeta master actualizados con evidencia.

## 12. Prioridad inmediata
1. Leer README, CURRENT-STATE y AGENT-HANDOFF.
2. Verificar Railway preview y rama.
3. Terminar QA del preview.
4. Reconciliar migraciones antes de DDL.
5. Auditar Auth, MFA, políticas, endpoints, Storage y push.
6. Elegir vertical end-to-end: Clients + Transport reservations + Communications outbox.
7. Repetir patrón para Taxes, Documents y Work Opportunities.
8. Square Sandbox después de auth/audit base.
9. Actualizar documentación y handoff en cada hito.
