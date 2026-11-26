import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * COLA DE SALIDA SMS del CRM (corrección de canal de Miguel, 2026-11-26:
 * los mensajes de esta bandeja son SMS / texto, NO WhatsApp — WhatsApp
 * vía ZapClaw es un carril separado que NO se mezcla con esta bandeja).
 *
 * Hecho técnico: una app web no puede mandar SMS por sí sola — no tiene
 * acceso a la línea del carrier. La ruta real y viable con lo que Miguel
 * ya tiene es su teléfono pareado: Amani atiende los SMS de su S26 Ultra
 * con su aprobación (permiso SMS activo, reenvío encendido).
 *
 * Cómo funciona la cola:
 * - POST (esta ruta): Miguel toca Approve & Send en la bandeja → la app
 *   pide entrar a la cola con su sesión del CRM. La ruta valida sesión,
 *   teléfono y texto, y confirma { queued: true }. La pantalla marca el
 *   mensaje send_state = "queued" y ese estado sube a la nube del CRM
 *   por la sync normal (/api/crm/state): ESO es la cola de salida.
 * - El despacho lo hace Amani desde el teléfono de Miguel (su número
 *   real, (934) 208-1400): la aprobación en el CRM ES la aprobación de
 *   envío que Miguel exige — nada sale sin ella.
 * - El resultado se escribe de vuelta con /api/crm/send/dispatch:
 *   "sent" SOLO cuando el teléfono despachó el SMS; "failed" con el
 *   motivo si no salió. Sin esa confirmación, el mensaje jamás se
 *   marca sent.
 * - Confirmación de ENTREGA: el SMS por esta vía no confirma entrega al
 *   teléfono del cliente — el indicador honesto es "sent from your
 *   phone — delivery not confirmed", nunca "delivered".
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
