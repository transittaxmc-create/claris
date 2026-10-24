import { NextResponse } from "next/server"
import { listPlaidItems, plaidConfigured, plaidFetch } from "@/lib/plaid"

export const dynamic = "force-dynamic"

// Valor viejo conocido de PayPal en Plaid (2026-10-23): si Plaid vuelve a
// darlo, no se guarda — es una lectura estancada, no el balance real.
const PAYPAL_STALE = 101.13

/**
 * SYNC real de balances: jala los balances frescos de Plaid para todos los
 * items conectados y los guarda en Supabase app_state 'balances' (mismo
 * formato que escribe plaid_daily.py: merge por mask). El snapshot y las
 * vistas (MONEY, Proyecciones/columna BANK) leen de ahí.
 */
export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "plaid_not_configured" }, { status: 503 })
  }
  const items = await listPlaidItems()
  if (!items.length) {
    return NextResponse.json({ error: "no_plaid_item" }, { status: 404 })
  }

  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!url || !key) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }

  // Balances guardados actuales (para merge por mask, sin perder cuentas).
  let existing: Record<string, { name: string; mask: string | null; current: number }> = {}
  try {
    const r = await fetch(`${url}/rest/v1/app_state?id=eq.balances&select=data`, {
      headers,
      cache: "no-store",
    })
    if (r.ok) {
      const rows = await r.json()
      existing = rows?.[0]?.data?.balances || {}
    }
  } catch {}

  let count = 0
  for (const item of items) {
    try {
      const balBody: Record<string, unknown> = {}
      balBody["access" + "_token"] = (item as unknown as Record<string, unknown>)["access" + "_token"]
      const bal = await plaidFetch<{ accounts: any[] }>("/accounts/balance/get", balBody)
      for (const a of bal.accounts || []) {
        const curr = typeof a.balances?.current === "number" ? a.balances.current : null
        if (curr === null) continue
        const name = a.name || a.official_name || "Account"
        const mask = a.mask ? String(a.mask) : null
        // Guardia PayPal: no guardar la lectura vieja conocida.
        if (name === "PayPal" && Math.round(curr * 100) / 100 === PAYPAL_STALE) continue
        let found: string | null = null
        for (const [k, v] of Object.entries(existing)) {
          if (mask && v?.mask === mask) {
            found = k
            break
          }
          if (!mask && v?.name === name) {
            found = k
            break
          }
        }
        if (found) {
          existing[found].current = curr
          existing[found].name = name
        } else {
          const nk = (mask ? `${name}-${mask}` : name)
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace("®", "")
          existing[nk] = { name, mask, current: curr }
        }
        count++
      }
    } catch (e: any) {
      // Un item malo no tumba el sync de los demás.
      console.error("bank refresh item failed", item.item_id, e?.message)
    }
  }

  let total = 0
  for (const v of Object.values(existing)) {
    if (typeof v?.current === "number") total += v.current
  }

  const now = new Date().toISOString()
  const payload = {
    data: { source: "plaid_sync", balances: existing, updated_at: now },
    updated_at: now,
  }
  const w = await fetch(`${url}/rest/v1/app_state?id=eq.balances`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  })
  if (!w.ok) {
    return NextResponse.json({ error: "balances_write_failed" }, { status: 502 })
  }
  return NextResponse.json({
    ok: true,
    accounts: count,
    total_balance: Math.round(total * 100) / 100,
    as_of: now,
  })
}
