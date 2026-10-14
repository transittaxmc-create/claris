create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  bank_account varchar(100) default 'Chase Business',
  detail_primary varchar(150) not null default '',
  detail_secondary varchar(150) default '',
  amount numeric(12,2) not null default 0,
  daily_balance numeric(12,2) not null default 0,
  has_receipt boolean default false,
  receipt_url text,
  reconciled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bank_transactions add column if not exists detail varchar(150);
alter table public.bank_transactions add column if not exists detail_primary varchar(150);
alter table public.bank_transactions add column if not exists detail_secondary varchar(150);
alter table public.bank_transactions add column if not exists reconciled boolean default false;
update public.bank_transactions set detail_primary = coalesce(nullif(detail_primary, ''), detail, 'Movimiento bancario') where detail_primary is null or detail_primary = '';

create table if not exists public.cash_flow_projections (
  id uuid primary key default gen_random_uuid(),
  origin_module varchar(20) not null,
  origin_id varchar(100),
  due_date date not null default current_date,
  detail_primary varchar(150) not null,
  detail_secondary varchar(150),
  amount numeric(12,2) not null,
  status varchar(20) default 'pending',
  matched_transaction_id uuid references public.bank_transactions(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists bank_transactions_date_idx on public.bank_transactions (date desc);
create index if not exists cash_flow_projections_pending_idx on public.cash_flow_projections (status, due_date);

-- Existing application writes through the server route using the service role.
-- Keep RLS enabled so these tables are not publicly readable through Data API.
alter table public.bank_transactions enable row level security;
alter table public.cash_flow_projections enable row level security;
