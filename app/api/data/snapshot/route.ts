// app/api/data/snapshot/route.ts
// Contraparte de lectura del sync automático entre teléfonos (copia de
// prueba, 2026-11-19): devuelve el documento sincronizable guardado por
// POST /api/data/publish (Blob privado, data/sync-doc.json), protegido
// con la misma llave (header x-data-key contra DATA_SYNC_KEY o
// BANK_PUBLISH_KEY). Sin documento todavía → 200 { doc: null } (primer
// contacto: el teléfono adopta/subirá según la mezcla del cliente).
// Sin llave del servidor o sin Blob → 503: el cliente lo trata como
// "sync no configurado" y NO toca ningún dato local.
import { NextResponse } from "next/server"
import { get } from "@vercel/blob"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PATHNAME = "data/sync-doc.json"

export async function GET(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const expected = process.env.DATA_SYNC_KEY || process.env.BANK_PUBLISH_KEY || ""
  if (!expected) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const key = req.headers.get("x-data-key") || ""
  if (key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const result = await get(PATHNAME, { access: "private" })
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ doc: null }, { headers: { "Cache-Control": "no-store" } })
    }
    const text = await new Response(result.stream).text()
    const doc = JSON.parse(text)
    if (!doc || typeof doc !== "object" || Array.isArray(doc) || !Array.isArray(doc.entries)) {
      return NextResponse.json({ doc: null }, { headers: { "Cache-Control": "no-store" } })
    }
    return NextResponse.json(doc, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ doc: null }, { headers: { "Cache-Control": "no-store" } })
  }
}
