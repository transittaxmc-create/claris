// app/api/bank/snapshot/route.ts
// Server-side proxy to the islandcity-register1 bank snapshot (shared Supabase).
// BANK_FEED_KEY lives only in Vercel env — it never reaches the browser.
// The DUAL REGISTER panel calls THIS route (same origin).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UPSTREAM = 'https://islandcity-register1.vercel.app/api/bank/snapshot'

export async function GET() {
  // Timeout 12s: si el Dual Register se cuelga, el feed muestra OFFLINE
  // en vez de frisar la pantalla (mismo patrón del fix del SAVE).
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const key = process.env.BANK_FEED_KEY
    if (!key) {
      return NextResponse.json({ error: 'bank feed not configured' }, { status: 503 })
    }
    const r = await fetch(`${UPSTREAM}?key=${encodeURIComponent(key)}`, { cache: 'no-store', signal: ctrl.signal })
    const body = await r.text()
    return new NextResponse(body, {
      status: r.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'bank snapshot timeout' : (e?.message || 'bank proxy failed')
    return NextResponse.json({ error: msg }, { status: 502 })
  } finally {
    clearTimeout(t)
  }
}
