import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"
import {
  clientToRow,
  reservationToRow,
  rowToClient,
  rowToReservation,
  type CrmClientLike,
  type CrmReservationLike,
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
  return NextResponse.json({
    ok: true,
    clients: (clientsRes.data || []).map((r) => rowToClient(r as never)),
    reservations: (reservationsRes.data || []).map((r) => rowToReservation(r as never)),
  })
}

type SyncBody = {
  upsertClients?: CrmClientLike[]
  deleteClientIds?: string[]
  upsertReservations?: CrmReservationLike[]
  deleteReservationIds?: string[]
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
      if (error) throw error
    }
    if (Array.isArray(body.upsertReservations) && body.upsertReservations.length) {
      const rows = body.upsertReservations.map((r) => ({ ...reservationToRow(r), user_id: userId }))
      const { error } = await supabase.from("crm_reservations").upsert(rows, { onConflict: "id" })
      if (error) throw error
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
  // Conteo de verificación: la pantalla lo compara contra su lista local
  // antes de dar la migración/sync por buena (regla del manual).
  const [clientsCount, reservationsCount] = await Promise.all([
    supabase.from("crm_clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("crm_reservations").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ])
  return NextResponse.json({
    ok: true,
    counts: { clients: clientsCount.count ?? null, reservations: reservationsCount.count ?? null },
  })
}
