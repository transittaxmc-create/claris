"use client"

// Foto 2 — CASH FLOW PROJECTION & TRENDS · Dirección A "Flujo Contable"
// (escogida por Miguel 2026-10-25): héroe KPI + barra bullet (sin aguja),
// línea de balance en ESCALÓN, Sankey ancho y alto con listas de desglose
// por fuente real, waterfall resumen y barras semanales divergentes.
// Stack pedido por Miguel: Recharts + Tailwind + Framer Motion sutil.
// Los transfers internos NO son ingreso ni gasto: solo nota al pie.

import { useMemo, useState, type ReactNode } from "react"
import { Briefcase } from "lucide-react"
import { motion } from "framer-motion"
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  LabelList,
  Sankey,
  Cell,
} from "recharts"
import {
  catIcon,
  displayLabel,
  fmtFecha,
  fmtFechaL,
  flowGroups,
  healthOf,
  lineCategory,
  money2,
  signed,
  useForecast30,
  type FlowGroup,
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
  ScenarioToggle,
  CASH_FLOOR_DEFAULT,
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
const TRACK = "#22242f"

const fmtK = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1000) return `$${(v / 1000).toFixed(a >= 10000 ? 0 : 1)}k`
  return `$${Math.round(v)}`
}

/** Tooltip oscuro único para todos los gráficos. */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p: any) => p.dataKey !== "base")
  if (!rows.length) return null
  return (
    <div
      style={{
        background: "#1d2029",
        border: "1px solid #333646",
        borderRadius: 10,
        padding: "8px 10px",
        fontSize: 12,
        color: INK,
        boxShadow: "0 6px 18px rgba(0,0,0,.45)",
      }}
    >
      {label != null && label !== "" && (
        <div style={{ color: SUB, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      )}
      {rows.map((p: any, i: number) => {
        const v = typeof p?.payload?.delta === "number" ? p.payload.delta : Number(p.value) || 0
        return (
          <div key={i} style={{ fontWeight: 700, color: p.color || p.payload?.fill || INK }}>
            {p.name}: {signed(v)}
          </div>
        )
      })}
    </div>
  )
}

/** Tarjeta con entrada suave (Framer Motion sutil: opacidad + 10px, una vez). */
function FadeCard({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode
  delay?: number
  style?: Record<string, string | number>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: "easeOut" }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/** Lista ranqueada: nombre completo + monto + % + barra. Aquí vive la
 *  justificación completa de cada fuente y cada gasto. */
function RankList({ title, items, total, sign }: { title: string; items: FlowGroup[]; total: number; sign: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: SUB, marginBottom: 7 }}>{title}</div>
      {items.length === 0 && <div style={{ fontSize: 12, color: SUB }}>Nothing scheduled.</div>}
      {items.map((g) => {
        const pct = total > 0 ? (g.value / total) * 100 : 0
        return (
          <div key={g.name} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: g.color,
                    marginRight: 7,
                  }}
                />
                {g.name}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, flexShrink: 0 }}>
                {sign}${Math.round(g.value).toLocaleString()}
                <span style={{ color: SUB, fontWeight: 600 }}> · {pct.toFixed(0)}%</span>
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: TRACK, marginTop: 3 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: 3, background: g.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Para el Sankey: las 6 mayores + el resto en "Other" (la lista sí va completa). */
function mergeTop(gs: FlowGroup[], n: number): FlowGroup[] {
  if (gs.length <= n) return gs
  const kept = gs.slice(0, n)
  const rest = gs.slice(n).reduce((a, g) => a + g.value, 0)
  return rest > 0.5 ? [...kept, { name: "Other", value: r2(rest), color: "#7a7f92" }] : kept
}

export function ProyeccionFoto2(props: ProyProps) {
  const { fc, today, schedules } = useForecast30(props)
  const [scenario, setScenario] = useState<Scenario>("base")

  const scaledLines = useMemo(() => scaleLines(fc.lines, scenario), [fc.lines, scenario])
  const path = useMemo(
    () => balancePath(fc.start, scaledLines, today, fc.endDate),
    [fc.start, scaledLines, today, fc.endDate],
  )
  const endBal = path.length ? path[path.length - 1].balance : fc.end
  const net = r2(endBal - fc.start)

  // Flujo por fuente real; transfers fuera (solo nota al pie).
  const groups = useMemo(() => flowGroups(scaledLines, schedules), [scaledLines, schedules])
  const incomeTotal = groups.incomeTotal
  const expenseTotal = groups.expenseTotal
  const flowNet = r2(incomeTotal - expenseTotal)

  const health = healthOf({ ...fc, end: endBal, incomeTotal, expenseTotal } as Forecast)
  const CASH_FLOOR = CASH_FLOOR_DEFAULT

  const weeks = useMemo(() => weeklyFlows(scaledLines, today), [scaledLines, today])
  const events = useMemo(
    () =>
      scaledLines
        .filter((l) => l.date >= today)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 8),
    [scaledLines, today],
  )
  const minDay = useMemo(() => {
    if (!path.length) return null
    return path.reduce((a, b) => (b.balance < a.balance ? b : a))
  }, [path])

  /* ── Bullet: el saldo final contra la escala (inicio + ingreso) ── */
  const bulletMax = Math.max(1, fc.start + incomeTotal, endBal, CASH_FLOOR)
  const pctOf = (v: number) => Math.max(0, Math.min(100, (v / bulletMax) * 100))

  /* ── Sankey: fuentes → Income → usos (+ Kept si sobra / From balance si falta) ── */
  const sankey = useMemo(() => {
    const topSrc = mergeTop(groups.sources, 6)
    const topUse = mergeTop(groups.uses, 6)
    const nodes: { name: string; color: string }[] = []
    const links: { source: number; target: number; value: number; color: string }[] = []
    topSrc.forEach((s) => nodes.push({ name: s.name, color: s.color }))
    const hub = nodes.length
    nodes.push({ name: "Income", color: "#3a3f52" })
    const useStart = nodes.length
    topUse.forEach((u) => nodes.push({ name: u.name, color: u.color }))
    topSrc.forEach((s, i) => links.push({ source: i, target: hub, value: s.value, color: s.color }))
    topUse.forEach((u, j) => links.push({ source: hub, target: useStart + j, value: u.value, color: u.color }))
    if (flowNet > 0.5) {
      nodes.push({ name: "Kept (net)", color: GREEN })
      links.push({ source: hub, target: nodes.length - 1, value: flowNet, color: GREEN })
    } else if (flowNet < -0.5) {
      nodes.push({ name: "From balance", color: RED })
      links.push({ source: nodes.length - 1, target: hub, value: r2(-flowNet), color: RED })
    }
    return { nodes, links }
  }, [groups, flowNet])

  const renderSankeyNode = (p: any) => {
    const { x, y, width, height, index, payload, containerWidth } = p
    const name: string = payload?.name ?? sankey.nodes[index]?.name ?? ""
    const value = Number(payload?.value) || 0
    const color = sankey.nodes[index]?.color || BLUE
    const isHub = name === "Income"
    const isLeft = x < containerWidth * 0.34
    const cy = y + height / 2
    const nameFs = name.length > 16 ? 9.3 : 10.5
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={3} fill={color} />
        {isHub ? (
          <>
            <text x={x + width / 2} y={cy - 3} textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="800" letterSpacing="1">
              INCOME
            </text>
            <text x={x + width / 2} y={cy + 11} textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="9.5" fontWeight="700">
              ${Math.round(value).toLocaleString()}
            </text>
          </>
        ) : isLeft ? (
          <>
            <text x={x - 8} y={cy - 2} textAnchor="end" fill={INK} fontSize={nameFs} fontWeight="700">
              {name}
            </text>
            <text x={x - 8} y={cy + 11} textAnchor="end" fill={SUB} fontSize="9.5" fontWeight="600">
              ${Math.round(value).toLocaleString()}
            </text>
          </>
        ) : (
          <>
            <text x={x + width + 8} y={cy - 2} textAnchor="start" fill={INK} fontSize={nameFs} fontWeight="700">
              {name}
            </text>
            <text x={x + width + 8} y={cy + 11} textAnchor="start" fill={SUB} fontSize="9.5" fontWeight="600">
              ${Math.round(value).toLocaleString()}
            </text>
          </>
        )}
      </g>
    )
  }

  const renderSankeyLink = (p: any) => {
    const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index, payload } = p
    const color = payload?.color || sankey.links[index]?.color || BLUE
    return (
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        stroke={color}
        strokeWidth={Math.max(1, linkWidth)}
        strokeOpacity={0.34}
        fill="none"
      />
    )
  }

  /* ── Waterfall resumen: Start · +Income · −Housing · −Vehicle · −Other · End ── */
  const wf = useMemo(() => {
    const housing = groups.uses
      .filter((u) => /rent|housing|vivienda/i.test(u.name))
      .reduce((a, u) => a + u.value, 0)
    const vehicle = groups.uses
      .filter((u) => /leasing|lease|car|vehicle|auto|fuel|gas/i.test(u.name))
      .reduce((a, u) => a + u.value, 0)
    const other = r2(expenseTotal - housing - vehicle)
    type WBar = { name: string; base: number; value: number; fill: string; delta: number }
    const bars: WBar[] = []
    let run = fc.start
    bars.push({ name: "Start", base: Math.min(0, fc.start), value: Math.abs(fc.start), fill: "#6b7280", delta: fc.start })
    const pushDelta = (name: string, d: number, fill: string) => {
      const from = run
      run = r2(run + d)
      bars.push({ name, base: Math.min(from, run), value: Math.abs(d), fill, delta: d })
    }
    if (incomeTotal > 0) pushDelta("Income", incomeTotal, GREEN)
    if (housing > 0.5) pushDelta("Housing", -r2(housing), "#e0653a")
    if (vehicle > 0.5) pushDelta("Vehicle", -r2(vehicle), "#e5484d")
    if (other > 0.5) pushDelta("Other", -other, "#dd8433")
    const endFlow = r2(fc.start + incomeTotal - expenseTotal)
    bars.push({ name: "End", base: Math.min(0, endFlow), value: Math.abs(endFlow), fill: endFlow < 0 ? RED : BLUE, delta: endFlow })
    return bars
  }, [groups, incomeTotal, expenseTotal, fc.start])

  /* ── Semanal divergente: entra arriba, sale abajo, punto = neto ── */
  const wk = useMemo(
    () => weeks.map((w) => ({ ...w, outNeg: -w.out, net: r2(w.inn - w.out) })),
    [weeks],
  )

  const transfersPct =
    groups.transfersTotal > 0
      ? Math.round((groups.transfersTotal / Math.max(1, incomeTotal + expenseTotal + groups.transfersTotal)) * 100)
      : 0

  const card: Record<string, string | number> = {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 14,
    minWidth: 0,
  }
  const cardTitle: Record<string, string | number> = {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.8,
    color: SUB,
    marginBottom: 8,
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

      {/* ── HÉROE KPI + BULLET ── */}
      <FadeCard style={{ margin: "0 12px", ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>PROJECTED (30 DAYS)</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: endBal < 0 ? RED : INK, lineHeight: 1.1 }}>
              {endBal < 0 ? "-$" : "$"}
              {money2(endBal)}
            </div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              NET FLOW{" "}
              <b style={{ color: net >= 0 ? GREEN : RED, fontSize: 13.5 }}>{signed(net)}</b>
              <span style={{ marginLeft: 8, fontSize: 10 }}>· {SCENARIO_META[scenario].label}</span>
            </div>
          </div>
          <span
            style={{
              flexShrink: 0,
              border: `1px solid ${health.color}`,
              color: health.color,
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.4,
            }}
          >
            {health.label} {health.pct >= 0 ? "+" : ""}
            {health.pct}%
          </span>
        </div>

        {/* Bullet: relleno = saldo final · tick blanco = inicio · tick ámbar = piso */}
        <div style={{ position: "relative", height: 14, borderRadius: 7, background: TRACK, marginTop: 14 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctOf(endBal)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              borderRadius: 7,
              background: `linear-gradient(90deg, ${health.color}99, ${health.color})`,
            }}
          />
          <span style={{ position: "absolute", left: `${pctOf(fc.start)}%`, top: -3, width: 2.5, height: 20, background: "#fff", borderRadius: 2 }} />
          {CASH_FLOOR < bulletMax && (
            <span style={{ position: "absolute", left: `${pctOf(CASH_FLOOR)}%`, top: -3, width: 2, height: 20, background: AMBER, borderRadius: 2, opacity: 0.9 }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: SUB, marginTop: 5 }}>
          <span>Start ${Math.round(fc.start).toLocaleString()}</span>
          <span style={{ color: AMBER }}>Floor ${CASH_FLOOR}</span>
          <span>End {endBal < 0 ? "-$" : "$"}{Math.round(Math.abs(endBal)).toLocaleString()}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>TOTAL UPCOMING INFLOW</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: GREEN }}>{signed(incomeTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 2 }}>TOTAL UPCOMING OUTFLOW</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: RED }}>{signed(-expenseTotal)}</div>
          </div>
        </div>
      </FadeCard>

      {/* ── LÍNEA DE BALANCE (ESCALÓN) ── */}
      <FadeCard delay={0.05} style={{ margin: "12px 12px 0", ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={cardTitle}>PROJECTED BALANCE</div>
          {minDay && (
            <div style={{ fontSize: 10.5, color: minDay.balance < CASH_FLOOR ? RED : SUB, fontWeight: 700 }}>
              Low ${Math.round(minDay.balance).toLocaleString()} · {fmtFecha(minDay.date)}
            </div>
          )}
        </div>
        <div style={{ width: "100%", height: 248 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={path} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id="f2area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3ddc84" stopOpacity={0.28} />
                  <stop offset="1" stopColor="#3ddc84" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtFechaL}
                tick={{ fill: SUB, fontSize: 10.5 }}
                tickLine={false}
                axisLine={{ stroke: BORDER }}
                minTickGap={44}
              />
              <YAxis
                tickFormatter={fmtK}
                tick={{ fill: SUB, fontSize: 10.5 }}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<ChartTip />} />
              {minDay && minDay.balance < 0 && <ReferenceLine y={0} stroke={RED} strokeDasharray="5 4" />}
              <ReferenceLine
                y={CASH_FLOOR}
                stroke={AMBER}
                strokeDasharray="4 4"
                label={{ value: `floor $${CASH_FLOOR}`, fill: AMBER, fontSize: 9.5, fontWeight: 700, position: "insideTopRight" }}
              />
              <Area type="stepAfter" dataKey="balance" name="Balance" stroke="#3ddc84" strokeWidth={2.4} fill="url(#f2area)" />
              {minDay && (
                <ReferenceDot
                  x={minDay.date}
                  y={minDay.balance}
                  r={4.5}
                  fill={RED}
                  stroke="#fff"
                  strokeWidth={1.6}
                  label={{
                    value: `Low $${Math.round(minDay.balance).toLocaleString()}`,
                    fill: RED,
                    fontSize: 10,
                    fontWeight: 700,
                    position: "top",
                  }}
                />
              )}
              {path.length > 0 && (
                <ReferenceDot x={path[path.length - 1].date} y={endBal} r={4.5} fill={GREEN} stroke="#fff" strokeWidth={1.6} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 11, color: SUB, marginTop: 8, marginBottom: 2 }}>Scenario (live)</div>
        <ScenarioToggle value={scenario} onChange={setScenario} />
      </FadeCard>

      {/* ── FLUJO: SANKEY + LISTAS + NOTA DE TRANSFERS ── */}
      <FadeCard delay={0.1} style={{ margin: "12px 12px 0", ...card }}>
        <div style={cardTitle}>WHERE THE MONEY FLOWS · BY SOURCE</div>
        {sankey.links.length === 0 ? (
          <div style={{ fontSize: 12.5, color: SUB, padding: "8px 0 4px" }}>No income or expenses scheduled in the next 30 days.</div>
        ) : (
          <div style={{ width: "100%", height: 430 }}>
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankey}
                nodePadding={26}
                nodeWidth={13}
                iterations={32}
                linkCurvature={0.5}
                margin={{ top: 6, right: 118, bottom: 6, left: 124 }}
                node={renderSankeyNode}
                link={renderSankeyLink}
              />
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginTop: 12 }} className="flow-lists-grid">
          <style>{`@media (min-width: 720px) { .flow-lists-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
          <RankList title="INCOME BY SOURCE" items={groups.sources} total={incomeTotal} sign="+" />
          <RankList title="SPENDING BY CATEGORY" items={groups.uses} total={expenseTotal} sign="-" />
        </div>
        {groups.transfersCount > 0 && (
          <div style={{ marginTop: 12, paddingTop: 9, borderTop: `1px dashed ${BORDER}`, fontSize: 11, color: SUB, lineHeight: 1.5 }}>
            Internal transfers between your accounts:{" "}
            <b style={{ color: INK }}>${Math.round(groups.transfersTotal).toLocaleString()}</b> ({groups.transfersCount}{" "}
            {groups.transfersCount === 1 ? "move" : "moves"} · {transfersPct}% of all movement) — money moved between your
            own accounts, not income or expenses, so it stays out of the flow above.
          </div>
        )}
      </FadeCard>

      {/* ── WATERFALL RESUMEN ── */}
      <FadeCard delay={0.15} style={{ margin: "12px 12px 0", ...card }}>
        <div style={cardTitle}>BRIDGE · START TO END</div>
        <div style={{ width: "100%", height: 208 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={wf} margin={{ top: 20, right: 8, bottom: 0, left: 2 }}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: SUB, fontSize: 10.5, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: BORDER }}
                interval={0}
              />
              <YAxis tickFormatter={fmtK} tick={{ fill: SUB, fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,.25)" strokeDasharray="4 4" />
              <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="wf" name="Amount" radius={[4, 4, 4, 4]} isAnimationActive={false}>
                {wf.map((b, i) => (
                  <Cell key={i} fill={b.fill} />
                ))}
                <LabelList
                  dataKey="delta"
                  position="top"
                  formatter={(v: any) => signed(Number(v) || 0)}
                  style={{ fill: INK, fontSize: 10.5, fontWeight: 700 }}
                />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </FadeCard>

      {/* ── SEMANAL DIVERGENTE ── */}
      <FadeCard delay={0.2} style={{ margin: "12px 12px 0", ...card }}>
        <div style={cardTitle}>WEEKLY IN vs OUT</div>
        <div style={{ width: "100%", height: 208 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={wk} margin={{ top: 18, right: 10, bottom: 0, left: 2 }}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: SUB, fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: BORDER }}
                interval={0}
              />
              <YAxis tickFormatter={fmtK} tick={{ fill: SUB, fontSize: 10.5 }} tickLine={false} axisLine={false} width={46} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,.3)" />
              <Bar dataKey="inn" name="In" fill={GREEN} radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar dataKey="outNeg" name="Out" fill={RED} radius={[0, 0, 3, 3]} maxBarSize={26} />
              <Line
                dataKey="net"
                name="Net"
                stroke={AMBER}
                strokeWidth={0}
                dot={{ r: 4, fill: AMBER, stroke: "#14161d", strokeWidth: 1.5 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="net"
                  position="top"
                  formatter={(v: any) => signed(Number(v) || 0)}
                  style={{ fill: AMBER, fontSize: 9.5, fontWeight: 700 }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>Green = in · Red = out · Amber dot = net for the week · each bar = 7 days from today</div>
      </FadeCard>

      {/* ── EVENTOS ── */}
      <div style={{ margin: "12px 12px 0", background: BAND_BG, borderRadius: "10px 10px 0 0", padding: "10px 12px", fontSize: 11.5, fontWeight: 800, letterSpacing: 1.1, color: SUB }}>
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
              <span style={{ fontSize: 15, flexShrink: 0 }}>{catIcon(cat, displayLabel(l.label))}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                {displayLabel(l.label)}
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
