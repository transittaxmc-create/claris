// GPS capture + reverse geocoding for PICKUP / DROPOFF.
// Uses the browser Geolocation API for real coordinates with high accuracy,
// enforces quality threshold (accuracy <= 50m), and resolves address using
// OpenStreetMap Nominatim with granular place classification.

import { localDateKey } from "@/lib/dates"

export type PlaceKind = "airport" | "business" | "residence"

export type LocationPoint = {
  kind: PlaceKind
  icon: string // ✈️ | 🚉 | 🏥 | 🏨 | 🏫 | ⛽ | 🍽️ | 🛒 | 🏢 | 🏠
  categoryLabel: string // "Aeropuerto" | "Estación" | "Hospital" | "Negocio" | "Residencia" etc.
  banner: "blue" | "green" // Blue for business/POI, Green for residence
  businessName: string // filled for POIs, empty for residence
  address: string // full formatted address
  street: string
  city: string
  county: string // Condado (Nominatim lo devuelve aparte del display_name)
  zip: string
  lat: number
  lng: number
  accuracy: number
  timestamp: string // ISO
  day: string // YYYY-MM-DD
  time: string // HH:MM
}

export const GPS_ACCURACY_THRESHOLD = 50 // meters

export class GpsAccuracyError extends Error {
  accuracy: number
  constructor(accuracy: number) {
    super(`Precisión insuficiente: ±${accuracy}m (se requieren ≤ ${GPS_ACCURACY_THRESHOLD}m)`)
    this.name = "GpsAccuracyError"
    this.accuracy = accuracy
  }
}

export const CURRENT_PICKUP_KEY = "CURRENT_PICKUP"
export const CURRENT_DROPOFF_KEY = "CURRENT_DROP_OFF"

export function saveTempLocation(which: "pickup" | "dropoff", loc: LocationPoint): void {
  try {
    localStorage.setItem(which === "pickup" ? CURRENT_PICKUP_KEY : CURRENT_DROPOFF_KEY, JSON.stringify(loc))
  } catch {}
}

export function loadTempLocation(which: "pickup" | "dropoff"): LocationPoint | null {
  try {
    const raw = localStorage.getItem(which === "pickup" ? CURRENT_PICKUP_KEY : CURRENT_DROPOFF_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearTempLocations(): void {
  try {
    localStorage.removeItem(CURRENT_PICKUP_KEY)
    localStorage.removeItem(CURRENT_DROPOFF_KEY)
  } catch {}
}

const BUSINESS_CLASSES = [
  "amenity",
  "shop",
  "office",
  "tourism",
  "leisure",
  "craft",
  "healthcare",
  "building",
  "railway",
  "public_transport",
  "aeroway",
]

function classify(data: any): { kind: PlaceKind; icon: string; categoryLabel: string; banner: "blue" | "green"; businessName: string } {
  const cls = String(data?.class ?? data?.category ?? "")
  const type = String(data?.type ?? "")
  const name = String(data?.name ?? "")
  const display = String(data?.display_name ?? "")

  // ✈️ Aeropuerto
  if (
    cls === "aeroway" ||
    /aerodrome|terminal/i.test(type) ||
    /airport|aeropuerto/i.test(name) ||
    /airport|aeropuerto/i.test(display)
  ) {
    return { kind: "airport", icon: "✈️", categoryLabel: "Aeropuerto", banner: "blue", businessName: name || "Aeropuerto" }
  }

  // 🚉 Estación
  if (
    cls === "railway" ||
    cls === "public_transport" ||
    /station|subway|metro|terminal/i.test(type + name)
  ) {
    return { kind: "business", icon: "🚉", categoryLabel: "Estación / Terminal", banner: "blue", businessName: name || "Estación" }
  }

  // 🏥 Hospital / Clínica
  if (
    cls === "healthcare" ||
    /hospital|clinic|clinica|medical|urgent_care/i.test(type + name)
  ) {
    return { kind: "business", icon: "🏥", categoryLabel: "Hospital / Clínica", banner: "blue", businessName: name || "Hospital" }
  }

  // 🏨 Hotel
  if (/hotel|motel|hostel|inn|resort/i.test(type + name)) {
    return { kind: "business", icon: "🏨", categoryLabel: "Hotel / Alojamiento", banner: "blue", businessName: name || "Hotel" }
  }

  // 🏫 Escuela / Universidad
  if (/school|university|college|academy|escuela/i.test(type + name)) {
    return { kind: "business", icon: "🏫", categoryLabel: "Escuela / Universidad", banner: "blue", businessName: name || "Educación" }
  }

  // ⛽ Gasolinera
  if (/fuel|gas_station|petrol/i.test(type + name)) {
    return { kind: "business", icon: "⛽", categoryLabel: "Gasolinera", banner: "blue", businessName: name || "Gasolinera" }
  }

  // 🍽️ Restaurante / Café
  if (/restaurant|cafe|fast_food|food_court|diner|pizz/i.test(type + name)) {
    return { kind: "business", icon: "🍽️", categoryLabel: "Restaurante / Café", banner: "blue", businessName: name || "Restaurante" }
  }

  // 🛒 Comercio / Tienda
  if (cls === "shop" || /supermarket|mall|store|market|shop/i.test(type + name)) {
    return { kind: "business", icon: "🛒", categoryLabel: "Comercio / Tienda", banner: "blue", businessName: name || "Tienda" }
  }

  // 🏢 Negocio / Oficina general
  if (name && BUSINESS_CLASSES.includes(cls) && type !== "residential" && type !== "house") {
    return { kind: "business", icon: "🏢", categoryLabel: "Negocio / Oficina", banner: "blue", businessName: name }
  }

  // 🏠 Residencia
  return { kind: "residence", icon: "🏠", categoryLabel: "Residencia", banner: "green", businessName: "" }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalización no disponible"))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    })
  })
}

async function reverseGeocode(lat: number, lng: number): Promise<any> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&namedetails=1`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error("No se pudo resolver la dirección")
  return res.json()
}

// Se exporta con nombre de test para poder cubrir todas sus ramas en
// scripts/_test-classify.mjs, sin depender de la red ni del navegador.
export const __testClassify = classify

export async function captureLocation(): Promise<LocationPoint> {
  const pos = await getPosition()
  const { latitude: lat, longitude: lng, accuracy } = pos.coords
  const roundedAccuracy = Math.round((accuracy ?? 0) * 10) / 10
  const now = new Date()

  // Filtro de Calidad: precisión <= 50m
  if (accuracy > GPS_ACCURACY_THRESHOLD) {
    throw new GpsAccuracyError(roundedAccuracy)
  }

  let data: any = {}
  try {
    data = await reverseGeocode(lat, lng)
  } catch {
    data = {}
  }

  const { kind, icon, categoryLabel, banner, businessName } = classify(data)
  const a = data?.address ?? {}
  const houseNumber = a.house_number ?? ""
  const road = a.road ?? a.pedestrian ?? a.footway ?? ""
  const street = [houseNumber, road].filter(Boolean).join(" ")
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.hamlet ?? ""
  // Nominatim expone el condado en `county`, y en algunos países en
  // `state_district`; el display_name ya lo incluye pero como texto.
  const county = a.county ?? a.state_district ?? ""
  const zip = a.postcode ?? ""
  const address =
    data?.display_name ?? [street, city, zip].filter(Boolean).join(", ")

  return {
    kind,
    icon,
    categoryLabel,
    banner,
    businessName,
    address,
    street,
    city,
    county,
    zip,
    lat,
    lng,
    accuracy: roundedAccuracy,
    timestamp: now.toISOString(),
    day: localDateKey(now),
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
  }
}

// ---------------------------------------------------------------------------
// Cabecera de HOY: lugar actual (CALLE + CIUDAD) para mostrar bajo la fecha.
//
// A diferencia de captureLocation() no exige precisión ≤ 50m (dentro de un
// edificio casi nunca se cumple) y guarda el resultado 10 minutos para no
// martillear Nominatim ni gastar batería en cada render.
// ---------------------------------------------------------------------------
export type HeaderPlace = {
  street: string
  city: string
  address: string
  icon: string
  accuracy: number
  savedAt: string // ISO
}

const HEADER_PLACE_KEY = "claris_header_place"
const HEADER_PLACE_TTL_MS = 10 * 60 * 1000

// Lee el último lugar cacheado. Caduca a los 10 minutos.
export function loadHeaderPlace(): HeaderPlace | null {
  try {
    const raw = localStorage.getItem(HEADER_PLACE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as HeaderPlace
    if (!p || (!p.street && !p.city)) return null
    const saved = new Date(p.savedAt).getTime()
    if (!Number.isFinite(saved) || Date.now() - saved > HEADER_PLACE_TTL_MS) return null
    return p
  } catch {
    return null
  }
}

function getPositionCached(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalización no disponible"))
      return
    }
    // maximumAge: reutiliza una fijada hace ≤5 min → más rápido y con menos
    // batería; el header solo necesita "más o menos dónde estoy".
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 300_000,
    })
  })
}

// Nunca lanza: si el GPS o la red fallan devuelve null y la cabecera se queda
// sin línea de ubicación en vez de romper la pantalla.
export async function refreshHeaderPlace(): Promise<HeaderPlace | null> {
  try {
    const pos = await getPositionCached()
    const { latitude: lat, longitude: lng, accuracy = 0 } = pos.coords

    let data: any = {}
    try {
      data = await reverseGeocode(lat, lng)
    } catch {
      data = {}
    }

    const { icon } = classify(data)
    const a = data?.address ?? {}
    const houseNumber = a.house_number ?? ""
    const road = a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood ?? ""
    const street = [houseNumber, road].filter(Boolean).join(" ")
    const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.hamlet ?? ""
    if (!street && !city) return null

    const place: HeaderPlace = {
      street,
      city,
      address: data?.display_name ?? [street, city].filter(Boolean).join(", "),
      icon,
      accuracy: Math.round((accuracy ?? 0) * 10) / 10,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(HEADER_PLACE_KEY, JSON.stringify(place))
    } catch {
      // modo privado / cuota llena: no pasa nada, solo no se cachea
    }
    return place
  } catch {
    return null
  }
}
