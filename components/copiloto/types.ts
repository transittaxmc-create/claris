import type { LocationPoint } from "./geo"

// Plataformas soportadas. Los viajes guardados por versiones anteriores (o por
// la app vieja) usan nombres como "EcoRide" o "Aventus"; LEGACY_PLATFORM_ALIASES
// los traduce a estos para que no acaben todos en "Other".
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

// ---------------------------------------------------------------------
// Gastos (pestaña EXPENSES)
// ---------------------------------------------------------------------
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

export type Expense = {
  id: string
  date: string // "YYYY-MM-DD"
  vendor: string
  category: string
  amount: number
  notes?: string
  confidence?: number // 0..1 (lectura por IA, si se usa)
  isAiGenerated: boolean
  isEditedByUser: boolean
  // Hora de modificación: es lo que permite combinar gastos entre dos
  // teléfonos sin perder cambios (mismo criterio que los viajes).
  savedAt?: string
}

export function newExpense(): Expense {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
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

export function expenseTotal(list: Expense[]): number {
  return list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
}

// ---------------------------------------------------------------------
// Detección de gastos duplicados (recibos escaneados dos veces)
// ---------------------------------------------------------------------

// Un gasto es duplicado de otro si coinciden vendedor, fecha y monto. Es la
// firma estable de un recibo: dos gastos con esos tres datos iguales son el
// mismo ticket, aunque la IA haya redactado notas distintas o categorizado
// distinto. El monto se compara en centavos para no fallar por coma flotante,
// y el vendedor normalizado (minúsculas, sin espacios sobrantes) para no
// fallar por "shell" vs "SHELL ".
export type ExpenseDuplicateMatch = {
  expense: Expense
  // Cuántos centavos de diferencia hay; 0 es idéntico.
  centsDiff: number
}

export function normalizeVendorName(vendor: unknown): string {
  return String(vendor ?? "").trim().toLowerCase().replace(/\s+/g, " ")
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

  // Sin vendedor ni monto no hay firma: no se puede declarar duplicado.
  if (!vendor || cents <= 0 || !date) return null

  for (const e of list) {
    // Al editar un gasto, nunca debe marcarse a sí mismo como duplicado.
    if (candidate.id && e.id === candidate.id) continue
    if (normalizeVendorName(e.vendor) !== vendor) continue
    if (String(e.date ?? "").slice(0, 10) !== date) continue
    const diff = Math.abs(expenseCents(e.amount) - cents)
    // Hasta un centavo de tolerancia por redondeos de OCR.
    if (diff <= 1) return { expense: e, centsDiff: diff }
  }
  return null
}

// Reconciliación de un viaje contra el pago real de la plataforma.
// `expected` es el neto que calcula la app; `received` es lo que la
// plataforma depositó de verdad. La diferencia es lo que hay que arreglar.
export type Reconciliation = {
  // Neto esperado. Si falta, se usa netOf(trip) como valor por defecto.
  expected?: number
  // Monto realmente recibido. undefined = todavía no llegó el pago.
  received?: number
  // Nota libre para explicar el descuadre (ej. "ajuste de propinas").
  note?: string
  // Última vez que se tocó la reconciliación.
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
  // Structured GPS location captured with PICKUP NOW / DROPOFF NOW
  pickupLoc?: LocationPoint
  dropoffLoc?: LocationPoint
  time: string // "14:46"
  ref: string
  status: TripStatus
  // Pago esperado vs. recibido (ver components/copiloto/reconciliation.ts).
  reconciliation?: Reconciliation
  // Original entry object from ic_tip_tracker, preserved so GPS/coords survive a round-trip
  raw?: Record<string, unknown>
}

// Orden en el que aparecen en el desplegable de ENTRY y en los chips del editor.
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

// Nombres antiguos -> nombre canónico actual. Se aplican al leer de disco, así
// que un viaje guardado como "EcoRide" sigue siendo Eco Ride y NO se convierte
// en "Other". La comparación es insensible a mayúsculas y espacios sobrantes.
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

// Devuelve la plataforma canónica para cualquier nombre de entrada; "Other" si
// no se reconoce.
export function normalizePlatformName(value: unknown): Platform {
  const raw = String(value ?? "").trim()
  if (!raw) return "Other"
  const exact = PLATFORMS.find((p) => p === raw)
  if (exact) return exact
  const key = raw.toLowerCase()
  return LEGACY_PLATFORM_ALIASES[key] ?? "Other"
}

// La fecha de un viaje vive en raw.datetime (formato del objeto original de
// ic_tip_tracker). Se expone como "YYYY-MM-DD" para poder agrupar por día en
// FINANCE. Sin dato, se usa la fecha de hoy como respaldo conservador.
export function tripDateOf(t: Trip): string {
  const raw = t.raw as { datetime?: unknown } | undefined
  const value = raw?.datetime
  if (typeof value === "string" && value.length >= 10) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

export function grossOf(t: Trip): number {
  // Gross income is calculated before platform fees:
  // EARNINGS + EXTRA CASH + TIPS + TOLLS.
  return t.earnings + t.extraCash + t.tips + t.toll
}

export function netOf(t: Trip): number {
  return grossOf(t) - t.platformFee
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`
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

export const SEED_TRIPS: Trip[] = [
  {
    id: "e-1789570007383",
    platform: "Uber",
    isVoucher: false,
    earnings: 85.66,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "Queensboro Plaza, Court Square, Long Island City, Queens, NY 11101",
    dropoff: "2 East 60th Street, Manhattan, NY 10022",
    time: "14:46",
    ref: "JH",
    status: "pending",
  },
  {
    id: "e-1789563651326",
    platform: "Uber",
    isVoucher: false,
    earnings: 38.04,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "JFK Access Road, Queens, NY 11430",
    time: "13:00",
    ref: "",
    status: "pending",
  },
  {
    id: "e-1789410838473",
    platform: "Aventus Ride",
    isVoucher: true,
    earnings: 54.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "4B, Mineola Avenue, Roslyn Estates, Roslyn Heights, NY 11577",
    dropoff: "42 East 96th Street, Brooklyn, NY 11212",
    time: "18:33",
    ref: "",
    status: "pending",
  },
  {
    id: "e-1789404575549",
    platform: "Aventus Ride",
    isVoucher: true,
    earnings: 38.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "109-50, 142nd Street, Queens, NY 11435",
    dropoff: "1574 Hillside Avenue, New Hyde Park, NY 11040",
    time: "16:49",
    ref: "",
    status: "pending",
  },
  {
    id: "e-1789401593758",
    platform: "Uber",
    isVoucher: false,
    earnings: 1.0,
    extraCash: 0,
    tips: 0,
    toll: 0,
    platformFee: 0,
    pickup: "",
    dropoff: "",
    time: "15:59",
    ref: "",
    status: "pending",
  },
]
