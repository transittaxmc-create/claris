"use client"

// PÁGINA formal para entrar una proyección (ingreso o gasto).
// No es popup ni panel lateral: ocupa la página completa de Proyecciones
// y al guardar regresa a la página. Guarda en los mismos datos de siempre:
// una vez → libro (CashFlowEntry projected); recurrente → ScheduledEntry.

import { useMemo, useState, type CSSProperties } from "react"
import { CUSTOM_CATEGORIES_KEY, EXPENSE_CATEGORIES, type CashFlowEntry, type ScheduledEntry } from "./types"
import { FINANCE_LEDGER_KEY, FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./finance-sync"
import { etiquetaCombinada } from "./cash-flow-store"
import { SCHEDULE_OVERRIDES_KEY, todayKey, type ForecastLine, type ScheduleOverride } from "./dinero-forecast"
import { fmtFecha, fmtWeekday } from "./proyeccion-shared"

const INK = "#f2f3f7"
const SUB = "#9a9cb0"
const GREEN = "#34d17b"
const RED = "#ff5d6c"
const CARD = "#14161d"
const BORDER = "#262833"
const FIELD = "#1b1e27"

type Freq = "once" | "daily" | "weekly" | "biweekly" | "monthly"
const FREQS: { value: Freq; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
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

// ——— Categoría con DROPDOWN (pedido de Miguel, 2026-10-26) ———
// Igual que en Gastos: un dropdown en vez de todos los botoncitos (se
// ve más organizado y ocupa menos espacio), y arriba la opción de
// AÑADIR una categoría que no esté. La categoría nueva queda guardada
// en claris_custom_categories — la misma lista de Gastos y el escáner —
// y sube a Supabase con finance-cloud. Sirve para ingreso y gasto, en
// el formulario de crear y en el de editar.
function loadCustomCategories(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || "[]")
    return Array.isArray(raw) ? raw.filter((c) => typeof c === "string" && c.trim()) : []
  } catch {
    return []
  }
}

function CategorySelect(props: {
  kind: "income" | "expense"
  value: string
  onChange: (v: string) => void
  fieldStyle: CSSProperties
  labelStyle: CSSProperties
}) {
  const [custom, setCustom] = useState<string[]>(() => loadCustomCategories())
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")

  const base: string[] = props.kind === "income" ? ["Income"] : [...EXPENSE_CATEGORIES]
  const options = [...base]
  for (const c of custom) {
    if (!options.some((o) => o.toLowerCase() === c.toLowerCase())) options.push(c)
  }
  // El valor actual siempre aparece en la lista, aunque sea viejo.
  if (props.value && !options.some((o) => o.toLowerCase() === props.value.toLowerCase())) {
    options.push(props.value)
  }

  const addCategory = () => {
    const name = newName.trim()
    if (!name) return
    const exists = [...base, ...EXPENSE_CATEGORIES, ...custom].some(
      (c) => c.toLowerCase() === name.toLowerCase(),
    )
    if (!exists) {
      const next = [...custom, name]
      setCustom(next)
      try {
        localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(next))
      } catch {}
      notifySync()
    }
    props.onChange(name)
    setNewName("")
    setAdding(false)
  }

  return (
    <>
      <div
        style={{
          ...props.labelStyle,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span>CATEGORY</span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "#5b8cff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
        >
          + Add category
        </button>
      </div>
      {adding && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            style={{ ...props.fieldStyle, flex: 1, minWidth: 0, padding: "11px 12px", fontSize: 14 }}
          />
          <button
            type="button"
            onClick={addCategory}
            style={{
              border: "none",
              borderRadius: 12,
              background: "#5b8cff",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              padding: "0 16px",
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      )}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} style={props.fieldStyle}>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </>
  )
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
      setError("Enter the description (who gets paid or where it comes from).")
      return
    }
    if (!(amt > 0)) {
      setError("Enter the amount.")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick the date.")
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
  return (
    <div style={{ paddingBottom: 32, color: INK }}>
      {/* Encabezado de página */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 4px" }}>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Back"
          style={{ background: "none", border: "none", color: SUB, fontSize: 22, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}
        >
          ‹
        </button>
        <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.2, flex: 1, textAlign: "center", marginRight: 34 }}>
          NEW PROJECTION
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
              {k === "income" ? "Income" : "Expense"}
            </button>
          ))}
        </div>

        {/* Descripción */}
        <div style={label}>DESCRIPTION</div>
        <input
          style={input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === "income" ? "E.g. Uber payout, deposit…" : "E.g. Rent, CB Livery, AT&T…"}
        />

        {/* Categoría: dropdown + añadir la que no esté (como en Gastos) */}
        <CategorySelect kind={kind} value={category} onChange={setCategory} fieldStyle={input} labelStyle={label} />

        {/* Monto */}
        <div style={label}>AMOUNT</div>
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
        <div style={label}>DATE</div>
        <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {/^\d{4}-\d{2}-\d{2}$/.test(date) && (
          <div style={{ fontSize: 12, color: SUB, marginTop: 6 }}>
            {fmtWeekday(date)}, {fmtFecha(date)}
          </div>
        )}

        {/* Repeats: dropdown, same as Category (Miguel, 2026-10-26) */}
        <div style={label}>REPEATS</div>
        <select value={freq} onChange={(e) => setFreq(e.target.value as Freq)} style={input}>
          {FREQS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

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
          SAVE
        </button>
        <button
          type="button"
          onClick={props.onClose}
          style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: SUB, fontSize: 13.5, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EDITAR una transacción del register (corregir un error), misma página
// formal. Entrada del libro: actualiza o elimina la entrada. Recurrente:
// "solo esta fecha" guarda un override; "para todas" actualiza el recurrente.
// ---------------------------------------------------------------------------

export function ProyeccionEdit(props: {
  line: ForecastLine
  schedule?: ScheduledEntry
  onClose: () => void
}) {
  const line = props.line
  const entry = line.entry
  const isSchedule = !entry && !!line.scheduleId
  const kind: "income" | "expense" = entry ? entry.type : line.amount >= 0 ? "income" : "expense"
  const accent = kind === "income" ? GREEN : RED

  const [description, setDescription] = useState(
    entry ? entry.description || "" : line.label || props.schedule?.description || "",
  )
  const [category, setCategory] = useState<string>(
    entry ? entry.category || "Other" : props.schedule?.category || "Other",
  )
  const [amount, setAmount] = useState(String(Math.abs(line.amount) || ""))
  const [date, setDate] = useState(entry ? entry.date : line.date)
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const amt = Math.round((parseFloat(amount.replace(/[^0-9.]/g, "")) || 0) * 100) / 100

  const validate = (): boolean => {
    if (!description.trim()) {
      setError("Enter the description.")
      return false
    }
    if (!(amt > 0)) {
      setError("Enter the amount.")
      return false
    }
    return true
  }

  const saveEntry = () => {
    if (!entry || !validate()) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick the date.")
      return
    }
    const next = readList<CashFlowEntry>(FINANCE_LEDGER_KEY).map((e) =>
      e.id === entry.id
        ? { ...e, description: description.trim(), category, amount: amt, date, isManuallyEdited: true }
        : e,
    )
    try {
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
    } catch {}
    notifySync()
    props.onClose()
  }

  const deleteEntry = () => {
    if (!entry) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const next = readList<CashFlowEntry>(FINANCE_LEDGER_KEY).filter((e) => e.id !== entry.id)
    try {
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(next))
    } catch {}
    notifySync()
    props.onClose()
  }

  const saveOverride = (skip = false) => {
    if (!line.scheduleId) return
    if (!skip && !validate()) return
    const ovs = readList<ScheduleOverride>(SCHEDULE_OVERRIDES_KEY).filter(
      (o) => !(o.scheduleId === line.scheduleId && o.date === line.date),
    )
    ovs.push(
      skip
        ? { scheduleId: line.scheduleId, date: line.date, skip: true }
        : { scheduleId: line.scheduleId, date: line.date, amount: amt, label: description.trim() },
    )
    try {
      localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(ovs))
    } catch {}
    notifySync()
    props.onClose()
  }

  const saveScheduleAll = () => {
    if (!props.schedule || !validate()) return
    const next = readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY).map((s) =>
      s.id === props.schedule!.id
        ? { ...s, description: description.trim(), category, amount: amt }
        : s,
    )
    try {
      localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify(next))
    } catch {}
    notifySync()
    props.onClose()
  }

  // Eliminar el recurrente COMPLETO (todas sus fechas) y sus overrides.
  // Miguel pidió poder borrar los datos que él entra (2026-10-24): antes
  // un recurrente solo se podía editar o saltar una fecha, nunca borrar.
  const deleteSchedule = () => {
    if (!props.schedule) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const next = readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY).filter((s) => s.id !== props.schedule!.id)
    try {
      localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify(next))
    } catch {}
    const ovs = readList<ScheduleOverride>(SCHEDULE_OVERRIDES_KEY).filter(
      (o) => o.scheduleId !== props.schedule!.id,
    )
    try {
      localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(ovs))
    } catch {}
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
  const mainBtn: CSSProperties = {
    width: "100%",
    marginTop: 14,
    border: "none",
    borderRadius: 12,
    padding: "15px 0",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.6,
    cursor: "pointer",
    background: accent,
    color: "#0b0d12",
  }
  const ghostBtn: CSSProperties = {
    width: "100%",
    marginTop: 10,
    background: "none",
    border: `1.5px solid ${BORDER}`,
    borderRadius: 12,
    color: "#c9cbd8",
    fontSize: 14,
    fontWeight: 700,
    padding: "13px 0",
    cursor: "pointer",
  }

  return (
    <div style={{ paddingBottom: 32, color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 4px" }}>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Back"
          style={{ background: "none", border: "none", color: SUB, fontSize: 22, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}
        >
          ‹
        </button>
        <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.2, flex: 1, textAlign: "center", marginRight: 34 }}>
          EDIT PROJECTION
        </h2>
      </div>

      <div style={{ margin: "10px 12px 0", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "18px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: `${accent}22`, color: accent, border: `1.5px solid ${accent}`, borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 800 }}>
            {kind === "income" ? "Income" : "Expense"}
          </span>
          <span style={{ color: SUB, fontSize: 12.5 }}>
            {fmtWeekday(line.date)}, {fmtFecha(line.date)}
            {isSchedule ? " · Recurring" : ""}
          </span>
        </div>

        <div style={label}>DESCRIPTION</div>
        <input style={input} value={description} onChange={(e) => setDescription(e.target.value)} />

        {/* Categoría: dropdown + añadir la que no esté (como en Gastos) */}
        <CategorySelect kind={kind} value={category} onChange={setCategory} fieldStyle={input} labelStyle={label} />

        <div style={label}>AMOUNT</div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, fontWeight: 800, color: accent }}>$</span>
          <input
            style={{ ...input, paddingLeft: 32, fontSize: 22, fontWeight: 800, color: accent }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </div>

        {!isSchedule && (
          <>
            <div style={label}>DATE</div>
            <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </>
        )}

        {error && <div style={{ marginTop: 16, color: RED, fontSize: 13, fontWeight: 600 }}>{error}</div>}

        {entry && (
          <>
            <button type="button" onClick={saveEntry} style={mainBtn}>
              SAVE
            </button>
            <button
              type="button"
              onClick={deleteEntry}
              style={{ ...ghostBtn, borderColor: confirmDelete ? RED : BORDER, color: confirmDelete ? RED : "#c9cbd8" }}
            >
              {confirmDelete ? "Are you sure? Tap again to delete" : "Delete"}
            </button>
          </>
        )}

        {isSchedule && (
          <>
            <button type="button" onClick={() => saveOverride(false)} style={mainBtn}>
              SAVE ONLY THIS DATE
            </button>
            <button type="button" onClick={saveScheduleAll} style={ghostBtn}>
              Save for all
            </button>
            <button type="button" onClick={() => saveOverride(true)} style={{ ...ghostBtn, color: RED, borderColor: BORDER }}>
              Skip this date
            </button>
            <button
              type="button"
              onClick={deleteSchedule}
              style={{ ...ghostBtn, borderColor: confirmDelete ? RED : BORDER, color: confirmDelete ? RED : "#c9cbd8" }}
            >
              {confirmDelete ? "Are you sure? Tap again to delete" : "Delete recurring"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={props.onClose}
          style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: SUB, fontSize: 13.5, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
