// Lógica pura del puente entre los viajes reales y la corrida de caja.
//
// No toca React ni localStorage: se prueba en Node (scripts/_test-finance.mjs)
// y el store de finance-store.ts la aplica. La decisión clave está documentada
// en applyTripsToDays: los importes REALES rellenan la columna real de la
// corrida, y nunca reducen lo que el usuario haya escrito a mano.

export type RealTripInput = {
  date: string // "YYYY-MM-DD"
  platform: string
  net: number // neto calculado (gross − platformFee)
}

export type PlatformAmount = {
  platformName: string
  projectedAmount: number
  actualAmount: number
}

export type FinanceDay = {
  id: string
  date: string
  isWorkingDay: boolean
  platforms: PlatformAmount[]
}

function cents(n: number): number {
  return Math.round((Number(n) || 0) * 100)
}

// Agrupa los viajes por día y por plataforma.
export function groupRealTrips(trips: RealTripInput[]): Map<string, Map<string, number>> {
  const byDay = new Map<string, Map<string, number>>()
  for (const t of trips) {
    const num = Number(t.net)
    if (!Number.isFinite(num) || num <= 0) continue
    const date = String(t.date ?? "").slice(0, 10)
    const platform = String(t.platform ?? "Other") || "Other"
    if (!date) continue
    let dayMap = byDay.get(date)
    if (!dayMap) {
      dayMap = new Map()
      byDay.set(date, dayMap)
    }
    dayMap.set(platform, (dayMap.get(platform) ?? 0) + num)
  }
  return byDay
}

// Aplica los viajes reales a los días. Reglas:
// - Solo los días que tienen viajes reales se tocan.
// - La columna REAL se llena con la suma real de cada plataforma, tomando el
//   mayor entre lo calculado y lo existente: un importe manual previo nunca se
//   reduce, un real mayor se refleja.
// - Los días sin viajes quedan exactamente como estaban.
export function applyTripsToDays(days: FinanceDay[], trips: RealTripInput[]): FinanceDay[] {
  const byDay = groupRealTrips(trips)
  if (byDay.size === 0) return days

  return days.map((d) => {
    const real = byDay.get(d.date)
    if (!real) return d
    return {
      ...d,
      platforms: d.platforms.map((p) => {
        const incoming = real.get(p.platformName)
        if (incoming === undefined) return p
        const realCents = cents(incoming)
        const currentCents = cents(p.actualAmount)
        if (realCents <= currentCents) return p
        return { ...p, actualAmount: realCents / 100 }
      }),
    }
  })
}

// Totales reales de la semana (para las tarjetas de resumen).
export function computeRealWeekTotals(trips: RealTripInput[]): {
  realIncome: number
  realTripCount: number
  platforms: { platform: string; total: number }[]
} {
  const byDay = groupRealTrips(trips)
  let realIncome = 0
  let realTripCount = 0
  const platformTotals = new Map<string, number>()
  for (const dayMap of byDay.values()) {
    for (const [platform, total] of dayMap) {
      realIncome += total
      platformTotals.set(platform, (platformTotals.get(platform) ?? 0) + total)
    }
  }
  realTripCount = trips.filter((t) => Number.isFinite(Number(t.net)) && Number(t.net) > 0).length
  return {
    realIncome: Math.round(realIncome * 100) / 100,
    realTripCount,
    platforms: [...platformTotals.entries()]
      .map(([platform, total]) => ({ platform, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total),
  }
}

// ---------------------------------------------------------------------------
// Panorama: proyección diaria + cobertura de pagos
// ---------------------------------------------------------------------------

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

function weekdayOf(date: string): (typeof WEEKDAYS)[number] | null {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return WEEKDAYS[d.getDay()]
}

// Promedio histórico de ingresos por día de la semana (todos los viajes, sin
// contar la semana actual para no contaminar la proyección con ella misma).
export function weekdayAverages(trips: RealTripInput[]): Record<string, number> {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const t of trips) {
    const num = Number(t.net)
    if (!Number.isFinite(num) || num <= 0) continue
    const wd = weekdayOf(t.date)
    if (!wd) continue
    sums[wd] = (sums[wd] ?? 0) + num
    counts[wd] = (counts[wd] ?? 0) + 1
  }
  const avg: Record<string, number> = {}
  for (const wd of WEEKDAYS) {
    if (counts[wd]) avg[wd] = Math.round((sums[wd] / counts[wd]) * 100) / 100
  }
  return avg
}

export type PanoramaPayment = { description: string; amount: number; nextDate: string }

export type PanoramaInput = {
  startingBalance: number
  days: FinanceDay[] // semana actual (con actualAmount reales por plataforma)
  scheduled: PanoramaPayment[] // pagos con vencimiento (expense, activos)
  expenses: { date: string; amount: number }[] // gastos reales del copiloto
  trips: RealTripInput[] // histórico para la proyección
}

export type PanoramaDay = {
  date: string
  realIncome: number
  projectedIncome: number
  expenses: number
  payments: PanoramaPayment[]
  balanceAfter: number
  belowZero: boolean
}

export type PanoramaResult = {
  days: PanoramaDay[]
  weekIncomeReal: number
  weekExpenses: number
  weekPayments: number
  finalBalance: number
  // True si el balance nunca cae por debajo de cero en toda la semana.
  covered: boolean
  // Cuánto falta para que el peor día no quede en rojo (0 si cubre).
  shortfall: number
}

// Construye el panorama diario: para cada día, ingreso real (o proyectado del
// histórico si no hay real todavía), gastos y pagos con vencimiento ese día, y
// el balance acumulado después. Con eso se sabe si los ingresos van a cubrir
// cada pago en su due date.
export function computePanorama(input: PanoramaInput): PanoramaResult {
  const avg = weekdayAverages(input.trips)
  const sortedDays = [...input.days].sort((a, b) => a.date.localeCompare(b.date))

  let running = Number(input.startingBalance) || 0
  let weekIncomeReal = 0
  let weekExpenses = 0
  let weekPayments = 0
  let worst = 0

  const days: PanoramaDay[] = sortedDays.map((d) => {
    const realIncome = d.platforms.reduce((acc, p) => acc + (Number(p.actualAmount) || 0), 0)
    weekIncomeReal += realIncome

    const wd = weekdayOf(d.date)
    const projectedIncome = realIncome > 0 ? 0 : Math.round((wd ? avg[wd] ?? 0 : 0) * 100) / 100

    const exp = input.expenses
      .filter((e) => String(e.date ?? "").slice(0, 10) === d.date)
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
    weekExpenses += exp

    const payments = input.scheduled
      .filter((p) => String(p.nextDate ?? "").slice(0, 10) === d.date)
      .map((p) => ({ ...p, amount: Number(p.amount) || 0 }))
    const payTotal = payments.reduce((acc, p) => acc + p.amount, 0)
    weekPayments += payTotal

    running += realIncome + projectedIncome - exp - payTotal
    if (running < worst) worst = running

    return {
      date: d.date,
      realIncome: Math.round(realIncome * 100) / 100,
      projectedIncome,
      expenses: Math.round(exp * 100) / 100,
      payments,
      balanceAfter: Math.round(running * 100) / 100,
      belowZero: running < 0,
    }
  })

  const shortfall = worst < 0 ? Math.round(Math.abs(worst) * 100) / 100 : 0
  return {
    days,
    weekIncomeReal: Math.round(weekIncomeReal * 100) / 100,
    weekExpenses: Math.round(weekExpenses * 100) / 100,
    weekPayments: Math.round(weekPayments * 100) / 100,
    finalBalance: Math.round(running * 100) / 100,
    covered: worst >= 0,
    shortfall,
  }
}
