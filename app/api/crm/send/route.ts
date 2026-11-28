import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Authenticated, durable SMS outbox.
 *
 * A POST is the owner's explicit approval action. It records that approval
 * and the queued state in crm_messages. It NEVER sends a message.
 * Dispatch remains disabled until the original Amani/paired-phone contract
 * is recovered and an authenticated adapter is implemented.
 */

async function requireSession() {
  const supabase = await crmSupabaseServer()
  if (!supabase) return { error: NextResponse.json({ error: "crm_cloud_not_configured" }, { status: 503 }) }
  const { data, error } = await supabase.auth.getClaims()
  const userId = (data?.claims as { sub?: string } | undefined)?.sub
  if (error || !userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  return { supabase, userId }
}

function normalizeTo(raw: string): string | null {
  let digits = (raw || "").replace(/\D/g, "")
  if (digits.length === 10) digits = "1" + digits
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

type QueueBody = {
  messageId?: string
  to?: string
  text?: string
  approve?: boolean
}

export async function POST(req: Request) {
  const session = await requireSession()
  if ("error" in session) return session.error

  let body: QueueBody | null = null
  try {
    body = (await req.json()) as QueueBody
  } catch {}
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
  if (body.approve !== true) {
    return NextResponse.json({ ok: false, error: "explicit_approval_required" }, { status: 400 })
  }

  const messageId = String(body.messageId || "").trim()
  const to = normalizeTo(String(body.to || ""))
  const text = String(body.text || "").trim()
  if (!messageId) return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 })
  if (!to) return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 })
  if (!text) return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 })
  if (text.length > 1600) return NextResponse.json({ ok: false, error: "text_too_long" }, { status: 400 })

  const { data: message, error: readError } = await session.supabase
    .from("crm_messages")
    .select("id, channel, from_phone, status, send_state")
    .eq("user_id", session.userId)
    .eq("id", messageId)
    .maybeSingle()

  if (readError) {
    return NextResponse.json({ ok: false, error: "outbox_schema_or_read_unavailable" }, { status: 503 })
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: "message_not_in_cloud" }, { status: 409 })
  }
  if (String(message.channel || "").toUpperCase() !== "SMS") {
    return NextResponse.json({ ok: false, error: "sms_channel_only" }, { status: 409 })
  }
  if (normalizeTo(String(message.from_phone || "")) !== to) {
    return NextResponse.json({ ok: false, error: "recipient_mismatch" }, { status: 409 })
  }
  if (["sent", "discarded"].includes(String(message.status || "")) || message.send_state === "sent") {
    return NextResponse.json({ ok: false, error: "message_not_queueable" }, { status: 409 })
  }
  if (message.send_state === "sending") {
    return NextResponse.json({ ok: false, error: "dispatch_in_progress" }, { status: 409 })
  }
  if (message.send_state === "queued") {
    return NextResponse.json({ ok: true, queued: true, alreadyQueued: true, sent: false, to })
  }

  // The authenticated POST itself is the explicit approval action. Persist
  // the approved draft and outbox state together; never report a local-only
  // queue as durable.
  const now = new Date().toISOString()
  const { error: writeError } = await session.supabase
    .from("crm_messages")
    .update({
      status: "approved",
      approved_at: now,
      draft_reply: text,
      send_state: "queued",
      send_error: "",
      send_via: "phone",
      dispatched_at: null,
      updated_at: now,
    })
    .eq("user_id", session.userId)
    .eq("id", messageId)

  if (writeError) {
    return NextResponse.json({ ok: false, error: "outbox_write_failed" }, { status: 503 })
  }

  return NextResponse.json({
    ok: true,
    queued: true,
    sent: false,
    delivery: "not_sent",
    to,
    approvedAt: now,
  })
}
