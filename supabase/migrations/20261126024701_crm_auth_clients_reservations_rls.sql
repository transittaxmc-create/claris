create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  company text not null default '',
  phone text not null default '',
  email text not null default '',
  status text not null default 'Lead' check (status in ('Lead','Active','Follow-up','Inactive')),
  source text not null default 'Referral',
  notes text not null default '',
  next_contact date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.crm_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid,
  passenger_name text not null default '',
  passenger_phone text not null default '',
  service_date date not null default current_date,
  pickup_time text not null default '',
  passengers integer not null default 1 check (passengers >= 1),
  status text not null default 'Requested' check (status in ('Requested','Confirmed','Completed','Cancelled')),
  pickup_kind text not null default 'standard' check (pickup_kind in ('standard','airport')),
  pickup_address text not null default '',
  dropoff_address text not null default '',
  airport text not null default '',
  airline text not null default '',
  flight_number text not null default '',
  flight_date date,
  scheduled_arrival text not null default '',
  terminal text not null default '',
  gate text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_reservations_client_owner_fk
    foreign key (client_id, user_id)
    references public.crm_clients(id, user_id)
    on delete set null (client_id)
);

create index if not exists crm_clients_user_created_idx
  on public.crm_clients (user_id, created_at desc);
create index if not exists crm_clients_user_followup_idx
  on public.crm_clients (user_id, next_contact)
  where next_contact is not null;
create index if not exists crm_reservations_user_service_idx
  on public.crm_reservations (user_id, service_date, pickup_time);
create index if not exists crm_reservations_client_idx
  on public.crm_reservations (client_id)
  where client_id is not null;

alter table public.crm_clients enable row level security;
alter table public.crm_reservations enable row level security;

grant select, insert, update, delete on public.crm_clients to authenticated;
grant select, insert, update, delete on public.crm_reservations to authenticated;

create policy "crm_clients_select_own"
  on public.crm_clients for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "crm_clients_insert_own"
  on public.crm_clients for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "crm_clients_update_own"
  on public.crm_clients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "crm_clients_delete_own"
  on public.crm_clients for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "crm_reservations_select_own"
  on public.crm_reservations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "crm_reservations_insert_own"
  on public.crm_reservations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.crm_clients c
        where c.id = client_id and c.user_id = (select auth.uid())
      )
    )
  );
create policy "crm_reservations_update_own"
  on public.crm_reservations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.crm_clients c
        where c.id = client_id and c.user_id = (select auth.uid())
      )
    )
  );
create policy "crm_reservations_delete_own"
  on public.crm_reservations for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
