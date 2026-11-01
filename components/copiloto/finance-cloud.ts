"use client"

// Proyecciones ↔ Supabase (orden de Miguel, 2026-10-26): "los datos se
// supone que estén en Supabase — no importa en cuál teléfono lo abra".
//
// El register del banco YA vive en Supabase (app_state id='register');
// los datos de DINERO/Proyecciones viven en app_state id='finance' vía
// /api/finance/state, con el localStorage como caché local.
//
// REGLAS DE SINCRONIZACIÓN (reescritas el 2026-11-01 — Miguel reportó
// que las proyecciones de gastos aparecían y desaparecían solas entre
// una apertura y otra):
//
//  1. UNA LECTURA FALLIDA NO ES UNA NUBE VACÍA. Antes, si el GET de
//     arranque fallaba (señal floja en el carro), el código lo trataba
//     como "la nube está vacía" y SUBÍA la copia local — vieja —
//     pisando la nube buena. Documento completo, último que escribe
//     gana, sin fusionar: así se borraban las entradas nuevas y luego
//     "volvían" cuando la copia buena subía otra vez. Ahora: sin una
//     lectura buena NO se escribe nada.
//  2. NADIE PISA A NADIE: cada ciclo baja la nube y FUSIONA contra la
//     última foto conocida de la nube ("base", persistida entre
//     aperturas como índice de huellas por item):
//       - cambió solo aquí  → manda lo local
//       - cambió solo allá  → manda lo de la nube
//       - cambiaron los dos la misma clave → fusión de items A TRES
//         BANDAS: un item que estaba en la base y falta en un lado fue
//         BORRADO en ese lado y no vuelve, aunque el otro lado haya
//         tocado la misma lista (la unión simple lo resucitaba: la
//         limpieza del 2026-11-01 rebotó tres veces por eso).
//     Primer contacto sin índice y con datos en la nube: manda la nube
//     tal cual — la copia local es un caché, no una segunda fuente.
//  3. GUARDA ANTI-VACÍO: si el resultado fusionado pierde el libro y
//     los recurrentes que la nube sí tiene, NO se sube: se baja la
//     nube y el teléfono se recupera solo. La única excepción es el
//     Reset total deliberado hecho en una sesión que ya había
//     sincronizado datos (ahí sí se limpia la nube).
//
// El primer contacto de una sesión (todavía no hay "base") prefiere la
// nube en los conflictos y une las listas por id, para no perder nada
// de ningún lado.

import { FINANCE_LEDGER_KEY, FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT, hashText } from "./finance-sync"

/** Claves de DINERO/Proyecciones que viven en la nube (blob completo). */
export const FINANCE_CLOUD_KEYS = [
  FINANCE_LEDGER_KEY,
  FINANCE_SCHEDULES_KEY,
  "claris_schedule_overrides",
  "claris_other_funds_v1",
  "claris_forecast_dismissed_v1",
  "claris_registers_v1",
  "claris_liabilities_v1",
  "claris_screenshot_txs_v1",
  "claris_shot_audits_v1",
  "ic_expenses",
  "claris_toll_bills",
  "claris_finance_week_v1",
  "claris_custom_categories",
  "claris_credit_accounts_v1",
  "claris_shift_tolls_v1",
  "claris_receipts_v1",
] as const

type CloudDoc = { v: number; updated_at?: string; keys: Record<string, string> }

let started = false
/** Índice de la última foto conocida de la nube: por clave, la huella de
 *  cada item (para listas) y la huella del valor crudo. Se PERSISTE en
 *  localStorage (fuera de las claves de la nube) para que la fusión a
 *  tres bandas también funcione entre aperturas: sin índice persistido,
 *  cada arranque era un "primer contacto" sin memoria y un borrado
 *  hecho en la nube resucitaba desde la copia local vieja en cuanto el
 *  teléfono tocaba la misma lista por cualquier motivo (2026-11-01:
 *  la limpieza de datos rebotó TRES veces por esto).
 *  null = todavía no se ha cargado/hecho ningún índice. */
export type BaseIndex = Record<string, { raw: string; items?: Record<string, string> }>
let baseIdx: BaseIndex | null = null
const BASE_IDX_STORAGE_KEY = "claris_finance_baseidx_v2"
/** Hash de la copia local ya sincronizada (aplicada o subida). */
let lastLocalHash = ""
/** Esta sesión ya sincronizó datos con contenido. */
let hadDataThisSession = false
let pushTimer: number | null = null
let pushing = false
let tickCount = 0

function collectLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (const k of FINANCE_CLOUD_KEYS) {
      const v = localStorage.getItem(k)
      if (typeof v === "string") out[k] = v
    }
  } catch {}
  return out
}

function arrLen(raw: string | undefined): number {
  if (!raw) return 0
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p.length : 0
  } catch {
    return 0
  }
}

/** ¿El conjunto trae libro o recurrentes con al menos un item? */
function keysHaveData(keys: Record<string, string>): boolean {
  return arrLen(keys[FINANCE_LEDGER_KEY]) > 0 || arrLen(keys[FINANCE_SCHEDULES_KEY]) > 0
}

/** ¿Las claves del libro y de recurrentes desaparecieron del todo? (Reset total) */
function keysVanished(keys: Record<string, string>): boolean {
  return !(FINANCE_LEDGER_KEY in keys) && !(FINANCE_SCHEDULES_KEY in keys)
}

function hashOf(keys: Record<string, string>): string {
  const names = Object.keys(keys).sort()
  return hashText(names.map((n) => `${n}=${keys[n]}`).join("\n"))
}

/* ------------------------------------------------------------------ */
/* Fusión por clave                                                    */
/* ------------------------------------------------------------------ */

function itemIdentity(item: unknown): string | null {
  if (item && typeof item === "object") {
    const id = (item as { id?: unknown }).id
    if (typeof id === "string" && id) return "id:" + id
    if (typeof id === "number") return "id:" + String(id)
    try {
      return "json:" + JSON.stringify(item)
    } catch {
      return null
    }
  }
  if (typeof item === "string" || typeof item === "number") return "json:" + JSON.stringify(item)
  return null
}

/** Huella de un item (para saber si cambió contra la base). */
function itemHash(item: unknown): string {
  try {
    return hashText(JSON.stringify(item) ?? "")
  } catch {
    return ""
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

/** Lista de items de una clave, si el valor es una lista "por items":
 *  un arreglo directo, las entries de ic_expenses o las accounts del
 *  objeto de CREDIT. null si la clave no es de ese tipo. */
function itemsOfKey(key: string, value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (key === "ic_expenses" && isPlainObject(value) && Array.isArray(value.entries)) return value.entries as unknown[]
  if (isPlainObject(value) && Array.isArray(value.accounts)) return value.accounts as unknown[]
  return null
}

/** Construye el índice base de un documento: huella del valor crudo por
 *  clave y, para claves por items, la huella de cada item por id. */
export function indexKeys(keys: Record<string, string>): BaseIndex {
  const out: BaseIndex = {}
  for (const [name, raw] of Object.entries(keys)) {
    const entry: { raw: string; items?: Record<string, string> } = { raw: hashText(raw) }
    try {
      const items = itemsOfKey(name, JSON.parse(raw))
      if (items) {
        const map: Record<string, string> = {}
        let usable = true
        for (const it of items) {
          const id = itemIdentity(it)
          if (id === null) {
            usable = false
            break
          }
          map[id] = itemHash(it)
        }
        if (usable) entry.items = map
      }
    } catch {}
    out[name] = entry
  }
  return out
}

/** Fusión de listas A TRES BANDAS (base, local, nube) por identidad:
 *  - item que estaba en la base y falta en UN lado → ese lado lo BORRÓ:
 *    no entra, aunque el otro lado haya tocado la misma lista (antes la
 *    unión simple lo resucitaba: así volvían los duplicados borrados).
 *  - item nuevo en un lado → entra (agregado).
 *  - item en los dos lados: si solo uno lo cambió contra la base, manda
 *    ese; si lo cambiaron los dos, manda localWins (la nube en el primer
 *    contacto, lo local en sesiones ya sincronizadas).
 *  null si algún item no tiene identidad usable. */
function threeWayArrays(
  baseItems: Record<string, string> | undefined,
  localArr: unknown[],
  cloudArr: unknown[],
  localWins: boolean,
): unknown[] | null {
  const index = (arr: unknown[]) => {
    const map = new Map<string, unknown>()
    const order: string[] = []
    for (const it of arr) {
      const k = itemIdentity(it)
      if (k === null) return null
      if (!map.has(k)) order.push(k)
      map.set(k, it)
    }
    return { map, order }
  }
  const L = index(localArr)
  const C = index(cloudArr)
  if (!L || !C) return null
  const pick = (k: string): unknown => {
    const inB = baseItems ? k in baseItems : false
    const inL = L.map.has(k)
    const inC = C.map.has(k)
    if (inB && inL && inC) {
      const lChanged = itemHash(L.map.get(k)) !== baseItems![k]
      const cChanged = itemHash(C.map.get(k)) !== baseItems![k]
      if (lChanged && !cChanged) return L.map.get(k)
      if (cChanged && !lChanged) return C.map.get(k)
      if (lChanged && cChanged) return localWins ? L.map.get(k) : C.map.get(k)
      return L.map.get(k)
    }
    if (inB && inL && !inC) return undefined // borrado en la nube: se respeta
    if (inB && !inL && inC) return undefined // borrado local: se respeta
    if (inB) return undefined // borrado en los dos
    if (inL && inC) {
      // Agregado por los dos lados con el mismo id: gana según la regla.
      return JSON.stringify(L.map.get(k)) === JSON.stringify(C.map.get(k))
        ? L.map.get(k)
        : localWins
          ? L.map.get(k)
          : C.map.get(k)
    }
    if (inL) return L.map.get(k) // agregado local
    if (inC) return C.map.get(k) // agregado en la nube
    return undefined
  }
  const out: unknown[] = []
  const seen = new Set<string>()
  for (const k of [...L.order, ...C.order]) {
    if (seen.has(k)) continue
    seen.add(k)
    const v = pick(k)
    if (v !== undefined) out.push(v)
  }
  return out
}

/** Fusiona dos valores crudos de una misma clave usando la base.
 *  null = no fusionable (el llamador desempata). */
function mergeValues(
  key: string,
  localRaw: string,
  cloudRaw: string,
  baseEntry: { raw: string; items?: Record<string, string> } | undefined,
  localWins = true,
): string | null {
  let l: unknown
  let c: unknown
  try {
    l = JSON.parse(localRaw)
    c = JSON.parse(cloudRaw)
  } catch {
    return null
  }
  const baseItems = baseEntry?.items
  if (Array.isArray(l) && Array.isArray(c)) {
    const u = threeWayArrays(baseItems, l, c, localWins)
    return u ? JSON.stringify(u) : null
  }
  // ic_expenses es un objeto {version, savedAt, entries:[...]}: las
  // entries se fusionan a tres bandas y manda la envoltura local.
  if (key === "ic_expenses" && isPlainObject(l) && isPlainObject(c) && Array.isArray(l.entries) && Array.isArray(c.entries)) {
    const u = threeWayArrays(baseItems, l.entries as unknown[], c.entries as unknown[], localWins)
    if (!u) return null
    return JSON.stringify({ ...c, ...l, entries: u })
  }
  // Objeto con lista `accounts` (CREDIT): las cuentas se fusionan a
  // tres bandas; el resto de la envoltura manda lo local, como antes.
  if (isPlainObject(l) && isPlainObject(c) && Array.isArray(l.accounts) && Array.isArray(c.accounts)) {
    const u = threeWayArrays(baseItems, l.accounts as unknown[], c.accounts as unknown[], localWins)
    if (!u) return null
    return JSON.stringify({ ...c, ...l, accounts: u })
  }
  if (isPlainObject(l) && isPlainObject(c)) {
    return JSON.stringify({ ...c, ...l })
  }
  return null
}

/**
 * Fusiona tres fotos del documento usando el índice base persistido:
 * `base` (huellas de la última nube conocida), `local` (este teléfono)
 * y `cloud` (la nube ahora mismo). `preferCloudOnConflict` se usa en el
 * primer contacto (aún no hay índice confiable): en conflicto sin
 * fusión posible manda la nube, nunca la copia local.
 */
export function mergeKeys(
  base: BaseIndex,
  local: Record<string, string>,
  cloud: Record<string, string>,
  preferCloudOnConflict = false,
): Record<string, string> {
  const names = new Set<string>([...Object.keys(local), ...Object.keys(cloud)])
  const out: Record<string, string> = {}
  for (const name of names) {
    const b = base[name] as { raw: string; items?: Record<string, string> } | undefined
    const l = local[name] as string | undefined
    const c = cloud[name] as string | undefined
    if (l === c) {
      if (l !== undefined) out[name] = l
      continue
    }
    // Borrado de la clave entera en un lado: se respeta si el otro lado
    // no la cambió contra la base (misma huella cruda).
    if (l === undefined) {
      if (!(b && c !== undefined && hashText(c) === b.raw)) {
        if (c !== undefined && preferCloudOnConflict) out[name] = c
        else if (c !== undefined && !b) out[name] = c
      }
      continue
    }
    if (c === undefined) {
      if (!b) out[name] = l // la nube nunca la tuvo: es un alta local
      else if (hashText(l) !== b.raw && !preferCloudOnConflict) out[name] = l
      // si lo local no cambió y la nube la borró → se respeta el borrado
      continue
    }
    // Cambiaron los dos (o no había base): fusión por items si se puede.
    const merged = mergeValues(name, l, c, b, !preferCloudOnConflict)
    const winner = merged ?? (preferCloudOnConflict ? c : l)
    if (winner !== undefined) out[name] = winner
  }
  return out
}

function loadBaseIdx(): BaseIndex | null {
  try {
    const raw = localStorage.getItem(BASE_IDX_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BaseIndex
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function saveBaseIdx(idx: BaseIndex): void {
  try {
    localStorage.setItem(BASE_IDX_STORAGE_KEY, JSON.stringify(idx))
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Red                                                                 */
/* ------------------------------------------------------------------ */

/** Lee la nube. ok:false = la lectura FALLÓ (red/servidor): en ese caso
 *  NO se escribe nada. ok:true con keys {} = la nube está vacía. */
async function fetchCloud(): Promise<{ ok: true; keys: Record<string, string> } | { ok: false }> {
  try {
    const r = await fetch("/api/finance/state", { cache: "no-store" })
    if (!r.ok) return { ok: false }
    const j = await r.json()
    const doc = j?.doc as CloudDoc | null | undefined
    if (doc && typeof doc === "object" && doc.keys && typeof doc.keys === "object" && !Array.isArray(doc.keys)) {
      return { ok: true, keys: doc.keys }
    }
    if (doc == null) return { ok: true, keys: {} }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

async function postCloud(keys: Record<string, string>): Promise<boolean> {
  try {
    const r = await fetch("/api/finance/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc: { v: 1, keys } }),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Aplica el documento fusionado al localStorage: pone las claves del
 *  documento y QUITA las claves de la nube que ya no están en él, para
 *  que la copia local quede idéntica al documento. Devuelve si cambió. */
function applyMerged(keys: Record<string, string>): boolean {
  const before = hashOf(collectLocal())
  try {
    for (const k of FINANCE_CLOUD_KEYS) {
      if (k in keys) localStorage.setItem(k, keys[k])
      else localStorage.removeItem(k)
    }
  } catch {}
  return before !== hashOf(collectLocal())
}

/* ------------------------------------------------------------------ */
/* Ciclo de sincronización: bajar, fusionar, subir si hace falta       */
/* ------------------------------------------------------------------ */

async function syncNow() {
  if (pushing) return
  pushing = true
  try {
    const local = collectLocal()
    const res = await fetchCloud()
    // REGLA 1: sin lectura buena no se escribe nada. La copia local se
    // queda como está y el próximo ciclo lo reintenta.
    if (!res.ok) return
    const cloud = res.keys
    if (baseIdx === null) baseIdx = loadBaseIdx()
    const firstContact = baseIdx === null
    if (firstContact) baseIdx = {}

    // Reset total deliberado: en esta sesión ya hubo datos sincronizados
    // y las claves del libro desaparecieron del todo → limpiar la nube.
    if (keysVanished(local) && hadDataThisSession && keysHaveData(cloud)) {
      if (await postCloud({})) {
        baseIdx = {}
        saveBaseIdx(baseIdx)
        hadDataThisSession = false
        lastLocalHash = hashOf(collectLocal())
      }
      return
    }

    // PRIMER CONTACTO con datos en la nube (orden de Miguel, 2026-11-01:
    // "tienen que estar centralizados, siempre la misma información"):
    // manda la NUBE, tal cual. La copia local sin índice es un caché
    // viejo: fusionarla por unión resucitaba lo ya borrado en la nube.
    // Sin datos en la nube (arranque desde cero) sí se parte de lo local.
    const merged =
      firstContact && keysHaveData(cloud) ? cloud : mergeKeys(baseIdx, local, cloud, firstContact)

    // REGLA 3 (anti-vacío): si el fusionado pierde los datos que la nube
    // sí tiene, no se sube: se baja la nube y el teléfono se recupera.
    if (!keysHaveData(merged) && keysHaveData(cloud)) {
      const changed = applyMerged(cloud)
      baseIdx = indexKeys(cloud)
      saveBaseIdx(baseIdx)
      lastLocalHash = hashOf(collectLocal())
      hadDataThisSession = true
      if (changed) window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
      return
    }

    if (hashOf(merged) !== hashOf(cloud)) {
      if (!(await postCloud(merged))) return
    }
    baseIdx = indexKeys(merged)
    saveBaseIdx(baseIdx)
    const changed = applyMerged(merged)
    lastLocalHash = hashOf(collectLocal())
    if (keysHaveData(merged)) hadDataThisSession = true
    if (changed) window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } finally {
    pushing = false
  }
}

function schedulePush() {
  if (pushTimer) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void syncNow()
  }, 900)
}

/** Arranque (una sola vez, desde copiloto-app). */
export function startFinanceCloud() {
  if (started || typeof window === "undefined") return
  started = true

  void syncNow()

  // Write-through: al aviso de cambio de DINERO (con debounce)…
  window.addEventListener(FINANCE_SYNCED_EVENT, schedulePush)
  // …chequeo cada 20 s (sube enseguida si lo local cambió; cada ~60 s
  // también baja y fusiona lo que otro teléfono haya guardado)…
  window.setInterval(() => {
    tickCount++
    if (hashOf(collectLocal()) !== lastLocalHash || tickCount % 3 === 0) {
      void syncNow()
    }
  }, 20000)
  // …al volver a la app…
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow()
  })
  // …y al recuperar la conexión.
  window.addEventListener("online", () => {
    void syncNow()
  })
}
