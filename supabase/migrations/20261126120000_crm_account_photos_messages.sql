-- CRM fases 2–5 (orden de Miguel, 2026-11-26): número de cuenta por cliente,
-- fotos de cliente en ficha/reserva (Storage privado) y bandeja de mensajes
-- "Approve & Send". SOLO proyecto Supabase exclusivo del CRM
-- (mimgwleghecseoymgdug). NO tocar el Supabase financiero.
--
-- Aplicación: pegar en el SQL Editor del proyecto del CRM y ejecutar, ANTES
-- de desplegar el código que usa estas columnas/tablas. El código nuevo
-- degrada sin romper la fase 1 si esta migración aún no se aplicó (la sync
-- de mensajes queda local y los campos nuevos no viajan), pero la
-- verificación completa exige migración + código juntos.

-- ---------------------------------------------------------------------------
-- Fase 2: número de cuenta por cliente (una cuenta por cliente, por dueño)
-- Formato elegido en la app: ICT-0001, ICT-0002, … secuencial por dueño.
-- ---------------------------------------------------------------------------
alter table public.crm_clients
  add column if not exists account_number text not null default '';

create unique index if not exists crm_clients_user_account_idx
  on public.crm_clients (user_id, account_number)
  where account_number <> '';

-- ---------------------------------------------------------------------------
-- Fase 3: fotos adjuntas (metadatos; los bytes viven en Storage, bucket
-- privado crm-client-photos, y en la caché local del dispositivo).
-- Cada elemento: { id, path, caption, createdAt } — path = ruta en el bucket
-- ("" si la foto aún solo existe en el dispositivo).
-- ---------------------------------------------------------------------------
alter table public.crm_clients
  add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.crm_reservations
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Fase 4: bandeja de mensajes "Approve & Send".
-- La app NO envía SMS/WhatsApp a clientes: esta tabla guarda el texto que
-- llegó, el borrador editable y el estado de la aprobación de Miguel
-- (pending → approved → sent / discarded). El envío real ocurre por el
-- canal aprobado fuera de la app y aquí solo se registra.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid,
  reservation_id uuid,
  channel text not null default 'SMS' check (channel in ('SMS','WhatsApp','Other')),
  from_name text not null default '',
  from_phone text not null default '',
  body text not null default '',
  draft_reply text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','sent','discarded')),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_messages_client_owner_fk
    foreign key (client_id, user_id)
    references public.crm_clients(id, user_id)
    on delete set null (client_id),
  constraint crm_messages_reservation_owner_fk
    foreign key (reservation_id, user_id)
    references public.crm_reservations(id, user_id)
    on delete set null (reservation_id)
);

create index if not exists crm_messages_user_status_idx
  on public.crm_messages (user_id, status, created_at desc);
create index if not exists crm_messages_client_idx
  on public.crm_messages (client_id)
  where client_id is not null;

alter table public.crm_messages enable row level security;

grant select, insert, update, delete on public.crm_messages to authenticated;

create policy "crm_messages_select_own"
  on public.crm_messages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "crm_messages_insert_own"
  on public.crm_messages for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "crm_messages_update_own"
  on public.crm_messages for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "crm_messages_delete_own"
  on public.crm_messages for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Fase 3 (Storage): bucket PRIVADO para las fotos que mandan los clientes.
-- Ruta de cada objeto: <user_id>/<clients|reservations>/<record_id>/<foto>.jpg
-- La primera carpeta es el dueño: las políticas solo dejan tocar la propia.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('crm-client-photos', 'crm-client-photos', false)
on conflict (id) do nothing;

create policy "crm_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'crm-client-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "crm_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'crm-client-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "crm_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'crm-client-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'crm-client-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "crm_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'crm-client-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
