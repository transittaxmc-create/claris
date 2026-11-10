"use client"

// División por categorías estilo Quicken (pedido de Miguel, 2026-11-09):
// UNA transacción se reparte en varias categorías — una línea por
// categoría con su monto (y su número de invoice si la línea es una
// factura) — y el editor enseña en vivo la DIFERENCIA entre el total de
// la transacción y lo ya categorizado, hasta llegar a $0.00.
// Se usa igual en Proyecciones (crear/editar) y en el Register (editar
// la transacción): el mismo control en los dos sitios.

import { useState, type CSSProperties } from "react"
import { CUSTOM_CATEGORIES_KEY, EXPENSE_CATEGORIES, round2, splitsSum, type TxSplit } from "./types"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const BORDER = "#262833"
const FIELD = "#1b1e27"
const BLUE = "#5b8cff"

type Row = { category: string; amount: string; invoiceNo: string }

function loadCustomCategories(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || "[]")
    return Array.isArray(raw) ? raw.filter((c) => typeof c === "string" && c.trim()) : []
  } catch {
    return []
  }
}

function toRows(splits: TxSplit[]): Row[] {
  return splits.map((s) => ({
    category: s.category || "Other",
    amount: s.amount ? String(s.amount) : "",
    invoiceNo: s.invoiceNo || "",
  }))
}

function toSplits(rows: Row[]): TxSplit[] {
  return rows.map((r) => {
    const base: TxSplit = {
      category: r.category.trim() || "Other",
      amount: round2(parseFloat(r.amount.replace(/[^0-9.]/g, "")) || 0),
    }
    const inv = r.invoiceNo.trim()
    if (inv) base.invoiceNo = inv
    return base
  })
}

export function SplitEditor(props: {
  kind: "income" | "expense"
  /** Total (absoluto) de la transacción que se está dividiendo. */
  total: number
  /** Categoría simple actual: siembra la primera línea al activar. */
  initialCategory?: string
  splits: TxSplit[] | null
  onChange: (splits: TxSplit[] | null) => void
}) {
  const [rows, setRows] = useState<Row[] | null>(() =>
    props.splits && props.splits.length ? toRows(props.splits) : null,
  )
  const [custom] = useState<string[]>(() => loadCustomCategories())

  const active = rows !== null
  const parsed = rows ? toSplits(rows) : []
  const categorized = splitsSum(parsed)
  const diff = round2(Math.abs(props.total) - categorized)
  const total = Math.abs(props.total) || 0

  const emit = (next: Row[] | null) => {
    setRows(next)
    props.onChange(next === null ? null : toSplits(next))
  }

  const activate = () => {
    const first = props.initialCategory && props.initialCategory !== "Split" ? props.initialCategory : props.kind === "income" ? "Income" : "Other"
    emit([
      { category: first, amount: total ? String(total) : "", invoiceNo: "" },
      { category: props.kind === "income" ? "Income" : "Other", amount: "", invoiceNo: "" },
    ])
  }

  const optionsFor = (current: string): string[] => {
    const base: string[] = props.kind === "income" ? ["Income", ...EXPENSE_CATEGORIES] : [...EXPENSE_CATEGORIES]
    const out = [...base]
    for (const c of custom) {
      if (!out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c)
    }
    if (current && !out.some((o) => o.toLowerCase() === current.toLowerCase())) out.push(current)
    return out
  }

  const field: CSSProperties = {
    boxSizing: "border-box",
    background: FIELD,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    color: INK,
    fontSize: 16,
    padding: "10px 11px",
    outline: "none",
    minWidth: 0,
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={activate}
        style={{
          width: "100%",
          marginTop: 12,
          background: "none",
          border: `1.5px dashed ${BLUE}`,
          borderRadius: 12,
          color: BLUE,
          fontSize: 13.5,
          fontWeight: 800,
          padding: "12px 0",
          cursor: "pointer",
        }}
      >
        ✂ Split into categories
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: SUB, marginTop: 3 }}>
          Divide this transaction into several categories, like Quicken
        </span>
      </button>
    )
  }

  return (
    <div style={{ marginTop: 14, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 12px 13px", background: "#101219" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: SUB }}>SPLIT BY CATEGORY</span>
        <button
          type="button"
          onClick={() => emit(null)}
          style={{ background: "none", border: "none", color: RED, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
        >
          Remove split
        </button>
      </div>

      {rows.map((row, i) => (
        <div key={i} style={{ marginTop: 10, borderTop: i > 0 ? `1px solid ${BORDER}` : "none", paddingTop: i > 0 ? 10 : 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={row.category}
              aria-label={`Category ${i + 1}`}
              onChange={(e) => {
                const next = rows.slice()
                next[i] = { ...next[i], category: e.target.value }
                emit(next)
              }}
              style={{ ...field, flex: 1 }}
            >
              {optionsFor(row.category).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div style={{ position: "relative", width: 118, flexShrink: 0 }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 800, color: SUB }}>$</span>
              <input
                value={row.amount}
                aria-label={`Amount ${i + 1}`}
                onChange={(e) => {
                  const next = rows.slice()
                  next[i] = { ...next[i], amount: e.target.value }
                  emit(next)
                }}
                placeholder="0.00"
                inputMode="decimal"
                style={{ ...field, width: "100%", paddingLeft: 22, fontWeight: 700 }}
              />
            </div>
            <button
              type="button"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => {
                const next = rows.filter((_, j) => j !== i)
                emit(next.length ? next : null)
              }}
              style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 10, color: SUB, fontSize: 15, width: 38, cursor: "pointer", flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
          <input
            value={row.invoiceNo}
            aria-label={`Invoice number ${i + 1}`}
            onChange={(e) => {
              const next = rows.slice()
              next[i] = { ...next[i], invoiceNo: e.target.value }
              emit(next)
            }}
            placeholder="Invoice # (optional)"
            style={{ ...field, width: "100%", marginTop: 7, fontSize: 13.5, padding: "8px 11px" }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => emit([...rows, { category: props.kind === "income" ? "Income" : "Other", amount: "", invoiceNo: "" }])}
        style={{
          width: "100%",
          marginTop: 12,
          background: "none",
          border: `1.5px solid ${BORDER}`,
          borderRadius: 10,
          color: BLUE,
          fontSize: 13,
          fontWeight: 800,
          padding: "10px 0",
          cursor: "pointer",
        }}
      >
        + Add line
      </button>

      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.75 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: SUB }}>Total</span>
          <span style={{ fontWeight: 700 }}>${total.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: SUB }}>Categorized</span>
          <span style={{ fontWeight: 700 }}>${categorized.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 5 }}>
          <span style={{ fontWeight: 800, letterSpacing: 0.5 }}>DIFFERENCE</span>
          <span style={{ fontWeight: 800, color: diff === 0 ? GREEN : RED }}>
            {diff === 0 ? "✓ " : ""}${diff.toFixed(2)}
          </span>
        </div>
        {diff !== 0 && (
          <div style={{ fontSize: 11.5, color: RED, fontWeight: 600 }}>
            {diff > 0 ? "Still to categorize" : "Over the total"} — the split must reach $0.00 to save.
          </div>
        )}
      </div>
    </div>
  )
}
