-- Sync automático de FINANZAS entre los dos teléfonos (2026-11-26).
--
-- APLICAR EN EL PROYECTO DEL CRM (mimgwleghecseoymgdug, "Copiloto V7
-- CRM"), el mismo donde viven crm_clients / crm_reservations. Es una
-- tabla PROPIA y separada: guarda UN documento JSON por dueño (el
-- estado sincronizable de Copiloto: viajes + gastos + DINERO, ya
-- fusionado por ítem en el cliente). Las tablas del CRM no se tocan.
--
-- Por qué aquí y no en el proyecto financiero: el financiero
-- (zrcnpmipdhpjdjkfrrgt) está congelado desde el 2026-11-10 (cuota de
-- egress, 402) y hoy no acepta conexiones; el Blob de Vercel está
-- suspendido (403). Por orden de Miguel (2026-11-26) no se espera a
-- Vercel: el transporte del sync vive en este proyecto, que sí
-- responde, con el mismo modelo de seguridad del CRM (RLS por dueño,
-- sin service key).
--
-- Hasta que esta migración se aplique, /api/data/* responde 502
-- (storage_unavailable) y la app se comporta exactamente como hoy:
-- el sync queda dormido y ningún dato local se toca.

create table if not exists public.finance_sync_doc (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.finance_sync_doc enable row level security;

grant select, insert, update, delete on public.finance_sync_doc to authenticated;

drop policy if exists finance_sync_doc_select_own on public.finance_sync_doc;
create policy finance_sync_doc_select_own on public.finance_sync_doc
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists finance_sync_doc_insert_own on public.finance_sync_doc;
create policy finance_sync_doc_insert_own on public.finance_sync_doc
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists finance_sync_doc_update_own on public.finance_sync_doc;
create policy finance_sync_doc_update_own on public.finance_sync_doc
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists finance_sync_doc_delete_own on public.finance_sync_doc;
create policy finance_sync_doc_delete_own on public.finance_sync_doc
  for delete to authenticated
  using (owner_id = auth.uid());
