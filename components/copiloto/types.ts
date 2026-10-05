import type { LocationPoint } from "./geo"
import { localDateKey } from "@/lib/dates"

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

// ---------------------------------------------------------------------------
// Cash Flow Register (pestaña FINANCE ➔ Libro Mayor)
// ---------------------------------------------------------------------------
export type CashFlowStatus = "actual" | "projected"
export type CashFlowType = "income" | "expense"
export type CashFlowSource = "bank" | "receipt" | "trip" | "projection" | "manual"

export type CashFlowEntry = {
  id: string
  date: string // "YYYY-MM-DD"
  description: string
  source: CashFlowSource
  sourceLabel?: string // "Banco Chase", "Uber Trip", "Recibo Shell", ...
  type: CashFlowType
  status: CashFlowStatus
  amount: number
  category?: string
  // Cuenta bancaria a la que pertenece (ver BankAccount). Vacío = sin asignar.
  accountId?: string
  // Marcado al conciliar contra el statement mensual.
  reconciled?: boolean
  // Escaneos y extractos son 100% editables; solo se marca como editado.
  isManuallyEdited?: boolean
  notes?: string
  createdAt?: string
}

// ---------------------------------------------------------------------------
// Registro bancario: cuentas + reglas recurrentes
// ---------------------------------------------------------------------------

export type BankAccount = {
  id: string
  name: string // "Chase", "TD Bank", ...
  last4?: string // últimos 4 dígitos (opcional)
  // Saldo de apertura: punto de partida del balance real de esta cuenta.
  openingBalance?: number
  createdAt: string
}

export function newBankAccount(name: string, last4?: string): BankAccount {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cta-${Date.now()}`,
    name: name.trim(),
    last4: (last4 || "").replace(/\D/g, "").slice(-4) || undefined,
    createdAt: new Date().toISOString(),
  }
}

// Regla recurrente: genera movimientos PROYECTADOS (nunca tocan el saldo real).
// Frecuencia: once | daily | weekly | monthly | annual (ver ScheduleFrequency).
export type RecurringRule = {
  id: string
  accountId?: string
  kind: "income" | "expense"
  description: string
  category?: string
  amount: number
  frequency: ScheduleFrequency
  startDate: string // YYYY-MM-DD
  endDate?: string // hasta cuándo; vacío = se expande 12 meses
  active: boolean
  createdAt: string
}

export function newRecurringRule(init: Partial<RecurringRule> & { kind: "income" | "expense"; description: string; amount: number; startDate: string }): RecurringRule {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `regla-${Date.now()}`,
    frequency: "monthly",
    active: true,
    createdAt: new Date().toISOString(),
    ...init,
  } as RecurringRule
}

// Firma estable de un movimiento bancario: cuenta + fecha + centavos +
// descripción normalizada. Dos lecturas del mismo movimiento (dos screenshots
// del banco) generan el mismo id, así upsertMovimiento lo actualiza en vez de
// duplicarlo. Tolerancia de 1 centavo por redondeos de OCR.
export function bankMoveId(accountId: string, date: string, amount: unknown, description: unknown): string {
  const cents = expenseCents(amount)
  const slug = normalizeVendorName(description).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "mov"
  return `claris:banco:${accountId}:${String(date).slice(0, 10)}:${cents}:${slug}`
}

// Expande una regla recurrente en movimientos proyectados entre dos fechas.
// Los ids son deterministas ("claris:regla:<id>:<fecha>") para no duplicar.
export function expandRecurringRule(rule: RecurringRule, fromDate: string, toDate: string): CashFlowEntry[] {
  if (!rule.active) return []
  const out: CashFlowEntry[] = []
  const end = rule.endDate && rule.endDate < toDate ? rule.endDate : toDate
  // "once": una sola ocurrencia si cae en el rango.
  if (rule.frequency === "once") {
    if (rule.startDate >= fromDate && rule.startDate <= end) {
      out.push(recurringEntry(rule, rule.startDate))
    }
    return out
  }
  let d = rule.startDate < fromDate ? advanceToRange(rule, fromDate) : rule.startDate
  let guard = 0
  while (d <= end && guard < 400) {
    out.push(recurringEntry(rule, d))
    d = nextOccurrenceDate(d, rule.frequency)
    guard++
  }
  return out
}

function recurringEntry(rule: RecurringRule, date: string): CashFlowEntry {
  return {
    id: `claris:regla:${rule.id}:${date}`,
    date,
    description: rule.description,
    source: "projection",
    sourceLabel: "Recurrente",
    type: rule.kind,
    status: "projected",
    amount: Math.round((Number(rule.amount) || 0) * 100) / 100,
    category: rule.category,
    accountId: rule.accountId,
    createdAt: new Date().toISOString(),
  }
}

// Avanza la fecha de una regla hasta alcanzar el inicio del rango visible.
function advanceToRange(rule: RecurringRule, fromDate: string): string {
  let d = rule.startDate
  let guard = 0
  while (d < fromDate && guard < 400) {
    d = nextOccurrenceDate(d, rule.frequency)
    guard++
  }
  return d
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
  // Se marcó como pago programado con frecuencia (ver scheduledEntryFromExpense).
  scheduled?: boolean
  // Clasificación fiscal: negocio (deducible) o personal. Sin valor = aún sin
  // clasificar; la IA propone una y el usuario puede ajustarla.
  classification?: ExpenseClassification
  // Hora de modificación: es lo que permite combinar gastos entre dos
  // teléfonos sin perder cambios (mismo criterio que los viajes).
  savedAt?: string
}

export type ExpenseClassification = "business" | "personal"

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

// ---------------------------------------------------------------------
// Actualización de gastos propuesta por la IA (categoría / clasificación)
// ---------------------------------------------------------------------

export type ExpenseUpdate = {
  expenseId: string
  // Categoría corregida por la IA (solo si propone una distinta y válida).
  category?: string
  // Clasificación fiscal propuesta.
  classification?: ExpenseClassification
}

export type ExpenseUpdateResult = {
  expenses: Expense[]
  applied: number
}

// Aplica las correcciones de la IA a los gastos: cambia la categoría y la
// clasificación solo en los gastos indicados; los demás quedan intactos. Los
// valores inválidos (categoría vacía, clasificación rara) se ignoran. Lógica
// pura, probada en Node.
export function applyExpenseUpdatesToExpenses(
  expenses: Expense[],
  updates: ExpenseUpdate[],
): ExpenseUpdateResult {
  const valid = updates.filter((u) => {
    if (!u || typeof u.expenseId !== "string" || !u.expenseId) return false
    const categoryOk = u.category === undefined || (typeof u.category === "string" && u.category.trim().length > 0)
    const classificationOk = u.classification === undefined || u.classification === "business" || u.classification === "personal"
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

// ---------------------------------------------------------------------
// Pagos programados (vencimiento + frecuencia) a partir de un gasto
// ---------------------------------------------------------------------

// Calcula la próxima fecha de ocurrencia a partir de una fecha base.
export function nextOccurrenceDate(date: string, frequency: ScheduleFrequency): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  if (frequency === "daily") d.setDate(d.getDate() + 1)
  else if (frequency === "weekly") d.setDate(d.getDate() + 7)
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1)
  else if (frequency === "annual") d.setFullYear(d.getFullYear() + 1)
  return localDateKey(d)
}

// Crea la entrada del ledger programado a partir de un gasto. Solo tiene
// sentido con frecuencia distinta de "once". El id del gasto viaja como
// `sourceExpenseId` para poder enlazar ambos lados más adelante.
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

// Días que faltan hasta una fecha (0 = hoy, negativo = vencida).
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
// FINANCE. OJO: `datetime` se guarda en UTC, así que la clave se calcula en hora
// LOCAL — si no, un viaje de las 22:00 en Nueva York caería en el día siguiente y
// FINANCE lo perdería. Sin dato, se usa la fecha de hoy como respaldo.
export function tripDateOf(t: Trip): string {
  const raw = t.raw as { datetime?: unknown } | undefined
  const value = raw?.datetime
  if (typeof value === "string" && value.length >= 10) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return localDateKey(parsed)
  }
  return localDateKey(new Date())
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
  // Con separador de miles: $2,425.00 se lee de un golpe; $2425.00 hay que
  // descifrarlo. Los centavos se mantienen porque aquí se concilia al centavo.
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
