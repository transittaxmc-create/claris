import { NextResponse } from "next/server"
import { del, get, list, put } from "@vercel/blob"

export const dynamic = "force-dynamic"

/**
 * Buzón de fotos para el escáner (Miguel, 2026-11-13): el atajo de iOS
 * manda el screenshot por POST (con la llave SCAN_INBOX_KEY en el header
 * x-scan-key) y la app lo recoge al abrir: GET sin id lista lo pendiente
 * y GET ?id=<uuid> entrega la foto UNA sola vez (recoger = borrar).
 * Las fotos viven en un store privado de Vercel Blob (prefijo
 * "scan-inbox/"), nunca en el documento de finanzas. Higiene automática:
 * nada dura más de 20 minutos ni se acumulan más de 3 fotos.
 *
 * POST {image: dataURL} con header x-scan-key → {ok:true}
 * GET → {pending:[{id, uploadedAt}]} (más vieja primero)
 * GET ?id=<uuid> → bytes de la foto (y se borra del buzón)
 */

const PREFIX = "scan-inbox/"
const SUFFIX = ".jpg"
const MAX_IMAGE_CHARS = 6_000_000
const MAX_AGE_MS = 20 * 60 * 1000
const MAX_KEEP = 3

function tokenMissing() {
  return !process.env.BLOB_READ_WRITE_TOKEN
}

function pathnameOf(id: string) {
  return `${PREFIX}${id}${SUFFIX}`
}

function idOf(pathname: string) {
  return pathname.slice(PREFIX.length, pathname.length - SUFFIX.length)
}

/** Borra fotos vencidas (>20 min) y el excedente (más de 3, las más viejas). */
async function sweep() {
  try {
    const { blobs } = await list({ prefix: PREFIX })
    if (!blobs.length) return
    const sorted = [...blobs].sort(
      (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
    )
    const now = Date.now()
    const toDelete: string[] = []
    const fresh = sorted.filter((b) => {
      if (now - new Date(b.uploadedAt).getTime() > MAX_AGE_MS) {
        toDelete.push(b.url)
        return false
      }
      return true
    })
    if (fresh.length > MAX_KEEP) {
      for (const b of fresh.slice(0, fresh.length - MAX_KEEP)) toDelete.push(b.url)
    }
    if (toDelete.length) await del(toDelete)
  } catch {
    // La higiene nunca tumba la operación principal.
  }
}

export async function POST(req: Request) {
  if (tokenMissing()) {
    return NextResponse.json({ error: "inbox_not_configured" }, { status: 503 })
  }
  const key = req.headers.get("x-scan-key") || ""
  if (!process.env.SCAN_INBOX_KEY || key !== process.env.SCAN_INBOX_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: any = null
  try {
    body = await req.json()
  } catch {}
  const image = String(body?.image || "")
  if (!image.startsWith("data:image/") || image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  }
  const m = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!m) return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  try {
    const buffer = Buffer.from(m[2], "base64")
    const id = crypto.randomUUID()
    await put(pathnameOf(id), buffer, { access: "private", contentType: m[1] })
    await sweep()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "write_failed" }, { status: 502 })
  }
}

export async function GET(req: Request) {
  if (tokenMissing()) {
    return NextResponse.json({ error: "inbox_not_configured" }, { status: 503 })
  }
  const id = String(new URL(req.url).searchParams.get("id") || "").trim()

  // Recoger una foto: se entrega una sola vez y se borra del buzón.
  if (id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 })
    }
    try {
      const result = await get(pathnameOf(id), { access: "private" })
      if (!result || result.statusCode !== 200 || !result.stream) {
        return NextResponse.json({ error: "not_found" }, { status: 404 })
      }
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
      const contentType = result.blob.contentType || "image/jpeg"
      await del(result.blob.pathname).catch(() => {})
      return new Response(bytes, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(bytes.length),
          "Cache-Control": "no-store",
        },
      })
    } catch {
      return NextResponse.json({ error: "read_failed" }, { status: 502 })
    }
  }

  // Lista de fotos esperando (la app la consulta al abrir).
  try {
    await sweep()
    const { blobs } = await list({ prefix: PREFIX })
    const pending = [...blobs]
      .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime())
      .map((b) => ({
        id: idOf(b.pathname),
        uploadedAt: new Date(b.uploadedAt).toISOString(),
      }))
    return NextResponse.json({ pending })
  } catch {
    return NextResponse.json({ error: "read_failed" }, { status: 502 })
  }
}
