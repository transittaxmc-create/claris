// ============================================================================
// LIBRO MAYOR (Cash Flow Register)
//
// Una sola lista de movimientos donde todo el dinero acaba junto, cada uno con
// su origen. Es la union de la informacion: no hay que juntar dos aplicaciones,
// hay que rellenar ESTA lista desde cada sitio.
//
//   HOY (viajes)        -> source "trip"        status actual
//   GASTOS              -> source "manual"      status actual
//   Escaner de recibos  -> source "receipt"     status actual
//   Peajes impagos      -> source "projection"  status projected
//   Extracto del banco  -> source "bank"        status actual
//
// La regla que lo mantiene honesto: "actual" solo con dinero confirmado. Una
// proyeccion nunca toca el saldo real. La pantalla ya separa los dos saldos.
//
// Los identificadores son DETERMINISTAS ("claris:gasto:<id>"), asi que volver a
// pasar el mismo movimiento lo actualiza en vez de duplicarlo.
// ============================================================================

import type { CashFlowEntry, Expense } from "./types"

export const LEDGER_KEY = "claris_cash_flow_entries"

// Las cuatro semillas de ejemplo que se plantaban solas al abrir el Libro Mayor.
// Dejaron de plantarse, pero quien ya las tenga guardadas las sigue viendo.
//
// Se reconocen por id EXACTO, nunca por prefijo: en la otra aplicacion, purgar
// por prefijo borro datos del usuario y le vacio los saldos. Aqui no se repite.
export const IDS_SEMILLA: ReadonlySet<string> = new Set(["seed-1", "seed-2", "seed-3", "seed-4"])

/** Quita las semillas de ejemplo. Pura: no toca el almacenamiento. */
export function sinSemillas(entries: CashFlowEntry[] | null | undefined): CashFlowEntry[] {
  if (!Array.isArray(entries)) return []
  return entries.filter((e) => e && !IDS_SEMILLA.has(String(e.id)))
}

/**
 * Mete un movimiento, o actualiza el que ya exista con ese id. Pura.
 * Es lo que impide el duplicado cuando el mismo movimiento se vuelve a pasar.
 */
export function upsertMovimiento(
  entries: CashFlowEntry[] | null | undefined,
  nuevo: CashFlowEntry,
): CashFlowEntry[] {
  const lista = Array.isArray(entries) ? entries : []
  const existe = lista.some((e) => e?.id === nuevo.id)
  return existe ? lista.map((e) => (e?.id === nuevo.id ? nuevo : e)) : [nuevo, ...lista]
}

/** El id determinista de un gasto dentro del libro. */
export function idDeGasto(expenseId: string): string {
  return `claris:gasto:${expenseId}`
}

/**
 * Convierte un gasto en un movimiento del libro mayor.
 * Un gasto escaneado es un recibo; uno escrito a mano es manual. Los dos son
 * dinero que ya salio, asi que van como "actual".
 */
export function movimientoDeGasto(e: Expense): CashFlowEntry {
  const escaneado = Boolean(e.isAiGenerated)
  return {
    id: idDeGasto(String(e.id)),
    date: String(e.date || "").slice(0, 10),
    description: e.vendor || "Gasto",
    source: escaneado ? "receipt" : "manual",
    sourceLabel: escaneado ? "Recibo escaneado" : "Gasto manual",
    type: "expense",
    status: "actual",
    amount: Math.round((Number(e.amount) || 0) * 100) / 100,
    category: e.category,
    notes: e.notes,
    createdAt: new Date().toISOString(),
  }
}

/** Lee el libro del almacenamiento, ya sin semillas. Nunca lanza. */
export function leerLibroMayor(): CashFlowEntry[] {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return []
    return sinSemillas(JSON.parse(raw))
  } catch {
    return []
  }
}

/**
 * Guarda un movimiento en el libro. Devuelve la lista resultante.
 * Deja el almacenamiento limpio de semillas de paso.
 */
export function guardarMovimiento(nuevo: CashFlowEntry): CashFlowEntry[] {
  const actual = leerLibroMayor()
  const next = upsertMovimiento(actual, nuevo)
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
  } catch {}
  return next
}
