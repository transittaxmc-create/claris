"use client"

// Proyecciones ↔ Supabase (orden de Miguel, 2026-10-26): "los datos se
// supone que estén en Supabase — no importa en cuál teléfono lo abra".
//
// El register del banco YA vive en Supabase (app_state id='register');
// los datos de DINERO/Proyecciones vivían solo en el localStorage del
// teléfono y su sync cifrado por código no escribía desde septiembre.
// Este módulo es el puente directo, sin código ni llaves en el teléfono:
//
//   - Al abrir la app: si la nube (app_state id='finance', vía
//     /api/finance/state) tiene datos, esos mandan y se aplican al
//     localStorage local + se avisa con FINANCE_SYNCED_EVENT (las
//     pantallas de DINERO ya recargan con ese evento).
//   - Si la nube está vacía y ESTE teléfono sí tiene datos, se siembra
//     la nube con la copia local.
//   - Cada cambio local se sube solo (evento + chequeo por hash cada
//     20 s, para atrapar escrituras que no avisan).
//   - GUARDA ANTI-VACÍO: una copia sin libro ni recurrentes NUNCA
//     sobrescribe una nube con datos. La única excepción es el Reset
//     total hecho en ESTA sesión (las claves desaparecen del todo y la
//     sesión ya había sincronizado datos): ahí sí se limpia la nube,
//     igual que resetAll ya borraba el documento de sync.
//
// El localStorage queda como caché local: la app sigue funcionando
// sin conexión y la nube se pone al día en cuanto vuelve.

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
] as const

type CloudDoc = { v: number; updated_at?: string; keys: Record<string, string> }

let started = false
/** Hash del último estado conocido bueno (bajado de la nube o subido). */
let lastHash = ""
/** La nube guarda datos (libro o recurrentes no vacíos). */
let cloudHasData = false
/** Esta sesión ya cargó o subió datos con contenido. */
let hadDataThisSession = false
let pushTimer: number | null = null
let pushing = false

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

function applyKeys(keys: Record<string, string>) {
  try {
    for (const k of FINANCE_CLOUD_KEYS) {
      const v = keys[k]
      if (typeof v === "string") localStorage.setItem(k, v)
    }
  } catch {}
}

async function fetchCloud(): Promise<CloudDoc | null> {
  try {
    const r = await fetch("/api/finance/state", { cache: "no-store" })
    if (!r.ok) return null
    const j = await r.json()
    const doc = j?.doc
    if (doc && typeof doc === "object" && doc.keys && typeof doc.keys === "object" && !Array.isArray(doc.keys)) {
      return doc as CloudDoc
    }
    return null
  } catch {
    return null
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

async function pushNow() {
  if (pushing) return
  const keys = collectLocal()
  const h = hashOf(keys)
  if (h === lastHash) return

  // Reset total en esta sesión: las claves desaparecieron y la sesión
  // ya tenía datos sincronizados → limpiar también la nube.
  if (keysVanished(keys)) {
    if (!hadDataThisSession) {
      lastHash = h
      return
    }
    pushing = true
    try {
      if (await postCloud({})) {
        cloudHasData = false
        hadDataThisSession = false
        lastHash = hashOf({})
      }
    } finally {
      pushing = false
    }
    return
  }

  // Guarda anti-vacío: sin libro ni recurrentes no se sube nada si la
  // nube ya tiene datos; y si nadie tiene datos, no hay nada que subir.
  if (!keysHaveData(keys)) {
    lastHash = h
    return
  }

  pushing = true
  try {
    if (await postCloud(keys)) {
      lastHash = h
      cloudHasData = true
      hadDataThisSession = true
    }
  } finally {
    pushing = false
  }
}

function schedulePush() {
  if (pushTimer) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void pushNow()
  }, 900)
}

/** Arranque (una sola vez, desde copiloto-app): bajar o sembrar. */
export function startFinanceCloud() {
  if (started || typeof window === "undefined") return
  started = true

  void (async () => {
    const localBefore = hashOf(collectLocal())
    const cloud = await fetchCloud()
    if (cloud && keysHaveData(cloud.keys)) {
      // Si el usuario guardó algo mientras bajaba la nube, NO pisarlo
      // con la foto anterior: manda lo local y se sube enseguida.
      if (hashOf(collectLocal()) !== localBefore) {
        lastHash = ""
        return
      }
      cloudHasData = true
      hadDataThisSession = true
      applyKeys(cloud.keys)
      lastHash = hashOf(collectLocal())
      window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
      return
    }
    // Nube vacía: sembrar SOLO si este teléfono sí tiene datos.
    const local = collectLocal()
    if (keysHaveData(local)) {
      lastHash = ""
      await pushNow()
    } else {
      lastHash = hashOf(local)
    }
  })()

  // Write-through: al aviso de cambio de DINERO (con debounce) y un
  // chequeo por hash cada 20 s para escrituras que no avisan.
  window.addEventListener(FINANCE_SYNCED_EVENT, schedulePush)
  window.setInterval(() => {
    void pushNow()
  }, 20000)

  // Al volver a la app: si no hay cambios locales pendientes y la nube
  // trae otra cosa (otro teléfono guardó), bajarla.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    void (async () => {
      const local = collectLocal()
      if (hashOf(local) !== lastHash) {
        schedulePush()
        return
      }
      const cloud = await fetchCloud()
      if (cloud && keysHaveData(cloud.keys) && hashOf(cloud.keys) !== lastHash) {
        // Igual que al abrir: si lo local cambió durante la bajada, no pisar.
        if (hashOf(collectLocal()) !== lastHash) {
          schedulePush()
          return
        }
        cloudHasData = true
        hadDataThisSession = true
        applyKeys(cloud.keys)
        lastHash = hashOf(collectLocal())
        window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
      }
    })()
  })
}
