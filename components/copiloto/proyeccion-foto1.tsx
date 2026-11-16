"use client"

// FOTO 1 — REGISTRO & PRONÓSTICO DE FLUJO DE CAJA (clonada idéntica).
// Va en la pestaña Proyecciones. Datos reales del forecast de 30 días.

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { ProyeccionForm, ProyeccionEdit } from "./proyeccion-form"
import {
  Gauge,
  catIcon,
  fmtDiaMes,
  fmtFecha,
  fmtWeekday,
  healthOf,
  lineCategory,
  money2,
  signed,
  useBillsDetail,
  useForecast30,
  type ProyProps,
} from "./proyeccion-shared"
import { billPaidTotal, billRemaining } from "./bill-payments"
import { SCHEDULES_CLEAR_FLAG_KEY } from "./finance-cloud"
import { accountDisplayName } from "./registers-store"
import { normalizeVendorName, type Expense } from "./types"
import { platformMatch, signedAdjustment, vendorMatch, weekStartOf, SCHEDULE_OVERRIDES_KEY, type ForecastLine, type ProbablePaid } from "./dinero-forecast"
import { useForecastInputs } from "./dinero-proyeccion"
import { FINANCE_LEDGER_KEY, FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT, RECONCILED_LOG_KEY } from "./finance-sync"
import type { CashFlowEntry, CashFlowOrigin } from "./types"
import { ETIQUETA_ORIGEN, origenDe } from "./cash-flow-store"
import { loadTrips } from "./storage"
import { loadShiftTolls, SHIFT_TOLLS_EVENT } from "./shift-tolls"
import { loadOpenBills, saveOpenBills, applyPayment } from "./open-bills-store"
import { syncEzpassWeekly } from "./ezpass-weekly"
import {
  WEEK_TOLLS_EVENT,
  addDaysISO,
  buildWeekRecord,
  loadStatementCharges,
  loadWeekCorrections,
  updateWeekCorrection,
  type WeekTollPass,
} from "./week-tolls"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"
const BAND = "#1b1e27"

const btnOk: CSSProperties = { background: "#34d17b26", color: GREEN, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }
const btnAmber: CSSProperties = { background: "#f5b73f26", color: "#f5b73f", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }
const btnGhost: CSSProperties = { background: "#262833", color: "#c9cbd8", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }

function readLedger(): CashFlowEntry[] {
  try {
    const raw = localStorage.getItem(FINANCE_LEDGER_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function notifySync() {
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

// ——— Registro de reconciliaciones con el banco (Miguel, 2026-11-15) ———
// Cuando un proyectado cae en el banco y se reconcilia (solo, por match
// seguro, o confirmado por él en TO CONFIRM), queda asentado aquí con lo
// proyectado, lo que llegó y la diferencia. Solo récord en pantalla:
// no afecta ningún saldo ni toca el libro.
interface RecRecord {
  id: string
  date: string
  label: string
  projected: number
  bank: number
  income: boolean
  detail: string
}
function loadRecLog(): RecRecord[] {
  try {
    const raw = localStorage.getItem(RECONCILED_LOG_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === "string") : []
  } catch {
    return []
  }
}
function appendRecLog(recs: RecRecord[]) {
  if (recs.length === 0) return
  try {
    const cur = loadRecLog()
    const seen = new Set(cur.map((r) => r.id))
    const fresh = recs.filter((r) => !seen.has(r.id))
    if (fresh.length === 0) return
    localStorage.setItem(RECONCILED_LOG_KEY, JSON.stringify([...fresh, ...cur].slice(0, 200)))
  } catch {}
}
function recRecordOf(p: ProbablePaid): RecRecord {
  return {
    id: String(p.entry.id),
    date: String(p.tx.date).slice(0, 10),
    label: p.entry.description || "Transaction",
    // Lo proyectado que macheó es p.amount (el resto del bill tras R1),
    // no el total de la entrada.
    projected: p.amount ?? Math.abs(Number(p.entry.amount) || 0),
    bank: Math.abs(Number(p.tx.amount) || 0),
    income: p.entry.type === "income",
    detail: String(p.tx.detail || ""),
  }
}

// ——— Marquita de origen (Miguel, 2026-11-14) ———
// Las filas que llegaron TRANSFERIDAS de otra página llevan el nombre
// del origen en chiquito bajo la descripción, para identificarlas de un
// vistazo al reconciliar. SOLO display: no toca datos, montos, fechas,
// columnas ni saldos.
// Completada el mismo día (la primera versión casi no se veía en su
// teléfono): también se marca la ocurrencia de un recurrente cuando la
// carga un bill REAL de la página de Gastos (escaneado → ESCANEADO;
// escrito en Gastos → EXPENSES) y la entrada del libro nacida en Gastos
// escrita a mano (id claris:gasto: con origen manual → EXPENSES).
// El recurrente puro y el bill de ciclo auto-creado NO se marcan:
// nacen en la propia Proyecciones, no vienen transferidos.
function billEscaneado(b: Expense): boolean {
  return Boolean(b.scanned) || Boolean(b.isAiGenerated) || b.confidence != null
}

/** Plataforma dueña de un cobro transferido desde Earnings (Uber, Lyft,
 * Aventus Ride…): la marquita dice DE QUIÉN es el dinero, no "RECEIVABLES".
 * Sale de la descripción "Receivable · {plataforma}" que deja el propio
 * reconciliado de Earnings; el id claris:cobro:{fecha}:{plataforma} es el
 * respaldo. Pedido textual de Miguel (2026-11-14): "que diga en
 * Proyecciones de que ese income es de Uber o es de Lyft o es de
 * Aventus… de dónde viene ese income". */
function plataformaDeCobro(e: CashFlowEntry): string | null {
  const m =
    String(e.description || "").match(/^(?:Receivable|Cobros?)\s*·\s*(.+)$/i) ||
    String(e.sourceLabel || "").match(/^(?:Receivable|Cobros?)\s*·\s*(.+)$/i)
  if (m && m[1].trim()) return m[1].trim().toUpperCase()
  const idm = String(e.id || "").match(/^claris:cobro:\d{4}-\d{2}-\d{2}:(.+)$/)
  if (idm && idm[1].trim()) return idm[1].trim().replace(/[-_]+/g, " ").toUpperCase()
  return null
}

function marcaOrigen(
  line: ForecastLine,
  schedules: readonly { id: string }[],
  bill?: { bill: Expense; auto: boolean } | null,
): string | null {
  if (line.entry) {
    const origin = origenDe(line.entry)
    if (origin === "trip") return plataformaDeCobro(line.entry) ?? ETIQUETA_ORIGEN[origin].toUpperCase()
    if (origin !== "manual") return ETIQUETA_ORIGEN[origin].toUpperCase()
    // Nació en la página de Gastos (escrita a mano allí): vino transferida
    // aunque su origen guardado diga "manual" (igual que las escritas
    // directo en Proyecciones, que NO llevan este id y no se marcan).
    if (String(line.entry.id).startsWith("claris:gasto:")) return "EXPENSES"
    return null
  }
  if (line.scheduleId) {
    // La ocurrencia la carga un bill real de Gastos: la marca es la del bill.
    if (bill && !bill.auto) {
      return billEscaneado(bill.bill) ? ETIQUETA_ORIGEN.scan.toUpperCase() : "EXPENSES"
    }
    const s = schedules.find((x) => x.id === line.scheduleId) as unknown as
      | { origin?: CashFlowOrigin; sourceLabel?: string; source?: string }
      | undefined
    if (s && (s.origin || s.sourceLabel || s.source)) {
      const origin = origenDe({ origin: s.origin, sourceLabel: s.sourceLabel, source: s.source } as unknown as CashFlowEntry)
      if (origin !== "manual") return ETIQUETA_ORIGEN[origin].toUpperCase()
    }
  }
  return null
}

function MiniChart({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const W = 150, H = 92, B = 14
  const min = Math.min(...points), max = Math.max(...points), rng = Math.max(1, max - min)
  const X = (i: number) => 4 + (i / (points.length - 1)) * (W - 8)
  const Y = (v: number) => 6 + (1 - (v - min) / rng) * (H - 6 - B)
  const pts = points.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="f1fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34d17b" stopOpacity=".35" />
          <stop offset="1" stopColor="#34d17b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="4" y1={6 + f * (H - 6 - B)} x2={W - 4} y2={6 + f * (H - 6 - B)} stroke="#23252f" strokeWidth="1" />
      ))}
      <polygon points={`4,${Y(points[0])} ${pts} ${X(points.length - 1)},${H - B} 4,${H - B}`} fill="url(#f1fill)" />
      <polyline points={pts} fill="none" stroke="#34d17b" strokeWidth="2" />
    </svg>
  )
}

export function ProyeccionFoto1(props: ProyProps & { onScan?: () => void }) {
  const { fc, fcLong, today, schedules } = useForecast30(props)
  const [form, setForm] = useState<null | "income" | "expense">(null)
  const [editing, setEditing] = useState<ForecastLine | null>(null)

  // ——— Registro semanal de peajes (Miguel, 2026-11-02) ———
  // WEEKLY TOLLS de la caja semanal sale del registro macheado
  // (GPS + statement, sin repeticiones) de week-tolls.ts, no de las
  // etiquetas del forecast. Tocar la línea abre la semana para
  // verificarla y corregirla.
  const [tollTick, setTollTick] = useState(0)
  const [tollWeek, setTollWeek] = useState<string | null>(null)
  useEffect(() => {
    const bump = () => setTollTick((t) => t + 1)
    window.addEventListener(WEEK_TOLLS_EVENT, bump)
    window.addEventListener(SHIFT_TOLLS_EVENT, bump)
    window.addEventListener(FINANCE_SYNCED_EVENT, bump)
    return () => {
      window.removeEventListener(WEEK_TOLLS_EVENT, bump)
      window.removeEventListener(SHIFT_TOLLS_EVENT, bump)
      window.removeEventListener(FINANCE_SYNCED_EVENT, bump)
    }
  }, [])
  const tollData = useMemo(() => {
    void tollTick
    return {
      trips: loadTrips() ?? [],
      diary: loadShiftTolls(),
      charges: loadStatementCharges(),
      corrections: loadWeekCorrections(),
    }
  }, [tollTick])

  // ——— Cuentas por pagar: reconciliación automática (2026-10-24) ———
  // El forecast cruza cada proyectado contra el banco (probablePaid).
  // Match EXACTO al centavo — y en ingresos, con comercio o plataforma
  // identificable — se marca pagado SOLO. Lo demás espera abajo en
  // POR CONFIRMAR: nada se cierra por adivinanza.
  const { dismissed, setDismissed, checkedRows, setCheckedRows } = useForecastInputs()
  // Marca manual (Miguel, 2026-11-15): tocar el check de un renglón lo
  // marca con la fecha de HOY — deja de contar al momento y mañana ya no
  // sale. Tocar otra vez el mismo día deshace la marca.
  const toggleCheck = (line: ForecastLine) => {
    const next = { ...checkedRows }
    if (next[line.key] === today) delete next[line.key]
    else next[line.key] = today
    setCheckedRows(next)
    notifySync()
  }
  const [recTick, setRecTick] = useState(0)
  const recLog = useMemo(() => {
    void recTick
    const desde = new Date(`${today}T12:00:00`)
    desde.setDate(desde.getDate() - 60)
    const desdeISO = desde.toISOString().slice(0, 10)
    return loadRecLog()
      .filter((r) => String(r.date).slice(0, 10) >= desdeISO)
      .sort((a, b) => (String(b.date) < String(a.date) ? -1 : 1))
  }, [recTick, today])
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null)
  const [adjustReason, setAdjustReason] = useState("")

  // ——— Quitar TODO lo proyectado (pedido de Miguel, 2026-10-25) ———
  // Lo proyectado se borra desde ESTA misma pantalla para empezar a
  // programar desde cero con ＋ Income / ＋ Expense. Misma regla que el
  // DELETE PROJECTION DATA ONLY de Data: fuera recurrentes + overrides +
  // proyectados sin pagar; se quedan banco, viajes, pagos reales y los
  // cobros reconciliados de EARNINGS (claris:cobro:*). El historial de
  // POR PAGAR no se toca.
  const [wipeCounts, setWipeCounts] = useState<{ schedules: number; projected: number } | null>(null)
  const contarProyectado = () => {
    try {
      const sch = JSON.parse(localStorage.getItem(FINANCE_SCHEDULES_KEY) || "[]")
      const led = readLedger()
      const projected = led.filter(
        (e) => e && e.status === "projected" && !String(e.id).startsWith("claris:cobro:"),
      ).length
      setWipeCounts({ schedules: Array.isArray(sch) ? sch.length : 0, projected })
    } catch {
      setWipeCounts({ schedules: 0, projected: 0 })
    }
  }
  const quitarTodoProyectado = () => {
    try {
      const kept = readLedger().filter(
        (e) => !(e && e.status === "projected" && !String(e.id).startsWith("claris:cobro:")),
      )
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(kept))
      // Marca de vaciado DELIBERADO: sin ella, el candado anti-vacío de
      // finance-cloud no dejaría propagar este borrado a propósito.
      localStorage.setItem(SCHEDULES_CLEAR_FLAG_KEY, String(Date.now()))
      localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify([]))
      localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify([]))
    } catch {}
    setWipeCounts(null)
    notifySync()
  }

  const esSeguro = (p: ProbablePaid): boolean => {
    // Lo proyectado que macheó es p.amount (el resto del bill tras R1),
    // no el total de la entrada.
    const projAmt = p.amount ?? Math.abs(Number(p.entry.amount) || 0)
    const diff = Math.abs(Math.abs(Number(p.tx.amount) || 0) - projAmt)
    if (diff > 0.011) return false
    if (p.entry.type === "expense") return true
    return vendorMatch(p.tx.detail, p.entry.description) || platformMatch(p.tx.detail, p.entry.description)
  }

  const aplicarPagado = (p: ProbablePaid, ajuste?: { diff: number; reason: string }) => {
    const paidDate = String(p.tx.date).slice(0, 10)
    let next = readLedger().map((e) =>
      e.id === p.entry.id
        ? { ...e, status: "actual" as CashFlowEntry["status"], date: paidDate, isManuallyEdited: true }
        : e,
    )
    if (ajuste && Math.abs(ajuste.diff) > 0.011) {
      // R6 (2026-11-15): el ajuste se calcula con montos CON SIGNO
      // (proyectado vs banco). En un gasto, banco $102 vs proyectado $100
      // → ajuste GASTO $2 (el libro queda −$102). El código viejo usaba
      // valores absolutos y el tipo salía al revés en gastos. p.amount es
      // lo proyectado que macheó (el resto del bill tras R1).
      const projAmt = p.amount ?? Math.abs(Number(p.entry.amount) || 0)
      const projSigned = p.entry.type === "income" ? projAmt : -projAmt
      const adj = signedAdjustment(projSigned, Number(p.tx.amount) || 0)
      const adjEntry = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `adj-${Date.now()}`,
        date: paidDate,
        description: `Adjustment: ${ajuste.reason}`,
        source: "manual",
        sourceLabel: "Match adjustment",
        type: adj.type,
        status: "actual",
        amount: adj.amount,
        category: /fee/i.test(ajuste.reason) ? "Bank fees" : "Adjustment",
        notes: `Balances "${p.entry.description || "entry"}": bank vs projected diff ${adj.signed < 0 ? "-" : "+"}$${adj.amount.toFixed(2)}`,
        createdAt: new Date().toISOString(),
        isManuallyEdited: true,
      } as unknown as CashFlowEntry
      next = [adjEntry, ...next]
    }
    try {
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
    } catch {}
    appendRecLog([recRecordOf(p)])
    setRecTick((t) => t + 1)
    notifySync()
  }

  // Auto-aplicar los matches seguros en cuanto el forecast los detecta.
  const segurosKey = fcLong.probablePaid.filter(esSeguro).map((p) => p.key).join(",")
  useEffect(() => {
    const seguros = fcLong.probablePaid.filter(esSeguro)
    if (seguros.length === 0) return
    const byId = new Map(seguros.map((p) => [p.entry.id, p]))
    let changed = false
    const flipped: ProbablePaid[] = []
    const next = readLedger().map((e) => {
      const p = byId.get(e.id)
      if (!p || e.status !== "projected") return e
      changed = true
      flipped.push(p)
      return { ...e, status: "actual" as CashFlowEntry["status"], date: String(p.tx.date).slice(0, 10), isManuallyEdited: true }
    })
    if (!changed) return
    appendRecLog(flipped.map(recRecordOf))
    setRecTick((t) => t + 1)
    try {
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
    } catch {}
    notifySync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segurosKey])

  const porConfirm = fcLong.probablePaid.filter((p) => !esSeguro(p) && !dismissed.includes(p.key))

  const health = healthOf(fc)
  const net = fc.end - fc.start

  // Transacciones futuras (3 meses) con saldo acumulado, en caja con scroll.
  const futuras = useMemo(() => {
    let bal = fcLong.start
    return fcLong.lines
      .filter((l) => l.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((l: ForecastLine) => {
        const before = bal
        bal = Math.round((bal + (l.checked ? 0 : l.amount)) * 100) / 100
        return { line: l, before, after: bal }
      })
  }, [fcLong, today])

  // ——— Pagados y parciales (Miguel, 2026-10-29) ———
  // Lo pagado NO se borra ni se desaparece sin rastro: baja al final de la
  // lista con ✓ PAID y NO afecta ningún saldo. Lo pagado a medias sigue en
  // la lista por lo que RESTA, con su desglose Original · Pagado · Resta.
  const billsDetail = useBillsDetail()
  const partialNoteFor = useMemo(() => {
    const byEntry = new Map<string, Expense>()
    const bySched = new Map<string, Expense>()
    for (const { bill } of billsDetail) {
      if (billPaidTotal(bill) <= 0.004) continue
      byEntry.set(`claris:gasto:${bill.id}`, bill)
      if (bill.originScheduleId) bySched.set(`${bill.originScheduleId}|${String(bill.date).slice(0, 10)}`, bill)
    }
    return (line: ForecastLine): Expense | null => {
      if (line.entry?.id && byEntry.has(line.entry.id)) return byEntry.get(line.entry.id)!
      if (line.scheduleId) {
        const b = bySched.get(`${line.scheduleId}|${String(line.date).slice(0, 10)}`)
        if (b) return b
      }
      return null
    }
  }, [billsDetail])
  // Bill REAL detrás de una línea, para la marquita de origen: a diferencia
  // del desglose de parciales, aquí cuentan TODOS los bills (pagados o no).
  // Una ocurrencia cargada por un bill toma la fecha del bill, así que la
  // búsqueda es por recurrente+fecha o, si el bill no está enlazado, por
  // comercio+fecha (la misma regla con que el forecast lo asigna).
  const billDeLinea = useMemo(() => {
    const bySched = new Map<string, { bill: Expense; auto: boolean }>()
    for (const item of billsDetail) {
      if (item.bill.originScheduleId) {
        bySched.set(`${item.bill.originScheduleId}|${String(item.bill.date).slice(0, 10)}`, item)
      }
    }
    return (line: ForecastLine): { bill: Expense; auto: boolean } | null => {
      if (!line.scheduleId) return null
      const linked = bySched.get(`${line.scheduleId}|${String(line.date).slice(0, 10)}`)
      if (linked) return linked
      const found = billsDetail.find(
        (item) =>
          !item.auto &&
          String(item.bill.date).slice(0, 10) === String(line.date).slice(0, 10) &&
          vendorMatch(item.bill.vendor, line.label),
      )
      return found ?? null
    }
  }, [billsDetail])
  const paidBills = useMemo(() => {
    const desde = new Date(`${today}T12:00:00`)
    desde.setDate(desde.getDate() - 60)
    const desdeISO = desde.toISOString().slice(0, 10)
    const paid = billsDetail.filter(
      ({ bill }) => billPaidTotal(bill) > 0.004 && billRemaining(bill) <= 0.009 && String(bill.date).slice(0, 10) >= desdeISO,
    )
    // Gemelos (el bill escaneado en Gastos y su bill de ciclo en POR PAGAR
    // son LA MISMA deuda): se muestra una sola vez, el de ciclo.
    return paid
      .filter(({ bill, auto }) => {
        if (auto) return true
        return !paid.some(
          ({ bill: o, auto: oa }) =>
            oa &&
            normalizeVendorName(o.vendor) === normalizeVendorName(bill.vendor) &&
            Math.abs((Number(o.amount) || 0) - (Number(bill.amount) || 0)) <= 0.011 &&
            Math.abs(new Date(`${String(o.date).slice(0, 10)}T12:00:00`).getTime() - new Date(`${String(bill.date).slice(0, 10)}T12:00:00`).getTime()) <= 3 * 86400000,
        )
      })
      .sort((a, b) => (String(b.bill.date) < String(a.bill.date) ? -1 : 1))
  }, [billsDetail, today])
  const paidFromLabel = (bill: Expense): string => {
    const pays = Array.isArray(bill.payments) ? bill.payments : []
    const last = pays[pays.length - 1]
    if (!last) return ""
    if (last.accountId) {
      const reg = props.registers.find((r) => r.id === last.accountId)
      if (reg) return accountDisplayName(reg.name).title
    }
    if (last.bankTxId) return String(last.bankTxId).split("|")[1] || ""
    return ""
  }

  // Desglose por categoría (top 2 ingresos / top 2 gastos, como la foto).
  const desglose = useMemo(() => {
    const inc = new Map<string, number>(), exp = new Map<string, number>()
    for (const l of fc.lines) {
      if (l.checked) continue
      const c = lineCategory(l, schedules)
      if (l.amount > 0) inc.set(c, (inc.get(c) || 0) + l.amount)
      else exp.set(c, (exp.get(c) || 0) + Math.abs(l.amount))
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
    return { inc: top(inc), exp: top(exp) }
  }, [fc, schedules])

  const chartPts = useMemo(() => {
    const all = [fc.start, ...fc.days.map((d) => d.balance)]
    const step = Math.max(1, Math.floor(all.length / 12))
    const out = all.filter((_, i) => i % step === 0)
    if (out[out.length - 1] !== all[all.length - 1]) out.push(all[all.length - 1])
    return out
  }, [fc])

  const th: CSSProperties = { textAlign: "left", fontSize: 10, color: SUB, letterSpacing: 0.6, padding: "9px 6px", borderBottom: `1px solid ${BORDER}`, fontWeight: 700, whiteSpace: "nowrap" }
  const td: CSSProperties = { padding: "9px 6px", borderBottom: "1px solid #1a1c24", verticalAlign: "top", fontSize: 11.5 }

  // Balance real del banco (Plaid) al cierre de cada fecha: desde hoy hacia
  // atrás restando los movimientos reales. Fechas futuras = último real.
  const bankFor = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const t of props.bankTxs) {
      const d = String(t.date || "").slice(0, 10)
      if (d && d <= today) byDate.set(d, (byDate.get(d) || 0) + (Number(t.amount) || 0))
    }
    const dates = [...byDate.keys()].sort()
    const endOfDay = new Map<string, number>()
    let suffix = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      endOfDay.set(dates[i], Math.round((fc.start - suffix) * 100) / 100)
      suffix += byDate.get(dates[i]) || 0
    }
    return (date: string): number => {
      if (date >= today) return fc.start
      let best: string | null = null
      for (const d of dates) {
        if (d <= date) best = d
        else break
      }
      return best ? (endOfDay.get(best) ?? fc.start) : fc.start
    }
  }, [props.bankTxs, today, fc.start])

  if (form) {
    return <ProyeccionForm initialKind={form} onClose={() => setForm(null)} />
  }

  if (editing) {
    return (
      <ProyeccionEdit
        line={editing}
        schedule={schedules.find((s) => s.id === editing.scheduleId)}
        onClose={() => setEditing(null)}
      />
    )
  }

  if (tollWeek) {
    return <WeekTollsSheet monday={tollWeek} onClose={() => setTollWeek(null)} />
  }

  // Saldo proyectado con claridad: verde = fuerte, amarillo = débil
  // (bajo el balance de hoy), rojo = negativo.
  const fmtBal = (v: number) => (v < 0 ? "-$" : "$") + money2(v)
  const saldoColor = (v: number) => (v < 0 ? RED : v < fcLong.start ? "#f5b73f" : GREEN)

  return (
    <div style={{ paddingBottom: 28, color: INK, overflowX: "hidden", maxWidth: "100%" }}>
      {/* Tira resumen de 5 columnas, clonada de la foto (2026-11-15):
          STARTING BAL. | INCOME (30D) | EXPENSES (30D) | ENDING BAL. |
          medidor pequeño + HEALTH. Mismos valores que la tarjeta de dos
          columnas que reemplaza; sin línea NET FLOW (no está en la foto).
          El encabezado "CASH FLOW REGISTER & FORECAST" y la fila
          "PROJECTION SUMMARY" tampoco están en la foto: fuera. La tira
          REAL BANK | PROJECTED MONTH vive arriba (MONEY) y se queda.
          MEDIDAS (2026-11-15, foto de las 19:05: a 13px el texto se
          encimaba en su teléfono): etiquetas 8.5px, valores 11.5px,
          celdas centradas, columnas de dinero más anchas que la del
          medidor. Verificado por captura a 390px (sin solapes ni
          recortes; la fuente de la prueba es más ancha que la del iPhone,
          así que en su teléfono sobra más). */}
      <div style={{ margin: "12px 12px 0", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "10px 6px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1.15fr 1fr 1fr", gap: 2, alignItems: "center" }}>
          <div style={{ minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: 8.5, color: SUB, letterSpacing: 0, fontWeight: 700, whiteSpace: "nowrap" }}>STARTING BAL.</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fc.start < 0 ? "-$" : "$"}{money2(fc.start)}</div>
          </div>
          <div style={{ minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: 8.5, color: SUB, letterSpacing: 0, fontWeight: 700, whiteSpace: "nowrap" }}>INCOME (30D):</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: GREEN, marginTop: 3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signed(fc.incomeTotal)}</div>
          </div>
          <div style={{ minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: 8.5, color: SUB, letterSpacing: 0, fontWeight: 700, whiteSpace: "nowrap" }}>EXPENSES (30D):</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: RED, marginTop: 3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signed(-fc.expenseTotal)}</div>
          </div>
          <div style={{ minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: 8.5, color: SUB, letterSpacing: 0, fontWeight: 700, whiteSpace: "nowrap" }}>ENDING BAL.</div>
            {/* El saldo final SÍ puede ser negativo (es proyectado) y
                debe VERSE negativo: antes se imprimía con money2() que
                usa Math.abs y botaba el signo — se veía +$8,247.32
                cuando la cuenta daba −$8,247.32. */}
            <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: fc.end < 0 ? RED : undefined }}>{fc.end < 0 ? "-$" : "$"}{money2(fc.end)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
            <Gauge health={health} size={40} />
            <div style={{ fontSize: 7, fontWeight: 800, color: health.color, marginTop: 0, whiteSpace: "nowrap" }}>
              HEALTH: {health.label}
            </div>
          </div>
        </div>
      </div>

      {/* Botones para entrar proyecciones (abren la página formal) */}
      <div style={{ display: "flex", gap: 10, margin: "12px 12px 0" }}>
        <button
          type="button"
          onClick={() => setForm("income")}
          style={{ flex: 1, border: `1.5px solid ${GREEN}`, background: "rgba(52,209,123,.12)", color: GREEN, borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          ＋ Income
        </button>
        <button
          type="button"
          onClick={() => setForm("expense")}
          style={{ flex: 1, border: `1.5px solid ${RED}`, background: "rgba(255,93,108,.10)", color: RED, borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          ＋ Expense
        </button>
        {props.onScan && (
          <button
            type="button"
            onClick={props.onScan}
            style={{ flex: 1, border: "1.5px solid #5b8cff", background: "rgba(91,140,255,.10)", color: "#5b8cff", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
          >
            📷 Scan
          </button>
        )}
      </div>

      {/* Remove all projected: empezar a programar desde cero */}
      {wipeCounts === null ? (
        <div style={{ margin: "10px 12px 0" }}>
          <button
            type="button"
            onClick={contarProyectado}
            style={{ width: "100%", border: `1px solid ${BORDER}`, background: "transparent", color: SUB, borderRadius: 12, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Remove all projected
          </button>
        </div>
      ) : (
        <div style={{ margin: "10px 12px 0", background: CARD, border: "1px solid #7c2d12", borderRadius: 12, padding: "10px 12px" }}>
          <p style={{ fontSize: 11.5, color: INK, margin: 0 }}>
            This deletes <b>{wipeCounts.schedules} recurring</b> and <b>{wipeCounts.projected} unpaid projected</b> entries.
          </p>
          <p style={{ fontSize: 10.5, color: SUB, margin: "4px 0 0" }}>
            Kept: bank, trips, real payments, Earnings payouts and the Payables history. Then add
            your own with ＋ Income / ＋ Expense — everything editable.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={quitarTodoProyectado}
              style={{ flex: 1, background: "#b91c1c", color: "#fff", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              Yes, remove all
            </button>
            <button
              type="button"
              onClick={() => setWipeCounts(null)}
              style={{ flex: 1, background: "#262833", color: "#c9cbd8", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* UNIFIED REGISTER — sin caja visible, ancho casi completo */}
      <div style={{ padding: "18px 14px 8px", fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
        UNIFIED REGISTER
      </div>
      <div>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "17%" }} /><col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, paddingLeft: 12 }}>DATE</th><th style={th}>DESCRIPTION</th><th style={th}>CATEGORY</th>
              <th style={{ ...th, textAlign: "right" }}>BANK</th><th style={{ ...th, textAlign: "right" }}>AMOUNT</th>
              <th style={{ ...th, textAlign: "right" }}>RUNNING BAL.</th>
            </tr>
          </thead>
        </table>
        <div style={{ background: BAND, padding: "8px 14px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB }}>
          FUTURE TRANSACTIONS / FORECAST
        </div>
        <div style={{ maxHeight: "46vh", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "17%" }} /><col style={{ width: "20%" }} />
          </colgroup>
          <tbody>
            {futuras.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: SUB }}>No future transactions scheduled.</td></tr>
            )}
            {futuras.length > 0 && futuras[0].line.date > fc.endDate && (
              <tr>
                <td colSpan={6} style={{ padding: "7px 10px", background: "rgba(52,209,123,.08)", borderTop: "1px solid rgba(52,209,123,.25)", borderBottom: "1px solid rgba(52,209,123,.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 10.5 }}>
                    <span style={{ color: SUB, fontWeight: 800, letterSpacing: 1 }}>30-DAY SUBTOTAL · {fmtFecha(fc.endDate).toUpperCase()}</span>
                    <b style={{ color: saldoColor(fc.start), fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtBal(fc.start)}</b>
                  </div>
                  <div style={{ fontSize: 9.5, color: SUB, marginTop: 1 }}>Running balance at 30 days — matches ENDING BAL. in the strip above.</div>
                </td>
              </tr>
            )}
            {futuras.map(({ line, before, after }, i) => {
              const cat = lineCategory(line, schedules)
              const pb = partialNoteFor(line)
              const pbLeft = pb ? billRemaining(pb) : 0
              const tagOrigen = marcaOrigen(line, schedules, billDeLinea(line))
              // R22 (2026-11-15): la banda se renderiza tras la ÚLTIMA
              // línea de CADA semana (lunes–domingo), tenga o no línea en
              // domingo. Antes solo existía si la semana tenía línea en
              // domingo — semanas de lunes a sábado quedaban sin banda.
              const nextFuture = futuras[i + 1]
              const weekStartIso = weekStartOf(line.date)
              const isLastLineOfWeek = !nextFuture || weekStartOf(nextFuture.line.date) !== weekStartIso
              const weekLines = isLastLineOfWeek ? futuras.filter((item) => item.line.date >= weekStartIso && item.line.date <= line.date) : []
              const weekIncome = weekLines.reduce((sum, item) => sum + (!item.line.checked && item.line.amount > 0 ? item.line.amount : 0), 0)
              const weekExpenses = weekLines.reduce((sum, item) => sum + (!item.line.checked && item.line.amount < 0 ? Math.abs(item.line.amount) : 0), 0)
              // Peajes de la semana: el registro macheado (GPS + statement,
              // sin repeticiones, con la corrección de Miguel aplicada) —
              // NUNCA la suma de líneas del forecast con etiqueta de peaje.
              const weekRecord = isLastLineOfWeek
                ? buildWeekRecord(weekStartIso, tollData.trips, tollData.diary, tollData.charges, tollData.corrections)
                : null
              const weekTolls = weekRecord ? weekRecord.total : 0
              const weekNet = weekIncome - weekExpenses
              return (
                <Fragment key={line.id + i}>
                <tr
                  onClick={() => (line.entry || line.scheduleId) && setEditing(line)}
                  style={{
                    ...(i === 0 ? { background: "rgba(201,162,39,.14)" } : undefined),
                    ...((line.entry || line.scheduleId) ? { cursor: "pointer" } : undefined),
                  }}
                >
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600, paddingLeft: 12 }}>
                    {fmtFecha(line.date)}
                    <div style={{ fontSize: 8, color: SUB, fontWeight: 500, marginTop: 1 }}>{fmtWeekday(line.date)}</div>
                  </td>
                  <td style={{ ...td, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                      {(line.entry || line.scheduleId) && (
                        <button
                          type="button"
                          aria-label={line.checked ? "Checked — tap to undo" : "Check off — stop counting"}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleCheck(line)
                          }}
                          style={{ flex: "0 0 auto", width: 17, height: 17, marginTop: 1, borderRadius: "50%", border: `1.5px solid ${line.checked ? GREEN : "#4a4e5e"}`, background: line.checked ? GREEN : "transparent", color: "#0b0d12", fontSize: 11, fontWeight: 900, lineHeight: 1, padding: 0, cursor: "pointer" }}
                        >
                          {line.checked ? "✓" : ""}
                        </button>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: 600, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...(line.checked ? { color: SUB } : undefined) }}>{line.label}</span>
                        {tagOrigen && (
                          <div style={{ fontSize: 9.5, color: SUB, marginTop: 1, whiteSpace: "normal" }}>
                            {tagOrigen}
                          </div>
                        )}
                        {pb && pbLeft > 0.009 && (
                          <div style={{ fontSize: 9.5, color: SUB, marginTop: 1, whiteSpace: "normal" }}>
                            Original ${money2(Number(pb.amount) || 0)} · Paid ${money2(billPaidTotal(pb))} · Left ${money2(pbLeft)}
                          </div>
                        )}
                        {line.checked && (
                          <div style={{ fontSize: 9.5, color: GREEN, fontWeight: 700, marginTop: 1, whiteSpace: "normal" }}>
                            ✓ CHECKED · NO LONGER COUNTS
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, color: "#c9cbd8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-block", width: 19, textAlign: "center", marginRight: 3, fontSize: 12 }}>{catIcon(cat, line.label)}</span>
                    {cat}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#c9cbd8", whiteSpace: "nowrap", fontSize: 10.5 }}>
                    ${money2(bankFor(line.date))}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: line.checked ? SUB : line.amount >= 0 ? GREEN : RED, whiteSpace: "nowrap", fontSize: 12.5, paddingLeft: 2 }}>
                    {signed(line.amount)}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ color: SUB, fontSize: 10.5 }}>{fmtBal(before)}</span>
                    <br />
                    <span style={{ color: saldoColor(after), fontSize: 12.5, fontWeight: 600 }}>→ {fmtBal(after)}</span>
                  </td>
                </tr>
                {isLastLineOfWeek && (
                  <tr>
                    <td colSpan={6} style={{ padding: "7px 10px", background: "rgba(91,140,255,.075)", borderTop: "1px solid rgba(91,140,255,.22)", borderBottom: "1px solid rgba(91,140,255,.22)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5, fontSize: 9.5, lineHeight: 1.35 }}>
                        <div><span style={{ color: SUB }}>WEEK IN </span><b style={{ color: GREEN, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{signed(weekIncome)}</b></div>
                        <div><span style={{ color: SUB }}>OUT </span><b style={{ color: RED, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{signed(-weekExpenses)}</b></div>
                        <div><span style={{ color: SUB }}>NET </span><b style={{ color: weekNet >= 0 ? GREEN : RED, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{signed(weekNet)}</b></div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTollWeek(weekStartIso)}
                        style={{ marginTop: 3, fontSize: 9.5, color: SUB, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                      >
                        WEEKLY TOLLS <b style={{ color: "#f5b73f", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${money2(weekTolls)}</b>
                        <span style={{ color: "#73778a" }}> · {weekRecord ? weekRecord.passes.length : 0} passes · Mon–Sun · tap to check</span>
                      </button>
                    </td>
                  </tr>
                )}
                {/* R20 (2026-11-15): subtotal a 30 días — el saldo
                    acumulado al final del horizonte del encabezado
                    (fc.endDate) debe ser igual al ENDING BAL. de la tira
                    de arriba. La tabla sigue siendo de 90 días. */}
                {line.date <= fc.endDate && (!nextFuture || nextFuture.line.date > fc.endDate) && (
                  <tr>
                    <td colSpan={6} style={{ padding: "7px 10px", background: "rgba(52,209,123,.08)", borderTop: "1px solid rgba(52,209,123,.25)", borderBottom: "1px solid rgba(52,209,123,.25)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 10.5 }}>
                        <span style={{ color: SUB, fontWeight: 800, letterSpacing: 1 }}>30-DAY SUBTOTAL · {fmtFecha(fc.endDate).toUpperCase()}</span>
                        <b style={{ color: saldoColor(after), fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtBal(after)}</b>
                      </div>
                      <div style={{ fontSize: 9.5, color: SUB, marginTop: 1 }}>Running balance at 30 days — matches ENDING BAL. in the strip above.</div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {paidBills.length > 0 && (
          <>
            <div style={{ background: BAND, padding: "8px 14px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: GREEN }}>
              ✓ PAID — RECORD ONLY, DOES NOT AFFECT THE BALANCE
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} /><col style={{ width: "17%" }} /><col style={{ width: "20%" }} />
              </colgroup>
              <tbody>
                {paidBills.map(({ bill }) => {
                  const pays = Array.isArray(bill.payments) ? bill.payments : []
                  const lastPay = pays[pays.length - 1]
                  const from = paidFromLabel(bill)
                  return (
                    <tr key={bill.id} style={{ opacity: 0.62 }}>
                      <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600, paddingLeft: 12, color: SUB }}>
                        {fmtFecha(String(bill.date).slice(0, 10))}
                        <div style={{ fontSize: 8, color: SUB, fontWeight: 500, marginTop: 1 }}>{fmtWeekday(String(bill.date).slice(0, 10))}</div>
                      </td>
                      <td style={{ ...td, overflow: "hidden" }}>
                        <span style={{ fontWeight: 600, color: "#c9cbd8" }}>{bill.vendor}</span>
                        {bill.scanned && (
                          <div style={{ fontSize: 9.5, color: SUB, marginTop: 1, whiteSpace: "normal" }}>
                            {ETIQUETA_ORIGEN.scan.toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: 9.5, color: GREEN, fontWeight: 700, marginTop: 1 }}>
                          ✓ PAID{lastPay ? ` · ${fmtFecha(String(lastPay.date).slice(0, 10))}` : ""}{from ? ` · ${from}` : ""}
                        </div>
                      </td>
                      <td style={{ ...td, color: SUB, overflow: "hidden", textOverflow: "ellipsis" }}>{bill.category || ""}</td>
                      <td style={{ ...td, textAlign: "right", color: SUB, fontSize: 10.5 }}>—</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, color: SUB, whiteSpace: "nowrap", fontSize: 12.5, textDecoration: "line-through" }}>
                        {signed(-Math.abs(Number(bill.amount) || 0))}
                      </td>
                      <td style={{ ...td, textAlign: "right", color: SUB, fontSize: 10.5 }}>paid</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
        </div>

        {/* RECONCILIADO CON EL BANCO — lo que cayó y se macheó, con la
            diferencia entre lo proyectado y lo que llegó (Miguel,
            2026-11-15). Solo récord: no afecta ningún saldo. */}
        {recLog.length > 0 && (
          <>
            <div style={{ background: BAND, padding: "8px 14px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: GREEN }}>
              ✓ RECONCILED WITH THE BANK — RECORD ONLY, DOES NOT AFFECT THE BALANCE
            </div>
            {recLog.map((r) => {
              const diff = Math.round((r.bank - r.projected) * 100) / 100
              const hasDiff = Math.abs(diff) > 0.011
              return (
                <div key={r.id} style={{ padding: "8px 14px", borderBottom: "1px solid #1a1c24" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: r.income ? GREEN : RED, whiteSpace: "nowrap" }}>{signed(r.income ? r.bank : -r.bank)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Bank {fmtFecha(r.date)} · Projected ${money2(r.projected)} · Arrived ${money2(r.bank)}{r.detail ? ` · ${r.detail}` : ""}
                  </div>
                  {hasDiff && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f5b73f", marginTop: 2 }}>
                      Difference: ${money2(Math.abs(diff))} {diff < 0 ? "less" : "more"}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* FORECAST BREAKDOWN */}
        <div style={{ padding: "14px 14px 10px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB, marginBottom: 8 }}>FORECAST BREAKDOWN</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: "38%", minWidth: 0 }}>
              <MiniChart points={chartPts} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: SUB, marginTop: 2 }}>
                <span>{fmtDiaMes(today)}</span><span>{fmtDiaMes(fc.endDate)}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: SUB, fontSize: 10, marginBottom: 4, whiteSpace: "nowrap" }}>Sources of Cash</div>
                  {desglose.inc.map(([c, v]) => (
                    <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c}</span>
                      <b style={{ color: GREEN, whiteSpace: "nowrap" }}>+${Math.round(v).toLocaleString()}</b>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: SUB, fontSize: 10, marginBottom: 4, whiteSpace: "nowrap" }}>Uses of Cash</div>
                  {desglose.exp.map(([c, v]) => (
                    <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c}</span>
                      <b style={{ color: RED, whiteSpace: "nowrap" }}>-${Math.round(v).toLocaleString()}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right", marginTop: 6, fontSize: 11, color: SUB, whiteSpace: "nowrap" }}>
                NET FLOW: <b style={{ color: net >= 0 ? GREEN : RED }}>{signed(net)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* HOY */}
        <div style={{ background: BAND, padding: "10px 14px", fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4 }}>
          TODAY, {fmtFecha(today)} - CURRENT BALANCE: ${money2(fc.start)}
        </div>
      </div>

      {/* POR CONFIRMAR — apareció en el banco pero no cierra solo:
          trae diferencia de monto o el comercio no es claro. */}
      {porConfirm.length > 0 && (
        <div style={{ marginTop: 12, background: CARD, border: "1px solid #14532d", borderRadius: 16, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: GREEN }}>
            TO CONFIRM · {porConfirm.length}
          </div>
          <p style={{ fontSize: 10, color: SUB, margin: "3px 0 9px" }}>
            It showed up at the bank but with a difference or no clear merchant. You confirm or dismiss it.
          </p>
          {porConfirm.map((p) => {
            // Lo proyectado que macheó es p.amount (el resto del bill
            // tras R1), no el total de la entrada.
            const entryAmt = p.amount ?? Math.abs(Number(p.entry.amount) || 0)
            const bankAmt = Math.abs(Number(p.tx.amount) || 0)
            const diff = Math.round((bankAmt - entryAmt) * 100) / 100
            const hasDiff = Math.abs(diff) > 0.011
            const isAdjusting = adjustingKey === p.key
            return (
              <div key={p.key} style={{ border: `1px solid ${BORDER}`, background: "#0b0d12", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.entry.description || "Transaction"}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>${money2(entryAmt)}</span>
                </div>
                <div style={{ fontSize: 10, color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Bank {fmtFecha(String(p.tx.date).slice(0, 10))} · {p.tx.detail} · ${money2(bankAmt)}
                </div>
                {hasDiff && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f5b73f", marginTop: 2 }}>
                    Difference: ${money2(Math.abs(diff))} {diff < 0 ? "less" : "more"}
                  </div>
                )}
                {!isAdjusting ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button type="button" onClick={() => aplicarPagado(p)} style={btnOk}>
                      Yes, paid
                    </button>
                    {hasDiff && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingKey(p.key)
                          setAdjustReason("")
                        }}
                        style={btnAmber}
                      >
                        Adjust ${money2(Math.abs(diff))}
                      </button>
                    )}
                    <button type="button" onClick={() => setDismissed([...dismissed, p.key])} style={btnGhost}>
                      Not this one
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <input
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="Reason (e.g.: platform fee)"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "#14161d",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        color: INK,
                        fontSize: 11,
                        padding: "6px 8px",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          aplicarPagado(p, { diff, reason: adjustReason.trim() || "Adjustment" })
                          setAdjustingKey(null)
                        }}
                        style={btnOk}
                      >
                        Confirm
                      </button>
                      <button type="button" onClick={() => setAdjustingKey(null)} style={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------- Registro semanal de peajes: verificar y corregir la semana ----------
   Lo que se ve aquí ES lo que suma WEEKLY TOLLS en la caja: las pasadas
   macheadas sin repeticiones (week-tolls.ts). Miguel corrige aquí: agrega
   la pasada que faltó, quita la que no va, ajusta un monto. La corrección
   vive en claris_week_tolls_v1 (nube); las fuentes no se tocan. */
const TOLL_SRC_LABEL: Record<WeekTollPass["source"], string> = {
  gps: "GPS",
  shift: "SHIFT",
  stmt: "E-ZPASS",
  manual: "MANUAL",
}
const tollInput: CSSProperties = {
  background: "#0e1015",
  border: `1px solid ${BORDER}`,
  color: INK,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
}

function WeekTollsSheet({ monday, onClose }: { monday: string; onClose: () => void }) {
  const [tick, setTick] = useState(0)
  const [amtEdit, setAmtEdit] = useState<{ key: string; value: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ date: monday, time: "", plaza: "", amount: "" })
  const sunday = addDaysISO(monday, 6)
  const record = useMemo(() => {
    void tick
    return buildWeekRecord(monday, loadTrips() ?? [], loadShiftTolls(), loadStatementCharges(), loadWeekCorrections())
  }, [monday, tick])
  const refresh = () => setTick((t) => t + 1)
  const onStmt = record.passes.filter((p) => p.onStatement).length

  // ——— Bill del viernes de ESTA semana (misma fuente: el registro) ———
  const friday = addDaysISO(monday, 4)
  const [payAmt, setPayAmt] = useState("")
  useEffect(() => {
    // Al abrir la semana, el bill se pone al día con el registro macheado.
    try {
      syncEzpassWeekly(loadTrips() ?? [])
    } catch {}
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday])
  const bill = useMemo(() => {
    void tick
    return loadOpenBills().find((b) => b.id === `ezpass-weekly-${friday}`) || null
  }, [friday, tick])
  const weekendTotal = record.passes
    .filter((p) => p.date >= addDaysISO(monday, 5))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const recordPayment = () => {
    if (!bill || bill.remainingAmount <= 0.009) return
    const want = payAmt ? Number(payAmt) : bill.remainingAmount
    if (!isFinite(want) || want <= 0) return
    const amount = Math.min(Math.round(want * 100) / 100, bill.remainingAmount)
    const d = new Date()
    const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const res = applyPayment(loadOpenBills(), { amount, date: todayISO, note: "E-ZPass weekly", billId: bill.id })
    saveOpenBills(res.bills)
    try {
      syncEzpassWeekly(loadTrips() ?? [])
    } catch {}
    setPayAmt("")
    refresh()
  }

  const removePass = (p: WeekTollPass) => {
    updateWeekCorrection(monday, (w) =>
      p.source === "manual"
        ? { ...w, added: w.added.filter((a) => `manual:${a.id}` !== p.key) }
        : { ...w, removed: w.removed.includes(p.key) ? w.removed : [...w.removed, p.key] },
    )
    refresh()
  }
  const saveAmount = (p: WeekTollPass) => {
    const v = Number(amtEdit?.value)
    if (!amtEdit || !isFinite(v) || v < 0) {
      setAmtEdit(null)
      return
    }
    const val = Math.round(v * 100) / 100
    updateWeekCorrection(monday, (w) =>
      p.source === "manual"
        ? { ...w, added: w.added.map((a) => (`manual:${a.id}` === p.key ? { ...a, amount: val } : a)) }
        : { ...w, amounts: { ...w.amounts, [p.key]: val } },
    )
    setAmtEdit(null)
    refresh()
  }
  const addPass = () => {
    const amount = Number(draft.amount)
    if (!draft.plaza.trim() || !isFinite(amount) || amount <= 0) return
    const date = draft.date >= monday && draft.date <= sunday ? draft.date : monday
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    updateWeekCorrection(monday, (w) => ({
      ...w,
      added: [...w.added, { id, date, time: draft.time || "", plaza: draft.plaza.trim(), amount: Math.round(amount * 100) / 100 }],
    }))
    setAdding(false)
    setDraft({ date: monday, time: "", plaza: "", amount: "" })
    refresh()
  }

  return (
    <div style={{ paddingBottom: 28, color: INK, maxWidth: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 6px" }}>
        <button type="button" onClick={onClose} style={btnGhost}>
          ← Back
        </button>
        <h2 style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: 0.8, flex: 1, minWidth: 0 }}>
          WEEKLY TOLLS · {fmtFecha(monday)} – {fmtFecha(sunday)}
        </h2>
      </div>
      <div style={{ padding: "4px 14px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#f5b73f", fontVariantNumeric: "tabular-nums" }}>
          ${money2(record.total)}
        </div>
        <div style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>
          {record.passes.length} passes · {onStmt} on the E-ZPass statement
        </div>
        <div style={{ fontSize: 10.5, color: SUB, marginTop: 6, lineHeight: 1.45 }}>
          GPS detections and statement charges are matched one-to-one — each pass counts once. Fix anything
          that is off: add a missed pass, remove a wrong one, adjust an amount.
        </div>
      </div>
      {bill && (
        <div style={{ margin: "10px 14px 0", padding: "10px 12px", background: BAND, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
          <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.6 }}>FRIDAY BILL · {fmtFecha(friday)}</div>
          <div style={{ fontSize: 12.5, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            Bill <b>${money2(bill.originalAmount)}</b>
            {" · "}Paid <b style={{ color: GREEN }}>${money2(bill.originalAmount - bill.remainingAmount)}</b>
            {" · "}Left <b style={{ color: bill.remainingAmount > 0.009 ? RED : GREEN }}>${money2(bill.remainingAmount)}</b>
            {bill.status === "paid" && <span style={{ color: GREEN }}> · ✓ PAID</span>}
          </div>
          {bill.remainingAmount > 0.009 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                placeholder={`Amount — blank pays the full $${money2(bill.remainingAmount)} left`}
                inputMode="decimal"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                style={{ ...tollInput, flex: 1 }}
              />
              <button type="button" onClick={recordPayment} style={btnOk}>
                Record payment
              </button>
            </div>
          )}
          {weekendTotal > 0 && (
            <div style={{ fontSize: 10, color: SUB, marginTop: 6 }}>
              Sat–Sun passes (${money2(weekendTotal)}) go on next Friday's bill.
            </div>
          )}
        </div>
      )}
      <div style={{ padding: "8px 14px 0" }}>
        {record.passes.length === 0 && (
          <div style={{ fontSize: 12, color: SUB, padding: "10px 0" }}>No toll passes recorded this week yet.</div>
        )}
        {record.passes.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ minWidth: 62 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtFecha(p.date)}</div>
              <div style={{ fontSize: 9.5, color: SUB }}>{p.time || "—"}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.plaza}</div>
              <div style={{ fontSize: 9, color: SUB, letterSpacing: 0.4 }}>
                {TOLL_SRC_LABEL[p.source]}
                {p.onStatement && p.source !== "stmt" ? " · ✓ ON STATEMENT" : ""}
                {p.corrected ? " · CORRECTED" : ""}
              </div>
            </div>
            {amtEdit?.key === p.key ? (
              <>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amtEdit.value}
                  onChange={(e) => setAmtEdit({ key: p.key, value: e.target.value })}
                  style={{ ...tollInput, width: 84 }}
                />
                <button type="button" onClick={() => saveAmount(p)} style={btnOk}>
                  Save
                </button>
                <button type="button" onClick={() => setAmtEdit(null)} style={btnGhost}>
                  ✕
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f5b73f", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {p.amount === null ? "no amount" : `$${money2(p.amount)}`}
                </div>
                <button type="button" onClick={() => setAmtEdit({ key: p.key, value: p.amount === null ? "" : String(p.amount) })} style={btnGhost}>
                  Edit
                </button>
                <button type="button" onClick={() => removePass(p)} style={{ ...btnGhost, color: RED }}>
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div style={{ display: "grid", gap: 8, padding: "12px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input type="date" min={monday} max={sunday} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={tollInput} />
              <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={tollInput} />
            </div>
            <input placeholder="Plaza / bridge / tunnel" value={draft.plaza} onChange={(e) => setDraft({ ...draft, plaza: e.target.value })} style={tollInput} />
            <input placeholder="Amount (e.g. 7.46)" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} style={tollInput} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={addPass} style={btnOk}>
                Add pass
              </button>
              <button type="button" onClick={() => setAdding(false)} style={btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} style={{ ...btnAmber, marginTop: 12 }}>
            + Add a missed pass
          </button>
        )}
      </div>
    </div>
  )
}
