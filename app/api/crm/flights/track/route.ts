import { NextResponse } from "next/server"
import { isSameOriginRequest } from "@/lib/crm-push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AIRLINE_CODES: Record<string, string> = {
  AMERICAN: "AAL", "AMERICAN AIRLINES": "AAL", AA: "AAL", AAL: "AAL",
  DELTA: "DAL", "DELTA AIR LINES": "DAL", DL: "DAL", DAL: "DAL",
  UNITED: "UAL", "UNITED AIRLINES": "UAL", UA: "UAL", UAL: "UAL",
  JETBLUE: "JBU", B6: "JBU", JBU: "JBU",
  SOUTHWEST: "SWA", "SOUTHWEST AIRLINES": "SWA", WN: "SWA", SWA: "SWA",
  SPIRIT: "NKS", "SPIRIT AIRLINES": "NKS", NK: "NKS", NKS: "NKS",
  FRONTIER: "FFT", "FRONTIER AIRLINES": "FFT", F9: "FFT", FFT: "FFT",
  ALASKA: "ASA", "ALASKA AIRLINES": "ASA", AS: "ASA", ASA: "ASA",
  ALLEGIANT: "AAY", "ALLEGIANT AIR": "AAY", G4: "AAY", AAY: "AAY",
  BREEZE: "MXY", "BREEZE AIRWAYS": "MXY", MX: "MXY", MXY: "MXY",
  "SUN COUNTRY": "SCX", "SUN COUNTRY AIRLINES": "SCX", SY: "SCX", SCX: "SCX",
  "AIR CANADA": "ACA", AC: "ACA", ACA: "ACA",
  "BRITISH AIRWAYS": "BAW", BA: "BAW", BAW: "BAW",
  LUFTHANSA: "DLH", LH: "DLH", DLH: "DLH",
  "AIR FRANCE": "AFR", AF: "AFR", AFR: "AFR",
  KLM: "KLM", KL: "KLM",
  IBERIA: "IBE", IB: "IBE", IBE: "IBE",
  "AER LINGUS": "EIN", EI: "EIN", EIN: "EIN",
  EMIRATES: "UAE", EK: "UAE", UAE: "UAE",
  "QATAR AIRWAYS": "QTR", QR: "QTR", QTR: "QTR",
  TURKISH: "THY", "TURKISH AIRLINES": "THY", TK: "THY", THY: "THY",
  COPA: "CMP", "COPA AIRLINES": "CMP", CM: "CMP", CMP: "CMP",
  AVIANCA: "AVA", AV: "AVA", AVA: "AVA",
  LATAM: "LAN", LA: "LAN", LAN: "LAN",
  ANA: "ANA", NH: "ANA", JAL: "JAL", JL: "JAL",
  QANTAS: "QFA", QF: "QFA", QFA: "QFA",
  WESTJET: "WJA", WS: "WJA", WJA: "WJA",
  VOLARIS: "VOI", Y4: "VOI", VOI: "VOI",
  "VIVA AEROBUS": "VIV", VB: "VIV", VIV: "VIV",
  ARAJET: "DWI", DM: "DWI", DWI: "DWI",
  "CARIBBEAN AIRLINES": "BWA", BW: "BWA", BWA: "BWA",
}

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function toIcaoCallsign(airline: string, flightNumber: string) {
  const flight = normalize(flightNumber)
  const airlineKey = normalize(airline)
  const prefixes = Object.keys(AIRLINE_CODES).sort((a, b) => b.length - a.length)
  const embeddedPrefix = prefixes.find((prefix) => flight.startsWith(prefix) && flight.length > prefix.length)
  const embeddedCode = embeddedPrefix ? AIRLINE_CODES[embeddedPrefix] : null
  const code = embeddedCode || AIRLINE_CODES[airlineKey]
  const suffix = embeddedPrefix ? flight.slice(embeddedPrefix.length) : flight
  if (!code || !/^\d{1,5}[A-Z]?$/.test(suffix)) return null
  const callsign = code + suffix
  return callsign.length <= 8 ? callsign : null
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "same_origin_required" }, { status: 403 })
  }

  let body: { airline?: unknown; flightNumber?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const airline = typeof body.airline === "string" ? body.airline.trim().slice(0, 80) : ""
  const flightNumber = typeof body.flightNumber === "string" ? body.flightNumber.trim().slice(0, 24) : ""
  if (!flightNumber) return NextResponse.json({ error: "flight_number_required" }, { status: 400 })

  const callsign = toIcaoCallsign(airline, flightNumber)
  if (!callsign) {
    return NextResponse.json({
      error: "airline_not_supported",
      message: "Could not convert this airline and flight number to an ICAO callsign. Check the airline or use the external flight tracker.",
    }, { status: 422 })
  }

  try {
    const upstream = await fetch(`https://api.adsb.lol/v2/callsign/${encodeURIComponent(callsign)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(9000),
    })

    if (upstream.status === 404) {
      return NextResponse.json({ ok: true, status: "not_found", callsign, checkedAt: new Date().toISOString() })
    }
    if (upstream.status === 429) {
      return NextResponse.json({ error: "provider_rate_limited", message: "The free flight-data service is temporarily rate-limiting requests. Try again later." }, { status: 429 })
    }
    if (!upstream.ok) {
      return NextResponse.json({ error: "provider_unavailable", message: "The live aircraft-data service is temporarily unavailable." }, { status: 502 })
    }

    const payload = await upstream.json() as {
      ac?: Array<Record<string, unknown>>
      now?: number
      ctime?: number
    }
    const aircraft = Array.isArray(payload.ac)
      ? payload.ac.find((item) => typeof item.flight === "string" && normalize(item.flight) === callsign) || payload.ac[0]
      : undefined

    if (!aircraft) {
      return NextResponse.json({ ok: true, status: "not_found", callsign, checkedAt: new Date().toISOString() })
    }

    const seenPosition = typeof aircraft.seen_pos === "number" ? aircraft.seen_pos : null
    const seen = typeof aircraft.seen === "number" ? aircraft.seen : seenPosition
    const altitude = aircraft.alt_baro
    const onGround = typeof altitude === "string" && altitude.toLowerCase() === "ground"
    const fresh = seenPosition === null || seenPosition <= 120
    const status = !fresh ? "stale" : onGround ? "on_ground" : "in_air"

    return NextResponse.json({
      ok: true,
      status,
      callsign,
      flight: typeof aircraft.flight === "string" ? aircraft.flight.trim() : callsign,
      registration: typeof aircraft.r === "string" ? aircraft.r : null,
      aircraftType: typeof aircraft.t === "string" ? aircraft.t : null,
      latitude: typeof aircraft.lat === "number" ? aircraft.lat : null,
      longitude: typeof aircraft.lon === "number" ? aircraft.lon : null,
      altitudeFeet: typeof altitude === "number" ? altitude : null,
      groundSpeedKnots: typeof aircraft.gs === "number" ? aircraft.gs : null,
      heading: typeof aircraft.track === "number" ? aircraft.track : null,
      lastPositionSeconds: seenPosition,
      lastSignalSeconds: seen,
      checkedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    return NextResponse.json({
      error: timedOut ? "provider_timeout" : "provider_unavailable",
      message: timedOut ? "The live aircraft lookup timed out. Try again shortly." : "Could not reach the live aircraft-data service.",
    }, { status: 502 })
  }
}
