# CRM Copiloto V7 — Resumen maestro y plan de trabajo
**Fecha:** 27 de noviembre de 2026  
**Estado:** Plan consolidado; arquitectura final pendiente de aprobación; nuevas integraciones aún no implementadas.

> Registro consolidado de las conversaciones de trabajo del 27/11/2026 relacionadas con Copiloto V7. No es una transcripción literal palabra por palabra.

## Objetivo
Una sola plataforma Copiloto V7 con tres áreas separadas: **Transport**, **Taxes** y **Work Opportunities**. Un Centro de Comunicaciones recibe, identifica, organiza y registra mensajes; Copiloto Intelligence analiza y recomienda. Toda comunicación saliente y toda aceptación de trabajo requieren aprobación humana.

## Áreas y fuentes
### Transport
- WhatsApp de negocio: **934-208-1400**.
- Clientes, servicios, reservaciones, historial y seguimiento.
- Completar entrada/salida SMS y WhatsApp, estados reales de entrega y registro durable.

### Taxes
- WhatsApp Personal actual: **934-200-8109**.
- Bandeja y expedientes exclusivos para clientes de impuestos, citas, preguntas, documentos y seguimiento.
- Documentos tributarios en almacenamiento privado; WhatsApp no es el archivo maestro.
- Preferencia del usuario: conservar WhatsApp Personal si es viable. Convertir a WhatsApp Business solo si resulta necesario y tras verificar respaldo, contactos, historial, grupos, elegibilidad del proveedor y autorización. No migrar ni cambiar el número sin aprobación.

### Work Opportunities
- Las ofertas llegan a varios grupos de WhatsApp del número **934-200-8109**.
- Capturar ofertas, extraer datos, compararlas con criterios y alertar rápidamente.
- El usuario decide; no aceptar trabajos ni enviar YES automáticamente.
- Limitación conocida: ZapClaw/WhatsApp Coexistence revisado no ingiere grupos. Primera vía: compartir/reenviar ofertas a una bandeja de entrada de Copiloto y estudiar alternativas autorizadas. No usar scraping no oficial de WhatsApp Web.

## Centro de Comunicaciones
Componentes: Source Connectors; Message Center; clasificación y routing; Copiloto Intelligence; Document Vault privado; Automation & Alerts. Conservar el mensaje original separado del análisis de IA. Registrar fuente, remitente/destinatario, canal, timestamps, adjuntos, estado, aprobaciones y eventos de envío. Usar idempotencia para evitar duplicados.

## Motor de oportunidades — categorías confirmadas
- **VERDE — La quiero:** cumple requisitos principales; alerta prioritaria.
- **AMARILLA — La puedo mirar:** se acerca a lo que busca el usuario, pero requiere revisar una condición o dato.
- **ROJA — No me interesa:** ocultar de la bandeja y alertas visibles; se puede conservar un registro técnico mínimo para auditoría.
Solo mostrar/notificar verdes y amarillas. Verde tiene prioridad máxima.

### Factores de evaluación
Vehículo, capacidad y clasificación comercial; fecha/hora de pickup; disponibilidad real y compromisos existentes; pickup/destino; distancia al pickup y millas vacías; pago y condiciones; tiempo de espera y duración; peajes, combustible y otros costos; rentabilidad estimada; datos faltantes y deadline. Separar requisitos excluyentes de preferencias flexibles. No inventar datos. Los parámetros exactos, perfil del vehículo, zonas, horarios y umbrales se establecerán después de construir y probar el motor. Los ejemplos previos de $100 o NYC/JFK/LGA/EWR no son parámetros confirmados.

### Flujo rápido
1. Capturar publicación original y hora de origen si está disponible.
2. Registrar hora de recepción en Copiloto.
3. Extraer datos y clasificar en segundos.
4. Verificar vehículo, clasificación y disponibilidad.
5. Alertar verdes/amarillas, priorizando verdes.
6. Mostrar mensaje original, fuente, datos y razones.
7. Preparar respuesta YES.
8. Enviar solo con aprobación explícita.
9. Registrar aprobación, envío, respuesta del dispatcher y resultado.
Medir publicación→captura→clasificación→alerta→aprobación→envío. No prometer ser el primero en responder hasta validar la fuente y medir latencia real.

## Presentación en Copiloto
Nueva pantalla **Work Opportunities** con bandeja verde/amarilla, filtros, mensaje original, fuente y tiempos, pago, pickup/destino, horario, vehículo, disponibilidad, millas vacías, costos, explicación de clasificación, datos faltantes y acciones para revisar, preparar respuesta, aprobar envío, descartar y registrar resultado. El dashboard general resume las tres áreas sin mezclar registros.

## SMS, WhatsApp y Square
- SMS: Twilio es la ruta a evaluar/implementar: webhooks entrantes firmados, envío saliente, callbacks, idempotencia, consentimiento y STOP. No está conectado todavía.
- WhatsApp Transport/Taxes: integración productiva no verificada.
- Grupos: ZapClaw Coexistence revisado no permite leer grupos.
- Square: el usuario tiene Square Terminal y desea evaluar cobros desde Copiloto, recibos impresos y vínculo al expediente. Pendiente; Sandbox primero. No almacenar datos de tarjetas.

## Arquitectura y datos
- GitHub: `transittaxmc-create/claris`; Vercel: `claris`.
- Supabase CRM: `mimgwleghecseoymgdug` (ACTIVE_HEALTHY, us-east-2).
- No confundir con Supabase de Finanzas `zrcnpmipdhpjdjkfrrgt`.
- Supabase/Copiloto será el registro principal; proveedores externos son conectores, no archivo maestro.
- Mantener expedientes y permisos separados por unidad.
- No crear tablas/migraciones antes de auditar esquema e historial y reconciliar drift.

## Seguridad obligatoria
Aislamiento Transport/Taxes y RLS; MFA; control de sesiones/dispositivos; cifrado; auditoría; backups y recuperación; documentos fiscales privados; firmas de webhooks, validación de origen, rate limits, idempotencia, consentimiento y STOP. Desarrollo con datos sintéticos únicamente. No usar el expediente de Mr. Shah como prueba ni contactar clientes/procesar pagos reales. Cualquier API token expuesto debe rotarse/revocarse y nunca copiarse a código o documentación.

## Fases de trabajo
0. Auditoría de código, pantallas, APIs, Supabase, migraciones, Vercel y proveedores.
1. Aprobar arquitectura final, esquema, permisos, estados, conectores, UX, reglas, seguridad y criterios.
2. Construir Centro de Comunicaciones y routing.
3. Completar Transport (SMS/WhatsApp, entrada/salida, estados y notificaciones).
4. Integrar Taxes (intake, expedientes, documentos privados y seguimiento).
5. Construir Work Opportunities (captura, parser, verde/amarillo/rojo, vehículo, disponibilidad, alertas y respuestas aprobadas).
6. Square Sandbox.
7. Pruebas integrales, seguridad, recuperación y latencia.
8. Activación controlada tras auditoría y autorización.

## Criterios de aceptación
Mensajes entrantes registrados en canal correcto; salidas solo con aprobación y estado real del proveedor; historial/documentos persistentes y recuperables; separación Taxes/Transport; ofertas capturadas con latencia medida; verdes/amarillas visibles y rojas filtradas; clasificación explicable; vehículo/disponibilidad aplicados; YES nunca sin aprobación; deduplicación; notificaciones verificadas; auditoría de aprobaciones, envíos, fallos y decisiones.

## Estado técnico observado — 27/11/2026
- `main`: `51cb5217cdb9b938678428b51ea64bc8e1300408`.
- Última Production consultada: **READY**, commit `f06c1258df1714f3a44a98c1a8b5d8549d635e29`, distinto del tip actual de main.
- Deployments READY recientes en ramas security/customer-360 son Preview, no Production.
- Auditoría previa documenta `crm_clients`, `crm_reservations`, `crm_messages` con RLS y bucket privado `crm-client-photos`.
- Drift: seis archivos de migración en repo frente a tres versiones registradas; reconciliar antes de DDL.
- Mensajes entrantes automáticos no conectados; bandeja manual no prueba proveedor.
- `/api/crm/send` pone en cola, no envía; `/api/crm/send/dispatch` devuelve 501.
- WhatsApp y Square no verificados como integraciones productivas.
- Persistencia push y entrega física en iPhone no verificadas; auditoría previa reportó Vercel Blob suspendido.
- Este documento se trabaja en una rama separada; no se ha desplegado.

## Decisiones y siguientes pasos
Confirmado: Copiloto central con tres áreas; conservar 934-200-8109 como Personal si es viable; verde/amarillo/rojo; analizar vehículo, clasificación, horario, disponibilidad, ruta, pago, millas vacías, tiempo y rentabilidad; definir parámetros después de construir/probar; alertar rápido; usuario aprueba respuestas; primero plan/arquitectura, después implementación y pruebas.

Siguiente: terminar auditoría; aprobar arquitectura; implementar Communications Center en rama; probar con datos sintéticos; actualizar `Copiloto → How This Works` en cada fase/deployment indicando READY/BUILDING/FAILED, estado de push y pruebas completas/pendientes.

---
Este resumen reúne las conversaciones de planificación del 27/11/2026 sobre perfil 360, SMS, WhatsApp Transport/Taxes, oportunidades de trabajo y Square. No afirma que funciones pendientes estén implementadas.
