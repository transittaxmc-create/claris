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

/** Un bill REAL (de POR PAGAR o escaneado en Gastos) que puede mandar sobre
 * la ocurrencia de un recurrente: su monto (lo que RESTA) y su fecha de
 * vencimiento son los que proyecta ese ciclo. Regla de Miguel (2026-10-25):
 * la proyección de un bill no es un número fijo — depende de lo que diga
 * el bill de ese mes. */
export interface ForecastBill {
  vendor: string
  /** yyyy-mm-dd: vencimiento real del bill. */
  date: string
  /** Lo que resta por pagar (total − pagos aplicados). 0 = pagado. */
  remaining: number
  /** Recurrente dueño del bill, si está enlazado. */
  scheduleId?: string
  /** true = bill de ciclo auto-creado desde el recurrente (estimado);
   * false = bill real (escaneado/externo): el real manda sobre el auto. */
  auto?: boolean
}

export interface ForecastInput {
  startBalance: number
  entries: CashFlowEntry[]
  schedules: ScheduledEntry[]
  dues?: ForecastDue[]
  /** Balance por cuenta (para el monto del pago de tarjeta). */
  balances?: Record<string, number | null | undefined>
  bankTxs?: ForecastBankTx[]
  /** Provisionales de screenshot (Plan B): evidencia de pago con la misma
   *  fuerza que un cargo de Plaid para el macheo "¿ya se pagó?". Sin esto,
   *  un cargo que solo existe como screenshot (Plaid aún no lo trae) se
   *  proyectaba OTRA vez y el balance bajaba dos veces por el mismo
   *  movimiento (caso Washville, Miguel 2026-10-29). El macheo es
   *  automático en cada cálculo — al cerrar y abrir la app, todo lo que
   *  esté en ese estado queda macheado. */
  shots?: ForecastBankTx[]
  /** yyyy-mm-dd (hora local). */
  today: string
  horizonDays: number
  /** Claves de "probablemente pagado" que el usuario descartó. */
  dismissedPaid?: string[]
  /** Excepciones de "solo esta vez" sobre un recurring (edición o salto). */
  overrides?: ScheduleOverride[]
  /** Bills reales/abiertos: si uno cae en el ciclo de un recurrente de
   * gasto, la ocurrencia proyecta el RESTO del bill en SU fecha. */
  bills?: ForecastBill[]
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

/** Regla de DESTINO FINAL de Miguel (2026-10-29): un INGRESO proyectado solo
 * se considera depositado cuando el dinero cayó en un banco destino —
 * Citibank o PayPal. Las cuentas de paso (Uber Pro Card, Lyft, Square) son
 * donde el dinero se GENERA o espera: un movimiento ahí NO machea un cobro,
 * porque el dinero todavía no llegó a su destino (la Uber Pro Card, p. ej.,
 * solo descarga hacia Citibank y cobra su fee en el camino). Los GASTOS sí
 * machean en cualquier cuenta — él paga desde cualquiera de ellas. */
export function isDestinationAccount(bankAccount?: string): boolean {
  return /citi|access|paypal/i.test(String(bankAccount ?? ""))
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
  // Pool único de evidencia: reales de Plaid + provisionales de screenshot.
  // findTx consume uno a uno (usedTx), así un movimiento y su provisional
  // nunca pagan dos cosas distintas.
  const shotTxs = (input.shots || []).filter(
    (t) => t && isIsoDate(t.date) && String(t.date).slice(0, 10) <= today && Math.abs(Number(t.amount) || 0) >= 0.01,
  )
  const txPool: ForecastBankTx[] = [...bankTxs, ...shotTxs]
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
    for (let i = 0; i < txPool.length; i++) {
      if (usedTx.has(i)) continue
      const t = txPool[i]
      const amt = Number(t.amount) || 0
      if (income ? amt <= 0 : amt >= 0) continue
      if (income && !isDestinationAccount(t.bank_account)) continue
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
      for (let i = 0; i < txPool.length; i++) {
        if (usedTx.has(i)) continue
        const t = txPool[i]
        const amt = Number(t.amount) || 0
        if (amt <= 0) continue
        if (!isDestinationAccount(t.bank_account)) continue
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
    // Tercer intento: el depósito llegó por otra vía o el monto varía más.
    // Solo monto (±15%) y fecha: Miguel lo confirma o descarta en "Por confirmar".
    if (best < 0 && income) {
      const loosePct = Math.max(pct, 0.15)
      for (let i = 0; i < txPool.length; i++) {
        if (usedTx.has(i)) continue
        const t = txPool[i]
        const amt = Number(t.amount) || 0
        if (amt <= 0) continue
        if (!isDestinationAccount(t.bank_account)) continue
        const gap = Math.abs(diffDays(String(t.date).slice(0, 10), date))
        if (gap > window) continue
        // Fee de transferencia: el depósito puede llegar MENOR que el cobro
        // por el fee mínimo de la plataforma ($2.99 la descarga de Uber) —
        // esa diferencia es el fee de la cadena, no dinero perdido.
        const feeGap = amt < amount && amount - amt <= 3.25 + 0.011
        if (!amountClose(amt, amount, loosePct) && !feeGap) continue
        if (gap < bestGap) {
          bestGap = gap
          best = i
        }
      }
    }
    return best
  }

  // ------------------------------------------------------------------
  // Pago GRUPAL (regla de Miguel, 2026-10-29): UN solo cargo puede pagar
  // VARIOS bills a la vez (ej. PayPal −$1,085.90 = leasing $919 + tolls
  // $161.90 + fee $5). El macheo 1-a-1 nunca lo encuentra y los bills se
  // quedaban proyectando como si no se hubieran pagado. Aquí se buscan,
  // por cargo, los grupos de deudas abiertas del mismo comercio cuya
  // SUMA el cargo cubre (exacta, o con un resto chico de fee ≤ $10):
  // si hay UNA sola combinación posible, esas deudas quedan cubiertas
  // por el cargo — no proyectan y el cargo no paga ninguna otra cosa.
  // Si hay dos combinaciones posibles, no se adivina: queda el macheo
  // normal (POR CONFIRMAR). Corre en cada cálculo: al abrir la app todo
  // lo que esté en ese estado queda macheado solo, sin recordatorios.
  // ------------------------------------------------------------------
  const ledger = ledgerProjected(input.entries, today)
  const billsIn: ForecastBill[] = (input.bills || []).filter(
    (b) => b && isIsoDate(b.date) && Number.isFinite(Number(b.remaining)),
  )
  const usedBills = new Set<number>()
  const groupCoveredEntry = new Map<string, ForecastBankTx>()
  const groupCoveredBill = new Set<number>()
  {
    // Deudas proyectables: entradas del libro + bills abiertos, unificados
    // por gemelo (misma fecha, mismo monto, mismo comercio): la factura y
    // su entrada del libro son LA MISMA deuda, no dos.
    type Debt = { amount: number; date: string; label: string; entryIds: string[]; billIdxs: number[] }
    const debts: Debt[] = []
    const addDebt = (amount: number, date: string, label: string, entryId?: string, billIdx?: number) => {
      const amt = r2(Math.abs(Number(amount) || 0))
      if (amt < 0.01) return
      const found = debts.find(
        (d) => d.date === date && Math.abs(d.amount - amt) <= 0.011 && vendorMatch(d.label, label),
      )
      if (found) {
        if (entryId) found.entryIds.push(entryId)
        if (billIdx !== undefined) found.billIdxs.push(billIdx)
        return
      }
      debts.push({
        amount: amt,
        date,
        label,
        entryIds: entryId ? [entryId] : [],
        billIdxs: billIdx !== undefined ? [billIdx] : [],
      })
    }
    for (const p of ledger) if (!p.income) addDebt(p.amount, p.date, p.label, p.entry.id)
    billsIn.forEach((b, bi) => {
      if (Number(b.remaining) > 0.009) addDebt(Number(b.remaining), String(b.date).slice(0, 10), b.vendor, undefined, bi)
    })

    const GROUP_FEE_MAX = 10
    const GROUP_WINDOW = 10
    const coveredDebt = new Set<number>()
    for (let i = 0; i < txPool.length; i++) {
      if (usedTx.has(i)) continue
      const t = txPool[i]
      const txAmt = Math.abs(Number(t.amount) || 0)
      if (!(Number(t.amount) < 0) || txAmt < 0.01) continue // solo salidas
      const tDate = String(t.date).slice(0, 10)
      let cands = debts
        .map((d, di) => ({ d, di }))
        .filter(
          ({ d, di }) =>
            !coveredDebt.has(di) &&
            d.amount <= txAmt + 0.011 &&
            Math.abs(diffDays(tDate, d.date)) <= GROUP_WINDOW &&
            vendorMatch(t.detail, d.label),
        )
        .sort((a, b) => Math.abs(diffDays(tDate, a.d.date)) - Math.abs(diffDays(tDate, b.d.date)))
      if (cands.length < 2) continue
      if (cands.length > 12) cands = cands.slice(0, 12)
      // Subconjuntos de 2+ deudas cuya suma el cargo cubre (resto = fee).
      // Gana la mayor suma cubierta; en empate, el grupo de deudas más
      // cercano en fecha al cargo (el leasing de ESTA semana, no el de
      // la próxima, que vale lo mismo). Solo si persiste el empate hay
      // ambigüedad real y no se aplica.
      let bestSum = -1
      let bestGap = Infinity
      let bestSets = 0
      let bestMask = 0
      const n = cands.length
      for (let mask = 1; mask < 1 << n; mask++) {
        let bits = 0
        let sum = 0
        let gap = 0
        for (let j = 0; j < n; j++) {
          if (mask & (1 << j)) {
            bits++
            sum += cands[j].d.amount
            gap += Math.abs(diffDays(tDate, cands[j].d.date))
          }
        }
        if (bits < 2) continue
        sum = r2(sum)
        const rest = r2(txAmt - sum)
        if (rest < -0.011 || rest > GROUP_FEE_MAX + 0.011) continue
        if (sum > bestSum + 0.011 || (Math.abs(sum - bestSum) <= 0.011 && gap < bestGap)) {
          bestSum = sum
          bestGap = gap
          bestSets = 1
          bestMask = mask
        } else if (Math.abs(sum - bestSum) <= 0.011 && gap === bestGap) {
          bestSets++
        }
      }
      if (bestSets !== 1 || bestMask === 0) continue // ambiguo: no se adivina
      for (let j = 0; j < n; j++) {
        if (!(bestMask & (1 << j))) continue
        coveredDebt.add(cands[j].di)
        const d = cands[j].d
        for (const id of d.entryIds) groupCoveredEntry.set(id, t)
        for (const bi of d.billIdxs) groupCoveredBill.add(bi)
      }
      usedTx.add(i)
    }
  }

  // 1) Libro: movimientos proyectados (facturas por pagar e ingresos esperados)
  for (const p of ledger) {
    if (p.date > endDate) {
      beyondHorizonCount++
      continue
    }
    // ¿Ya salió/entró en el banco? Estricto: monto ±2 %, ±10 días, mismo comercio.
    const key = `pp:${p.entry.id}`
    // Pago grupal: esta entrada la cubre un cargo que pagó varios bills.
    const gTx = !p.income && !dismissed.has(key) ? groupCoveredEntry.get(p.entry.id) : undefined
    if (gTx) {
      probablePaid.push({ key, entry: p.entry, tx: gTx })
      continue
    }
    if (!dismissed.has(key)) {
      const ti = findTx(p.income, p.amount, p.date, p.label, 10, 0.02)
      if (ti >= 0) {
        usedTx.add(ti)
        probablePaid.push({ key, entry: p.entry, tx: txPool[ti] })
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

  // Bills reales (POR PAGAR / escaneados): cada uno alimenta UNA sola
  // ocurrencia de su recurrente. La lista (billsIn) se preparó arriba,
  // junto al macheo grupal.

  // 2) Recurrentes (claris_scheduled_entries)
  let recurringCount = 0
  for (const s of input.schedules || []) {
    const amt = r2(Math.abs(Number(s?.amount) || 0))
    if (!s || amt < 0.01) continue
    const income = s.kind === "income"
    const label = s.description || s.category || (income ? "Income" : "Expense")
    const win = paidWindow(s.frequency)
    const occDates = expandSchedule(s, today, endDate)
    // Asignación de bills a ocurrencias (solo gastos). Cada bill va a SU
    // ciclo: primero los bills REALES a su ocurrencia más cercana (±31 días);
    // después los de ciclo auto-creados a la suya, si sigue libre — un bill
    // real siempre desplaza al placeholder de su ciclo, nunca a otro ciclo.
    const billForOcc = new Map<string, ForecastBill>()
    if (!income && billsIn.length > 0) {
      const cands: { b: ForecastBill; bi: number }[] = []
      billsIn.forEach((b, bi) => {
        if (usedBills.has(bi)) return
        // Bill cubierto por un pago grupal y AJENO a este recurrente (ej.
        // los tolls, que solo comparten comercio con el leasing): no
        // ocupa el cupo de una ocurrencia — queda libre para el bill del
        // ciclo siguiente. Si el bill cubierto es del PROPIO recurrente,
        // sí toma su ocurrencia y la rama del bill lo salta como pagado.
        if (groupCoveredBill.has(bi) && b.scheduleId !== s.id) return
        const linked = b.scheduleId && b.scheduleId === s.id
        if (!linked && !vendorMatch(b.vendor, label)) return
        cands.push({ b, bi })
      })
      const assignBills = (list: { b: ForecastBill; bi: number }[], exactOnly: boolean) => {
        for (const { b, bi } of list) {
          if (usedBills.has(bi)) continue
          let bestD: string | null = null
          let bestGap = Infinity
          for (const d of occDates) {
            if (billForOcc.has(d)) continue
            const gap = Math.abs(diffDays(String(b.date).slice(0, 10), d))
            // El bill de ciclo auto SOLO puede caer en SU ocurrencia exacta:
            // si un bill real ya la tomó, el placeholder se suprime — jamás
            // se corre al ciclo siguiente.
            if (exactOnly ? gap === 0 : gap <= 31 && gap < bestGap) {
              bestGap = gap
              bestD = d
            }
          }
          if (bestD) {
            billForOcc.set(bestD, b)
            usedBills.add(bi)
          }
        }
      }
      assignBills(cands.filter((c) => !c.b.auto), false)
      assignBills(cands.filter((c) => c.b.auto), true)
    }
    for (const d of occDates) {
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
      // ¿Este ciclo tiene bill asignado? El bill manda (regla de Miguel,
      // 2026-10-25): la ocurrencia proyecta lo que RESTA del bill, en la
      // fecha del bill — no el monto fijo del recurrente.
      const bill = billForOcc.get(d)
      if (bill) {
        // Bill del propio recurrente cubierto por un pago grupal: este
        // ciclo ya se pagó — no proyecta nada.
        const billIdx = billsIn.indexOf(bill)
        if (billIdx >= 0 && groupCoveredBill.has(billIdx)) continue
        const bDate = String(bill.date).slice(0, 10)
        const remaining = r2(Number(bill.remaining) || 0)
        // Si el libro ya proyecta ESTE bill (entrada del escáner), la
        // línea del recurrente sobra: no duplicar.
        const carried = ledger.some(
          (p) =>
            !p.income &&
            Math.abs(diffDays(p.date, bDate)) <= 3 &&
            amountClose(p.amount, remaining, 0.02) &&
            vendorMatch(p.label, bill.vendor),
        )
        if (carried) {
          duplicatesSkipped++
          continue
        }
        // Bill pagado: este ciclo no proyecta nada.
        if (remaining <= 0.009) continue
        // El bill vence fuera del horizonte: la ocurrencia tampoco entra.
        if (bDate > endDate) {
          beyondHorizonCount++
          continue
        }
        // ¿Ya se pagó aunque el pago aún no esté APLICADO al bill? Si el
        // cargo ya existe como evidencia (Plaid o provisional de
        // screenshot), el balance real YA restó ese dinero: proyectarlo
        // sería contarlo dos veces. Macheo automático en cada cálculo
        // (Miguel, 2026-10-29: "tan pronto cierre y abra la aplicación,
        // va a machear todo lo que está así").
        const tiBill = findTx(false, remaining, bDate, bill.vendor, 10, 0.02)
        if (tiBill >= 0) {
          usedTx.add(tiBill)
          continue
        }
        recurringCount++
        lines.push({
          id: `rc:${s.id}:${d}`,
          date: bDate < today ? today : bDate,
          label: effLabel,
          amount: -remaining,
          kind: bDate < today ? "overdue" : "rec",
          scheduleId: s.id,
          frequency: s.frequency,
          ...(bDate < today ? { originalDate: bDate } : {}),
        })
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
