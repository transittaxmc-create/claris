"use client"

import { useMemo, useState } from "react"
import { Briefcase } from "lucide-react"
import {
  Gauge,
  catIcon,
  fmtFecha,
  healthOf,
  lineCategory,
  money2,
  signed,
  useForecast30,
  type ProyProps,
} from "./proyeccion-shared"
import type { Forecast } from "./dinero-forecast"
import {
  type Scenario,
  SCENARIO_META,
  scaleLines,
  balancePath,
  weeklyFlows,
  r2,
  Sankey,
  Waterfall,
  WeeklyBars,
  ScenarioToggle,
  CASH_FLOOR_DEFAULT,
  flowBucket,
} from "./proyeccion-charts"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"
const BAND_BG = "#1b1e27"
const BLUE = "#5b8cff"
const AMBER = "#f5b84c"

export function ProyeccionFoto2(props: ProyProps) {
  const { fc, today, schedules } = useForecast30(props)
  const [scenario, setScenario] = useState<Scenario>("base")

  const scaledLines = useMemo(() => scaleLines(fc.lines, scenario), [fc.lines, scenario])
  const path = useMemo(
    () => balancePath(fc.start, scaledLines, today, fc.endDate),
    [fc.start, scaledLines, today, fc.endDate],
  )
  const endBal = path.length ? path[path.length - 1].balance : fc.end
  const incomeTotal = r2(scaledLines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0))
  const expenseTotal = r2(
    scaledLines.filter((l) => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0),
  )
  const net = r2(endBal - fc.start)

  const healthFc = useMemo(
    () => ({ ...fc, end: endBal, incomeTotal, expenseTotal }) as Forecast,
    [fc, endBal, incomeTotal, expenseTotal],
  )
  const health = healthOf(healthFc)
  const CASH_FLOOR = CASH_FLOOR_DEFAULT

  // Business buckets: Paycheck, Rent, Savings, Investments…
  const { sources, uses } = useMemo(() => {
    const inc = new Map<string, number>()
    const exp = new Map<string, number>()
    for (const l of scaledLines) {
      const raw = lineCategory(l, schedules)
      const c = flowBucket(l.amount, raw, l.label)
      if (l.amount > 0) inc.set(c, (inc.get(c) || 0) + l.amount)
      else exp.set(c, (exp.get(c) || 0) + Math.abs(l.amount))
    }
    const top = (m: Map<string, number>, n: number) => {
      const all = [...m.entries()].sort((a, b) => b[1] - a[1]) as [string, number][]
      const total = all.reduce((a, [, v]) => a + v, 0) || 1
      const kept = all.filter(([, v], i) => i < n && (i < 3 || v >= total * 0.02))
      const rest = all.filter((e) => !kept.includes(e)).reduce((a, [, v]) => a + v, 0)
      return rest > 0.5 ? ([...kept, ["Other", rest]] as [string, number][]) : kept
    }
    return { sources: top(inc, 5), uses: top(exp, 7) }
  }, [scaledLines, schedules])

  const weeks = useMemo(() => weeklyFlows(scaledLines, today), [scaledLines, today])
  const events = useMemo(
    () =>
      scaledLines
        .filter((l) => l.date >= today)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 8),
    [scaledLines, today],
  )

  const pts = useMemo(() => {
    const all = path.map((p) => p.balance)
    if (all.length === 0) return [fc.start]
    const step = Math.max(1, Math.floor(all.length / 20))
    const out = all.filter((_, i) => i % step === 0)
    if (out[out.length - 1] !== all[all.length - 1]) out.push(all[all.length - 1])
    return out
  }, [path, fc.start])

  const minDay = useMemo(() => {
    if (!path.length) return null
    return path.reduce((a, b) => (b.balance < a.balance ? b : a))
  }, [path])

  const CW = 352
  const CH = 300
  const PL = 52
  const PR = 12
  const PT = 14
  const PB = 40
  const PW = CW - PL - PR
  const PH = CH - PT - PB
  const cMin = Math.min(CASH_FLOOR, ...pts)
  const cMax = Math.max(...pts)
  const cRng = Math.max(1, cMax - cMin)
  const PX = (i: number) => PL + (i / Math.max(1, pts.length - 1)) * PW
  const PY = (v: number) => PT + (1 - (v - cMin) / cRng) * PH
  const pxPts = pts.map((v, i) => ({ x: PX(i), y: PY(v) }))
  const smoothPath = (p: { x: number; y: number }[]) => {
    if (p.length < 3) return p.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")
    let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)]
      const p1 = p[i]
      const p2 = p[i + 1]
      const p3 = p[Math.min(p.length - 1, i + 2)]
      const lo = Math.min(p1.y, p2.y)
      const hi = Math.max(p1.y, p2.y)
      const cl = (y: number) => Math.max(lo, Math.min(hi, y))
      const c1x = p1.x + (p2.x - p0.x) / 6
      const c1y = cl(p1.y + (p2.y - p0.y) / 6)
      const c2x = p2.x - (p3.x - p1.x) / 6
      const c2y = cl(p2.y - (p3.y - p1.y) / 6)
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  }
  const linePath = smoothPath(pxPts)
  const areaPath = `${linePath} L${pxPts[pxPts.length - 1].x.toFixed(1)},${PT + PH} L${pxPts[0].x.toFixed(1)},${PT + PH} Z`
  const yTicks = [0, 0.5, 1].map((f) => cMin + cRng * f)
  const spanDays = Math.max(1, Math.round((Date.parse(fc.endDate) - Date.parse(today)) / 86400000))
  const xLabels = [0, 0.5, 1].map((f) => {
    const d = new Date(Date.parse(today) + Math.round(spanDays * f) * 86400000)
    const iso = d.toISOString().slice(0, 10)
    return { f, x: PL + f * PW, label: fmtFecha(iso) }
  })

  const card: Record<string, string | number> = {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 12,
    minWidth: 0,
  }

  return (
    <div style={{ paddingBottom: 28, color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "rgba(91,140,255,.14)",
            border: "1px solid rgba(91,140,255,.35)",
            flexShrink: 0,
          }}
          aria-hidden
        >
          <Briefcase size={16} color={BLUE} strokeWidth={2.25} />
        </span>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: 1, margin: 0 }}>CASH FLOW PROJECTION & TRENDS</h2>
      </div>

      <div style={{ padding: "2px 14px 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
        PROJECTION SUMMARY - 30 DAYS
      </div>
      <div style={{ margin: "0 12px", ...card, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 10px" }}>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>PROJECTED END</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: endBal < 0 ? RED : INK }}>
              {endBal < 0 ? "-$" : "$"}
              {money2(endBal)}
            </div>
            {minDay && (
              <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>
                Low: ${Math.round(minDay.balance).toLocaleString()} - {fmtFecha(minDay.date)}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>CASH FLOW HEALTH</div>
            <Gauge health={health} size={88} />
            <div style={{ fontWeight: 800, fontSize: 12, color: health.color }}>
              {health.label} ({health.pct >= 0 ? "+" : ""}
              {health.pct}%)
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>INFLOW</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: GREEN }}>{signed(incomeTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>OUTFLOW</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: RED }}>{signed(-expenseTotal)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: 12, color: SUB }}>
          NET FLOW{" "}
          <b style={{ color: net >= 0 ? GREEN : RED, fontSize: 14 }}>{signed(net)}</b>
          <span style={{ marginLeft: 10, fontSize: 10 }}>- scenario: {SCENARIO_META[scenario].label}</span>
        </div>
      </div>

      <div className="proj-charts-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, margin: 12 }}>
        <style>{`@media (min-width: 720px) { .proj-charts-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>

        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: SUB, marginBottom: 6 }}>PROJECTED BALANCE</div>
          <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
            <defs>
              <linearGradient id="f2fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3ddc84" stopOpacity=".30" />
                <stop offset="1" stopColor="#3ddc84" stopOpacity=".02" />
              </linearGradient>
            </defs>
            {yTicks.map((v, i) => (
              <g key={"y" + i}>
                <line x1={PL} y1={PY(v)} x2={CW - PR} y2={PY(v)} stroke="rgba(255,255,255,.06)" />
                <text x={PL - 6} y={PY(v) + 4} textAnchor="end" fill={SUB} fontSize="11">
                  ${Math.round(v).toLocaleString()}
                </text>
              </g>
            ))}
            <line x1={PL} y1={PY(CASH_FLOOR)} x2={CW - PR} y2={PY(CASH_FLOOR)} stroke={AMBER} strokeWidth="1.4" strokeDasharray="5 4" opacity={0.85} />
            <text x={CW - PR} y={PY(CASH_FLOOR) - 4} textAnchor="end" fill={AMBER} fontSize="9.5" fontWeight="700">
              floor ${CASH_FLOOR}
            </text>
            <path d={areaPath} fill="url(#f2fill)" />
            <path d={linePath} fill="none" stroke="#3ddc84" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={pxPts[0].x} cy={pxPts[0].y} r="5" fill={BLUE} stroke="#fff" strokeWidth="2" />
            <circle cx={pxPts[pxPts.length - 1].x} cy={pxPts[pxPts.length - 1].y} r="5" fill={GREEN} stroke="#fff" strokeWidth="2" />
            {xLabels.map((l, i) => (
              <text key={"d" + i} x={l.x} y={CH - 10} textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"} fill={SUB} fontSize="11">
                {l.label}
              </text>
            ))}
          </svg>
          <div style={{ fontSize: 11, color: SUB, marginTop: 6, marginBottom: 2 }}>Scenario (live)</div>
          <ScenarioToggle value={scenario} onChange={setScenario} />
        </div>

        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: SUB, marginBottom: 6 }}>
            CASH FLOW BREAKDOWN · BY CATEGORY
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: SUB, marginBottom: 4 }}>
            <span>Sources</span>
            <span>Uses</span>
          </div>
          <Sankey sources={sources} uses={uses} />
          <div style={{ textAlign: "right", marginTop: 6, fontSize: 11, color: SUB }}>
            NET <b style={{ color: net >= 0 ? GREEN : RED }}>{signed(net)}</b>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: SUB, marginBottom: 6 }}>BRIDGE - START TO END</div>
          <Waterfall start={fc.start} income={incomeTotal} expense={expenseTotal} end={endBal} />
        </div>

        <div style={card}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: SUB, marginBottom: 6 }}>WEEKLY IN vs OUT</div>
          <WeeklyBars weeks={weeks} />
        </div>
      </div>

      <div style={{ margin: "0 12px", background: BAND_BG, borderRadius: "10px 10px 0 0", padding: "10px 12px", fontSize: 11.5, fontWeight: 800, letterSpacing: 1.1, color: SUB }}>
        MAJOR UPCOMING EVENTS
      </div>
      <div style={{ margin: "0 12px", background: CARD, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
        {events.length === 0 && <div style={{ padding: 14, color: SUB, fontSize: 13 }}>No upcoming events scheduled.</div>}
        {events.map((l, i) => {
          const cat = lineCategory(l, schedules)
          return (
            <div
              key={l.id + i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderBottom: i < events.length - 1 ? "1px solid #1a1c24" : "none",
                fontSize: 12.5,
              }}
            >
              <span style={{ color: SUB, fontWeight: 700, fontSize: 11, width: 52, flexShrink: 0 }}>{fmtFecha(l.date)}</span>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{catIcon(cat, l.label)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                {l.label}
              </span>
              <span style={{ color: BLUE, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Scheduled</span>
              <span
                style={{
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: l.amount >= 0 ? GREEN : RED,
                  flexShrink: 0,
                  minWidth: 72,
                  textAlign: "right",
                }}
              >
                {signed(l.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
