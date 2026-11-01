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
//     última foto conocida de la nube ("base"):
//       - cambió solo aquí  → manda lo local
//       - cambió solo allá  → manda lo de la nube
//       - cambiaron los dos la misma clave → se unen los items por id
//         (listas: libro, recurrentes, gastos, bills, peajes, etc.)
//     Un borrado hecho en un solo lado SÍ se respeta (el otro lado no
//     cambió esa clave), así que borrar sigue funcionando.
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
/** Última foto conocida de la nube (de una lectura buena o de una subida
 *  confirmada). null = esta sesión aún no ha leído la nube. */
let baseKeys: Record<string, string> | null = null
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

/** Une dos listas por identidad de item. En el mismo id manda el local,
 *  salvo en el primer contacto de la sesión (localWins=false), donde
 *  manda la nube: la copia local puede venir vieja de una sesión
 *  anterior y no debe pisar una edición más nueva ya guardada.
 *  Orden: primero los items en el orden local; los que solo están en la
 *  nube se agregan al final en su orden. null si algún item no tiene
 *  identidad usable (el llamador decide el desempate). */
function unionArrays(localArr: unknown[], cloudArr: unknown[], localWins = true): unknown[] | null {
  const byKey = new Map<string, unknown>()
  const cloudOrder: string[] = []
  for (const it of cloudArr) {
    const k = itemIdentity(it)
    if (k === null) return null
    if (!byKey.has(k)) cloudOrder.push(k)
    byKey.set(k, it)
  }
  const localOrder: string[] = []
  for (const it of localArr) {
    const k = itemIdentity(it)
    if (k === null) return null
    if (!localOrder.includes(k)) localOrder.push(k)
    if (localWins || !cloudOrder.includes(k)) byKey.set(k, it)
  }
  const seen = new Set<string>()
  const out: unknown[] = []
  for (const k of [...localOrder, ...cloudOrder]) {
    if (seen.has(k)) continue
    seen.add(k)
    out.push(byKey.get(k))
  }
  return out
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

/** Fusiona dos valores crudos de una misma clave. null = no fusionable. */
function mergeValues(key: string, localRaw: string, cloudRaw: string, localWins = true): string | null {
  let l: unknown
  let c: unknown
  try {
    l = JSON.parse(localRaw)
    c = JSON.parse(cloudRaw)
  } catch {
    return null
  }
  if (Array.isArray(l) && Array.isArray(c)) {
    const u = unionArrays(l, c, localWins)
    return u ? JSON.stringify(u) : null
  }
  // ic_expenses es un objeto {version, savedAt, entries:[...]}: se unen
  // las entradas por id y manda la envoltura local.
  if (key === "ic_expenses" && isPlainObject(l) && isPlainObject(c) && Array.isArray(l.entries) && Array.isArray(c.entries)) {
    const u = unionArrays(l.entries as unknown[], c.entries as unknown[], localWins)
    if (!u) return null
    return JSON.stringify({ ...c, ...l, entries: u })
  }
  if (isPlainObject(l) && isPlainObject(c)) {
    return JSON.stringify({ ...c, ...l })
  }
  return null
}

/**
 * Fusiona tres fotos del documento: `base` (última nube conocida),
 * `local` (este teléfono) y `cloud` (la nube ahora mismo).
 * `preferCloudOnConflict` se usa en el primer contacto de la sesión,
 * cuando aún no hay base confiable: en conflicto sin fusión posible
 * manda la nube, nunca la copia local.
 */
export function mergeKeys(
  base: Record<string, string>,
  local: Record<string, string>,
  cloud: Record<string, string>,
  preferCloudOnConflict = false,
): Record<string, string> {
  const names = new Set<string>([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)])
  const out: Record<string, string> = {}
  for (const name of names) {
    const b = base[name] as string | undefined
    const l = local[name] as string | undefined
    const c = cloud[name] as string | undefined
    if (l === c) {
      if (l !== undefined) out[name] = l
      continue
    }
    if (l === b) {
      // Solo cambió la nube (incluye borrado allá)
      if (c !== undefined) out[name] = c
      continue
    }
    if (c === b) {
      // Solo cambió lo local (incluye borrado aquí)
      if (l !== undefined) out[name] = l
      continue
    }
    // Cambiaron los dos (o no había base): unir por items si se puede.
    const merged = l !== undefined && c !== undefined ? mergeValues(name, l, c, !preferCloudOnConflict) : null
    const winner = merged ?? (preferCloudOnConflict ? (c ?? l) : (l ?? c))
    if (winner !== undefined) out[name] = winner
  }
  return out
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
    const firstContact = baseKeys === null
    // Primer contacto: base vacía → todo se resuelve por unión de items
    // (nada se pierde de ningún lado) y en conflicto manda la nube.
    const base = firstContact ? {} : (baseKeys as Record<string, string>)

    // Reset total deliberado: en esta sesión ya hubo datos sincronizados
    // y las claves del libro desaparecieron del todo → limpiar la nube.
    if (keysVanished(local) && hadDataThisSession && keysHaveData(cloud)) {
      if (await postCloud({})) {
        baseKeys = {}
        hadDataThisSession = false
        lastLocalHash = hashOf(collectLocal())
      }
      return
    }

    const merged = mergeKeys(base, local, cloud, firstContact)

    // REGLA 3 (anti-vacío): si el fusionado pierde los datos que la nube
    // sí tiene, no se sube: se baja la nube y el teléfono se recupera.
    if (!keysHaveData(merged) && keysHaveData(cloud)) {
      const changed = applyMerged(cloud)
      baseKeys = cloud
      lastLocalHash = hashOf(collectLocal())
      hadDataThisSession = true
      if (changed) window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
      return
    }

    if (hashOf(merged) !== hashOf(cloud)) {
      if (!(await postCloud(merged))) return
    }
    baseKeys = merged
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
