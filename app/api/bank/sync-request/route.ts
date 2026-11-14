// app/api/bank/sync-request/route.ts
// El botón SYNC de Copiloto no solo relee el snapshot: deja una MARCA de
// "bajada fresca pedida". Un servicio en la VM la revisa cada ~60s y, si
// hay una marca nueva, corre el sync real de Plaid (plaid_daily.py) en
// ese momento — la bajada entra en ~1 minuto en vez de esperar al ciclo
// automático. La marca es solo una fecha; no lleva ningún dato de cuentas.
//
// Fase 2 (2026-11-13): la marca vive en el Blob privado de la app
// (bank/sync-request.json), ya no en Supabase — la escritura a Supabase
// devolvía 502 desde el corte por cuota de egress (2026-11-10) y el
// botón SYNC quedaba muerto. POST escribe la marca; GET la devuelve
// (o null si no hay ninguna) para el chequeo de la VM.
import { NextResponse } from "next/server"
import { get, put } from "@vercel/blob"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PATHNAME = "bank/sync-request.json"

export async function POST() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "blob not configured" }, { status: 503 })
  }
  const now = new Date().toISOString()
  try {
    await put(PATHNAME, JSON.stringify({ requested_at: now }), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    })
    return NextResponse.json({ ok: true, requested_at: now })
  } catch (e) {
    console.error("[sync-request] blob write failed:", e)
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json(null)
  try {
    const result = await get(PATHNAME, { access: "private" })
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json(null)
    }
    const text = await new Response(result.stream).text()
    const j = JSON.parse(text)
    if (!j || typeof j.requested_at !== "string") return NextResponse.json(null)
    return NextResponse.json(j, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json(null)
  }
}
