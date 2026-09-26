// Motor financiero de la pestaña FINANCE ("Balance Diario").
//
// Regla de oro (igual que la app de referencia): el dinero REAL confirmado
// por el banco y lo ESTIMADO nunca comparten la misma celda. Cada fila del
// registro rellena exactamente una columna de importe: Bank (real), Est. in
// o Est. out. El estado (Confirmed / Pending / Estimated) dice de qué lado
// está el dinero.
//
// - confirmed: viaje con status "matched" o gasto con fecha ya pasada → ya
//   pasó por el banco. Mueve el BALANCE REAL.
// - pending: viaje "pending" (ganado, no cobrado) o gasto de hoy/futuro →
//   mueve la PROYECCIÓN, nunca el balance real.
// - estimated: filas del PLAN (renta, seguro, ganancia esperada...) → sólo
//   viven en la proyección.
//
// La lógica de cálculo es pura (sin imports del proyecto salvo tipos) para
// poder probarla en Node igual que lib/sync.ts.

import { netOf, type Expense, type Trip } from "./types"

export type LedgerStatus = "confirmed" | "pending" | "estimated"

export type LedgerRow = {
  id: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:MM" o ""
  source: string
  description: string
  category: string
  bank: number | null // dinero real confirmado
  estIn: number | null // entrada proyectada
  estOut: number | null // salida proyectada
  status: LedgerStatus
  realBalance: number | null
  projectedBalance: number | null
}

// ---------------------------------------------------------------------------
// Plan recurrente (pestaña PLAN)
// ---------------------------------------------------------------------------
export type Recurrence = "daily" | "weekly" | "monthly"

export type PlanItem = {
  id: string
  label: string
  category: string
  amount: number
  direction: "in" | "out"
  cadence: Recurrence
  anchor: number // weekly: 0-6 (0=domingo) · monthly: 1-28 · daily: ignorado
}

export const WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const

// ---------------------------------------------------------------------------
// Fechas (clave local "YYYY-MM-DD")
// ---------------------------------------------------------------------------
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now)
}

export function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDaysKey(key: string, n: number): string {
  const d = parseKey(key)
  if (!d) return key
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

export function prettyDate(key: string): string {
  const d = parseKey(key)
  if (!d) return key
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).replace(".", "")
}

export function newPlanItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `plan-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

// Fecha que le pertenece a un viaje: su datetime guardado, o su hora de
// guardado, o (en última instancia) el día de hoy.
export function tripDateKey(t: Trip, fallback: string): string {
  const raw = (t.raw ?? {}) as Record<string, unknown>
  for (const field of ["datetime", "savedAt"]) {
    const v = raw[field]
    if (typeof v === "string" && v) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return dateKey(d)
    }
  }
  return fallback
}

export function tripTimeValue(t: Trip): string {
  return typeof t.time === "string" ? t.time : ""
}

export function shorten(s: string, max = 34): string {
  const clean = s.trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

export function netOfTrip(t: Trip): number {
  return netOf(t)
}

export type ExpenseLike = Expense
export function expenseDateKey(e: Expense, fallback: string): string {
  return e.date && parseKey(e.date) ? e.date : fallback
}

// ---------------------------------------------------------------------------
// Proyección del PLAN entre hoy y el horizonte
// ---------------------------------------------------------------------------
export function projectPlan(plan: PlanItem[], today: string, horizonDays: number): LedgerRow[] {
  const rows: LedgerRow[] = []
  const horizon = Math.max(0, Math.floor(horizonDays))
  if (!plan.length) return rows

  for (const item of plan) {
    const amount = Math.abs(Number(item.amount) || 0)
    if (amount <= 0) continue
    const estIn = item.direction === "in" ? amount : null
    const estOut = item.direction === "out" ? amount : null

    for (let n = 0; n <= horizon; n++) {
      const key = addDaysKey(today, n)
      const d = parseKey(key)
      if (!d) continue
      let hit = false
      if (item.cadence === "daily") hit = true
      else if (item.cadence === "weekly") hit = d.getDay() === ((item.anchor % 7) + 7) % 7
      else {
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        hit = Math.min(Math.max(1, item.anchor), dim) === d.getDate()
      }
      if (!hit) continue
      rows.push({
        id: `plan-${item.id}-${key}`,
        date: key,
        time: "",
        source: item.label || "Plan",
        description:
          item.cadence === "daily"
            ? "Plan diario"
            : item.cadence === "weekly"
              ? `Plan semanal (${WEEKDAYS_ES[((item.anchor % 7) + 7) % 7]})`
              : `Plan mensual (día ${item.anchor})`,
        category: item.category || "Plan",
        bank: null,
        estIn,
        estOut,
        status: "estimated",
        realBalance: null,
        projectedBalance: null,
      })
    }
  }

  rows.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1))
  return rows
}

// ---------------------------------------------------------------------------
// Registro completo: viajes + gastos + plan → balances real y proyectado
// ---------------------------------------------------------------------------
export type LedgerResult = {
  rows: LedgerRow[]
  /** Último balance real confirmado = lo que el banco ve. */
  bankNow: number
  /** Pendiente por liquidar (ganado no cobrado menos gastos pendientes). */
  pendingNet: number
  /** Balance proyectado al final del horizonte. */
  projectedEnd: number
  /** Fecha hasta donde llega la proyección. */
  projectedThrough: string
  estimatedIn: number
  estimatedOut: number
}

const STATUS_RANK: Record<LedgerStatus, number> = { confirmed: 0, pending: 1, estimated: 2 }

export function buildLedger(args: {
  trips: Trip[]
  expenses: Expense[]
  plan: PlanItem[]
  bankBalance: number
  horizonDays: number
  today: string
}): LedgerResult {
  const { trips, expenses, plan, bankBalance, horizonDays, today } = args
  const horizon = Math.max(0, Math.floor(horizonDays))
  const cutoff = addDaysKey(today, horizon)
  const rows: LedgerRow[] = []

  for (const t of trips) {
    const net = netOfTrip(t)
    const confirmed = t.status === "matched"
    rows.push({
      id: `trip-${t.id}`,
      date: tripDateKey(t, today),
      time: tripTimeValue(t),
      source: t.platform,
      description: t.isVoucher
        ? "Voucher / tarifa fija"
        : t.dropoff
          ? `Viaje → ${shorten(t.dropoff)}`
          : t.pickup
            ? `Viaje ← ${shorten(t.pickup)}`
            : "Viaje",
      category: "Income",
      bank: confirmed ? net : null,
      // Ganado pero no cobrado: vive en la estimación hasta que hace match.
      estIn: confirmed ? null : net >= 0 ? net : null,
      estOut: confirmed ? null : net < 0 ? -net : null,
      status: confirmed ? "confirmed" : "pending",
      realBalance: null,
      projectedBalance: null,
    })
  }

  for (const e of expenses) {
    const amount = Math.abs(Number(e.amount) || 0)
    if (amount <= 0) continue
    const key = expenseDateKey(e, today)
    const confirmed = key < today
    rows.push({
      id: `exp-${e.id}`,
      date: key,
      time: "",
      source: e.vendor || "Gasto",
      description: e.notes ? shorten(e.notes) : e.category || "Gasto",
      category: e.category || "Varios",
      bank: confirmed ? -amount : null,
      estIn: null,
      estOut: confirmed ? null : amount,
      status: confirmed ? "confirmed" : "pending",
      realBalance: null,
      projectedBalance: null,
    })
  }

  rows.push(...projectPlan(plan, today, horizon))

  // Orden cronológico: pasado→futuro. Dentro del mismo día, primero lo real.
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.time !== b.time) return a.time < b.time ? -1 : 1
    if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    return a.id < b.id ? -1 : 1
  })

  // Balance real: se arranca de forma que la última fila confirmada caiga
  // exactamente en el "bank balance now" que el usuario declaró.
  const confirmedDelta = rows.reduce(
    (s, r) => s + (r.status === "confirmed" ? (r.bank ?? 0) : 0),
    0,
  )
  let real = bankBalance - confirmedDelta
  let pendingNet = 0
  let estimatedIn = 0
  let estimatedOut = 0

  // La proyección arranca del banco y acumula todo lo no confirmado en
  // orden cronológico; las filas confirmadas repiten su balance real.
  let running = bankBalance
  for (const r of rows) {
    if (r.status === "confirmed") {
      real += r.bank ?? 0
      r.realBalance = real
      r.projectedBalance = real // un hecho, no una estimación
    } else {
      const delta = (r.estIn ?? 0) - (r.estOut ?? 0)
      if (r.date <= cutoff) {
        running += delta
        if (r.status === "pending") pendingNet += delta
        else {
          estimatedIn += r.estIn ?? 0
          estimatedOut += r.estOut ?? 0
        }
      }
      r.realBalance = null
      r.projectedBalance = running
    }
  }

  return {
    rows,
    bankNow: bankBalance,
    pendingNet,
    projectedEnd: running,
    projectedThrough: cutoff,
    estimatedIn,
    estimatedOut,
  }
}

// ---------------------------------------------------------------------------
// Métricas en vivo del día (franja HOY)
// ---------------------------------------------------------------------------
export type LiveMetrics = {
  grossToday: number
  netToday: number
  expensesToday: number
  tripsToday: number
  hoursSpan: number
  grossPerHour: number
  netPerHour: number
  firstTripTime: string
  lastTripTime: string
}

export function computeLiveMetrics(trips: Trip[], expenses: Expense[], today: string): LiveMetrics {
  const todays = trips.filter((t) => tripDateKey(t, today) === today)
  const grossToday = todays.reduce(
    (s, t) => s + (t.earnings || 0) + (t.tips || 0) + (t.extraCash || 0) + (t.toll || 0),
    0,
  )
  const netToday = todays.reduce((s, t) => s + netOfTrip(t), 0)
  const expensesToday = expenses
    .filter((e) => expenseDateKey(e, today) === today)
    .reduce((s, e) => s + (Math.abs(Number(e.amount)) || 0), 0)

  const minutes: number[] = []
  for (const t of todays) {
    const time = tripTimeValue(t)
    if (!time) continue
    const parts = time.split(":")
    const hh = parseInt(parts[0] ?? "", 10)
    const mm = parseInt(parts[1] ?? "", 10)
    if (Number.isFinite(hh) && Number.isFinite(mm)) minutes.push(hh * 60 + mm)
  }
  let hoursSpan = 0
  let firstTripTime = ""
  let lastTripTime = ""
  if (minutes.length >= 2) {
    const min = Math.min(...minutes)
    const max = Math.max(...minutes)
    hoursSpan = Number(((max - min) / 60).toFixed(2))
    firstTripTime = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
    lastTripTime = `${String(Math.floor(max / 60)).padStart(2, "0")}:${String(max % 60).padStart(2, "0")}`
  } else if (minutes.length === 1) {
    hoursSpan = 1
    firstTripTime = tripTimeValue(todays[0])
    lastTripTime = firstTripTime
  }

  return {
    grossToday,
    netToday,
    expensesToday,
    tripsToday: todays.length,
    hoursSpan,
    grossPerHour: hoursSpan > 0 ? Number((grossToday / hoursSpan).toFixed(2)) : 0,
    netPerHour: hoursSpan > 0 ? Number(((grossToday - expensesToday) / hoursSpan).toFixed(2)) : 0,
    firstTripTime,
    lastTripTime,
  }
}


// ---------------------------------------------------------------------------
// Guardado local (localStorage). La lógica de cálculo de arriba sigue siendo
// pura; este bloque es el único con efectos secundarios.
// ---------------------------------------------------------------------------
export const BANK_KEY = "claris_bank_balance"
export const PLAN_KEY = "claris_plan_items"
export const GOAL_KEY = "claris_day_goal"

function readLocal(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function loadBankBalance(): number {
  try {
    const raw = readLocal(BANK_KEY)
    if (raw == null || raw === "") return 0
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed
    if (parsed && typeof parsed === "object") {
      const v = (parsed as { value?: unknown }).value
      if (typeof v === "number" && Number.isFinite(v)) return v
    }
    return 0
  } catch {
    return 0
  }
}

export function saveBankBalance(value: number): void {
  writeLocal(BANK_KEY, JSON.stringify({ value, updatedAt: new Date().toISOString() }))
}

export function loadPlanItems(): PlanItem[] {
  try {
    const raw = readLocal(PLAN_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is PlanItem => !!p && typeof p === "object" && typeof (p as PlanItem).id === "string",
    )
  } catch {
    return []
  }
}

export function savePlanItems(list: PlanItem[]): void {
  writeLocal(PLAN_KEY, JSON.stringify(list))
}

export function loadDayGoal(): number {
  try {
    const raw = readLocal(GOAL_KEY)
    if (!raw) return 0
    const n = Number(JSON.parse(raw))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveDayGoal(value: number): void {
  writeLocal(GOAL_KEY, JSON.stringify(value))
}


