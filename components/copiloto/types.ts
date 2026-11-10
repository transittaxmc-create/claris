import type { LocationPoint } from "./geo"
import { localDateKey } from "@/lib/dates"

export type Platform =
  | "Uber"
  | "Lyft"
  | "Limosys"
  | "Eco Ride"
  | "Throo"
  | "AKI Technology"
  | "Classic Ryde"
  | "Aventus Ride"
  | "Cash"
  | "Other"

export type TripStatus = "pending" | "matched"

export type { LocationPoint }

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Vehicle maintenance",
  "Car leasing",
  "Rent",
  "Tolls",
  "Food",
  "Car wash",
  "Insurance",
  "Bank fees",
  "Phone",
  "Parking",
  "Supplies",
  "Other",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CUSTOM_CATEGORIES_KEY = "claris_custom_categories"

/**
 * Migración 2026-10-18: la app pasó a inglés. Los datos guardados en el
 * teléfono pueden traer nombres viejos; se normalizan al leer.
 */
export const CATEGORY_MIGRATION: Record<string, string> = {
  "Fuel / Gasolina": "Fuel",
  "Tolls / EZPass": "Tolls",
  "Food / Meals": "Food",
  "Maintenance / Vehicle": "Vehicle maintenance",
  "Rent / Renta": "Rent",
  "Insurance / Permits": "Insurance",
  "Phone / Data": "Phone",
  "Other / Varios": "Other",
  Ingresos: "Income",
  "Transfer interna": "Internal transfer",
}

export function migrateCategory(c: unknown): string {
  const s = String(c || "")
  return CATEGORY_MIGRATION[s] ?? s
}

export type ScheduleFrequency = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "annual"

export type ScheduledEntry = {
  id: string
  kind: "income" | "expense"
  description: string
  category: string
  amount: number
  startDate: string
  endDate?: string
  occurrences?: number
  frequency: ScheduleFrequency
  nextDate: string
  active: boolean
  /** División por categorías estilo Quicken (Miguel, 2026-11-09): UNA
   *  transacción repartida en varias categorías. Cuando existe, la suma
   *  de las líneas es el monto total y `category` queda "Split". */
  splits?: TxSplit[]
}

/** Una línea de la división por categorías de una transacción (Quicken
 *  split): su categoría, su monto y, si la línea es una factura, su
 *  número de invoice. La transacción sigue siendo UNA sola. */
export type TxSplit = {
  category: string
  amount: number
  invoiceNo?: string
}

export const SPLIT_CATEGORY = "Split"

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function splitsSum(splits?: TxSplit[] | null): number {
  if (!Array.isArray(splits)) return 0
  return round2(splits.reduce((a, s) => a + (Number(s?.amount) || 0), 0))
}

/** Normaliza líneas de división: descarta montos en cero, recorta textos.
 *  Devuelve undefined si no quedan líneas válidas. */
export function normalizeSplits(raw?: TxSplit[] | null): TxSplit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: TxSplit[] = []
  for (const s of raw) {
    const amount = round2(Number(s?.amount) || 0)
    if (!(amount > 0)) continue
    const category = String(s?.category || "").trim() || "Other"
    const invoiceNo = String(s?.invoiceNo || "").trim().slice(0, 40)
    out.push(invoiceNo ? { category, amount, invoiceNo } : { category, amount })
  }
  return out.length ? out : undefined
}

/** Resuelve qué se guarda al guardar una transacción con el editor de
 *  división abierto (o cerrado):
 *  - Sin división (null): se guarda la categoría simple de siempre.
 *  - Una línea por el total: equivale a la categoría simple de esa línea.
 *  - Dos o más líneas: deben sumar el total (la diferencia debe ser
 *    $0.00, como en Quicken); se guardan las líneas y la categoría de la
 *    transacción queda "Split". */
export function resolveSplitsForSave(
  splits: TxSplit[] | null,
  total: number,
  fallbackCategory: string,
): { ok: true; category: string; splits?: TxSplit[] } | { ok: false; error: string } {
  if (splits === null) return { ok: true, category: fallbackCategory }
  const lines = normalizeSplits(splits)
  if (!lines) return { ok: true, category: fallbackCategory }
  const sum = splitsSum(lines)
  const diff = round2(Math.abs(total) - sum)
  if (Math.abs(diff) > 0.011) {
    return {
      ok: false,
      error: `The split does not add up: difference $${Math.abs(diff).toFixed(2)} ${diff > 0 ? "left to categorize" : "over the total"}.`,
    }
  }
  if (lines.length === 1) return { ok: true, category: lines[0].category }
  return { ok: true, category: SPLIT_CATEGORY, splits: lines }
}

/** Montos por categoría de una transacción: si tiene división, una
 *  entrada por línea (con el monto de la línea); si no, su categoría. */
export function categoryAmountsOf(x: {
  category?: string | null
  amount: number
  splits?: TxSplit[] | null
}): [string, number][] {
  const lines = normalizeSplits(x.splits)
  if (lines && lines.length >= 2) return lines.map((s) => [s.category, s.amount] as [string, number])
  return [[String(x.category || "Other"), Math.abs(Number(x.amount) || 0)]]
}

export type TollBill = {
  id: string
  serviceDate: string
  dueDate: string
  amount: number
  status: "unpaid" | "paid"
}

export type CashFlowStatus = "actual" | "projected"
export type CashFlowType = "income" | "expense"
export type CashFlowSource = "bank" | "receipt" | "trip" | "projection" | "manual"
export type CashFlowOrigin = "scan" | "manual" | "bank" | "trip" | "square" | "transfer"
export type ExpenseClassification = "business" | "personal"
export type ExpenseDocType = "factura" | "recibo" | "manual"

/** Origen de un pago aplicado a una factura. */
export type BillPaymentSource = "recibo" | "banco" | "manual"

/** Un pago (total o parcial) aplicado a una factura. Cada pago cae en el
 *  register de su cuenta; la factura lleva la cuenta Total | Pagado | Resta. */
export type BillPayment = {
  id: string
  amount: number
  /** Register/cuenta de donde salió el pago. */
  accountId?: string
  /** Fecha del pago (yyyy-mm-dd). */
  date: string
  source: BillPaymentSource
  /** Id estable del cargo bancario (para no sugerirlo dos veces). */
  bankTxId?: string
  /** Id del gasto-recibo que originó el pago, si aplica. */
  receiptId?: string
  /** Número de invoice de la factura que este pago cancela (sistema de
   *  Miguel, 2026-11-03): cada pago queda sellado con el número de la
   *  factura a la que fue — el destino con nombre, para que ningún pago
   *  se pierda ni caiga en el ciclo equivocado. Lo estampa addBillPayment
   *  desde la factura; no se teclea a mano. */
  invoiceNo?: string
  note?: string
  /** true = clasificado solo por aprendizaje (lleva etiqueta "auto" y se puede deshacer). */
  auto?: boolean
  createdAt: string
}

export function newBillPayment(p: Omit<BillPayment, "id" | "createdAt">): BillPayment {
  return {
    ...p,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pay-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    createdAt: new Date().toISOString(),
  }
}

export type CashFlowEntry = {
  id: string
  date: string
  description: string
  source: CashFlowSource
  sourceLabel?: string
  origin?: CashFlowOrigin
  type: CashFlowType
  status: CashFlowStatus
  amount: number
  category?: string
  /** División por categorías estilo Quicken (ver TxSplit). */
  splits?: TxSplit[]
  classification?: ExpenseClassification
  isManuallyEdited?: boolean
  notes?: string
  createdAt?: string
  accountId?: string
}

export type Expense = {
  id: string
  date: string
  vendor: string
  category: string
  amount: number
  notes?: string
  confidence?: number
  isAiGenerated: boolean
  isEditedByUser: boolean
  /** Vino del escáner de recibos (lo usa el libro para la etiqueta "Escaneado"). */
  scanned?: boolean
  scheduled?: boolean
  /** Bill de ciclo generado automáticamente desde un recurrente de
   *  Proyecciones (cuentas liability por deuda, Miguel 2026-10-25): id del
   *  ScheduledEntry dueño de esta deuda; la fecha del Expense = el ciclo. */
  originScheduleId?: string
  classification?: ExpenseClassification
  docType?: ExpenseDocType
  /** Número de invoice que la compañía emisora le asignó a ESTA factura
   *  (ej. "CBL-1263590" del leasing), tal como viene impreso en el
   *  documento escaneado. Es la identidad de la factura (Miguel,
   *  2026-11-03): no puede haber dos facturas del mismo vendedor con el
   *  mismo número, y cada pago aplicado queda sellado con este número.
   *  No todos los documentos traen número: sin número, la factura sigue
   *  funcionando como antes (macheo por vendedor/monto). */
  invoiceNo?: string
  /** Solo en RECIBOS de pago: los números de invoice que ese pago dice
   *  cubrir (ej. la confirmación del portal del leasing lista los
   *  invoices que pagó). Se usa para ofrecer el macheo por número,
   *  que manda sobre el macheo por monto. */
  invoiceRefs?: string[]
  /** Register/cuenta de donde salió el gasto (id de registers-store). */
  accountId?: string
  /** Pagos aplicados (solo facturas). La factura se cancela sola al completarse. */
  payments?: BillPayment[]
  /** Match con el banco: cuando se encuentra la transacción bancaria que
   * corresponde a este gasto/recibo/factura, se guarda aquí como prueba
   * definitiva (no se borra; queda archivada para futuro). */
  bankMatched?: {
    date: string
    detail: string
    amount: number
    matchedAt: string
  }
  createdAt?: string
  updatedAt?: string
}

export function newExpense(): Expense {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `exp-${Date.now()}`,
    date: localDateKey(new Date()),
    vendor: "",
    category: "Other",
    amount: 0,
    isAiGenerated: false,
    isEditedByUser: false,
  }
}

export function stampExpense(e: Expense, at: string = new Date().toISOString()): Expense {
  return { ...e, updatedAt: at, createdAt: e.createdAt || at }
}

export type ExpenseUpdate = Partial<Expense> & { id: string }
export type ExpenseUpdateResult = { expenses: Expense[]; changed: boolean }

export function applyExpenseUpdatesToExpenses(
  expenses: Expense[],
  updates: ExpenseUpdate[],
): ExpenseUpdateResult {
  let changed = false
  const map = new Map(expenses.map((e) => [e.id, e]))
  for (const u of updates) {
    const cur = map.get(u.id)
    if (!cur) continue
    map.set(u.id, stampExpense({ ...cur, ...u, id: cur.id }))
    changed = true
  }
  return { expenses: [...map.values()], changed }
}

export function nextOccurrenceDate(date: string, frequency: ScheduleFrequency): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  if (frequency === "daily") d.setDate(d.getDate() + 1)
  else if (frequency === "weekly") d.setDate(d.getDate() + 7)
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1)
  else if (frequency === "annual") d.setFullYear(d.getFullYear() + 1)
  return localDateKey(d)
}

/** Suma meses a una fecha ISO conservando el día (con clamp al último día
 *  del mes destino: 29-oct + 1 mes = 29-nov; + 4 meses = 28-feb). */
export function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return localDateKey(d)
}

/** Cómo termina un recurrente (pedido de Miguel, 2026-10-29): por fecha de
 *  fin o por número de veces; si no se indica nada, dura 3 meses. */
export type ScheduleEnds = { endDate?: string; occurrences?: number }

export const DEFAULT_SCHEDULE_MONTHS = 3

/** Resuelve el fin de un recurrente: lo pedido manda; sin nada
 *  (undefined), 3 meses; null explícito = sin fin, a propósito. */
export function resolveScheduleEnds(startDate: string, ends?: ScheduleEnds | null): ScheduleEnds {
  if (ends === null) return {}
  if (ends?.occurrences && ends.occurrences > 0) return { occurrences: Math.floor(ends.occurrences) }
  if (ends?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(ends.endDate)) return { endDate: ends.endDate }
  return { endDate: addMonthsIso(startDate, DEFAULT_SCHEDULE_MONTHS) }
}

export function scheduledEntryFromExpense(
  e: Expense,
  frequency: ScheduleFrequency = "monthly",
  _nextDate?: string,
  ends?: ScheduleEnds | null,
): ScheduledEntry {
  const today = localDateKey(new Date())
  const startDate = e.date || today
  const resolved = frequency === "once" ? {} : resolveScheduleEnds(startDate, ends)
  return {
    id: `sch-${e.id}`,
    kind: "expense",
    description: e.vendor || e.category,
    category: e.category,
    amount: e.amount,
    startDate,
    nextDate: startDate,
    frequency,
    active: true,
    ...resolved,
  }
}

export function daysUntil(date: string, from: Date = new Date()): number {
  const today = localDateKey(from)
  const a = new Date(`${today}T12:00:00`).getTime()
  const b = new Date(`${String(date).slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86400000)
}

export function expenseTotal(list: Expense[]): number {
  return list.reduce((s, e) => s + (Number(e.amount) || 0), 0)
}

export type ExpenseDuplicateMatch = { expense: Expense; score: number }

export function normalizeVendorName(vendor: unknown): string {
  return String(vendor ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function expenseCents(amount: unknown): number {
  return Math.round((Number(amount) || 0) * 100)
}

export function findDuplicateExpense(
  expenses: Expense[],
  candidate: { vendor?: string; amount?: number; date?: string },
): ExpenseDuplicateMatch | null {
  const v = normalizeVendorName(candidate.vendor)
  const c = expenseCents(candidate.amount)
  const d = String(candidate.date || "").slice(0, 10)
  for (const e of expenses) {
    if (expenseCents(e.amount) !== c) continue
    if (d && String(e.date).slice(0, 10) !== d) continue
    if (v && normalizeVendorName(e.vendor) === v) return { expense: e, score: 1 }
  }
  return null
}

export type Reconciliation = {
  status?: string
  matchedTripId?: string
  notes?: string
}

export type Trip = {
  id: string
  platform: Platform
  isVoucher: boolean
  earnings: number
  extraCash: number
  tips: number
  toll: number
  platformFee: number
  pickup: string
  dropoff: string
  time: string
  ref: string
  status: TripStatus
  reconciliation?: Reconciliation
  raw?: Record<string, unknown>
}

export const PLATFORMS: Platform[] = [
  "Uber",
  "Lyft",
  "Eco Ride",
  "Throo",
  "AKI Technology",
  "Classic Ryde",
  "Aventus Ride",
  "Cash",
  "Other",
]

export const LEGACY_PLATFORM_ALIASES: Record<string, Platform> = {
  ecoride: "Eco Ride",
  "eco ride": "Eco Ride",
  ecorides: "Eco Ride",
  aventus: "Aventus Ride",
  "aventus ride": "Aventus Ride",
  aki: "AKI Technology",
  "aki technology": "AKI Technology",
  "aki tech": "AKI Technology",
  "classic ryde": "Classic Ryde",
  classicryde: "Classic Ryde",
  classic: "Classic Ryde",
  lyft: "Lyft",
  uber: "Uber",
  cash: "Cash",
  other: "Other",
  throo: "Throo",
}

export function normalizePlatformName(value: unknown): Platform {
  const raw = String(value ?? "").trim()
  if (!raw) return "Other"
  const exact = PLATFORMS.find((p) => p === raw)
  if (exact) return exact
  return LEGACY_PLATFORM_ALIASES[raw.toLowerCase()] ?? "Other"
}

export function tripDateOf(t: Trip): string {
  const raw = t.raw as { datetime?: unknown } | undefined
  const value = raw?.datetime
  if (typeof value === "string" && value.length >= 10) {
    const directDate = value.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) return directDate
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return localDateKey(parsed)
  }
  return localDateKey(new Date())
}

export function tripDateInputValue(t: Trip): string {
  return tripDateOf(t)
}

export function grossOf(t: Trip): number {
  // Regla de Miguel (2026-10-19): en Uber/Lyft el peaje ya viene incluido en
  // lo que pagan — se registra en la casilla TOLLS para control, pero NO se
  // suma al gross (sería contarlo dos veces). En los demás, sí se suma.
  const tollCounts = t.platform !== "Uber" && t.platform !== "Lyft"
  return t.earnings + t.extraCash + t.tips + (tollCounts ? t.toll : 0)
}

export function netOf(t: Trip): number {
  return grossOf(t) - t.platformFee
}

export function money(n: number): string {
  const valor = Number(n) || 0
  const texto = Math.abs(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${valor < 0 ? "-" : ""}$${texto}`
}

export function newTrip(): Trip {
  return {
    id: crypto.randomUUID(),
    platform: "Uber",
    isVoucher: false,
    earnings: 0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "",
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    ref: "",
    notes: "",
    status: "pending",
  }
}

export const SEED_TRIPS: Trip[] = []
