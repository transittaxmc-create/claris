import type { Trip } from "./types"

// —————————————————————————————————————————————————————————————————————
// $/HR — UNA SOLA FUENTE (Miguel, 2026-11-24)
// El DASHBOARD y el chip amarillo de TODAY calculan el por hora con
// ESTA cuenta y ninguna otra: gross de la ventana del turno ÷ horas
// activas desde el START (activeHoursDecimal del turno unificado), con
// fallback por lapso de viajes cuando no hay turno activo. El por hora
// cuenta DESDE QUE PRENDE EL TURNO — decisión de Miguel 2026-11-24.
// (Antes TODAY tenía su propia fórmula: dividía el gross de hoy entre
// los segundos trabajados de 30 días tratados como horas, y el chip
// vivía en $0/h.)
// —————————————————————————————————————————————————————————————————————

// Representación mínima de un viaje para esta cuenta — la misma forma
// que usa el DASHBOARD (su V1Trip).
export interface PerHourTrip {
  datetime: string
  earnings: number
  tips: number
  extraCash: number
  toll: number
}

// Resolución de fecha/hora idéntica a la del DASHBOARD (toV1Trip):
// raw.datetime válido si existe; si no, hoy a la hora tecleada.
export function perHourTripOf(t: Trip, todayKey: string): PerHourTrip {
  const raw = t.raw as { datetime?: unknown } | undefined
  const dt = typeof raw?.datetime === "string" && !Number.isNaN(new Date(raw.datetime).getTime())
    ? (raw.datetime as string)
    : `${todayKey}T${t.time || "12:00"}:00`
  return { datetime: dt, earnings: t.earnings || 0, tips: t.tips || 0, extraCash: t.extraCash || 0, toll: t.toll || 0 }
}

export interface ShiftWindow {
  start: number
  end: number | null
}

// Ventana del turno (la misma del DASHBOARD, 2026-11-22): turno activo
// [clockIn, ahora); turno cerrado, la ventana de ESE turno hasta que
// arranque el próximo; sin ningún turno en el historial, null (día
// calendario). Los sellos tienen granularidad de minuto: la ventana se
// redondea al minuto (inicio baja, fin sube al final del minuto).
export function shiftWindowOf(
  shiftActive: boolean,
  clockIn: number | null,
  lastShift: { clockIn: number; clockOut: number } | null,
): ShiftWindow | null {
  const floorMin = (ms: number) => Math.floor(ms / 60_000) * 60_000
  if (shiftActive && clockIn != null) return { start: floorMin(clockIn), end: null }
  if (lastShift) return { start: floorMin(lastShift.clockIn), end: floorMin(lastShift.clockOut) + 59_999 }
  return null
}

// Viajes que cuentan para el turno: los de la ventana, o los de hoy
// (día calendario) cuando nunca ha habido turno.
export function shiftWindowTrips(trips: Trip[], window: ShiftWindow | null, todayKey: string): PerHourTrip[] {
  const v1 = trips.map((t) => perHourTripOf(t, todayKey))
  if (!window) return v1.filter((t) => t.datetime.slice(0, 10) === todayKey)
  return v1.filter((t) => {
    const ts = new Date(t.datetime).getTime()
    return Number.isFinite(ts) && ts >= window.start && (window.end == null || ts <= window.end)
  })
}

// "Lo ganado" de la ventana (fare + tips + extra cash + tolls), igual
// que el numerador del DASHBOARD.
export function shiftGrossOf(winTrips: PerHourTrip[]): number {
  return winTrips.reduce((s, t) => s + t.earnings + t.tips + t.extraCash + t.toll, 0)
}

// LA cuenta del $/HR, textual a la que el DASHBOARD ya usaba:
// con turno activo, gross ÷ horas activas; sin horas activas, el
// lapso desde el primer viaje de la ventana hasta ahora (un solo
// viaje = 0.25 h); sin gross o sin viajes, 0.
export function perHourOf(gross: number, activeHoursDecimal: number, winTrips: PerHourTrip[], nowMs: number): number {
  if (gross <= 0) return 0
  if (activeHoursDecimal > 0.1) return gross / activeHoursDecimal
  const q = winTrips
    .map((u) => new Date(u.datetime).getTime())
    .sort((a, b) => a - b)
  if (q.length === 0) return 0
  const span = q.length === 1 ? 0.25 : Math.max((nowMs - q[0]) / 36e5, 0.25)
  return gross / span
}
