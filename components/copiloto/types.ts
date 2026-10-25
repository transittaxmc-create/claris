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
  | "Island City Transit"
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

export type Trip = {
  id: string
  platform: Platform
  date: string
  gross: number
  net?: number
  tips?: number
  tolls?: number
  platformFee?: number
  isVoucher?: boolean
  status?: TripStatus
  notes?: string
  location?: LocationPoint
  reconciliation?: {
    matched?: boolean
    bankTxId?: string
  }
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
  "Island City Transit",
  "Cash",
  "Other",
]

export const LEGACY_PLATFORM_ALIASES: Record<string, Platform> = {
  ecoride: "Eco Ride",
  "eco ride": "Eco Ride",
  ecorides: "Eco Ride",
  aventus: "Aventus Ride",
  "aventus ride": "Aventus Ride",
  "island city transit": "Island City Transit",
  "island city": "Island City Transit",
  islandcitytransit: "Island City Transit",
  ict: "Island City Transit",
  square: "Island City Transit",
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
  return Number(t.gross) || 0
}

export function netOf(t: Trip): number {
  if (typeof t.net === "number") return t.net
  return grossOf(t)
}

export type CashFlowEntry = {
  id: string
  date: string
  description: string
  source?: string
  sourceLabel?: string
  type: "income" | "expense"
  status: "actual" | "projected"
  amount: number
  category?: string
  notes?: string
  createdAt?: string
  isManuallyEdited?: boolean
  platform?: Platform
}

export type ScheduledEntry = {
  id: string
  description: string
  type: "income" | "expense"
  amount: number
  category?: string
  frequency?: string
  nextDate?: string
  dayOfMonth?: number
  platform?: Platform
}

export const SEED_TRIPS: Trip[] = []
