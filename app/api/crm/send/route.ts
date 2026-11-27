import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * CRM SMS outbox endpoint.
 *
 * This route authenticates the CRM owner, validates the destination and text,
 * and verifies that the message exists in the owner's CRM cloud. It returns
 * queued=true so the approved draft can be stored in the CRM outbox.
 *
 * IMPORTANT: this endpoint does not contact a carrier and does not send SMS.
 * No Twilio sender or paired-phone/Amani bridge is implemented. A queued
 * message must remain visibly NOT SENT until a real sender and authenticated
 * delivery/dispatch integration are implemented and verified.
 */

async function requireSession() {
  const supabase = await crmSupabaseServer()
  if (!supabase) return { error: NextResponse.json({ error: "crm_cloud_not_configured" }, { status: 503 }) }
  const { data, error } = await supabase.auth.getClaims()
  const userId = (data?.claims as { sub?: string } | undefined)?.sub
  if (error || !userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  return { supabase, userId }
}

/** Normaliza un teléfono de cliente a dígitos: 10 dígitos → prefijo 1 (EE. UU.). */
function normalizeTo(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "")
  if (d.length === 10) d = "1" + d
  if (d.length < 8 || d.length > 15) return null
  return d
}

type QueueBody = {
  messageId?: string
  to?: string
  text?: string
}

export async function POST(req: Request) {
  const s = await requireSession()
  if ("error" in s) return s.error

  let body: QueueBody | null = null
  try {
    body = (await req.json()) as QueueBody
  } catch {}
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
  const messageId = String(body.messageId || "")
  const to = normalizeTo(String(body.to || ""))
  const text = String(body.text || "").trim()
  if (!messageId) return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 })
  if (!to) return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 })
  if (!text) return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 })
  if (text.length > 1600) return NextResponse.json({ ok: false, error: "text_too_long" }, { status: 400 })

  // El mensaje debe existir en la nube del CRM y ser de este dueño: la
  // cola vive en crm_messages (RLS + eq user_id), no en memoria.
  const { data: rows, error } = await s.supabase
    .from("crm_messages")
    .select("id")
    .eq("user_id", s.userId)
    .eq("id", messageId)
    .limit(1)
  if (error) return NextResponse.json({ ok: false, error: "queue_unavailable" }, { status: 502 })
  if (!rows || !rows.length) {
    return NextResponse.json({ ok: false, error: "message_not_in_cloud" }, { status: 409 })
  }
  return NextResponse.json({ ok: true, queued: true, to })
}
