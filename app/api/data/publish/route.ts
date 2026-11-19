// app/api/data/publish/route.ts
// Sync automático entre teléfonos (copia de prueba, 2026-11-19): el
// teléfono publica su estado sincronizable (viajes + gastos + DINERO, ya
// fusionado en el cliente con la mezcla por ítem de lib/sync.ts) y el
// documento queda guardado CRUDO en el Blob privado, en una ruta PROPIA
// (data/sync-doc.json) separada del snapshot bancario.
//
// Llave: header x-data-key contra DATA_SYNC_KEY (o BANK_PUBLISH_KEY, la
// misma llave de publicación que ya usa /api/bank/publish). Sin llave del
// servidor o sin Blob → 503 y el cliente queda dormido (no cambia nada).
//
// Guardia anti-vacío (lección 2026-11-01/09): un documento con CERO ítems
// vivos NUNCA pisa un documento guardado que sí tiene ítems, salvo que
// traiga las lápidas (tombstones) de TODOS esos ítems — eso sí es un
// borrado legítimo hecho en el otro teléfono.
import { NextResponse } from "next/server"
import { get, put } from "@vercel/blob"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PATHNAME = "data/sync-doc.json"
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

async function readExisting(): Promise<any | null> {
  try {
    const result = await get(PATHNAME, { access: "private" })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const text = await new Response(result.stream).text()
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const expected = serverKey()
  if (!expected) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const key = req.headers.get("x-data-key") || ""
  if (key !== expected) {
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
    const existing = await readExisting()
    if (existing && countLive(existing) > 0) {
      const tombs = tombstoneIds(parsed)
      const uncovered = [...liveIds(existing)].some((id) => !tombs.has(id))
      if (uncovered) {
        return NextResponse.json({ error: "empty_guard" }, { status: 409 })
      }
    }
  }
  try {
    await put(PATHNAME, raw, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    })
    return NextResponse.json({ ok: true, bytes })
  } catch {
    return NextResponse.json({ error: "write_failed" }, { status: 502 })
  }
}
