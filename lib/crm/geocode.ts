/**
 * Verificación de direcciones del CRM (sugerencia de Miguel, 2026-11-26):
 * una dirección escrita o auto-llenada desde un mensaje se comprueba
 * contra el mapa ANTES de que Miguel salga a buscar al cliente — el
 * chofer no se puede perder y los botones GPS de la reserva dependen de
 * que la dirección exista.
 *
 * Servicio: Nominatim (OpenStreetMap), el MISMO que ya usa la app para
 * el GPS en components/copiloto/geo.ts (reverse geocoding). Aquí se usa
 * su búsqueda directa (forward). Sin llave, sin costo, sin proveedor
 * nuevo. La verificación cubre calle + número + CIUDAD juntos: si la
 * calle y el número coinciden pero la ciudad es otra, NO verifica —
 * ese es exactamente el error que manda al chofer a otro sitio.
 *
 * La verificación MARCA, nunca traba: si la dirección no se encuentra,
 * el formulario lo señala para que Miguel le pida al cliente que la
 * repita, pero él puede guardar igual si decide seguir.
 */

export type AddressVerification =
  | { state: "ok"; foundCity: string; display: string }
  | { state: "warn"; reason: string; foundCity?: string }

const STATE_SEGMENT =
  /^(?:[A-Za-z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)(?:\s+\d{5}(?:-\d{4})?)?$/i

/** La ciudad que el cliente escribió, según el texto: el segmento
 *  anterior al estado/ZIP ("…, Massapequa, NY 11758" → "Massapequa").
 *  Sin comas, el texto entero ES el lugar ("Massapequa", "Manhattan"). */
function inputCity(address: string): string {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return parts[0] || ""
  for (let i = parts.length - 1; i >= 1; i--) {
    if (STATE_SEGMENT.test(parts[i]) || /^\d{5}(?:-\d{4})?$/.test(parts[i])) return parts[i - 1]
  }
  return parts[parts.length - 1]
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Verifica una dirección. Devuelve null cuando la comprobación no se
 * pudo hacer (sin red, servicio caído): en ese caso el formulario no
 * marca nada — no se castiga lo que no se pudo comprobar.
 */
export async function verifyAddress(raw: string): Promise<AddressVerification | null> {
  const address = (raw || "").trim()
  if (address.length < 6) return null
  let results: Array<{ display_name?: string; address?: Record<string, string> }>
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=us&q=${encodeURIComponent(address)}`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) return null
    results = await res.json()
  } catch {
    return null
  }
  if (!Array.isArray(results) || results.length === 0) {
    return { state: "warn", reason: "Address not found on the map — ask the client to repeat it." }
  }
  const top = results[0]
  const a = top.address || {}
  const foundCity = a.city || a.town || a.village || a.hamlet || a.city_district || a.suburb || a.borough || ""
  const display = top.display_name || ""

  // Número de casa: si el cliente escribió uno y el mapa encontró la
  // calle con OTRO número, se marca — puede ser otra casa.
  const inputNumber = /^(\d+)\b/.exec(address)?.[1] || ""
  const foundNumber = a.house_number || ""
  if (inputNumber && foundNumber && inputNumber !== foundNumber) {
    return {
      state: "warn",
      reason: `The map found house number ${foundNumber}, not ${inputNumber} — ask the client to repeat the address.`,
      foundCity,
    }
  }

  // Ciudad: la que escribió el cliente tiene que ser la del resultado
  // (campo de ciudad del resultado o un segmento exacto del nombre
  // completo). Calle y número correctos con ciudad equivocada = warn.
  const wanted = norm(inputCity(address))
  if (wanted) {
    const cityFields = [a.city, a.town, a.village, a.hamlet, a.city_district, a.suburb, a.borough, a.county]
      .filter(Boolean)
      .map((x) => norm(String(x)))
    const segments = display.split(",").map((s) => norm(s))
    const cityOk = cityFields.includes(wanted) || segments.includes(wanted)
    if (!cityOk) {
      return {
        state: "warn",
        reason: foundCity
          ? `The map found this street in ${foundCity}, not in “${inputCity(address)}” — ask the client to repeat the address.`
          : "The city does not match what the map found — ask the client to repeat the address.",
        foundCity,
      }
    }
  }
  return { state: "ok", foundCity, display }
}
