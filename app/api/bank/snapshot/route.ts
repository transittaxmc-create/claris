// app/api/bank/snapshot/route.ts
// Server-side proxy to the islandcity-register1 bank snapshot (shared Supabase).
// BANK_FEED_KEY lives only in Vercel env — it never reaches the browser.
// The DUAL REGISTER panel calls THIS route (same origin).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UPSTREAM = 'https://islandcity-register1.vercel.app/api/bank/snapshot'

export async function GET() {
  try {
    const key = process.env.BANK_FEED_KEY
    if (!key) {
      return NextResponse.json({ error: 'bank feed not configured' }, { status: 503 })
    }
    const r = await fetch(`${UPSTREAM}?key=${encodeURIComponent(key)}`, { cache: 'no-store' })
    const body = await r.text()
    return new NextResponse(body, {
      status: r.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bank proxy failed' }, { status: 502 })
  }
}
