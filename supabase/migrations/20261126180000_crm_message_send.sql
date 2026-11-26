-- CRM — cola de salida SMS + estados reales de despacho (orden y
-- corrección de canal de Miguel, 2026-11-26): los mensajes de la
-- bandeja son SMS/texto. Al aprobar, el mensaje entra a la cola
-- (send_state = 'queued'); Amani lo despacha desde el teléfono de
-- Miguel y el resultado se escribe de vuelta por /api/crm/send/dispatch
-- (send_state = 'sending' | 'sent' | 'failed', send_error con el motivo,
-- send_via = 'phone', dispatched_at con la hora). El SMS por esta vía
-- NO confirma entrega al teléfono del cliente — por eso NO hay columna
-- "delivered": sería inventar una confirmación que el canal no da.
-- SOLO proyecto Supabase exclusivo del CRM (mimgwleghecseoymgdug).
-- NO tocar el Supabase financiero.
--
-- Aplicación: pegar en el SQL Editor del proyecto del CRM y ejecutar.
-- El código degrada sin romper si esta migración aún no se aplicó: la
-- ruta /api/crm/state reintenta los mensajes sin estas columnas y el
-- estado del despacho queda solo en el dispositivo; la ruta de
-- despacho guarda el "sent" con las columnas que ya existen.
-- La tabla crm_messages ya tiene RLS por dueño; columnas nuevas no
-- necesitan políticas nuevas.

alter table public.crm_messages
  add column if not exists send_state text not null default '',
  add column if not exists send_error text not null default '',
  add column if not exists send_via text not null default '',
  add column if not exists dispatched_at timestamptz;
