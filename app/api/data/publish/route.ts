// app/api/data/publish/route.ts
// Sync automático entre teléfonos — PUBLICAR (transporte NUEVO,
// 2026-11-26): el teléfono publica su estado sincronizable (viajes +
// gastos + DINERO, ya fusionado en el cliente con la mezcla por ítem de
// lib/sync.ts) y el documento queda guardado en Supabase, en una tabla
// PROPIA (public.finance_sync_doc) del proyecto del CRM
// (mimgwleghecseoymgdug), lógicamente separada de las tablas del CRM.
//
// Por qué este proyecto y no el financiero: el proyecto financiero
// (zrcnpmipdhpjdjkfrrgt) está congelado desde el 2026-11-10 (cuota de
// egress, 402) y hoy ni siquiera acepta conexiones (verificado
// 2026-11-26: la conexión muere desde la VM y el dominio no resuelve
// por la vía web). El Blob de Vercel también está suspendido (403
// store_suspended) — por orden de Miguel (2026-11-26) NO se espera a
// Vercel: el transporte vive en Supabase. El proyecto del CRM sí
// responde y es el mismo donde ya vive el CRM con su sesión.
//
// Seguridad, el mismo modelo del CRM: NO hay service key. La ruta usa
// el cliente de servidor del CRM (lib/crm/supabase-server), que viaja
// con la sesión de Miguel (cookies @supabase/ssr), y la tabla tiene RLS
// por dueño (owner_id = auth.uid()): cada quien solo ve SU documento.
// Encima se mantiene la llave de publicación de siempre: header
// x-data-key contra DATA_SYNC_KEY (o BANK_PUBLISH_KEY). Sin llave →
// 401; sin sesión → 401; sin configurar → 503: en todos los casos el
// cliente queda dormido y NO cambia ningún dato.
//
// Guardia anti-vacío (lección 2026-11-01/09): un documento con CERO
// ítems vivos NUNCA pisa un documento guardado que sí tiene ítems,
// salvo que traiga las lápidas (tombstones) de TODOS esos ítems — eso
// sí es un borrado legítimo hecho en el otro teléfono.
import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TABLE = "finance_sync_doc"
const MAX_BYTES = 8_000_000

function serverKey(): string {
  return process.env.DATA_SYNC_KEY || process.env.BANK_PUBLISH_KEY || ""
}

function countLive(doc: any): number {
  if (!doc || typeof doc !== "object") return 0
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  return (
    len(doc.entries) +
    len(doc.expenses) +
    len(doc.finance?.ledger) +
    len(doc.finance?.schedules)
  )
}

function liveIds(doc: any): Set<string> {
  const ids = new Set<string>()
  const add = (v: unknown) => {
    if (!Array.isArray(v)) return
    for (const t of v) {
      if (t && typeof t.id === "string" && t.id) ids.add(t.id)
    }
  }
  if (doc && typeof doc === "object") {
    add(doc.entries)
    add(doc.expenses)
    add(doc.finance?.ledger)
    add(doc.finance?.schedules)
  }
  return ids
}

function tombstoneIds(doc: any): Set<string> {
  const ids = new Set<string>()
  const add = (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return
    for (const id of Object.keys(v as Record<string, unknown>)) ids.add(id)
  }
  if (doc && typeof doc === "object") {
    add(doc.deleted)
    add(doc.deletedExpenses)
    add(doc.finance?.deletedLedger)
    add(doc.finance?.deletedSchedules)
  }
  return ids
}

export async function POST(req: Request) {
  const expected = serverKey()
  if (!expected) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const key = req.headers.get("x-data-key") || ""
  if (key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = await crmSupabaseServer()
  if (!supabase) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const raw = await req.text().catch(() => "")
  const bytes = Buffer.byteLength(raw)
  if (!raw || bytes > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_doc" }, { status: 400 })
  }
  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch {}
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.entries)) {
    return NextResponse.json({ error: "invalid_doc" }, { status: 400 })
  }
  // Guardia anti-vacío: ver el comentario de arriba.
  if (countLive(parsed) === 0) {
    const { data: existing, error: readErr } = await supabase
      .from(TABLE)
      .select("doc")
      .eq("owner_id", user.id)
      .maybeSingle()
    if (readErr) {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 502 })
    }
    if (existing?.doc && countLive(existing.doc) > 0) {
      const tombs = tombstoneIds(parsed)
      const uncovered = [...liveIds(existing.doc)].some((id) => !tombs.has(id))
      if (uncovered) {
        return NextResponse.json({ error: "empty_guard" }, { status: 409 })
      }
    }
  }
  const { error: writeErr } = await supabase
    .from(TABLE)
    .upsert(
      { owner_id: user.id, doc: parsed, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" },
    )
  if (writeErr) {
    return NextResponse.json({ error: "write_failed" }, { status: 502 })
  }
  return NextResponse.json({ ok: true, bytes })
}
