/**
 * E-ZPass automatic toll detection (geofencing).
 *
 * While a trip is active (pickup captured), each GPS fix is checked against
 * TOLL_PLAZAS_2026. When the driver passes within radius of a plaza that has
 * not been charged yet on this trip, the toll is auto-added:
 *  - draft.toll += rate (2026 NY E-ZPass discounted rate, peak/off-peak by time)
 *  - draft.notes += "[HH:MM] Plaza name - $X.XX"
 *
 * Coordinates in the database are crossing midpoints (approx), so the radius
 * is generous on purpose: a missed toll is a lost deduction, while a false
 * positive is visible in the notes and can be deleted (everything editable).
 */
import { TOLL_PLAZAS_2026, type TollPlaza } from "./toll-plazas-2026"

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Geofence radius: bridges/tunnels are long structures with approx midpoints. */
export function radiusM(plaza: TollPlaza): number {
  return plaza.operator === "MTA" || plaza.operator === "PANYNJ" ? 1000 : 500
}

/**
 * Time-of-day pricing.
 * PANYNJ peak: Mon–Fri 6–10am & 4–8pm, Sat–Sun 11am–9pm.
 */
export function isPeak(date: Date, operator: TollPlaza["operator"]): boolean {
  if (operator !== "PANYNJ") return true // flat rate operators: peak rate always applies
  const day = date.getDay() // 0 = Sunday
  const h = date.getHours() + date.getMinutes() / 60
  const weekend = day === 0 || day === 6
  if (weekend) return h >= 11 && h < 21
  return (h >= 6 && h < 10) || (h >= 16 && h < 20)
}

/** 2026 NY E-ZPass rate for this plaza at this moment. null = rate unknown (ticket system). */
export function rateFor(plaza: TollPlaza, date: Date): number | null {
  if (plaza.ezpass2026 == null) return null
  if (plaza.ezpassOffPeak2026 != null) {
    return isPeak(date, plaza.operator) ? plaza.ezpass2026 : plaza.ezpassOffPeak2026
  }
  return plaza.ezpass2026
}

/**
 * Direction filter. Some plazas only toll one way (e.g. Port Authority =
 * eastbound into NY only). heading is degrees 0–360 (0 = north), null = unknown.
 * When heading is unknown we charge it — a visible false positive beats a
 * silent missed toll.
 */
export function headingAllows(direction: string | undefined, heading: number | null): boolean {
  if (!direction || heading == null || !Number.isFinite(heading)) return true
  const d = direction.toLowerCase()
  const h = ((heading % 360) + 360) % 360
  const east = h >= 0 && h < 180 // any eastward component
  const west = h >= 180 && h < 360
  const south = h >= 90 && h < 270
  const north = h >= 270 || h < 90
  if (d.includes("eastbound")) return east
  if (d.includes("westbound")) return west
  if (d.includes("southbound")) return south
  if (d.includes("northbound")) return north
  return true // "both", "ticket", "one-way barrier", ...
}

/** Plazas newly crossed at this fix (not already charged this trip). */
export function detectNewTolls(
  lat: number,
  lng: number,
  heading: number | null,
  alreadyHit: Set<string>,
  now: Date = new Date()
): TollPlaza[] {
  const out: TollPlaza[] = []
  for (const plaza of TOLL_PLAZAS_2026) {
    if (alreadyHit.has(plaza.name)) continue
    if (!headingAllows(plaza.direction, heading)) continue
    if (haversineM(lat, lng, plaza.lat, plaza.lng) <= radiusM(plaza)) {
      out.push(plaza)
    }
  }
  return out
}

export function tollNoteStamp(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

/** "[09:15] GW Bridge - $14.00" or "[09:15] NJTPK Exit 14 — check E-ZPass statement" */
export function formatTollNote(plaza: TollPlaza, date: Date): { text: string; amount: number | null } {
  const stamp = tollNoteStamp(date)
  const rate = rateFor(plaza, date)
  if (rate == null) {
    return { text: `[${stamp}] ${plaza.name} — check E-ZPass statement`, amount: null }
  }
  return { text: `[${stamp}] ${plaza.name} - $${rate.toFixed(2)}`, amount: rate }
}

export function appendNote(existing: string | undefined, addition: string): string {
  const base = (existing || "").trim()
  return base ? `${base} | ${addition}` : addition
}
