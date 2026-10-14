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
//   COBROS (reconciliar)-> source "trip"        status projected  <- reemplaza
//
// La regla que lo mantiene honesto: "actual" solo con dinero confirmado. Una
// proyeccion nunca toca el saldo real. La pantalla ya separa los dos saldos.
//
// Los identificadores son DETERMINISTAS ("claris:gasto:<id>",
// "claris:cobro:<fecha>:<plataforma>"), asi que volver a pasar el mismo
// movimiento lo actualiza en vez de duplicarlo.
//
// REEMPLAZO desde Cobros: al reconciliar un dia, las proyecciones programadas
// (placeholder de $400/dia, etc.) de ese dia se sustituyen por el neto real
// verificado en Cobros. No se suman; se reemplazan.
// ============================================================================

import type { CashFlowEntry, Expense, Trip } from "./types"
import { netOf, tripDateOf } from "./types"

export const LEDGER_KEY = "claris_cash_flow_entries"

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
 * Id determinista de un cobro reconciliado por dia + plataforma.
 * Misma fecha + misma plataforma = misma fila -> reemplazo, no duplicado.
 */
export function idDeCobro(date: string, platform: string): string {
  const d = String(date || "").slice(0, 10)
  const p = String(platform || "Other")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
  return `claris:cobro:${d}:${p}`
}

/** Prefijo de todos los cobros de un dia (para localizar y limpiar). */
export function prefijoCobroDia(date: string): string {
  return `claris:cobro:${String(date || "").slice(0, 10)}:`
}

/**
 * Convierte un gasto en un movimiento del libro mayor.
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

/**
 * Proyeccion placeholder del dia (programada / diaria) que debe ceder el
 * puesto al neto real de Cobros. No borra cobros ya reconciliados ni actuals.
 */
export function esProyeccionPlaceholderDelDia(entry: CashFlowEntry, date: string): boolean {
  if (!entry || entry.status !== "projected") return false
  if (entry.type !== "income") return false
  if (String(entry.date || "").slice(0, 10) !== String(date).slice(0, 10)) return false
  if (String(entry.id).startsWith("claris:cobro:")) return false
  if (entry.source === "projection" || entry.source === "manual") return true
  return false
}

export type ResultadoReconciliacionCobros = {
  entries: CashFlowEntry[]
  platforms: number
  totalNet: number
  replacedPlaceholders: number
}

/**
 * RECONCILIAR Cobros -> Libro Mayor (proyecciones).
 *
 * - Agrupa viajes del dia por plataforma.
 * - Upsert proyeccion por plataforma (id determinista).
 * - Elimina placeholders del mismo dia ($400 programados, etc.).
 * - Nunca toca status "actual" (saldo real intacto).
 */
export function reconciliarCobrosAlLibro(
  trips: Trip[],
  date: string,
): ResultadoReconciliacionCobros {
  const dia = String(date || "").slice(0, 10)
  const delDia = (trips || []).filter((t) => tripDateOf(t) === dia)

  const porPlataforma = new Map<string, number>()
  for (const t of delDia) {
    const net = Math.round((netOf(t) || 0) * 100) / 100
    if (net <= 0) continue
    const p = String(t.platform || "Other")
    porPlataforma.set(p, Math.round(((porPlataforma.get(p) || 0) + net) * 100) / 100)
  }

  let lista = leerLibroMayor()

  const antes = lista.length
  lista = lista.filter((e) => !esProyeccionPlaceholderDelDia(e, dia))
  const replacedPlaceholders = antes - lista.length

  const ahora = new Date().toISOString()
  let totalNet = 0
  for (const [platform, amount] of porPlataforma) {
    totalNet += amount
    const count = delDia.filter((t) => String(t.platform) === platform).length
    const entry: CashFlowEntry = {
      id: idDeCobro(dia, platform),
      date: dia,
      description: `Cobro ${platform}`,
      source: "trip",
      sourceLabel: `Cobros · ${platform}`,
      type: "income",
      status: "projected",
      amount,
      category: "Ingresos",
      notes: `Reconciliado desde Cobros (${count} viajes)`,
      createdAt: ahora,
      isManuallyEdited: false,
    }
    lista = upsertMovimiento(lista, entry)
  }

  if (porPlataforma.size === 0) {
    const pref = prefijoCobroDia(dia)
    lista = lista.filter((e) => !String(e.id).startsWith(pref))
  }

  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(lista))
  } catch {
    // ignore
  }

  return {
    entries: lista,
    platforms: porPlataforma.size,
    totalNet: Math.round(totalNet * 100) / 100,
    replacedPlaceholders,
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
 */
export function guardarMovimiento(nuevo: CashFlowEntry): CashFlowEntry[] {
  const actual = leerLibroMayor()
  const next = upsertMovimiento(actual, nuevo)
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
  } catch {}
  return next
}
