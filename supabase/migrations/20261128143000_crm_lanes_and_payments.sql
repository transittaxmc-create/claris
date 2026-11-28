-- CRM lanes + payments (PC-1, 2026-11-28) — ADDITIVE ONLY.
-- Nothing here renames, drops or re-checks existing columns. In
-- particular the crm_messages.channel CHECK ('SMS','WhatsApp','Other')
-- is NOT touched, so /api/crm/incoming keeps working unchanged.
-- The new app works fully WITHOUT this migration (lane/payment extras
-- live in the local record); running it lets those extras sync to the
-- cloud and turns on Realtime for crm_messages.

-- ── crm_messages: lane / function / external identity ──────────────
alter table public.crm_messages add column if not exists lane text;
alter table public.crm_messages add column if not exists fn text;
alter table public.crm_messages add column if not exists ext_source text;
alter table public.crm_messages add column if not exists ext_id text;

do $$
begin
  alter table public.crm_messages
    add constraint crm_messages_lane_check
    check (lane is null or lane in ('sms_transport', 'wa_business_transport', 'wa_personal'));
exception when duplicate_object then null;
end $$;

create index if not exists crm_messages_user_lane_idx
  on public.crm_messages (user_id, lane);

-- One cloud row per external message (dedupe for webhook re-deliveries).
create unique index if not exists crm_messages_ext_identity_uidx
  on public.crm_messages (user_id, ext_source, ext_id)
  where ext_id is not null and ext_id <> '';

-- ── crm_reservations: fare / payment / stage extras ────────────────
alter table public.crm_reservations add column if not exists fare numeric;
alter table public.crm_reservations add column if not exists paid boolean not null default false;
alter table public.crm_reservations add column if not exists paid_at timestamptz;
alter table public.crm_reservations add column if not exists payment_method text;
alter table public.crm_reservations add column if not exists pay_via text;
alter table public.crm_reservations add column if not exists pay_ref text;
alter table public.crm_reservations add column if not exists cash_tendered numeric;
alter table public.crm_reservations add column if not exists cash_change numeric;
alter table public.crm_reservations add column if not exists receipt_choice text;
alter table public.crm_reservations add column if not exists stage text;
alter table public.crm_reservations add column if not exists tolls numeric;
alter table public.crm_reservations add column if not exists wait_minutes text;

-- ── crm_groups (broadcast groups per lane/function) ────────────────
create table if not exists public.crm_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  lane text,
  fn text,
  member_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_groups enable row level security;
grant select, insert, update, delete on public.crm_groups to authenticated;

drop policy if exists "crm_groups_select_own" on public.crm_groups;
create policy "crm_groups_select_own" on public.crm_groups
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "crm_groups_insert_own" on public.crm_groups;
create policy "crm_groups_insert_own" on public.crm_groups
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "crm_groups_update_own" on public.crm_groups;
create policy "crm_groups_update_own" on public.crm_groups
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "crm_groups_delete_own" on public.crm_groups;
create policy "crm_groups_delete_own" on public.crm_groups
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ── crm_blocks (agenda: day off / personal / linked reservation) ───
create table if not exists public.crm_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null default '',
  kind text,
  label text,
  note text,
  res_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_blocks enable row level security;
grant select, insert, update, delete on public.crm_blocks to authenticated;

drop policy if exists "crm_blocks_select_own" on public.crm_blocks;
create policy "crm_blocks_select_own" on public.crm_blocks
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "crm_blocks_insert_own" on public.crm_blocks;
create policy "crm_blocks_insert_own" on public.crm_blocks
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "crm_blocks_update_own" on public.crm_blocks;
create policy "crm_blocks_update_own" on public.crm_blocks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "crm_blocks_delete_own" on public.crm_blocks;
create policy "crm_blocks_delete_own" on public.crm_blocks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ── crm_settings (vehicle + payment info, one row per owner) ───────
create table if not exists public.crm_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vehicle jsonb not null default '{}'::jsonb,
  payment jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_settings enable row level security;
grant select, insert, update, delete on public.crm_settings to authenticated;

drop policy if exists "crm_settings_select_own" on public.crm_settings;
create policy "crm_settings_select_own" on public.crm_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "crm_settings_insert_own" on public.crm_settings;
create policy "crm_settings_insert_own" on public.crm_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "crm_settings_update_own" on public.crm_settings;
create policy "crm_settings_update_own" on public.crm_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "crm_settings_delete_own" on public.crm_settings;
create policy "crm_settings_delete_own" on public.crm_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ── Realtime: live inbox (PC-8) ────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.crm_messages;
exception when duplicate_object then null;
end $$;
