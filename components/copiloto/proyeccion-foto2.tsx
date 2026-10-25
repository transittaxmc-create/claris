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

/** Diagrama de flujo Sources → Uses (Sankey, como la foto original).
 *  Acabado PROFESIONAL (Miguel, 2026-10-25): resolución interna 2×,
 *  bloques con brillo (sheen) y esquinas suaves, y CINTAS con
 *  gradiente del color de la fuente al color del uso, repartidas en
 *  proporción exacta (algoritmo sankey de dos columnas). */
const SRC_COLORS = ["#2fbf71", "#3ecf6e", "#35b558", "#28a95c", "#1f8a4c"]
const USE_COLORS = ["#e5484d", "#d9483b", "#e0653a", "#dd8433", "#c9a13b", "#4a7dd8"]
function Sankey({
  sources,
  uses,
}: {
  sources: [string, number][]
  uses: [string, number][]
}) {
  const W = 352, H = 448
  const colW = 110, gap = 10
  const srcTotal = sources.reduce((a, [, v]) => a + v, 0) || 1
  const useTotal = uses.reduce((a, [, v]) => a + v, 0) || 1
  const maxTotal = Math.max(srcTotal, useTotal)
  const scale = (H - 8 - gap * (Math.max(sources.length, uses.length) - 1)) / maxTotal
  const srcX = 2, useX = W - colW - 2, midX = (srcX + colW + useX) / 2

  let sy = 4
  const srcBars = sources.map(([name, v], i) => {
    const h = Math.max(22, v * scale)
    const bar = { name, v, y: sy, h, color: SRC_COLORS[i % SRC_COLORS.length] }
    sy += h + gap
    return bar
  })
  let uy = 4
  const useBars = uses.map(([name, v], i) => {
    const h = Math.max(20, v * scale)
    const bar = { name, v, y: uy, h, color: USE_COLORS[i % USE_COLORS.length] }
    uy += h + gap
    return bar
  })

  // Reparto proporcional fuente→uso (las dos columnas en orden).
  type Seg = { y0: number; y1: number }
  const srcSegs: (Seg & { color: string })[] = srcBars.map((b) => ({ y0: b.y, y1: b.y + b.h, color: b.color }))
  const useSegs: (Seg & { color: string })[] = useBars.map((b) => ({ y0: b.y, y1: b.y + b.h, color: b.color }))
  const flows: { d: string; from: string; to: string; key: string }[] = []
  {
    let si = 0, ti = 0
    let sRem = srcSegs.length ? srcSegs[0].y1 - srcSegs[0].y0 : 0
    let tRem = useSegs.length ? useSegs[0].y1 - useSegs[0].y0 : 0
    let sCur = srcSegs.length ? srcSegs[0].y0 : 0
    let tCur = useSegs.length ? useSegs[0].y0 : 0
    let guard = 0
    while (si < srcSegs.length && ti < useSegs.length && guard++ < 200) {
      const h = Math.min(sRem, tRem)
      if (h > 0.8) {
        const x1 = srcX + colW, x2 = useX
        flows.push({
          key: `fl${si}-${ti}`,
          from: srcSegs[si].color,
          to: useSegs[ti].color,
          d: `M${x1},${sCur.toFixed(1)} C ${midX},${sCur.toFixed(1)} ${midX},${tCur.toFixed(1)} ${x2},${tCur.toFixed(1)} L${x2},${(tCur + h).toFixed(1)} C ${midX},${(tCur + h).toFixed(1)} ${midX},${(sCur + h).toFixed(1)} ${x1},${(sCur + h).toFixed(1)} Z`,
        })
      }
      sCur += h; tCur += h; sRem -= h; tRem -= h
      if (sRem <= 0.01) { si++; if (si < srcSegs.length) { sCur = srcSegs[si].y0; sRem = srcSegs[si].y1 - srcSegs[si].y0 } }
      if (tRem <= 0.01) { ti++; if (ti < useSegs.length) { tCur = useSegs[ti].y0; tRem = useSegs[ti].y1 - useSegs[ti].y0 } }
    }
  }

  const barText = (x: number, b: { name: string; v: number; y: number; h: number }, sign: string) => (
    <g>
      {b.h >= 37 ? (
        <>
          <text x={x + colW / 2} y={b.y + b.h / 2 - 3} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="800" letterSpacing="0.2">
            {b.name.toUpperCase().slice(0, 12)}
          </text>
          <text x={x + colW / 2} y={b.y + b.h / 2 + 16} textAnchor="middle" fill="rgba(255,255,255,.94)" fontSize="15" fontWeight="700">
            {sign}${Math.round(b.v).toLocaleString()}
          </text>
        </>
      ) : (
        <text x={x + colW / 2} y={b.y + b.h / 2 + 5.5} textAnchor="middle" fill="#ffffff" fontSize="14.5" fontWeight="800">
          {sign}${Math.round(b.v).toLocaleString()}
        </text>
      )}
    </g>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="skSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.17" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.10" />
        </linearGradient>
        {flows.map((f) => (
          <linearGradient key={"g" + f.key} id={`skg-${f.key}`} gradientUnits="userSpaceOnUse" x1={srcX + colW} y1="0" x2={useX} y2="0">
            <stop offset="0" stopColor={f.from} stopOpacity="0.62" />
            <stop offset="1" stopColor={f.to} stopOpacity="0.62" />
          </linearGradient>
        ))}
      </defs>
      {flows.map((f) => (
        <path key={f.key} d={f.d} fill={`url(#skg-${f.key})`} />
      ))}
      {srcBars.map((s, i) => (
        <g key={"s" + i}>
          <rect x={srcX} y={s.y} width={colW} height={s.h} rx="9" fill={s.color} />
          <rect x={srcX} y={s.y} width={colW} height={s.h} rx="9" fill="url(#skSheen)" />
          {barText(srcX, s, "+")}
        </g>
      ))}
      {useBars.map((u, i) => (
        <g key={"u" + i}>
          <rect x={useX} y={u.y} width={colW} height={u.h} rx="9" fill={u.color} />
          <rect x={useX} y={u.y} width={colW} height={u.h} rx="9" fill="url(#skSheen)" />
          {barText(useX, u, "-")}
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
    // Más detalle (como la foto original): hasta 4 fuentes y 5 usos
    // nombrados; lo demás — y todo lo menor al 3.5% del total — se
    // agrupa en OTHER para no perder ni un dólar ni dibujar migajas.
    const top = (m: Map<string, number>, n: number) => {
      const all = [...m.entries()].sort((a, b) => b[1] - a[1]) as [string, number][]
      const total = all.reduce((a, [, v]) => a + v, 0) || 1
      const kept = all.filter(([, v], i) => i < n && (i === 0 || v >= total * 0.035))
      const rest = all.filter((e) => !kept.includes(e)).reduce((a, [, v]) => a + v, 0)
      return rest > 0 ? [...kept, ["Other", rest] as [string, number]] : kept
    }
    return { sources: top(inc, 4), uses: top(exp, 5) }
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

  // Gráfica en resolución interna 2× y línea SUAVIZADA (Catmull-Rom con
  // controles limitados para no inventar picos): acabado profesional.
  const CW = 352, CH = 392, PL = 66, PR = 14, PT = 18, PB = 46
  const PW = CW - PL - PR, PH = CH - PT - PB
  const cMin = Math.min(...pts), cMax = Math.max(...pts), cRng = Math.max(1, cMax - cMin)
  const PX = (i: number) => PL + (i / (pts.length - 1)) * PW
  const PY = (v: number) => PT + (1 - (v - cMin) / cRng) * PH
  const pxPts = pts.map((v, i) => ({ x: PX(i), y: PY(v) }))
  const smoothPath = (p: { x: number; y: number }[]) => {
    if (p.length < 3) return p.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")
    let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)]
      const lo = Math.min(p1.y, p2.y), hi = Math.max(p1.y, p2.y)
      const cl = (y: number) => Math.max(lo, Math.min(hi, y))
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = cl(p1.y + (p2.y - p0.y) / 6)
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = cl(p2.y - (p3.y - p1.y) / 6)
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  }
  const linePath = smoothPath(pxPts)
  const areaPath = `${linePath} L${pxPts[pxPts.length - 1].x.toFixed(1)},${PT + PH} L${pxPts[0].x.toFixed(1)},${PT + PH} Z`
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => cMin + cRng * f)
  // Chips sin salirse del marco: abajo del punto, o arriba si no cabe.
  const startChipY = pxPts[0].y + 62 <= CH - PB + 34 ? pxPts[0].y + 16 : pxPts[0].y - 62
  const endChipY = pxPts[pxPts.length - 1].y - 62 >= 2 ? pxPts[pxPts.length - 1].y - 62 : pxPts[pxPts.length - 1].y + 16
  // Eje de fechas con 4 marcas (como la foto original: OCT 26 · NOV 05…)
  const spanDays = Math.max(1, Math.round((Date.parse(fc.endDate) - Date.parse(today)) / 86400000))
  const xLabels = [0, 0.33, 0.66, 1].map((f) => {
    const d = new Date(Date.parse(today) + Math.round(spanDays * f) * 86400000)
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    return { f, x: PL + f * PW, label: fmtFecha(iso) }
  })

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
            <div style={{ fontSize: 23, fontWeight: 800, color: fc.end < 0 ? RED : undefined }}>{fc.end < 0 ? "-$" : "$"}{money2(fc.end)}</div>
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
                <stop offset="0" stopColor="#3ddc84" stopOpacity=".34" />
                <stop offset="0.6" stopColor="#3ddc84" stopOpacity=".10" />
                <stop offset="1" stopColor="#3ddc84" stopOpacity=".01" />
              </linearGradient>
              <filter id="f2chipShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
              </filter>
            </defs>
            {yTicks.map((v, i) => (
              <g key={"y" + i}>
                <line x1={PL} y1={PY(v)} x2={CW - PR} y2={PY(v)} stroke="rgba(255,255,255,.055)" strokeWidth="1.2" />
                <text x={PL - 10} y={PY(v) + 5} textAnchor="end" fill={SUB} fontSize="15">${Math.round(v).toLocaleString()}</text>
              </g>
            ))}
            {xLabels.map((l, i) => (
              <line key={"x" + i} x1={l.x} y1={PT} x2={l.x} y2={PT + PH} stroke="rgba(255,255,255,.033)" strokeWidth="1.2" />
            ))}
            {cMin < 0 && cMax > 0 && (
              <line x1={PL} y1={PY(0)} x2={CW - PR} y2={PY(0)} stroke="rgba(255,255,255,.22)" strokeWidth="1.6" strokeDasharray="7 6" />
            )}
            <path d={areaPath} fill="url(#f2fill)" />
            <path d={linePath} fill="none" stroke="rgba(61,220,132,.16)" strokeWidth="13" strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath} fill="none" stroke="#3ddc84" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={pxPts[0].x} cy={pxPts[0].y} r="8" fill="#5b8cff" stroke="#ffffff" strokeWidth="3" />
            <circle cx={pxPts[pxPts.length - 1].x} cy={pxPts[pxPts.length - 1].y} r="8" fill="#3ddc84" stroke="#ffffff" strokeWidth="3" />
            <g fontSize="15.5" fontWeight="700" filter="url(#f2chipShadow)">
              <rect x={Math.max(2, pxPts[0].x - 4)} y={startChipY} width="112" height="46" rx="11" fill="#22252f" stroke="#363a49" />
              <text x={Math.max(2, pxPts[0].x - 4) + 11} y={startChipY + 19} fill={SUB}>TODAY:</text>
              <text x={Math.max(2, pxPts[0].x - 4) + 11} y={startChipY + 38} fill={GREEN}>${Math.round(pts[0]).toLocaleString()}</text>
              <rect x={pxPts[pxPts.length - 1].x - 110} y={endChipY} width="114" height="46" rx="11" fill="#22252f" stroke="#363a49" />
              <text x={pxPts[pxPts.length - 1].x - 99} y={endChipY + 19} fill={SUB}>{fmtFecha(fc.endDate)}:</text>
              <text x={pxPts[pxPts.length - 1].x - 99} y={endChipY + 38} fill={GREEN}>${Math.round(pts[pts.length - 1]).toLocaleString()}</text>
            </g>
            {xLabels.map((l, i) => (
              <text key={"d" + i} x={l.x} y={CH - 12} textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"} fill={SUB} fontSize="14.5">{l.label}</text>
            ))}
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
