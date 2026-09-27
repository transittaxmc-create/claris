// Lógica de reconciliación: compara el pago que la app calcula contra el que
// la plataforma depositó de verdad, y agrupa los viajes por plataforma con su
// subtotal.
//
// Todo aquí es puro (sin React y sin DOM) para poder probarlo en Node, igual
// que lib/money.ts. El redondeo a centavos se hace siempre con round2 antes de
// comparar, porque sumar flotantes produce diferencias falsas de 1e-15 que
// marcarían viajes como descuadrados sin estarlo.

import { PLATFORMS, grossOf, netOf, type Platform, type Trip } from "./types"

// Menos de medio centavo no es un descuadre: es ruido de coma flotante.
export const TOLERANCE = 0.005

export type ReconState =
  | "pending" // todavía no llegó el pago
  | "ok" // el pago coincide con lo esperado
  | "short" // pagaron de menos
  | "over" // pagaron de más

export type ReconView = {
  expected: number
  received: number | null
  // received − expected. Positivo = pagaron de más, negativo = pagaron de menos.
  diff: number
  state: ReconState
  note: string
}

// Redondeo a centavos. El signo se separa a propósito: sumar EPSILON para
// compensar el error binario empuja los negativos en la dirección contraria y
// -2.345 acabaría en -2.34. Con el valor absoluto el redondeo es simétrico.
export function round2(n: number): number {
  const value = Number(n)
  if (!Number.isFinite(value)) return 0
  const abs = Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100
  return value < 0 ? -abs : abs
}

// El neto esperado es el que calcula la app, salvo que el usuario haya fijado
// uno a mano (por ejemplo si la plataforma ya le confirmó otro importe).
export function expectedOf(t: Trip): number {
  const override = t.reconciliation?.expected
  return typeof override === "number" && Number.isFinite(override) ? round2(override) : round2(netOf(t))
}

export function receivedOf(t: Trip): number | null {
  const value = t.reconciliation?.received
  return typeof value === "number" && Number.isFinite(value) ? round2(value) : null
}

export function diffOf(t: Trip): number {
  const received = receivedOf(t)
  if (received == null) return 0
  return round2(received - expectedOf(t))
}

export function reconStateOf(t: Trip): ReconState {
  const received = receivedOf(t)
  if (received == null) return "pending"
  const diff = diffOf(t)
  if (Math.abs(diff) < TOLERANCE) return "ok"
  return diff < 0 ? "short" : "over"
}

export function reconViewOf(t: Trip): ReconView {
  return {
    expected: expectedOf(t),
    received: receivedOf(t),
    diff: diffOf(t),
    state: reconStateOf(t),
    note: t.reconciliation?.note ?? "",
  }
}

export function isReconciled(t: Trip): boolean {
  return reconStateOf(t) !== "pending"
}

// Un pago registrado que cuadra con el neto equivale a estar conciliado. Se usa
// al guardar para mantener `reconciliation.status` (el campo que lee la app
// vieja y el filtro MATCHED) en sintonía con los montos.
export function reconciliationMatches(t: Trip): boolean {
  return reconStateOf(t) === "ok"
}

// Devuelve el viaje con su `status` coherente con los montos registrados.
// Se aplica al guardar: si no, el disco decía "matched" y la memoria seguía en
// "pending", así que el filtro MATCHED no encontraba nada hasta recargar.
export function normalizeTripStatus(t: Trip): Trip {
  const next: Trip["status"] = t.status === "matched" || reconciliationMatches(t) ? "matched" : "pending"
  return next === t.status ? t : { ...t, status: next }
}

// Cuánto le falta o le sobra a esta plataforma en total.
export type PlatformGroup = {
  platform: Platform
  trips: Trip[]
  count: number
  gross: number
  net: number
  // Suma de los netos esperados (respeta overrides de `expected`).
  expected: number
  // Suma de lo recibido, solo de los viajes que ya tienen pago registrado.
  received: number
  // received − expected, considerando solo los viajes reconciliados. Es el
  // descuadre real: los que aún no llegaron no ensucian la cuenta.
  diff: number
  pendingCount: number
  shortCount: number
  overCount: number
  okCount: number
}

export function buildPlatformGroup(platform: Platform, trips: Trip[]): PlatformGroup {
  let gross = 0
  let net = 0
  let expected = 0
  let received = 0
  let expectedReconciled = 0
  let pendingCount = 0
  let shortCount = 0
  let overCount = 0
  let okCount = 0

  for (const t of trips) {
    gross += grossOf(t)
    net += netOf(t)
    expected += expectedOf(t)
    const state = reconStateOf(t)
    if (state === "pending") {
      pendingCount += 1
      continue
    }
    const rec = receivedOf(t) ?? 0
    received += rec
    expectedReconciled += expectedOf(t)
    if (state === "short") shortCount += 1
    else if (state === "over") overCount += 1
    else okCount += 1
  }

  return {
    platform,
    trips,
    count: trips.length,
    gross: round2(gross),
    net: round2(net),
    expected: round2(expected),
    received: round2(received),
    diff: round2(received - expectedReconciled),
    pendingCount,
    shortCount,
    overCount,
    okCount,
  }
}

// Agrupa por plataforma respetando el orden canónico de PLATFORMS y descarta
// las plataformas sin viajes. Dentro de cada grupo, los más recientes primero.
//
// Una plataforma que no esté en PLATFORMS se agrupa igual en vez de
// desaparecer: entryToTrip ya normaliza a "Other", pero perder viajes en
// silencio sería peor que mostrar un grupo inesperado.
export function groupByPlatform(trips: Trip[]): PlatformGroup[] {
  const buckets = new Map<string, Trip[]>()
  for (const t of trips) {
    const key = t.platform || "Other"
    const list = buckets.get(key)
    if (list) list.push(t)
    else buckets.set(key, [t])
  }
  const ordered: string[] = []
  for (const platform of PLATFORMS) {
    if (buckets.has(platform)) ordered.push(platform)
  }
  for (const key of buckets.keys()) {
    if (!ordered.includes(key)) ordered.push(key)
  }
  const groups: PlatformGroup[] = []
  for (const platform of ordered) {
    const list = buckets.get(platform)
    if (!list || list.length === 0) continue
    list.sort(byTimeDesc)
    groups.push(buildPlatformGroup(platform as Platform, list))
  }
  return groups
}

export type ReconSummary = {
  expected: number
  received: number
  diff: number
  pendingCount: number
  shortCount: number
  overCount: number
  okCount: number
  // Viajes con descuadre real (de menos o de más).
  problemCount: number
}

// Totales de reconciliación de una lista de viajes. El descuadre agregado
// ignora los pendientes: si aún no llegó el pago, no hay nada que arreglar.
export function reconSummary(trips: Trip[]): ReconSummary {
  let expected = 0
  let received = 0
  let expectedReconciled = 0
  let pendingCount = 0
  let shortCount = 0
  let overCount = 0
  let okCount = 0

  for (const t of trips) {
    expected += expectedOf(t)
    const state = reconStateOf(t)
    if (state === "pending") {
      pendingCount += 1
      continue
    }
    received += receivedOf(t) ?? 0
    expectedReconciled += expectedOf(t)
    if (state === "short") shortCount += 1
    else if (state === "over") overCount += 1
    else okCount += 1
  }

  return {
    expected: round2(expected),
    received: round2(received),
    diff: round2(received - expectedReconciled),
    pendingCount,
    shortCount,
    overCount,
    okCount,
    problemCount: shortCount + overCount,
  }
}

export type SortKey = "platform" | "amount" | "time"

// Ordena sin agrupar (para las vistas MONTO y HORA).
export function sortTrips(trips: Trip[], key: SortKey): Trip[] {
  const copy = [...trips]
  if (key === "amount") return copy.sort((a, b) => netOf(b) - netOf(a) || byTimeDesc(a, b))
  return copy.sort(byTimeDesc)
}

function byTimeDesc(a: Trip, b: Trip): number {
  return (b.time || "").localeCompare(a.time || "")
}

// Aplica la diferencia al viaje para que el neto calculado cuadre con lo
// recibido. El ajuste entra por EARNINGS porque es el campo del que cuelga el
// neto (gross = earnings + extraCash + tips + toll; net = gross − platformFee).
// Devuelve un viaje nuevo: no muta el original.
export function applyDifferenceToTrip(t: Trip): Trip {
  const received = receivedOf(t)
  if (received == null) return t
  const diff = diffOf(t)
  if (Math.abs(diff) < TOLERANCE) return t

  return {
    ...t,
    earnings: round2(t.earnings + diff),
    reconciliation: {
      ...(t.reconciliation ?? {}),
      // Tras el ajuste el esperado queda igual al recibido.
      expected: received,
      received,
      reconciledAt: new Date().toISOString(),
    },
  }
}
