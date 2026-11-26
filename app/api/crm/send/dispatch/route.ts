import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * RESULTADO DEL DESPACHO SMS (ver /api/crm/send — la cola de salida).
 *
 * Cuando Amani despacha un mensaje de la cola desde el teléfono de
 * Miguel, el resultado real se escribe aquí, con la sesión del CRM:
 * - outcome "sending": el despacho está en curso (send_state="sending",
 *   el mensaje sigue aprobado — aún NO enviado).
 * - outcome "sent": el teléfono despachó el SMS → status="sent",
 *   sent_at y dispatched_at con la hora, send_via="phone". SOLO este
 *   paso puede poner un mensaje en "sent".
 * - outcome "failed": no salió → el mensaje queda aprobado con
 *   send_state="failed" y el motivo en send_error, listo para reintentar.
 *
 * Degradación: si la migración 20261126180000 aún no se aplicó (sin las
 * columnas send_*), el resultado "sent" se guarda con las columnas que
 * ya existen (status/sent_at) y el detalle del despacho queda pendiente
 * de la migración — el envío real no se pierde por eso.
 */

type DispatchBody = {
  messageId?: string
  outcome?: string
  error?: string
}

export async function POST(req: Request) {
  const supabase = await crmSupabaseServer()
  if (!supabase) return NextResponse.json({ ok: false, error: "crm_cloud_not_configured" }, { status: 503 })
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  const userId = (claims?.claims as { sub?: string } | undefined)?.sub
  if (claimsError || !userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  let body: DispatchBody | null = null
  try {
    body = (await req.json()) as DispatchBody
  } catch {}
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
  const messageId = String(body.messageId || "")
  const outcome = String(body.outcome || "")
  if (!messageId || !["sending", "sent", "failed"].includes(outcome)) {
    return NextResponse.json({ ok: false, error: "invalid_dispatch" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const full: Record<string, unknown> =
    outcome === "sent"
      ? { status: "sent", sent_at: now, send_state: "sent", send_error: "", send_via: "phone", dispatched_at: now, updated_at: now }
      : outcome === "sending"
        ? { send_state: "sending", send_error: "", updated_at: now }
        : { send_state: "failed", send_error: String(body.error || "The text could not be sent from the phone."), updated_at: now }

  const { data: updated, error } = await supabase
    .from("crm_messages")
    .update(full)
    .eq("user_id", userId)
    .eq("id", messageId)
    .select("id")
  if (error) {
    // Pre-migración 20261126180000: sin columnas send_* — se guarda lo
    // que ya existe. "sending"/"failed" sin columnas no dejan rastro en
    // la nube (quedan en el resultado de esta llamada), "sent" sí.
    if (outcome === "sent") {
      const legacy = await supabase
        .from("crm_messages")
        .update({ status: "sent", sent_at: now, updated_at: now })
        .eq("user_id", userId)
        .eq("id", messageId)
        .select("id")
      if (legacy.error || !legacy.data?.length) {
        return NextResponse.json({ ok: false, error: "dispatch_write_failed" }, { status: 502 })
      }
      return NextResponse.json({ ok: true, outcome, degraded: true })
    }
    return NextResponse.json({ ok: false, error: "dispatch_columns_pending" }, { status: 409 })
  }
  if (!updated || !updated.length) {
    return NextResponse.json({ ok: false, error: "message_not_found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, outcome })
}
