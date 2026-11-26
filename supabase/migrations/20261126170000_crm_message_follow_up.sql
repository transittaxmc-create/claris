-- CRM — marca de seguimiento (follow-up) en mensajes (orden de Miguel,
-- 2026-11-26): un mensaje ya enviado puede marcarse "necesita seguimiento"
-- para que no se pierda. SOLO proyecto Supabase exclusivo del CRM
-- (mimgwleghecseoymgdug). NO tocar el Supabase financiero.
--
-- Aplicación: pegar en el SQL Editor del proyecto del CRM y ejecutar.
-- El código del deploy de los tres botones (Reenviar / estatus en ficha /
-- follow-up) degrada sin romper si esta migración aún no se aplicó: la
-- ruta /api/crm/state reintenta los mensajes sin la columna nueva y la
-- marca queda solo en el dispositivo; en cuanto la columna exista, la
-- marca viaja a la nube como cualquier otro campo del mensaje.
-- La tabla crm_messages ya tiene RLS por dueño; una columna nueva no
-- necesita políticas nuevas.

alter table public.crm_messages
  add column if not exists needs_follow_up boolean not null default false;
