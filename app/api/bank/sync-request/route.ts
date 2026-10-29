// app/api/bank/sync-request/route.ts
// El botón SYNC de Copiloto no solo relee el snapshot: deja una MARCA de
// "bajada fresca pedida" en Supabase (app_state id='sync_request'). Un
// servicio en la VM la revisa cada ~45s y, si hay una marca nueva, corre
// el sync real de Plaid (plaid_daily.py) en ese momento — la bajada entra
// en ~1 minuto en vez de esperar al ciclo automático. La marca es solo
// una fecha; no lleva ningún dato de cuentas.
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 503 })
  }
  const now = new Date().toISOString()
  try {
    const r = await fetch(`${url}/rest/v1/app_state`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ id: "sync_request", data: { requested_at: now }, updated_at: now }]),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => "")
      console.error("[sync-request] supabase upsert failed:", r.status, t.slice(0, 200))
      return NextResponse.json({ ok: false }, { status: 502 })
    }
    return NextResponse.json({ ok: true, requested_at: now })
  } catch (e) {
    console.error("[sync-request] failed:", e)
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
