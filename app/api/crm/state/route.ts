import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"
import {
  clientToRow,
  reservationToRow,
  messageToRow,
  rowToClient,
  rowToReservation,
  rowToMessage,
  type CrmClientLike,
  type CrmReservationLike,
  type CrmMessageLike,
} from "@/lib/crm/crm-cloud"

export const dynamic = "force-dynamic"

/**
 * Estado del CRM en su Supabase EXCLUSIVO (proyecto mimgwleghecseoymgdug).
 * - Sin sesión autenticada: 401. No hay service key del CRM: todo pasa
 *   por RLS con el usuario (auth.uid() = user_id), igual que el diseño
 *   del manual (Paso 2 Auth → Paso 3 tablas).
 * - El user_id se toma SIEMPRE de la sesión verificada en el servidor;
 *   nunca se acepta del cuerpo de la petición.
 * - Este archivo no toca el Supabase financiero ni app_state.
 * - Fases 2–5 (migración 20261126120000): account_number + photos en
 *   clientes, photos en reservas y tabla crm_messages. Si la migración
 *   aún no se aplicó en el proyecto, la ruta DEGRADA sin romper la fase 1:
 *   reintenta clientes/reservas sin las columnas nuevas y los mensajes
 *   quedan solo en el dispositivo (messagesPending: true).
 */

async function sessionClient() {
  const supabase = await crmSupabaseServer()
  if (!supabase) return { error: NextResponse.json({ error: "crm_cloud_not_configured" }, { status: 503 }) }
  const { data, error } = await supabase.auth.getClaims()
  const userId = (data?.claims as { sub?: string } | undefined)?.sub
  if (error || !userId) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  }
  return { supabase, userId }
}

export async function GET() {
  const s = await sessionClient()
  if ("error" in s) return s.error
  const { supabase, userId } = s
  const [clientsRes, reservationsRes] = await Promise.all([
    supabase.from("crm_clients").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("crm_reservations").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ])
  if (clientsRes.error || reservationsRes.error) {
    return NextResponse.json({ error: "crm_read_failed" }, { status: 502 })
  }
  // Mensajes: tolerante — si la tabla aún no existe (migración pendiente),
  // la bandeja queda local y el resto del estado baja igual que en fase 1.
  let messages: CrmMessageLike[] = []
  let messagesPending = false
  const messagesRes = await supabase.from("crm_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  if (messagesRes.error) {
    messagesPending = true
  } else {
    messages = (messagesRes.data || []).map((r) => rowToMessage(r as never))
  }
  return NextResponse.json({
    ok: true,
    clients: (clientsRes.data || []).map((r) => rowToClient(r as never)),
    reservations: (reservationsRes.data || []).map((r) => rowToReservation(r as never)),
    messages,
    messagesPending,
  })
}

type SyncBody = {
  upsertClients?: CrmClientLike[]
  deleteClientIds?: string[]
  upsertReservations?: CrmReservationLike[]
  deleteReservationIds?: string[]
  upsertMessages?: CrmMessageLike[]
  deleteMessageIds?: string[]
}

export async function POST(req: Request) {
  const s = await sessionClient()
  if ("error" in s) return s.error
  const { supabase, userId } = s
  let body: SyncBody | null = null
  try {
    body = (await req.json()) as SyncBody
  } catch {}
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const now = new Date().toISOString()
  try {
    if (Array.isArray(body.upsertClients) && body.upsertClients.length) {
      const rows = body.upsertClients.map((c) => ({ ...clientToRow(c), user_id: userId, updated_at: now }))
      const { error } = await supabase.from("crm_clients").upsert(rows, { onConflict: "id" })
      if (error) {
        // Degradación pre-migración: sin las columnas nuevas y reintento.
        const legacyRows = rows.map(({ account_number: _a, photos: _p, ...rest }) => rest)
        const retry = await supabase.from("crm_clients").upsert(legacyRows, { onConflict: "id" })
        if (retry.error) throw retry.error
      }
    }
    if (Array.isArray(body.upsertReservations) && body.upsertReservations.length) {
      const rows = body.upsertReservations.map((r) => ({ ...reservationToRow(r), user_id: userId }))
      const { error } = await supabase.from("crm_reservations").upsert(rows, { onConflict: "id" })
      if (error) {
        const legacyRows = rows.map(({ photos: _p, ...rest }) => rest)
        const retry = await supabase.from("crm_reservations").upsert(legacyRows, { onConflict: "id" })
        if (retry.error) throw retry.error
      }
    }
    if (Array.isArray(body.deleteClientIds) && body.deleteClientIds.length) {
      const { error } = await supabase.from("crm_clients").delete().eq("user_id", userId).in("id", body.deleteClientIds)
      if (error) throw error
    }
    if (Array.isArray(body.deleteReservationIds) && body.deleteReservationIds.length) {
      const { error } = await supabase.from("crm_reservations").delete().eq("user_id", userId).in("id", body.deleteReservationIds)
      if (error) throw error
    }
  } catch {
    return NextResponse.json({ error: "crm_write_failed" }, { status: 502 })
  }
  // Mensajes: grupo aislado — si la tabla aún no existe, NO se cae la sync
  // de clientes/reservas; la bandeja sigue local y se avisa con el conteo
  // en null + messagesPending.
  let messagesPending = false
  try {
    if (Array.isArray(body.upsertMessages) && body.upsertMessages.length) {
      const rows = body.upsertMessages.map((m) => ({ ...messageToRow(m), user_id: userId, updated_at: now }))
      const { error } = await supabase.from("crm_messages").upsert(rows, { onConflict: "id" })
      if (error) {
        // Degradación pre-migración 20261126170000: sin la columna
        // needs_follow_up y reintento — la marca de seguimiento queda en
        // el dispositivo hasta que la migración se aplique, y la sync de
        // mensajes NO se cae por eso.
        const legacyRows = rows.map(({ needs_follow_up: _f, ...rest }) => rest)
        const retry = await supabase.from("crm_messages").upsert(legacyRows, { onConflict: "id" })
        if (retry.error) throw retry.error
      }
    }
    if (Array.isArray(body.deleteMessageIds) && body.deleteMessageIds.length) {
      const { error } = await supabase.from("crm_messages").delete().eq("user_id", userId).in("id", body.deleteMessageIds)
      if (error) throw error
    }
  } catch {
    messagesPending = true
  }
  // Conteo de verificación: la pantalla lo compara contra su lista local
  // antes de dar la migración/sync por buena (regla del manual).
  const [clientsCount, reservationsCount, messagesCount] = await Promise.all([
    supabase.from("crm_clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("crm_reservations").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("crm_messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ])
  if (messagesCount.error) messagesPending = true
  return NextResponse.json({
    ok: true,
    counts: {
      clients: clientsCount.count ?? null,
      reservations: reservationsCount.count ?? null,
      messages: messagesPending ? null : (messagesCount.count ?? null),
    },
    messagesPending,
  })
}
