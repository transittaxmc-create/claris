"use client"

import type { ForecastLine } from "./dinero-forecast"
import { fmtFecha } from "./proyeccion-shared"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
export const CASH_FLOOR_DEFAULT = 200
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const BLUE = "#5b8cff"

export type Scenario = "base" | "high" | "save"

export const SCENARIO_META: Record<
  Scenario,
  { label: string; icon: string; on: string; incomeMul: number; expenseMul: number }
> = {
  base: { label: "Base Case", icon: "\u25cf", on: BLUE, incomeMul: 1, expenseMul: 1 },
  high: { label: "High Expenses", icon: "\u25b2", on: RED, incomeMul: 1, expenseMul: 1.25 },
  save: { label: "Max Savings", icon: "\u25c6", on: GREEN, incomeMul: 1.05, expenseMul: 0.85 },
}

export function r2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function scaleLines(lines: ForecastLine[], sc: Scenario): ForecastLine[] {
  const { incomeMul, expenseMul } = SCENARIO_META[sc]
  if (incomeMul === 1 && expenseMul === 1) return lines
  return lines.map((l) => ({
    ...l,
    amount: l.amount >= 0 ? r2(l.amount * incomeMul) : r2(l.amount * expenseMul),
  }))
}

export function balancePath(
  start: number,
  lines: ForecastLine[],
  today: string,
  endDate: string,
): { date: string; balance: number }[] {
  const byDate = new Map<string, number>()
  for (const l of lines) {
    const d = String(l.date).slice(0, 10)
    byDate.set(d, (byDate.get(d) || 0) + l.amount)
  }
  const out: { date: string; balance: number }[] = []
  let bal = start
  const t0 = Date.parse(today + "T12:00:00Z")
  const t1 = Date.parse(endDate + "T12:00:00Z")
  const days = Math.max(0, Math.round((t1 - t0) / 86400000))
  for (let i = 0; i <= days; i++) {
    const dt = new Date(t0 + i * 86400000)
    const iso = dt.toISOString().slice(0, 10)
    if (i > 0) bal = r2(bal + (byDate.get(iso) || 0))
    out.push({ date: iso, balance: bal })
  }
  return out
}

function weekRangeLabel(aIso: string, bIso: string): string {
  const ma = aIso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const mb = bIso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!ma || !mb) return aIso
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const am = months[Number(ma[2]) - 1]
  const bm = months[Number(mb[2]) - 1]
  const ad = String(Number(ma[3]))
  const bd = String(Number(mb[3]))
  if (am === bm) return `${am} ${ad}-${bd}`
  return `${am} ${ad}-${bm} ${bd}`
}

export function weeklyFlows(lines: ForecastLine[], today: string) {
  const buckets: {
    label: string
    short: string
    start: string
    end: string
    inn: number
    out: number
  }[] = []
  const t0 = Date.parse(today + "T12:00:00Z")
  for (let w = 0; w < 4; w++) {
    const a = new Date(t0 + w * 7 * 86400000)
    const b = new Date(t0 + (w + 1) * 7 * 86400000 - 86400000)
    const aIso = a.toISOString().slice(0, 10)
    const bIso = b.toISOString().slice(0, 10)
    let inn = 0,
      out = 0
    for (const l of lines) {
      const d = String(l.date).slice(0, 10)
      if (d < aIso || d > bIso) continue
      if (l.amount >= 0) inn += l.amount
      else out += Math.abs(l.amount)
    }
    buckets.push({
      label: weekRangeLabel(aIso, bIso),
      short: `W${w + 1}`,
      start: aIso,
      end: bIso,
      inn: r2(inn),
      out: r2(out),
    })
  }
  return buckets
}

/** Business cash-flow buckets (Paycheck, Rent, Savings, Investments…). */
export function flowBucket(
  amount: number,
  category: string | null | undefined,
  label: string | null | undefined,
): string {
  const c = `${category || ""} ${label || ""}`.toLowerCase()
  const isIn = amount >= 0

  if (isIn) {
    if (/paycheck|salary|sueldo|payroll|wages|ssa|social\s*security/.test(c)) return "Paycheck"
    if (/side.?hustle|gig|uber|lyft|doordash|freelance|tips/.test(c)) return "Side Hustle"
    if (/invest|dividend|interest|brokerage|stock|etf|crypto|yield/.test(c)) return "Investments"
    if (/transfer.?in|from.?savings|from.?checking|deposit|payout|reimburse/.test(c)) return "Transfers In"
    if (/refund|return|cash.?back/.test(c)) return "Refunds"
    if (/income|ingreso/.test(c)) {
      const lab = (label || category || "Income").trim()
      if (lab && !/^income$/i.test(lab)) return lab.slice(0, 14)
      return "Other Income"
    }
    const lab = (label || category || "Income").trim()
    if (lab && !/^income$/i.test(lab)) return lab.slice(0, 14)
    return "Other Income"
  }

  if (/sav(ing)?s|emergency.?fund|reserva|ahorro/.test(c)) return "Savings"
  if (/invest|brokerage|stock|etf|401|ira|crypto|vanguard|fidelity/.test(c)) return "Investments"
  if (/rent|mortgage|housing|vivienda|alquiler|landlord/.test(c)) return "Rent / Housing"
  if (/car.?lease|auto.?lease|leasing|vehicle.?pay|car.?payment|auto.?loan/.test(c)) return "Car / Lease"
  if (/insurance|seguro|geico|progressive/.test(c)) return "Insurance"
  if (/t-?mobile|verizon|at&t|phone|mobile|celular|internet|wifi/.test(c)) return "Phone / Internet"
  if (/fuel|gasolina|gas.?station|shell|exxon|chevron/.test(c)) return "Fuel"
  if (/grocer|supermarket|whole.?foods|trader|market|mercado/.test(c)) return "Groceries"
  if (/restaurant|food|comida|uber.?eats|doordash|mcdonald|dunkin|bagel/.test(c)) return "Food / Dining"
  if (/utilit|electric|water|gas.?bill|national.?grid|eversource/.test(c)) return "Utilities"
  if (/subscription|netflix|spotify|prime|gym|membership/.test(c)) return "Subscriptions"
  if (/fee|bank.?fee|overdraft/.test(c)) return "Bank Fees"
  if (/tax|irs|impuesto/.test(c)) return "Taxes"
  if (/transfer.?out|to.?savings|to.?checking|venmo|zelle|paypal/.test(c)) return "Transfers Out"
  if (/expense|gasto/.test(c)) {
    const lab = (label || category || "Expense").trim()
    if (lab && !/^expense$/i.test(lab)) return lab.slice(0, 14)
    return "Other Expense"
  }
  const lab = (label || category || "Other").trim()
  return lab.slice(0, 14) || "Other Expense"
}

const SRC_COLORS = ["#2fbf71", "#3ecf6e", "#35b558", "#28a95c"]
const USE_COLORS = ["#e5484d", "#d9483b", "#e0653a", "#dd8433", "#c9a13b", "#4a7dd8", "#8b5cf6"]

export function Sankey({ sources, uses }: { sources: [string, number][]; uses: [string, number][] }) {
  const W = 352,
    H = 340
  const colW = 108,
    gap = 7
  const srcTotal = sources.reduce((a, [, v]) => a + v, 0) || 1
  const useTotal = uses.reduce((a, [, v]) => a + v, 0) || 1
  const maxTotal = Math.max(srcTotal, useTotal)
  const scale = (H - 8 - gap * (Math.max(sources.length, uses.length, 1) - 1)) / maxTotal
  const srcX = 2,
    useX = W - colW - 2,
    midX = (srcX + colW + useX) / 2

  let sy = 4
  const srcBars = sources.map(([name, v], i) => {
    const h = Math.max(18, v * scale)
    const bar = { name, v, y: sy, h, color: SRC_COLORS[i % SRC_COLORS.length] }
    sy += h + gap
    return bar
  })
  let uy = 4
  const useBars = uses.map(([name, v], i) => {
    const h = Math.max(16, v * scale)
    const bar = { name, v, y: uy, h, color: USE_COLORS[i % USE_COLORS.length] }
    uy += h + gap
    return bar
  })

  type Seg = { y0: number; y1: number; color: string }
  const srcSegs: Seg[] = srcBars.map((b) => ({ y0: b.y, y1: b.y + b.h, color: b.color }))
  const useSegs: Seg[] = useBars.map((b) => ({ y0: b.y, y1: b.y + b.h, color: b.color }))
  const flows: { d: string; from: string; to: string; key: string }[] = []
  {
    let si = 0,
      ti = 0
    let sRem = srcSegs[0] ? srcSegs[0].y1 - srcSegs[0].y0 : 0
    let tRem = useSegs[0] ? useSegs[0].y1 - useSegs[0].y0 : 0
    let sCur = srcSegs[0]?.y0 ?? 0
    let tCur = useSegs[0]?.y0 ?? 0
    let guard = 0
    while (si < srcSegs.length && ti < useSegs.length && guard++ < 200) {
      const h = Math.min(sRem, tRem)
      if (h > 0.8) {
        const x1 = srcX + colW,
          x2 = useX
        flows.push({
          key: `fl${si}-${ti}`,
          from: srcSegs[si].color,
          to: useSegs[ti].color,
          d: `M${x1},${sCur.toFixed(1)} C ${midX},${sCur.toFixed(1)} ${midX},${tCur.toFixed(1)} ${x2},${tCur.toFixed(1)} L${x2},${(tCur + h).toFixed(1)} C ${midX},${(tCur + h).toFixed(1)} ${midX},${(sCur + h).toFixed(1)} ${x1},${(sCur + h).toFixed(1)} Z`,
        })
      }
      sCur += h
      tCur += h
      sRem -= h
      tRem -= h
      if (sRem <= 0.01) {
        si++
        if (si < srcSegs.length) {
          sCur = srcSegs[si].y0
          sRem = srcSegs[si].y1 - srcSegs[si].y0
        }
      }
      if (tRem <= 0.01) {
        ti++
        if (ti < useSegs.length) {
          tCur = useSegs[ti].y0
          tRem = useSegs[ti].y1 - useSegs[ti].y0
        }
      }
    }
  }

  const barText = (x: number, b: { name: string; v: number; y: number; h: number }, sign: string) => (
    <g>
      {b.h >= 32 ? (
        <>
          <text x={x + colW / 2} y={b.y + b.h / 2 - 2} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">
            {b.name.toUpperCase().slice(0, 13)}
          </text>
          <text x={x + colW / 2} y={b.y + b.h / 2 + 13} textAnchor="middle" fill="rgba(255,255,255,.92)" fontSize="12" fontWeight="700">
            {sign}${Math.round(b.v).toLocaleString()}
          </text>
        </>
      ) : (
        <text x={x + colW / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">
          {sign}${Math.round(b.v).toLocaleString()}
        </text>
      )}
    </g>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="skSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.08" />
        </linearGradient>
        {flows.map((f) => (
          <linearGradient key={"g" + f.key} id={`skg-${f.key}`} gradientUnits="userSpaceOnUse" x1={srcX + colW} y1="0" x2={useX} y2="0">
            <stop offset="0" stopColor={f.from} stopOpacity="0.55" />
            <stop offset="1" stopColor={f.to} stopOpacity="0.55" />
          </linearGradient>
        ))}
      </defs>
      {flows.map((f) => (
        <path key={f.key} d={f.d} fill={`url(#skg-${f.key})`} />
      ))}
      {srcBars.map((s, i) => (
        <g key={"s" + i}>
          <rect x={srcX} y={s.y} width={colW} height={s.h} rx="8" fill={s.color} />
          <rect x={srcX} y={s.y} width={colW} height={s.h} rx="8" fill="url(#skSheen)" />
          {barText(srcX, s, "+")}
        </g>
      ))}
      {useBars.map((u, i) => (
        <g key={"u" + i}>
          <rect x={useX} y={u.y} width={colW} height={u.h} rx="8" fill={u.color} />
          <rect x={useX} y={u.y} width={colW} height={u.h} rx="8" fill="url(#skSheen)" />
          {barText(useX, u, "-")}
        </g>
      ))}
    </svg>
  )
}

export function Waterfall({
  start,
  income,
  expense,
  end,
}: {
  start: number
  income: number
  expense: number
  end: number
}) {
  const steps: { label: string; v: number; kind: "start" | "plus" | "minus" | "end" }[] = [
    { label: "Start", v: start, kind: "start" },
    { label: "Inflow", v: income, kind: "plus" },
    { label: "Outflow", v: -expense, kind: "minus" },
    { label: "End", v: end, kind: "end" },
  ]
  let run = 0
  const bars = steps.map((s) => {
    if (s.kind === "start" || s.kind === "end") {
      run = s.v
      return { ...s, base: 0, h: s.v }
    }
    const base = run
    run = r2(run + s.v)
    return { ...s, base, h: s.v }
  })
  const vals = bars.flatMap((b) => [b.base, b.base + b.h])
  const minV = Math.min(0, ...vals)
  const maxV = Math.max(0, ...vals)
  const rng = Math.max(1, maxV - minV)
  const W = 352,
    H = 200,
    PL = 8,
    PR = 8,
    PT = 16,
    PB = 36
  const slot = (W - PL - PR) / bars.length
  const barW = slot * 0.55
  const Y = (v: number) => PT + ((maxV - v) / rng) * (H - PT - PB)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      <line x1={PL} y1={Y(0)} x2={W - PR} y2={Y(0)} stroke="rgba(255,255,255,.15)" strokeWidth="1" strokeDasharray="4 4" />
      {bars.map((b, i) => {
        const x = PL + i * slot + (slot - barW) / 2
        const y1 = Y(Math.max(b.base, b.base + b.h))
        const y2 = Y(Math.min(b.base, b.base + b.h))
        const h = Math.max(2, y2 - y1)
        const color = b.kind === "plus" ? GREEN : b.kind === "minus" ? RED : b.kind === "end" ? BLUE : "#6b7280"
        return (
          <g key={i}>
            <rect x={x} y={y1} width={barW} height={h} rx="4" fill={color} opacity={0.9} />
            <text x={x + barW / 2} y={y1 - 4} textAnchor="middle" fill={INK} fontSize="11" fontWeight="700">
              {b.kind === "minus"
                ? `-$${Math.round(Math.abs(b.h)).toLocaleString()}`
                : `$${Math.round(Math.abs(b.kind === "end" || b.kind === "start" ? b.v : b.h)).toLocaleString()}`}
            </text>
            <text x={x + barW / 2} y={H - 12} textAnchor="middle" fill={SUB} fontSize="11" fontWeight="600">
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function WeeklyBars({
  weeks,
}: {
  weeks: { label: string; short?: string; start?: string; end?: string; inn: number; out: number }[]
}) {
  const maxV = Math.max(1, ...weeks.flatMap((w) => [w.inn, w.out]))
  const W = 360,
    H = 188,
    PL = 8,
    PR = 8,
    PT = 22,
    PB = 44
  const slot = (W - PL - PR) / Math.max(1, weeks.length)
  const barW = slot * 0.26

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      <text x={PL} y={14} fill={SUB} fontSize="10" fontWeight="700">
        Green = In · Red = Out · each bar = 7 days from today
      </text>
      {weeks.map((w, i) => {
        const cx = PL + i * slot + slot / 2
        const hIn = (w.inn / maxV) * (H - PT - PB)
        const hOut = (w.out / maxV) * (H - PT - PB)
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={H - PB - hIn} width={barW} height={Math.max(1, hIn)} rx="3" fill={GREEN} opacity={0.9} />
            <rect x={cx + 2} y={H - PB - hOut} width={barW} height={Math.max(1, hOut)} rx="3" fill={RED} opacity={0.9} />
            <text x={cx} y={H - PB + 14} textAnchor="middle" fill={INK} fontSize="9.5" fontWeight="800">
              {w.short || `W${i + 1}`}
            </text>
            <text x={cx} y={H - 12} textAnchor="middle" fill={SUB} fontSize="9">
              {w.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ScenarioToggle({
  value,
  onChange,
}: {
  value: Scenario
  onChange: (s: Scenario) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {(Object.keys(SCENARIO_META) as Scenario[]).map((k) => {
        const m = SCENARIO_META[k]
        const on = value === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #1e202a",
              color: INK,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <span>
              <span style={{ marginRight: 6, color: m.on }}>{m.icon}</span>
              {m.label}
            </span>
            <span
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                background: on ? m.on : "#2a2d38",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  background: "#fff",
                  top: 2.5,
                  left: on ? 20 : 3,
                }}
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}
