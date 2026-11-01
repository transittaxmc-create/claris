// Banda de CIERRE SEMANAL (Miguel, 2026-11-01, corregida por él mismo):
// una banda por semana, FECHADA EL DOMINGO en que la semana cierra
// (semana de lunes a domingo), con el dinero REAL de esa semana:
// income, gastos, neto — y los TOLLS como él los pidió: los que se
// USARON / se DETECTARON (GPS de los viajes + diario del turno), con
// el total de los screenshots del statement de E-ZPass aparte cuando
// los hay. NO son los cargos de peaje del banco.
// Además cada banda lleva el ACUMULADO DEL MES hasta ese domingo —
// dinero REAL acumulado en el mes, NO proyección (él lo recalcó).
// Es un RÉCORD para chequear el cierre y programar el E-ZPass: no
// afecta ningún balance ni la proyección.
//
// Clasificación de los movimientos del banco (reglas de Miguel):
// - Quién paga manda: el ingreso se cuenta UNA vez, en su origen.
//   Las patas entre cuentas propias NUNCA son ingreso ni gasto
//   (descarga Uber Pro y su llegada a Citibank, PayPal ↔ su tarjeta
//   Citi, el "Backup" de Uber, la salida de Square pareada).
// - El fee de descarga de la Uber Pro Card SÍ es gasto (costo real).
// - Un crédito sin origen probado ("Money Transfer from PayPal debit
//   card") NO cuenta como ingreso: es dinero propio moviéndose.
// - Fuera el import viejo "Histórico sin cuenta" (duplica cuentas).

import type { ForecastBankTx } from "./dinero-forecast"

export interface WeekBand {
  /** Lunes de la semana (yyyy-mm-dd). */
  weekStart: string
  /** Domingo de la semana (yyyy-mm-dd) — la banda se fecha aquí. */
  weekEnd: string
  /** true si es la semana en curso (todavía no cierra). */
  toDate: boolean
  income: number
  expenses: number
  net: number
  /** Tolls USADOS/detectados por GPS (viajes + diario del turno). */
  tollsUsed: number
  /** Cantidad de pasadas detectadas esa semana. */
  tollPasses: number
  /** Total de los screenshots del statement de E-ZPass de esa semana. */
  tollStmt: number
  /** Mes del domingo de cierre (para el acumulado). */
  monthKey: string
  monthIncome: number
  monthExpenses: number
  monthNet: number
  /** Peajes del mes hasta ese domingo (misma regla: usados/detectados). */
  monthTolls: number
}

export interface TollPassLike {
  date: string
  amount: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

function mondayOf(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** ¿Es una pata de transferencia interna (dinero propio moviéndose)? */
export function isInternalMove(tx: ForecastBankTx, squareIns: Set<string>): boolean {
  const d = String(tx.detail || "").toLowerCase()
  const acct = String(tx.bank_account || "").toLowerCase()
  const amt = Number(tx.amount) || 0
  if (/account unload to card/.test(d)) return true
  if (amt > 0 && d.trim() === "uber" && !acct.includes("uber")) return true
  if (acct.includes("uber") && /backup/.test(d)) return true
  if (/debit card transfer credit/.test(d)) return true
  if (/money transfer to .*debit card/.test(d)) return true
  if (/money transfer from paypal debit card/.test(d)) return true
  if (acct.includes("square") && amt < 0 && squareIns.has(`${tx.date}|${Math.abs(amt).toFixed(2)}`)) return true
  if (!acct.includes("square") && amt > 0 && /square/.test(d) && /(transfer|payout|deposit)/.test(d)) return true
  return false
}

interface ClassifiedDay {
  date: string
  income: number
  expenses: number
}

/** Día por día: income/gastos reales (sin traspasos internos). */
function classifyDays(txs: ForecastBankTx[]): Map<string, ClassifiedDay> {
  const clean = (txs || []).filter(
    (t) =>
      t &&
      /^\d{4}-\d{2}-\d{2}/.test(String(t.date)) &&
      Number.isFinite(Number(t.amount)) &&
      Number(t.amount) !== 0 &&
      !/histórico|historico/i.test(String(t.bank_account || "")),
  )
  const squareIns = new Set<string>()
  for (const t of clean) {
    if (String(t.bank_account || "").toLowerCase().includes("square") && Number(t.amount) > 0) {
      const a = Math.abs(Number(t.amount)).toFixed(2)
      squareIns.add(`${String(t.date).slice(0, 10)}|${a}`)
      squareIns.add(`${addDaysStr(String(t.date).slice(0, 10), 1)}|${a}`)
      squareIns.add(`${addDaysStr(String(t.date).slice(0, 10), -1)}|${a}`)
    }
  }
  const days = new Map<string, ClassifiedDay>()
  for (const t of clean) {
    if (isInternalMove(t, squareIns)) continue
    const date = String(t.date).slice(0, 10)
    let d = days.get(date)
    if (!d) {
      d = { date, income: 0, expenses: 0 }
      days.set(date, d)
    }
    const amt = Number(t.amount) || 0
    if (amt > 0) d.income += amt
    else d.expenses += Math.abs(amt)
  }
  return days
}

function sumRange(days: Map<string, ClassifiedDay>, from: string, to: string): { income: number; expenses: number } {
  let income = 0
  let expenses = 0
  for (const d of days.values()) {
    if (d.date >= from && d.date <= to) {
      income += d.income
      expenses += d.expenses
    }
  }
  return { income: r2(income), expenses: r2(expenses) }
}

/**
 * Bandas semanales: primero la semana EN CURSO (hasta hoy, si todavía
 * no cierra) y después cada semana cerrada, la más reciente primero.
 * `gpsTolls` = pasadas detectadas (viajes + turno); `stmtCharges` =
 * cargos de los screenshots del statement de E-ZPass.
 */
export function computeWeekBands(
  txs: ForecastBankTx[],
  gpsTolls: TollPassLike[],
  stmtCharges: TollPassLike[],
  today: string,
  maxWeeks = 10,
): WeekBand[] {
  const days = classifyDays(txs)
  const curMonday = mondayOf(today)
  const curSunday = addDaysStr(curMonday, 6)

  const tollsIn = (list: TollPassLike[], from: string, to: string) =>
    (list || []).filter((t) => {
      const d = String(t?.date || "").slice(0, 10)
      return d >= from && d <= to
    })
  const monthSums = (anyDateInMonth: string, through: string) => {
    const from = `${anyDateInMonth.slice(0, 7)}-01`
    return sumRange(days, from, through)
  }

  const build = (monday: string, end: string, toDate: boolean): WeekBand | null => {
    const wk = sumRange(days, monday, end)
    const passes = tollsIn(gpsTolls, monday, end)
    const used = r2(passes.reduce((s, t) => s + (Number(t.amount) || 0), 0))
    const stmt = r2(tollsIn(stmtCharges, monday, end).reduce((s, t) => s + (Number(t.amount) || 0), 0))
    // Tolls de la banda: lo USADO/detectado; si el GPS no vio nada pero
    // hay screenshots del statement, manda el total de screenshots.
    const tollsUsed = used > 0 ? used : stmt
    const mo = monthSums(end, end)
    const moFrom = `${end.slice(0, 7)}-01`
    const moPasses = tollsIn(gpsTolls, moFrom, end)
    const moUsed = r2(moPasses.reduce((t2, t) => t2 + (Number(t.amount) || 0), 0))
    const moStmt = r2(tollsIn(stmtCharges, moFrom, end).reduce((t2, t) => t2 + (Number(t.amount) || 0), 0))
    const monthTolls = moUsed > 0 ? moUsed : moStmt
    if (wk.income === 0 && wk.expenses === 0 && tollsUsed === 0 && stmt === 0 && !toDate) return null
    return {
      weekStart: monday,
      weekEnd: addDaysStr(monday, 6),
      toDate,
      income: wk.income,
      expenses: wk.expenses,
      net: r2(wk.income - wk.expenses),
      tollsUsed,
      tollPasses: passes.length,
      tollStmt: stmt,
      monthKey: end.slice(0, 7),
      monthIncome: mo.income,
      monthExpenses: mo.expenses,
      monthNet: r2(mo.income - mo.expenses),
      monthTolls,
    }
  }

  const out: WeekBand[] = []
  if (curSunday > today) {
    const b = build(curMonday, today, true)
    if (b) out.push(b)
  }
  let monday = curSunday <= today ? curMonday : addDaysStr(curMonday, -7)
  for (let i = 0; i < maxWeeks; i++) {
    const sunday = addDaysStr(monday, 6)
    if (sunday > today) {
      monday = addDaysStr(monday, -7)
      continue
    }
    const b = build(monday, sunday, false)
    if (b) out.push(b)
    monday = addDaysStr(monday, -7)
  }
  return out
}
