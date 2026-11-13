"use client"

// RESPALDO COMPLETO PARA CAMBIAR DE TELÉFONO (Miguel, 2026-11-13).
//
// Nuevo modelo de datos: el localStorage de ESTE teléfono es la única
// fuente de verdad (Supabase quedó apagado — ver finance-cloud.ts).
// Para pasar a otro teléfono hay dos botones en DATA → BACKUP:
//
//   SUBIR     → crea UN archivo JSON con TODOS los datos de la app
//               (cada clave claris_/ic_ de localStorage + los viajes
//               de IndexedDB) y lo descarga; Miguel lo guarda en su
//               carpeta de Google Drive.
//   RESTAURAR → en el otro teléfono, elige ese archivo desde Drive,
//               ve la fecha y los conteos, confirma, y este teléfono
//               queda con los datos del respaldo (se recarga la app).
//
// El archivo es deliberadamente simple y completo: nada de fusiones.
// Restaurar REEMPLAZA lo que haya en el teléfono que restaura.

import {
  entryToTrip,
  loadExpenses,
  loadTrips,
  loadTripsFromIndexedDB,
  saveExpensesToIndexedDB,
  saveTrips,
  saveTripsToIndexedDB,
  tripToEntry,
} from "./storage"
import { FINANCE_LEDGER_KEY } from "./finance-sync"

/** Marca del archivo: RESTAURAR solo acepta archivos con esta marca. */
export const BACKUP_APP_MARKER = "copiloto"
export const BACKUP_VERSION = 1

export type FullBackup = {
  app: string
  version: number
  exportedAt: string
  /** Valor crudo (string) de cada clave de localStorage de la app. */
  keys: Record<string, string>
  /** Viajes en su formato de entrada crudo (el mismo de ic_tip_tracker). */
  trips: Record<string, any>[]
}

export type BackupCounts = { entries: number; expenses: number; trips: number }

/** ¿La clave pertenece a la app? (prefijos claris_/claris-/ic_/ic-). */
export function isAppKey(key: string): boolean {
  return (
    key.startsWith("claris_") || key.startsWith("claris-") || key.startsWith("ic_") || key.startsWith("ic-")
  )
}

/** Junta TODAS las claves de la app que hoy están en localStorage. */
export function collectAppKeys(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k || !isAppKey(k)) continue
      const v = localStorage.getItem(k)
      if (typeof v === "string") out[k] = v
    }
  } catch {}
  return out
}

/** Arma el respaldo completo: claves + viajes de IndexedDB. */
export async function buildFullBackup(): Promise<FullBackup> {
  const keys = collectAppKeys()
  // Los viajes viven en IndexedDB (copia permanente); si esa lectura
  // falla, se cae a la copia de localStorage antes que perderlos.
  let trips = await loadTripsFromIndexedDB().catch(() => null)
  if (!trips) trips = loadTrips() ?? []
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    keys,
    trips: trips.map((t) => tripToEntry(t)),
  }
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

/** Conteos que se enseñan al confirmar un RESTAURAR. */
export function backupCounts(doc: FullBackup): BackupCounts {
  let expenses = 0
  try {
    const raw = doc.keys["ic_expenses"]
    const p = raw ? JSON.parse(raw) : null
    if (Array.isArray(p?.entries)) expenses = p.entries.length
  } catch {}
  return {
    entries: arrLen(doc.keys[FINANCE_LEDGER_KEY]),
    expenses,
    trips: Array.isArray(doc.trips) ? doc.trips.length : 0,
  }
}

/** Lee y VALIDA el texto de un archivo de respaldo. null = no sirve:
 *  RESTAURAR no toca nada si el archivo no pasa esta validación. */
export function parseFullBackup(text: string): FullBackup | null {
  let doc: any
  try {
    doc = JSON.parse(text)
  } catch {
    return null
  }
  if (!doc || typeof doc !== "object") return null
  if (doc.app !== BACKUP_APP_MARKER) return null
  if (!doc.keys || typeof doc.keys !== "object" || Array.isArray(doc.keys)) return null
  if (!Array.isArray(doc.trips)) return null
  if (typeof doc.exportedAt !== "string" || !doc.exportedAt) return null
  const keys: Record<string, string> = {}
  for (const [k, v] of Object.entries(doc.keys as Record<string, unknown>)) {
    if (typeof v !== "string") return null
    keys[k] = v
  }
  // Tiene que traer datos de verdad de la app, no un objeto vacío.
  if (!Object.keys(keys).some((k) => isAppKey(k))) return null
  return {
    app: BACKUP_APP_MARKER,
    version: typeof doc.version === "number" ? doc.version : BACKUP_VERSION,
    exportedAt: doc.exportedAt,
    keys,
    trips: doc.trips.filter((t: unknown) => !!t && typeof t === "object") as Record<string, any>[],
  }
}

/** Aplica el respaldo: este teléfono queda como ESPEJO del archivo.
 *  - localStorage: fuera las claves de la app que el respaldo no trae,
 *    y adentro todas las del respaldo.
 *  - Viajes: a localStorage (saveTrips) y a IndexedDB.
 *  - Gastos: su copia de IndexedDB se reconstruye desde ic_expenses. */
export async function applyFullBackup(doc: FullBackup): Promise<void> {
  const keep = new Set(Object.keys(doc.keys))
  try {
    const actuales: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k) actuales.push(k)
    }
    for (const k of actuales) {
      if (isAppKey(k) && !keep.has(k)) localStorage.removeItem(k)
    }
    for (const [k, v] of Object.entries(doc.keys)) {
      localStorage.setItem(k, v)
    }
  } catch {}
  const trips = doc.trips.map((e) => entryToTrip(e))
  saveTrips(trips)
  await saveTripsToIndexedDB(trips).catch(() => {})
  const expenses = loadExpenses()
  if (expenses) await saveExpensesToIndexedDB(expenses).catch(() => {})
}

/** Nombre del archivo: copiloto-respaldo-YYYY-MM-DD.json */
export function backupFileName(doc: FullBackup): string {
  const d = new Date(doc.exportedAt)
  const pad = (n: number) => String(n).padStart(2, "0")
  const fecha = Number.isNaN(d.getTime())
    ? "sin-fecha"
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `copiloto-respaldo-${fecha}.json`
}

/** Descarga el respaldo como archivo (para guardarlo en Google Drive). */
export function downloadFullBackup(doc: FullBackup): void {
  const blob = new Blob([JSON.stringify(doc)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = backupFileName(doc)
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}
