// Registro semanal de peajes — LA verificación de la semana (Miguel, 2026-11-02).
//
// Su regla: SIN REPETICIONES. Las detecciones GPS (viajes + diario del
// turno) y los screenshots del statement de E-ZPass son DOS VISTAS de las
// mismas pasadas: se MATCHAN una a una y cada pasada cuenta UNA sola vez.
// Lo que enseña la caja semanal de Proyecciones (WEEKLY TOLLS) es este
// registro ya macheado — lo real — no una suma suelta de etiquetas.
//
// Fuentes (no se modifican aquí, solo se leen):
//  - GPS en viajes: notas "[día · HH:MM] Plaza - $X.XX" (gpsTollsFromTrips)
//  - GPS entre trabajos: diario del turno (gpsTollsFromShiftDiary)
//  - Statement: cargos escaneados en TOLL AUDIT (claris_toll_statement_charges_v1)
//
// Corrección manual (lo único que este módulo ESCRIBE): una capa por semana
// en claris_week_tolls_v1 (nube vía FINANCE_CLOUD_KEYS, fusión por id de
// semana): pasadas agregadas a mano, claves quitadas y montos corregidos.
// La pasada original NUNCA se toca en su fuente.

import type { Trip } from "./types"
import type { ShiftToll } from "./shift-tolls"
import type { TollCharge } from "@/app/api/scan-toll-statement/route"
import { gpsTollsFromTrips, gpsTollsFromShiftDiary, normPlaza } from "./toll-audit"
import { FINANCE_SYNCED_EVENT } from "./finance-sync"

export const WEEK_TOLLS_KEY = "claris_week_tolls_v1"
export const WEEK_TOLLS_EVENT = "claris:week-tolls-changed"
export const TOLL_STATEMENT_KEY = "claris_toll_statement_charges_v1"

/** Tolerancia de monto para decir "es la misma pasada" (regla de TOLL AUDIT). */
const AMOUNT_TOL = 0.6
/** Dos cargos de statement iguales dentro de esta ventana = escaneo duplicado. */
const DUP_WINDOW_MIN = 40

export type WeekTollSource = "gps" | "shift" | "stmt" | "manual"

export interface WeekTollPass {
  key: string
  date: string
  time: string
  plaza: string
  amount: number | null
  source: WeekTollSource
  /** La pasada detectada también apareció en el statement (macheada). */
  onStatement: boolean
  /** El monto fue corregido a mano por Miguel. */
  corrected: boolean
}

export interface ManualWeekPass {
  id: string
  date: string
  time: string
  plaza: string
  amount: number
}

export interface WeekCorrection {
  /** id = lunes de la semana, YYYY-MM-DD. */
  id: string
  added: ManualWeekPass[]
  removed: string[]
  amounts: Record<string, number>
}

/* ---------------- fechas ---------------- */

export function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00")
  const dow = d.getDay() // 0=domingo
  const back = (dow + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - back)
  return toISODate(d)
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T12:00:00")
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

function toISODate(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-")
}

const r2 = (n: number) => Math.round(n * 100) / 100

/* ---------------- statement (solo lectura) ---------------- */

export function loadStatementCharges(): TollCharge[] {
  try {
    const raw = localStorage.getItem(TOLL_STATEMENT_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.amount === "number" && typeof c.date === "string") : []
  } catch {
    return []
  }
}

export function stmtKey(c: TollCharge): string {
  if (c.ref) return `stmt:ref:${c.ref}`
  return `stmt:${c.date}|${c.time || ""}|${normPlaza(c.plaza)}|${c.amount}`
}

/* ---------------- correcciones (lectura/escritura) ---------------- */

export function loadWeekCorrections(): WeekCorrection[] {
  try {
    const raw = localStorage.getItem(WEEK_TOLLS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return []
    return arr
      .filter((w) => w && typeof w.id === "string")
      .map((w) => ({
        id: w.id,
        added: Array.isArray(w.added) ? w.added : [],
        removed: Array.isArray(w.removed) ? w.removed : [],
        amounts: w.amounts && typeof w.amounts === "object" ? w.amounts : {},
      }))
  } catch {
    return []
  }
}

export function saveWeekCorrections(list: WeekCorrection[]): void {
  try {
    localStorage.setItem(WEEK_TOLLS_KEY, JSON.stringify(list))
  } catch {}
  try {
    window.dispatchEvent(new Event(WEEK_TOLLS_EVENT))
  } catch {}
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

/** Aplica un cambio a la semana indicada y guarda todo. */
export function updateWeekCorrection(monday: string, fn: (w: WeekCorrection) => WeekCorrection): void {
  const list = loadWeekCorrections()
  const idx = list.findIndex((w) => w.id === monday)
  const base: WeekCorrection = idx >= 0 ? list[idx] : { id: monday, added: [], removed: [], amounts: {} }
  const next = fn({ ...base, added: [...base.added], removed: [...base.removed], amounts: { ...base.amounts } })
  const isEmpty = next.added.length === 0 && next.removed.length === 0 && Object.keys(next.amounts).length === 0
  if (isEmpty) {
    if (idx >= 0) list.splice(idx, 1)
  } else if (idx >= 0) {
    list[idx] = next
  } else {
    list.push(next)
  }
  saveWeekCorrections(list)
}

/* ---------------- macheo sin repeticiones ---------------- */

function plazaSame(a: string, b: string): boolean {
  const na = normPlaza(a)
  const nb = normPlaza(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function timeToMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || "")
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * Une detecciones y statement en UNA lista de pasadas reales:
 * cada cargo del statement se pega a lo sumo a UNA detección (misma fecha,
 * misma plaza, monto dentro de $0.60 — o detección sin monto, sistema
 * ticket, donde manda el monto del statement); el cargo que no pega con
 * ninguna detección es una pasada real que el GPS no vio (fuente stmt);
 * el cargo repetido de un escaneo anterior no vuelve a contar.
 */
export function mergeTollPasses(trips: Trip[], diary: ShiftToll[], charges: TollCharge[]): WeekTollPass[] {
  const gps: WeekTollPass[] = [
    ...gpsTollsFromTrips(trips).map((g) => ({
      key: g.id,
      date: g.date,
      time: g.time,
      plaza: g.plaza,
      amount: g.amount,
      source: (g.platform === "SHIFT" ? "shift" : "gps") as WeekTollSource,
      onStatement: false,
      corrected: false,
    })),
    ...gpsTollsFromShiftDiary(diary).map((g) => ({
      key: g.id,
      date: g.date,
      time: g.time,
      plaza: g.plaza,
      amount: g.amount,
      source: "shift" as WeekTollSource,
      onStatement: false,
      corrected: false,
    })),
  ]
  // El diario ya entra por gpsTollsFromTrips si un viaje lo trajera: las
  // claves shift# son únicas y los viajes nunca las generan — sin choque.

  const usedGps = new Set<string>()
  const consumedCharges: TollCharge[] = []
  const extra: WeekTollPass[] = []

  const sorted = [...charges].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
  for (const c of sorted) {
    // ¿Es el mismo cargo ya consumido (doble escaneo: diario + mensual)?
    const dup = consumedCharges.some((p) => {
      if (p.date !== c.date || !plazaSame(p.plaza, c.plaza)) return false
      if (Math.abs(p.amount - c.amount) > AMOUNT_TOL) return false
      const t1 = timeToMin(p.time)
      const t2 = timeToMin(c.time)
      return t1 === null || t2 === null || Math.abs(t1 - t2) <= DUP_WINDOW_MIN
    })
    if (dup) continue

    // Mejor detección libre para este cargo.
    let best: WeekTollPass | null = null
    let bestScore = Infinity
    for (const g of gps) {
      if (usedGps.has(g.key) || g.date !== c.date || !plazaSame(g.plaza, c.plaza)) continue
      const diff = g.amount === null ? 0 : Math.abs(g.amount - c.amount)
      if (g.amount !== null && diff > AMOUNT_TOL) continue
      const t1 = timeToMin(g.time)
      const t2 = timeToMin(c.time)
      const tDiff = t1 === null || t2 === null ? 30 : Math.abs(t1 - t2)
      const score = diff * 1000 + tDiff
      if (score < bestScore) {
        bestScore = score
        best = g
      }
    }
    if (best) {
      usedGps.add(best.key)
      best.onStatement = true
      if (best.amount === null) best.amount = c.amount // ticket: el statement trae el monto real
      consumedCharges.push(c)
    } else {
      consumedCharges.push(c)
      extra.push({
        key: stmtKey(c),
        date: c.date,
        time: c.time || "",
        plaza: c.plaza,
        amount: c.amount,
        source: "stmt",
        onStatement: true,
        corrected: false,
      })
    }
  }

  return [...gps, ...extra].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
}

/**
 * Aplica TODAS las correcciones a las pasadas macheadas: cada pasada se
 * corrige con el registro de SU semana (lunes de su fecha); las agregadas
 * a mano entran con su fuente MANUAL. Esto es LA fuente única de peajes:
 * la caja semanal y el bill del viernes leen de aquí (Miguel, 2026-11-02:
 * "un solo total por semana").
 */
export function applyAllCorrections(passes: WeekTollPass[], corrections: WeekCorrection[]): WeekTollPass[] {
  const byWeek = new Map(corrections.map((w) => [w.id, w]))
  const out = passes
    .filter((p) => !(byWeek.get(mondayOf(p.date))?.removed || []).includes(p.key))
    .map((p) => {
      const fixed = byWeek.get(mondayOf(p.date))?.amounts[p.key]
      return typeof fixed === "number" ? { ...p, amount: fixed, corrected: true } : p
    })
  for (const w of corrections) {
    const removed = new Set(w.removed)
    for (const m of w.added) {
      const key = `manual:${m.id}`
      if (removed.has(key)) continue
      const fixed = w.amounts[key]
      out.push({
        key,
        date: m.date,
        time: m.time,
        plaza: m.plaza,
        amount: typeof fixed === "number" ? fixed : m.amount,
        source: "manual",
        onStatement: false,
        corrected: typeof fixed === "number",
      })
    }
  }
  return out.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
}

/** El registro de UNA semana (lun–dom) ya macheado y con la corrección aplicada. */
export function buildWeekRecord(
  monday: string,
  trips: Trip[],
  diary: ShiftToll[],
  charges: TollCharge[],
  corrections: WeekCorrection[]
): { passes: WeekTollPass[]; total: number } {
  const sunday = addDaysISO(monday, 6)
  const passes = applyAllCorrections(mergeTollPasses(trips, diary, charges), corrections).filter(
    (p) => p.date >= monday && p.date <= sunday
  )
  const total = r2(passes.reduce((s, p) => s + (Number(p.amount) || 0), 0))
  return { passes, total }
}

/** Total de peajes por DÍA según el registro macheado y corregido. */
export function matchedDayTotals(
  trips: Trip[],
  diary: ShiftToll[],
  charges: TollCharge[],
  corrections: WeekCorrection[]
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const p of applyAllCorrections(mergeTollPasses(trips, diary, charges), corrections)) {
    const amt = Number(p.amount) || 0
    if (amt <= 0) continue
    totals.set(p.date, r2((totals.get(p.date) || 0) + amt))
  }
  return totals
}
