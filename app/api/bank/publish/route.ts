// app/api/bank/publish/route.ts
// Fase 2 (2026-11-13): el sync de la VM (publish_snapshot.py) publica el
// snapshot bancario fresco aquí, con la llave BANK_PUBLISH_KEY en el
// header x-bank-key. El cuerpo ya viene armado con la forma exacta que
// GET /api/bank/snapshot devuelve (misma normalización que el camino
// Supabase) y se guarda CRUDO en el Blob privado — el mismo store del
// buzón de fotos — para que el snapshot lo sirva primero que cualquier
// otra fuente. Sin llave → 401. Reemplaza la ruta de Supabase, congelada
// desde el 2026-11-10 por la cuota de egress (402).
import { NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PATHNAME = "bank/snapshot.json"
const MAX_BYTES = 8_000_000

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "publish_not_configured" }, { status: 503 })
  }
  const key = req.headers.get("x-bank-key") || ""
  if (!process.env.BANK_PUBLISH_KEY || key !== process.env.BANK_PUBLISH_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const raw = await req.text().catch(() => "")
  const bytes = Buffer.byteLength(raw)
  if (!raw || bytes > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_snapshot" }, { status: 400 })
  }
  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch {}
  if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) {
    return NextResponse.json({ error: "invalid_snapshot" }, { status: 400 })
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
