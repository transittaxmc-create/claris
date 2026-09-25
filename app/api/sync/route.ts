import { NextResponse } from "next/server"

// Almacén de sincronización: guarda un único documento CIFRADO por código.
// El servidor nunca ve el código ni los viajes: sólo un hash SHA-256 y texto
// cifrado con AES-GCM en el teléfono.
//
// Backends (en orden de preferencia):
//   1. Supabase Postgres (tabla public.sync_docs, RLS activo: sólo el server
//      con la service_role puede leerla; ya está conectado al proyecto).
//   2. KV / Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN), si se crea
//      desde Storage en Vercel.
export const dynamic = "force-dynamic"

const KEY_PREFIX = "claris:sync:"
const MAX_PAYLOAD_BYTES = 400_000

type BackendConfig = { kind: "supabase" | "kv"; url: string; token: string }

function storageConfig(): BackendConfig | null {
  const supaUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaToken = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supaUrl && supaToken) {
    return { kind: "supabase", url: supaUrl.replace(/\/+$/, ""), token: supaToken }
  }
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    return { kind: "kv", url: url.replace(/\/+$/, ""), token }
  }
  return null
}

function notConfigured() {
  return NextResponse.json(
    {
      error: "sync_no_configurado",
      hint:
        "Falta la base de datos de sync. En Vercel: conecta Supabase al proyecto o crea Storage -> KV (Upstash Redis).",
    },
    { status: 501 },
  )
}

async function readPayload(config: BackendConfig, key: string): Promise<string | null> {
  if (config.kind === "supabase") {
    const res = await fetch(
      `${config.url}/rest/v1/sync_docs?key=eq.${key}&select=payload`,
      {
        headers: { apikey: config.token, Authorization: `Bearer ${config.token}` },
        cache: "no-store",
      },
    )
    if (!res.ok) throw new Error(`supabase ${res.status}`)
    const rows = (await res.json()) as { payload?: string }[]
    return rows[0]?.payload ?? null
  }
  const res = await fetch(`${config.url}/get/${KEY_PREFIX}${key}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`kv ${res.status}`)
  const json = (await res.json()) as { result?: unknown }
  return typeof json?.result === "string" && json.result.length ? json.result : null
}

async function writePayload(config: BackendConfig, key: string, payload: string): Promise<void> {
  if (config.kind === "supabase") {
    const res = await fetch(`${config.url}/rest/v1/sync_docs`, {
      method: "POST",
      headers: {
        apikey: config.token,
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key, payload }),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`supabase ${res.status}`)
    return
  }
  const res = await fetch(`${config.url}/set/${KEY_PREFIX}${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "text/plain",
    },
    body: payload,
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`kv ${res.status}`)
}

const isValidKey = (key: unknown): key is string => typeof key === "string" && /^[a-f0-9]{64}$/.test(key)

export async function GET(request: Request) {
  const config = storageConfig()
  if (!config) return notConfigured()

  const key = new URL(request.url).searchParams.get("key")
  if (!isValidKey(key)) return NextResponse.json({ error: "key_invalida" }, { status: 400 })

  try {
    const payload = await readPayload(config, key)
    return NextResponse.json({ payload }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const config = storageConfig()
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
    await writePayload(config, key, payload)
    return NextResponse.json({ ok: true, bytes: payload.length }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}
