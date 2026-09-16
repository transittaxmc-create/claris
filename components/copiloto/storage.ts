import { type Trip, type Platform, PLATFORMS } from "./types"

// Reads and writes the exact same localStorage key/format used by the
// original IslandCity Tip Tracker export, so this redesign stays compatible
// with your real data (including GPS/coords, which are preserved untouched).
const KEY = "ic_tip_tracker"

type RawEntry = Record<string, any>

function toTime(datetime: string): string {
  const d = new Date(datetime)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function normalizePlatform(p: unknown): Platform {
  return (PLATFORMS as string[]).includes(p as string) ? (p as Platform) : "Other"
}

export function entryToTrip(e: RawEntry): Trip {
  return {
    id: String(e.id ?? crypto.randomUUID()),
    platform: normalizePlatform(e.platform),
    isVoucher: e.platformType === "VOUCHER",
    earnings: Number(e.earnings) || 0,
    extraCash: Number(e.extraCash) || 0,
    tips: Number(e.tips) || 0,
    toll: Number(e.toll) || 0,
    platformFee: Number(e.platformFee) || 0,
    pickup: e.pickup?.address ?? "",
    dropoff: e.dropoff?.address ?? "",
    time: e.datetime ? toTime(e.datetime) : "",
    ref: e.notes ?? "",
    status: e.reconciliation?.status === "matched" ? "matched" : "pending",
    raw: e,
  }
}

export function tripToEntry(t: Trip): RawEntry {
  const base: RawEntry = t.raw ? { ...t.raw } : {}
  const gross = t.earnings + t.extraCash + t.tips + t.toll
  const net = gross - t.platformFee
  return {
    ...base,
    id: t.id,
    datetime: (base.datetime as string) ?? new Date().toISOString(),
    platform: t.platform,
    platformType: t.isVoucher ? "VOUCHER" : (base.platformType ?? "RIDESHARE"),
    earnings: t.earnings,
    extraCash: t.extraCash || null,
    tips: t.tips || null,
    toll: t.toll || null,
    tollDetails: base.tollDetails ?? [],
    platformFee: t.platformFee || null,
    grossIncome: gross,
    netPayout: net,
    pickup: { ...(base.pickup ?? {}), address: t.pickup },
    dropoff: { ...(base.dropoff ?? {}), address: t.dropoff },
    notes: t.ref,
    status: base.status ?? "open",
    reconciliation: { ...(base.reconciliation ?? {}), status: t.status },
  }
}

export function loadTrips(): Trip[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : []
    return entries.map(entryToTrip)
  } catch {
    return null
  }
}

export function saveTrips(trips: Trip[]): void {
  try {
    let doc: RawEntry = {}
    const existing = localStorage.getItem(KEY)
    if (existing) {
      try {
        doc = JSON.parse(existing)
      } catch {
        doc = {}
      }
    }
    doc.entries = trips.map(tripToEntry)
    localStorage.setItem(KEY, JSON.stringify(doc))
  } catch {
    // ignore write errors (e.g. storage disabled)
  }
}
