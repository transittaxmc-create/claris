import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Edición de transacciones bancarias (solo Citibank, desde la app).
 * Modifica la fila en Supabase app_state 'register' (match por bankRef).
 * Nota: si Plaid manda una modificación de esa transacción en un sync
 * futuro, el valor de Plaid puede volver a imponerse — igual que en el
 * Registro principal.
 */
export async function POST(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch {}
  const txId = body?.transaction_id ? String(body.transaction_id) : ""
  if (!txId) return NextResponse.json({ error: "missing_transaction_id" }, { status: 400 })

  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!url || !key) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 })
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }

  const r = await fetch(`${url}/rest/v1/app_state?id=eq.register&select=data`, {
    headers,
    cache: "no-store",
  })
  if (!r.ok) return NextResponse.json({ error: "register_read_failed" }, { status: 502 })
  const rows = await r.json()
  const data = rows?.[0]?.data || {}
  const txns: any[] = Array.isArray(data.transactions) ? data.transactions : []
  const idx = txns.findIndex((t) => t.bankRef === txId || t.id === txId)
  if (idx < 0) return NextResponse.json({ error: "tx_not_found" }, { status: 404 })

  if (body.delete === true) {
    txns.splice(idx, 1)
  } else {
    const t = { ...txns[idx] }
    if (typeof body.description === "string") t.description = body.description
    if (typeof body.category === "string") t.category = body.category
    if (typeof body.date === "string" && body.date.length >= 10) t.date = body.date.slice(0, 10)
    if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
      t.amount = Math.round(body.amount * 100) / 100
      t.type = t.amount >= 0 ? "income" : "expense"
    }
    t.isManuallyEdited = true
    txns[idx] = t
  }

  const now = new Date().toISOString()
  const w = await fetch(`${url}/rest/v1/app_state?id=eq.register`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ data: { ...data, transactions: txns }, updated_at: now }),
  })
  if (!w.ok) return NextResponse.json({ error: "register_write_failed" }, { status: 502 })
  return NextResponse.json({ ok: true, as_of: now })
}
