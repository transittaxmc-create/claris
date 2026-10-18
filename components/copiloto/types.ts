import type { LocationPoint } from "./geo"
import { localDateKey } from "@/lib/dates"

export type Platform =
  | "Uber"
  | "Lyft"
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
  "Fuel / Gasolina",
  "Maintenance / Vehicle",
  "Tolls / EZPass",
  "Food / Meals",
  "Car wash",
  "Insurance / Permits",
  "Bank fees",
  "Phone / Data",
  "Parking",
  "Supplies",
  "Other / Varios",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CUSTOM_CATEGORIES_KEY = "claris_custom_categories"

export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly" | "annual"

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
  classification?: ExpenseClassification
  docType?: ExpenseDocType
  /** Register/cuenta de donde salió el gasto (id de registers-store). */
  accountId?: string
  /** Pagos aplicados (solo facturas). La factura se cancela sola al completarse. */
  payments?: BillPayment[]
  createdAt?: string
  updatedAt?: string
}

export function newExpense(): Expense {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `exp-${Date.now()}`,
    date: localDateKey(new Date()),
    vendor: "",
    category: "Other / Varios",
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

export function scheduledEntryFromExpense(e: Expense, frequency: ScheduleFrequency = "monthly"): ScheduledEntry {
  const today = localDateKey(new Date())
  return {
    id: `sch-${e.id}`,
    kind: "expense",
    description: e.vendor || e.category,
    category: e.category,
    amount: e.amount,
    startDate: e.date || today,
    nextDate: e.date || today,
    frequency,
    active: true,
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
  return t.earnings + t.extraCash + t.tips + t.toll
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
    status: "pending",
  }
}

export const SEED_TRIPS: Trip[] = []
