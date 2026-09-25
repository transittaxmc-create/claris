import { NextResponse } from "next/server"

// Almacén de sincronización: guarda un único documento CIFRADO por código.
// El servidor nunca ve el código ni los viajes: sólo un hash SHA-256 y texto
// cifrado con AES-GCM en el teléfono.
//
// Configuración (una sola vez, en Vercel):
//   Storage -> Create Database -> KV / Upstash Redis -> conectar al proyecto.
//   Eso crea automáticamente KV_REST_API_URL y KV_REST_API_TOKEN.
export const dynamic = "force-dynamic"

const KEY_PREFIX = "claris:sync:"
const MAX_PAYLOAD_BYTES = 400_000

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/+$/, ""), token }
}

function notConfigured() {
  return NextResponse.json(
    {
      error: "sync_no_configurado",
      hint:
        "Falta la base de datos de sync. En Vercel: Storage -> Create Database -> KV (Upstash Redis) y conéctala al proyecto.",
    },
    { status: 501 },
  )
}

const isValidKey = (key: unknown): key is string => typeof key === "string" && /^[a-f0-9]{64}$/.test(key)

export async function GET(request: Request) {
  const config = redisConfig()
  if (!config) return notConfigured()

  const key = new URL(request.url).searchParams.get("key")
  if (!isValidKey(key)) return NextResponse.json({ error: "key_invalida" }, { status: 400 })

  try {
    const res = await fetch(`${config.url}/get/${KEY_PREFIX}${key}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    })
    if (!res.ok) return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
    const json = (await res.json()) as { result?: unknown }
    const payload = typeof json?.result === "string" && json.result.length ? json.result : null
    return NextResponse.json({ payload }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "error_de_red" }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const config = redisConfig()
  if (!config) return notConfigured()

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
    const res = await fetch(`${config.url}/set/${KEY_PREFIX}${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "text/plain",
      },
      body: payload,
      cache: "no-store",
    })
    if (!res.ok) return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
    return NextResponse.json({ ok: true, bytes: payload.length }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "error_de_red" }, { status: 502 })
  }
}
