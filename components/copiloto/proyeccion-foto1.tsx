"use client"

// FOTO 1 — REGISTRO & PRONÓSTICO DE FLUJO DE CAJA (clonada idéntica).
// Va en la pestaña Proyecciones. Datos reales del forecast de 30 días.

import { useMemo, useState, type CSSProperties } from "react"
import { ProyeccionForm } from "./proyeccion-form"
import {
  Gauge,
  catIcon,
  fmtDiaMes,
  fmtFecha,
  fmtWeekday,
  healthOf,
  lineCategory,
  money2,
  signed,
  useForecast30,
  type ProyProps,
} from "./proyeccion-shared"
import type { ForecastLine } from "./dinero-forecast"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"
const BAND = "#1b1e27"

function MiniChart({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const W = 150, H = 92, B = 14
  const min = Math.min(...points), max = Math.max(...points), rng = Math.max(1, max - min)
  const X = (i: number) => 4 + (i / (points.length - 1)) * (W - 8)
  const Y = (v: number) => 6 + (1 - (v - min) / rng) * (H - 6 - B)
  const pts = points.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="f1fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34d17b" stopOpacity=".35" />
          <stop offset="1" stopColor="#34d17b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="4" y1={6 + f * (H - 6 - B)} x2={W - 4} y2={6 + f * (H - 6 - B)} stroke="#23252f" strokeWidth="1" />
      ))}
      <polygon points={`4,${Y(points[0])} ${pts} ${X(points.length - 1)},${H - B} 4,${H - B}`} fill="url(#f1fill)" />
      <polyline points={pts} fill="none" stroke="#34d17b" strokeWidth="2" />
    </svg>
  )
}

export function ProyeccionFoto1(props: ProyProps) {
  const { fc, fcLong, today, schedules } = useForecast30(props)
  const [form, setForm] = useState<null | "income" | "expense">(null)
  const health = healthOf(fc)
  const net = fc.end - fc.start

  // Transacciones futuras (3 meses) con saldo acumulado, en caja con scroll.
  const futuras = useMemo(() => {
    let bal = fcLong.start
    return fcLong.lines
      .filter((l) => l.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((l: ForecastLine) => {
        const before = bal
        bal = Math.round((bal + l.amount) * 100) / 100
        return { line: l, before, after: bal }
      })
  }, [fcLong, today])

  // Desglose por categoría (top 2 ingresos / top 2 gastos, como la foto).
  const desglose = useMemo(() => {
    const inc = new Map<string, number>(), exp = new Map<string, number>()
    for (const l of fc.lines) {
      const c = lineCategory(l, schedules)
      if (l.amount > 0) inc.set(c, (inc.get(c) || 0) + l.amount)
      else exp.set(c, (exp.get(c) || 0) + Math.abs(l.amount))
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
    return { inc: top(inc), exp: top(exp) }
  }, [fc, schedules])

  const chartPts = useMemo(() => {
    const all = [fc.start, ...fc.days.map((d) => d.balance)]
    const step = Math.max(1, Math.floor(all.length / 12))
    const out = all.filter((_, i) => i % step === 0)
    if (out[out.length - 1] !== all[all.length - 1]) out.push(all[all.length - 1])
    return out
  }, [fc])

  const th: CSSProperties = { textAlign: "left", fontSize: 10, color: SUB, letterSpacing: 0.6, padding: "9px 6px", borderBottom: `1px solid ${BORDER}`, fontWeight: 700, whiteSpace: "nowrap" }
  const td: CSSProperties = { padding: "9px 6px", borderBottom: "1px solid #1a1c24", verticalAlign: "top", fontSize: 11.5 }

  // Balance real del banco (Plaid) al cierre de cada fecha: desde hoy hacia
  // atrás restando los movimientos reales. Fechas futuras = último real.
  const bankFor = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const t of props.bankTxs) {
      const d = String(t.date || "").slice(0, 10)
      if (d && d <= today) byDate.set(d, (byDate.get(d) || 0) + (Number(t.amount) || 0))
    }
    const dates = [...byDate.keys()].sort()
    const endOfDay = new Map<string, number>()
    let suffix = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      endOfDay.set(dates[i], Math.round((fc.start - suffix) * 100) / 100)
      suffix += byDate.get(dates[i]) || 0
    }
    return (date: string): number => {
      if (date >= today) return fc.start
      let best: string | null = null
      for (const d of dates) {
        if (d <= date) best = d
        else break
      }
      return best ? (endOfDay.get(best) ?? fc.start) : fc.start
    }
  }, [props.bankTxs, today, fc.start])

  if (form) {
    return <ProyeccionForm initialKind={form} onClose={() => setForm(null)} />
  }

  return (
    <div style={{ paddingBottom: 28, color: INK, overflowX: "hidden", maxWidth: "100%" }}>
      {/* Encabezado como la foto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 10px" }}>
        <span style={{ fontSize: 17, color: SUB }}>⚙️</span>
        <h2 style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: 0.8, textAlign: "center", flex: 1, minWidth: 0 }}>
          REGISTRO &amp; PRONÓSTICO DE FLUJO DE CAJA
        </h2>
        <span style={{ fontSize: 17, color: SUB }}>🔔</span>
      </div>

      {/* RESUMEN DE PROYECCIÓN */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 14px 8px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>RESUMEN DE PROYECCIÓN</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
          SALUD: <span style={{ color: health.color }}>{health.labelEs}</span>
        </span>
      </div>
      <div style={{ margin: "0 12px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 14px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1.15, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>
              SALDO INICIAL HOY ({fmtFecha(today)}):
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, marginBottom: 13 }}>${money2(fc.start)}</div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>INGRESOS PROYECTADOS (30D):</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: GREEN, marginBottom: 13 }}>{signed(fc.incomeTotal)}</div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>GASTOS PROYECTADOS (30D):</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: RED }}>{signed(-fc.expenseTotal)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Gauge health={health} size={104} />
              <div style={{ fontSize: 10.5, fontWeight: 800, color: health.color, marginTop: -2, marginBottom: 10 }}>
                SALUD: {health.labelEs}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>
              SALDO FINAL PRONOSTICADO ({fmtFecha(fc.endDate)}):
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, marginBottom: 6 }}>${money2(fc.end)}</div>
            <div style={{ fontSize: 11.5, color: SUB }}>
              FLUJO NETO: <b style={{ color: net >= 0 ? GREEN : RED }}>{signed(net)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Botones para entrar proyecciones (abren la página formal) */}
      <div style={{ display: "flex", gap: 10, margin: "12px 12px 0" }}>
        <button
          type="button"
          onClick={() => setForm("income")}
          style={{ flex: 1, border: `1.5px solid ${GREEN}`, background: "rgba(52,209,123,.12)", color: GREEN, borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          ＋ Ingreso
        </button>
        <button
          type="button"
          onClick={() => setForm("expense")}
          style={{ flex: 1, border: `1.5px solid ${RED}`, background: "rgba(255,93,108,.10)", color: RED, borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          ＋ Gasto
        </button>
      </div>

      {/* REGISTRO UNIFICADO — sin caja visible, ancho casi completo */}
      <div style={{ padding: "18px 14px 8px", fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
        REGISTRO UNIFICADO
      </div>
      <div>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "15%" }} /><col style={{ width: "22%" }} /><col style={{ width: "15%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "16%" }} /><col style={{ width: "19%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, paddingLeft: 12 }}>FECHA</th><th style={th}>DESCRIPCIÓN</th><th style={th}>CATEGORÍA</th>
              <th style={{ ...th, textAlign: "right" }}>BANK</th><th style={{ ...th, textAlign: "right" }}>MONTO</th>
              <th style={{ ...th, textAlign: "right" }}>SALDO ACUM.</th>
            </tr>
          </thead>
        </table>
        <div style={{ background: BAND, padding: "8px 14px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB }}>
          TRANSACCIONES FUTURAS / PRONÓSTICO
        </div>
        <div style={{ maxHeight: "46vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "15%" }} /><col style={{ width: "22%" }} /><col style={{ width: "15%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "16%" }} /><col style={{ width: "19%" }} />
          </colgroup>
          <tbody>
            {futuras.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: SUB }}>Sin transacciones futuras programadas.</td></tr>
            )}
            {futuras.map(({ line, before, after }, i) => {
              const cat = lineCategory(line, schedules)
              return (
                <tr key={line.id + i} style={i === 0 ? { background: "rgba(201,162,39,.14)" } : undefined}>
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600, paddingLeft: 12 }}>
                    {fmtFecha(line.date)}
                    <div style={{ fontSize: 8, color: SUB, fontWeight: 500, marginTop: 1 }}>{fmtWeekday(line.date)}</div>
                  </td>
                  <td style={{ ...td, overflow: "hidden" }}>
                    <span style={{ fontWeight: 600 }}>{line.label}</span>
                  </td>
                  <td style={{ ...td, color: "#c9cbd8", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ display: "inline-block", width: 19, textAlign: "center", marginRight: 3, fontSize: 12 }}>{catIcon(cat, line.label)}</span>
                    {cat}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#c9cbd8", whiteSpace: "nowrap", fontSize: 10.5 }}>
                    ${money2(bankFor(line.date))}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: line.amount >= 0 ? GREEN : RED, whiteSpace: "nowrap", fontSize: 11 }}>
                    {signed(line.amount)}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: SUB, fontSize: 10.5, whiteSpace: "nowrap" }}>
                    ${money2(before)}<br />→ ${money2(after)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {/* DESGLOSE DE PRONÓSTICO */}
        <div style={{ padding: "14px 14px 10px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB, marginBottom: 8 }}>DESGLOSE DE PRONÓSTICO</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: "38%", minWidth: 0 }}>
              <MiniChart points={chartPts} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: SUB, marginTop: 2 }}>
                <span>{fmtDiaMes(today)}</span><span>{fmtDiaMes(fc.endDate)}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: SUB, fontSize: 10, marginBottom: 4, whiteSpace: "nowrap" }}>Sources of Cash</div>
                  {desglose.inc.map(([c, v]) => (
                    <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c}</span>
                      <b style={{ color: GREEN, whiteSpace: "nowrap" }}>+${Math.round(v).toLocaleString()}</b>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: SUB, fontSize: 10, marginBottom: 4, whiteSpace: "nowrap" }}>Uses of Cash</div>
                  {desglose.exp.map(([c, v]) => (
                    <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c}</span>
                      <b style={{ color: RED, whiteSpace: "nowrap" }}>-${Math.round(v).toLocaleString()}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right", marginTop: 6, fontSize: 11, color: SUB, whiteSpace: "nowrap" }}>
                FLUJO NETO: <b style={{ color: net >= 0 ? GREEN : RED }}>{signed(net)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* HOY */}
        <div style={{ background: BAND, padding: "10px 14px", fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4 }}>
          HOY, {fmtFecha(today)} - SALDO ACTUAL: ${money2(fc.start)}
        </div>
      </div>
    </div>
  )
}
