import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"
import { parseMessageForReservation } from "@/lib/crm/parse-message"

export const dynamic = "force-dynamic"

/**
 * Webhook de entrada para SMS / WhatsApp.
 * El proveedor (Twilio, Meta, etc.) llama aquí cuando llega un mensaje.
 * Se guarda en crm_messages con status "pending".
 *
 * Body esperado (flexible):
 * {
 *   channel: "sms" | "wa1" | "wa2",
 *   from: "+15551234567",
 *   fromName?: "Carlos",
 *   body: "Necesito un auto mañana 8am Midtown a JFK"
 * }
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret")
  if (secret !== process.env.CRM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { channel?: string; from?: string; fromName?: string; body?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const text = (body.body || "").trim()
  const from = (body.from || "").replace(/\D/g, "")
  if (!text || !from) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  }

  const supabase = await crmSupabaseServer()
  if (!supabase) {
    return NextResponse.json({ error: "crm_not_configured" }, { status: 503 })
  }

  const parsed = parseMessageForReservation(text)
  const isOrder = !!(parsed.pickupAddress || parsed.dropoffAddress || parsed.serviceDate)

  const { error } = await supabase.from("crm_messages").insert({
    channel: body.channel || "sms",
    from_phone: from,
    from_name: body.fromName || from,
    body: text,
    status: "pending",
    needs_follow_up: isOrder,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, isOrder })
}
