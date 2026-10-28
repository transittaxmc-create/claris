"use client"

// FOTO 1 — REGISTRO & PRONÓSTICO DE FLUJO DE CAJA (clonada idéntica).
// Va en la pestaña Proyecciones. Datos reales del forecast de 30 días.

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { ProyeccionForm, ProyeccionEdit } from "./proyeccion-form"
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
import { platformMatch, vendorMatch, SCHEDULE_OVERRIDES_KEY, type ForecastLine, type ProbablePaid } from "./dinero-forecast"
import { useForecastInputs } from "./dinero-proyeccion"
import { FINANCE_LEDGER_KEY, FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./finance-sync"
import type { CashFlowEntry } from "./types"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"
const BAND = "#1b1e27"

const btnOk: CSSProperties = { background: "#34d17b26", color: GREEN, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }
const btnAmber: CSSProperties = { background: "#f5b73f26", color: "#f5b73f", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }
const btnGhost: CSSProperties = { background: "#262833", color: "#c9cbd8", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }

function readLedger(): CashFlowEntry[] {
  try {
    const raw = localStorage.getItem(FINANCE_LEDGER_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function notifySync() {
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

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

export function ProyeccionFoto1(props: ProyProps & { onScan?: () => void }) {
  const { fc, fcLong, today, schedules } = useForecast30(props)
  const [form, setForm] = useState<null | "income" | "expense">(null)
  const [editing, setEditing] = useState<ForecastLine | null>(null)

  // ——— Cuentas por pagar: reconciliación automática (2026-10-24) ———
  // El forecast cruza cada proyectado contra el banco (probablePaid).
  // Match EXACTO al centavo — y en ingresos, con comercio o plataforma
  // identificable — se marca pagado SOLO. Lo demás espera abajo en
  // POR CONFIRMAR: nada se cierra por adivinanza.
  const { dismissed, setDismissed } = useForecastInputs()
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null)
  const [adjustReason, setAdjustReason] = useState("")

  // ——— Quitar TODO lo proyectado (pedido de Miguel, 2026-10-25) ———
  // Lo proyectado se borra desde ESTA misma pantalla para empezar a
  // programar desde cero con ＋ Income / ＋ Expense. Misma regla que el
  // DELETE PROJECTION DATA ONLY de Data: fuera recurrentes + overrides +
  // proyectados sin pagar; se quedan banco, viajes, pagos reales y los
  // cobros reconciliados de EARNINGS (claris:cobro:*). El historial de
  // POR PAGAR no se toca.
  const [wipeCounts, setWipeCounts] = useState<{ schedules: number; projected: number } | null>(null)
  const contarProyectado = () => {
    try {
      const sch = JSON.parse(localStorage.getItem(FINANCE_SCHEDULES_KEY) || "[]")
      const led = readLedger()
      const projected = led.filter(
        (e) => e && e.status === "projected" && !String(e.id).startsWith("claris:cobro:"),
      ).length
      setWipeCounts({ schedules: Array.isArray(sch) ? sch.length : 0, projected })
    } catch {
      setWipeCounts({ schedules: 0, projected: 0 })
    }
  }
  const quitarTodoProyectado = () => {
    try {
      const kept = readLedger().filter(
        (e) => !(e && e.status === "projected" && !String(e.id).startsWith("claris:cobro:")),
      )
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(kept))
      localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify([]))
      localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify([]))
    } catch {}
    setWipeCounts(null)
    notifySync()
  }

  const esSeguro = (p: ProbablePaid): boolean => {
    const diff = Math.abs(Math.abs(Number(p.tx.amount) || 0) - Math.abs(Number(p.entry.amount) || 0))
    if (diff > 0.011) return false
    if (p.entry.type === "expense") return true
    return vendorMatch(p.tx.detail, p.entry.description) || platformMatch(p.tx.detail, p.entry.description)
  }

  const aplicarPagado = (p: ProbablePaid, ajuste?: { diff: number; reason: string }) => {
    const paidDate = String(p.tx.date).slice(0, 10)
    let next = readLedger().map((e) =>
      e.id === p.entry.id
        ? { ...e, status: "actual" as CashFlowEntry["status"], date: paidDate, isManuallyEdited: true }
        : e,
    )
    if (ajuste && Math.abs(ajuste.diff) > 0.011) {
      const diff = ajuste.diff
      const adj = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `adj-${Date.now()}`,
        date: paidDate,
        description: `Adjustment: ${ajuste.reason}`,
        source: "manual",
        sourceLabel: "Match adjustment",
        type: diff < 0 ? "expense" : "income",
        status: "actual",
        amount: Math.abs(diff),
        category: /fee/i.test(ajuste.reason) ? "Bank fees" : "Adjustment",
        notes: `Balances "${p.entry.description || "entry"}": bank vs projected diff ${diff < 0 ? "-" : "+"}$${Math.abs(diff).toFixed(2)}`,
        createdAt: new Date().toISOString(),
        isManuallyEdited: true,
      } as unknown as CashFlowEntry
      next = [adj, ...next]
    }
    try {
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
    } catch {}
    notifySync()
  }

  // Auto-aplicar los matches seguros en cuanto el forecast los detecta.
  const segurosKey = fcLong.probablePaid.filter(esSeguro).map((p) => p.key).join(",")
  useEffect(() => {
    const seguros = fcLong.probablePaid.filter(esSeguro)
    if (seguros.length === 0) return
    const byId = new Map(seguros.map((p) => [p.entry.id, p]))
    let changed = false
    const next = readLedger().map((e) => {
      const p = byId.get(e.id)
      if (!p || e.status !== "projected") return e
      changed = true
      return { ...e, status: "actual" as CashFlowEntry["status"], date: String(p.tx.date).slice(0, 10), isManuallyEdited: true }
    })
    if (!changed) return
    try {
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
    } catch {}
    notifySync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segurosKey])

  const porConfirm = fcLong.probablePaid.filter((p) => !esSeguro(p) && !dismissed.includes(p.key))
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

  if (editing) {
    return (
      <ProyeccionEdit
        line={editing}
        schedule={schedules.find((s) => s.id === editing.scheduleId)}
        onClose={() => setEditing(null)}
      />
    )
  }

  // Saldo proyectado con claridad: verde = fuerte, amarillo = débil
  // (bajo el balance de hoy), rojo = negativo.
  const fmtBal = (v: number) => (v < 0 ? "-$" : "$") + money2(v)
  const saldoColor = (v: number) => (v < 0 ? RED : v < fcLong.start ? "#f5b73f" : GREEN)

  return (
    <div style={{ paddingBottom: 28, color: INK, overflowX: "hidden", maxWidth: "100%" }}>
      {/* Encabezado como la foto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 10px" }}>
        <span style={{ fontSize: 17, color: SUB }}>⚙️</span>
        <h2 style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: 0.8, textAlign: "center", flex: 1, minWidth: 0 }}>
          CASH FLOW REGISTER & FORECAST
        </h2>
        <span style={{ fontSize: 17, color: SUB }}>🔔</span>
      </div>

      {/* PROJECTION SUMMARY */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 14px 8px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>PROJECTION SUMMARY</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
          HEALTH: <span style={{ color: health.color }}>{health.label}</span>
        </span>
      </div>
      <div style={{ margin: "0 12px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 14px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1.15, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>
              STARTING BALANCE TODAY ({fmtFecha(today)}):
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, marginBottom: 13 }}>{fc.start < 0 ? "-$" : "$"}{money2(fc.start)}</div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>PROJECTED INCOME (30D):</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: GREEN, marginBottom: 13 }}>{signed(fc.incomeTotal)}</div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>PROJECTED EXPENSES (30D):</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: RED }}>{signed(-fc.expenseTotal)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Gauge health={health} size={104} />
              <div style={{ fontSize: 10.5, fontWeight: 800, color: health.color, marginTop: -2, marginBottom: 10 }}>
                HEALTH: {health.label}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: SUB, letterSpacing: 0.4, marginBottom: 3 }}>
              FORECAST ENDING BALANCE ({fmtFecha(fc.endDate)}):
            </div>
            {/* El saldo final SÍ puede ser negativo (es proyectado) y
                debe VERSE negativo: antes se imprimía con money2() que
                usa Math.abs y botaba el signo — se veía +$8,247.32
                cuando la cuenta daba −$8,247.32. */}
            <div style={{ fontSize: 25, fontWeight: 800, marginBottom: 6, color: fc.end < 0 ? RED : undefined }}>{fc.end < 0 ? "-$" : "$"}{money2(fc.end)}</div>
            <div style={{ fontSize: 11.5, color: SUB }}>
              NET FLOW: <b style={{ color: net >= 0 ? GREEN : RED }}>{signed(net)}</b>
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
          ＋ Income
        </button>
        <button
          type="button"
          onClick={() => setForm("expense")}
          style={{ flex: 1, border: `1.5px solid ${RED}`, background: "rgba(255,93,108,.10)", color: RED, borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          ＋ Expense
        </button>
        {props.onScan && (
          <button
            type="button"
            onClick={props.onScan}
            style={{ flex: 1, border: "1.5px solid #5b8cff", background: "rgba(91,140,255,.10)", color: "#5b8cff", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
          >
            📷 Scan
          </button>
        )}
      </div>

      {/* Remove all projected: empezar a programar desde cero */}
      {wipeCounts === null ? (
        <div style={{ margin: "10px 12px 0" }}>
          <button
            type="button"
            onClick={contarProyectado}
            style={{ width: "100%", border: `1px solid ${BORDER}`, background: "transparent", color: SUB, borderRadius: 12, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Remove all projected
          </button>
        </div>
      ) : (
        <div style={{ margin: "10px 12px 0", background: CARD, border: "1px solid #7c2d12", borderRadius: 12, padding: "10px 12px" }}>
          <p style={{ fontSize: 11.5, color: INK, margin: 0 }}>
            This deletes <b>{wipeCounts.schedules} recurring</b> and <b>{wipeCounts.projected} unpaid projected</b> entries.
          </p>
          <p style={{ fontSize: 10.5, color: SUB, margin: "4px 0 0" }}>
            Kept: bank, trips, real payments, Earnings payouts and the Payables history. Then add
            your own with ＋ Income / ＋ Expense — everything editable.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={quitarTodoProyectado}
              style={{ flex: 1, background: "#b91c1c", color: "#fff", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              Yes, remove all
            </button>
            <button
              type="button"
              onClick={() => setWipeCounts(null)}
              style={{ flex: 1, background: "#262833", color: "#c9cbd8", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* UNIFIED REGISTER — sin caja visible, ancho casi completo */}
      <div style={{ padding: "18px 14px 8px", fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: SUB }}>
        UNIFIED REGISTER
      </div>
      <div>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "17%" }} /><col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, paddingLeft: 12 }}>DATE</th><th style={th}>DESCRIPTION</th><th style={th}>CATEGORY</th>
              <th style={{ ...th, textAlign: "right" }}>BANK</th><th style={{ ...th, textAlign: "right" }}>AMOUNT</th>
              <th style={{ ...th, textAlign: "right" }}>RUNNING BAL.</th>
            </tr>
          </thead>
        </table>
        <div style={{ background: BAND, padding: "8px 14px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB }}>
          FUTURE TRANSACTIONS / FORECAST
        </div>
        <div style={{ maxHeight: "46vh", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "17%" }} /><col style={{ width: "20%" }} />
          </colgroup>
          <tbody>
            {futuras.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: SUB }}>No future transactions scheduled.</td></tr>
            )}
            {futuras.map(({ line, before, after }, i) => {
              const cat = lineCategory(line, schedules)
              return (
                <tr
                  key={line.id + i}
                  onClick={() => (line.entry || line.scheduleId) && setEditing(line)}
                  style={{
                    ...(i === 0 ? { background: "rgba(201,162,39,.14)" } : undefined),
                    ...((line.entry || line.scheduleId) ? { cursor: "pointer" } : undefined),
                  }}
                >
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
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: line.amount >= 0 ? GREEN : RED, whiteSpace: "nowrap", fontSize: 12.5, paddingLeft: 2 }}>
                    {signed(line.amount)}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ color: SUB, fontSize: 10.5 }}>{fmtBal(before)}</span>
                    <br />
                    <span style={{ color: saldoColor(after), fontSize: 12.5, fontWeight: 600 }}>→ {fmtBal(after)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {/* FORECAST BREAKDOWN */}
        <div style={{ padding: "14px 14px 10px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB, marginBottom: 8 }}>FORECAST BREAKDOWN</div>
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
                NET FLOW: <b style={{ color: net >= 0 ? GREEN : RED }}>{signed(net)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* HOY */}
        <div style={{ background: BAND, padding: "10px 14px", fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4 }}>
          TODAY, {fmtFecha(today)} - CURRENT BALANCE: ${money2(fc.start)}
        </div>
      </div>

      {/* POR CONFIRMAR — apareció en el banco pero no cierra solo:
          trae diferencia de monto o el comercio no es claro. */}
      {porConfirm.length > 0 && (
        <div style={{ marginTop: 12, background: CARD, border: "1px solid #14532d", borderRadius: 16, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: GREEN }}>
            TO CONFIRM · {porConfirm.length}
          </div>
          <p style={{ fontSize: 10, color: SUB, margin: "3px 0 9px" }}>
            It showed up at the bank but with a difference or no clear merchant. You confirm or dismiss it.
          </p>
          {porConfirm.map((p) => {
            const entryAmt = Math.abs(Number(p.entry.amount) || 0)
            const bankAmt = Math.abs(Number(p.tx.amount) || 0)
            const diff = Math.round((bankAmt - entryAmt) * 100) / 100
            const hasDiff = Math.abs(diff) > 0.011
            const isAdjusting = adjustingKey === p.key
            return (
              <div key={p.key} style={{ border: `1px solid ${BORDER}`, background: "#0b0d12", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.entry.description || "Transaction"}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>${money2(entryAmt)}</span>
                </div>
                <div style={{ fontSize: 10, color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Bank {fmtFecha(String(p.tx.date).slice(0, 10))} · {p.tx.detail} · ${money2(bankAmt)}
                </div>
                {hasDiff && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f5b73f", marginTop: 2 }}>
                    Difference: ${money2(Math.abs(diff))} {diff < 0 ? "less" : "more"}
                  </div>
                )}
                {!isAdjusting ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button type="button" onClick={() => aplicarPagado(p)} style={btnOk}>
                      Yes, paid
                    </button>
                    {hasDiff && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingKey(p.key)
                          setAdjustReason("")
                        }}
                        style={btnAmber}
                      >
                        Adjust ${money2(Math.abs(diff))}
                      </button>
                    )}
                    <button type="button" onClick={() => setDismissed([...dismissed, p.key])} style={btnGhost}>
                      Not this one
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <input
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="Reason (e.g.: platform fee)"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "#14161d",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        color: INK,
                        fontSize: 11,
                        padding: "6px 8px",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          aplicarPagado(p, { diff, reason: adjustReason.trim() || "Adjustment" })
                          setAdjustingKey(null)
                        }}
                        style={btnOk}
                      >
                        Confirm
                      </button>
                      <button type="button" onClick={() => setAdjustingKey(null)} style={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
