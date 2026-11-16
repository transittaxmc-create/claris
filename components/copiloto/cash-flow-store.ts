// ============================================================================
// LIBRO MAYOR (Cash Flow Register)
// ============================================================================

import type { CashFlowEntry, CashFlowOrigin, Expense, Trip, ScheduledEntry, ScheduleOverride } from "./types"
import { netOf, tripDateOf, migrateCategory } from "./types"
import { FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./finance-sync"
import { SCHEDULE_OVERRIDES_KEY, isRealIsoDate } from "./dinero-forecast"

export const LEDGER_KEY = "claris_cash_flow_entries"

export const IDS_SEMILLA: ReadonlySet<string> = new Set(["seed-1", "seed-2", "seed-3", "seed-4"])

export function sinSemillas(entries: CashFlowEntry[] | null | undefined): CashFlowEntry[] {
  if (!Array.isArray(entries)) return []
  return entries.filter((e) => e && !IDS_SEMILLA.has(String(e.id)))
}

/** ¿La entrada del libro es válida para guardarse? (R13, 2026-11-15):
 *  monto finito MAYOR que $0, fecha ISO válida Y REAL (2026-02-30 no
 *  existe) y descripción no vacía. Lo inválido se RECHAZA — nunca se
 *  "arregla" un número en silencio. La usa upsertMovimiento (toda
 *  escritura del libro pasa por ahí) y parseFullBackup (RESTAURAR). */
export function isValidLedgerEntry(e: unknown): e is CashFlowEntry {
  if (!e || typeof e !== "object") return false
  const entry = e as CashFlowEntry
  const amount = Number(entry.amount)
  if (!Number.isFinite(amount) || !(amount > 0)) return false
  if (!isRealIsoDate(entry.date)) return false
  if (!String(entry.description || "").trim()) return false
  return true
}

export function upsertMovimiento(
  entries: CashFlowEntry[] | null | undefined,
  nuevo: CashFlowEntry,
): CashFlowEntry[] {
  const lista = Array.isArray(entries) ? entries : []
  // R13: una entrada inválida no entra al libro — se devuelve la lista
  // tal cual, sin escribir nada.
  if (!isValidLedgerEntry(nuevo)) return lista
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
// LÁPIDA DE COBROS BORRADOS (2026-11-15)
//  - Cuando Miguel borra un cobro claris:cobro:{fecha}:{plataforma} en MONEY
//    (editor de la fila o Delete del register), se guarda la marca aquí.
//  - La reconciliación AUTOMÁTICA nunca regenera un cobro con lápida: el
//    auto corre para hoy y para días con cobros vivos, pero salta la
//    plataforma marcada. Un día con TODOS sus cobros borrados ni siquiera
//    entra en fechasReconciliacionAuto (no hay cobro proyectado vivo).
//  - Solo el botón explícito "Update receivables → Money" de ese día limpia
//    la lápida y lo regenera (regla suya, 2026-11-15: "si duplica, la borro
//    yo"). El CHECK no es borrado: no pone lápida. Tampoco la pone el
//    macheo con el banco (aplicarPagado marca actual, no borra) ni el
//    "Remove all projected" (que deja los cobros).
//  - Viaja en SUBIR/RESTAURAR (clave claris_*, la barre collectAppKeys) y
//    en el sync explícito de finanzas (FINANCE_BLOB_KEYS, como la marca
//    de checks) — si no viajara, el otro teléfono lo reviviría.
// ---------------------------------------------------------------------------
export const COBRO_DELETED_KEY = "claris_cobro_deleted_v1"
/** Cobro id → fecha ISO en que se borró. */
export type CobrosBorrados = Record<string, string>

export function leerCobrosBorrados(): CobrosBorrados {
  try {
    const raw = localStorage.getItem(COBRO_DELETED_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw)
    return v && typeof v === "object" && !Array.isArray(v) ? (v as CobrosBorrados) : {}
  } catch {
    return {}
  }
}

function guardarCobrosBorrados(mapa: CobrosBorrados): void {
  try {
    localStorage.setItem(COBRO_DELETED_KEY, JSON.stringify(mapa))
  } catch {}
}

/** Marca un cobro como borrado por el usuario (solo ids claris:cobro:*). */
export function marcarCobroBorrado(cobroId: string): void {
  const id = String(cobroId || "")
  if (!id.startsWith("claris:cobro:")) return
  const mapa = leerCobrosBorrados()
  mapa[id] = new Date().toISOString()
  guardarCobrosBorrados(mapa)
}

export function quitarMarcaCobroBorrado(cobroId: string): void {
  const mapa = leerCobrosBorrados()
  if (String(cobroId || "") in mapa) {
    delete mapa[String(cobroId)]
    guardarCobrosBorrados(mapa)
  }
}

/** Limpia las lápidas de TODAS las plataformas de un día (solo el botón). */
export function limpiarMarcasCobroBorradoDia(dia: string): void {
  const pref = `claris:cobro:${String(dia || "").slice(0, 10)}:`
  const mapa = leerCobrosBorrados()
  let cambio = false
  for (const k of Object.keys(mapa)) {
    if (k.startsWith(pref)) {
      delete mapa[k]
      cambio = true
    }
  }
  if (cambio) guardarCobrosBorrados(mapa)
}

export function esCobroBorrado(cobroId: string): boolean {
  return String(cobroId || "") in leerCobrosBorrados()
}

// ---------------------------------------------------------------------------
// ORIGEN vs TYPE
//  - ORIGEN: cómo entró (Escaneado / Manual / Bank / Cobros). No cambia.
//  - TYPE:   Bill (Bill, payable → Projected) o Receipt (already paid → Bank).
// Son dos etiquetas separadas: antes una sola ("Receipt escaneado") las mezclaba.
// ---------------------------------------------------------------------------
export type TipoDoc = "factura" | "recibo"

export const ETIQUETA_ORIGEN: Record<CashFlowOrigin, string> = {
  scan: "Escaneado",
  manual: "Manual",
  bank: "Bank",
  trip: "Receivables",
  square: "Square",
  transfer: "Internal transfer",
}

export const ETIQUETA_TIPO: Record<TipoDoc, string> = {
  factura: "Bill",
  recibo: "Receipt",
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
  // R11 (2026-11-15): las entradas MANUALES nunca son placeholders del
  // sistema — el filtro viejo las borraba porque también llevan
  // source "projection". Se distinguen por id (manual-*) y por origen
  // real (origenDe): solo lo que NO es manual puede ser placeholder.
  if (String(entry.id).startsWith("manual-")) return false
  if (origenDe(entry) === "manual") return false
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
  opts?: { explicit?: boolean },
): ResultadoReconciliacionCobros {
  const dia = String(date || "").slice(0, 10)
  // Solo el botón explícito limpia las lápidas del día: el auto nunca
  // regenera un cobro que Miguel borró (2026-11-15).
  if (opts?.explicit) limpiarMarcasCobroBorradoDia(dia)
  const delDia = (trips || []).filter((t) => tripDateOf(t) === dia)

  const porPlataforma = new Map<string, number>()
  for (const t of delDia) {
    const net = Math.round((netOf(t) || 0) * 100) / 100
    if (net <= 0) continue
    const p = String(t.platform || "Other")
    porPlataforma.set(p, Math.round(((porPlataforma.get(p) || 0) + net) * 100) / 100)
  }

  // Lápida (2026-11-15): las plataformas borradas por Miguel no se
  // regeneran en el auto. Sus líneas tampoco quedan en idsCobroNuevos,
  // así que el filtro de abajo las saca si alguna quedara colgada.
  const borrados = leerCobrosBorrados()
  const porPlataformaViva = new Map<string, number>()
  for (const [p, amount] of porPlataforma) {
    if (borrados[idDeCobro(dia, p)]) continue
    porPlataformaViva.set(p, amount)
  }

  let lista = leerLibroMayor()

  const antes = lista.length
  lista = lista.filter((e) => !esProyeccionPlaceholderDelDia(e, dia))
  const replacedPlaceholders = antes - lista.length

  // Regla de Miguel (2026-11-02): reconciliar REEMPLAZA los cobros del día.
  // Toda línea claris:cobro:{día}:* cuya plataforma ya no está en el conjunto
  // nuevo SALE del libro: modificar en Earnings y re-reconciliar modifica la
  // línea de esa plataforma — nunca deja una línea vieja ni añade una
  // duplicada. Una línea nueva solo nace de otra plataforma o de una entrada
  // manual (ids manual-*, que este filtro no toca).
  const prefCobro = prefijoCobroDia(dia)
  const idsCobroNuevos = new Set([...porPlataformaViva.keys()].map((p) => idDeCobro(dia, p)))
  lista = lista.filter((e) => !String(e.id).startsWith(prefCobro) || idsCobroNuevos.has(String(e.id)))

  const ahora = new Date().toISOString()
  let totalNet = 0
  for (const [platform, amount] of porPlataformaViva) {
    totalNet += amount
    const count = delDia.filter((t) => String(t.platform) === platform).length
    const entry: CashFlowEntry = {
      id: idDeCobro(dia, platform),
      date: dia,
      description: `Receivable · ${platform}`,
      source: "trip",
      sourceLabel: `Receivable · ${platform}`,
      type: "income",
      status: "projected",
      amount,
      category: "Income",
      notes: `Receivable updated from Earnings (${count} trips)`,
      createdAt: ahora,
      isManuallyEdited: false,
    }
    lista = upsertMovimiento(lista, entry)
  }

  // Los recurrentes diarios de ingreso (ej. el depósito de $400) se generan
  // dinámicamente en el forecast, no están en el libro: hay que saltarlos con
  // un override para que no dupliquen el cobro reconciliado.
  try {
    const schedRaw = localStorage.getItem(FINANCE_SCHEDULES_KEY)
    const schedules: ScheduledEntry[] = schedRaw ? JSON.parse(schedRaw) : []
    const ovRaw = localStorage.getItem(SCHEDULE_OVERRIDES_KEY)
    const overrides: ScheduleOverride[] = ovRaw ? JSON.parse(ovRaw) : []
    let ovChanged = false
    for (const s of schedules) {
      if (!s || s.kind !== "income" || s.frequency !== "daily") continue
      if (overrides.some((o) => o.scheduleId === s.id && o.date === dia && o.skip)) continue
      overrides.push({ scheduleId: s.id, date: dia, skip: true })
      ovChanged = true
    }
    if (ovChanged) localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch {}

  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(lista))
  } catch {}

  // Avisar a las pantallas de DINERO que relean el libro y los overrides:
  // sin este evento el envío quedaba escrito en localStorage pero
  // Proyecciones seguía mostrando lo proyectado hasta el próximo sync —
  // la desconexión que Miguel reportó el 2026-10-24.
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}

  return {
    entries: lista,
    platforms: porPlataformaViva.size,
    totalNet: Math.round(totalNet * 100) / 100,
    replacedPlaceholders,
  }
}

/** Fechas (yyyy-mm-dd) con al menos un cobro claris:cobro:* todavía
 *  PROYECTADO en el libro — la cuenta por cobrar sigue viva en MONEY. */
export function fechasConCobroProyectado(entries: CashFlowEntry[]): string[] {
  const out = new Set<string>()
  for (const e of entries || []) {
    if (!e || e.status !== "projected") continue
    const m = String(e.id || "").match(/^claris:cobro:(\d{4}-\d{2}-\d{2}):/)
    if (m) out.add(m[1])
  }
  return [...out]
}

/** Fechas que la reconciliación AUTOMÁTICA (al cambiar los viajes) debe
 *  refrescar en MONEY — regla de Miguel, 2026-11-15:
 *  - HOY, como siempre: solo si hoy tiene neto > 0.
 *  - Cualquier día ANTERIOR cuya cuenta por cobrar TODAVÍA esté en MONEY
 *    (cobro proyectado vivo) y cuyos viajes estén cargados con neto > 0:
 *    se actualiza igual que hoy, porque antes de que la semana cierre
 *    pueden cambiar montos (un tip, una entrada corregida).
 *  - Un día cuyo cobro ya salió de MONEY (pagado o borrado) NO se toca
 *    solo: no revive sin que Miguel le dé al botón de ese día; si al
 *    darle revive y duplica, él lo borra (su decisión, 2026-11-15). */
export function fechasReconciliacionAuto(
  trips: Trip[],
  hoy: string,
  libro: CashFlowEntry[],
): string[] {
  const lista = trips || []
  const conNeto = (d: string) =>
    lista.some((t) => tripDateOf(t) === d && (netOf(t) || 0) > 0)
  const fechas = new Set<string>()
  if (conNeto(hoy)) fechas.add(hoy)
  const conViajes = new Set(lista.map((t) => tripDateOf(t)))
  for (const d of fechasConCobroProyectado(libro)) {
    if (d === hoy) continue
    if (conViajes.has(d) && conNeto(d)) fechas.add(d)
  }
  return [...fechas].sort()
}

/** Borra cobros proyectados de días que YA NO tienen viajes con neto > 0.
 *  Evita fantasmas cuando se borran o se cambian de fecha los viajes.
 *  Miguel 2026-11-15: "no hay un viaje... están apareciendo, no es real". */
export function limpiarCobrosSinViajes(
  trips: Trip[],
  libro: CashFlowEntry[],
): CashFlowEntry[] {
  const conNeto = new Set<string>()
  for (const t of trips || []) {
    if ((netOf(t) || 0) > 0) conNeto.add(tripDateOf(t))
  }
  const fechasConCobro = fechasConCobroProyectado(libro)
  const aBorrar = fechasConCobro.filter((d) => !conNeto.has(d))
  if (aBorrar.length === 0) return libro
  const prefijos = new Set(aBorrar.map((d) => prefijoCobroDia(d)))
  return libro.filter((e) => {
    const id = String(e.id || "")
    for (const pref of prefijos) {
      if (id.startsWith(pref)) return false
    }
    return true
  })
}

export type ValidacionCobros = {
  ok: boolean
  warnings: string[]
  diasFantasma: string[]
  cobrosSinViaje: number
}

/** Valida que los cobros proyectados tengan viajes reales. */
export function validarCobros(trips: Trip[], libro: CashFlowEntry[]): ValidacionCobros {
  const warnings: string[] = []
  const conNeto = new Set<string>()
  for (const t of trips || []) {
    if ((netOf(t) || 0) > 0) conNeto.add(tripDateOf(t))
  }
  const diasFantasma: string[] = []
  let cobrosSinViaje = 0
  for (const e of libro || []) {
    if (!e || e.status !== "projected") continue
    const m = String(e.id || "").match(/^claris:cobro:(\d{4}-\d{2}-\d{2}):/)
    if (!m) continue
    if (!conNeto.has(m[1])) {
      cobrosSinViaje++
      if (!diasFantasma.includes(m[1])) diasFantasma.push(m[1])
    }
    if ((Number(e.amount) || 0) <= 0) {
      warnings.push(`Cobro con monto ≤ 0: ${e.id}`)
    }
  }
  if (diasFantasma.length > 0) {
    warnings.push(`Cobros sin viajes: ${diasFantasma.join(", ")} (${cobrosSinViaje} líneas)`)
  }
  return { ok: warnings.length === 0, warnings, diasFantasma, cobrosSinViaje }
}

export function leerLibroMayor(): CashFlowEntry[] {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return []
    const list = sinSemillas(JSON.parse(raw))
    // Migración a inglés (2026-10-18): normalizar categorías viejas al leer.
    for (const e of list) {
      if (e && typeof (e as any).category === "string") {
        ;(e as any).category = migrateCategory((e as any).category)
      }
    }
    return list
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
