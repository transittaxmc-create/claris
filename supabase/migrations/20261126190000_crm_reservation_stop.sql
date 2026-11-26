-- CRM — parada intermedia opcional en reservas (sugerencia de Miguel,
-- 2026-11-26): la reserva puede llevar una parada verificada entre la
-- recogida y el destino, y los botones GPS abren la ruta completa
-- recogida → parada → destino. SOLO proyecto Supabase exclusivo del
-- CRM (mimgwleghecseoymgdug). NO tocar el Supabase financiero.
--
-- Aplicación: pegar en el SQL Editor del proyecto del CRM y ejecutar.
-- El código del deploy del paquete del formulario degrada sin romper
-- si esta migración aún no se aplicó: la ruta /api/crm/state reintenta
-- las reservas sin la columna nueva y la parada queda solo en el
-- dispositivo; en cuanto la columna exista, la parada viaja a la nube
-- como cualquier otro campo de la reserva.
-- La tabla crm_reservations ya tiene RLS por dueño; una columna nueva
-- no necesita políticas nuevas.

alter table public.crm_reservations
  add column if not exists stop_address text not null default '';
