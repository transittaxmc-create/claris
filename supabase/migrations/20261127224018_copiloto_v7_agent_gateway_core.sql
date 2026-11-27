-- Reconstructed from the live Supabase CRM catalog on 2026-11-27.
-- This is a source-recovery baseline, not the original authoring text.
-- No SQL was applied to Supabase by this recovery operation.
-- Review against Issue #87's approved Supabase Auth/JWT architecture before reuse.

CREATE TABLE public.agent_identities (
  agent_id text NOT NULL,
  display_name text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] DEFAULT '{}'::text[] NOT NULL,
  domain_scopes text[] DEFAULT '{}'::text[] NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone,
  rotated_at timestamp with time zone
);

CREATE TABLE public.agent_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text DEFAULT ''::text NOT NULL,
  domain text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  assigned_agent_id text,
  lease_owner_agent_id text,
  lease_expires_at timestamp with time zone,
  heartbeat_at timestamp with time zone,
  attempt_count integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  idempotency_key text NOT NULL,
  created_by_agent_id text NOT NULL,
  result jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone
);

CREATE TABLE public.agent_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id text DEFAULT 'copiloto-v7'::text NOT NULL,
  actor_agent_id text NOT NULL,
  event_type text NOT NULL,
  task_id uuid,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  idempotency_key text NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_identities ADD CONSTRAINT agent_identities_agent_id_check CHECK (agent_id = ANY (ARRAY['chatgpt'::text, 'muse'::text, 'amani'::text, 'system'::text]));
ALTER TABLE public.agent_identities ADD CONSTRAINT agent_identities_key_hash_check CHECK (key_hash ~ '^[0-9a-f]{64}$'::text);
ALTER TABLE public.agent_identities ADD CONSTRAINT agent_identities_key_hash_key UNIQUE (key_hash);
ALTER TABLE public.agent_identities ADD CONSTRAINT agent_identities_pkey PRIMARY KEY (agent_id);
ALTER TABLE public.agent_identities ADD CONSTRAINT agent_identities_status_check CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text, 'disabled'::text]));
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_attempt_count_check CHECK (attempt_count >= 0);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_created_by_agent_id_fkey FOREIGN KEY (created_by_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_created_by_agent_id_idempotency_key_key UNIQUE (created_by_agent_id, idempotency_key);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_domain_check CHECK (domain = ANY (ARRAY['platform'::text, 'transport'::text, 'taxes'::text, 'communications'::text, 'documents'::text]));
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_idempotency_key_check CHECK (length(idempotency_key) >= 8 AND length(idempotency_key) <= 128);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_lease_owner_agent_id_fkey FOREIGN KEY (lease_owner_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_max_attempts_check CHECK (max_attempts >= 1 AND max_attempts <= 10);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_status_check CHECK (status = ANY (ARRAY['pending'::text, 'claimed'::text, 'in_progress'::text, 'awaiting_approval'::text, 'blocked'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));
ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_title_check CHECK (length(btrim(title)) >= 1 AND length(btrim(title)) <= 240);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_actor_agent_id_fkey FOREIGN KEY (actor_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_actor_agent_id_idempotency_key_key UNIQUE (actor_agent_id, idempotency_key);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_event_type_check CHECK (event_type = ANY (ARRAY['task.created'::text, 'task.claimed'::text, 'task.heartbeat'::text, 'task.progress'::text, 'task.blocked'::text, 'task.completed'::text, 'task.failed'::text, 'approval.requested'::text, 'approval.granted'::text, 'approval.denied'::text, 'agent.checkpoint.recorded'::text, 'agent.message.sent'::text, 'agent.message.acknowledged'::text, 'channel.status.changed'::text, 'deployment.observed'::text, 'test.completed'::text]));
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_id_key UNIQUE (id);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_idempotency_key_check CHECK (length(idempotency_key) >= 8 AND length(idempotency_key) <= 128);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_payload_check CHECK (pg_column_size(payload) <= 16384);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_pkey PRIMARY KEY (sequence);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_project_id_check CHECK (project_id = 'copiloto-v7'::text);
ALTER TABLE public.agent_events ADD CONSTRAINT agent_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES agent_tasks(id);

CREATE INDEX agent_events_actor_sequence_idx ON public.agent_events USING btree (actor_agent_id, sequence DESC);
CREATE INDEX agent_events_task_sequence_idx ON public.agent_events USING btree (task_id, sequence DESC);
CREATE INDEX agent_events_type_sequence_idx ON public.agent_events USING btree (event_type, sequence DESC);
CREATE INDEX agent_tasks_assignee_status_idx ON public.agent_tasks USING btree (assigned_agent_id, status);
CREATE INDEX agent_tasks_lease_expiry_idx ON public.agent_tasks USING btree (lease_expires_at) WHERE (lease_expires_at IS NOT NULL);
CREATE INDEX agent_tasks_status_created_idx ON public.agent_tasks USING btree (status, created_at);

ALTER TABLE public.agent_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_identities FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_identities TO service_role;
REVOKE ALL ON TABLE public.agent_tasks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_tasks TO service_role;
REVOKE ALL ON TABLE public.agent_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_events TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.agent_events_sequence_seq TO service_role;

CREATE OR REPLACE FUNCTION public.agent_claim_task(p_agent_id text, p_task_id uuid, p_lease_seconds integer DEFAULT 120)
 RETURNS SETOF agent_tasks
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid_lease_duration';
  end if;
  return query
  update public.agent_tasks t
  set status = 'claimed',
      lease_owner_agent_id = p_agent_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      attempt_count = t.attempt_count + 1,
      updated_at = now()
  where t.id = p_task_id
    and (t.assigned_agent_id is null or t.assigned_agent_id = p_agent_id)
    and t.attempt_count < t.max_attempts
    and (
      t.status = 'pending'
      or (t.status in ('claimed','in_progress') and t.lease_expires_at < now())
    )
  returning t.*;
end $function$;
REVOKE ALL ON FUNCTION public.agent_claim_task(p_agent_id text, p_task_id uuid, p_lease_seconds integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_claim_task(p_agent_id text, p_task_id uuid, p_lease_seconds integer) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_heartbeat_task(p_agent_id text, p_task_id uuid, p_lease_seconds integer DEFAULT 120)
 RETURNS SETOF agent_tasks
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid_lease_duration';
  end if;
  return query
  update public.agent_tasks t
  set status = 'in_progress',
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      updated_at = now()
  where t.id = p_task_id
    and t.lease_owner_agent_id = p_agent_id
    and t.lease_expires_at > now()
    and t.status in ('claimed','in_progress')
  returning t.*;
end $function$;
REVOKE ALL ON FUNCTION public.agent_heartbeat_task(p_agent_id text, p_task_id uuid, p_lease_seconds integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_heartbeat_task(p_agent_id text, p_task_id uuid, p_lease_seconds integer) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_events_reject_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  raise exception 'agent_events_are_append_only';
end $function$;

CREATE TRIGGER agent_events_no_update
BEFORE DELETE OR UPDATE ON public.agent_events
FOR EACH ROW EXECUTE FUNCTION public.agent_events_reject_mutation();
