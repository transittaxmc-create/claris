import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Fotos de recibos para auditoría (Miguel, 2026-10-25/29): cada foto se
 * guarda en Supabase app_state como su propia fila id='receipt-img:<id>',
 * separada del documento de finanzas (que solo lleva el índice chico en
 * claris_receipts_v1). Así ni el teléfono ni el sync de finanzas cargan
 * imágenes: la foto se pide una por una, solo al verla o imprimirla.
 *
 * POST {id, image: dataURL} → guarda. GET ?id=<imageId> → la imagen.
 */

const MAX_IMAGE_CHARS = 2_500_000

function config(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return url && key ? { url, key } : null
}

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(extra || {}) }
}

export async function POST(req: Request) {
  const cfg = config()
  if (!cfg) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  let body: any = null
  try {
    body = await req.json()
  } catch {}
  const id = String(body?.id || "").trim()
  const image = String(body?.image || "")
  if (!id || !/^rcpt-[a-z0-9-]+$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }
  if (!image.startsWith("data:image/") || image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  }
  try {
    const w = await fetch(`${cfg.url}/rest/v1/app_state`, {
      method: "POST",
      headers: headers(cfg.key, { Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        id: `receipt-img:${id}`,
        data: { image, savedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }),
    })
    if (!w.ok) return NextResponse.json({ error: "write_failed" }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "write_failed" }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const cfg = config()
  if (!cfg) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  const id = String(new URL(req.url).searchParams.get("id") || "").trim()
  if (!id || !/^rcpt-[a-z0-9-]+$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }
  try {
    const r = await fetch(
      `${cfg.url}/rest/v1/app_state?id=eq.${encodeURIComponent(`receipt-img:${id}`)}&select=data`,
      { headers: headers(cfg.key), cache: "no-store" },
    )
    if (!r.ok) return NextResponse.json({ error: "read_failed" }, { status: 502 })
    const rows = await r.json()
    const image = rows?.[0]?.data?.image
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    const m = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
    if (!m) return NextResponse.json({ error: "bad_image" }, { status: 500 })
    const bytes = Buffer.from(m[2], "base64")
    return new Response(bytes, {
      headers: {
        "Content-Type": m[1],
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "read_failed" }, { status: 502 })
  }
}
