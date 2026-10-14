// ============================================================================
// LIBRO MAYOR (Cash Flow Register)
// ============================================================================

import type { CashFlowEntry, Expense, Trip } from "./types"
import { netOf, tripDateOf } from "./types"

export const LEDGER_KEY = "claris_cash_flow_entries"

export const IDS_SEMILLA: ReadonlySet<string> = new Set(["seed-1", "seed-2", "seed-3", "seed-4"])

export function sinSemillas(entries: CashFlowEntry[] | null | undefined): CashFlowEntry[] {
  if (!Array.isArray(entries)) return []
  return entries.filter((e) => e && !IDS_SEMILLA.has(String(e.id)))
}

export function upsertMovimiento(
  entries: CashFlowEntry[] | null | undefined,
  nuevo: CashFlowEntry,
): CashFlowEntry[] {
  const lista = Array.isArray(entries) ? entries : []
  const existe = lista.some((e) => e?.id === nuevo.id)
  return existe ? lista.map((e) => (e?.id === nuevo.id ? nuevo : e)) : [nuevo, ...lista]
}

export function idDeGasto(expenseId: string): string {
  return `claris:gasto:${expenseId}`
}

export function idDeCobro(date: string, platform: string): string {
  const d = String(date || "").slice(0, 10)
  const p = String(platform || "Other")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
  return `claris:cobro:${d}:${p}`
}

export function prefijoCobroDia(date: string): string {
  return `claris:cobro:${String(date || "").slice(0, 10)}:`
}

/** Convierte un gasto en movimiento del libro según docType. */
export function movimientoDeGasto(e: Expense): CashFlowEntry {
  const doc = e.docType
  const esFactura = doc === "factura" || Boolean(e.scheduled)
  const esRecibo = doc === "recibo" || (!doc && Boolean(e.isAiGenerated))
  const source = esRecibo ? "receipt" : esFactura ? "projection" : "manual"
  const sourceLabel = esFactura ? "Factura" : esRecibo ? "Recibo" : "Manual"
  return {
    id: idDeGasto(String(e.id)),
    date: String(e.date || "").slice(0, 10),
    description: e.vendor || "Gasto",
    source: source as CashFlowEntry["source"],
    sourceLabel,
    type: "expense",
    status: esFactura ? "projected" : "actual",
    amount: Math.round((Number(e.amount) || 0) * 100) / 100,
    category: e.category,
    notes: e.notes,
    createdAt: new Date().toISOString(),
  }
}

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
  } catch {}

  return {
    entries: lista,
    platforms: porPlataforma.size,
    totalNet: Math.round(totalNet * 100) / 100,
    replacedPlaceholders,
  }
}

export function leerLibroMayor(): CashFlowEntry[] {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return []
    return sinSemillas(JSON.parse(raw))
  } catch {
    return []
  }
}

export function guardarMovimiento(nuevo: CashFlowEntry): CashFlowEntry[] {
  const actual = leerLibroMayor()
  const next = upsertMovimiento(actual, nuevo)
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
  } catch {}
  return next
}
