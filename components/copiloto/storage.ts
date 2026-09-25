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

// All localStorage keys used by the original IslandCity Tip Tracker, so an
// export from this redesign is a drop-in replacement for the original app.
const ALL_KEYS = [
  "ic_tip_tracker",
  "ic_shift",
  "ic-bank-adj-history",
  "ic-day-targets",
  "ic-work-days",
  "ic-recurring-plan",
  "ic-bank-balance",
  "ic-week-overrides",
]

// Build the full export document (version 2) in the exact shape the original
// app produces, merging the current trips into ic_tip_tracker.
export function buildExport(trips: Trip[]): string {
  const data: Record<string, string> = {}
  for (const key of ALL_KEYS) {
    const val = localStorage.getItem(key)
    if (val != null) data[key] = val
  }

  // Ensure ic_tip_tracker reflects the current in-memory trips.
  let tracker: RawEntry = {}
  try {
    tracker = data["ic_tip_tracker"] ? JSON.parse(data["ic_tip_tracker"]) : {}
  } catch {
    tracker = {}
  }
  tracker.entries = trips.map(tripToEntry)
  data["ic_tip_tracker"] = JSON.stringify(tracker)

  const doc = {
    app: "IslandCity Tip Tracker",
    version: 2,
    exportDate: new Date().toISOString(),
    data,
  }
  return JSON.stringify(doc, null, 2)
}

// Import a full export document: writes every key back to localStorage and
// returns the parsed trips so the UI can refresh immediately.
export function importExport(json: string): Trip[] | null {
  try {
    const doc = JSON.parse(json)
    const data = doc?.data
    if (!data || typeof data !== "object") return null

    for (const key of ALL_KEYS) {
      if (typeof data[key] === "string") localStorage.setItem(key, data[key])
    }

    const tracker = data["ic_tip_tracker"] ? JSON.parse(data["ic_tip_tracker"]) : null
    const entries = Array.isArray(tracker?.entries) ? tracker.entries : []
    return entries.map(entryToTrip)
  } catch {
    return null
  }
}

// =====================================================================
// Almacenamiento Permanente en IndexedDB (CopilotoV1DB)
// =====================================================================
const IDB_NAME = "CopilotoV1DB"
const IDB_VERSION = 1
const IDB_STORE = "transactions"

function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"))
      return
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: "id" })
        store.createIndex("datetime", "datetime", { unique: false })
        store.createIndex("platform", "platform", { unique: false })
      }
    }
    req.onsuccess = (e: any) => resolve(e.target.result)
    req.onerror = (e: any) => reject(e.target.error)
  })
}

export async function saveToIndexedDB(trip: Trip): Promise<void> {
  try {
    const db = await getIndexedDB()
    const entry = tripToEntry(trip)
    return new Promise((resolve, reject) => {
      const tx = db.transaction([IDB_STORE], "readwrite")
      const store = tx.objectStore(IDB_STORE)
      const req = store.put({ ...entry, savedAt: new Date().toISOString() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn("IndexedDB save error:", err)
  }
}

export async function loadTripsFromIndexedDB(): Promise<Trip[] | null> {
  try {
    const db = await getIndexedDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([IDB_STORE], "readonly")
      const req = tx.objectStore(IDB_STORE).getAll()
      req.onsuccess = () => {
        const entries = Array.isArray(req.result) ? req.result : []
        resolve(entries.length ? entries.map(entryToTrip) : null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn("IndexedDB load error:", err)
    return null
  }
}

export async function saveTripsToIndexedDB(trips: Trip[]): Promise<void> {
  try {
    const db = await getIndexedDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_STORE], "readwrite")
      const store = tx.objectStore(IDB_STORE)
      store.clear()
      for (const trip of trips) store.put({ ...tripToEntry(trip), savedAt: new Date().toISOString() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn("IndexedDB bulk save error:", err)
  }
} 

export async function clearAllStorage(): Promise<void> {
  localStorage.clear()
  try {
    const db = await getIndexedDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_STORE], "readwrite")
      tx.objectStore(IDB_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn("IndexedDB clear error:", err)
  }
}

