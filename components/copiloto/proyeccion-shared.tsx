"use client"

// Compartido por las vistas clonadas de las fotos (Proyecciones = foto 1,
// Forecast = foto 2). Misma matemática de dinero-forecast.ts.

import { useEffect, useMemo, useState } from "react"
import type { CashFlowEntry, Expense } from "./types"
import type { DueItem, RegisterAccount } from "./registers-store"
import {
  buildForecast,
  startingBalance,
  todayKey,
  type Forecast,
  type ForecastBankTx,
  type ForecastBill,
  type ForecastLine,
} from "./dinero-forecast"
import { useForecastInputs } from "./dinero-proyeccion"
import { loadCycleBills, loadExternalBills } from "./liabilities"
import { billRemaining } from "./bill-payments"
import { FINANCE_SYNCED_EVENT } from "./finance-sync"

/** Bills que mandan sobre el recurrente (regla de Miguel, 2026-10-25):
 * los de ciclo de POR PAGAR (auto) y los reales escaneados en Gastos.
 * Se recargan al montar y con los mismos eventos que los recurrentes. */
function useForecastBills(): ForecastBill[] {
  const [bills, setBills] = useState<ForecastBill[]>([])
  useEffect(() => {
    const map = (b: Expense, auto: boolean): ForecastBill | null => {
      const date = String(b?.date || "").slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      return {
        vendor: String(b.vendor || ""),
        date,
        remaining: billRemaining(b),
        scheduleId: b.originScheduleId || undefined,
        auto,
      }
    }
    const load = () => {
      try {
        const out: ForecastBill[] = []
        for (const b of loadCycleBills()) {
          const m = map(b, true)
          if (m) out.push(m)
        }
        for (const b of loadExternalBills()) {
          const m = map(b, false)
          if (m) out.push(m)
        }
        setBills(out)
      } catch {
        setBills([])
      }
    }
    load()
    window.addEventListener(FINANCE_SYNCED_EVENT, load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener(FINANCE_SYNCED_EVENT, load)
      window.removeEventListener("storage", load)
    }
  }, [])
  return bills
}

/** Bills CRUDOS (con pagos) para las vistas: la Foto 1 los usa para el
 * registro de PAGADOS al final de la lista y para anotar los parciales
 * (Original · Pagado · Resta) sin tocar la matemática del forecast. */
export function useBillsDetail(): { bill: Expense; auto: boolean }[] {
  const [out, setOut] = useState<{ bill: Expense; auto: boolean }[]>([])
  useEffect(() => {
    const load = () => {
      try {
        const next: { bill: Expense; auto: boolean }[] = []
        for (const b of loadCycleBills()) if (b && b.id) next.push({ bill: b, auto: true })
        for (const b of loadExternalBills()) if (b && b.id) next.push({ bill: b, auto: false })
        setOut(next)
      } catch {
        setOut([])
      }
    }
    load()
    window.addEventListener(FINANCE_SYNCED_EVENT, load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener(FINANCE_SYNCED_EVENT, load)
      window.removeEventListener("storage", load)
    }
  }, [])
  return out
}

export interface ProyProps {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  entries: CashFlowEntry[]
  bankTxs: ForecastBankTx[]
  bankOk: boolean
  otherFunds: string[]
}

/** Forecast fijo a 30 días (como las fotos) con las entradas actuales.
    También devuelve fcLong (90 días) para el register con scroll. */
export function useForecast30(props: ProyProps): {
  fc: Forecast
  fcLong: Forecast
  fcYear: Forecast
  today: string
  schedules: ReturnType<typeof useForecastInputs>["schedules"]
} {
  const { schedules, overrides, dismissed } = useForecastInputs()
  const bills = useForecastBills()
  const today = todayKey()
  const inicio = useMemo(
    () => startingBalance(props.registers, props.balances, props.otherFunds),
    [props.registers, props.balances, props.otherFunds],
  )
  const fc = useMemo(
    () =>
      buildForecast({
        startBalance: inicio.value,
        entries: props.entries,
        schedules,
        dues: props.dues,
        balances: props.balances,
        bankTxs: props.bankOk ? props.bankTxs : [],
        today,
        horizonDays: 30,
        dismissedPaid: dismissed,
        overrides,
        bills,
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, dismissed, overrides, bills],
  )
  const fcLong = useMemo(
    () =>
      buildForecast({
        startBalance: inicio.value,
        entries: props.entries,
        schedules,
        dues: props.dues,
        balances: props.balances,
        bankTxs: props.bankOk ? props.bankTxs : [],
        today,
        horizonDays: 90,
        dismissedPaid: dismissed,
        overrides,
        bills,
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, dismissed, overrides, bills],
  )
  // Año completo para la gráfica mensual (mes a mes) de la foto 2.
  const fcYear = useMemo(
    () =>
      buildForecast({
        startBalance: inicio.value,
        entries: props.entries,
        schedules,
        dues: props.dues,
        balances: props.balances,
        bankTxs: props.bankOk ? props.bankTxs : [],
        today,
        horizonDays: 365,
        dismissedPaid: dismissed,
        overrides,
        bills,
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, dismissed, overrides, bills],
  )
  return { fc, fcLong, fcYear, today, schedules }
}

export const MESES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
export const MESES_L = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function fmtFecha(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${MESES[Number(m[2]) - 1]} ${String(Number(m[3])).padStart(2, "0")}` : "—"
}
export function fmtFechaL(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${MESES_L[Number(m[2]) - 1]} ${Number(m[3])}` : "—"
}
export function fmtDiaMes(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${MESES_L[Number(m[2]) - 1]} ${Number(m[3])}` : "—"
}
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
/** Día de la semana en inglés para una fecha ISO (sin correrse por zona horaria). */
export function fmtWeekday(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ""
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return WEEKDAYS[d.getUTCDay()]
}
export function money2(n: number): string {
  return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function signed(n: number): string {
  return (n < 0 ? "-$" : n > 0 ? "+$" : "$") + money2(n)
}

/** Display name for a schedule/entry label (normalize known names). */
export function displayLabel(s: unknown): string {
  const t = String(s ?? "").trim()
  if (/social\s*security/i.test(t)) return "SSA"
  if (/^ssa$/i.test(t)) return "SSA"
  return t
}

/** Categoría de una línea proyectada: del entry, del schedule, o inferida. */
export function lineCategory(
  line: ForecastLine,
  schedules: { id: string; category?: string }[],
): string {
  if (line.entry?.category) return line.entry.category
  if (line.scheduleId) {
    const s = schedules.find((x) => x.id === line.scheduleId)
    if (s?.category) return s.category
  }
  return line.amount > 0 ? "Income" : "Expense"
}

/** Salud del flujo en 30 días.
 *  Si el saldo inicial es muy bajo (< $50), el % vs start se dispara
 *  (ej. $14 → $7,962 = +56,769%). En ese caso medimos cobertura
 *  (ingreso vs gasto). El % mostrado se limita a ±999. */
export function healthOf(fc: Forecast): { pct: number; label: string; color: string } {
  const net = (Number(fc.end) || 0) - (Number(fc.start) || 0)
  const start = Math.abs(Number(fc.start) || 0)
  const expenses = Math.abs(Number(fc.expenseTotal) || 0)
  const income = Math.abs(Number(fc.incomeTotal) || 0)
  let pct: number
  if (start >= 50) {
    pct = Math.round((net / start) * 100)
  } else if (expenses > 0) {
    pct = Math.round(((income - expenses) / expenses) * 100)
  } else {
    pct = net >= 0 ? 100 : -50
  }
  pct = Math.max(-999, Math.min(999, pct))
  if (fc.end < 0) return { pct, label: "WEAK", color: "#ff5d6c" }
  if (pct >= 20 || net >= 200) return { pct, label: "STRONG", color: "#34d17b" }
  if (pct >= 0) return { pct, label: "FAIR", color: "#f5b84c" }
  return { pct, label: "WEAK", color: "#ff5d6c" }
}

/** Gauge semicircular rojo → amarillo → verde, como las fotos. */
export function Gauge({ health, size = 118 }: { health: ReturnType<typeof healthOf>; size?: number }) {
  const clamped = Math.max(-100, Math.min(60, health.pct))
  const frac = (clamped + 100) / 160
  const ang = Math.PI * (1 - frac)
  const cx = 120, cy = 116, R = 92
  const pt = (deg: number, rr: number) => {
    const a = (deg * Math.PI) / 180
    return { x: cx + rr * Math.cos(a), y: cy - rr * Math.sin(a) }
  }
  const arc = (r: number) => {
    const a = pt(180, r), b = pt(0, r)
    return `M${a.x},${a.y} A${r},${r} 0 0,1 ${b.x},${b.y}`
  }
  const seps = Array.from({ length: 11 }, (_, i) => {
    const deg = 180 - (i / 11) * 180
    const p1 = pt(deg, R - 14), p2 = pt(deg, R + 14)
    return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#14161d" strokeWidth="2.6" opacity="0.55" />
  })
  const tip = pt((ang * 180) / Math.PI, R - 18)
  const perp = ang + Math.PI / 2
  const b1 = { x: cx + 7.5 * Math.cos(perp), y: cy - 7.5 * Math.sin(perp) }
  const b2 = { x: cx - 7.5 * Math.cos(perp), y: cy + 7.5 * Math.sin(perp) }
  const tail = { x: cx - 20 * Math.cos(ang), y: cy + 20 * Math.sin(ang) }
  return (
    <svg viewBox="0 0 240 136" style={{ width: size, height: "auto", display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="gaugeGrad" gradientUnits="userSpaceOnUse" x1="26" y1="0" x2="214" y2="0">
          <stop offset="0" stopColor="#e5383b" />
          <stop offset="0.27" stopColor="#f06423" />
          <stop offset="0.5" stopColor="#f5a623" />
          <stop offset="0.74" stopColor="#a8c53a" />
          <stop offset="1" stopColor="#2fbf71" />
        </linearGradient>
        <linearGradient id="gaugeSheen" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="116">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.20" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gaugeHub" cx="0.38" cy="0.34" r="0.85">
          <stop offset="0" stopColor="#fdfdff" />
          <stop offset="0.7" stopColor="#d6d8e0" />
          <stop offset="1" stopColor="#a9acb8" />
        </radialGradient>
        <filter id="gaugeShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="2.4" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>
      <path d={arc(R)} fill="none" stroke="#1c1e26" strokeWidth="27" strokeLinecap="round" />
      <path d={arc(R)} fill="none" stroke="url(#gaugeGrad)" strokeWidth="25" strokeLinecap="round" />
      <path d={arc(R)} fill="none" stroke="url(#gaugeSheen)" strokeWidth="25" strokeLinecap="round" />
      {seps}
      <g filter="url(#gaugeShadow)">
        <polygon points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${b1.x.toFixed(1)},${b1.y.toFixed(1)} ${tail.x.toFixed(1)},${tail.y.toFixed(1)} ${b2.x.toFixed(1)},${b2.y.toFixed(1)}`} fill="#f7f8fb" />
      </g>
      <circle cx={cx} cy={cy} r="12" fill="url(#gaugeHub)" stroke="rgba(0,0,0,.4)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="4.4" fill="#14161d" />
    </svg>
  )
}

/** Icono por categoría (con fallback por etiqueta). Todas llevan icono. */
export function catIcon(category: string | null | undefined, label: string): string {
  const c = (category || "").toLowerCase().trim()
  const byCat: [RegExp, string][] = [
    [/income|paycheck|ingreso|sueldo|salary|ssa|social\s*security/, "💵"],
    [/fuel|gas|gasolina/, "⛽"],
    [/maintenance|mantenimiento/, "🔧"],
    [/leasing|lease/, "🚗"],
    [/rent|housing|vivienda|alquiler|local/, "🏠"],
    [/toll|e-?zpass|peaje/, "🛣️"],
    [/wash|lavado/, "🧽"],
    [/insurance|seguro/, "🛡️"],
    [/bank fee|fees|fee|banco/, "🏦"],
    [/phone|t-?mobile|mobile|tel[eé]fono|srv/, "📱"],
    [/parking|parqueo/, "🅿️"],
    [/supplies|supply|insumos/, "🧰"],
    [/grocer|market|mercado|whole/, "🛒"],
    [/food|comida|alimento|restaurant/, "🍔"],
    [/utilit|servicio/, "💡"],
    [/subscription|suscrip/, "🔁"],
    [/tax|impuesto/, "🧾"],
    [/transfer|transferencia/, "🔄"],
    [/uber/, "⬛"],
    [/lyft/, "🟪"],
    [/bill/, "📄"],
  ]
  for (const [re, icon] of byCat) if (re.test(c)) return icon
  const s = (label || "").toLowerCase()
  for (const [re, icon] of byCat) if (re.test(s)) return icon
  return "📌"
}

/* ── Flujo por fuente real (Dirección A · Flujo Contable, 2026-10-25) ──────
   El ingreso se agrupa por su ORIGEN real — la plataforma que pagó (Uber,
   Lyft, Island City Transit, SSA, Aventus Ride…) — nunca con una plantilla
   genérica que fusione plataformas o cuente deposits como ingreso.
   Los transfers internos NO son ingreso ni gasto: se suman aparte y el
   gráfico los muestra solo como nota al pie. */

export interface FlowGroup {
  name: string
  value: number
  color: string
}
export interface FlowGroups {
  sources: FlowGroup[]
  uses: FlowGroup[]
  incomeTotal: number
  expenseTotal: number
  transfersTotal: number
  transfersCount: number
}

const SOURCE_COLORS_BY_NAME: [RegExp, string][] = [
  [/^uber/i, "#34d17b"],
  [/^lyft/i, "#d663c8"],
  [/island city/i, "#5b8cff"],
  [/^ssa|social security/i, "#f5b84c"],
  [/aventus/i, "#2dd4bf"],
  [/empower/i, "#a78bfa"],
  [/gallant/i, "#ffa94d"],
  [/aki/i, "#f783ac"],
  [/texport/i, "#69db7c"],
  [/^ctg/i, "#4dabf7"],
  [/limosys/i, "#e599f7"],
]
const SOURCE_COLOR_CYCLE = ["#ffa94d", "#4dabf7", "#69db7c", "#f783ac", "#e599f7", "#63e6be", "#ffd43b", "#ff8787"]
export function sourceColor(name: string, idx: number): string {
  for (const [re, c] of SOURCE_COLORS_BY_NAME) if (re.test(name)) return c
  return SOURCE_COLOR_CYCLE[idx % SOURCE_COLOR_CYCLE.length]
}

const USE_COLORS_BY_NAME: [RegExp, string][] = [
  [/leasing|lease|car|vehicle|auto/i, "#e5484d"],
  [/rent|housing|vivienda/i, "#e0653a"],
  [/phone|internet|mobile/i, "#dd8433"],
  [/fee/i, "#c9a13b"],
  [/fuel|gas/i, "#b08968"],
  [/insurance|seguro/i, "#4a7dd8"],
  [/food|grocer|market/i, "#7fb069"],
  [/toll|e-?zpass/i, "#82a6c9"],
]
const USE_COLOR_CYCLE = ["#e5484d", "#d9483b", "#e0653a", "#dd8433", "#c9a13b", "#a06a2c", "#8a5a44", "#7a4a56"]
export function useColor(name: string, idx: number): string {
  for (const [re, c] of USE_COLORS_BY_NAME) if (re.test(name)) return c
  return USE_COLOR_CYCLE[idx % USE_COLOR_CYCLE.length]
}

type SchedLite = { id: string; category?: string; description?: string }

/** Transfer interno estricto: origen "transfer", categoría de transfer
 *  interno, o etiqueta que EMPIEZA con "Transfer". Un depósito, un payout,
 *  Zelle o Venmo NO son transfer por sí solos (ese era el bug del gráfico
 *  viejo: contaba deposits/payouts como "Transfers In"). */
export function isTransferLine(line: ForecastLine, schedules: SchedLite[]): boolean {
  const e = line.entry
  if (e?.origin === "transfer") return true
  const cat = (
    e?.category ||
    (line.scheduleId ? schedules.find((s) => s.id === line.scheduleId)?.category : "") ||
    ""
  ).toLowerCase()
  if (/internal transfer|transferencia interna/.test(cat)) return true
  const lab = (e?.description || line.label || "").toLowerCase().trim()
  if (/^transfer\b|internal transfer/.test(lab)) return true
  return false
}

/** Nombre real de la fuente de un ingreso: la plataforma del cobro
 *  (id claris:cobro:{fecha}:{plataforma} o sourceLabel "Cobros · X"),
 *  el nombre del recurrente (SSA, etc.) o la etiqueta de la línea. */
export function incomeSourceName(line: ForecastLine, schedules: SchedLite[]): string {
  const e = line.entry
  if (e) {
    const m = String(e.id || "").match(/^claris:cobro:[^:]+:(.+)$/)
    if (m) return displayLabel(m[1].replace(/_/g, " ").trim())
    const sl = String(e.sourceLabel || "")
    if (/cobros/i.test(sl) && sl.includes("·")) return displayLabel(sl.split("·").pop()!.trim())
    const d = String(e.description || "").replace(/^cobro\s+/i, "").trim()
    if (d && !/^income$/i.test(d)) return displayLabel(d)
  }
  if (line.scheduleId) {
    const s = schedules.find((x) => x.id === line.scheduleId)
    if (s?.description) return displayLabel(s.description)
  }
  const lab = displayLabel(String(line.label || "").replace(/^cobro\s+/i, "").trim())
  if (lab && !/^income$/i.test(lab)) return lab
  return "Other income"
}

/** Agrupa las líneas del forecast por fuente real / categoría real. */
export function flowGroups(lines: ForecastLine[], schedules: SchedLite[]): FlowGroups {
  const inc = new Map<string, number>()
  const exp = new Map<string, number>()
  let transfersTotal = 0
  let transfersCount = 0
  for (const l of lines) {
    if (isTransferLine(l, schedules)) {
      transfersTotal += Math.abs(l.amount)
      transfersCount++
      continue
    }
    if (l.amount > 0) {
      const n = incomeSourceName(l, schedules)
      inc.set(n, (inc.get(n) || 0) + l.amount)
    } else if (l.amount < 0) {
      let n = lineCategory(l, schedules)
      if (!n || /^(expense|gasto)$/i.test(n)) n = displayLabel(l.label) || "Other expenses"
      exp.set(n, (exp.get(n) || 0) + Math.abs(l.amount))
    }
  }
  const toArr = (m: Map<string, number>, colorFn: (n: string, i: number) => string): FlowGroup[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value: Math.round(value * 100) / 100, color: colorFn(name, i) }))
  const sources = toArr(inc, sourceColor)
  const uses = toArr(exp, useColor)
  return {
    sources,
    uses,
    incomeTotal: Math.round(sources.reduce((a, s) => a + s.value, 0) * 100) / 100,
    expenseTotal: Math.round(uses.reduce((a, s) => a + s.value, 0) * 100) / 100,
    transfersTotal: Math.round(transfersTotal * 100) / 100,
    transfersCount,
  }
}
