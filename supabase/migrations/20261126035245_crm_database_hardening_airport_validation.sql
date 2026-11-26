-- Harden the new CRM database and enforce airport flight details.
REVOKE ALL PRIVILEGES ON TABLE public.crm_clients, public.crm_reservations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_clients, public.crm_reservations TO authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.crm_clients, public.crm_reservations FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;

ALTER TABLE public.crm_reservations
  ADD CONSTRAINT crm_reservations_airport_flight_required
  CHECK (pickup_kind <> 'airport' OR btrim(flight_number) <> '');
