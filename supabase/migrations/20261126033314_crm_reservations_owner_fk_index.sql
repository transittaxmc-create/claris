-- Cover the composite reservation-to-client ownership foreign key.
create index if not exists crm_reservations_client_owner_idx
  on public.crm_reservations (client_id, user_id);
