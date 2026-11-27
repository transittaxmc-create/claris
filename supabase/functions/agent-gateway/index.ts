import { createClient } from "npm:@supabase/supabase-js@2.119.2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const EVENT_TYPES = new Set([
  "task.created", "task.claimed", "task.heartbeat", "task.progress", "task.blocked",
  "task.completed", "task.failed", "approval.requested", "approval.granted", "approval.denied",
  "agent.checkpoint.recorded", "agent.message.sent", "agent.message.acknowledged",
  "channel.status.changed", "deployment.observed", "test.completed",
])
const DOMAINS = new Set(["platform", "transport", "taxes", "communications", "documents"])
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
const hasScope = (agent: AgentIdentity, scope: string) => agent.scopes.includes(scope)
const inDomain = (agent: AgentIdentity, domain: string) =>
  agent.domain_scopes.includes(domain) || agent.domain_scopes.includes("platform")

type AgentIdentity = {
  agent_id: string
  display_name: string
  scopes: string[]
  domain_scopes: string[]
  status: string
}

async function authenticate(req: Request): Promise<AgentIdentity | null> {
  const raw = req.headers.get("x-agent-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  if (!raw || raw.length < 40 || raw.length > 200) return null
  const hash = await sha256(raw)
  const { data, error } = await supabase
    .from("agent_identities")
    .select("agent_id,display_name,scopes,domain_scopes,status")
    .eq("key_hash", hash)
    .eq("status", "active")
    .maybeSingle()
  if (error || !data) return null
  await supabase.from("agent_identities").update({ last_seen_at: new Date().toISOString() }).eq("agent_id", data.agent_id)
  return data as AgentIdentity
}

async function appendEvent(
  actor: string,
  eventType: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  taskId: string | null = null,
  requestId = crypto.randomUUID(),
) {
  if (!EVENT_TYPES.has(eventType)) throw new Error("invalid_event_type")
  const row = {
    actor_agent_id: actor,
    event_type: eventType,
    payload,
    idempotency_key: idempotencyKey,
    task_id: taskId,
    request_id: requestId,
  }
  const { data, error } = await supabase.from("agent_events").insert(row).select().single()
  if (!error) return data
  if (error.code === "23505") {
    const { data: existing } = await supabase.from("agent_events")
      .select().eq("actor_agent_id", actor).eq("idempotency_key", idempotencyKey).maybeSingle()
    if (existing) return existing
  }
  throw new Error("event_persistence_failed")
}

function validIdempotency(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(value)
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function cleanPayload(value: unknown): value is Record<string, unknown> {
  return object(value) && JSON.stringify(value).length <= 16_384
}

async function continuity(agent: AgentIdentity) {
  const [eventsResult, tasksResult, channelsResult, approvalsResult, inboxResult, checkpointsResult, projectResult] = await Promise.all([
    supabase.from("agent_events").select("sequence,id,actor_agent_id,event_type,task_id,payload,request_id,created_at")
      .order("sequence", { ascending: false }).limit(500),
    supabase.from("agent_tasks").select("*")
      .not("status", "in", '("completed","failed","cancelled")')
      .order("created_at", { ascending: false }).limit(200),
    supabase.from("agent_channel_states").select("*").order("channel"),
    supabase.from("agent_approvals").select("id,requested_by_agent_id,action,payload,target,status,requested_at,expires_at,decided_by_user_id,decided_at,decision_note")
      .order("requested_at", { ascending: false }).limit(100),
    supabase.from("agent_messages").select("id,sender_agent_id,recipient_agent_id,message_type,subject,body,status,sent_at,acknowledged_at,acknowledgement")
      .eq("recipient_agent_id", agent.agent_id).eq("status", "pending").order("sent_at", { ascending: false }).limit(100),
    supabase.from("agent_latest_checkpoints").select("*").order("agent_id"),
    supabase.from("agent_project_state").select("*").eq("project_id", "copiloto-v7").maybeSingle(),
  ])
  const error = eventsResult.error ?? tasksResult.error ?? channelsResult.error ??
    approvalsResult.error ?? inboxResult.error ?? checkpointsResult.error ?? projectResult.error
  if (error) throw new Error("continuity_read_failed")
  return {
    ok: true,
    project: "copiloto-v7",
    source: "supabase-persistent-event-store",
    recoveredFor: agent.agent_id,
    recoveredAt: new Date().toISOString(),
    projectState: projectResult.data ?? null,
    events: (eventsResult.data ?? []).reverse(),
    tasks: (tasksResult.data ?? []).filter((task) => inDomain(agent, task.domain)),
    checkpoints: checkpointsResult.data ?? [],
    decisions: approvalsResult.data ?? [],
    pendingApprovals: (approvalsResult.data ?? []).filter((approval) => approval.status === "pending"),
    inbox: inboxResult.data ?? [],
    channels: channelsResult.data ?? [],
    nextAction: "Read the latest confirmed checkpoint and open tasks; do not perform external actions without an explicit human approval.",
  }
}

Deno.serve(async (req: Request) => {
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "gateway_not_configured" }, 503)
  if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)

  const agent = await authenticate(req)
  if (!agent) return json({ ok: false, error: "agent_authentication_failed" }, 401)

  const url = new URL(req.url)
  const op = url.searchParams.get("op") ?? (req.method === "GET" ? "continuity" : "")
  const incomingRequestId = req.headers.get("x-request-id") || ""
  const requestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID()

  try {
    if (req.method === "GET") {
      if (op === "status") {
        return json({ ok: true, project: "copiloto-v7", agentId: agent.agent_id, displayName: agent.display_name, scopes: agent.scopes, domainScopes: agent.domain_scopes })
      }
      if (op === "continuity") {
        if (!hasScope(agent, "continuity:read")) return json({ ok: false, error: "scope_denied" }, 403)
        return json(await continuity(agent))
      }
      if (op === "tasks") {
        if (!hasScope(agent, "tasks:read")) return json({ ok: false, error: "scope_denied" }, 403)
        const { data, error } = await supabase.from("agent_tasks").select("*").not("status", "in", '("completed","failed","cancelled")').order("created_at", { ascending: false }).limit(200)
        if (error) throw new Error("task_read_failed")
        return json({ ok: true, tasks: (data ?? []).filter((t) => inDomain(agent, t.domain)) })
      }
      if (op === "inbox") {
        if (!hasScope(agent, "messages:read")) return json({ ok: false, error: "scope_denied" }, 403)
        const { data, error } = await supabase.from("agent_messages").select("*").eq("recipient_agent_id", agent.agent_id).order("sent_at", { ascending: false }).limit(100)
        if (error) throw new Error("inbox_read_failed")
        return json({ ok: true, messages: data ?? [] })
      }
      return json({ ok: false, error: "unknown_operation" }, 400)
    }

    let body: Record<string, unknown>
    try {
      const parsed = await req.json()
      if (!object(parsed)) return json({ ok: false, error: "invalid_json_body" }, 400)
      body = parsed
    } catch {
      return json({ ok: false, error: "invalid_json_body" }, 400)
    }
    const action = body.action

    if (action === "event.append") {
      if (!hasScope(agent, "events:append")) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.type !== "string" || !["task.progress","task.blocked","task.failed","agent.checkpoint.recorded"].includes(body.type) || !validIdempotency(body.idempotencyKey) || !cleanPayload(body.payload)) return json({ ok: false, error: "invalid_event" }, 400)
      if (["actorAgentId","actorAuthUserId","userId","ownerId","createdAt","sequence","projectId"].some((key) => key in (body.payload as Record<string, unknown>))) return json({ ok: false, error: "untrusted_identity_field" }, 400)
      if (body.taskId !== undefined && typeof body.taskId !== "string") return json({ ok: false, error: "invalid_task_id" }, 400)
      const event = await appendEvent(agent.agent_id, body.type, body.payload, body.idempotencyKey, (body.taskId as string) ?? null, requestId)
      return json({ ok: true, event, confirmed: true })
    }

    if (action === "task.create") {
      if (!hasScope(agent, "tasks:create")) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 240 ||
          typeof body.domain !== "string" || !DOMAINS.has(body.domain) || !inDomain(agent, body.domain) ||
          !validIdempotency(body.idempotencyKey)) return json({ ok: false, error: "invalid_task" }, 400)
      const assigned = typeof body.assignedAgentId === "string" ? body.assignedAgentId : null
      if (assigned) {
        const { data: recipient } = await supabase.from("agent_identities").select("agent_id,status").eq("agent_id", assigned).eq("status", "active").maybeSingle()
        if (!recipient) return json({ ok: false, error: "unknown_assignee" }, 400)
      }
      const { data: task, error } = await supabase.from("agent_tasks").insert({
        title: body.title.trim(), description: typeof body.description === "string" ? body.description.slice(0, 4000) : "",
        domain: body.domain, assigned_agent_id: assigned, idempotency_key: body.idempotencyKey,
        created_by_agent_id: agent.agent_id, max_attempts: Number.isInteger(body.maxAttempts) ? Math.min(10, Math.max(1, Number(body.maxAttempts))) : 3,
      }).select().single()
      if (error?.code === "23505") {
        const { data: existing } = await supabase.from("agent_tasks").select("*").eq("created_by_agent_id", agent.agent_id).eq("idempotency_key", body.idempotencyKey).maybeSingle()
        if (existing) return json({ ok: true, task: existing, duplicate: true, confirmed: true })
      }
      if (error || !task) throw new Error("task_create_failed")
      await appendEvent(agent.agent_id, "task.created", { title: task.title, domain: task.domain, assignedAgentId: assigned }, "task-created:" + task.id, task.id, requestId)
      return json({ ok: true, task, confirmed: true }, 201)
    }

    if (action === "task.claim" || action === "task.heartbeat") {
      const scope = action === "task.claim" ? "tasks:claim" : "tasks:heartbeat"
      if (!hasScope(agent, scope)) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.taskId !== "string") return json({ ok: false, error: "invalid_task_id" }, 400)
      const seconds = Number.isInteger(body.leaseSeconds) ? Number(body.leaseSeconds) : 120
      const { data: targetTask, error: targetError } = await supabase.from("agent_tasks").select("domain").eq("id", body.taskId).maybeSingle()
      if (targetError || !targetTask) return json({ ok: false, error: "task_not_found" }, 404)
      if (!inDomain(agent, targetTask.domain)) return json({ ok: false, error: "domain_denied" }, 403)
      const rpc = action === "task.claim" ? "agent_claim_task" : "agent_heartbeat_task"
      const { data, error } = await supabase.rpc(rpc, { p_agent_id: agent.agent_id, p_task_id: body.taskId, p_lease_seconds: seconds })
      if (error) throw new Error("task_lease_operation_failed")
      const task = Array.isArray(data) ? data[0] : data
      if (!task) return json({ ok: false, error: action === "task.claim" ? "task_not_claimable" : "lease_not_owned" }, 409)
      await appendEvent(agent.agent_id, action === "task.claim" ? "task.claimed" : "task.heartbeat", { leaseExpiresAt: task.lease_expires_at }, action + ":" + task.id + ":" + task.heartbeat_at, task.id, requestId)
      return json({ ok: true, task, confirmed: true })
    }

    if (action === "task.complete") {
      if (!hasScope(agent, "tasks:heartbeat")) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.taskId !== "string" || !cleanPayload(body.result ?? {})) return json({ ok: false, error: "invalid_completion" }, 400)
      const { data: targetTask } = await supabase.from("agent_tasks").select("domain").eq("id", body.taskId).maybeSingle()
      if (!targetTask || !inDomain(agent, targetTask.domain)) return json({ ok: false, error: "domain_denied" }, 403)
      const { data: task, error } = await supabase.from("agent_tasks").update({
        status: "completed", result: body.result ?? {}, completed_at: new Date().toISOString(),
        lease_owner_agent_id: null, lease_expires_at: null, updated_at: new Date().toISOString(),
      }).eq("id", body.taskId).eq("lease_owner_agent_id", agent.agent_id).gt("lease_expires_at", new Date().toISOString()).select().maybeSingle()
      if (error || !task) return json({ ok: false, error: "lease_not_owned" }, 409)
      await appendEvent(agent.agent_id, "task.completed", { result: task.result }, "task-completed:" + task.id, task.id, requestId)
      return json({ ok: true, task, confirmed: true })
    }

    if (action === "message.send") {
      if (!hasScope(agent, "messages:send")) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.recipientAgentId !== "string" || typeof body.subject !== "string" ||
          !body.subject.trim() || body.subject.length > 200 || !validIdempotency(body.idempotencyKey) ||
          !cleanPayload(body.body ?? {})) return json({ ok: false, error: "invalid_message" }, 400)
      const { data: recipient } = await supabase.from("agent_identities").select("agent_id,status").eq("agent_id", body.recipientAgentId).eq("status", "active").maybeSingle()
      if (!recipient || recipient.agent_id === agent.agent_id) return json({ ok: false, error: "invalid_recipient" }, 400)
      const { data: message, error } = await supabase.from("agent_messages").insert({
        sender_agent_id: agent.agent_id, recipient_agent_id: recipient.agent_id,
        message_type: typeof body.messageType === "string" && ["task_handoff","status","question","result","checkpoint","system"].includes(body.messageType) ? body.messageType : "status",
        subject: body.subject.trim(), body: body.body ?? {}, idempotency_key: body.idempotencyKey,
      }).select().single()
      if (error?.code === "23505") {
        const { data: existing } = await supabase.from("agent_messages").select("*").eq("sender_agent_id", agent.agent_id).eq("idempotency_key", body.idempotencyKey).maybeSingle()
        if (existing) return json({ ok: true, message: existing, duplicate: true, confirmed: true })
      }
      if (error || !message) throw new Error("message_send_failed")
      await appendEvent(agent.agent_id, "agent.message.sent", { messageId: message.id, recipientAgentId: recipient.agent_id, subject: message.subject }, "message-sent:" + message.id, null, requestId)
      return json({ ok: true, message, confirmed: true }, 201)
    }

    if (action === "message.ack") {
      if (!hasScope(agent, "messages:ack")) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.messageId !== "string" || !["acknowledged","rejected","completed"].includes(String(body.status))) return json({ ok: false, error: "invalid_acknowledgement" }, 400)
      const { data: message, error } = await supabase.from("agent_messages").update({
        status: body.status, acknowledged_at: new Date().toISOString(),
        acknowledgement: typeof body.note === "string" ? body.note.slice(0, 1000) : "",
      }).eq("id", body.messageId).eq("recipient_agent_id", agent.agent_id).eq("status", "pending").select().maybeSingle()
      if (error || !message) return json({ ok: false, error: "message_not_pending_or_not_yours" }, 409)
      await appendEvent(agent.agent_id, "agent.message.acknowledged", { messageId: message.id, senderAgentId: message.sender_agent_id, status: message.status }, "message-ack:" + message.id, null, requestId)
      return json({ ok: true, message, confirmed: true })
    }

    if (action === "approval.request") {
      if (!hasScope(agent, "approvals:request")) return json({ ok: false, error: "scope_denied" }, 403)
      if (typeof body.actionName !== "string" || typeof body.target !== "string" || !cleanPayload(body.payload)) return json({ ok: false, error: "invalid_approval_request" }, 400)
      const ttl = Number.isInteger(body.expiresInMinutes) ? Math.min(10080, Math.max(5, Number(body.expiresInMinutes))) : 1440
      const expires = new Date(Date.now() + ttl * 60_000).toISOString()
      const { data: approval, error } = await supabase.from("agent_approvals").insert({
        requested_by_agent_id: agent.agent_id, action: body.actionName.slice(0, 120),
        target: body.target.slice(0, 500), payload: body.payload, expires_at: expires,
      }).select().single()
      if (error || !approval) throw new Error("approval_request_failed")
      await appendEvent(agent.agent_id, "approval.requested", { approvalId: approval.id, action: approval.action, target: approval.target }, "approval-request:" + approval.id, null, requestId)
      return json({ ok: true, approval, confirmed: true }, 201)
    }

    if (action === "channel.update") {
      return json({ ok: false, error: "provider_confirmation_required" }, 403)
    }

    return json({ ok: false, error: "unknown_action" }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : "gateway_internal_error"
    return json({ ok: false, error: message }, message === "continuity_read_failed" ? 503 : 500)
  }
})
