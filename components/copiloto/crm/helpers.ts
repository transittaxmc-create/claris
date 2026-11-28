/**
 * Utilidades del CRM nuevo: fechas, dinero, teléfonos, cuentas ACT,
 * lugares frecuentes, enlaces de navegación y textos de cobro. Puerto
 * fiel de los helpers del prototipo aprobado; los enlaces de vuelo y
 * de ruta son los mismos de producción.
 */
import type { CRMReservation, Client, Vehicle } from "./types"
import { payLabel } from "./types"

export const digitsOf = (s: unknown): string => String(s ?? "").replace(/\D/g, "")
/** Clave de comparación de teléfono: 11 dígitos con 1 inicial de
 *  EE. UU. se comparan sin el 1. */
export const phoneKey = (s: unknown): string => {
  const d = digitsOf(s)
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d
}
export const normalizeAccount = (s: unknown): string => String(s ?? "").trim().toUpperCase()

export function money(n: unknown): string {
  const v = Number(n) || 0
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export const roundMoney = (n: number): number => Math.round(n * 100) / 100

export function todayKey(d: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function dateKeyOf(iso: unknown): string {
  const d = new Date(String(iso ?? ""))
  return Number.isNaN(d.getTime()) ? "" : todayKey(d)
}
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + n)
  return todayKey(dt)
}
export function parseTimeParts(t: string): { h: number; m: number } | null {
  const m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const ap = (m[3] || "").toUpperCase()
  if (ap === "PM" && h < 12) h += 12
  if (ap === "AM" && h === 12) h = 0
  if (Number.isNaN(h) || Number.isNaN(mm)) return null
  return { h, m: mm }
}
export function fmtDateTime(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso || "—"
  return d.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}
export function fmtClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/** Viaje activo para HOY / modo en curso: el de fecha de servicio
 *  próxima o actual, no completado ni cancelado. */
export function openRes(list: CRMReservation[]): CRMReservation | undefined {
  const now = Date.now()
  return list
    .filter((r) => r.status !== "Completed" && r.status !== "Cancelled" && r.serviceDate)
    .map((r) => {
      const t = parseTimeParts(r.pickupTime)
      const [y, mo, d] = r.serviceDate.split("-").map(Number)
      const at = new Date(y, (mo || 1) - 1, d || 1, t ? t.h : 0, t ? t.m : 0).getTime()
      return { r, at }
    })
    .filter((x) => x.at >= now - 3 * 3600e3)
    .sort((a, b) => a.at - b.at)[0]?.r
}

/** Lugares frecuentes del cliente: de SUS reservas (recogida y destino,
 *  por frecuencia; máx. 5). La ficha NO guarda lugares: nacen de su
 *  historial. */
export function frequentPlaces(reservations: CRMReservation[], clientId: string): string[] {
  if (!clientId) return []
  const count = new Map<string, number>()
  for (const r of reservations) {
    if (r.clientId !== clientId) continue
    for (const a of [r.pickupAddress, r.dropoffAddress]) {
      const k = (a || "").trim()
      if (k) count.set(k, (count.get(k) || 0) + 1)
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)
}

export const initials = (name: string): string =>
  String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"

/* ── Cuentas ACT ─────────────────────────────────────────────────── */
export const ACT_FLOOR_KEY = "claris_crm_act_floor_v1"

/** Próximo número ACT: supera SIEMPRE el mayor jamás asignado —
 *  incluido el de fichas borradas (el suelo persiste). No corrige ni
 *  sobreescribe números ya dados; una ficha sin número no ocupa
 *  secuencia. */
export function nextActNumber(clients: Client[]): string {
  let floor = 100
  try { floor = Math.max(100, parseInt(localStorage.getItem(ACT_FLOOR_KEY) || "100", 10) || 100) } catch {}
  let maxSeen = floor
  for (const c of clients) {
    const m = /^ACT-0-(\d+)$/i.exec(String(c.accountNumber || "").trim())
    if (m) maxSeen = Math.max(maxSeen, parseInt(m[1], 10) + 1)
  }
  const next = maxSeen
  try { localStorage.setItem(ACT_FLOOR_KEY, String(next + 1)) } catch {}
  return "ACT-0-" + next
}

/* ── Navegación ──────────────────────────────────────────────────── */
export type LatLng = { lat: number; lng: number }
export const navGoogleLink = (addr: string, from: LatLng | null): string => {
  const q = encodeURIComponent(addr)
  return from
    ? `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`
}
export const navWazeLink = (addr: string, from: LatLng | null): string =>
  "https://waze.com/ul?q=" + encodeURIComponent(addr) + "&navigate=yes" + (from ? `&ll=${from.lat},${from.lng}` : "")
export const navAppleLink = (addr: string, from: LatLng | null): string =>
  "https://maps.apple.com/?daddr=" + encodeURIComponent(addr) + (from ? `&saddr=${from.lat},${from.lng}` : "")
/** Ruta completa recogida → parada (si hay) → destino en UNA visita. */
export function googleRouteLink(r: CRMReservation, from: LatLng | null): string {
  let u =
    "https://www.google.com/maps/dir/?api=1&origin=" +
    (from ? `${from.lat},${from.lng}` : encodeURIComponent(r.pickupAddress || "")) +
    "&destination=" + encodeURIComponent(r.dropoffAddress || "")
  if (from && r.pickupAddress) u += "&waypoints=" + encodeURIComponent(r.pickupAddress)
  if (r.stopAddress) u += (from && r.pickupAddress ? "%7C" : "&waypoints=") + encodeURIComponent(r.stopAddress)
  return u
}
export const flightAwareLink = (flightNumber: string): string =>
  "https://www.flightaware.com/live/flight/" + encodeURIComponent(String(flightNumber || "").replace(/\s+/g, ""))
export const googleMapsLink = (q: string): string => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q)
export const appleMapsLink = (q: string): string => "https://maps.apple.com/?q=" + encodeURIComponent(q)

/* ── Cobro: datos, enlaces, QR y textos (spec §6) ────────────────── */
export const payIdOf = (vehicle: Vehicle, method: string): string =>
  method === "Zelle" ? vehicle.zelle : method === "Venmo" ? vehicle.venmo : method === "Cash App" ? vehicle.cashapp : ""
export const payPhoneOf = (vehicle: Vehicle, method: string): string =>
  method === "Zelle" ? vehicle.zellePhone : method === "Venmo" ? vehicle.venmoPhone : method === "Cash App" ? vehicle.cashappPhone : ""
export const payLinkOf = (vehicle: Vehicle, method: string, amt: number, note: string): string => {
  if (method === "Venmo") {
    const u = (vehicle.venmo || "").replace(/^@/, "")
    return "https://venmo.com/" + u + (amt > 0 ? "?txn=pay&amount=" + amt.toFixed(2) + "&note=" + encodeURIComponent(note) : "")
  }
  if (method === "Cash App") {
    const t = (vehicle.cashapp || "").replace(/^\$/, "")
    return "https://cash.app/$" + t + (amt > 0 ? "/" + amt.toFixed(2) : "")
  }
  return ""
}
/** Contenido del QR por app (decisión Gemini 2026-11-28, spec §6):
 *  Zelle = solo el identificador; Venmo/Cash App = el enlace con monto. */
export const payQrPayload = (vehicle: Vehicle, method: string, amt: number, note: string): string =>
  method === "Zelle" ? payIdOf(vehicle, "Zelle") : payLinkOf(vehicle, method, amt, note)
export function payInfoText(vehicle: Vehicle, method: string, amt: number): string {
  const id = payIdOf(vehicle, method)
  const tel = payPhoneOf(vehicle, method)
  return method + ": " + id + (tel ? " · Tel " + tel : "") + (amt > 0 ? " · Amount " + money(amt) : "")
}
export function paySendText(vehicle: Vehicle, method: string, amt: number, firstName: string): string {
  const id = payIdOf(vehicle, method)
  const tel = payPhoneOf(vehicle, method)
  const link = payLinkOf(vehicle, method, amt, "Island City Transit")
  return (
    "Hello " + firstName + ", you can pay " + money(amt) + " by " + payLabel(method) + ": " + id +
    (tel ? " (tel " + tel + ")" : "") + (link ? " — " + link : "") + ". Thank you! — Miguel"
  )
}
export function zelleSendText(vehicle: Vehicle, amt: number, firstName: string): string {
  const id = payIdOf(vehicle, "Zelle")
  const tel = payPhoneOf(vehicle, "Zelle")
  return (
    "Hello " + firstName + ", you can pay " + money(amt) + " by Zelle: send it to " + id +
    (tel ? " — the phone linked to that account is " + tel : "") +
    ". Zelle does not allow pre-filling the amount, so please enter " + money(amt) + " when you send it. Thank you! — Miguel"
  )
}
