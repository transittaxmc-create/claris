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
  "Gasolina / Combustible",
  "Mantenimiento / Vehículo",
  "Peajes",
  "Alimentación / Comida",
  "Lavado de Auto",
  "Seguros / Permisos",
  "Varios",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

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

export type CashFlowEntry = {
  id: string
  date: string
  description: string
  source: CashFlowSource
  sourceLabel?: string
  type: CashFlowType
  status: CashFlowStatus
  amount: number
  category?: string
  isManuallyEdited?: boolean
  notes?: string
  createdAt?: string
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
  scheduled?: boolean
  classification?: ExpenseClassification
  /** factura | recibo | manual — define a dónde va en el libro */
  docType?: ExpenseDocType
  savedAt?: string
}

export type ExpenseClassification = "business" | "personal"

/** Cómo entró el documento: factura (por pagar), recibo (ya pagado) o manual. */
export type ExpenseDocType = "factura" | "recibo" | "manual"

export function newExpense(): Expense {
  return {
    id: crypto.randomUUID(),
    date: localDateKey(new Date()),
    vendor: "",
    category: "Varios",
    amount: 0,
    notes: "",
    isAiGenerated: false,
    isEditedByUser: false,
    savedAt: new Date().toISOString(),
  }
}

export function stampExpense(e: Expense, at: string = new Date().toISOString()): Expense {
  return { ...e, savedAt: at }
}

export type ExpenseUpdate = {
  expenseId: string
  category?: string
  classification?: ExpenseClassification
}

export type ExpenseUpdateResult = {
  expenses: Expense[]
  applied: number
}

export function applyExpenseUpdatesToExpenses(
  expenses: Expense[],
  updates: ExpenseUpdate[],
): ExpenseUpdateResult {
  const valid = updates.filter((u) => {
    if (!u || typeof u.expenseId !== "string" || !u.expenseId) return false
    const categoryOk = u.category === undefined || (typeof u.category === "string" && u.category.trim().length > 0)
    const classificationOk =
      u.classification === undefined || u.classification === "business" || u.classification === "personal"
    return categoryOk && classificationOk && (u.category !== undefined || u.classification !== undefined)
  })

  let applied = 0
  const next = expenses.map((e) => {
    const update = valid.find((u) => u.expenseId === e.id)
    if (!update) return e
    let changed = false
    const patch: Partial<Expense> = {}
    if (update.category !== undefined && update.category.trim() !== e.category) {
      patch.category = update.category.trim()
      changed = true
    }
    if (update.classification !== undefined && update.classification !== e.classification) {
      patch.classification = update.classification
      changed = true
    }
    if (!changed) return e
    applied += 1
    return { ...e, ...patch, isEditedByUser: true, savedAt: new Date().toISOString() }
  })

  return { expenses: next, applied }
}

export function nextOccurrenceDate(date: string, frequency: ScheduleFrequency): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  if (frequency === "daily") d.setDate(d.getDate() + 1)
  else if (frequency === "weekly") d.setDate(d.getDate() + 7)
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1)
  else if (frequency === "annual") d.setFullYear(d.getFullYear() + 1)
  return localDateKey(d)
}

export function scheduledEntryFromExpense(
  expense: Expense,
  frequency: ScheduleFrequency,
  nextDate: string,
): ScheduledEntry {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sch-${Date.now()}`,
    kind: "expense",
    description: expense.vendor || "Gasto",
    category: expense.category,
    amount: expense.amount,
    startDate: expense.date,
    nextDate,
    frequency,
    active: true,
  }
}

export function daysUntil(date: string, from: Date = new Date()): number {
  const target = new Date(`${date}T12:00:00`)
  if (Number.isNaN(target.getTime())) return 0
  const base = new Date(from)
  base.setHours(12, 0, 0, 0)
  return Math.round((target.getTime() - base.getTime()) / 86_400_000)
}

export function expenseTotal(list: Expense[]): number {
  return list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
}

export type ExpenseDuplicateMatch = {
  expense: Expense
  centsDiff: number
}

export function normalizeVendorName(vendor: unknown): string {
  return String(vendor ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function expenseCents(amount: unknown): number {
  const n = Number(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function findDuplicateExpense(
  candidate: { id?: string | null; vendor: unknown; date: unknown; amount: unknown },
  list: Expense[],
): ExpenseDuplicateMatch | null {
  const vendor = normalizeVendorName(candidate.vendor)
  const cents = expenseCents(candidate.amount)
  const date = String(candidate.date ?? "").slice(0, 10)
  if (!vendor || cents <= 0 || !date) return null
  for (const e of list) {
    if (candidate.id && e.id === candidate.id) continue
    if (normalizeVendorName(e.vendor) !== vendor) continue
    if (String(e.date ?? "").slice(0, 10) !== date) continue
    const diff = Math.abs(expenseCents(e.amount) - cents)
    if (diff <= 1) return { expense: e, centsDiff: diff }
  }
  return null
}

export type Reconciliation = {
  expected?: number
  received?: number
  note?: string
  reconciledAt?: string
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
  pickupLoc?: LocationPoint
  dropoffLoc?: LocationPoint
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
  empower: "Other",
  gallant: "Other",
  "access-a-ride": "Other",
  "access a ride": "Other",
}

export function normalizePlatformName(value: unknown): Platform {
  const raw = String(value ?? "").trim()
  if (!raw) return "Other"
  const exact = PLATFORMS.find((p) => p === raw)
  if (exact) return exact
  const key = raw.toLowerCase()
  return LEGACY_PLATFORM_ALIASES[key] ?? "Other"
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
