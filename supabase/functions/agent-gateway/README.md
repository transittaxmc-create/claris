# Supabase Edge Function: agent-gateway

Source recovered from CRM project `mimgwleghecseoymgdug` on 2026-11-27.

- Observed deployed function version: 4.
- Runtime entrypoint: `index.ts`.
- Secret values are not included; required variables are read from the runtime environment.
- The recovered implementation uses per-agent machine keys verified by SHA-256 against `public.agent_identities.key_hash` and accepts `x-agent-key` or Bearer authentication.
- This is a faithful source snapshot of the deployed implementation, not a claim that it matches the Supabase Auth/JWT architecture in Issue #87. Reconcile that design before broad enablement or production use.
