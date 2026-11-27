# Copiloto V7 — Punto 7: Work Opportunities Preview
Fecha: 2026-11-27

## Alcance implementado
Se agregó `components/copiloto-v7-preview/work-opportunities-workspace.tsx` y se integró en `app/copiloto-v7-preview/page.tsx` sobre `feat/copiloto-v7-phase1-foundation`.

La pantalla de demostración incluye:
- Bandeja de oportunidades sintéticas con filtros Active, All, Interested, Review y Not interested.
- Clasificación humana verde/interesado, amarilla/revisar y roja/no interesado.
- Panel de detalle con origen de muestra, ruta, fecha/hora, tipo de vehículo, tarifa, deadhead, millas del viaje, peajes, combustible y duración.
- Cálculo ilustrativo de tarifa menos peajes y combustible, mostrando explícitamente costos excluidos y limitaciones.
- Borrador de respuesta YES para revisión humana, siempre local y no enviado.
- Elementos con datos faltantes permanecen en revisión; no se inventan importes ni tiempos.

## Límites de seguridad y conectividad
- No hay lector de grupos de WhatsApp, scraping, auto-reply, auto-accept ni despacho.
- No conectar WhatsApp Personal/grupos por automatizaciones no oficiales. Deben evaluarse métodos de recepción compatibles y autorizados (reenviar/compartir/manual u otro flujo aprobado).
- No se envían mensajes ni se acepta trabajo automáticamente.
- No hay persistencia CRM ni conexiones de proveedor.
- Datos sintéticos solamente; no se modificó Supabase.

## Cambios
- Commit del componente: `59ed9042df7bd4110f45aed8546551ddddd8c5a4`
- Commit de integración: `ae3724b789f77ee2c15bcc81785eb258f380e23d`

## Verificación pendiente
Build, typecheck, pruebas automatizadas y QA visual pendientes. No hay deployment verificado de esta rama.

## Estado
Interfaz de revisión de oportunidades implementada. Ingesta autorizada, persistencia, análisis completo de costos, integraciones, auditoría y pruebas de extremo a extremo pendientes. No habilitar con operaciones reales.
