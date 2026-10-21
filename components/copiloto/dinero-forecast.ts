// ============================================================================
// DINERO — MOTOR DE PROYECCIÓN (estilo Quicken). Funciones puras, sin React.
//
// Fórmula:
//   Balance inicial  = cuenta principal ★ (+ "otros fondos" marcados)
//   + Ingresos proyectados  (libro + recurrentes, dentro del horizonte)
//   − Gastos proyectados    (libro + recurrentes + pagos de tarjeta + vencidos)
//   = Balance proyectado al final del horizonte
//
// Reglas (arreglan las debilidades de la versión anterior):
//  1. Parte de la cuenta principal, no del total de todas las cuentas.
//  2. Los recurrentes (claris_scheduled_entries) SÍ entran: se expanden por fecha.
//  3. Horizonte de fechas: nada más allá del fin del horizonte.
//  4. Facturas vencidas (fecha < hoy) se cobran HOY. Ingresos atrasados NO se
//     cuentan (no se cuenta dinero que no llegó) — se muestran aparte.
//  5. Lo que ya salió del banco no se resta dos veces ("probablemente pagado").
//  6. Un recurrente que ya está como factura en el libro no se duplica.
//  7. Pagos de tarjeta (día de pago) entran como gasto.
// Solo lee. Nunca escribe en el libro: confirmar "pagado" es acción del usuario.
// ============================================================================

import type { CashFlowEntry, ScheduledEntry, ScheduleFrequency } from "./types"

export type ForecastKind = "proj" | "rec" | "card" | "overdue"

export interface ForecastBankTx {
  date: string
  bank_account?: string
  detail: string
  amount: number // positivo = entra, negativo = sale
}

export interface ForecastDue {
  accountId: string
  accountName: string
  kind: "bank" | "card"
  nextDate: string
}

export interface ForecastLine {
  id: string
  date: string
  label: string
  /** Con signo: + ingreso, − gasto. */
  amount: number
  kind: ForecastKind
  entry?: CashFlowEntry
  scheduleId?: string
  frequency?: ScheduleFrequency
  /** Para vencidos: fecha original de la factura. */
  originalDate?: string
}

export interface ForecastDay {
  date: string
  lines: ForecastLine[]
  delta: number
  balance: number
}

export interface ProbablePaid {
  key: string
  entry: CashFlowEntry
  tx: ForecastBankTx
}

export interface ForecastInput {
  startBalance: number
  entries: CashFlowEntry[]
  schedules: ScheduledEntry[]
  dues?: ForecastDue[]
  /** Balance por cuenta (para el monto del pago de tarjeta). */
  balances?: Record<string, number | null | undefined>
  bankTxs?: ForecastBankTx[]
  /** yyyy-mm-dd (hora local). */
  today: string
  horizonDays: number
  /** Claves de "probablemente pagado" que el usuario descartó. */
  dismissedPaid?: string[]
  /** Excepciones de "solo esta vez" sobre un recurring (edición o salto). */
  overrides?: ScheduleOverride[]
}

/** Excepción puntual a un recurring: "solo esta vez" (edición o no pagar). */
export interface ScheduleOverride {
  scheduleId: string
  /** yyyy-mm-dd de la ocurrencia afectada. */
  date: string
  amount?: number
  label?: string
  /** true = esta ocurrencia no se proyecta. */
  skip?: boolean
}

export const SCHEDULE_OVERRIDES_KEY = "claris_schedule_overrides"

export interface Forecast {
  today: string
  endDate: string
  start: number
  days: ForecastDay[]
  lines: ForecastLine[]
  incomeTotal: number
  expenseTotal: number
  incomeCount: number
  expenseCount: number
  end: number
  lowest: { date: string; balance: number }
  overdueExpenseTotal: number
  overdueExpenseCount: number
  /** Income con fecha pasada que no llegaron: NO incluidos en el total. */
  overdueIncome: ForecastLine[]
  overdueIncomeTotal: number
  probablePaid: ProbablePaid[]
  recurringCount: number
  cardCount: number
  duplicatesSkipped: number
  recurringPaidSkipped: number
  beyondHorizonCount: number
}

export const FREQ_LABEL: Record<ScheduleFrequency, string> = {
  once: "One time",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  annual: "Annual",
}

// ---------------------------------------------------------------------------
// Utilidades de fecha (hora local, sin UTC)
// ---------------------------------------------------------------------------

export const r2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/

export function isIsoDate(s: unknown): boolean {
  return ISO_RE.test(String(s || ""))
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parts(iso: string): [number, number, number] {
  const m = String(iso).match(ISO_RE)
  if (!m) return [NaN, NaN, NaN]
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function todayKey(now: Date = new Date()): string {
  return keyOf(now)
}

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = parts(iso)
  const dt = new Date(y, m - 1, d, 12)
  dt.setDate(dt.getDate() + n)
  return keyOf(dt)
}

/** Días de a → b (con signo). */
export function diffDays(a: string, b: string): number {
  const [ya, ma, da] = parts(a)
  const [yb, mb, db] = parts(b)
  const ta = new Date(ya, ma - 1, da, 12).getTime()
  const tb = new Date(yb, mb - 1, db, 12).getTime()
  return Math.round((tb - ta) / 86400000)
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

/** Días desde hoy hasta el último día del mes (0 si hoy es el último). */
export function daysToEndOfMonth(today: string): number {
  const [y, m, d] = parts(today)
  return daysInMonth(y, m) - d
}

// ---------------------------------------------------------------------------
// Coincidencia de comercio (banco ↔ libro)
// ---------------------------------------------------------------------------

const STOP = new Set([
  "payment", "pmt", "purchase", "debit", "credit", "card", "online", "recurring", "transfer",
  "deposit", "account", "checking", "savings", "autopay", "bill", "llc", "inc", "corp", "the",
  "pos", "ach", "web", "www", "com", "des", "ppd", "indn", "pago", "factura", "recibo", "card",
])

export function vendorTokens(s: unknown): string[] {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 4 && !STOP.has(t) && !/^\d+$/.test(t))
}

/** Comparten al menos un token significativo (≥4 letras, sin palabras genéricas). */
export function vendorMatch(a: unknown, b: unknown): boolean {
  const ta = vendorTokens(a)
  const tb = vendorTokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  return ta.some((x) => tb.some((y) => x === y || x.includes(y) || y.includes(x)))
}

/** Plataformas de ingreso: si el label menciona una, el banco debe mencionarla también.
 * Más flexible que vendorMatch: no exige token ≥4 letras compartido. */
const PLATFORM_NAMES = ["uber", "lyft", "empower", "gallant", "aventus", "curb", "via", "limosys", "aki mobility", "texport", "ctg", "paypal", "venmo", "cash app", "zelle", "branch"]
export function platformMatch(bankDetail: unknown, label: unknown): boolean {
  const d = String(bankDetail || "").toLowerCase()
  const l = String(label || "").toLowerCase()
  for (const p of PLATFORM_NAMES) {
    if (l.includes(p) && d.includes(p)) return true
  }
  return false
}

/** ¿El detalle del banco parece un depósito/transferencia? (para el tercer
 * intento de matching: "Uber cobro" → "PayPal transfer" aunque no compartan
 * plataforma, si monto y fecha cuadran.) */
const TRANSFER_WORDS = ["transfer", "deposit", "zelle", "paypal", "venmo", "payout", "credit", "ach", "wire"]
export function transferLike(bankDetail: unknown): boolean {
  const d = String(bankDetail || "").toLowerCase()
  return TRANSFER_WORDS.some((w) => d.includes(w))
}

export function amountClose(a: number, b: number, pct: number): boolean {
  const x = Math.abs(Number(a) || 0)
  const y = Math.abs(Number(b) || 0)
  return Math.abs(x - y) <= Math.max(0.011, y * pct)
}

// ---------------------------------------------------------------------------
// Expansión de recurrentes
// ---------------------------------------------------------------------------

/**
 * Fechas de ocurrencia de un recurrente entre [from, to] (inclusive).
 * - Se ancla en startDate (o nextDate) y conserva el día del mes:
 *   el 31 cae el último día en meses cortos (30, 28/29), sin correrse al mes siguiente.
 * - Respeta active, endDate y occurrences (contadas desde el ancla).
 * - nextDate actúa como "no antes de" (pagos ya avanzados).
 */
export function expandSchedule(s: ScheduledEntry, from: string, to: string): string[] {
  if (!s || s.active === false) return []
  if (!(Math.abs(Number(s.amount) || 0) >= 0.01)) return []
  const anchor = isIsoDate(s.startDate)
    ? String(s.startDate).slice(0, 10)
    : isIsoDate(s.nextDate)
      ? String(s.nextDate).slice(0, 10)
      : null
  if (!anchor) return []
  const notBefore = isIsoDate(s.nextDate) ? String(s.nextDate).slice(0, 10) : anchor
  let lower = from > notBefore ? from : notBefore
  if (lower < anchor) lower = anchor
  let upper = to
  if (isIsoDate(s.endDate) && String(s.endDate).slice(0, 10) < upper) upper = String(s.endDate).slice(0, 10)
  if (lower > upper) return []

  const freq: ScheduleFrequency = s.frequency || "once"
  if (freq === "once") {
    return notBefore >= from && notBefore <= upper ? [notBefore] : []
  }

  const occ = Number(s.occurrences)
  const maxCount = Number.isFinite(occ) && occ > 0 ? occ : Infinity
  const [ay, am, ad] = parts(anchor)
  const at = (k: number): string => {
    if (freq === "daily") return addDaysIso(anchor, k)
    if (freq === "weekly") return addDaysIso(anchor, 7 * k)
    if (freq === "biweekly") return addDaysIso(anchor, 14 * k)
    if (freq === "monthly") {
      const total = am - 1 + k
      const y = ay + Math.floor(total / 12)
      const m = (total % 12) + 1
      return `${y}-${pad(m)}-${pad(Math.min(ad, daysInMonth(y, m)))}`
    }
    const y = ay + k // annual
    return `${y}-${pad(am)}-${pad(Math.min(ad, daysInMonth(y, am)))}`
  }

  // Primer índice cercano a "lower" sin recorrer desde el ancla (seguro: nunca se pasa).
  const gap = Math.max(0, diffDays(anchor, lower))
  let k =
    freq === "daily"
      ? gap
      : freq === "weekly"
        ? Math.floor(gap / 7)
        : freq === "biweekly"
          ? Math.floor(gap / 14)
          : freq === "monthly"
            ? Math.max(0, Math.floor(gap / 31) - 1)
            : Math.max(0, Math.floor(gap / 366) - 1)

  const out: string[] = []
  for (let guard = 0; guard < 800 && k < maxCount; guard++, k++) {
    const d = at(k)
    if (d > upper) break
    if (d >= lower) out.push(d)
  }
  return out
}

/** Ventana (days) para considerar un recurring "already paid" por el banco. */
export function paidWindow(freq: ScheduleFrequency | undefined): number {
  if (freq === "daily") return 0
  if (freq === "weekly") return 3
  if (freq === "biweekly") return 5
  return 10
}

// ---------------------------------------------------------------------------
// Starting balance
// ---------------------------------------------------------------------------

export interface StartRegister {
  id: string
  name: string
  kind: "bank" | "card"
  isMain: boolean
}

export interface StartBalance {
  value: number
  mainId: string | null
  mainBalance: number | null
  extras: { id: string; name: string; balance: number }[]
  /** true = no hay saldo de la principal; se usó la suma de bancos. */
  usedFallback: boolean
}

export function startingBalance(
  registers: StartRegister[],
  balances: Record<string, number | null | undefined>,
  otherFundIds: string[] = [],
): StartBalance {
  const main = registers.find((r) => r.isMain) || null
  const mainBal = main ? balances[main.id] : null
  const extras: StartBalance["extras"] = []
  for (const id of otherFundIds) {
    const r = registers.find((x) => x.id === id)
    if (!r || r.isMain || r.kind !== "bank") continue
    // Miguel (2026-10-19): cualquier cuenta de banco con balance positivo puede
    // ser fondo (checkmark en la lista de MONEY).
    const b = balances[id]
    if (b === null || b === undefined || !Number.isFinite(Number(b)) || Number(b) <= 0) continue
    extras.push({ id, name: r.name, balance: r2(Number(b)) })
  }
  if (main && mainBal !== null && mainBal !== undefined && Number.isFinite(Number(mainBal))) {
    const value = r2(Number(mainBal) + extras.reduce((s, x) => s + x.balance, 0))
    return { value, mainId: main.id, mainBalance: r2(Number(mainBal)), extras, usedFallback: false }
  }
  // Sin saldo de la principal: suma de bancos (comportamiento anterior), avisado en la UI.
  let sum = 0
  for (const r of registers) {
    if (r.kind !== "bank") continue
    const b = balances[r.id]
    if (b !== null && b !== undefined && Number.isFinite(Number(b))) sum += Number(b)
  }
  return { value: r2(sum), mainId: main?.id ?? null, mainBalance: null, extras: [], usedFallback: true }
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

interface LedgerItem {
  entry: CashFlowEntry
  date: string
  amount: number
  income: boolean
  label: string
}

function ledgerProjected(entries: CashFlowEntry[], today: string): LedgerItem[] {
  const out: LedgerItem[] = []
  for (const e of entries || []) {
    if (!e || e.status !== "projected") continue
    const amt = Math.abs(Number(e.amount) || 0)
    if (amt < 0.01) continue
    const income = e.type === "income"
    const date = isIsoDate(e.date) ? String(e.date).slice(0, 10) : today
    out.push({ entry: e, date, amount: r2(amt), income, label: e.description || e.category || (income ? "Income" : "Expense") })
  }
  return out
}

export function buildForecast(input: ForecastInput): Forecast {
  const today = input.today
  const horizon = Math.max(0, Math.floor(Number(input.horizonDays) || 0))
  const endDate = addDaysIso(today, horizon)
  const start = r2(input.startBalance)
  const dismissed = new Set(input.dismissedPaid || [])
  const bankTxs = (input.bankTxs || []).filter(
    (t) => t && isIsoDate(t.date) && String(t.date).slice(0, 10) <= today && Math.abs(Number(t.amount) || 0) >= 0.01,
  )
  const usedTx = new Set<number>()

  const lines: ForecastLine[] = []
  const overdueIncome: ForecastLine[] = []
  const probablePaid: ProbablePaid[] = []
  let duplicatesSkipped = 0
  let recurringPaidSkipped = 0
  let beyondHorizonCount = 0

  // Busca el cargo/abono del banco que corresponde (cada uno se usa una sola vez).
  // Para ingresos: si el match estricto falla, segundo intento flexible —
  // los payouts de plataformas varían en monto (±8 %) y la descripción del
  // banco rara vez comparte tokens con "Cobro Uber". Basta que ambos
  // mencionen la plataforma.
  const findTx = (income: boolean, amount: number, date: string, label: string, window: number, pct: number): number => {
    let best = -1
    let bestGap = Infinity
    for (let i = 0; i < bankTxs.length; i++) {
      if (usedTx.has(i)) continue
      const t = bankTxs[i]
      const amt = Number(t.amount) || 0
      if (income ? amt <= 0 : amt >= 0) continue
      const gap = Math.abs(diffDays(String(t.date).slice(0, 10), date))
      if (gap > window) continue
      if (!amountClose(amt, amount, pct)) continue
      if (!vendorMatch(t.detail, label)) continue
      if (gap < bestGap) {
        bestGap = gap
        best = i
      }
    }
    if (best < 0 && income) {
      const flexPct = Math.max(pct, 0.08)
      for (let i = 0; i < bankTxs.length; i++) {
        if (usedTx.has(i)) continue
        const t = bankTxs[i]
        const amt = Number(t.amount) || 0
        if (amt <= 0) continue
        const gap = Math.abs(diffDays(String(t.date).slice(0, 10), date))
        if (gap > window) continue
        if (!amountClose(amt, amount, flexPct)) continue
        if (!platformMatch(t.detail, label)) continue
        if (gap < bestGap) {
          bestGap = gap
          best = i
        }
      }
    }
    // Tercer intento: el depósito llegó por otra vía (ej. "Uber" vía "PayPal").
    // Si el banco muestra una transferencia y monto/fecha cuadran, se propone.
    // Miguel lo confirma o descarta en "Por confirmar".
    if (best < 0 && income) {
      const flexPct = Math.max(pct, 0.08)
      for (let i = 0; i < bankTxs.length; i++) {
        if (usedTx.has(i)) continue
        const t = bankTxs[i]
        const amt = Number(t.amount) || 0
        if (amt <= 0) continue
        const gap = Math.abs(diffDays(String(t.date).slice(0, 10), date))
        if (gap > window) continue
        if (!amountClose(amt, amount, flexPct)) continue
        if (!transferLike(t.detail)) continue
        if (gap < bestGap) {
          bestGap = gap
          best = i
        }
      }
    }
    return best
  }

  // 1) Libro: movimientos proyectados (facturas por pagar e ingresos esperados)
  const ledger = ledgerProjected(input.entries, today)
  for (const p of ledger) {
    if (p.date > endDate) {
      beyondHorizonCount++
      continue
    }
    // ¿Ya salió/entró en el banco? Estricto: monto ±2 %, ±10 días, mismo comercio.
    const key = `pp:${p.entry.id}`
    if (!dismissed.has(key)) {
      const ti = findTx(p.income, p.amount, p.date, p.label, 10, 0.02)
      if (ti >= 0) {
        usedTx.add(ti)
        probablePaid.push({ key, entry: p.entry, tx: bankTxs[ti] })
        continue
      }
    }
    if (p.date < today) {
      const od: ForecastLine = {
        id: `od:${p.entry.id}`,
        date: today,
        label: p.label,
        amount: p.income ? p.amount : -p.amount,
        kind: "overdue",
        entry: p.entry,
        originalDate: p.date,
      }
      // Factura vencida: sigue por pagar → se resta HOY. Ingreso atrasado: no se cuenta.
      if (p.income) overdueIncome.push(od)
      else lines.push(od)
      continue
    }
    lines.push({
      id: `pj:${p.entry.id}`,
      date: p.date,
      label: p.label,
      amount: p.income ? p.amount : -p.amount,
      kind: "proj",
      entry: p.entry,
    })
  }

  // 2) Recurrentes (claris_scheduled_entries)
  let recurringCount = 0
  for (const s of input.schedules || []) {
    const amt = r2(Math.abs(Number(s?.amount) || 0))
    if (!s || amt < 0.01) continue
    const income = s.kind === "income"
    const label = s.description || s.category || (income ? "Income" : "Expense")
    const win = paidWindow(s.frequency)
    for (const d of expandSchedule(s, today, endDate)) {
      // Excepción "solo esta vez": saltar o cambiar esta ocurrencia.
      const ov = (input.overrides || []).find((o) => o.scheduleId === s.id && o.date === d)
      if (ov?.skip) continue
      // amount 0 = el día no se trabajó: la ocurrencia queda en $0 (visible).
      const effAmt =
        ov && Number.isFinite(Number(ov.amount)) && Number(ov.amount) >= 0 ? r2(Number(ov.amount)) : amt
      const effLabel = ov?.label && String(ov.label).trim() ? String(ov.label).trim() : label
      // Ya está en el libro (misma factura creada desde Gastos/escáner): no duplicar.
      const dup = ledger.some(
        (p) =>
          p.income === income &&
          Math.abs(diffDays(p.date, d)) <= 3 &&
          amountClose(p.amount, effAmt, 0.02) &&
          (vendorMatch(p.label, effLabel) || String(p.entry.id).replace(/^claris:gasto:/, "sch-") === s.id),
      )
      if (dup) {
        duplicatesSkipped++
        continue
      }
      // ¿Pagado/cobrado adelantado en el banco? (estilo Quicken: monto ±15 %)
      if (win > 0) {
        const ti = findTx(income, effAmt, d, effLabel, win, 0.15)
        if (ti >= 0) {
          usedTx.add(ti)
          recurringPaidSkipped++
          continue
        }
      }
      recurringCount++
      lines.push({
        id: `rc:${s.id}:${d}`,
        date: d,
        label: effLabel,
        amount: income ? effAmt : -effAmt,
        kind: "rec",
        scheduleId: s.id,
        frequency: s.frequency,
      })
    }
  }

  // 3) Pagos de card (vencen el día que toca). El monto = saldo actual de la card.
  let cardCount = 0
  for (const d of input.dues || []) {
    if (!d || d.kind !== "card" || !isIsoDate(d.nextDate)) continue
    const dt = String(d.nextDate).slice(0, 10)
    if (dt < today) continue
    if (dt > endDate) {
      beyondHorizonCount++
      continue
    }
    const amt = r2(Math.abs(Number(input.balances?.[d.accountId]) || 0))
    if (amt < 0.01) continue
    cardCount++
    lines.push({
      id: `cd:${d.accountId}:${dt}`,
      date: dt,
      label: `Payment · ${d.accountName || d.accountId}`,
      amount: -amt,
      kind: "card",
    })
  }

  // 4) Orden por fecha (estable: vencidos y quiebres antes entre fechas iguales).
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  // 5) Totales.
  let incomeTotal = 0
  let expenseTotal = 0
  let incomeCount = 0
  let expenseCount = 0
  let overdueExpenseTotal = 0
  let overdueExpenseCount = 0
  for (const ln of lines) {
    if (ln.amount >= 0) {
      incomeTotal = r2(incomeTotal + ln.amount)
      incomeCount++
    } else {
      expenseTotal = r2(expenseTotal - ln.amount)
      expenseCount++
      if (ln.kind === "overdue") {
        overdueExpenseTotal = r2(overdueExpenseTotal - ln.amount)
        overdueExpenseCount++
      }
    }
  }

  // 6) Day a día con balance corriendo (sirve para la gráfica y para el saldo más bajo).
  const days: ForecastDay[] = []
  let bal = start
  let lowest = { date: today, balance: start }
  let cursor = today
  let li = 0
  for (let i = 0; i <= horizon; i++) {
    const dayLines: ForecastLine[] = []
    while (li < lines.length && lines[li].date === cursor) dayLines.push(lines[li++])
    const delta = r2(dayLines.reduce((s, x) => s + x.amount, 0))
    bal = r2(bal + delta)
    if (bal < lowest.balance) lowest = { date: cursor, balance: bal }
    days.push({ date: cursor, lines: dayLines, delta, balance: bal })
    cursor = addDaysIso(cursor, 1)
  }

  return {
    today,
    endDate,
    start,
    days,
    lines,
    incomeTotal,
    expenseTotal,
    incomeCount,
    expenseCount,
    end: bal,
    lowest,
    overdueExpenseTotal,
    overdueExpenseCount,
    overdueIncome,
    overdueIncomeTotal: r2(overdueIncome.reduce((s, x) => s + Math.abs(x.amount), 0)),
    probablePaid,
    recurringCount,
    cardCount,
    duplicatesSkipped,
    recurringPaidSkipped,
    beyondHorizonCount,
  }
}
