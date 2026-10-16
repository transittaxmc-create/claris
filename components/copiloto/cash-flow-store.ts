// ============================================================================
// LIBRO MAYOR (Cash Flow Register)
// ============================================================================

import type { CashFlowEntry, CashFlowOrigin, Expense, Trip } from "./types"
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

// ---------------------------------------------------------------------------
// ORIGEN vs TIPO
//  - ORIGEN: cómo entró (Escaneado / Manual / Banco / Cobros). No cambia.
//  - TIPO:   Factura (Bill, por pagar → Projected) o Recibo (ya pagado → Bank).
// Son dos etiquetas separadas: antes una sola ("Recibo escaneado") las mezclaba.
// ---------------------------------------------------------------------------
export type TipoDoc = "factura" | "recibo"

export const ETIQUETA_ORIGEN: Record<CashFlowOrigin, string> = {
  scan: "Escaneado",
  manual: "Manual",
  bank: "Banco",
  trip: "Cobros",
}

export const ETIQUETA_TIPO: Record<TipoDoc, string> = {
  factura: "Factura",
  recibo: "Recibo",
}

export function etiquetaCombinada(origin: CashFlowOrigin, tipo: TipoDoc | null): string {
  return tipo ? `${ETIQUETA_ORIGEN[origin]} · ${ETIQUETA_TIPO[tipo]}` : ETIQUETA_ORIGEN[origin]
}

/** Origen de un movimiento; entiende los guardados con etiquetas viejas. */
export function origenDe(e: CashFlowEntry): CashFlowOrigin {
  if (e.origin) return e.origin
  if (/escane|scan/i.test(String(e.sourceLabel || ""))) return "scan"
  if (e.source === "bank") return "bank"
  if (e.source === "trip") return "trip"
  return "manual"
}

/**
 * Tipo Factura/Recibo. Sale del ESTADO, que es lo que decide dónde suma o resta:
 * proyectado = Factura (por pagar), posteado = Recibo (ya pagado).
 * Solo aplica a gastos que no vienen del banco ni de Cobros.
 */
export function tipoDocDe(e: CashFlowEntry): TipoDoc | null {
  if (e.type !== "expense") return null
  const o = origenDe(e)
  if (o === "bank" || o === "trip") return null
  return e.status === "projected" ? "factura" : "recibo"
}

/** Sugerencia al clasificar un documento nuevo (se puede cambiar). */
export function sugerirTipoDoc(vendor?: string, notes?: string): TipoDoc | null {
  const txt = `${vendor || ""} ${notes || ""}`.toLowerCase()
  if (!txt.trim()) return null
  if (/(e-?z-?pass|easy ?pass|sun ?pass|toll|peaje|invoice|factura|amount due|balance due|statement|lease|violation|due date|pay by|vencimiento|tower)/.test(txt)) {
    return "factura"
  }
  return null
}

/**
 * Arregla lo ya guardado sin perder nada: asigna el origen que faltaba y
 * reemplaza etiquetas viejas ("Recibo escaneado", "Bill", "Receipt"...) por
 * "Origen · Tipo". Devuelve si cambió algo para guardar solo cuando hace falta.
 */
export function normalizarLibro(entries: CashFlowEntry[]): { lista: CashFlowEntry[]; cambio: boolean } {
  let cambio = false
  const lista = entries.map((e) => {
    if (!e) return e
    const origin = origenDe(e)
    const label = etiquetaCombinada(origin, tipoDocDe({ ...e, origin }))
    // Solo se tocan las que usan etiquetas del sistema; un texto propio se respeta.
    const esDelSistema =
      !e.sourceLabel || /escane|scan|^(bill|receipt|manual|gasto manual|factura|recibo|bank|banco)$/i.test(String(e.sourceLabel).trim())
    if (e.origin === origin && (!esDelSistema || e.sourceLabel === label)) return e
    cambio = true
    return { ...e, origin, ...(esDelSistema ? { sourceLabel: label } : {}) }
  })
  return { lista, cambio }
}

/** Maps expense → ledger: Factura = proyectado por pagar; Recibo = posteado pagado. */
export function movimientoDeGasto(e: Expense): CashFlowEntry {
  const doc = e.docType
  // Lo que el usuario eligió manda; "scheduled" solo decide si no hay elección.
  const esFactura = doc === "factura" || (doc !== "recibo" && Boolean(e.scheduled))
  const esRecibo = !esFactura && (doc === "recibo" || (!doc && Boolean(e.isAiGenerated)))
  const escaneado = Boolean(e.scanned) || Boolean(e.isAiGenerated) || e.confidence != null
  const origin: CashFlowOrigin = escaneado ? "scan" : "manual"
  const source = esRecibo ? "receipt" : esFactura ? "projection" : "manual"
  const tipo: TipoDoc = esFactura ? "factura" : "recibo"
  return {
    id: idDeGasto(String(e.id)),
    date: String(e.date || "").slice(0, 10),
    description: e.vendor || "Expense",
    source: source as CashFlowEntry["source"],
    sourceLabel: etiquetaCombinada(origin, tipo),
    origin,
    type: "expense",
    status: esFactura ? "projected" : "actual",
    amount: Math.round((Number(e.amount) || 0) * 100) / 100,
    category: e.category,
    classification:
      e.classification === "personal" ? "personal" : e.classification === "business" ? "business" : undefined,
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
      category: "Income",
      notes: `Reconciled from Cobros (${count} trips)`,
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
