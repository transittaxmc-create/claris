import { verifyAddress, type AddressVerification } from "./geocode"

/**
 * Verifica pickup y dropoff de una reserva.
 * Devuelve el estado de cada una para mostrar en el formulario.
 */
export async function checkReservationAddresses(pickup?: string, dropoff?: string) {
  const [pickupResult, dropoffResult] = await Promise.all([
    pickup ? verifyAddress(pickup) : null,
    dropoff ? verifyAddress(dropoff) : null,
  ])
  return { pickup: pickupResult, dropoff: dropoffResult }
}

export function addressStatusLabel(v: AddressVerification | null): string {
  if (!v) return ""
  if (v.state === "ok") return `✓ ${v.foundCity}`
  return `⚠ ${v.reason}`
}
