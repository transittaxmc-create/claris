import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Proyecciones en Supabase (orden de Miguel, 2026-10-26): el libro, los
 * recurrentes y demás datos de DINERO viven en app_state id='finance' —
 * el mismo patrón del register del banco (id='register') — para que se
 * abran en cualquier teléfono, sin códigos ni llaves locales.
 * El servidor solo lee/escribe el documento JSON; el contenido lo arma
 * la app (finance-cloud.ts). La guarda anti-vacío vive en el cliente:
 * aquí no se interpreta nada.
 */

const MAX_DOC_CHARS = 3_500_000

function config(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return url && key ? { url, key } : null
}

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(extra || {}) }
}

export async function GET() {
  const cfg = config()
  if (!cfg) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  try {
    const r = await fetch(`${cfg.url}/rest/v1/app_state?id=eq.finance&select=data,updated_at`, {
      headers: headers(cfg.key),
      cache: "no-store",
    })
    if (!r.ok) return NextResponse.json({ error: "finance_read_failed" }, { status: 502 })
    const rows = await r.json()
    return NextResponse.json({ ok: true, doc: rows?.[0]?.data ?? null, updated_at: rows?.[0]?.updated_at ?? null })
  } catch {
    return NextResponse.json({ error: "finance_read_failed" }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const cfg = config()
  if (!cfg) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  let body: any = null
  try {
    body = await req.json()
  } catch {}
  const doc = body?.doc
  if (!doc || typeof doc !== "object" || typeof doc.keys !== "object" || doc.keys === null || Array.isArray(doc.keys)) {
    return NextResponse.json({ error: "invalid_doc" }, { status: 400 })
  }
  if (JSON.stringify(doc).length > MAX_DOC_CHARS) {
    return NextResponse.json({ error: "doc_too_large" }, { status: 413 })
  }
  const now = new Date().toISOString()
  try {
    const w = await fetch(`${cfg.url}/rest/v1/app_state`, {
      method: "POST",
      headers: headers(cfg.key, { Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ id: "finance", data: { ...doc, updated_at: now }, updated_at: now }),
    })
    if (!w.ok) return NextResponse.json({ error: "finance_write_failed" }, { status: 502 })
    return NextResponse.json({ ok: true, updated_at: now })
  } catch {
    return NextResponse.json({ error: "finance_write_failed" }, { status: 502 })
  }
}
