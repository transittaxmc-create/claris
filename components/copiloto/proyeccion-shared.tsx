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

/** Gauge semicircular rojo → amarillo → verde, como las fotos. */
export function Gauge({ health, size = 118 }: { health: ReturnType<typeof healthOf>; size?: number }) {
  // Aguja: -100% → 180° (izq), 0% → 90° (centro-arriba), +40%+ → 0° (der)
  const clamped = Math.max(-100, Math.min(60, health.pct))
  const frac = (clamped + 100) / 160 // 0..1
  const ang = Math.PI * (1 - frac)
  const cx = 60, cy = 56, r = 40
  const x2 = cx + r * Math.cos(ang), y2 = cy - r * Math.sin(ang)
  return (
    <svg viewBox="0 0 120 66" style={{ width: size, height: "auto", display: "block" }} aria-hidden>
      <path d="M12,56 A48,48 0 0,1 108,56" fill="none" stroke="#23232f" strokeWidth="12" strokeLinecap="round" />
      <path d="M12,56 A48,48 0 0,1 42,17" fill="none" stroke="#ff5d6c" strokeWidth="12" strokeLinecap="round" />
      <path d="M42,17 A48,48 0 0,1 78,17" fill="none" stroke="#f5b84c" strokeWidth="12" strokeLinecap="round" />
      <path d="M78,17 A48,48 0 0,1 108,56" fill="none" stroke="#34d17b" strokeWidth="12" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#fff" />
    </svg>
  )
}

/** Icono por categoría, como los de la foto (casa, antena, dinero, carro…). */
export function catIcon(category: string | null | undefined, label: string): string {
  const s = `${category || ""} ${label || ""}`.toLowerCase()
  if (/rent|housing|vivienda|local/.test(s)) return "🏠"
  if (/t-?mobile|phone|tel[eé]fono|srv|servicio/.test(s)) return "📡"
  if (/paycheck|income|ingreso|sueldo|salary/.test(s)) return "💵"
  if (/insurance|seguro/.test(s)) return "🚗"
  if (/car|auto|leasing|transport/.test(s)) return "🚗"
  if (/grocer|food|alimento|whole/.test(s)) return "🛒"
  if (/uber/.test(s)) return "⬛"
  if (/lyft/.test(s)) return "🟪"
  if (/gas|fuel|gasolina/.test(s)) return "⛽"
  return "•"
}
