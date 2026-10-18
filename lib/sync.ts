// Sincronización entre teléfonos con un CÓDIGO PRIVADO.
//
// Cómo funciona:
//  1. Todo el documento (viajes + borrados) se cifra en el teléfono con AES-GCM
//     usando una clave derivada del código privado (PBKDF2). El servidor sólo
//     guarda el texto cifrado y nunca ve el código ni los viajes.
//  2. Al abrir la app se baja el documento del servidor, se combina con lo local
//     (gana la versión más nueva de cada viaje) y se sube el resultado.
//  3. Los borrados se guardan como "tombstones" para que el borrado también se
//     propague al otro teléfono en vez de resucitar el viaje.
//
// Este archivo es puro (sin imports del proyecto) para poder probarlo en Node.

export type SyncTrip = { id: string; savedAt?: string; raw?: Record<string, any> }
export type Tombstones = Record<string, string>
export type SyncDoc<T> = {
  version: number
  updatedAt: string
  entries: T[]
  deleted: Tombstones
  // Gastos: mismo mecanismo que los viajes (mezcla por id + tombstones).
  expenses?: SyncTrip[]
  deletedExpenses?: Tombstones
  // DINERO: libro, recurrentes y cuentas. Opcional (clientes viejos no lo traen).
  finance?: SyncFinance
}

// DINERO viaja en el mismo documento cifrado (Supabase sync_docs).
//  - ledger / schedules: mezcla por id + tombstones (igual que viajes y gastos).
//    Cada item va envuelto: { id, savedAt, raw: <objeto original> }.
//  - blobs: claves completas de localStorage (cuentas, otros fondos...): gana
//    la copia con `at` más reciente; si lo local nunca se sincronizó (sin
//    `at`), gana la nube.
export type SyncBlob = { at: string; value: string }
export type SyncFinance = {
  ledger?: SyncTrip[]
  deletedLedger?: Tombstones
  schedules?: SyncTrip[]
  deletedSchedules?: Tombstones
  blobs?: Record<string, SyncBlob>
}

const PBKDF2_ITERATIONS = 150_000
const SALT_BYTES = 16
const IV_BYTES = 12
const TOMBSTONE_TTL_DAYS = 30

export function savedAtOf(t: SyncTrip | null | undefined): string {
  // Los gastos guardan la hora en el propio objeto; los viajes en raw.savedAt.
  if (typeof t?.savedAt === "string" && t.savedAt) return t.savedAt
  const v = t?.raw?.savedAt
  return typeof v === "string" ? v : ""
}

function isNewer(a: string, b: string): boolean {
  if (!a) return false
  if (!b) return true
  return a > b
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function pruneTombstones(tombstones: Tombstones, reference = nowIso()): Tombstones {
  const limit = new Date(reference).getTime() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000
  const out: Tombstones = {}
  for (const [id, at] of Object.entries(tombstones)) {
    const t = new Date(at).getTime()
    if (Number.isFinite(t) && t >= limit) out[id] = at
  }
  return out
}

export function parseTombstones(raw: string | null | undefined): Tombstones {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Tombstones = {}
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === "string") out[id] = at
    }
    return out
  } catch {
    return {}
  }
}

// Combina dos listas por id: gana la que tenga savedAt más reciente.
// Un "tombstone" más nuevo que el viaje lo elimina (y también lo elimina del
// resultado si venía del otro teléfono).
export function mergeTrips<T extends SyncTrip>(
  local: T[],
  remote: T[],
  tombstones: Tombstones = {},
): { trips: T[]; deleted: Tombstones } {
  const byId = new Map<string, T>()

  const consider = (t: T | null | undefined) => {
    if (!t || typeof t.id !== "string" || !t.id) return
    const prev = byId.get(t.id)
    if (!prev || isNewer(savedAtOf(t), savedAtOf(prev))) byId.set(t.id, t)
  }

  // Primero lo local: en caso de empate (misma hora, o datos de la versión
  // anterior sin hora) gana lo que hay en localStorage, que es la copia viva.
  for (const t of local) consider(t)
  for (const t of remote) consider(t)

  const deleted = pruneTombstones(tombstones)
  for (const [id, at] of Object.entries(deleted)) {
    const trip = byId.get(id)
    if (trip && isNewer(at, savedAtOf(trip))) {
      byId.delete(id)
    } else if (trip && isNewer(savedAtOf(trip), at)) {
      // El viaje fue recreado/editado después del borrado: el borrado ya no manda.
      delete deleted[id]
    }
  }

  const trips = [...byId.values()].sort((a, b) => {
    const sa = savedAtOf(a)
    const sb = savedAtOf(b)
    if (sa === sb) return 0
    return sa > sb ? -1 : 1
  })

  return { trips, deleted }
}

function asList(v: unknown): SyncTrip[] {
  return Array.isArray(v) ? (v as SyncTrip[]) : []
}

function asTombstones(v: unknown): Tombstones {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Tombstones) : {}
}

function asBlobs(v: unknown): Record<string, SyncBlob> {
  const out: Record<string, SyncBlob> = {}
  if (!v || typeof v !== "object" || Array.isArray(v)) return out
  for (const [k, b] of Object.entries(v as Record<string, any>)) {
    if (b && typeof b.value === "string") out[k] = { at: typeof b.at === "string" ? b.at : "", value: b.value }
  }
  return out
}

// Combina DINERO local + remoto. Puro (probado en Node).
export function mergeFinance(local: SyncFinance | null | undefined, remote: SyncFinance | null | undefined): SyncFinance {
  const l = local || {}
  const r = remote || {}
  const ledger = mergeTrips(asList(l.ledger), asList(r.ledger), {
    ...asTombstones(r.deletedLedger),
    ...asTombstones(l.deletedLedger),
  })
  const schedules = mergeTrips(asList(l.schedules), asList(r.schedules), {
    ...asTombstones(r.deletedSchedules),
    ...asTombstones(l.deletedSchedules),
  })
  const lb = asBlobs(l.blobs)
  const rb = asBlobs(r.blobs)
  const blobs: Record<string, SyncBlob> = {}
  for (const key of new Set([...Object.keys(lb), ...Object.keys(rb)])) {
    const a = lb[key]
    const b = rb[key]
    // Local sin hora = nunca sincronizado en este teléfono: manda la nube
    // (un teléfono nuevo no pisa las cuentas ya guardadas).
    if (a && b) blobs[key] = !a.at || isNewer(b.at, a.at) ? b : a
    else blobs[key] = (a || b) as SyncBlob
  }
  return {
    ledger: ledger.trips,
    deletedLedger: ledger.deleted,
    schedules: schedules.trips,
    deletedSchedules: schedules.deleted,
    blobs,
  }
}

export function buildDoc<T extends SyncTrip>(
  trips: T[],
  deleted: Tombstones,
  expenses: SyncTrip[] = [],
  deletedExpenses: Tombstones = {},
  finance?: SyncFinance,
): SyncDoc<T> {
  const doc: SyncDoc<T> = {
    version: 1,
    updatedAt: nowIso(),
    entries: trips,
    deleted: pruneTombstones(deleted),
    expenses,
    deletedExpenses: pruneTombstones(deletedExpenses),
  }
  if (finance) {
    doc.finance = {
      ...finance,
      deletedLedger: pruneTombstones(asTombstones(finance.deletedLedger)),
      deletedSchedules: pruneTombstones(asTombstones(finance.deletedSchedules)),
    }
  }
  return doc
}

// ---------------------------------------------------------------------
// Cifrado en el teléfono
// ---------------------------------------------------------------------
function webCrypto(): Crypto {
  const c = (globalThis as any).crypto
  if (!c?.subtle) throw new Error("Este navegador no soporta cifrado (WebCrypto)")
  return c as Crypto
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export const MIN_SYNC_CODE_LENGTH = 8

export function normalizeSyncCode(code: string): string {
  return code.trim().toLowerCase()
}

export function isValidSyncCode(code: string): boolean {
  return normalizeSyncCode(code).length >= MIN_SYNC_CODE_LENGTH
}

// Hash del código: es lo único que viaja al servidor (nunca el código en claro).
export async function syncKeyId(code: string): Promise<string> {
  const data = new TextEncoder().encode(`claris-sync:${normalizeSyncCode(code)}`)
  const digest = await webCrypto().subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function deriveKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = webCrypto().subtle
  const base = await subtle.importKey("raw", new TextEncoder().encode(normalizeSyncCode(code)), "PBKDF2", false, [
    "deriveKey",
  ])
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function encryptJson(code: string, data: unknown): Promise<string> {
  const c = webCrypto()
  const salt = c.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = c.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(code, salt)
  const cipher = await c.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(data)))
  return toBase64(concatBytes(salt, iv, new Uint8Array(cipher)))
}

export async function decryptJson<T>(code: string, payload: string): Promise<T | null> {
  try {
    const bytes = fromBase64(payload)
    if (bytes.length <= SALT_BYTES + IV_BYTES) return null
    const salt = bytes.slice(0, SALT_BYTES)
    const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
    const cipher = bytes.slice(SALT_BYTES + IV_BYTES)
    const key = await deriveKey(code, salt)
    const plain = await webCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, cipher)
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------
// Servidor (/api/sync)
// ---------------------------------------------------------------------
export type SyncStatus = {
  ok: boolean
  status: number
  reason: "ok" | "not_configured" | "bad_code" | "network" | "invalid_code"
  message: string
  pulled?: number
  pushed?: number
  trips?: SyncTrip[]
  deleted?: Tombstones
  expenses?: SyncTrip[]
  deletedExpenses?: Tombstones
  finance?: SyncFinance
  /** true = el documento era muy grande y DINERO no se subió esta vez. */
  financeSkipped?: boolean
  updatedAt?: string
}

async function readError(res: Response): Promise<string> {
  try {
    const json = await res.json()
    return typeof json?.error === "string" ? json.error : `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export async function pullRemote(
  code: string,
): Promise<{ ok: boolean; status: number; payload: string | null; message: string }> {
  try {
    const key = await syncKeyId(code)
    const res = await fetch(`/api/sync?key=${key}`, { cache: "no-store" })
    if (res.status === 501) {
      return { ok: false, status: 501, payload: null, message: "El servidor no tiene sync configurado" }
    }
    if (!res.ok) return { ok: false, status: res.status, payload: null, message: await readError(res) }
    const json = (await res.json()) as { payload?: string | null }
    return { ok: true, status: 200, payload: json?.payload ?? null, message: "ok" }
  } catch (err) {
    return { ok: false, status: 0, payload: null, message: err instanceof Error ? err.message : "Sin conexión" }
  }
}

export async function pushRemote(
  code: string,
  payload: string,
): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const key = await syncKeyId(code)
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, payload }),
    })
    if (!res.ok) return { ok: false, status: res.status, message: await readError(res) }
    return { ok: true, status: 200, message: "ok" }
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "Sin conexión" }
  }
}

/** Borra el documento cifrado de la nube (reset total desde DATA): al volver
 *  a sincronizar, todo — libro, gastos y feed de Plaid — arranca fresco. */
export async function deleteCloudDoc(code: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const key = await syncKeyId(code)
    const res = await fetch(`/api/sync?key=${key}`, { method: "DELETE", cache: "no-store" })
    if (res.status === 501) {
      return { ok: false, status: 501, message: "El servidor no tiene sync configurado" }
    }
    if (!res.ok) return { ok: false, status: res.status, message: await readError(res) }
    return { ok: true, status: 200, message: "ok" }
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "Sin conexión" }
  }
}

// Baja -> combina con lo local -> sube el resultado combinado.
// Devuelve la lista combinada para que la app la use como estado nuevo.
// Los gastos viajan en el mismo documento cifrado (parámetros opcionales, así
// un cliente antiguo sigue funcionando y no se pierden datos).
export async function syncWithCloud<T extends SyncTrip>(
  code: string,
  localTrips: T[],
  localTombstones: Tombstones,
  localExpenses: SyncTrip[] = [],
  localExpenseTombstones: Tombstones = {},
  localFinance?: SyncFinance,
): Promise<SyncStatus> {
  if (!isValidSyncCode(code)) {
    return {
      ok: false,
      status: 400,
      reason: "invalid_code",
      message: `El código necesita al menos ${MIN_SYNC_CODE_LENGTH} caracteres`,
    }
  }

  const remote = await pullRemote(code)
  if (!remote.ok) {
    return {
      ok: false,
      status: remote.status,
      reason: remote.status === 501 ? "not_configured" : "network",
      message: remote.message,
    }
  }

  let remoteTrips: T[] = []
  let remoteTombstones: Tombstones = {}
  let remoteExpenses: SyncTrip[] = []
  let remoteExpenseTombstones: Tombstones = {}
  let remoteFinance: SyncFinance | undefined
  if (remote.payload) {
    const doc = await decryptJson<SyncDoc<T>>(code, remote.payload)
    if (!doc) {
      return {
        ok: false,
        status: 200,
        reason: "bad_code",
        message: "El código no coincide con los datos del servidor (o el archivo está dañado)",
      }
    }
    remoteTrips = Array.isArray(doc.entries) ? doc.entries : []
    remoteTombstones = doc.deleted && typeof doc.deleted === "object" ? doc.deleted : {}
    remoteExpenses = Array.isArray(doc.expenses) ? doc.expenses : []
    remoteExpenseTombstones =
      doc.deletedExpenses && typeof doc.deletedExpenses === "object" ? doc.deletedExpenses : {}
    remoteFinance = doc.finance && typeof doc.finance === "object" ? doc.finance : undefined
  }

  const merged = mergeTrips(localTrips, remoteTrips, { ...remoteTombstones, ...localTombstones })
  const mergedExpenses = mergeTrips(localExpenses, remoteExpenses, {
    ...remoteExpenseTombstones,
    ...localExpenseTombstones,
  })
  // Sin DINERO local (cliente que no lo manda): se conserva el remoto tal cual,
  // para no borrarlo del servidor.
  const finance = localFinance ? mergeFinance(localFinance, remoteFinance) : remoteFinance
  let doc = buildDoc(merged.trips, merged.deleted, mergedExpenses.trips, mergedExpenses.deleted, finance)

  let pushed = await pushRemote(code, await encryptJson(code, doc))
  let financeSkipped = false
  // Documento demasiado grande (413): viajes y gastos primero. Se sube sin el
  // DINERO local (se conserva el remoto) y se avisa; nada se borra en local.
  if (!pushed.ok && pushed.status === 413 && localFinance) {
    doc = buildDoc(merged.trips, merged.deleted, mergedExpenses.trips, mergedExpenses.deleted, remoteFinance)
    pushed = await pushRemote(code, await encryptJson(code, doc))
    financeSkipped = pushed.ok
  }
  if (!pushed.ok) {
    return {
      ok: false,
      status: pushed.status,
      reason: pushed.status === 501 ? "not_configured" : "network",
      message: pushed.message,
    }
  }

  return {
    ok: true,
    status: 200,
    reason: "ok",
    message: "Sincronizado",
    pulled: remoteTrips.length,
    pushed: merged.trips.length,
    trips: merged.trips,
    deleted: merged.deleted,
    expenses: mergedExpenses.trips,
    deletedExpenses: mergedExpenses.deleted,
    finance: financeSkipped ? undefined : doc.finance,
    financeSkipped,
    updatedAt: doc.updatedAt,
  }
}
