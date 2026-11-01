// Línea de CIERRE SEMANAL (pedido de Miguel, 2026-11-01): un resumen por
// semana — lunes a domingo, cierra el domingo — con el dinero REAL de
// esa semana: income total, gastos total, neto y tolls. Es un RÉCORD
// para chequear el cierre: no afecta ningún balance ni la proyección.
//
// Reglas de Miguel aplicadas al clasificar los movimientos del banco:
// - Quién paga manda: el ingreso se cuenta UNA vez, en su origen (la
//   plataforma que pagó). Las patas de transferencia entre cuentas
//   propias NUNCA son ingreso ni gasto: descarga de la Uber Pro Card y
//   su llegada a Citibank, traspasos PayPal ↔ su tarjeta Citi, el
//   "Backup" de Uber (apartado automático) y la pata de salida de
//   Square (la venta ya contó al entrar a Square Checking).
// - Un crédito cuyo origen no se puede probar (ej. "Money Transfer
//   from PayPal debit card") NO se cuenta como ingreso: es movimiento
//   de su propio dinero hasta que se demuestre otra cosa.
// - El fee de descarga de la Uber Pro Card SÍ es gasto (es costo real);
//   el principal de la descarga no.
// - Las filas del import viejo "Histórico sin cuenta" duplican filas de
//   cuentas reales: se excluyen siempre.

import type { ForecastBankTx } from "./dinero-forecast"

export interface WeekClose {
  /** Lunes de la semana (yyyy-mm-dd). */
  weekStart: string
  /** Domingo de la semana (yyyy-mm-dd). */
  weekEnd: string
  income: number
  expenses: number
  net: number
  /** Parte de los gastos: peajes (E-ZPass y cargos con "toll"). */
  tolls: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

function mondayOf(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  const dow = d.getDay() // 0 = domingo
  d.setDate(d.getDate() - ((dow + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** ¿Es una pata de transferencia interna (dinero propio moviéndose)? */
export function isInternalMove(tx: ForecastBankTx, squareIns: Set<string>): boolean {
  const d = String(tx.detail || "").toLowerCase()
  const acct = String(tx.bank_account || "").toLowerCase()
  const amt = Number(tx.amount) || 0
  // Descarga Uber Pro Card → Citibank: la salida de la tarjeta…
  if (/account unload to card/.test(d)) return true
  // …y su llegada a Citibank (el detalle dice solo "Uber"; el ingreso de
  // Uber de verdad cae en la Uber Pro Card, no en el banco).
  if (amt > 0 && d.trim() === "uber" && !acct.includes("uber")) return true
  // Backup de Uber: apartado automático dentro de la misma tarjeta.
  if (acct.includes("uber") && /backup/.test(d)) return true
  // PayPal ↔ su tarjeta Citi (las dos patas).
  if (/debit card transfer credit/.test(d)) return true
  if (/money transfer to .*debit card/.test(d)) return true
  if (/money transfer from paypal debit card/.test(d)) return true
  // Square: la venta cuenta al ENTRAR a Square Checking (origen); la
  // pata de salida de Square y su llegada a otro banco son traspaso.
  if (acct.includes("square") && amt < 0 && squareIns.has(`${tx.date}|${Math.abs(amt).toFixed(2)}`)) return true
  if (!acct.includes("square") && amt > 0 && /square/.test(d) && /(transfer|payout|deposit)/.test(d)) return true
  return false
}

/**
 * Cierres de las semanas YA cerradas (domingo < hoy), la más reciente
 * primero. Solo semanas con movimiento. Máximo `maxWeeks`.
 */
export function computeWeekCloses(txs: ForecastBankTx[], today: string, maxWeeks = 10): WeekClose[] {
  const clean = (txs || []).filter(
    (t) =>
      t &&
      /^\d{4}-\d{2}-\d{2}/.test(String(t.date)) &&
      Number.isFinite(Number(t.amount)) &&
      Number(t.amount) !== 0 &&
      !/histórico|historico/i.test(String(t.bank_account || "")),
  )
  // Entradas a Square Checking (para reconocer su pata de salida).
  const squareIns = new Set<string>()
  for (const t of clean) {
    if (String(t.bank_account || "").toLowerCase().includes("square") && Number(t.amount) > 0) {
      squareIns.add(`${String(t.date).slice(0, 10)}|${Math.abs(Number(t.amount)).toFixed(2)}`)
      squareIns.add(`${addDays(String(t.date).slice(0, 10), 1)}|${Math.abs(Number(t.amount)).toFixed(2)}`)
      squareIns.add(`${addDays(String(t.date).slice(0, 10), -1)}|${Math.abs(Number(t.amount)).toFixed(2)}`)
    }
  }
  const byWeek = new Map<string, WeekClose>()
  for (const t of clean) {
    const date = String(t.date).slice(0, 10)
    const ws = mondayOf(date)
    const we = addDays(ws, 6)
    if (we >= today) continue // la semana en curso todavía no cierra
    if (isInternalMove(t, squareIns)) continue
    const amt = Number(t.amount) || 0
    let w = byWeek.get(ws)
    if (!w) {
      w = { weekStart: ws, weekEnd: we, income: 0, expenses: 0, net: 0, tolls: 0 }
      byWeek.set(ws, w)
    }
    if (amt > 0) w.income += amt
    else {
      w.expenses += Math.abs(amt)
      if (/e-zpass|ezpass|\btoll/i.test(String(t.detail || ""))) w.tolls += Math.abs(amt)
    }
  }
  const out = [...byWeek.values()]
    .map((w) => ({ ...w, income: r2(w.income), expenses: r2(w.expenses), tolls: r2(w.tolls), net: r2(w.income - w.expenses) }))
    .filter((w) => w.income > 0 || w.expenses > 0)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
  return out.slice(0, maxWeeks)
}
