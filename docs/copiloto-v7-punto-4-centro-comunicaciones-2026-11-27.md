# Copiloto V7 — Punto 4: Centro de comunicaciones

Fecha: 2026-11-27  
Rama: `feat/copiloto-v7-phase1-foundation`

## Entrega de esta etapa

Se amplió `app/copiloto-v7-preview/page.tsx` para presentar el Centro de Comunicaciones como un espacio unificado de revisión de Transport, Taxes y Work Opportunities. La vista incluye:

- Indicadores separados para mensajes sin leer, elementos que requieren revisión y mensajes enviados (cero en esta demostración).
- Búsqueda por remitente, contenido y área de negocio.
- Bandeja visual con clasificación por Transport, Taxes y Work Opportunities.
- Panel de revisión de un mensaje seleccionado.
- Borrador de respuesta editable y guardado únicamente en estado local de la sesión de Preview.
- Acción demostrativa de aprobación que cambia solo el estado de la muestra a `Approved · NOT SENT`.
- Etiquetas explícitas de SAMPLE DATA y NO LIVE CONNECTIONS.

## Seguridad y límites reales

- No se conecta a WhatsApp, WhatsApp Business, SMS, email, Twilio, ZapClaw ni a otro proveedor externo.
- No importa mensajes reales ni lee grupos de WhatsApp.
- No envía ni programa mensajes; aprobar la muestra no crea una cola real ni transmite nada.
- No acepta automáticamente oportunidades.
- La pantalla es una vista aislada de Preview; no sustituye todavía el CRM productivo ni el backend de comunicaciones.
- La bandeja CRM existente usa `crm_messages` y permite guardar mensajes/borradores bajo RLS por propietario. La ruta `/api/crm/send` solo valida/encola la intención; no envía SMS. `/api/crm/send/dispatch` permanece deshabilitada y responde 501 (`phone_dispatch_not_connected`).
- El esquema actual de `crm_messages` no implementa todavía un modelo general de canales/conectores, adjuntos, consentimiento por canal, estados de entrega del proveedor, eventos webhook e idempotencia de entrada/salida.

## Requisitos para declarar operativo el Centro

1. Reconciliar migraciones antes de cualquier cambio de esquema.
2. Definir el modelo canónico de mensajes, eventos, adjuntos, conectores, consentimientos y outbox; preservar el mensaje original sin sobrescritura por análisis IA.
3. Implementar adaptadores oficiales de canales por separado. WhatsApp Personal y grupos no se deben extraer mediante scraping no oficial; cualquier captura manual/compartida debe identificarse como tal.
4. Añadir webhooks autenticados/verificados, deduplicación/idempotencia, límites de tasa, auditoría y tratamiento de fallos.
5. Exigir consentimiento/opt-out cuando aplique y aprobación humana explícita antes de cualquier envío.
6. Probar con datos sintéticos, sin clientes ni comunicaciones reales.
7. Verificar entrega, fallos, reintentos y notificaciones en dispositivo antes de habilitar canales reales.

## Verificación

- Se recuperó el archivo Preview de la rama antes de editarlo.
- La pantalla Communications se reemplazó por la nueva bandeja y panel de revisión.
- El flujo de selección marca como leído; el borrador se mantiene en estado local; la aprobación solo cambia una etiqueta de demostración.
- No se hizo deployment. No se ha ejecutado un build/test de esta revisión, por lo que la compilación y QA visual siguen pendientes.
- No se cambió Supabase, Auth, Storage, datos, proveedores ni configuración de producción.

## Estado honesto del punto 4

**Interfaz de demostración del Centro de Comunicaciones: implementada en la rama y documentada. Centro de comunicaciones conectado y operativo: pendiente.** No habilitar clientes reales ni comunicaciones hasta terminar conectores, modelo de datos, controles de consentimiento, pruebas y QA.
