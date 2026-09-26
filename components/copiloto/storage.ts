import { type Trip, type Platform, PLATFORMS, type Expense, stampExpense } from "./types"
import { parseTombstones, pruneTombstones, type Tombstones } from "@/lib/sync"

// Reads and writes the exact same localStorage key/format used by the
// original IslandCity Tip Tracker export, so this redesign stays compatible
// with your real data (including GPS/coords, which are preserved untouched).
const KEY = "ic_tip_tracker"
// Copia de seguridad: si el guardado principal se corrompe o queda a medias,
// se puede recuperar desde aquí.
const BACKUP_KEY = "ic_tip_tracker_backup"
export const SYNC_CODE_KEY = "claris_sync_code"
export const DELETED_KEY = "claris_deleted_ids"

// Gastos: mismo esquema que los viajes (clave propia + copia de seguridad).
const EXPENSES_KEY = "ic_expenses"
const EXPENSES_BACKUP_KEY = "ic_expenses_backup"
export const DELETED_EXPENSES_KEY = "claris_deleted_expense_ids"

// Claves temporales de GPS (ver components/copiloto/geo.ts).
const TEMP_KEYS = ["CURRENT_PICKUP", "CURRENT_DROP_OFF"]

type RawEntry = Record<string, any>

// localStorage puede estar bloqueado (modo privado, WebView, permisos).
// Se comprueba con una prueba real de escritura para no fallar en silencio.
export function safeLocal(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    const probe = "__claris_probe__"
    localStorage.setItem(probe, "1")
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

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

// Sella el viaje con la hora de modificación: es lo que permite combinar dos
// teléfonos sin perder cambios (gana el más reciente de cada id).
export function stampTrip(t: Trip, at: string = new Date().toISOString()): Trip {
  return { ...t, raw: { ...(t.raw ?? {}), savedAt: at } }
}

export type SaveResult = { ok: boolean; error?: string }

function parseDoc(raw: string | null): Trip[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : null
    if (!entries) return null
    return entries.map(entryToTrip)
  } catch {
    return null
  }
}

export function loadTrips(): Trip[] | null {
  const ls = safeLocal()
  if (!ls) return null
  return parseDoc(ls.getItem(KEY)) ?? parseDoc(ls.getItem(BACKUP_KEY))
}

export function lastSavedAt(): string | null {
  const ls = safeLocal()
  if (!ls) return null
  try {
    const doc = JSON.parse(ls.getItem(KEY) ?? "null")
    return typeof doc?.savedAt === "string" ? doc.savedAt : null
  } catch {
    return null
  }
}

// Guarda los viajes. Devuelve el resultado en vez de ignorar los errores:
// si el teléfono no deja guardar (storage lleno/bloqueado) la app lo avisa
// en pantalla, que es lo que antes hacía que los viajes "desaparecieran".
export function saveTrips(trips: Trip[]): SaveResult {
  const ls = safeLocal()
  if (!ls) return { ok: false, error: "El almacenamiento del navegador está bloqueado" }

  const now = new Date().toISOString()
  let doc: RawEntry = {}
  const existing = ls.getItem(KEY)
  if (existing) {
    try {
      doc = JSON.parse(existing)
    } catch {
      doc = {}
    }
  }

  doc.entries = trips.map(tripToEntry)
  doc.savedAt = now
  doc.version = typeof doc.version === "number" ? doc.version : 1

  const serialized = JSON.stringify(doc)
  try {
    ls.setItem(KEY, serialized)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar" }
  }

  // La copia de seguridad es un extra: si falla, el guardado principal ya está bien.
  try {
    ls.setItem(BACKUP_KEY, serialized)
  } catch {}

  return { ok: true }
}

// ---------------------------------------------------------------------
// Borrados (tombstones): hacen que un borrado también se propague al otro
// teléfono en vez de que el viaje "reviva" al sincronizar.
// ---------------------------------------------------------------------
export function loadTombstones(): Tombstones {
  const ls = safeLocal()
  if (!ls) return {}
  return pruneTombstones(parseTombstones(ls.getItem(DELETED_KEY)))
}

export function saveTombstones(deleted: Tombstones): void {
  const ls = safeLocal()
  if (!ls) return
  try {
    ls.setItem(DELETED_KEY, JSON.stringify(pruneTombstones(deleted)))
  } catch {}
}

export function addTombstone(id: string, at: string = new Date().toISOString()): Tombstones {
  const next = { ...loadTombstones(), [id]: at }
  saveTombstones(next)
  return next
}

export function loadSyncCode(): string | null {
  const ls = safeLocal()
  if (!ls) return null
  const value = ls.getItem(SYNC_CODE_KEY)
  return value && value.trim() ? value : null
}

export function saveSyncCode(code: string | null): void {
  const ls = safeLocal()
  if (!ls) return
  try {
    if (code) ls.setItem(SYNC_CODE_KEY, code)
    else ls.removeItem(SYNC_CODE_KEY)
  } catch {}
}

// ---------------------------------------------------------------------
// GASTOS: persistencia idéntica a la de los viajes
// (localStorage principal + copia de seguridad + IndexedDB como copia viva).
// ---------------------------------------------------------------------
type RawExpenseDoc = { version?: number; savedAt?: string; entries?: Expense[] }

function parseExpenseDoc(raw: string | null): Expense[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RawExpenseDoc
    if (!Array.isArray(parsed?.entries)) return null
    return parsed.entries.filter((e) => e && typeof e.id === "string")
  } catch {
    return null
  }
}

export function loadExpenses(): Expense[] | null {
  const ls = safeLocal()
  if (!ls) return null
  return parseExpenseDoc(ls.getItem(EXPENSES_KEY)) ?? parseExpenseDoc(ls.getItem(EXPENSES_BACKUP_KEY))
}

export function saveExpenses(expenses: Expense[]): SaveResult {
  const ls = safeLocal()
  if (!ls) return { ok: false, error: "El almacenamiento del navegador está bloqueado" }

  const doc = { version: 1, savedAt: new Date().toISOString(), entries: expenses }
  const serialized = JSON.stringify(doc)
  try {
    ls.setItem(EXPENSES_KEY, serialized)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudieron guardar los gastos" }
  }
  try {
    ls.setItem(EXPENSES_BACKUP_KEY, serialized)
  } catch {}
  return { ok: true }
}

// Los borrados de gastos también viajan en el sync para no revivir en el otro.
export function loadExpenseTombstones(): Tombstones {
  const ls = safeLocal()
  if (!ls) return {}
  return pruneTombstones(parseTombstones(ls.getItem(DELETED_EXPENSES_KEY)))
}

export function saveExpenseTombstones(deleted: Tombstones): void {
  const ls = safeLocal()
  if (!ls) return
  try {
    ls.setItem(DELETED_EXPENSES_KEY, JSON.stringify(pruneTombstones(deleted)))
  } catch {}
}

export function addExpenseTombstone(id: string, at: string = new Date().toISOString()): Tombstones {
  const next = { ...loadExpenseTombstones(), [id]: at }
  saveExpenseTombstones(next)
  return next
}

// All localStorage keys used by the original IslandCity Tip Tracker, so an
// export from this redesign is a drop-in replacement for the original app.
const ALL_KEYS = [
  "ic_tip_tracker",
  "ic_expenses",
  "ic_shift",
  "ic-bank-adj-history",
  "ic-day-targets",
  "ic-work-days",
  "ic-recurring-plan",
  "ic-bank-balance",
  "ic-week-overrides",
  // FINANCE (Claris): saldo del banco, plan recurrente y meta del día.
  "claris_bank_balance",
  "claris_plan_items",
  "claris_day_goal",
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
const IDB_VERSION = 2
const IDB_STORE = "transactions"
const IDB_EXPENSES_STORE = "expenses"

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
      // v2: store de gastos (la app anterior sólo guardaba viajes).
      if (!db.objectStoreNames.contains(IDB_EXPENSES_STORE)) {
        const store = db.createObjectStore(IDB_EXPENSES_STORE, { keyPath: "id" })
        store.createIndex("date", "date", { unique: false })
      }
    }
    req.onsuccess = (e: any) => resolve(e.target.result)
    req.onerror = (e: any) => reject(e.target.error)
  })
}

// Guarda toda la lista (no sólo el último viaje) para que IndexedDB sea una
// segunda copia completa: si el teléfono borra localStorage, aquí queda todo.
export async function saveTripsToIndexedDB(trips: Trip[]): Promise<void> {
  const db = await getIndexedDB()
  const now = new Date().toISOString()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE], "readwrite")
    const store = tx.objectStore(IDB_STORE)
    for (const trip of trips) {
      store.put({ ...tripToEntry(stampTrip(trip)), savedAt: trip.raw?.savedAt ?? now })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// Lee la copia permanente de IndexedDB. Antes nunca se leía: era el motivo por
// el que al cerrar la app volvían las transacciones viejas y desaparecían las
// nuevas.
export async function loadTripsFromIndexedDB(): Promise<Trip[]> {
  const db = await getIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE], "readonly")
    const store = tx.objectStore(IDB_STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : []
      resolve(rows.map((row: RawEntry) => entryToTrip(row)))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function countIndexedDB(): Promise<number> {
  const db = await getIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_EXPENSES_STORE], "readonly")
    let total = 0
    const a = tx.objectStore(IDB_STORE).count()
    const b = tx.objectStore(IDB_EXPENSES_STORE).count()
    let pending = 2
    const done = () => {
      pending -= 1
      if (pending === 0) resolve(total)
    }
    a.onsuccess = () => {
      total += Number(a.result) || 0
      done()
    }
    b.onsuccess = () => {
      total += Number(b.result) || 0
      done()
    }
    a.onerror = () => reject(a.error)
    b.onerror = () => reject(b.error)
  })
}

export async function clearIndexedDB(): Promise<void> {
  const db = await getIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_EXPENSES_STORE], "readwrite")
    tx.objectStore(IDB_STORE).clear()
    tx.objectStore(IDB_EXPENSES_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// Gastos: segunda copia completa en IndexedDB (misma idea que los viajes).
export async function saveExpensesToIndexedDB(expenses: Expense[]): Promise<void> {
  const db = await getIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_EXPENSES_STORE], "readwrite")
    const store = tx.objectStore(IDB_EXPENSES_STORE)
    for (const expense of expenses) {
      store.put(stampExpense(expense, expense.savedAt ?? new Date().toISOString()))
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function loadExpensesFromIndexedDB(): Promise<Expense[]> {
  const db = await getIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_EXPENSES_STORE], "readonly")
    const req = tx.objectStore(IDB_EXPENSES_STORE).getAll()
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? (req.result as Expense[]) : []
      resolve(rows.filter((e) => e && typeof e.id === "string"))
    }
    req.onerror = () => reject(req.error)
  })
}

// RESET TOTAL: borra viajes, copia de seguridad, GPS temporal e IndexedDB.
// Los tombstones se guardan aparte (no se borran aquí) para que el borrado
// también llegue al otro teléfono y no "revivan" los viajes.
export async function clearAllData(): Promise<{ ok: boolean; error?: string }> {
  const ls = safeLocal()
  if (ls) {
    for (const key of [...ALL_KEYS, ...TEMP_KEYS, BACKUP_KEY]) {
      try {
        ls.removeItem(key)
      } catch {}
    }
  }
  try {
    await clearIndexedDB()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo borrar IndexedDB" }
  }
  return { ok: true }
}

export type StorageInfo = {
  trips: number
  expenses: number
  bytes: number
  keys: number
  lastSavedAt: string | null
  localStorageOk: boolean
  indexedDbOk: boolean
  indexedDbCount: number
  tombstones: number
  syncCodeSet: boolean
}

// Datos que se muestran en la pestaña DATA para que se vea de un vistazo si el
// teléfono está guardando de verdad.
export async function storageInfo(tripCount: number, expenseCount: number = 0): Promise<StorageInfo> {
  const ls = safeLocal()
  let bytes = 0
  let keys = 0
  if (ls) {
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i)
      if (!key) continue
      keys += 1
      bytes += key.length + (ls.getItem(key) ?? "").length
    }
  }

  let indexedDbOk = false
  let indexedDbCount = 0
  try {
    indexedDbCount = await countIndexedDB()
    indexedDbOk = true
  } catch {}

  return {
    trips: tripCount,
    expenses: expenseCount,
    bytes,
    keys,
    lastSavedAt: lastSavedAt(),
    localStorageOk: !!ls,
    indexedDbOk,
    indexedDbCount,
    tombstones: Object.keys(loadTombstones()).length + Object.keys(loadExpenseTombstones()).length,
    syncCodeSet: !!loadSyncCode(),
  }
}

