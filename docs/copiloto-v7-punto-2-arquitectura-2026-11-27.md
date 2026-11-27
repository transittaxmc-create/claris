# Copiloto V7 — Punto 2: Arquitectura funcional y técnica
Fecha: 2026-11-27
Rama: feat/copiloto-v7-phase1-foundation
Estado: diseño documentado; implementación backend pendiente.

## 1. Objetivo
Copiloto es la consola principal de operación. Los usuarios trabajan desde sus módulos; proveedores externos (Supabase, Square, Twilio y canales Meta/WhatsApp compatibles) son servicios conectados detrás de adaptadores. No se reemplaza un sistema externo por una pantalla simulada ni se promete control de una operación que el proveedor/API no permita.

Principios:
- Mantener Copiloto como marca y punto principal de trabajo.
- Separar Transport, Taxes y Work Opportunities en datos, permisos, documentos y reportes.
- Reutilizar identidad, clientes, comunicaciones, documentos, notificaciones y auditoría como servicios compartidos, siempre con pertenencia explícita a un área.
- Preservar la aplicación financiera y los flujos actuales hasta una migración validada.
- API-first en servidor; el navegador nunca recibe claves secretas.
- Todo evento externo es idempotente, trazable y conserva el contenido original.
- Toda comunicación saliente y aceptación de trabajo requiere aprobación humana explícita.
- Datos sintéticos y Sandbox durante desarrollo; producción solo tras aprobación final.

## 2. Mapa de módulos y propiedad
| Módulo | Responsabilidad | Datos que posee | Conexiones |
|---|---|---|---|
| Overview / Dashboard | Resumen operativo, alertas y tareas | Vistas agregadas, no una segunda fuente de verdad | Todos los módulos |
| Transport | Reservas, viajes, pasajeros, asignación, estado, cobro y seguimiento | Reservas, viajes, servicios, vehículos/asignaciones y cargos operativos | Clients, Documents, Communications, Square, Notifications |
| Taxes | Expedientes fiscales, checklist, documentos, preparación y seguimiento | Casos fiscales, ejercicios, formularios, documentos e hitos | Clients, vault privado, Communications, tareas |
| Work Opportunities | Captura y análisis de ofertas, rentabilidad y decisión | Oferta original, extracción, evaluación, decisión y tiempos | Communications, reglas de vehículo/capacidad, Transport |
| Communications | Bandeja unificada, clasificación, borradores, aprobación y estado real | Mensaje original, adjuntos, análisis, borrador, aprobación y eventos del proveedor | Conectores, CRM, Transport, Taxes, Work |
| Clients | Ficha de relación con vínculos por unidad | Identidad/contacto, consentimiento, relación y preferencias | Transport y Taxes mediante relaciones separadas |
| Documents | Índice y acceso controlado al vault privado | Metadatos, propietario, unidad, clasificación, objeto privado y retención | Transport, Taxes, Clients, Communications |
| Square | Consola de operaciones permitidas por Square API | Referencias externas, sincronización, auditoría y estado | Customers, invoices, payments/refunds y recursos autorizados |
| Notifications | Alertas internas y entrega push/email/SMS autorizada | Suscripciones, intentos, entregas confirmadas y preferencias | Todos |
| Audit & Identity | Identidad, permisos, sesiones, dispositivos y auditoría | Usuarios, roles, membresías, sesiones y eventos | Toda la plataforma |

### Reglas de pertenencia
- Cada registro de negocio tiene un área explícita: transport, taxes o work_opportunities, salvo datos estrictamente globales.
- Una persona puede ser cliente de Transport, Taxes o ambos; compartir contacto no da acceso cruzado a expedientes, viajes ni documentos.
- Documentos fiscales solo son visibles para roles autorizados de Taxes; documentos de viaje solo para roles autorizados de Transport.
- Work Opportunities puede referenciar una oferta y una reserva resultante, pero aceptar no crea ni confirma un viaje hasta aprobación humana y confirmación del flujo operativo.
- El dashboard agrega desde fuentes autorizadas; no duplica ni altera libros operativos.

## 3. Capas técnicas
1. Experiencia web Next.js: shell responsive, navegación por workspace, vistas móviles/desktop, estados de carga/error/vacío y etiquetas inequívocas de Preview/Sandbox.
2. Capa de aplicación (Route Handlers/Server Actions): validación, autorización por sesión y unidad, límites de tasa, idempotencia y auditoría.
3. Servicios de dominio: reglas de Transport, Taxes, Work Opportunities, Communications, Documents y Square; sin lógica de proveedor incrustada en UI.
4. Adaptadores: Supabase Auth/DB/Storage, Square, Twilio, WhatsApp/Meta y notificaciones. Cada adaptador declara capacidades reales, scopes, webhooks y límites.
5. Persistencia: Supabase CRM nuevo para dominio CRM/Copiloto; Storage privado para documentos; Supabase financiero legado aislado hasta integración revisada.
6. Observabilidad y continuidad: auditoría append-only, logs sin secretos/datos fiscales innecesarios, métricas de latencia, backups y pruebas de restauración.

Flujo estándar: UI → endpoint autenticado → autorización/RLS + servicio de dominio → transacción de datos/outbox → adaptador → webhook/callback firmado → actualización de estado + auditoría → UI/alerta.

## 4. Modelo lógico propuesto (no es una migración)
Entidades a validar antes de DDL:
- profiles, memberships, roles, role_permissions, device_sessions.
- business_units y client_relationships.
- crm_clients existente, sujeto a evolución controlada; evitar duplicar identidad.
- transport_reservations, transport_trips, vehicles, assignments, trip_events.
- tax_cases, tax_years, tax_checklist_items, tax_case_events.
- work_opportunities, opportunity_extractions, opportunity_evaluations, opportunity_decisions.
- communications, communication_attachments, communication_analysis, outbound_messages, approval_events, provider_events.
- documents, document_versions, document_access_events; bytes en bucket privado.
- integration_connections, integration_sync_state, webhook_inbox, outbox_events.
- notifications, notification_attempts, audit_events.

Todas las tablas multiusuario deben aplicar tenant/owner scope y RLS. Las relaciones entre áreas deben ser explícitas y autorizadas. No incluir contenido sensible de documentos en logs ni metadatos públicos.

## 5. Comunicaciones y automatización
- Ingesta mediante webhook oficial o captura manual/forwarding permitido; validar firma, origen y duplicados.
- Conservar mensaje original sin alterarlo, canal, cuenta receptora, remitente, timestamps, IDs del proveedor y adjuntos.
- IA genera análisis/clasificación y borrador separado del original; registrar versión/modelo y confianza.
- Routing: Transport → reserva/operación; Taxes → expediente fiscal; Work → cola de oportunidades; clasificación incierta → revisión.
- Salida: borrador → aprobación humana → outbox idempotente → adaptador → webhook de resultado. Queued no equivale a sent; sent no equivale a delivered sin confirmación real.
- Verificar STOP/consentimiento, supresión, horarios y reglas del canal.
- WhatsApp Personal y grupos: no asumir ingestión automática de grupos. Usar solo vías oficiales/permitidas; evaluar coexistence/ZapClaw por capacidades y límites documentados.

## 6. Work Opportunities
Preservar fuente original, publicación, fecha de captura, canal y grupo cuando sea legalmente disponible. Extraer origen/destino, fecha/hora, pasajeros, vehículo/categoría, equipaje, pago, tarifa, peajes, espera, duración, deadhead, gastos, deadline y campos faltantes. Mostrar datos conocidos, desconocidos y supuestos por separado; no inventar tarifas, distancias ni umbrales. Semáforo verde/amarillo/rojo explicable y configurable; rojo fuera de la cola principal según instrucción del usuario. Respuesta YES solo como borrador; nunca aceptar ni enviar automáticamente. Medir latencia publicación→captura→clasificación→alerta→aprobación→envío y reportar percentiles solo con mediciones reales.

## 7. Square
- Comenzar con Square Sandbox y secretos en el gestor de entorno, nunca en cliente ni repositorio.
- OAuth/token scopes mínimos, webhooks firmados, idempotency keys y reconciliación.
- En Copiloto: customers, invoices, payments/refunds y otros recursos solo si endpoint y scopes habilitados lo permiten.
- Diferenciar acciones nativas, enlaces a Square y acciones no soportadas. Square sigue siendo el sistema conectado de registro/ejecución donde aplique.
- No almacenar PAN/CVV ni manejar datos de tarjeta directamente; checkout debe permanecer en mecanismos PCI-compliant de Square.
- Ningún cobro, reembolso o invoice real se activa antes de aprobación final.

## 8. Documents y recuperación
El teléfono es dispositivo de captura/consulta, no almacenamiento maestro. Vault central privado, rutas por usuario/unidad/expediente, URLs firmadas de corta duración y autorización de servidor. Separar archivos temporales de OCR de documentos finales; borrar temporales solo según política verificada después de extracción/retención. Versiones, checksum, MIME, tamaño, clasificación, dueño, unidad, fecha y auditoría. Backups y restore testados; revocación de dispositivo/sesión independiente del contenido central.

## 9. Notificaciones
Alertas internas persistentes son la fuente canónica; push es canal de entrega, no único registro. Registrar token por dispositivo, permisos, actualización, intento y resultado. Probar iPhone físico: permiso, token, foreground/background, logout, revocación, expiración y reintentos. Si push falla, alerta sigue visible en Copiloto y estado indica canal no entregado.

## 10. Integración con aplicación existente
- Mantener ruta raíz y CopilotoApp hasta que V7 supere QA.
- Incorporar navegación V7 incrementalmente con feature flags; no eliminar TODAY, EARNINGS, MONEY, REPORTS, CRM, TAX 2026, Expenses, Data & Backup ni Toll Audit.
- Conectar primero pantallas CRM/Tax 2026 como puntos de entrada; reemplazar almacenamiento local solo tras migración, backup y prueba de recuperación.
- La sincronización financiera del legado está apagada en código inspeccionado; no reactivarla como parte de esta arquitectura sin proyecto separado, revisión de conflictos y consentimiento.

## 11. Secuencia de construcción
A. Inventario y reconciliación de esquema/migraciones (bloquea DDL).
B. Identidad, unidades de negocio, roles, RLS, MFA y sesiones.
C. Vault privado, metadatos, versiones, backup y restauración.
D. API de dominio + audit/outbox/idempotencia.
E. Transport y Clients con migración controlada.
F. Taxes y aislamiento de documentos/expedientes.
G. Communications intake, clasificación y aprobación con adaptadores Sandbox.
H. Work Opportunities con extracción/evaluación explicable y aprobación.
I. Square Sandbox: OAuth/scopes, customers/invoices/payments de prueba y webhooks.
J. Notificaciones y pruebas integrales; QA móvil/desktop; documentación y release checklist.

## 12. Criterios de aceptación
- Nadie puede leer/modificar datos de otro usuario o unidad sin permiso explícito.
- Ningún mensaje se envía ni trabajo se acepta sin acción humana registrada.
- Webhooks/comandos externos autenticados, idempotentes y auditables.
- Documentos privados y recuperables al cambiar de teléfono tras autenticación.
- Dashboard refleja fuentes reales; Demo/Sandbox/Producción claramente separados.
- Funciones Square etiquetadas como integradas, enlace externo o no soportadas.
- Flujos existentes disponibles hasta migración validada.
- Builds, pruebas, QA de dispositivos, restore y revisión de seguridad aprobados antes del release.
- “Ready for production” requiere evidencia; publicar sigue requiriendo aprobación explícita del usuario.

## Estado y límites
Este punto entrega blueprint de arquitectura. No crea tablas, aplica migraciones, conecta proveedores, cambia ruta raíz ni despliega. Los nombres de entidades son un modelo lógico propuesto, no objetos ya creados.
