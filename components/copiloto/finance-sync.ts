// DINERO ↔ Supabase (sync_docs, cifrado en el teléfono).
//
// El libro (claris_cash_flow_entries), los recurrentes (claris_scheduled_entries)
// y las cuentas (claris_registers_v1 + otros) se escriben desde muchos sitios
// de la app directo a localStorage. Para no tocar cada uno, este módulo detecta
// los cambios comparando contra una "foto" de la última sincronización:
//   - item nuevo o con contenido distinto  → savedAt = ahora
//   - item igual                           → conserva el savedAt de la foto
//   - item que estaba en la foto y ya no   → tombstone (borrado) = ahora
// Así la mezcla por id + tombstones de lib/sync.ts funciona igual que con
// viajes y gastos.

import type { SyncBlob, SyncFinance, SyncTrip, Tombstones } from "@/lib/sync"

export const FINANCE_LEDGER_KEY = "claris_cash_flow_entries"
export const FINANCE_SCHEDULES_KEY = "claris_scheduled_entries"
/** Claves que viajan completas (gana la copia más reciente). */
export const FINANCE_BLOB_KEYS = [
  "claris_registers_v1",
  "claris_other_funds_v1",
  "claris_toll_bills",
  "claris_finance_week_v1",
  "claris_forecast_dismissed_v1",
] as const
/** "Probablemente pagado" que el usuario descartó (viaja con el sync). */
export const FORECAST_DISMISSED_KEY = "claris_forecast_dismissed_v1"
/** Foto de la última sincronización (solo local, nunca viaja). */
export const FINANCE_SYNC_STATE_KEY = "claris_finance_sync_state_v1"
/** Evento que avisa a las pantallas de DINERO que relean localStorage. */
export const FINANCE_SYNCED_EVENT = "claris:finance-synced"

type StorageLike = Pick<Storage, "getItem" | "setItem">

type Stamp = { h: string; at: string }
type FinanceSyncState = {
  ledger: Record<string, Stamp>
  schedules: Record<string, Stamp>
  blobs: Record<string, Stamp>
  deletedLedger: Tombstones
  deletedSchedules: Tombstones
}

function emptyState(): FinanceSyncState {
  return { ledger: {}, schedules: {}, blobs: {}, deletedLedger: {}, deletedSchedules: {} }
}

function storage(s?: StorageLike | null): StorageLike | null {
  if (s) return s
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

// Hash corto (FNV-1a 32 bits) del JSON: solo para detectar cambios.
export function hashText(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

function loadState(ls: StorageLike): { state: FinanceSyncState; firstTime: boolean } {
  try {
    const raw = ls.getItem(FINANCE_SYNC_STATE_KEY)
    if (!raw) return { state: emptyState(), firstTime: true }
    const p = JSON.parse(raw)
    const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as any) : {})
    return {
      state: {
        ledger: obj(p?.ledger),
        schedules: obj(p?.schedules),
        blobs: obj(p?.blobs),
        deletedLedger: obj(p?.deletedLedger),
        deletedSchedules: obj(p?.deletedSchedules),
      },
      firstTime: false,
    }
  } catch {
    return { state: emptyState(), firstTime: true }
  }
}

function readList(ls: StorageLike, key: string): Record<string, any>[] {
  try {
    const parsed = JSON.parse(ls.getItem(key) || "[]")
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === "object") : []
  } catch {
    return []
  }
}

function wrapList(
  items: Record<string, any>[],
  stamps: Record<string, Stamp>,
  deleted: Tombstones,
  firstTime: boolean,
  now: string,
): { list: SyncTrip[]; deleted: Tombstones } {
  const list: SyncTrip[] = []
  const seen = new Set<string>()
  for (const raw of items) {
    const id = typeof raw.id === "string" && raw.id ? raw.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const h = hashText(JSON.stringify(raw))
    const prev = stamps[id]
    // Primera vez en este teléfono: sin hora → pierde ante una copia ya
    // sincronizada desde otro teléfono, pero se sube si no existe allá.
    const savedAt = prev && prev.h === h ? prev.at : firstTime ? "" : now
    list.push({ id, savedAt, raw })
  }
  const outDeleted: Tombstones = { ...deleted }
  for (const id of Object.keys(stamps)) {
    if (!seen.has(id) && !outDeleted[id]) outDeleted[id] = now
  }
  return { list, deleted: outDeleted }
}

/** Lee MONEY de localStorage y lo prepara para syncWithCloud. */
export function collectLocalFinance(
  s?: StorageLike | null,
  now: string = new Date().toISOString(),
): SyncFinance | undefined {
  const ls = storage(s)
  if (!ls) return undefined
  const { state, firstTime } = loadState(ls)
  const ledger = wrapList(readList(ls, FINANCE_LEDGER_KEY), state.ledger, state.deletedLedger, firstTime, now)
  const schedules = wrapList(
    readList(ls, FINANCE_SCHEDULES_KEY),
    state.schedules,
    state.deletedSchedules,
    firstTime,
    now,
  )
  const blobs: Record<string, SyncBlob> = {}
  for (const key of FINANCE_BLOB_KEYS) {
    const value = ls.getItem(key)
    if (value == null) continue
    const h = hashText(value)
    const prev = state.blobs[key]
    blobs[key] = { at: prev && prev.h === h ? prev.at : firstTime ? "" : now, value }
  }
  return {
    ledger: ledger.list,
    deletedLedger: ledger.deleted,
    schedules: schedules.list,
    deletedSchedules: schedules.deleted,
    blobs,
  }
}

function stampsOf(list: SyncTrip[]): Record<string, Stamp> {
  const out: Record<string, Stamp> = {}
  for (const t of list) {
    if (!t?.id || !t.raw) continue
    out[t.id] = { h: hashText(JSON.stringify(t.raw)), at: typeof t.savedAt === "string" ? t.savedAt : "" }
  }
  return out
}

// Libro: lo más nuevo arriba (mismo orden con que la app lo guarda).
function byDateDesc(a: Record<string, any>, b: Record<string, any>): number {
  return String(b?.date || "").localeCompare(String(a?.date || ""))
}

/**
 * Escribe el resultado combinado en localStorage, guarda la foto nueva y avisa
 * a las pantallas de DINERO. Devuelve true si algo cambió en local.
 */
export function applyMergedFinance(finance: SyncFinance | undefined, s?: StorageLike | null): boolean {
  const ls = storage(s)
  if (!ls || !finance) return false
  let changed = false
  const writeIfDifferent = (key: string, value: string) => {
    if (ls.getItem(key) === value) return
    ls.setItem(key, value)
    changed = true
  }
  try {
    const ledger = Array.isArray(finance.ledger) ? finance.ledger : []
    const schedules = Array.isArray(finance.schedules) ? finance.schedules : []
    // Solo se reescribe si el contenido cambió de verdad (no por reordenar).
    const ledgerRaw = ledger.map((t) => t.raw).filter(Boolean) as Record<string, any>[]
    const sameLedger = (() => {
      const cur = readList(ls, FINANCE_LEDGER_KEY)
      if (cur.length !== ledgerRaw.length) return false
      const a = new Set(cur.map((x) => hashText(JSON.stringify(x))))
      return ledgerRaw.every((x) => a.has(hashText(JSON.stringify(x))))
    })()
    if (!sameLedger) writeIfDifferent(FINANCE_LEDGER_KEY, JSON.stringify([...ledgerRaw].sort(byDateDesc)))
    const schedRaw = schedules.map((t) => t.raw).filter(Boolean) as Record<string, any>[]
    const sameSched = (() => {
      const cur = readList(ls, FINANCE_SCHEDULES_KEY)
      if (cur.length !== schedRaw.length) return false
      const a = new Set(cur.map((x) => hashText(JSON.stringify(x))))
      return schedRaw.every((x) => a.has(hashText(JSON.stringify(x))))
    })()
    if (!sameSched) writeIfDifferent(FINANCE_SCHEDULES_KEY, JSON.stringify(schedRaw))
    const blobStamps: Record<string, Stamp> = {}
    for (const [key, blob] of Object.entries(finance.blobs || {})) {
      if (!(FINANCE_BLOB_KEYS as readonly string[]).includes(key)) continue
      if (!blob || typeof blob.value !== "string") continue
      writeIfDifferent(key, blob.value)
      blobStamps[key] = { h: hashText(blob.value), at: blob.at || "" }
    }
    const state: FinanceSyncState = {
      ledger: stampsOf(ledger),
      schedules: stampsOf(schedules),
      blobs: blobStamps,
      deletedLedger: finance.deletedLedger || {},
      deletedSchedules: finance.deletedSchedules || {},
    }
    ls.setItem(FINANCE_SYNC_STATE_KEY, JSON.stringify(state))
  } catch {
    // Cuota llena u otro error: se reintenta en el próximo sync.
    return false
  }
  if (changed && typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
    } catch {}
  }
  return changed
}

export function financeCounts(finance: SyncFinance | undefined): { ledger: number; schedules: number } {
  return {
    ledger: Array.isArray(finance?.ledger) ? finance.ledger.length : 0,
    schedules: Array.isArray(finance?.schedules) ? finance.schedules.length : 0,
  }
}

