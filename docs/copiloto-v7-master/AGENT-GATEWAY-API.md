# Agent Gateway API — Copiloto V7

## Endpoint
Supabase Edge Function:
https://mimgwleghecseoymgdug.supabase.co/functions/v1/agent-gateway

Header on every request: x-agent-key: <individual machine credential>.
Never place a key in a URL, source file, issue, screenshot, or log. ChatGPT and Muse have different keys. Keys are shown once at provisioning and only SHA-256 hashes are stored.

## Read operations
- GET ?op=status — identity and scopes.
- GET ?op=continuity — project state, last 500 events, active tasks in allowed domains, latest checkpoints, approvals/decisions, inbox and separate channel states.
- GET ?op=tasks — open tasks filtered by domain scope.
- GET ?op=inbox — messages addressed to this agent.

## Write operations
POST JSON body:
- task.create: title, domain, idempotencyKey, optional description, assignedAgentId, maxAttempts.
- task.claim: taskId, optional leaseSeconds (30–600).
- task.heartbeat: taskId, optional leaseSeconds.
- task.complete: taskId, result; only the current lease owner may complete.
- event.append: permitted types are task.progress, task.blocked, task.failed, agent.checkpoint.recorded; identity/server fields are rejected.
- message.send: recipientAgentId, subject, body, idempotencyKey, optional messageType.
- message.ack: messageId, status (acknowledged, rejected, completed), optional note.
- approval.request: actionName, target, payload, optional expiresInMinutes.

Successful writes return confirmed: true with the persisted row. A 2xx response is the server's confirmation of persistence, not proof of an external provider action. Agent messages are internal only.

## Example checkpoint
POST body:
{
  "action": "event.append",
  "type": "agent.checkpoint.recorded",
  "idempotencyKey": "chatgpt-20261127-checkpoint-01",
  "payload": {
    "summary": "Confirmed state and evidence",
    "pendingTaskIds": [],
    "nextAction": "Next authorized step"
  }
}

## Example agent-to-agent handshake
Sender calls message.send; recipient reads ?op=inbox and calls message.ack. The sender can then retrieve the message status. Both send and acknowledgement are stored as rows and events.

## Railway review proxy
- GET /api/agent-gateway/recovery — authenticated continuity proxy.
- GET /api/agent-gateway/bridge?op=status|tasks|inbox — authenticated reads.
- POST /api/agent-gateway/bridge — authenticated writes.
- POST /api/agent-gateway/events — event write proxy.
The public GET /api/agent-gateway/continuity remains a documentation-only endpoint; it does not expose private event data.

## Authentication / revocation
Each machine key is 256-bit random material; the database stores only SHA-256. The handler resolves actor/scopes from the key hash and ignores caller-supplied actor identity. Missing, invalid, revoked or disabled keys return 401. To revoke one identity set status='revoked' on that row. Rotation requires generating a new random key, replacing key_hash, then securely updating that agent's secret store.

## Current limitation
The REST API is deployed and authenticated at the handler level. Successful HTTP calls with both live agent keys and automatic fresh-session connector invocation still require E2E verification in the ChatGPT and Muse runtimes.
