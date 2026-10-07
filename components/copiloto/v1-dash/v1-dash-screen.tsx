"use client"

// DASHBOARD clonado intacto de IslandCity Driver Accounting v1
// (https://islandcity.vercel.app/, pestaña DASH).
//
// Misma configuración, mismos colores, mismos textos, mismos cálculos.
// Solo cambia la fuente de datos: en vez del estado interno de v1, lee los
// viajes y gastos de Copiloto v6 (este repo).
//
// Desviación intencional y única respecto a v1: la tarjeta "Financial
// Intelligence" de v1 calculaba el INCOME del mes filtrando SOLO los viajes
// de hoy (bug de v1); aquí suma los viajes reales del mes, que es lo que la
// tarjeta promete ("October 2026"). Todo lo demás es idéntico.

import { useMemo, useState, type CSSProperties } from "react"
import { localDateKey } from "@/lib/dates"
import { grossOf, tripDateOf, type Expense, type Trip } from "../types"
import { recommendZones } from "./v1-dash-zones"
import type { ShiftApi } from "../shift"

// Estilo dorado de v1 (const us del bundle), intacto.
const GOLD_TEXT: CSSProperties = {
  background: "linear-gradient(90deg, #f6dd8c, #d9b64f)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
}

// Tarifa IRS 2025 de v1 (const _s del bundle), intacta.
const IRS_RATE = 0.7

export const V1_DAILY_GOAL_KEY = "claris_v1dash_daily_goal"
const V1_DEFAULT_DAILY_GOAL = 45 // default de v1 (seed $w(): goal:45)

// ---- Viaje/gasto en forma v1 ----
type V1Trip = { datetime: string; earnings: number; tips: number; extraCash: number; toll: number }
type V1Expense = { dueDate?: string; createdAt?: string; amount: number; frequency?: string }

function toV1Trip(t: Trip, todayKey: string): V1Trip {
  const raw = t.raw as { datetime?: unknown } | undefined
  const dt = typeof raw?.datetime === "string" && !Number.isNaN(new Date(raw.datetime).getTime())
    ? (raw.datetime as string)
    : `${todayKey}T${t.time || "12:00"}:00`
  return { datetime: dt, earnings: t.earnings || 0, tips: t.tips || 0, extraCash: t.extraCash || 0, toll: t.toll || 0 }
}

function toV1Expense(e: Expense): V1Expense {
  return { dueDate: e.date, createdAt: e.date, amount: Number(e.amount) || 0 }
}

// ---- s4: gauge semicircular $/HR (v1 intacto) ----
function Gauge({ perHourGross, goal }: { perHourGross: number; goal: number }) {
  const c = (e: number) => 180 + Math.min(e / 100, 1) * 180
  const f = (e: number, m: number) => ({
    x: 150 + e * Math.cos((m * Math.PI) / 180),
    y: 128 + e * Math.sin((m * Math.PI) / 180),
  })
  const d = (e: number, m: number, a: number) => {
    const t = f(e, m)
    const k = f(e, a)
    return `M${t.x.toFixed(1)} ${t.y.toFixed(1)} A${e} ${e} 0 ${a - m >= 180 ? 1 : 0} 1 ${k.x.toFixed(1)} ${k.y.toFixed(1)}`
  }
  const h = [
    { min: 0, max: 60, color: "#ef4444" },
    { min: 60, max: 70, color: "#f97316" },
    { min: 70, max: 80, color: "#fbbf24" },
    { min: 80, max: 90, color: "#4ade80" },
    { min: 90, max: 100, color: "#3b82f6" },
  ]
  const g = h.find((e) => perHourGross >= e.min && (e.max >= 100 || perHourGross < e.max)) ?? h[0]
  const y = perHourGross > 0 ? g.color : "#374151"
  const b = c(Math.min(Math.max(perHourGross, 0), 100))
  const x = f(90, b)
  const o = f(9, b + 90)
  const w = f(9, b - 90)
  const s = c(Math.min(goal, 100))
  const j = f(104 - 18 / 2 + 1, s)
  const n = f(104 + 18 / 2 - 3, s)
  return (
    <svg width="100%" height="136" viewBox="0 0 300 136" style={{ overflow: "visible" }}>
      <path d={d(104, 180, 360)} fill="none" stroke="#1c1c1c" strokeWidth={18} />
      {h.map((e) => (
        <path
          key={e.min}
          d={d(104, c(e.min), c(Math.min(e.max, 100)))}
          fill="none"
          stroke={e.color}
          strokeWidth={18}
          strokeLinecap="butt"
          opacity={0.9}
        />
      ))}
      <line x1={j.x} y1={j.y} x2={n.x} y2={n.y} stroke="#f6dd8c" strokeWidth="3" opacity="0.9" />
      {[60, 70, 80, 90].map((e) => {
        const m2 = c(e)
        const a = f(104 - 18 / 2 + 1, m2)
        const t = f(104 + 18 / 2 - 3, m2)
        return <line key={e} x1={a.x} y1={a.y} x2={t.x} y2={t.y} stroke="#000" strokeWidth="2" opacity="0.6" />
      })}
      {[
        { v: 0, t: "$0" },
        { v: 60, t: "$60" },
        { v: 70, t: "$70" },
        { v: 80, t: "$80" },
        { v: 90, t: "$90" },
        { v: 100, t: "$100+" },
      ].map(({ v: e, t: m2 }) => {
        const a = c(e)
        const t2 = f(104 + 18 / 2 + 9, a)
        return (
          <text
            key={e}
            x={t2.x}
            y={t2.y + 4}
            textAnchor={e <= 20 ? "end" : "start"}
            fill="#4b5563"
            fontSize="9"
            fontFamily="monospace"
          >
            {m2}
          </text>
        )
      })}
      <polygon points={`${x.x},${x.y} ${o.x},${o.y} ${w.x},${w.y}`} fill={y} opacity="0.92" />
      <circle cx={150} cy={128} r="9" fill="#0a0a0a" stroke={y} strokeWidth="2" />
      <text x={150} y={102} textAnchor="middle" fill={y} fontSize="28" fontWeight="900" fontFamily="'JetBrains Mono',monospace">
        {perHourGross > 0 ? `$${perHourGross.toFixed(0)}` : "$0"}
      </text>
      <text x={150} y={119} textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">
        /hr gross
      </text>
      {perHourGross > 0 && (
        <text
          x={150}
          y={146}
          textAnchor="middle"
          fill={y}
          fontSize="8"
          fontWeight="bold"
          fontFamily="monospace"
          letterSpacing="2"
        >
          {perHourGross >= 90 ? "EXCEPTIONAL" : perHourGross >= 70 ? "EXCELLENT" : perHourGross >= 60 ? "MINIMUM OK" : "⚠ BELOW $60"}
        </text>
      )}
    </svg>
  )
}

// ---- f4: anillo de progreso de la meta diaria (v1 intacto) ----
function GoalRing({ grossToday, todayGoal, goalPct }: { grossToday: number; todayGoal: number; goalPct: number }) {
  const f = 2 * Math.PI * 36
  const d = f * Math.min(goalPct / 100, 1)
  const h = goalPct >= 100 ? "#4ade80" : goalPct >= 70 ? "#f6dd8c" : "#d9b64f"
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
      <circle cx={44} cy={44} r={36} fill="none" stroke="#1e1e1e" strokeWidth={9} />
      <circle
        cx={44}
        cy={44}
        r={36}
        fill="none"
        stroke={h}
        strokeWidth={9}
        strokeDasharray={`${d} ${f}`}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={44} y={45} textAnchor="middle" dominantBaseline="middle" fill={h} fontSize="13" fontWeight="900" fontFamily="'JetBrains Mono',monospace">
        {goalPct.toFixed(0)}%
      </text>
      <text x={44} y={60} textAnchor="middle" fill="#4b5563" fontSize="8" fontFamily="monospace">
        ${grossToday.toFixed(0)}/${todayGoal}
      </text>
    </svg>
  )
}

// ---- p4: ZONES HOY (v1 intacto) ----
function ZonesCard({ zones, clock, hasGps }: { zones: ReturnType<typeof recommendZones>; clock: Date; hasGps: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #2a2200", borderLeft: "3px solid #f6dd8c" }}>
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5" style={{ borderBottom: "1px solid #2a2200" }}>
        <div className="flex items-center gap-2">
          <span className="text-[15px]">🗺</span>
          <div>
            <p className="text-[9px] tracking-[0.18em] font-bold" style={{ color: "#f6dd8c" }}>
              ZONES HOY
            </p>
            <p className="text-[8px] text-neutral-500 mt-0.5">
              {clock.getDay() === 0 || clock.getDay() === 6 ? "Fin de semana" : "Día laboral"}
              {" · "}
              {clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-neutral-500 font-mono-jet">NYC TLC data</p>
          <p className="text-[8px] text-neutral-600">2023–2025 avg</p>
        </div>
      </div>
      <div className="px-3.5 py-2.5 space-y-2.5">
        {zones.length === 0 ? (
          <p className="text-[11px] text-neutral-500 py-1">No hay datos para esta hora.</p>
        ) : (
          zones.map((r, o) => {
            const l = o === 0
            const c = r.km !== null ? (r.km < 1 ? `${(r.km * 1e3).toFixed(0)} m` : `${r.km.toFixed(1)} km`) : null
            return (
              <div key={r.id} className="flex items-center gap-2.5">
                <div className="flex flex-col items-center gap-0.5 w-5 flex-shrink-0">
                  <span className="text-[14px] leading-none">{r.heat === "hot" ? "🔥" : r.heat === "warm" ? "🟡" : "⚪"}</span>
                  <span
                    className="text-[7px] font-mono-jet font-bold"
                    style={{ color: r.heat === "hot" ? "#fb923c" : r.heat === "warm" ? "#fbbf24" : "#6b7280" }}
                  >
                    {r.heat === "hot" ? "ALTA" : r.heat === "warm" ? "MEDIA" : "BAJA"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-semibold leading-tight truncate ${l ? "text-white" : "text-neutral-300"}`}>
                    {r.name}
                  </p>
                  {l && (
                    <p className="text-[8px] font-mono-jet mt-0.5" style={{ color: r.heat === "hot" ? "#fb923c" : "#fbbf24" }}>
                      ↑ Mejor zona ahora
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {c ? (
                    <span className="font-mono-jet text-[10px] text-neutral-400">{c}</span>
                  ) : (
                    <span className="font-mono-jet text-[9px] text-neutral-600">GPS off</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      <div className="px-3.5 pb-3 pt-1.5 flex items-center justify-between" style={{ borderTop: "1px solid #2a2200" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px]">🔥</span>
          <span className="text-[8px] text-neutral-600">Alta</span>
          <span className="text-[10px] ml-1">🟡</span>
          <span className="text-[8px] text-neutral-600">Media</span>
          <span className="text-[10px] ml-1">⚪</span>
          <span className="text-[8px] text-neutral-600">Baja</span>
        </div>
        <span className="text-[8px] font-mono-jet text-neutral-600">{hasGps ? "± GPS activo" : "Activa GPS p/ distancia"}</span>
      </div>
    </div>
  )
}

// ---- m4: tira semanal TRIPS TODAY / AVG/TRIP / WEEK TOTAL (v1 intacto) ----
function WeekStrip({ todayTripCount, grossToday, weeklyTotal }: { todayTripCount: number; grossToday: number; weeklyTotal: number }) {
  return (
    <div className="grid grid-cols-3 gap-0 bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl overflow-hidden">
      <div className="p-3 border-r border-[#1f1f1f] text-center">
        <p className="text-[9px] text-neutral-400 tracking-widest">TRIPS TODAY</p>
        <p className="font-mono-jet text-[13px] font-semibold mt-1 text-white">{todayTripCount}</p>
      </div>
      <div className="p-3 border-r border-[#1f1f1f] text-center">
        <p className="text-[9px] text-neutral-400 tracking-widest">AVG/TRIP</p>
        <p className="font-mono-jet text-[13px] font-semibold mt-1 text-[#f6dd8c]">
          ${todayTripCount ? (grossToday / todayTripCount).toFixed(2) : "0.00"}
        </p>
      </div>
      <div className="p-3 text-center">
        <p className="text-[9px] text-neutral-400 tracking-widest">WEEK TOTAL</p>
        <p className="font-mono-jet text-[13px] font-semibold mt-1 text-[#f5c518]">${weeklyTotal.toFixed(2)}</p>
      </div>
    </div>
  )
}

// ---- y4: E-ZPASS tolls (v1 intacto) ----
function TollsCard({
  tollYear,
  totalTollsToday,
  tollsWeek,
  tollsMonth,
  tollsYear,
  shiftActive,
}: {
  tollYear: number
  totalTollsToday: number
  tollsWeek: number
  tollsMonth: number
  tollsYear: number
  shiftActive: boolean
}) {
  return (
    <div className="rounded-xl bg-[#1a1625] border border-[#2a2340] border-l-[3px] border-l-[#8b5cf6] p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
          <p className="text-[10px] tracking-[0.18em] font-bold text-[#a78bfa]">E-ZPASS {tollYear} · TOLLS PAID</p>
        </div>
        <span className="font-mono-jet text-[11px] font-bold text-[#c4b5fd]">${totalTollsToday.toFixed(2)} today</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["WEEK", tollsWeek],
            ["MONTH", tollsMonth],
            ["YEAR", tollsYear],
          ] as Array<[string, number]>
        ).map(([c, f]) => (
          <div key={c} className="text-center">
            <p className="text-[8px] text-[#6d5a9c] tracking-widest">{c}</p>
            <p className="font-mono-jet text-[12px] font-semibold text-[#c4b5fd] mt-0.5">${f.toFixed(2)}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#c4b5fd]/70 mt-2">
        {shiftActive ? "📡 Geofencing active — auto-detecting tolls" : "Start your shift for auto toll detection"}
      </p>
    </div>
  )
}

// ---- d4: Financial Intelligence (tarjeta del mes, v1 intacta) ----
function MonthCard({
  clock,
  earnMonth,
  expMonth,
  monthGoal,
  monthPct,
  onTrack,
}: {
  clock: Date
  earnMonth: number
  expMonth: number
  monthGoal: number
  monthPct: number
  onTrack: boolean
}) {
  const c = earnMonth - expMonth
  return (
    <div className="rounded-[20px] p-4" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[9px] tracking-[0.22em] text-neutral-300 font-bold uppercase">Financial Intelligence</p>
          <p className="text-[11px] font-semibold text-neutral-300 mt-0.5">
            {clock.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.12em] border ${
            onTrack ? "bg-[#052e16] border-[#4ade8044] text-[#4ade80]" : "bg-[#1a0f00] border-[#f6dd8c44] text-[#f6dd8c]"
          }`}
        >
          {onTrack ? "✓ On track" : "↗ Keep pushing"}
        </span>
      </div>
      <div className="mb-3">
        <p className="text-[8px] text-neutral-400 uppercase tracking-widest">Net balance</p>
        <p className={`font-mono-jet text-[30px] font-black leading-none tracking-tight mt-0.5 ${c >= 0 ? "text-[#f6dd8c]" : "text-red-400"}`}>
          {c >= 0 ? "+" : ""}
          {c.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className="flex gap-4 mb-3">
        <div>
          <p className="text-[8px] text-neutral-400 uppercase tracking-widest">INCOME</p>
          <p className="font-mono-jet text-[16px] font-bold text-[#4ade80] mt-0.5">
            ${earnMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-[8px] text-neutral-400 uppercase tracking-widest">EXPENSES</p>
          <p className="font-mono-jet text-[16px] font-bold text-red-400 mt-0.5">
            -${expMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
      {monthGoal > 0 && (
        <div>
          <div className="flex justify-between text-[9px] mb-1.5">
            <span className="font-mono-jet text-neutral-400">${earnMonth.toFixed(0)} earned</span>
            <span className="font-mono-jet text-[#f6dd8c]">Goal ${monthGoal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${monthPct}%`, background: "linear-gradient(90deg,#d9b64f,#f6dd8c)" }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ---- h4: SHIFT BREAKDOWN (v1 intacto) ----
function ShiftBreakdown({
  todayTrips,
  grossToday,
  expensesToday,
  expensesTodayCount,
  netToday,
  weeklyTotal,
  totalTollsToday,
}: {
  todayTrips: V1Trip[]
  grossToday: number
  expensesToday: number
  expensesTodayCount: number
  netToday: number
  weeklyTotal: number
  totalTollsToday: number
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.22em] text-neutral-400 font-bold mb-2.5">SHIFT BREAKDOWN</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl p-3.5 flex items-start justify-between gap-3" style={{ background: "#0d0d0d", border: "1px solid #1e1400" }}>
          <div className="flex-1">
            <p className="text-[9px] tracking-[0.18em] font-bold mb-2" style={{ color: "#d97706" }}>
              TODAY&apos;S BREAKDOWN
            </p>
            <div className="space-y-1">
              {(
                [
                  ["Fare", todayTrips.reduce((f, d) => f + (d.earnings || 0), 0)],
                  ["Tips", todayTrips.reduce((f, d) => f + (d.tips || 0) + (d.extraCash || 0), 0)],
                  ["Tolls", totalTollsToday],
                ] as Array<[string, number]>
              ).map(([f, d]) => (
                <div key={f} className="flex items-center gap-4">
                  <span className="text-[10px] text-neutral-400 font-mono-jet w-14">{f}</span>
                  <span className="font-mono-jet text-[12px] font-semibold text-neutral-100">${d.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[8px] text-neutral-400 tracking-widest uppercase mb-1">GROSS TODAY</p>
            <p className="font-mono-jet text-[22px] font-black text-[#f6dd8c] leading-none">${grossToday.toFixed(2)}</p>
            <p className="text-[9px] text-neutral-400 mt-0.5">
              {todayTrips.length} trip{todayTrips.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="rounded-xl p-3.5" style={{ background: "#0d0d0d", border: "1px solid #1e0a0a" }}>
          <p className="text-[9px] tracking-[0.18em] font-bold text-[#ef4444]">TODAY&apos;S EXPENSES</p>
          <p className="font-mono-jet text-[22px] font-black text-[#ef4444] mt-2">
            {expensesToday > 0 ? `−$${expensesToday.toFixed(2)}` : "$0.00"}
          </p>
          <p className="text-[10px] text-neutral-400 mt-1 font-mono-jet">{expensesTodayCount} entries today</p>
        </div>
        <div className="rounded-xl p-3.5" style={{ background: "#0d0d0d", border: `1px solid ${netToday >= 0 ? "#0a1e0a" : "#1e0a0a"}` }}>
          <p className={`text-[9px] tracking-[0.18em] font-bold ${netToday >= 0 ? "text-[#4ade80]" : "text-[#ef4444]"}`}>
            NET EARNINGS TODAY
          </p>
          <p className={`font-mono-jet text-[22px] font-black mt-2 ${netToday >= 0 ? "text-[#4ade80]" : "text-[#ef4444]"}`}>
            ${netToday.toFixed(2)}
          </p>
          <p className="text-[10px] text-neutral-400 mt-1 font-mono-jet">
            income − expenses · weekly ref. ${weeklyTotal.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ================= Pantalla principal (g4 de v1, intacta) =================

function loadDailyGoal(): number {
  try {
    const n = Number(localStorage.getItem(V1_DAILY_GOAL_KEY))
    if (Number.isFinite(n) && n > 0) return n
  } catch {}
  return V1_DEFAULT_DAILY_GOAL
}

type CoachType = "gold" | "hot" | "warm" | "good" | "purple" | "cold" | "warn" | "neutral"

const COACH_STYLE: Record<CoachType, string> = {
  gold: "bg-[#1a1600] border border-[#2a2200] border-l-[#f6dd8c]",
  hot: "bg-[#1a0800] border border-[#2a1000] border-l-[#fb923c]",
  warm: "bg-[#1a1200] border border-[#2a1e00] border-l-[#fbbf24]",
  good: "bg-[#052e16] border border-[#166534] border-l-[#4ade80]",
  purple: "bg-[#1a1625] border border-[#2a2340] border-l-[#a78bfa]",
  cold: "bg-[#0a0a14] border border-[#1a1a2a] border-l-[#60a5fa]",
  warn: "bg-[#1a0f00] border border-[#2a1800] border-l-[#f59e0b]",
  neutral: "bg-[#141414] border border-[#2e2e2e] border-l-[#374151]",
}

export function V1DashScreen({
  trips,
  expenses,
  shift,
  onGoData,
}: {
  trips: Trip[]
  expenses: Expense[]
  shift: ShiftApi
  onGoData: () => void
}) {
  const [dailyGoal] = useState<number>(() => loadDailyGoal())

  // Reloj y estado del turno vienen del turno unificado (el mismo que HOY).
  const clock = shift.now
  const {
    shiftActive,
    isOnBreak,
    activeHoursDecimal,
    shiftMiles,
    hourlyGoal,
    setHourlyGoal,
    gps,
    onStart,
    onBreak,
    onEnd,
    onRefreshGps,
  } = shift

  const todayKey = localDateKey(clock)
  const monthKey = `${clock.getFullYear()}-${String(clock.getMonth() + 1).padStart(2, "0")}`
  const utcToday = clock.toISOString().slice(0, 10) // v1 usa fecha UTC aquí, intacto

  const v1Trips = useMemo(() => trips.map((t) => toV1Trip(t, todayKey)), [trips, todayKey])
  const v1Expenses = useMemo(() => expenses.map(toV1Expense), [expenses])
  const tripKeys = useMemo(() => trips.map((t) => tripDateOf(t)), [trips])

  const todayTrips = useMemo(
    () => v1Trips.filter((t) => t.datetime.slice(0, 10) === todayKey),
    [v1Trips, todayKey],
  )
  const grossToday = useMemo(
    () => todayTrips.reduce((s, t) => s + t.earnings + t.tips + t.extraCash + t.toll, 0),
    [todayTrips],
  )

  // $/HR (lógica v1 intacta)
  const perHour = useMemo(() => {
    if (grossToday <= 0) return 0
    if (activeHoursDecimal > 0.1) return grossToday / activeHoursDecimal
    const q = todayTrips
      .map((u) => new Date(u.datetime).getTime())
      .sort((a, b) => a - b)
    if (q.length === 0) return 0
    const span = q.length === 1 ? 0.25 : Math.max((Date.now() - q[0]) / 36e5, 0.25)
    return grossToday / span
  }, [grossToday, activeHoursDecimal, todayTrips])

  const goalPct = Math.min((grossToday / dailyGoal) * 100, 100)
  const remaining = Math.max(dailyGoal - grossToday, 0)
  const eta = perHour <= 0 || grossToday >= dailyGoal ? null : new Date(Date.now() + (remaining / perHour) * 36e5)

  const expensesToday = useMemo(
    () =>
      v1Expenses
        .filter((p) => (p.dueDate || p.createdAt || "").slice(0, 10) === utcToday)
        .reduce((s, q) => s + q.amount, 0),
    [v1Expenses, utcToday],
  )
  const expensesTodayCount = useMemo(
    () => v1Expenses.filter((p) => (p.dueDate || p.createdAt || "").slice(0, 10) === utcToday).length,
    [v1Expenses, utcToday],
  )
  const netToday = grossToday - expensesToday

  // Semana (lunes a hoy), como v1
  const weeklyTotal = useMemo(() => {
    const te = new Date(clock)
    const me = (te.getDay() + 6) % 7
    te.setDate(te.getDate() - me)
    const mondayKey = localDateKey(te)
    let s = 0
    trips.forEach((t, i) => {
      const k = tripKeys[i]
      if (k >= mondayKey && k <= todayKey) s += grossOf(t)
    })
    return s
  }, [trips, tripKeys, clock, todayKey])

  // Mes: INCOME con los viajes reales del mes (v1 filtraba solo los de hoy;
  // se usa el mes real porque la tarjeta dice "October 2026").
  const earnMonth = useMemo(() => {
    let s = 0
    trips.forEach((t, i) => {
      if (tripKeys[i].startsWith(monthKey)) s += grossOf(t)
    })
    return s
  }, [trips, tripKeys, monthKey])
  const expMonth = useMemo(
    () =>
      v1Expenses
        .filter((p) => (p.dueDate || p.createdAt || "").startsWith(monthKey) && p.frequency !== "monthly" && p.frequency !== "weekly")
        .reduce((s, q) => s + q.amount, 0),
    [v1Expenses, monthKey],
  )
  const monthGoal = dailyGoal * 4.33
  const monthPct = monthGoal > 0 ? Math.min((earnMonth / monthGoal) * 100, 100) : 0
  const daysInMonth = new Date(clock.getFullYear(), clock.getMonth() + 1, 0).getDate()
  const onTrack = earnMonth >= monthGoal * (clock.getDate() / daysInMonth) * 0.85

  // Peajes por período
  const tollSum = useMemo(() => {
    const inWeek = (k: string) => {
      const te = new Date(clock)
      const me = (te.getDay() + 6) % 7
      te.setDate(te.getDate() - me)
      const mk = localDateKey(te)
      return k >= mk && k <= todayKey
    }
    let day = 0, week = 0, month = 0, year = 0
    const yk = `${clock.getFullYear()}`
    trips.forEach((t, i) => {
      const k = tripKeys[i]
      const toll = Number(t.toll) || 0
      if (k === todayKey) day += toll
      if (inWeek(k)) week += toll
      if (k.startsWith(monthKey)) month += toll
      if (k.startsWith(yk)) year += toll
    })
    return { day, week, month, year }
  }, [trips, tripKeys, clock, todayKey, monthKey])

  // Mensaje coach (lógica v1 intacta)
  const coach = useMemo(() => {
    const p = clock.getHours()
    const q = clock.getDay()
    const wd = q >= 1 && q <= 5
    if (grossToday >= dailyGoal)
      return { emoji: "🏆", text: `Goal $${dailyGoal} reached. Exceptional shift!`, type: "gold" as CoachType }
    if (perHour > 0) {
      if (perHour < 60)
        return {
          emoji: "🚨",
          text: `Your rate of $${perHour.toFixed(0)}/hr is below your healthy zone (minimum $60/hr). Consider repositioning — check the high-demand zones below.`,
          type: "warn" as CoachType,
        }
      if (perHour < 70)
        return {
          emoji: "📊",
          text: `Running $${perHour.toFixed(0)}/hr — acceptable pace, but room to improve. Stay in active zones and catch the peaks.`,
          type: "warm" as CoachType,
        }
      if (perHour < 90)
        return {
          emoji: "💪",
          text: `Strong pace — $${perHour.toFixed(0)}/hr. You're in the sweet spot. Keep it up and make every opportunity count.`,
          type: "good" as CoachType,
        }
      return {
        emoji: "🚀",
        text: `Exceptional pace — $${perHour.toFixed(0)}/hr. Top-tier shift. Don't stop.`,
        type: "gold" as CoachType,
      }
    }
    if (wd && p >= 7 && p < 9)
      return { emoji: "🔥", text: "Morning rush — Midtown, Queens→Manhattan, Penn Station. Get moving.", type: "hot" as CoachType }
    if (p >= 12 && p < 14)
      return { emoji: "🍽", text: "Lunch surge — Midtown, Financial District (FiDi), Brooklyn Heights. Quick short trips.", type: "warm" as CoachType }
    if (wd && p >= 17 && p < 20)
      return { emoji: "⚡", text: "Afternoon peak — best hour of the day. JFK/LGA also active. Push hard.", type: "hot" as CoachType }
    if (!wd && (p >= 22 || p < 2))
      return { emoji: "🌙", text: "Weekend night — LES, Williamsburg, Midtown. High surge potential.", type: "purple" as CoachType }
    if (p >= 2 && p < 6)
      return { emoji: "😴", text: "Dead zone 2–6 AM — very low demand. Rest or reposition.", type: "cold" as CoachType }
    if (wd && p >= 9 && p < 11)
      return { emoji: "📉", text: "Post-rush lull. Good time for a break or queuing at JFK/LGA.", type: "warn" as CoachType }
    return { emoji: "📍", text: "Start your shift to begin tracking your performance.", type: "neutral" as CoachType }
  }, [clock, grossToday, dailyGoal, perHour])

  const zones = useMemo(
    () => recommendZones(clock.getHours(), clock.getDay(), gps?.lat ?? null, gps?.lng ?? null),
    [clock, gps],
  )

  const greeting = clock.getHours() < 6 ? "Good evening" : clock.getHours() < 12 ? "Good morning" : clock.getHours() < 19 ? "Good afternoon" : "Good evening"
  const statusLabel = shiftActive ? (isOnBreak ? "ON BREAK" : "ON DUTY") : "OFF DUTY"
  const badgeStyle: CSSProperties =
    shiftActive && !isOnBreak
      ? { background: "#052e16", borderColor: "#4ade8066", color: "#4ade80" }
      : shiftActive && isOnBreak
        ? { background: "#1c0d00", borderColor: "#f9731666", color: "#f97316" }
        : { background: "#111", borderColor: "#2a2a2a", color: "#737373" }
  const dotClass = shiftActive && !isOnBreak ? "bg-[#4ade80] animate-pulse" : shiftActive && isOnBreak ? "bg-[#f97316] animate-pulse" : "bg-neutral-600"

  return (
    <div className="v1-dash h-full overflow-y-auto">
      <div className="px-3 pt-3 pb-6">
        <div className="space-y-5">
          {/* Encabezado */}
          <div>
            <h2 className="text-[24px] font-bold leading-tight">
              {greeting}, Miguel.
            </h2>
            <p className="font-mono-jet text-[11px] tracking-[0.18em] mt-1.5 uppercase" style={GOLD_TEXT}>
              {clock.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
            </p>
            <p className="font-mono-jet text-[10px] text-neutral-400 mt-1">
              {clock.toLocaleTimeString()}
              {gps ? ` · ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : " · Locating…"}
            </p>
          </div>

          {/* Tarjeta de turno */}
          <div
            className="rounded-[20px] px-4 pt-3.5 pb-3 overflow-hidden relative"
            style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", boxShadow: "0 0 0 1px #1a1200 inset" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #d97706, #f6dd8c44, transparent)" }} />
            <div className="flex items-center justify-between">
              <p className="font-mono-jet text-[10px] text-neutral-400">
                {clock.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" · "}
                {clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] tracking-[0.12em] font-bold" style={badgeStyle}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                {statusLabel}
              </span>
            </div>
            <div className="mt-2">
              <p className="font-mono-jet text-[11px] text-neutral-400">
                {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : "GPS inactive"}
                {gps?.acc ? ` · ±${Math.round(gps.acc)}m` : ""}
              </p>
            </div>
            <p className="font-mono-jet text-[32px] font-black mt-2 tracking-tight" style={GOLD_TEXT}>
              ${grossToday.toFixed(2)}
            </p>
            <p className="font-mono-jet text-[10px] text-neutral-400 mt-0.5">
              {todayTrips.length} {todayTrips.length === 1 ? "trip" : "trips"} · fare + tips + tolls
            </p>
            <div className="mt-3 h-px" style={{ background: "linear-gradient(90deg, #1e1400, #1e1e1e)" }} />
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${shiftActive && !isOnBreak ? "bg-[#4ade80]" : shiftActive && isOnBreak ? "bg-[#f97316]" : "bg-neutral-700"}`} />
              <span className={`text-[10px] font-mono-jet ${shiftActive && !isOnBreak ? "text-[#4ade80]" : shiftActive && isOnBreak ? "text-[#f97316]" : "text-neutral-400"}`}>
                {shiftActive ? (isOnBreak ? "On break" : "On duty") : "Shift ended"}
              </span>
              <button
                onClick={onRefreshGps}
                className="ml-auto text-[9px] text-neutral-400 font-mono-jet flex items-center gap-1 active:opacity-60"
                title="Tap to refresh GPS"
              >
                <span className={`w-1 h-1 rounded-full ${gps ? "bg-[#4ade80]" : "bg-neutral-600"}`} />
                GPS {gps ? "active" : "inactive"} ↻
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["START", "BREAK", "END"] as const).map((p) => {
                const activeBtn = (p === "START" && shiftActive && !isOnBreak) || (p === "BREAK" && isOnBreak) || (p === "END" && !shiftActive)
                const disabled = p === "BREAK" && !shiftActive
                return (
                  <button
                    key={p}
                    onClick={() => (p === "START" ? onStart() : p === "BREAK" ? onBreak() : onEnd())}
                    disabled={disabled}
                    className="h-[38px] rounded-full border text-[11px] tracking-[0.12em] font-bold transition-all"
                    style={
                      disabled
                        ? { background: "#0a0a0a", border: "1px solid #1a1a1a", color: "#444" }
                        : activeBtn
                          ? { background: "linear-gradient(90deg, #f6dd8c, #d9b64f)", border: "1px solid #d9b64f", color: "#000" }
                          : { background: "transparent", border: "1px solid #d9b64f99", color: "#f6dd8c" }
                    }
                  >
                    {p === "BREAK" ? (isOnBreak ? "RESUME" : "BREAK") : p === "END" ? "END SHIFT" : "START"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* $/HR NOW */}
          <div className="rounded-[20px] p-4 space-y-4" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] tracking-[0.18em] font-bold" style={GOLD_TEXT}>
                $/HR NOW
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-[0.12em]" style={badgeStyle}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                {statusLabel}
              </span>
            </div>

            <Gauge perHourGross={perHour} goal={hourlyGoal} />

            <div className="flex items-center gap-4 bg-[#080808] border border-[#1a1a1a] rounded-2xl p-3.5">
              <GoalRing grossToday={grossToday} todayGoal={dailyGoal} goalPct={goalPct} />
              <div className="flex-1 min-w-0">
                <p className="text-[8px] text-neutral-400 uppercase tracking-widest">EARNED TODAY</p>
                <p
                  className="font-mono-jet text-[24px] font-black leading-none mt-0.5"
                  style={{ color: goalPct >= 100 ? "#4ade80" : goalPct >= 70 ? "#f6dd8c" : "#d9b64f" }}
                >
                  ${grossToday.toFixed(2)}
                </p>
                <div className="grid grid-cols-2 gap-x-3 mt-2">
                  <div>
                    <p className="text-[8px] text-neutral-400 uppercase">Remaining</p>
                    <p className="font-mono-jet text-[14px] font-bold text-neutral-300">${remaining.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-neutral-400 uppercase">$/Hour</p>
                    <p className={`font-mono-jet text-[14px] font-bold ${perHour >= 80 ? "text-[#4ade80]" : perHour >= 60 ? "text-[#f6dd8c]" : "text-neutral-400"}`}>
                      {perHour > 0 ? `$${perHour.toFixed(2)}` : "—"}
                    </p>
                  </div>
                </div>
                {eta && grossToday < dailyGoal && (
                  <p className="text-[9px] text-[#4ade80] font-semibold mt-1.5">
                    ✓ Goal ~ {eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
                {grossToday >= dailyGoal && (
                  <p className="text-[9px] text-[#4ade80] font-semibold mt-1.5">
                    🏆 Daily goal ${dailyGoal} reached!
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl p-3.5" style={{ background: "#080808", border: "1px solid #1e1400" }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-400">Gross hourly rate target</span>
                <span className="font-mono-jet text-[20px] font-black" style={GOLD_TEXT}>
                  ${hourlyGoal}/h
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={hourlyGoal}
                onChange={(p) => setHourlyGoal(parseInt(p.target.value))}
                className="w-full mt-3"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-mono-jet text-neutral-400">$50</span>
                <span className="text-[10px] font-mono-jet text-neutral-400">$100</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["THIS SHIFT", grossToday > 0 ? `$${grossToday.toFixed(2)}` : "—", grossToday > 0 ? "#f6dd8c" : "#374151"],
                  ["ACTIVE HRS", activeHoursDecimal > 0 ? `${activeHoursDecimal.toFixed(1)}h` : "—", activeHoursDecimal > 0 ? "#f6dd8c" : "#374151"],
                  ["DAILY GOAL", `${goalPct.toFixed(0)}%`, goalPct >= 100 ? "#4ade80" : goalPct >= 70 ? "#f6dd8c" : "#9ca3af"],
                ] as Array<[string, string, string]>
              ).map(([p, q, c2]) => (
                <div key={p} className="rounded-xl p-3" style={{ background: "#080808", border: `1px solid ${c2}22` }}>
                  <p className="text-[9px] tracking-[0.14em] text-neutral-400">{p}</p>
                  <p className="font-mono-jet text-[15px] font-black mt-1" style={{ color: c2 }}>
                    {q}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#080808", border: "1px solid #1a1e1a" }}>
              <div>
                <p className="text-[9px] tracking-[0.18em] text-neutral-300 font-bold uppercase">Odometer · This Shift</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-mono-jet text-[26px] font-black text-[#f6dd8c]">{shiftMiles.toFixed(1)}</span>
                  <span className="text-[11px] text-neutral-400 font-semibold">mi</span>
                </div>
                <p className="text-[9px] text-neutral-400 mt-0.5">{gps ? "● GPS tracking" : "○ GPS inactive"}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] tracking-[0.18em] text-neutral-300 font-bold uppercase">IRS Deduction</p>
                <p className="font-mono-jet text-[20px] font-black text-[#4ade80] mt-1">${(shiftMiles * IRS_RATE).toFixed(2)}</p>
                <p className="text-[9px] text-neutral-400 mt-0.5">${IRS_RATE.toFixed(2)}/mi · 2025 rate</p>
              </div>
            </div>

            <div className={`rounded-xl p-3.5 border-l-[3px] ${COACH_STYLE[coach.type] ?? COACH_STYLE.neutral}`}>
              <div className="flex items-start gap-2">
                <span className="text-[16px] flex-shrink-0 mt-0.5">{coach.emoji}</span>
                <p className="text-[11px] leading-[1.5] text-neutral-200">{coach.text}</p>
              </div>
              {perHour > 0 && grossToday < dailyGoal && (
                <p className="text-[10px] font-mono-jet text-neutral-400 mt-2">
                  At this pace you need {(remaining / perHour).toFixed(1)}h more to reach ${dailyGoal}
                </p>
              )}
            </div>

            <ZonesCard zones={zones} clock={clock} hasGps={!!gps} />
            <WeekStrip todayTripCount={todayTrips.length} grossToday={grossToday} weeklyTotal={weeklyTotal} />
            <TollsCard
              tollYear={clock.getFullYear()}
              totalTollsToday={tollSum.day}
              tollsWeek={tollSum.week}
              tollsMonth={tollSum.month}
              tollsYear={tollSum.year}
              shiftActive={shiftActive}
            />
          </div>

          <MonthCard
            clock={clock}
            earnMonth={earnMonth}
            expMonth={expMonth}
            monthGoal={monthGoal}
            monthPct={monthPct}
            onTrack={onTrack}
          />

          <ShiftBreakdown
            todayTrips={todayTrips}
            grossToday={grossToday}
            expensesToday={expensesToday}
            expensesTodayCount={expensesTodayCount}
            netToday={netToday}
            weeklyTotal={weeklyTotal}
            totalTollsToday={tollSum.day}
          />

          <button
            onClick={onGoData}
            className="mt-5 h-12 w-full rounded-2xl border border-[#1a1a1a] bg-[#0e0e0e] text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400"
          >
            📦 DATA · BACKUP / RESTORE →
          </button>
        </div>
      </div>
    </div>
  )
}
