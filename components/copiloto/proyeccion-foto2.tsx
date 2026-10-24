"use client"

// FOTO 2 — CASH FLOW PROJECTION & TRENDS (clonada idéntica).
// Va en la pestaña NUEVA al lado de Proyecciones. Datos reales del forecast.

import { useMemo } from "react"
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

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"

/** Diagrama de flujo Sources → Uses (Sankey simplificado, como la foto). */
function Sankey({
  sources,
  uses,
}: {
  sources: [string, number][]
  uses: [string, number][]
}) {
  const W = 176, H = 218
  const colW = 52, gap = 6
  const srcTotal = sources.reduce((a, [, v]) => a + v, 0) || 1
  const useTotal = uses.reduce((a, [, v]) => a + v, 0) || 1
  const maxTotal = Math.max(srcTotal, useTotal)
  const scale = (H - gap * 4) / maxTotal
  const srcX = 2, useX = W - colW - 2, midX = (srcX + colW + useX) / 2

  let sy = 2
  const srcBars = sources.map(([name, v]) => {
    const h = Math.max(16, v * scale)
    const bar = { name, v, y: sy, h }
    sy += h + gap
    return bar
  })
  let uy = 2
  const useBars = uses.map(([name, v]) => {
    const h = Math.max(13, v * scale)
    const bar = { name, v, y: uy, h }
    uy += h + gap
    return bar
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      {/* flujos */}
      {srcBars.map((s, i) => {
        const u = useBars[Math.min(i, useBars.length - 1)]
        if (!u) return null
        const y1 = s.y + s.h / 2, y2 = u.y + u.h / 2
        return (
          <path
            key={"f" + i}
            d={`M${srcX + colW},${y1} C ${midX},${y1} ${midX},${y2} ${useX},${y2}`}
            fill="none"
            stroke={i % 2 ? "rgba(52,209,123,.35)" : "rgba(52,209,123,.5)"}
            strokeWidth={Math.max(3, s.h / 4)}
          />
        )
      })}
      {/* fuentes (verde) */}
      {srcBars.map((s, i) => (
        <g key={"s" + i}>
          <rect x={srcX} y={s.y} width={colW} height={s.h} rx="4" fill="#2ea36b" />
          <text x={srcX + colW / 2} y={s.y + s.h / 2 - 2} textAnchor="middle" fill="#eafff3" fontSize="7.5" fontWeight="800">
            {s.name.toUpperCase().slice(0, 13)}
          </text>
          <text x={srcX + colW / 2} y={s.y + s.h / 2 + 8} textAnchor="middle" fill="#eafff3" fontSize="7.5" fontWeight="700">
            +${Math.round(s.v).toLocaleString()}
          </text>
        </g>
      ))}
      {/* usos (rojo) */}
      {useBars.map((u, i) => (
        <g key={"u" + i}>
          <rect x={useX} y={u.y} width={colW} height={u.h} rx="4" fill={i < 3 ? "#d84a3a" : "#c97a2e"} />
          <text x={useX + colW / 2} y={u.y + u.h / 2 - 2} textAnchor="middle" fill="#fff1ee" fontSize="7.5" fontWeight="800">
            {u.name.toUpperCase().slice(0, 13)}
          </text>
          <text x={useX + colW / 2} y={u.y + u.h / 2 + 8} textAnchor="middle" fill="#fff1ee" fontSize="7.5" fontWeight="700">
            -${Math.round(u.v).toLocaleString()}
          </text>
        </g>
      ))}
    </svg>
  )
}

function ToggleRow({ color, label, icon }: { color: string; label: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1e202a" }}>
      <span style={{ fontSize: 11.5 }}>
        <span style={{ marginRight: 6 }}>{icon}</span>
        {label}
      </span>
      <span style={{ width: 40, height: 22, borderRadius: 11, background: color, position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", width: 17, height: 17, borderRadius: "50%", background: "#fff", top: 2.5, right: 3 }} />
      </span>
    </div>
  )
}

export function ProyeccionFoto2(props: ProyProps) {
  const { fc, today, schedules } = useForecast30(props)
  const health = healthOf(fc)
  const net = fc.end - fc.start

  const { sources, uses } = useMemo(() => {
    const inc = new Map<string, number>(), exp = new Map<string, number>()
    for (const l of fc.lines) {
      const c = lineCategory(l, schedules)
      if (l.amount > 0) inc.set(c, (inc.get(c) || 0) + l.amount)
      else exp.set(c, (exp.get(c) || 0) + Math.abs(l.amount))
    }
    const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n) as [string, number][]
    return { sources: top(inc, 3), uses: top(exp, 4) }
  }, [fc, schedules])

  const events = useMemo(
    () =>
      fc.lines
        .filter((l) => l.date >= today)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 8),
    [fc, today],
  )

  // Eje del gráfico
  const pts = useMemo(() => {
    const all = [fc.start, ...fc.days.map((d) => d.balance)]
    const step = Math.max(1, Math.floor(all.length / 16))
    const out = all.filter((_, i) => i % step === 0)
    if (out[out.length - 1] !== all[all.length - 1]) out.push(all[all.length - 1])
    return out
  }, [fc])

  const CW = 176, CH = 196, CPB = 20
  const cMin = Math.min(...pts), cMax = Math.max(...pts), cRng = Math.max(1, cMax - cMin)
  const CX = (i: number) => 34 + (i / (pts.length - 1)) * (CW - 40)
  const CY = (v: number) => 8 + (1 - (v - cMin) / cRng) * (CH - 8 - CPB)
  const linePts = pts.map((v, i) => `${CX(i).toFixed(1)},${CY(v).toFixed(1)}`).join(" ")
  const yTicks = [0, 0.33, 0.66, 1].map((f) => cMin + cRng * f)

  return (
    <div style={{ paddingBottom: 28, color: INK }}>
      {/* Encabezado como la foto */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 10px" }}>
        <span style={{ fontSize: 19 }}>🌈</span>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: 1 }}>CASH FLOW PROJECTION &amp; TRENDS</h2>
      </div>

      {/* PROJECTION SUMMARY */}
      <div style={{ padding: "2px 14px 8px", fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
        PROJECTION SUMMARY
      </div>
      <div style={{ margin: "0 12px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 12px" }}>
          <div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>PROJECTED (30 DAYS):</div>
            <div style={{ fontSize: 23, fontWeight: 800 }}>${money2(fc.end)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>CASH FLOW HEALTH</div>
            <Gauge health={health} size={100} />
            <div style={{ fontWeight: 800, fontSize: 12.5, color: health.color }}>
              {health.label} ({health.pct >= 0 ? "+" : ""}{health.pct}%)
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>TOTAL UPCOMING INFLOW:</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: GREEN }}>{signed(fc.incomeTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>TOTAL UPCOMING OUTFLOW</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: RED }}>{signed(-fc.expenseTotal)}</div>
          </div>
        </div>
      </div>

      {/* Gráfico + Breakdown lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "12px" }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 12, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: SUB, marginBottom: 8, lineHeight: 1.45 }}>
            INTERACTIVE PROJECTED BALANCE CHART
          </div>
          <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
            <defs>
              <linearGradient id="f2fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#34d17b" stopOpacity=".3" />
                <stop offset="1" stopColor="#34d17b" stopOpacity="0" />
              </linearGradient>
            </defs>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1="34" y1={CY(v)} x2={CW - 6} y2={CY(v)} stroke="#23252f" strokeWidth="1" />
                <text x="2" y={CY(v) + 3} fill={SUB} fontSize="8">${Math.round(v).toLocaleString()}</text>
              </g>
            ))}
            <polygon points={`34,${CY(pts[0])} ${linePts} ${CX(pts.length - 1)},${CH - CPB} 34,${CH - CPB}`} fill="url(#f2fill)" />
            <polyline points={linePts} fill="none" stroke="#34d17b" strokeWidth="2.2" />
            <circle cx={CX(0)} cy={CY(pts[0])} r="4" fill="#5b8cff" />
            <circle cx={CX(pts.length - 1)} cy={CY(pts[pts.length - 1])} r="4" fill="#34d17b" />
            <g fontSize="8" fontWeight="700">
              <rect x={CX(0) - 2} y={CY(pts[0]) + 6} width="52" height="22" rx="5" fill="#1b1e27" stroke="#2c2f3c" />
              <text x={CX(0) + 3} y={CY(pts[0]) + 15} fill={SUB}>TODAY:</text>
              <text x={CX(0) + 3} y={CY(pts[0]) + 25} fill={GREEN}>${Math.round(pts[0]).toLocaleString()}</text>
              <rect x={CX(pts.length - 1) - 52} y={CY(pts[pts.length - 1]) - 30} width="56" height="22" rx="5" fill="#1b1e27" stroke="#2c2f3c" />
              <text x={CX(pts.length - 1) - 48} y={CY(pts[pts.length - 1]) - 21} fill={SUB}>{fmtFecha(fc.endDate)}:</text>
              <text x={CX(pts.length - 1) - 48} y={CY(pts[pts.length - 1]) - 11} fill={GREEN}>${Math.round(pts[pts.length - 1]).toLocaleString()}</text>
            </g>
            <text x="34" y={CH - 6} fill={SUB} fontSize="8">{fmtFecha(today)}</text>
            <text x={CW - 40} y={CH - 6} fill={SUB} fontSize="8">{fmtFecha(fc.endDate)}</text>
          </svg>
          <div style={{ fontSize: 11, color: SUB, marginTop: 8, marginBottom: 2 }}>Scenario:</div>
          <ToggleRow color="#5b8cff" label="Base Case" icon="🔵" />
          <ToggleRow color="#d84a3a" label="High Expenses" icon="🔺" />
          <ToggleRow color="#34d17b" label="Max Savings" icon="📈" />
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 12, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: SUB, marginBottom: 8, lineHeight: 1.45 }}>
            CASH FLOW BREAKDOWN (30 DAYS)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: SUB, marginBottom: 6 }}>
            <span style={{ textAlign: "center", width: "32%" }}>Sources<br />of Cash</span>
            <span style={{ textAlign: "center", width: "32%" }}>Uses<br />of Cash</span>
          </div>
          <Sankey sources={sources} uses={uses} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: SUB, marginTop: 6 }}>
            <span>Sources of Cash</span><span>Uses of Cash</span>
          </div>
          <div style={{ textAlign: "right", marginTop: 8, fontSize: 10.5, color: SUB }}>
            NET FLOW: <b style={{ color: net >= 0 ? GREEN : RED, fontSize: 12 }}>{signed(net)}</b>
          </div>
        </div>
      </div>

      {/* MAJOR UPCOMING EVENTS */}
      <div style={{ margin: "0 12px", background: BAND_BG, borderRadius: "10px 10px 0 0", padding: "10px 12px", fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
        MAJOR UPCOMING EVENTS
      </div>
      <div style={{ margin: "0 12px", background: CARD, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
        {events.length === 0 && <div style={{ padding: 14, color: SUB, fontSize: 13 }}>No upcoming events scheduled.</div>}
        {events.map((l, i) => {
          const cat = lineCategory(l, schedules)
          return (
            <div key={l.id + i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", borderBottom: i < events.length - 1 ? "1px solid #1a1c24" : "none", fontSize: 12.5 }}>
              <span style={{ color: SUB, fontWeight: 700, fontSize: 11, width: 52, flexShrink: 0 }}>{fmtFecha(l.date)}</span>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{catIcon(cat, l.label)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{l.label}</span>
              <span style={{ color: "#c9cbd8", fontSize: 11.5, flexShrink: 0 }}>{cat}</span>
              <span style={{ color: "#5b8cff", fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>Scheduled</span>
              <span style={{ fontWeight: 800, flexShrink: 0, color: l.amount >= 0 ? GREEN : RED }}>{signed(l.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const BAND_BG = "#1b1e27"
