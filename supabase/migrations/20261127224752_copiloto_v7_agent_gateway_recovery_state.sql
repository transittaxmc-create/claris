-- Reconstructed from the live Supabase CRM catalog on 2026-11-27.
-- This is a source-recovery baseline, not the original authoring text.
-- No SQL was applied to Supabase by this recovery operation.
-- Review against Issue #87's approved Supabase Auth/JWT architecture before reuse.

CREATE TABLE public.agent_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sender_agent_id text NOT NULL,
  recipient_agent_id text NOT NULL,
  message_type text NOT NULL,
  subject text NOT NULL,
  body jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  idempotency_key text NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  acknowledged_at timestamp with time zone,
  acknowledgement text
);

CREATE TABLE public.agent_approvals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  requested_by_agent_id text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL,
  target text DEFAULT ''::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  decided_by_user_id uuid,
  decided_at timestamp with time zone,
  decision_note text
);

CREATE TABLE public.agent_channel_states (
  channel text NOT NULL,
  provider text NOT NULL,
  connection_state text DEFAULT 'not_connected'::text NOT NULL,
  delivery_state text DEFAULT 'unknown'::text NOT NULL,
  last_event_at timestamp with time zone,
  last_confirmed_at timestamp with time zone,
  last_error_code text,
  updated_by_agent_id text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.agent_project_state (
  project_id text NOT NULL,
  repository text NOT NULL,
  branch text NOT NULL,
  source_commit text,
  deployed_commit text,
  environment text DEFAULT 'review'::text NOT NULL,
  deployment_status text DEFAULT 'pending'::text NOT NULL,
  verified_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_body_check CHECK (pg_column_size(body) <= 16384);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_check CHECK (sender_agent_id <> recipient_agent_id);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_idempotency_key_check CHECK (length(idempotency_key) >= 8 AND length(idempotency_key) <= 128);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_message_type_check CHECK (message_type = ANY (ARRAY['task_handoff'::text, 'status'::text, 'question'::text, 'result'::text, 'checkpoint'::text, 'system'::text]));
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_recipient_agent_id_fkey FOREIGN KEY (recipient_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_sender_agent_id_fkey FOREIGN KEY (sender_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_sender_agent_id_idempotency_key_key UNIQUE (sender_agent_id, idempotency_key);
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_status_check CHECK (status = ANY (ARRAY['pending'::text, 'acknowledged'::text, 'rejected'::text, 'completed'::text]));
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_subject_check CHECK (length(btrim(subject)) >= 1 AND length(btrim(subject)) <= 200);
ALTER TABLE public.agent_approvals ADD CONSTRAINT agent_approvals_check CHECK (expires_at > requested_at);
ALTER TABLE public.agent_approvals ADD CONSTRAINT agent_approvals_decided_by_user_id_fkey FOREIGN KEY (decided_by_user_id) REFERENCES auth.users(id);
ALTER TABLE public.agent_approvals ADD CONSTRAINT agent_approvals_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_approvals ADD CONSTRAINT agent_approvals_requested_by_agent_id_fkey FOREIGN KEY (requested_by_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_approvals ADD CONSTRAINT agent_approvals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text, 'cancelled'::text]));
ALTER TABLE public.agent_channel_states ADD CONSTRAINT agent_channel_states_channel_check CHECK (channel = ANY (ARRAY['sms'::text, 'whatsapp'::text]));
ALTER TABLE public.agent_channel_states ADD CONSTRAINT agent_channel_states_connection_state_check CHECK (connection_state = ANY (ARRAY['not_connected'::text, 'connected'::text, 'degraded'::text, 'unknown'::text]));
ALTER TABLE public.agent_channel_states ADD CONSTRAINT agent_channel_states_delivery_state_check CHECK (delivery_state = ANY (ARRAY['not_sent'::text, 'unknown'::text, 'queued'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'disabled'::text]));
ALTER TABLE public.agent_channel_states ADD CONSTRAINT agent_channel_states_pkey PRIMARY KEY (channel);
ALTER TABLE public.agent_channel_states ADD CONSTRAINT agent_channel_states_updated_by_agent_id_fkey FOREIGN KEY (updated_by_agent_id) REFERENCES agent_identities(agent_id);
ALTER TABLE public.agent_project_state ADD CONSTRAINT agent_project_state_deployment_status_check CHECK (deployment_status = ANY (ARRAY['pending'::text, 'building'::text, 'success'::text, 'failed'::text, 'unknown'::text]));
ALTER TABLE public.agent_project_state ADD CONSTRAINT agent_project_state_pkey PRIMARY KEY (project_id);
ALTER TABLE public.agent_project_state ADD CONSTRAINT agent_project_state_project_id_check CHECK (project_id = 'copiloto-v7'::text);

CREATE INDEX agent_approvals_pending_idx ON public.agent_approvals USING btree (status, expires_at) WHERE (status = 'pending'::text);
CREATE INDEX agent_messages_inbox_idx ON public.agent_messages USING btree (recipient_agent_id, status, sent_at DESC);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_channel_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_project_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_messages TO service_role;
REVOKE ALL ON TABLE public.agent_approvals FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_approvals TO service_role;
REVOKE ALL ON TABLE public.agent_channel_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_channel_states TO service_role;
REVOKE ALL ON TABLE public.agent_project_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_project_state TO service_role;

CREATE OR REPLACE VIEW public.agent_latest_checkpoints AS
 SELECT DISTINCT ON (actor_agent_id) actor_agent_id AS agent_id,
    id AS event_id,
    sequence,
    payload ->> 'summary'::text AS summary,
    COALESCE(payload -> 'pendingTaskIds'::text, '[]'::jsonb) AS pending_task_ids,
    COALESCE(payload ->> 'nextAction'::text, ''::text) AS next_action,
    created_at
   FROM agent_events
  WHERE event_type = 'agent.checkpoint.recorded'::text
  ORDER BY actor_agent_id, sequence DESC;;
REVOKE ALL ON TABLE public.agent_latest_checkpoints FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.agent_latest_checkpoints TO service_role;
