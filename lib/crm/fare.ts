/**
 * Precio sugerido del viaje — puerto del estudio de parámetros del
 * prototipo (2026-11-28). SOLO para los ojos de Miguel: el cliente
 * nunca ve este cálculo.
 *
 * Fórmula TLC partida en la línea de NYC ($1.283/$1.757 por milla,
 * $0.681/$0.725 por minuto) × multiplicador de banda hora×día sobre el
 * subtotal + fijos: peajes a precio descontado E-ZPass, fee Port
 * Authority $3.50 recogida + $3.50 dejada (JFK/LGA/EWR), congestión
 * $2.75 + CRZ $0.75 si toca Manhattan, parada extra +$15, espera
 * $1/min tras la gracia (30 min recogida de aeropuerto, 15 punto a
 * punto). Mínimo local $25 · redondeo a $5.
 *
 * Distancia/tiempo: tabla de rutas del estudio — ESTIMADO (no hay mapas
 * en vivo). La tarifa preferencial del cliente manda sobre todo
 * parámetro, y su equivalente proporcional se deriva del ancla con la
 * misma fórmula (ancla × fórmula de esta ruta ÷ fórmula de la ruta
 * ancla, a $5) — la lógica con la que Miguel derivó los $55 de JFK de
 * los $90 de Manhattan de Mr. Shah.
 */

export type FareForm = {
  pickupKind?: string
  airport?: string
  pickupAddress?: string
  dropoffAddress?: string
  stopAddress?: string
  serviceDate?: string
  pickupTime?: string
  waitMinutes?: string | number
}

export function zoneOf(text?: string): string {
  const s = " " + String(text || "").toLowerCase() + " "
  if (/ jfk |kennedy/.test(s)) return "jfk"
  if (/ lga |laguardia|la guardia/.test(s)) return "lga"
  if (/ ewr |newark airport/.test(s)) return "ewr"
  if (/macarthur| isp /.test(s)) return "isp"
  if (/manhattan|midtown|penn station|times square|wall street|harlem|inwood|washington heights/.test(s)) return "manhattan"
  if (/massapequa|hicksville|nassau|freeport|hempstead|mineola|levittown|farmingdale|bethpage|plainview|syosset|garden city|oceanside|baldwin|valley stream|lynbrook|rockville|long beach|glen cove|oyster bay|seaford|wantagh|bellmore|merrick|east meadow|uniondale|westbury|jericho|woodbury|melville/.test(s)) return "nassau"
  if (/huntington|babylon|smithtown|brookhaven|riverhead|patchogue|bay shore|deer park|commack|hauppauge|ronkonkoma|lake grove|centereach|selden|medford|islip|brentwood|lindenhurst|amityville|copiague/.test(s)) return "suffolk"
  if (/astoria|queens|long island city| lic |jackson heights|flushing|jamaica|forest hills|sunnyside|woodside|elmhurst|corona|rego park|bayside|whitestone|college point|far rockaway|gantry|ridgewood|maspeth|middle village|glendale|ozone park|richmond hill|kew gardens|mount sinai/.test(s)) return "queens"
  if (/brooklyn|bronx|staten island/.test(s)) return "queens"
  if (/new jersey|jersey city|hoboken|elizabeth|newark/.test(s)) return "nj"
  return "other"
}

/* [millas in, millas out, min in, min out, peajes E-ZPass] — estudio §3/§5 */
export const ROUTE_EST: Record<string, [number, number, number, number, number]> = {
  "nassau>jfk": [7, 18, 20, 30, 0], "jfk>nassau": [7, 18, 20, 30, 0],
  "nassau>lga": [13, 19, 25, 30, 0], "lga>nassau": [13, 19, 25, 30, 0],
  "nassau>manhattan": [20, 18, 50, 25, 14.92], "manhattan>nassau": [20, 18, 50, 25, 14.92],
  "manhattan>jfk": [17, 0, 55, 0, 7.46], "jfk>manhattan": [17, 0, 55, 0, 7.46],
  "manhattan>lga": [10, 0, 30, 0, 7.46], "lga>manhattan": [10, 0, 30, 0, 7.46],
  "ewr>manhattan": [7, 9, 25, 20, 16.79], "manhattan>ewr": [7, 9, 25, 20, 19.79],
  "nassau>ewr": [22, 33, 35, 45, 20.92], "ewr>nassau": [22, 33, 35, 45, 20.92],
  "nassau>nassau": [0, 10, 0, 20, 0], "nassau>suffolk": [0, 18, 0, 35, 0], "suffolk>nassau": [0, 18, 0, 35, 0],
  "nassau>isp": [0, 30, 0, 45, 0], "isp>nassau": [0, 30, 0, 45, 0],
  "queens>lga": [8, 0, 20, 0, 0], "lga>queens": [8, 0, 20, 0, 0],
  "queens>queens": [3, 0, 12, 0, 0], "queens>jfk": [10, 0, 25, 0, 0], "jfk>queens": [10, 0, 25, 0, 0],
  "queens>manhattan": [8, 0, 30, 0, 0], "manhattan>queens": [8, 0, 30, 0, 0],
  "manhattan>manhattan": [3, 0, 15, 0, 0], "queens>nassau": [5, 15, 15, 25, 0], "nassau>queens": [5, 15, 15, 25, 0],
  "suffolk>suffolk": [0, 15, 0, 30, 0], "queens>suffolk": [5, 25, 15, 40, 0], "suffolk>queens": [5, 25, 15, 40, 0],
}

export function routeEst(a: string, b: string): [number, number, number, number, number] {
  if (ROUTE_EST[a + ">" + b]) return ROUTE_EST[a + ">" + b]
  const AP = ["jfk", "lga", "ewr", "isp"]
  if (AP.includes(b) && a === "nassau") return ROUTE_EST["nassau>jfk"]
  if (AP.includes(a) && b === "nassau") return ROUTE_EST["jfk>nassau"]
  if (AP.includes(b) && a === "manhattan") return ROUTE_EST["manhattan>jfk"]
  if (AP.includes(a) && b === "manhattan") return ROUTE_EST["jfk>manhattan"]
  if (AP.includes(a) || AP.includes(b)) return [10, 10, 25, 25, 0]
  if (["queens", "manhattan"].includes(a) && ["queens", "manhattan"].includes(b)) return [8, 0, 25, 0, 0]
  return [0, 20, 15, 30, 0]
}

export type FareBand = { mult: number; name: string }

export function bandFor(dateStr?: string, timeStr?: string): FareBand | null {
  if (!dateStr || !timeStr) return null
  const dow = new Date(dateStr + "T12:00:00").getDay()
  const parts = timeStr.split(":")
  const mins = (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0)
  const fri = dow === 5, sat = dow === 6, sun = dow === 0, wknd = sat || sun
  if (mins < 180) return { mult: sat || sun ? 1.3 : 1.2, name: "Early morning" }
  if (mins < 360) return { mult: 1.15, name: "Early morning · airport" }
  if (mins < 570) return wknd ? { mult: 1.0, name: "Off-peak" } : { mult: 1.2, name: "AM rush" }
  if (mins < 960) {
    if (wknd) return { mult: 1.05, name: "Weekend" }
    if (fri && mins >= 840) return { mult: 1.15, name: "Friday afternoon" }
    return { mult: 1.0, name: "Off-peak" }
  }
  if (mins < 1200) {
    if (fri) return { mult: 1.35, name: "Friday PM rush" }
    if (sat) return { mult: 1.05, name: "Weekend" }
    if (sun) return { mult: 1.15, name: "Sunday PM" }
    return { mult: 1.25, name: "PM rush" }
  }
  if (fri || sat) return { mult: 1.3, name: "Night out" }
  return { mult: 1.05, name: "Night" }
}

export type FareCalc = {
  za: string
  zb: string
  mi: number
  mins: number
  subtotal: number
  band: FareBand
  adj: number
  tolls: number
  airportFee: number
  congestion: number
  stopFee: number
  waitMin: number
  grace: number
  waitFee: number
  minApplied: boolean
  total: number
}

export function calcPrice(f: FareForm): FareCalc {
  const za = f.pickupKind === "airport" && f.airport ? zoneOf(f.airport) : zoneOf(f.pickupAddress)
  const zb = zoneOf(f.dropoffAddress)
  const est = routeEst(za, zb)
  const miIn = est[0], miOut = est[1], minIn = est[2], minOut = est[3], tolls = est[4]
  const extraMinOut = za === "manhattan" && zb === "ewr" ? 30 : 0 // regreso vacío monetizado (estudio ruta 7)
  const subtotal = miIn * 1.283 + miOut * 1.757 + minIn * 0.681 + (minOut + extraMinOut) * 0.725
  const band = bandFor(f.serviceDate, f.pickupTime) || { mult: 1, name: "Off-peak" }
  const adj = subtotal * band.mult
  const PA = ["jfk", "lga", "ewr"]
  const airportFee = (PA.includes(za) ? 3.5 : 0) + (PA.includes(zb) ? 3.5 : 0)
  const congestion = za === "manhattan" || zb === "manhattan" ? 3.5 : 0
  const stopFee = String(f.stopAddress || "").trim() ? 15 : 0
  const waitMin = parseInt(String(f.waitMinutes ?? ""), 10) || 0
  const grace = PA.includes(za) ? 30 : 15
  const waitFee = Math.max(0, waitMin - grace) * 1
  let total = adj + tolls + airportFee + congestion + stopFee + waitFee
  const airportTrip = PA.includes(za) || PA.includes(zb) || za === "isp" || zb === "isp"
  let minApplied = false
  if (!airportTrip && total < 25) {
    total = 25
    minApplied = true
  }
  return {
    za, zb, mi: miIn + miOut, mins: minIn + minOut, subtotal, band, adj, tolls,
    airportFee, congestion, stopFee, waitMin, grace, waitFee, minApplied,
    total: Math.round(total / 5) * 5,
  }
}

function sfSegZone(seg: string): string | null {
  const k = String(seg || "").toLowerCase()
  if (k.includes("jfk")) return "jfk"
  if (k.includes("lga") || k.includes("laguardia")) return "lga"
  if (k.includes("ewr") || k.includes("newark")) return "ewr"
  if (k.includes("manhattan") || k.includes("midtown")) return "manhattan"
  return null
}

export type SpecialFareHit = { price: number; seg: string }

/** Tarifa preferencial que cubre ESTA ruta (el segmento nombra la zona). */
export function specialFareMatch(
  client: { specialFare?: string } | null | undefined,
  za: string,
  zb: string,
): SpecialFareHit | null {
  if (!client || !client.specialFare) return null
  const zones = [za, zb]
  const segs = String(client.specialFare).split(/[/·,;]/)
  for (const seg of segs) {
    const m = seg.match(/\$\s*(\d+(?:\.\d+)?)/)
    if (!m) continue
    const z = sfSegZone(seg)
    if (z && zones.includes(z)) return { price: parseFloat(m[1]), seg: seg.trim() }
  }
  return null
}

/** Precio por fórmula de una ruta entre dos zonas con los parámetros
 *  existentes y la misma fecha/hora del formulario, sin parada ni
 *  espera. Null si la ruta no sale de la tabla. */
export function formulaForZones(f: FareForm, z1: string, z2: string): number | null {
  if (!ROUTE_EST[z1 + ">" + z2] && !ROUTE_EST[z2 + ">" + z1]) return null
  const ZTXT: Record<string, string> = {
    jfk: "JFK", lga: "LaGuardia", ewr: "Newark Airport", isp: "MacArthur Airport",
    manhattan: "Manhattan", nassau: "Massapequa", suffolk: "Huntington", queens: "Astoria", nj: "New Jersey", other: "",
  }
  const sf2: FareForm = { ...f, pickupKind: "address", airport: "", pickupAddress: ZTXT[z1] || "", dropoffAddress: ZTXT[z2] || "", stopAddress: "", waitMinutes: "" }
  const r = calcPrice(sf2)
  return r.za === z1 && r.zb === z2 && r.total > 0 ? r.total : null
}

export type SpecialFareProp = {
  anchorPrice: number
  anchorSeg: string
  anchorZone: string
  anchorLabel: string
  anchorFormula: number
  prop: number
}

const SF_ZONE_LABEL: Record<string, string> = { manhattan: "Manhattan", jfk: "JFK", lga: "LaGuardia", ewr: "Newark (EWR)" }

/** Equivalente proporcional de la tarifa preferencial ancla del cliente
 *  para esta ruta. Solo si ambas fórmulas salen de los parámetros
 *  existentes; si no, null y no se muestra nada (nada inventado). */
export function specialFareProp(
  client: { specialFare?: string } | null | undefined,
  f: FareForm,
  p: FareCalc,
): SpecialFareProp | null {
  if (!client || !client.specialFare || !(p.total > 0)) return null
  const HUBS = ["jfk", "lga", "ewr", "isp", "manhattan"]
  const segs = String(client.specialFare).split(/[/·,;]/)
  for (const seg of segs) {
    const m = seg.match(/\$\s*(\d+(?:\.\d+)?)/)
    if (!m) continue
    const az = sfSegZone(seg)
    if (!az) continue
    if (az === p.za || az === p.zb) continue // esa ruta ya la cubre specialFareMatch
    const anchorPrice = parseFloat(m[1])
    if (!(anchorPrice > 0)) continue
    let z1: string, z2: string
    if (!HUBS.includes(p.za) && HUBS.includes(p.zb)) { z1 = p.za; z2 = az }
    else if (HUBS.includes(p.za) && !HUBS.includes(p.zb)) { z1 = az; z2 = p.zb }
    else { z1 = p.za; z2 = az }
    const anchorFormula = formulaForZones(f, z1, z2)
    if (!anchorFormula) continue
    const prop = Math.round(((anchorPrice * p.total) / anchorFormula / 5)) * 5
    if (!(prop > 0)) continue
    return { anchorPrice, anchorSeg: seg.trim(), anchorZone: az, anchorLabel: SF_ZONE_LABEL[az] || az, anchorFormula, prop }
  }
  return null
}
