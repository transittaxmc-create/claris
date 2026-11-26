/**
 * Auto-llenado del formulario de reserva desde el texto de un mensaje
 * (sugerencia de Miguel, 2026-11-26): cuando un mensaje de la bandeja
 * trae la información del viaje, "Create reservation from this message"
 * PUEBLA el formulario con lo que el mensaje dice — recogida, destino,
 * fecha, hora, pasajeros y vuelo si aplica. Miguel verifica y corrige;
 * no vuelve a escribir lo que el cliente ya escribió.
 *
 * El parser es conservador: solo extrae lo que el texto dice con un
 * patrón claro. Lo que no se reconoce NO se inventa — el campo queda
 * vacío y el indicador de requeridos del formulario lo marca.
 */

export type ParsedReservation = {
  serviceDate?: string
  pickupTime?: string
  passengers?: number
  pickupAddress?: string
  dropoffAddress?: string
  pickupKind?: "standard" | "airport"
  airport?: string
  airline?: string
  flightNumber?: string
  flightDate?: string
  terminal?: string
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}
const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}
const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines", DL: "Delta", UA: "United", B6: "JetBlue",
  WN: "Southwest", AS: "Alaska Airlines", NK: "Spirit", F9: "Frontier", HA: "Hawaiian",
}
const AIRPORT_CODES = ["JFK", "LGA", "EWR", "ISP", "BDL", "HPN", "HVN", "SWF"]

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function cleanPlace(s: string): string {
  return s
    .replace(/\s+on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b.*$/i, "")
    .replace(/\s+(?:please|thank you|thanks|gracias)\b.*$/i, "")
    .replace(/[\s.]+$/, "")
    .trim()
}

export function parseMessageForReservation(body: string, now = new Date()): ParsedReservation {
  const text = (body || "").replace(/\s+/g, " ").trim()
  const out: ParsedReservation = {}
  if (!text) return out

  // ---- Pasajeros ----
  const pax =
    /\b(\d{1,2})\s*(?:passengers?|people|persons?|travelers?|pax|pasajeros)\b/i.exec(text) ||
    /\b(?:we are|party of|group of|somos)\s+(\d{1,2})\b/i.exec(text)
  if (pax) {
    const n = parseInt(pax[1], 10)
    if (n >= 1 && n <= 20) out.passengers = n
  }

  // ---- Hora ----
  const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i.exec(text)
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12
    if (ampm[3].toLowerCase() === "p") h += 12
    out.pickupTime = `${String(h).padStart(2, "0")}:${ampm[2] || "00"}`
  } else {
    const h24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text)
    if (h24) out.pickupTime = `${String(parseInt(h24[1], 10)).padStart(2, "0")}:${h24[2]}`
  }

  // ---- Fecha ----
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text)
  const monthName = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/i.exec(text)
  if (iso) {
    out.serviceDate = `${iso[1]}-${iso[2]}-${iso[3]}`
  } else if (monthName) {
    const month = MONTHS[monthName[1].toLowerCase()]
    const day = parseInt(monthName[2], 10)
    let year = monthName[3] ? parseInt(monthName[3], 10) : now.getFullYear()
    if (!monthName[3] && new Date(year, month, day) < today) year += 1
    out.serviceDate = dateKey(new Date(year, month, day))
  } else if (/\btomorrow\b/i.test(text)) {
    out.serviceDate = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  } else if (/\b(?:today|tonight)\b/i.test(text)) {
    out.serviceDate = dateKey(today)
  } else {
    const wd = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(text)
    if (wd) {
      const target = WEEKDAYS[wd[1].toLowerCase()]
      const delta = (target - today.getDay() + 7) % 7
      out.serviceDate = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta))
    }
  }

  // ---- Recogida / destino ----
  const fromTo = /\bfrom\s+(.+?)\s+to\s+(.+?)(?=(?:\s+at\s+\d)|[.,;!\n]|$)/i.exec(text)
  if (fromTo) {
    out.pickupAddress = cleanPlace(fromTo[1]) || undefined
    out.dropoffAddress = cleanPlace(fromTo[2]) || undefined
  }
  if (!out.pickupAddress) {
    const labeled = /(?:pickup|pick-up|pick up|recogida)\s*[:\-]\s*(.+?)(?=[.;!\n]|$)/i.exec(text)
    if (labeled) out.pickupAddress = cleanPlace(labeled[1]) || undefined
  }
  if (!out.pickupAddress) {
    // Llegada de aeropuerto: "pick me up at JFK Terminal 8 and take me to…"
    const at = /\bpick me up\s+(?:at|from)\s+(.+?)(?=(?:\s+and\s+take)|[.,;!\n]|$)/i.exec(text)
    if (at) out.pickupAddress = cleanPlace(at[1]) || undefined
  }
  if (!out.dropoffAddress) {
    const labeled = /(?:drop-?off|destination|destino)\s*[:\-]\s*(.+?)(?=[.;!\n]|$)/i.exec(text)
    if (labeled) out.dropoffAddress = cleanPlace(labeled[1]) || undefined
  }
  if (!out.dropoffAddress) {
    const takeMe = /\btake me to\s+(.+?)(?=[.;!\n]|$)/i.exec(text)
    if (takeMe) out.dropoffAddress = cleanPlace(takeMe[1]) || undefined
  }

  // ---- Vuelo / aeropuerto ----
  const flight = /\b(AA|DL|UA|B6|WN|AS|NK|F9|HA)\s?-?(\d{1,4})\b/.exec(text)
  if (flight) {
    out.flightNumber = `${flight[1]} ${flight[2]}`
    out.airline = AIRLINE_NAMES[flight[1]] || ""
  } else {
    const nameOnly = /\b(American Airlines|Delta|United|JetBlue|Southwest|Spirit|Frontier)\b/i.exec(text)
    if (nameOnly) out.airline = nameOnly[1]
  }
  const airport = new RegExp(`\\b(${AIRPORT_CODES.join("|")})\\b`).exec(text)
  if (airport) out.airport = airport[1]
  const terminal = /\bterminal\s+([A-Za-z0-9]+)\b/i.exec(text)
  if (terminal) out.terminal = terminal[1].toUpperCase()

  if (out.flightNumber && out.airport) {
    out.pickupKind = "airport"
    out.flightDate = out.serviceDate
    if (!out.pickupAddress) {
      out.pickupAddress = `${out.airport} Airport${out.terminal ? ` · Terminal ${out.terminal}` : ""}`
    }
  }
  return out
}
