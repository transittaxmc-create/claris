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
 *  Acabado PROFESIONAL (Miguel, 2026-10-25): arco con gradiente
 *  continuo rojo→naranja→ámbar→verde y brillo superior, separadores
 *  finos que marcan los segmentos sin romper el gradiente, aguja en
 *  forma de diamante con sombra y buje metálico. Resolución interna
 *  2× para que se vea nítido. */
export function Gauge({ health, size = 118 }: { health: ReturnType<typeof healthOf>; size?: number }) {
  // Aguja: -100% → 180° (izq), 0% → 90° (centro-arriba), +40%+ → 0° (der)
  const clamped = Math.max(-100, Math.min(60, health.pct))
  const frac = (clamped + 100) / 160 // 0..1
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
