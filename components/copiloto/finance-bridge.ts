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
