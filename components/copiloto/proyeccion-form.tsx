"use client"

// PÁGINA formal para entrar una proyección (ingreso o gasto).
// No es popup ni panel lateral: ocupa la página completa de Proyecciones
// y al guardar regresa a la página. Guarda en los mismos datos de siempre:
// una vez → libro (CashFlowEntry projected); recurrente → ScheduledEntry.

import { useMemo, useState, type CSSProperties } from "react"
import { EXPENSE_CATEGORIES, type CashFlowEntry, type ScheduledEntry } from "./types"
import { FINANCE_LEDGER_KEY, FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./finance-sync"
import { etiquetaCombinada } from "./cash-flow-store"
import { todayKey } from "./dinero-forecast"
import { catIcon, fmtFecha, fmtWeekday } from "./proyeccion-shared"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"
const FIELD = "#1b1e27"

type Freq = "once" | "daily" | "weekly" | "biweekly" | "monthly"
const FREQS: { value: Freq; label: string }[] = [
  { value: "once", label: "Una vez" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Cada 2 semanas" },
  { value: "monthly", label: "Mensual" },
]

function readList<T>(key: string): T[] {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(p) ? (p as T[]) : []
  } catch {
    return []
  }
}

function notifySync() {
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

export function ProyeccionForm(props: {
  initialKind: "income" | "expense"
  onClose: () => void
}) {
  const [kind, setKind] = useState<"income" | "expense">(props.initialKind)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>(props.initialKind === "income" ? "Income" : "Other")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayKey())
  const [freq, setFreq] = useState<Freq>("once")
  const [error, setError] = useState("")

  const amt = useMemo(() => Math.round((parseFloat(amount.replace(/[^0-9.]/g, "")) || 0) * 100) / 100, [amount])
  const accent = kind === "income" ? GREEN : RED

  const switchKind = (k: "income" | "expense") => {
    setKind(k)
    setCategory(k === "income" ? "Income" : "Other")
    setError("")
  }

  const save = () => {
    const desc = description.trim()
    if (!desc) {
      setError("Escribe la descripción (a quién se le paga o de dónde viene).")
      return
    }
    if (!(amt > 0)) {
      setError("Escribe el monto.")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Elige la fecha.")
      return
    }
    if (freq === "once") {
      const entry: CashFlowEntry = {
        id: `manual-${Date.now().toString(36)}`,
        date,
        description: desc,
        amount: amt,
        type: kind,
        status: "projected",
        source: "projection",
        origin: "manual",
        sourceLabel: etiquetaCombinada("manual", kind === "expense" ? "factura" : null),
        category,
        notes: "",
        createdAt: new Date().toISOString(),
      }
      const next = [entry, ...readList<CashFlowEntry>(FINANCE_LEDGER_KEY)]
      try {
        localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
      } catch {}
    } else {
      const sched: ScheduledEntry = {
        id: `sch-${Date.now().toString(36)}`,
        kind,
        description: desc,
        category,
        amount: amt,
        startDate: date,
        frequency: freq,
        nextDate: date,
        active: true,
      }
      const next = [...readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY), sched]
      try {
        localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify(next))
      } catch {}
    }
    notifySync()
    props.onClose()
  }

  const label: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB, margin: "18px 0 8px" }
  const input: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: FIELD,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    color: INK,
    fontSize: 16,
    padding: "13px 14px",
    outline: "none",
  }
  const chip = (active: boolean, color?: string): CSSProperties => ({
    border: `1.5px solid ${active ? color || accent : BORDER}`,
    background: active ? `${color || accent}22` : FIELD,
    color: active ? color || accent : "#c9cbd8",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  })

  return (
    <div style={{ paddingBottom: 32, color: INK }}>
      {/* Encabezado de página */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 4px" }}>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Volver"
          style={{ background: "none", border: "none", color: SUB, fontSize: 22, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}
        >
          ‹
        </button>
        <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.2, flex: 1, textAlign: "center", marginRight: 34 }}>
          NUEVA PROYECCIÓN
        </h2>
      </div>

      <div style={{ margin: "10px 12px 0", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "18px 16px 20px" }}>
        {/* Tipo: Ingreso / Gasto */}
        <div style={{ display: "flex", background: FIELD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4, gap: 4 }}>
          {(["income", "expense"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => switchKind(k)}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 9,
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                background: kind === k ? (k === "income" ? GREEN : RED) : "transparent",
                color: kind === k ? "#0b0d12" : SUB,
              }}
            >
              {k === "income" ? "Ingreso" : "Gasto"}
            </button>
          ))}
        </div>

        {/* Descripción */}
        <div style={label}>DESCRIPCIÓN</div>
        <input
          style={input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === "income" ? "Ej. Cobro Uber, depósito…" : "Ej. Renta, CB Livery, AT&T…"}
        />

        {/* Categoría */}
        <div style={label}>CATEGORÍA</div>
        {kind === "income" ? (
          <div style={{ display: "flex" }}>
            <span style={chip(true, GREEN)}>{catIcon("Income", "")} Income</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} style={chip(category === c)}>
                {catIcon(c, "")} {c}
              </button>
            ))}
          </div>
        )}

        {/* Monto */}
        <div style={label}>MONTO</div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, fontWeight: 800, color: accent }}>$</span>
          <input
            style={{ ...input, paddingLeft: 32, fontSize: 22, fontWeight: 800, color: accent }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>

        {/* Fecha */}
        <div style={label}>FECHA</div>
        <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {/^\d{4}-\d{2}-\d{2}$/.test(date) && (
          <div style={{ fontSize: 12, color: SUB, marginTop: 6 }}>
            {fmtWeekday(date)}, {fmtFecha(date)}
          </div>
        )}

        {/* Repetición */}
        <div style={label}>SE REPITE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FREQS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFreq(f.value)} style={chip(freq === f.value)}>
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 16, color: RED, fontSize: 13, fontWeight: 600 }}>{error}</div>
        )}

        {/* Guardar */}
        <button
          type="button"
          onClick={save}
          style={{
            width: "100%",
            marginTop: 22,
            border: "none",
            borderRadius: 12,
            padding: "15px 0",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 0.6,
            cursor: "pointer",
            background: accent,
            color: "#0b0d12",
          }}
        >
          GUARDAR
        </button>
        <button
          type="button"
          onClick={props.onClose}
          style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: SUB, fontSize: 13.5, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
