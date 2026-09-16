// GPS capture + reverse geocoding for PICKUP / DROPOFF.
// Uses the browser Geolocation API for real coordinates, then OpenStreetMap
// Nominatim to resolve the address and classify the place as an airport,
// a business, or a residence — matching the categories the original app used.

export type PlaceKind = "airport" | "business" | "residence"

export type LocationPoint = {
  kind: PlaceKind
  icon: string // ✈️ | 📍 | 🏠
  categoryLabel: string // "Aeropuerto" | "Negocio" | "Residencia"
  businessName: string // filled for airport/business, empty for residence
  address: string // full formatted address
  street: string
  city: string
  zip: string
  lat: number
  lng: number
  accuracy: number
  timestamp: string // ISO
  day: string // YYYY-MM-DD
  time: string // HH:MM
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
]

function classify(data: any): { kind: PlaceKind; icon: string; categoryLabel: string; businessName: string } {
  const cls = String(data?.class ?? data?.category ?? "")
  const type = String(data?.type ?? "")
  const name = String(data?.name ?? "")
  const display = String(data?.display_name ?? "")

  const isAirport =
    cls === "aeroway" ||
    /aerodrome|terminal/i.test(type) ||
    /airport|aeropuerto/i.test(name) ||
    /airport|aeropuerto/i.test(display)
  if (isAirport) {
    return { kind: "airport", icon: "✈️", categoryLabel: "Aeropuerto", businessName: name || "Aeropuerto" }
  }

  if (name && BUSINESS_CLASSES.includes(cls) && type !== "residential" && type !== "house") {
    return { kind: "business", icon: "📍", categoryLabel: "Negocio", businessName: name }
  }

  return { kind: "residence", icon: "🏠", categoryLabel: "Residencia", businessName: "" }
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

export async function captureLocation(): Promise<LocationPoint> {
  const pos = await getPosition()
  const { latitude: lat, longitude: lng, accuracy } = pos.coords
  const now = new Date()

  let data: any = {}
  try {
    data = await reverseGeocode(lat, lng)
  } catch {
    data = {}
  }

  const { kind, icon, categoryLabel, businessName } = classify(data)
  const a = data?.address ?? {}
  const houseNumber = a.house_number ?? ""
  const road = a.road ?? a.pedestrian ?? a.footway ?? ""
  const street = [houseNumber, road].filter(Boolean).join(" ")
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.hamlet ?? ""
  const zip = a.postcode ?? ""
  const address =
    data?.display_name ?? [street, city, zip].filter(Boolean).join(", ")

  return {
    kind,
    icon,
    categoryLabel,
    businessName,
    address,
    street,
    city,
    zip,
    lat,
    lng,
    accuracy: Math.round((accuracy ?? 0) * 100) / 100,
    timestamp: now.toISOString(),
    day: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
  }
}
