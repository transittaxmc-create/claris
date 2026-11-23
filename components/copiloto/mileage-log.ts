/**
 * Registro de millas para el IRS (Pub 463).
 * Cada día: fecha, millas GPS del turno, clock in/out, y la lista de viajes
 * (recogida → dejada, plataforma = propósito de negocio).
 * Se llena solo: al cerrar el turno y al guardar cada viaje.
 */

export interface MileageTrip {
  time: string
  pickup: string
  dropoff: string
  platform: string
}

export interface MileageDay {
  date: string // YYYY-MM-DD
  clockIn: number | null
  clockOut: number | null
  miles: number // business miles
  commute: number
  personal: number
  trips: MileageTrip[]
}

export const MILEAGE_LOG_KEY = "claris_mileage_log"

function load(): MileageDay[] {
  try {
    const raw = localStorage.getItem(MILEAGE_LOG_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function save(days: MileageDay[]) {
  try {
    localStorage.setItem(MILEAGE_LOG_KEY, JSON.stringify(days.slice(-400)))
  } catch {}
}


/** Suma millas al día de hoy (GPS continuo). */
export function addMilesToday(miles: number) {
  if (!Number.isFinite(miles) || miles <= 0) return
  const days = load()
  const today = new Date().toISOString().slice(0, 10)
  const i = days.findIndex((d) => d.date === today)
  if (i >= 0) {
    days[i] = { ...days[i], miles: Math.round((days[i].miles + miles) * 100) / 100, commute: days[i].commute ?? 0 }
  } else {
    days.push({ date: today, clockIn: null, clockOut: null, miles: Math.round(miles * 100) / 100, trips: [] })
  }
  save(days)
}


export function addCommuteToday(miles: number) {
  if (!Number.isFinite(miles) || miles <= 0) return
  const days = load()
  const today = new Date().toISOString().slice(0, 10)
  const i = days.findIndex((d) => d.date === today)
  if (i >= 0) {
    days[i] = { ...days[i], commute: Math.round(((days[i].commute ?? 0) + miles) * 100) / 100 }
  } else {
    days.push({ date: today, clockIn: null, clockOut: null, miles: 0, commute: Math.round(miles * 100) / 100, trips: [] })
  }
  save(days)
}


export type MileMode = "business" | "commute" | "personal"
const MODE_KEY = "claris_mile_mode"
export function getMileMode(): MileMode {
  try { return (localStorage.getItem(MODE_KEY) as MileMode) || "business" } catch { return "business" }
}
export function setMileMode(m: MileMode) {
  try { localStorage.setItem(MODE_KEY, m) } catch {}
}
export function addPersonalToday(miles: number) {
  if (!Number.isFinite(miles) || miles <= 0) return
  const days = load()
  const today = new Date().toISOString().slice(0, 10)
  const i = days.findIndex((d) => d.date === today)
  if (i >= 0) days[i] = { ...days[i], personal: Math.round(((days[i].personal ?? 0) + miles) * 100) / 100 }
  else days.push({ date: today, clockIn: null, clockOut: null, miles: 0, commute: 0, personal: Math.round(miles * 100) / 100, trips: [] })
  save(days)
}

export function loadMileageLog(): MileageDay[] {
  return load()
}

/** Al cerrar el turno: guarda/actualiza el día con las millas GPS. */
export function recordShiftClose(date: string, clockIn: number | null, clockOut: number, miles: number) {
  const days = load()
  const i = days.findIndex((d) => d.date === date)
  const entry: MileageDay =
    i >= 0
      ? { ...days[i], clockIn: clockIn ?? days[i].clockIn, clockOut, miles: Math.round((days[i].miles + miles) * 100) / 100, commute: days[i].commute ?? 0 }
      : { date, clockIn, clockOut, miles: Math.round(miles * 100) / 100, trips: [] }
  if (i >= 0) days[i] = entry
  else days.push(entry)
  days.sort((a, b) => (a.date < b.date ? -1 : 1))
  save(days)
}

/** Al guardar un viaje: anota recogida → dejada con su plataforma. */
export function recordTrip(t: { pickup: string; dropoff: string; platform: string; time: string }, date: string) {
  if (!t.pickup && !t.dropoff) return
  const days = load()
  let day = days.find((d) => d.date === date)
  if (!day) {
    day = { date, clockIn: null, clockOut: null, miles: 0, trips: [] }
    days.push(day)
  }
  day.trips.push({ time: t.time || "", pickup: t.pickup || "", dropoff: t.dropoff || "", platform: t.platform || "" })
  days.sort((a, b) => (a.date < b.date ? -1 : 1))
  save(days)
}

/** Millas por semestre de un año (tasas IRS 2026 distintas por semestre). */
export function milesByHalfYear(year: number): { h1: number; h2: number; total: number } {
  const days = load()
  let h1 = 0
  let h2 = 0
  for (const d of days) {
    if (!d.date.startsWith(String(year))) continue
    const m = Number(d.date.slice(5, 7))
    if (m >= 1 && m <= 6) h1 += d.miles
    else h2 += d.miles
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return { h1: r(h1), h2: r(h2), total: r(h1 + h2) }
}
