import { NextResponse } from "next/server"
import { put, head, del } from "@vercel/blob"

// Almacén de sincronización: guarda un único documento CIFRADO por código.
// El servidor nunca ve el código ni los viajes: sólo un hash SHA-256 y texto
// cifrado con AES-GCM en el teléfono.
//
// Backend: Vercel Blob (ya configurado en el proyecto).
// Cada "slot" de sync es un blob con nombre claris-sync-<hashkey>.enc
export const dynamic = "force-dynamic"

const MAX_PAYLOAD_BYTES = 400_000
const isValidKey = (key: unknown): key is string =>
  typeof key === "string" && /^[a-f0-9]{64}$/.test(key)

function blobName(key: string) {
  return `claris-sync-${key}.enc`
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key")
  if (!isValidKey(key)) return NextResponse.json({ error: "key_invalida" }, { status: 400 })

  try {
    const name = blobName(key)
    // head() throws if the blob doesn't exist
    let blobInfo: Awaited<ReturnType<typeof head>> | null = null
    try {
      blobInfo = await head(
        `https://blob.vercel-storage.com/${name}`,
      )
    } catch {
      // Not found — return null payload (not an error)
      return NextResponse.json({ payload: null }, { status: 200 })
    }
    const res = await fetch(blobInfo.url, { cache: "no-store" })
    if (!res.ok) return NextResponse.json({ payload: null }, { status: 200 })
    const payload = await res.text()
    return NextResponse.json({ payload }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}

export async function POST(request: Request) {
  let body: { key?: unknown; payload?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 })
  }

  const { key, payload } = body
  if (!isValidKey(key)) return NextResponse.json({ error: "key_invalida" }, { status: 400 })
  if (typeof payload !== "string" || payload.length === 0) {
    return NextResponse.json({ error: "payload_invalido" }, { status: 400 })
  }
  if (payload.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "payload_demasiado_grande" }, { status: 413 })
  }

  try {
    await put(blobName(key), payload, {
      access: "public",
      contentType: "text/plain; charset=utf-8",
      allowOverwrite: true,
    })
    return NextResponse.json({ ok: true, bytes: payload.length }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("key")
  if (!isValidKey(key)) return NextResponse.json({ error: "key_invalida" }, { status: 400 })

  try {
    await del(`https://blob.vercel-storage.com/${blobName(key)}`)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    // If the blob doesn't exist, treat as success
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
