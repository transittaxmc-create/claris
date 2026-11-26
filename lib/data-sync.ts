// Sync AUTOMÁTICO entre teléfonos (copia de prueba, 2026-11-19).
//
// Transporte nuevo, motor de mezcla viejo: el documento que viaja es el
// MISMO SyncDoc de lib/sync.ts (viajes + gastos + DINERO) y la mezcla es
// la misma de siempre (mergeTrips / mergeFinance: por ítem, gana la
// versión más nueva, los borrados viajan como lápidas). Lo que cambia es
// el transporte: en vez del código privado de /api/sync, el documento va
// y viene por /api/data/publish y /api/data/snapshot, protegido con la
// llave de publicación (header x-data-key) y guardado en Supabase —
// tabla propia finance_sync_doc del proyecto del CRM, con la sesión de
// Miguel y RLS por dueño (2026-11-26: el Blob de Vercel quedó
// suspendido y el proyecto financiero congelado; por orden de Miguel
// no se espera a Vercel). Sin código que teclear: abrir la app en el
// otro teléfono basta.
//
// Activación: sin llave no hay sync (la app se comporta EXACTAMENTE como
// hoy). La llave del cliente sale de NEXT_PUBLIC_DATA_SYNC_KEY o, si no,
// de localStorage "claris_data_sync_key" (se guarda una vez por teléfono).
//
// Reglas de mezcla (las de lib/sync.ts + guardias extra de 2026-11-01/09):
//  - Lectura de la nube fallida o ilegible → NO se escribe nada, ni en
//    local ni en la nube.
//  - Guardia anti-vacío: si la nube tiene ítems y la mezcla diera CERO
//    ítems vivos, se aborta todo (no se aplica ni se publica).
//  - Primer contacto: local vacío + nube con datos → se adopta la nube
//    (es el resultado natural de la mezcla); ambos con datos → mezcla
//    por ítem, nunca reemplazo del documento entero.

import {
  buildDoc,
  mergeFinance,
  mergeTrips,
  type SyncDoc,
  type SyncFinance,
  type SyncTrip,
  type Tombstones,
} from "./sync"

export const DATA_SYNC_KEY_STORAGE = "claris_data_sync_key"

/** Llave del sync automático en ESTE teléfono ("" = no activado). */
export function resolveDataSyncKey(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DATA_SYNC_KEY
  if (typeof fromEnv === "string" && fromEnv) return fromEnv
  try {
    return localStorage.getItem(DATA_SYNC_KEY_STORAGE) || ""
  } catch {
    return ""
  }
}

export type DataSyncResult = {
  ok: boolean
  status: number
  reason: "ok" | "not_configured" | "bad_key" | "network" | "invalid_doc" | "empty_guard"
  message: string
  trips?: SyncTrip[]
  deleted?: Tombstones
  expenses?: SyncTrip[]
  deletedExpenses?: Tombstones
  finance?: SyncFinance
  /** true = el documento era muy grande y DINERO no se subió esta vez. */
  financeSkipped?: boolean
  updatedAt?: string
}

function countLiveParts(
  trips: unknown,
  expenses: unknown,
  finance: SyncFinance | undefined,
): number {
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  return len(trips) + len(expenses) + len(finance?.ledger) + len(finance?.schedules)
}

async function readError(res: Response): Promise<string> {
  try {
    const json = await res.json()
    return typeof json?.error === "string" ? json.error : `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

type PullOutcome =
  | { kind: "doc"; doc: SyncDoc<SyncTrip> }
  | { kind: "empty" }
  | { kind: "fail"; status: number; reason: DataSyncResult["reason"]; message: string }

async function pullDataDoc(key: string): Promise<PullOutcome> {
  let res: Response
  try {
    res = await fetch("/api/data/snapshot", {
      headers: { "x-data-key": key },
      cache: "no-store",
    })
  } catch (err) {
    return {
      kind: "fail",
      status: 0,
      reason: "network",
      message: err instanceof Error ? err.message : "Sin conexión",
    }
  }
  if (res.status === 503) {
    return { kind: "fail", status: 503, reason: "not_configured", message: "data_sync_not_configured" }
  }
  if (res.status === 401) {
    return { kind: "fail", status: 401, reason: "bad_key", message: "unauthorized" }
  }
  if (!res.ok) {
    return { kind: "fail", status: res.status, reason: "network", message: await readError(res) }
  }
  let body: any = null
  try {
    body = await res.json()
  } catch {
    return { kind: "fail", status: res.status, reason: "invalid_doc", message: "Respuesta ilegible del servidor" }
  }
  // Sin documento todavía: el servidor responde { doc: null }.
  if (!body || body.doc === null) return { kind: "empty" }
  if (typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.entries)) {
    return { kind: "fail", status: res.status, reason: "invalid_doc", message: "Documento de la nube ilegible" }
  }
  return { kind: "doc", doc: body as SyncDoc<SyncTrip> }
}

async function pushDataDoc(
  key: string,
  doc: SyncDoc<SyncTrip>,
): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const res = await fetch("/api/data/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-data-key": key },
      body: JSON.stringify(doc),
    })
    if (!res.ok) return { ok: false, status: res.status, message: await readError(res) }
    return { ok: true, status: 200, message: "ok" }
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "Sin conexión" }
  }
}

function asDocParts(doc: SyncDoc<SyncTrip> | null): {
  trips: SyncTrip[]
  tombstones: Tombstones
  expenses: SyncTrip[]
  expenseTombstones: Tombstones
  finance?: SyncFinance
} {
  if (!doc) return { trips: [], tombstones: {}, expenses: [], expenseTombstones: {} }
  return {
    trips: Array.isArray(doc.entries) ? doc.entries : [],
    tombstones: doc.deleted && typeof doc.deleted === "object" ? doc.deleted : {},
    expenses: Array.isArray(doc.expenses) ? doc.expenses : [],
    expenseTombstones:
      doc.deletedExpenses && typeof doc.deletedExpenses === "object" ? doc.deletedExpenses : {},
    finance: doc.finance && typeof doc.finance === "object" ? doc.finance : undefined,
  }
}

// Baja -> combina con lo local -> sube el resultado combinado.
// Devuelve las listas combinadas para que la app las use como estado
// nuevo. Si algo falla, ok=false y la app NO toca su estado (igual que
// syncWithCloud en lib/sync.ts).
export async function syncDataWithServer<T extends SyncTrip>(
  key: string,
  localTrips: T[],
  localTombstones: Tombstones,
  localExpenses: SyncTrip[] = [],
  localExpenseTombstones: Tombstones = {},
  localFinance?: SyncFinance,
): Promise<DataSyncResult> {
  if (!key) {
    return { ok: false, status: 0, reason: "not_configured", message: "Sync automático no activado" }
  }

  const pulled = await pullDataDoc(key)
  if (pulled.kind === "fail") {
    return { ok: false, status: pulled.status, reason: pulled.reason, message: pulled.message }
  }
  const remote = asDocParts(pulled.kind === "doc" ? pulled.doc : null)
  const remoteCount = countLiveParts(remote.trips, remote.expenses, remote.finance)

  const merged = mergeTrips(localTrips, remote.trips as T[], {
    ...remote.tombstones,
    ...localTombstones,
  })
  const mergedExpenses = mergeTrips(localExpenses, remote.expenses, {
    ...remote.expenseTombstones,
    ...localExpenseTombstones,
  })
  // Sin DINERO local (cliente que no lo manda): se conserva el remoto tal
  // cual, para no borrarlo del servidor.
  const finance = localFinance ? mergeFinance(localFinance, remote.finance) : remote.finance

  // Guardia anti-vacío: la nube tenía ítems y la mezcla daría cero SIN
  // lápidas que lo expliquen — algo está mal; no se aplica ni se publica
  // nada. Si las lápidas de la mezcla cubren todos los ítems remotos, es
  // un borrado legítimo (borrar todo en el otro teléfono) y sí pasa.
  const mergedCount = countLiveParts(merged.trips, mergedExpenses.trips, finance)
  if (remoteCount > 0 && mergedCount === 0) {
    const tombs = new Set<string>([
      ...Object.keys(merged.deleted),
      ...Object.keys(mergedExpenses.deleted),
      ...Object.keys(finance?.deletedLedger ?? {}),
      ...Object.keys(finance?.deletedSchedules ?? {}),
    ])
    const remoteIds = [...remote.trips, ...remote.expenses]
      .map((t) => t?.id)
      .filter((id): id is string => typeof id === "string" && !!id)
    const remoteFinanceIds = [...(remote.finance?.ledger ?? []), ...(remote.finance?.schedules ?? [])]
      .map((t) => t?.id)
      .filter((id): id is string => typeof id === "string" && !!id)
    const allCovered =
      remoteIds.every((id) => tombs.has(id)) && remoteFinanceIds.every((id) => tombs.has(id))
    if (!allCovered) {
      return {
        ok: false,
        status: 200,
        reason: "empty_guard",
        message: "La mezcla daría cero ítems y la nube sí tiene datos: no se tocó nada.",
      }
    }
  }

  let doc = buildDoc(merged.trips, merged.deleted, mergedExpenses.trips, mergedExpenses.deleted, finance)
  let pushed = await pushDataDoc(key, doc as SyncDoc<SyncTrip>)
  let financeSkipped = false
  // Documento demasiado grande (413): viajes y gastos primero; se sube
  // conservando el DINERO remoto y se avisa. Nada se borra en local.
  if (!pushed.ok && pushed.status === 413 && localFinance) {
    doc = buildDoc(merged.trips, merged.deleted, mergedExpenses.trips, mergedExpenses.deleted, remote.finance)
    pushed = await pushDataDoc(key, doc as SyncDoc<SyncTrip>)
    financeSkipped = pushed.ok
  }
  if (!pushed.ok) {
    return {
      ok: false,
      status: pushed.status,
      reason:
        pushed.status === 503
          ? "not_configured"
          : pushed.status === 401
            ? "bad_key"
            : pushed.status === 409
              ? "empty_guard"
              : "network",
      message: pushed.message,
    }
  }

  return {
    ok: true,
    status: 200,
    reason: "ok",
    message: "Sincronizado",
    trips: merged.trips,
    deleted: merged.deleted,
    expenses: mergedExpenses.trips,
    deletedExpenses: mergedExpenses.deleted,
    finance: financeSkipped ? undefined : doc.finance,
    financeSkipped,
    updatedAt: doc.updatedAt,
  }
}
