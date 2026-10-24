import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * DESACTIVADO (2026-10-24): esta ruta jalaba balances de los items de Plaid
 * conectados DENTRO de la app (plaid_items), que son un set viejo e
 * incompleto (solo Uber Pro Card y un PayPal sin fondos; sin Citibank) y
 * llegó a guardar un balance erróneo. La fuente válida de balances es
 * Supabase app_state 'balances', que mantiene plaid_daily.py con la
 * conexión buena de Plaid. El botón SYNC relee el snapshot; la frescura
 * la da la cadencia del sync (diario 7:45am + frecuente cada 30 min).
 * Esta ruta queda como no-op seguro: no escribe nada.
 */
export async function POST() {
  return NextResponse.json({
    ok: true,
    source: "supabase",
    note: "Balances are maintained by the Plaid sync script; SYNC re-reads the snapshot.",
    as_of: new Date().toISOString(),
  })
}
