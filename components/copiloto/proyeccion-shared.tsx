"use client"

// Compartido por las vistas clonadas de las fotos (Proyecciones = foto 1,
// Forecast = foto 2). Misma matemática de dinero-forecast.ts.

import { useMemo } from "react"
import type { CashFlowEntry } from "./types"
import type { DueItem, RegisterAccount } from "./registers-store"
import {
  buildForecast,
  startingBalance,
  todayKey,
  type Forecast,
  type ForecastBankTx,
  type ForecastLine,
} from "./dinero-forecast"
import { useForecastInputs } from "./dinero-proyeccion"

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
  today: string
  schedules: ReturnType<typeof useForecastInputs>["schedules"]
} {
  const { schedules, overrides, dismissed } = useForecastInputs()
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
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, dismissed, overrides],
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
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, dismissed, overrides],
  )
  return { fc, fcLong, today, schedules }
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

/** Salud del flujo según el cambio % del balance en 30 días. */
export function healthOf(fc: Forecast): { pct: number; label: string; labelEs: string; color: string } {
  const pct = fc.start !== 0 ? Math.round(((fc.end - fc.start) / Math.abs(fc.start)) * 100) : 0
  if (pct >= 20) return { pct, label: "STRONG", labelEs: "FUERTE", color: "#34d17b" }
  if (pct >= 0) return { pct, label: "FAIR", labelEs: "REGULAR", color: "#f5b84c" }
  return { pct, label: "WEAK", labelEs: "DÉBIL", color: "#ff5d6c" }
}

/** Gauge semicircular rojo → amarillo → verde, como las fotos.
 *  Redibujado con MÁS TONO (Miguel, 2026-10-25, contra su foto
 *  original): el arco va SEGMENTADO en 27 piezas con el color
 *  graduado rojo→naranja→ámbar→verde (no 3 bloques planos), y la
 *  aguja es una flecha blanca afilada con su centro, como la foto. */
const GAUGE_STOPS: [number, number, number][] = [
  [229, 56, 59], // rojo
  [240, 100, 35], // naranja
  [245, 166, 35], // ámbar
  [168, 197, 58], // verde-amarillo
  [47, 191, 113], // verde
]
function gaugeColor(t: number): string {
  const x = Math.max(0, Math.min(0.9999, t)) * (GAUGE_STOPS.length - 1)
  const i = Math.floor(x), f = x - i
  const a = GAUGE_STOPS[i], b = GAUGE_STOPS[i + 1]
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
export function Gauge({ health, size = 118 }: { health: ReturnType<typeof healthOf>; size?: number }) {
  // Aguja: -100% → 180° (izq), 0% → 90° (centro-arriba), +40%+ → 0° (der)
  const clamped = Math.max(-100, Math.min(60, health.pct))
  const frac = (clamped + 100) / 160 // 0..1
  const ang = Math.PI * (1 - frac)
  const cx = 60, cy = 58, R = 45
  const SEG = 27
  const pt = (deg: number, rr: number) => {
    const a = (deg * Math.PI) / 180
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy - rr * Math.sin(a)).toFixed(2)}`
  }
  const segs = Array.from({ length: SEG }, (_, i) => {
    const a0 = 180 - ((i + 0.14) / SEG) * 180
    const a1 = 180 - ((i + 0.86) / SEG) * 180
    return (
      <path
        key={i}
        d={`M${pt(a0, R)} A${R},${R} 0 0,1 ${pt(a1, R)}`}
        fill="none"
        stroke={gaugeColor(i / (SEG - 1))}
        strokeWidth="12.5"
      />
    )
  })
  // Aguja afilada: punta a R-9, base ancha junto al centro.
  const tip = { x: cx + (R - 9) * Math.cos(ang), y: cy - (R - 9) * Math.sin(ang) }
  const perp = ang + Math.PI / 2
  const b1 = { x: cx + 4.6 * Math.cos(perp), y: cy - 4.6 * Math.sin(perp) }
  const b2 = { x: cx - 4.6 * Math.cos(perp), y: cy + 4.6 * Math.sin(perp) }
  const tail = { x: cx - 9 * Math.cos(ang), y: cy + 9 * Math.sin(ang) }
  return (
    <svg viewBox="0 0 120 68" style={{ width: size, height: "auto", display: "block" }} aria-hidden>
      {segs}
      <polygon points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${b1.x.toFixed(1)},${b1.y.toFixed(1)} ${tail.x.toFixed(1)},${tail.y.toFixed(1)} ${b2.x.toFixed(1)},${b2.y.toFixed(1)}`} fill="#f5f6fa" stroke="rgba(0,0,0,.35)" strokeWidth="0.7" />
      <circle cx={cx} cy={cy} r="6" fill="#f5f6fa" stroke="rgba(0,0,0,.3)" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r="2.4" fill="#14161d" />
    </svg>
  )
}

/** Icono por categoría (con fallback por etiqueta). Todas llevan icono. */
export function catIcon(category: string | null | undefined, label: string): string {
  const c = (category || "").toLowerCase().trim()
  const byCat: [RegExp, string][] = [
    [/income|paycheck|ingreso|sueldo|salary/, "💵"],
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
