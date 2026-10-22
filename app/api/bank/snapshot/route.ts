// app/api/bank/snapshot/route.ts
// Prefer direct Plaid when configured + linked; otherwise proxy to legacy feed.
//
// FIX 2026-10-22 (root cause de "0 mov." en Copiloto):
// fromSupabase() lee la tabla legacy `app_state` (id='register'), cuyos
// movimientos usan `account` y `description` — NO `bank_account` ni `detail`.
// El frontend (movementCounts, txsForAccount, bumpMove, reconciliación)
// hace match por `t.bank_account`, así que nada coincidía: todas las cuentas
// marcaban "0 mov." y los registers abrían vacíos aunque el sync trajera datos.
// Este parche normaliza cada movimiento al formato BankTx que espera el
// frontend: { date, bank_account, detail, category, amount (con signo),
// daily_balance }. Los montos legacy ya vienen con signo (gasto negativo).
import { NextResponse } from "next/server"
import { listPlaidItems, plaidConfigured } from "@/lib/plaid"

async function fromSupabase(): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const r = await fetch(`${url}/rest/v1/app_state?id=eq.register&select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    })
    if (!r.ok) return null
    const rows = await r.json()
    if (!rows?.length) return null
    const rawTxns = rows[0]?.data?.transactions || []
    // Normalizar al formato BankTx del frontend. Sin `bank_account` el match
    // por cuenta falla y los registers salen vacíos ("0 mov.").
    const txns = rawTxns.map((t: any) => ({
      date: String(t.date || "").slice(0, 10),
      bank_account: t.account || t.bankRef || "unknown",
      detail: t.description || t.merchant || "",
      category: t.category || null,
      amount: Number(t.amount) || 0,
      daily_balance: null,
    }))
    // Leer balances frescos
    let balMap: Record<string, number> = {}
    try {
      const bRes = await fetch(`${url}/rest/v1/app_state?id=eq.balances&select=data`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      })
      if (bRes.ok) {
        const bRows = await bRes.json()
        const bals = bRows[0]?.data?.balances || {}
        for (const [k, v] of Object.entries(bals) as any) {
          // Mapear por nombre de cuenta
          balMap[v.name] = v.current
          if (v.mask) balMap[`${v.name} …${v.mask}`] = v.current
        }
      }
    } catch {}
    // Mapear al formato del snapshot
    const accounts: Record<string, any> = {}
    let total = 0
    for (const t of txns) {
      const acct = t.bank_account || "unknown"
      if (!accounts[acct]) {
        const bal = balMap[acct] ?? 0
        accounts[acct] = { name: acct, current_balance: bal, transactions: [] }
        total += bal
      }
      accounts[acct].transactions.push(t)
    }
    return NextResponse.json({
      as_of: new Date().toISOString(),
      total_balance: total,
      accounts: Object.values(accounts),
      transactions: txns,
      source: "supabase",
    }, { headers: { "Cache-Control": "no-store" } })
  } catch { return null }
}

export const dynamic = "force-dynamic"

const UPSTREAM = "https://islandcity-register1.vercel.app/api/bank/snapshot"

async function fromPlaid(): Promise<Response | null> {
  if (!plaidConfigured()) return null
  const items = await listPlaidItems()
  if (!items.length) return null
  // Same-origin internal call keeps one code path for mapping.
  const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  try {
    const r = await fetch(`${origin}/api/plaid/sync`, { cache: "no-store" })
    if (!r.ok) return null
    const body = await r.text()
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  } catch { return null }
}

export async function GET() {
  const plaidRes = await fromPlaid()
  if (plaidRes) return plaidRes

  const sbRes = await fromSupabase()
  if (sbRes) return sbRes

  // Legacy proxy (BANK_FEED_KEY) — still works until Plaid is linked.
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const key = process.env.BANK_FEED_KEY
    if (!key) {
      return NextResponse.json({ error: "bank feed not configured" }, { status: 503 })
    }
    const r = await fetch(`${UPSTREAM}?key=${encodeURIComponent(key)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
    const body = await r.text()
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "bank snapshot timeout" : e?.message || "bank proxy failed"
    return NextResponse.json({ error: msg }, { status: 502 })
  } finally {
    clearTimeout(t)
  }
}
