// app/api/bank/snapshot/route.ts
// Prefer direct Plaid when configured + linked; otherwise proxy to legacy feed.
import { NextResponse } from "next/server"
import { listPlaidItems, plaidConfigured } from "@/lib/plaid"

export const dynamic = "force-dynamic"

const UPSTREAM = "https://islandcity-register1.vercel.app/api/bank/snapshot"

async function fromPlaid(requestUrl: string): Promise<Response | null> {
  if (!plaidConfigured()) return null
  const items = await listPlaidItems()
  if (!items.length) return null
  // Same-origin internal call keeps one code path for mapping.
  const syncUrl = new URL("/api/plaid/sync", requestUrl)
  try {
    const r = await fetch(syncUrl, { cache: "no-store" })
    if (!r.ok) return null
    const body = await r.text()
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const plaidRes = await fromPlaid(request.url)
  if (plaidRes) return plaidRes

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
