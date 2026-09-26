// Store de finanzas semanales — versión sin dependencias externas.
//
// API compatible con el hook zustand del paquete recibido (LEEME + archivos
// en Downloads/files): mismos nombres de acciones y cálculos, pero sin
// `zustand` (no está en package.json). Persistencia en localStorage bajo la
// clave claris_finance_week_v1. El hook re-renderiza con useSyncExternalStore.

import { useSyncExternalStore } from "react"

export interface IncomePlatform {
  platformName: string
  projectedAmount: number
  actualAmount: number
}

export interface DayData {
  id: string
  date: string // ISO yyyy-mm-dd
  isWorkingDay: boolean
  platforms: IncomePlatform[]
}

export interface UpcomingExpense {
  id: string
  name: string
  amount: number
  dueDate: string // ISO yyyy-mm-dd
  priority: 1 | 2 // 1: Crítico, 2: Secundario
}

export type FinanceExpenseCategory =
  | "Combustible"
  | "Comida / Gastro"
  | "Mantenimiento / Taller"
  | "Lavado"
  | "Peajes / E-ZPass"
  | "Seguro"

export const FINANCE_EXPENSE_CATEGORIES: FinanceExpenseCategory[] = [
  "Combustible",
  "Comida / Gastro",
  "Mantenimiento / Taller",
  "Lavado",
  "Peajes / E-ZPass",
  "Seguro",
]

export interface LoggedExpense {
  id: string
  category: FinanceExpenseCategory
  amount: number
  note?: string
  date: string // ISO
}

// Plataformas por defecto al generar una semana nueva.
export const DEFAULT_PLATFORMS = [
  "Uber",
  "Lyft",
  "EcoRide",
  "Empower",
  "Gallant",
  "Aventus",
  "Throo",
  "Access-A-Ride",
]

export const LOW_BALANCE_THRESHOLD = 400
const RESERVE_RATE = 0.1
const STORE_KEY = "claris_finance_week_v1"

const makeId = () => Math.random().toString(36).slice(2, 10)
const todayIso = () => new Date().toISOString().slice(0, 10)

type FinanceState = {
  startingBalance: number
  reserveBalance: number
  days: DayData[]
  upcomingExpenses: UpcomingExpense[]
  loggedExpenses: LoggedExpense[]
}
function buildWeekDays(startDate?: Date): DayData[] {
  const base = startDate ? new Date(startDate) : new Date()
  const monday = new Date(base)
  const dow = (monday.getDay() + 6) % 7 // 0 = lunes
  monday.setDate(monday.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    return {
      id: `day-${iso}`,
      date: iso,
      isWorkingDay: i < 5,
      platforms: DEFAULT_PLATFORMS.map((platformName) => ({
        platformName,
        projectedAmount: 0,
        actualAmount: 0,
      })),
    }
  })
}

const INITIAL: FinanceState = {
  startingBalance: 0,
  reserveBalance: 0,
  days: [],
  upcomingExpenses: [],
  loggedExpenses: [],
}

let state: FinanceState = INITIAL
let hydrated = false
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function sanitize(parsed: unknown): FinanceState {
  if (!parsed || typeof parsed !== "object") return { ...INITIAL, days: buildWeekDays() }
  const p = parsed as Partial<FinanceState>
  return {
    startingBalance: Number(p.startingBalance) || 0,
    reserveBalance: Number(p.reserveBalance) || 0,
    days: Array.isArray(p.days) && p.days.length > 0 ? (p.days as DayData[]) : buildWeekDays(),
    upcomingExpenses: Array.isArray(p.upcomingExpenses) ? (p.upcomingExpenses as UpcomingExpense[]) : [],
    loggedExpenses: Array.isArray(p.loggedExpenses) ? (p.loggedExpenses as LoggedExpense[]) : [],
  }
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  try {
    if (typeof localStorage === "undefined") {
      state = { ...INITIAL, days: buildWeekDays() }
      return
    }
    const raw = localStorage.getItem(STORE_KEY)
    state = raw ? sanitize(JSON.parse(raw)) : { ...INITIAL, days: buildWeekDays() }
  } catch {
    state = { ...INITIAL, days: buildWeekDays() }
  }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch {}
  notify()
}

function set(partial: Partial<FinanceState>) {
  state = { ...state, ...partial }
  persist()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): FinanceState {
  hydrate()
  return state
}

function snapshot(): FinanceState {
  hydrate()
  return state
}
// ---------------------------------------------------------------------------
// Acciones (mismos nombres que el paquete recibido)
// ---------------------------------------------------------------------------
export function setStartingBalance(balance: number) {
  hydrate()
  set({ startingBalance: Number(balance) || 0 })
}

export function toggleWorkingDay(dayId: string) {
  hydrate()
  set({
    days: state.days.map((d) => (d.id === dayId ? { ...d, isWorkingDay: !d.isWorkingDay } : d)),
  })
}

export function updatePlatformAmount(
  dayId: string,
  platformName: string,
  field: "projectedAmount" | "actualAmount",
  value: number,
) {
  hydrate()
  set({
    days: state.days.map((d) =>
      d.id !== dayId
        ? d
        : {
            ...d,
            platforms: d.platforms.map((p) =>
              p.platformName === platformName ? { ...p, [field]: Number(value) || 0 } : p,
            ),
          },
    ),
  })
}

export function initializeWeek(startDate?: Date) {
  set({ days: buildWeekDays(startDate) })
}

export function addUpcomingExpense(expense: Omit<UpcomingExpense, "id">) {
  hydrate()
  set({ upcomingExpenses: [...state.upcomingExpenses, { ...expense, id: makeId() }] })
}

export function removeUpcomingExpense(id: string) {
  hydrate()
  set({ upcomingExpenses: state.upcomingExpenses.filter((e) => e.id !== id) })
}

// Registro rápido: descuenta del saldo real y separa 10% a la reserva.
export function addExpense(expense: Omit<LoggedExpense, "id" | "date">) {
  hydrate()
  const reserveCut = (Number(expense.amount) || 0) * RESERVE_RATE
  set({
    loggedExpenses: [...state.loggedExpenses, { ...expense, id: makeId(), date: todayIso() }],
    startingBalance: state.startingBalance - (Number(expense.amount) || 0),
    reserveBalance: state.reserveBalance + reserveCut,
  })
}

export function resetAllData() {
  set({
    startingBalance: 0,
    reserveBalance: 0,
    days: buildWeekDays(),
    upcomingExpenses: [],
    loggedExpenses: [],
  })
}
// ---------------------------------------------------------------------------
// Cálculos (misma semántica que el paquete recibido)
// ---------------------------------------------------------------------------

// daysAhead SÍ filtra por fecha de vencimiento.
export function getUpcomingExpensesTotal(daysAhead: number): number {
  const s = snapshot()
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const cutoff = new Date(now)
  cutoff.setDate(now.getDate() + daysAhead)
  return s.upcomingExpenses
    .filter((e) => {
      const due = new Date(`${e.dueDate}T12:00:00`)
      return !Number.isNaN(due.getTime()) && due >= now && due <= cutoff
    })
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
}

export function getMinProjectedBalance(): number {
  const s = snapshot()
  const total = s.upcomingExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  return Math.max(0, s.startingBalance - total)
}

// Descuenta facturas Y reserva.
export function getInvestableSurplus(): { amount: number; isSafe: boolean } {
  const s = snapshot()
  const totalBills = s.upcomingExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const surplus = s.startingBalance - totalBills - s.reserveBalance
  return { amount: surplus > 0 ? surplus : 0, isSafe: surplus > 0 }
}

export function getEmergencyPlan(): {
  hasDeficit: boolean
  deficitAmount: number
  targetPaymentName: string
  daysRemaining: number
  suggestedDailyIncrease: number
} {
  const s = snapshot()
  const totalBills = s.upcomingExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const deficit = totalBills - s.startingBalance
  if (deficit > 0) {
    const sorted = [...s.upcomingExpenses].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
    const target = sorted[0]?.name || "Compromisos Próximos"
    const workingDaysLeft = Math.max(1, s.days.filter((d) => d.isWorkingDay).length || 5)
    return {
      hasDeficit: true,
      deficitAmount: deficit,
      targetPaymentName: target,
      daysRemaining: workingDaysLeft,
      suggestedDailyIncrease: Math.ceil(deficit / workingDaysLeft),
    }
  }
  return {
    hasDeficit: false,
    deficitAmount: 0,
    targetPaymentName: "",
    daysRemaining: 0,
    suggestedDailyIncrease: 0,
  }
}

// Corrida de caja acumulada día por día (alimenta la tabla).
export function getDailyRunningBalances(): {
  dayId: string
  date: string
  dayTotal: number
  runningBalance: number
  isLow: boolean
}[] {
  const s = snapshot()
  let running = s.startingBalance
  return s.days.map((d) => {
    const dayTotal = d.isWorkingDay
      ? d.platforms.reduce((acc, p) => acc + (Number(p.actualAmount) || Number(p.projectedAmount) || 0), 0)
      : 0
    running += dayTotal
    return {
      dayId: d.id,
      date: d.date,
      dayTotal,
      runningBalance: running,
      isLow: running < LOW_BALANCE_THRESHOLD,
    }
  })
}

// Hook único para componentes cliente.
export function useFinance() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    startingBalance: snap.startingBalance,
    reserveBalance: snap.reserveBalance,
    days: snap.days,
    upcomingExpenses: snap.upcomingExpenses,
    loggedExpenses: snap.loggedExpenses,
    setStartingBalance,
    toggleWorkingDay,
    updatePlatformAmount,
    initializeWeek,
    addUpcomingExpense,
    removeUpcomingExpense,
    addExpense,
    resetAllData,
    getMinProjectedBalance,
    getUpcomingExpensesTotal,
    getInvestableSurplus,
    getEmergencyPlan,
    getDailyRunningBalances,
  }
}



