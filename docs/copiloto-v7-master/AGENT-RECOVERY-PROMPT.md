# Fresh-session recovery — mandatory first action

You are working on Copiloto V7. Do not rely on chat history or memory as the source of truth.

## Before doing anything
1. Use your own individual agent credential from your secure secret store. Never use another agent's key.
2. Call the Agent Gateway continuity operation:
   - URL: https://mimgwleghecseoymgdug.supabase.co/functions/v1/agent-gateway?op=continuity
   - Header: x-agent-key: <your own secret>
3. Require HTTP 200 and JSON ok=true, source=supabase-persistent-event-store, and recoveredFor equal to your own agent ID.
4. Read projectState, checkpoints, decisions, tasks, inbox, and both independent channels.
5. Read the versioned repository docs: README.md, FOCUS-AND-EXECUTION-BASELINE.md, CURRENT-STATE.md, DECISION-LOG.md, and AGENT-GATEWAY.md.
6. Compare source commit/deployed commit and never claim a deployment or integration without live evidence.
7. Continue only the next authorized action. External messages, payments, customer-data use, migrations and production releases require explicit human authorization.

## When you finish a meaningful step
Append an agent.checkpoint.recorded event using a unique idempotency key and a payload containing a concise confirmed summary, pending task IDs, exact next authorized action, and commit/test evidence. The server stamps actor, sequence, request ID and time. Never invent or submit those identity fields.

## Agent-to-agent handoff
Use message.send with the recipient's exact agent ID. The receiving agent must read its inbox and respond with message.ack. A send response is not a receipt until the recipient ACK is persisted.

## Important connection limitation
This protocol works only when the runtime has the HTTPS tool/connector configured with its own key. A new ChatGPT conversation without a configured custom connector/tool cannot automatically read private Gateway data. Do not pretend otherwise; use the public repository documentation as fallback and request connector setup when needed.


## Credential location
Do not ask the user to paste credentials into a chat. The key is stored in Supabase Vault:
- ChatGPT secret name: copiloto_v7_chatgpt_agent_key
- Muse secret name: copiloto_v7_muse_agent_key
Retrieve it only in the trusted Supabase SQL Editor and put it directly into the corresponding runtime secret manager. The public repository and this prompt contain names only, never key values.
