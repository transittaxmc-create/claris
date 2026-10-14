import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function jsonError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function supabaseRequest(path: string, init?: RequestInit) {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase no está configurado")
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}`)
  return response.status === 204 ? null : response.json()
}

export async function GET() {
  try {
    const [bankRows, projections] = await Promise.all([
      supabaseRequest("bank_transactions?select=*&order=date.desc,created_at.desc"),
      supabaseRequest("cash_flow_projections?select=*&status=eq.pending&order=due_date.asc,created_at.asc"),
    ])
    return NextResponse.json({ success: true, bankRows, projections })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo cargar Dinero")
  }
}

const bankFields = new Set([
  "id", "date", "bank_account", "detail_primary", "detail_secondary", "amount",
  "daily_balance", "has_receipt", "receipt_url", "reconciled",
])
const projectionFields = new Set([
  "id", "origin_module", "origin_id", "due_date", "detail_primary", "detail_secondary", "amount", "status",
])

function pickFields(payload: unknown, fields: Set<string>) {
  if (!payload || typeof payload !== "object") throw new Error("Payload inválido")
  return Object.fromEntries(Object.entries(payload).filter(([key]) => fields.has(key)))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; payload?: unknown }
    const action = body.action
    if (action === "DELETE_PROJECTION") {
      const id = (body.payload as { id?: unknown })?.id
      if (typeof id !== "string" || !id) return jsonError("ID inválido", 400)
      await supabaseRequest(`cash_flow_projections?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
      return NextResponse.json({ success: true })
    }
    if (action === "MATCH_PROJECTION") {
      const payload = body.payload as { projectionId?: unknown; bankTransactionId?: unknown }
      if (typeof payload?.projectionId !== "string" || typeof payload?.bankTransactionId !== "string") return jsonError("IDs inválidos", 400)
      await supabaseRequest(`cash_flow_projections?id=eq.${encodeURIComponent(payload.projectionId)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "matched", matched_transaction_id: payload.bankTransactionId }),
      })
      await supabaseRequest(`bank_transactions?id=eq.${encodeURIComponent(payload.bankTransactionId)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reconciled: true }),
      })
      return NextResponse.json({ success: true })
    }
    const table = action === "UPDATE_BANK_ROW" ? "bank_transactions" : action === "UPDATE_PROJECTION" ? "cash_flow_projections" : null
    if (!table) return jsonError("Acción no reconocida", 400)
    const record = pickFields(body.payload, table === "bank_transactions" ? bankFields : projectionFields)
    if (typeof record.id !== "string") return jsonError("ID inválido", 400)
    if ("amount" in record && (!Number.isFinite(Number(record.amount)) || Math.abs(Number(record.amount)) > 1000000000)) return jsonError("Monto inválido", 400)
    const fields = table === "bank_transactions" ? bankFields : projectionFields
    const updates = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "id" && fields.has(key)))
    const result = await supabaseRequest(`${table}?id=eq.${encodeURIComponent(record.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates) })
    return NextResponse.json({ success: true, data: Array.isArray(result) ? result[0] : result })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar", 500)
  }
}
