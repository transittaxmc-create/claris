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

/** Custom categories added in Settings — merge with EXPENSE_CATEGORIES in UI. */
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
/** CÓMO entró el movimiento (no confundir con su tipo Factura/Recibo). */
export type CashFlowOrigin = "scan" | "manual" | "bank" | "trip"

export type ExpenseClassification = "business" | "personal"

export type CashFlowEntry = {
  id: string
  date: string
  description: string
  source: CashFlowSource
  sourceLabel?: string
  /** Escaneado | Manual | Banco | Cobros. Se conserva aunque cambie el tipo. */
  origin?: CashFlowOrigin
  type: CashFlowType
  status: CashFlowStatus
  amount: number
  category?: string
  /** business | personal — separate reporting buckets */
  classification?: ExpenseClassification
  isManuallyEdited?: boolean
  notes?: string
  createdAt?: string
  /** register de la cuenta (registers-store). Sin asignar → cuenta principal. */
  accountId?: string
}

export type Trip = {
  id: string
  platform: Platform
  date: string
  startTime?: string
  endTime?: string
  pickup?: LocationPoint
  dropoff?: LocationPoint
  gross?: number
  net?: number
  tips?: number
  toll?: number
  miles?: number
  status?: TripStatus
  notes?: string
  [key: string]: unknown
}

export type Expense = {
  id: string
  date: string
  amount: number
  category: string
  description?: string
  classification?: ExpenseClassification
  notes?: string
  [key: string]: unknown
}

export function money(n: number | null | undefined): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return "$0.00"
  const sign = v < 0 ? "-" : ""
  return sign + "$" + Math.abs(v).toFixed(2)
}

export function grossOf(t: { gross?: number; net?: number }): number {
  return Number(t.gross) || Number(t.net) || 0
}

export function netOf(t: { gross?: number; net?: number }): number {
  return Number(t.net) || Number(t.gross) || 0
}

export function tripDateOf(t: { date?: string }): string {
  return String(t.date || "").slice(0, 10) || localDateKey(new Date())
}

export function daysUntil(iso: string): number {
  const today = localDateKey(new Date())
  const a = new Date(`${today}T12:00:00`).getTime()
  const b = new Date(`${String(iso).slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86400000)
}
