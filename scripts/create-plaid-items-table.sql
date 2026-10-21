-- Run once in Supabase SQL editor (Claris project).
-- Stores Plaid access tokens server-side only (service_role).

create table if not exists public.plaid_items (
  item_id text primary key,
  access_token text not null,
  institution_name text,
  accounts jsonb default '[]'::jsonb,
  cursor text,
  updated_at timestamptz default now()
);

alter table public.plaid_items enable row level security;

-- No public policies: only service_role (server) can read/write.
