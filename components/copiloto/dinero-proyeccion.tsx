"use client"

// DINERO · Vista PROYECTADO (estilo Quicken).
// Toda la matemática vive en dinero-forecast.ts (puro y probado); este
// componente solo lee recurrentes / descartes y pinta el resultado.

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, CreditCard, Pencil, Receipt, Repeat, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { money, migrateCategory, EXPENSE_CATEGORIES, type CashFlowEntry, type ScheduledEntry } from "./types"
import { INCOME_CATEGORY } from "./auto-categorize"
import { accountDisplayName, type DueItem, type RegisterAccount } from "./registers-store"
import {
  FREQ_LABEL,
  SCHEDULE_OVERRIDES_KEY,
  addDaysIso,
  buildForecast,
  daysInMonth,
  daysToEndOfMonth,
  r2,
  startingBalance,
  todayKey,
  type ForecastBankTx,
  type ForecastLine,
  type Forecast,
  type ScheduleOverride,
} from "./dinero-forecast"
import { FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT, FORECAST_DISMISSED_KEY } from "./finance-sync"

type Horizon = "mes" | 30 | 60 | 90
const HORIZONS: { value: Horizon; label: string }[] = [
  { value: "mes", label: "End of month" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
]

const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function fechaCorta(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1] || ""}` : "—"
}

function fechaDia(iso: string, today: string): string {
  if (iso === today) return "Today"
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return "—"
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  return `${DIAS[d.getDay()]} ${fechaCorta(iso)}`
}

function readList<T>(key: string): T[] {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(p) ? (p as T[]) : []
  } catch {
    return []
  }
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "\u2212"}${money(Math.abs(n))}`
}

function KindBadge({ line }: { line: ForecastLine }) {
  const base = "inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0.5 text-[9px] font-semibold"
  if (line.kind === "rec")
    return (
      <span className={cn(base, "border-violet-500/30 bg-violet-500/10 text-violet-300")}>
        <Repeat className="size-2.5" /> {line.frequency ? FREQ_LABEL[line.frequency] : "recurring"}
      </span>
    )
  if (line.kind === "card")
    return (
      <span className={cn(base, "border-purple-500/30 bg-purple-500/10 text-purple-300")}>
        <CreditCard className="size-2.5" /> Card
      </span>
    )
  if (line.kind === "overdue")
    return (
      <span className={cn(base, "border-amber-500/30 bg-amber-500/10 text-amber-300")}>
        <AlertTriangle className="size-2.5" /> Overdue {line.originalDate ? fechaCorta(line.originalDate) : ""}
      </span>
    )
  const income = line.amount >= 0
  return (
    <span
      className={cn(
        base,
        income ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
      )}
    >
      {income ? <TrendingUp className="size-2.5" /> : <Receipt className="size-2.5" />} {income ? "Income" : "Bill"}
    </span>
  )
}

/**
 * Recurrentes + descartes de "probablemente pagado", releídos al montar y
 * cuando el sync o otra pestaña los cambian. Compartido por la franja MONEY y
 * la vista Projections para que ambas muestren el mismo número.
 */
export function useForecastInputs(): {
  schedules: ScheduledEntry[]
  overrides: ScheduleOverride[]
  dismissed: string[]
  setDismissed: (next: string[]) => void
} {
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [dismissed, setDismissedState] = useState<string[]>([])
  useEffect(() => {
    const load = () => {
      const sch = readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY)
      // Migración a inglés (2026-10-18): normalizar categorías viejas al leer.
      for (const s of sch) {
        if (s && typeof s.category === "string") s.category = migrateCategory(s.category)
      }
      setSchedules(sch)
      setOverrides(readList<ScheduleOverride>(SCHEDULE_OVERRIDES_KEY))
      setDismissedState(readList<string>(FORECAST_DISMISSED_KEY).filter((x) => typeof x === "string"))
    }
    load()
    window.addEventListener(FINANCE_SYNCED_EVENT, load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener(FINANCE_SYNCED_EVENT, load)
      window.removeEventListener("storage", load)
    }
  }, [])
  const setDismissed = (next: string[]) => {
    setDismissedState(next)
    try {
      localStorage.setItem(FORECAST_DISMISSED_KEY, JSON.stringify(next))
    } catch {}
  }
  return { schedules, overrides, dismissed, setDismissed }
}

// ---------------------------------------------------------------------------
// Recurrentes: alta / edición con alcance (Quicken/YNA B: el futuro en gris,
// nunca toca el balance real).
// ---------------------------------------------------------------------------

type ScopeKind = "once" | "future" | "all"

type RecVals = {
  kind: "income" | "expense"
  description: string
  amount: number
  category: string
  frequency: "weekly" | "biweekly" | "monthly"
  weekday: number // 0=dom..6=sáb
  monthDay: string // 1..31
  start: string // yyyy-mm-dd
  end: string // "" = sin fin
}

function saveSchedules(next: ScheduledEntry[]) {
  try {
    localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify(next))
  } catch {}
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

function saveOverrides(next: ScheduleOverride[]) {
  try {
    localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify(next))
  } catch {}
  try {
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

function newScheduleId(): string {
  return `sch:${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`
}

const pad2 = (n: number) => String(n).padStart(2, "0")

/** Próxima fecha con ese día de semana (0=dom..6=sáb), >= desde. */
function nextWeekday(from: string, weekday: number): string {
  const m = String(from).match(/^(\d{4})-(\d{2})-(\d{2})/)
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date()
  const diff = (weekday - dt.getDay() + 7) % 7
  dt.setDate(dt.getDate() + diff)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

/** Próximo día N del mes >= desde (respeta meses cortos). */
function nextMonthDay(from: string, day: number): string {
  const m = String(from).match(/^(\d{4})-(\d{2})-(\d{2})/)
  let y = m ? Number(m[1]) : new Date().getFullYear()
  let mo = m ? Number(m[2]) : new Date().getMonth() + 1
  const d = m ? Number(m[3]) : new Date().getDate()
  const dd = Math.min(Math.max(1, day), 31)
  if (d <= Math.min(dd, daysInMonth(y, mo))) return `${y}-${pad2(mo)}-${pad2(Math.min(dd, daysInMonth(y, mo)))}`
  mo += 1
  if (mo > 12) {
    mo = 1
    y += 1
  }
  return `${y}-${pad2(mo)}-${pad2(Math.min(dd, daysInMonth(y, mo)))}`
}

/** Hoja de alta/edición de un recurrente, con pregunta de alcance al guardar. */
function RecurrenteSheet(props: {
  schedule: ScheduledEntry | null
  date: string | null
  onClose: () => void
  onCreate: (v: RecVals) => void
  onSave: (s: ScheduledEntry, date: string, v: RecVals, scope: ScopeKind) => void
  onDelete: (s: ScheduledEntry, date: string, scope: ScopeKind) => void
}) {
  const s = props.schedule
  const startM = s?.startDate ? String(s.startDate).match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  const [phase, setPhase] = useState<"form" | "scope-save" | "scope-del">("form")
  const [kind, setKind] = useState<"income" | "expense">(s?.kind ?? "expense")
  const [nombre, setNombre] = useState(s?.description ?? "")
  const [monto, setMonto] = useState(s ? String(Math.abs(Number(s.amount) || 0)) : "")
  const [categoria, setCategoria] = useState(s?.category ?? "Other")
  const [freq, setFreq] = useState<"weekly" | "biweekly" | "monthly">(
    s?.frequency === "biweekly" ? "biweekly" : s?.frequency === "monthly" ? "monthly" : "weekly",
  )
  const [weekday, setWeekday] = useState(
    startM ? new Date(Number(startM[1]), Number(startM[2]) - 1, Number(startM[3]), 12).getDay() : 4,
  )
  const [monthDay, setMonthDay] = useState(startM && s?.frequency === "monthly" ? String(Number(startM[3])) : "")
  const [desde, setDesde] = useState(s ? String(s.startDate).slice(0, 10) : todayKey())
  const [hasta, setHasta] = useState(s?.endDate ? String(s.endDate).slice(0, 10) : "")

  const cats = kind === "income" ? [INCOME_CATEGORY] : [...EXPENSE_CATEGORIES]
  const valido = nombre.trim().length > 0 && Number(monto) > 0

  function vals(): RecVals {
    return {
      kind,
      description: nombre.trim(),
      amount: r2(Math.abs(Number(monto) || 0)),
      category: categoria,
      frequency: freq,
      weekday,
      monthDay: monthDay.trim(),
      start: desde,
      end: hasta,
    }
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 text-[11px] font-bold",
      active ? "border-amber-400/70 bg-amber-400/10 text-amber-300" : "border-neutral-700 text-neutral-400",
    )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={props.onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-neutral-700 bg-neutral-950 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "form" ? (
          <>
            <p className="mb-3 text-[10px] font-bold tracking-wide text-neutral-500">
              {s ? "EDIT RECURRING" : "NEW RECURRING"}
            </p>

            <div className="mb-3 flex gap-2">
              {(
                [
                  { id: "expense", label: "EXPENSE" },
                  { id: "income", label: "INCOME" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setKind(o.id)
                    setCategoria(o.id === "income" ? INCOME_CATEGORY : "Other")
                  }}
                  className={cn(
                    "flex-1 rounded-2xl border py-2.5 text-xs font-extrabold",
                    kind === o.id
                      ? o.id === "income"
                        ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-300"
                        : "border-rose-400/70 bg-rose-400/10 text-rose-300"
                      : "border-neutral-700 text-neutral-500",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mb-1 text-[10px] font-bold text-neutral-500">NAME</p>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: CD Aventure LLC"
              className="mb-3 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600"
            />

            <p className="mb-1 text-[10px] font-bold text-neutral-500">AMOUNT</p>
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              className="mb-3 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono text-sm text-white placeholder:text-neutral-600"
            />

            <p className="mb-1.5 text-[10px] font-bold text-neutral-500">CATEGORY</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button key={c} type="button" onClick={() => setCategoria(c)} className={chip(categoria === c)}>
                  {c}
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-[10px] font-bold text-neutral-500">FRECUENCIA</p>
            <div className="mb-3 flex gap-1.5">
              {(
                [
                  { id: "weekly", label: "Semanal" },
                  { id: "biweekly", label: "Quincenal" },
                  { id: "monthly", label: "Mensual" },
                ] as const
              ).map((o) => (
                <button key={o.id} type="button" onClick={() => setFreq(o.id)} className={cn(chip(freq === o.id), "flex-1")}>
                  {o.label}
                </button>
              ))}
            </div>

            {freq === "monthly" ? (
              <>
                <p className="mb-1 text-[10px] font-bold text-neutral-500">DAY OF MONTH</p>
                <input
                  value={monthDay}
                  onChange={(e) => setMonthDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  type="number"
                  inputMode="numeric"
                  placeholder="Ej: 19"
                  className="mb-3 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 font-mono text-sm text-white placeholder:text-neutral-600"
                />
              </>
            ) : (
              <>
                <p className="mb-1.5 text-[10px] font-bold text-neutral-500">DAY OF WEEK</p>
                <div className="mb-3 flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWeekday(d)}
                      className={cn(chip(weekday === d), "flex-1 px-0")}
                    >
                      {DIAS[d]}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mb-4 flex gap-2">
              <div className="flex-1">
                <p className="mb-1 text-[10px] font-bold text-neutral-500">FROM</p>
                <input
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  type="date"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-[10px] font-bold text-neutral-500">UNTIL (OPCIONAL)</p>
                <input
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  type="date"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              {s && (
                <button
                  type="button"
                  onClick={() => setPhase("scope-del")}
                  className="rounded-2xl border border-rose-500/50 px-4 py-3 text-sm font-extrabold text-rose-300"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                disabled={!valido}
                onClick={() => {
                  if (!s) {
                    props.onCreate(vals())
                    props.onClose()
                  } else {
                    setPhase("scope-save")
                  }
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold",
                  valido ? "bg-amber-400 text-black" : "bg-neutral-800 text-neutral-600",
                )}
              >
                <Check className="size-4" /> Save
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-1 text-[10px] font-bold tracking-wide text-neutral-500">
              {phase === "scope-save" ? "SAVE CHANGE" : "DELETE RECURRING"}
            </p>
            <p className="mb-3 truncate text-sm font-bold text-white">{nombre.trim() || s?.description}</p>
            <p className="mb-3 text-xs text-neutral-400">Scope?</p>
            <div className="mb-2 flex flex-col gap-2">
              {(
                [
                  { id: "once", label: "Just this time" },
                  { id: "future", label: "This and future" },
                  { id: "all", label: "All" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    if (!s || !props.date) return
                    if (phase === "scope-save") props.onSave(s, props.date, vals(), o.id)
                    else props.onDelete(s, props.date, o.id)
                    props.onClose()
                  }}
                  className="rounded-2xl border border-neutral-700 py-3 text-sm font-extrabold text-neutral-200 active:bg-neutral-800"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPhase("form")}
              className="w-full py-2 text-center text-xs font-bold text-neutral-500"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function DineroProyeccion(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  entries: CashFlowEntry[]
  bankTxs: ForecastBankTx[]
  bankOk: boolean
  /** Ids de cuentas marcadas como "otros fondos" (suman al balance inicial). */
  otherFunds: string[]
  onEditEntry?: (e: CashFlowEntry) => void
  /** Edición inline desde el registro proyectado: monto / fecha / descripción. */
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  /** Día vacío en el registro → alta de asiento con esa fecha preseleccionada. */
  onAddEntry?: (dateIso: string) => void
  /** Confirmar "ya pagado": pasa el movimiento del libro a real (fecha del banco). */
  onMarkPaid?: (e: CashFlowEntry, paidDate: string) => void
}) {
  // 90 days FIJOS: todo el register de proyecciones se recorre con scroll
  // dentro de su caja (se eliminaron el título 🔮 y el selector de horizonte).
  const [horizon] = useState<Horizon>(90)
  const [verDias, setVerDias] = useState(false)
  // Recurrentes y descartes: se releen al montar y cuando el sync trae cambios.
  const { schedules, overrides, dismissed, setDismissed } = useForecastInputs()
  const [sheet, setSheet] = useState<
    { mode: "create" } | { mode: "edit"; schedule: ScheduledEntry; date: string } | null
  >(null)

  // Fijos de Miguel: se crean solos una vez (si no existen ya).
  useEffect(() => {
    try {
      const cur = readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY)
      const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      const next = [...cur]
      let changed = false
      if (!next.some((s) => norm(s.description).includes("cdaventure"))) {
        const d0 = nextWeekday(todayKey(), 4) // jueves
        next.push({
          id: newScheduleId(),
          kind: "expense",
          description: "CD Aventure LLC",
          category: "Car leasing",
          amount: 924,
          startDate: d0,
          frequency: "weekly",
          nextDate: d0,
          active: true,
        })
        changed = true
      }
      if (!next.some((s) => norm(s.description).includes("frantzpierre"))) {
        const d0 = nextMonthDay(todayKey(), 19)
        next.push({
          id: newScheduleId(),
          kind: "expense",
          description: "Frantz Pierre",
          category: "Rent",
          amount: 1500,
          startDate: d0,
          frequency: "monthly",
          nextDate: d0,
          active: true,
        })
        changed = true
      }
      if (changed) saveSchedules(next)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCreate(v: RecVals) {
    const base = /^\d{4}-\d{2}-\d{2}/.test(v.start) ? v.start.slice(0, 10) : todayKey()
    const start =
      v.frequency === "monthly" ? nextMonthDay(base, Number(v.monthDay) || 1) : nextWeekday(base, v.weekday)
    const sched: ScheduledEntry = {
      id: newScheduleId(),
      kind: v.kind,
      description: v.description,
      category: v.category,
      amount: v.amount,
      startDate: start,
      endDate: /^\d{4}-\d{2}-\d{2}/.test(v.end) ? v.end.slice(0, 10) : undefined,
      frequency: v.frequency,
      nextDate: start,
      active: true,
    }
    saveSchedules([...readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY), sched])
  }

  function handleSave(s: ScheduledEntry, date: string, v: RecVals, scope: ScopeKind) {
    const cur = readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY)
    if (scope === "all") {
      saveSchedules(
        cur.map((x) =>
          x.id === s.id
            ? {
                ...x,
                kind: v.kind,
                description: v.description,
                category: v.category,
                amount: v.amount,
                frequency: v.frequency,
                endDate: /^\d{4}-\d{2}-\d{2}/.test(v.end) ? v.end.slice(0, 10) : undefined,
              }
            : x,
        ),
      )
      return
    }
    if (scope === "future") {
      const nid = newScheduleId()
      const origEnd = /^\d{4}-\d{2}-\d{2}/.test(String(s.endDate || "")) ? String(s.endDate).slice(0, 10) : undefined
      const next: ScheduledEntry[] = cur.map((x) =>
        x.id === s.id ? { ...x, endDate: addDaysIso(date, -1) } : x,
      )
      next.push({
        ...s,
        id: nid,
        kind: v.kind,
        description: v.description,
        category: v.category,
        amount: v.amount,
        frequency: v.frequency,
        startDate: date,
        nextDate: date,
        endDate: origEnd,
        active: true,
      })
      saveSchedules(next)
      return
    }
    // Just this time: excepción puntual.
    const ovs = readList<ScheduleOverride>(SCHEDULE_OVERRIDES_KEY).filter(
      (o) => !(o.scheduleId === s.id && o.date === date),
    )
    ovs.push({ scheduleId: s.id, date, amount: v.amount, label: v.description })
    saveOverrides(ovs)
  }

  function handleDelete(s: ScheduledEntry, date: string, scope: ScopeKind) {
    const cur = readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY)
    if (scope === "all") {
      saveSchedules(cur.filter((x) => x.id !== s.id))
      return
    }
    if (scope === "future") {
      saveSchedules(cur.map((x) => (x.id === s.id ? { ...x, endDate: addDaysIso(date, -1) } : x)))
      return
    }
    const ovs = readList<ScheduleOverride>(SCHEDULE_OVERRIDES_KEY).filter(
      (o) => !(o.scheduleId === s.id && o.date === date),
    )
    ovs.push({ scheduleId: s.id, date, skip: true })
    saveOverrides(ovs)
  }

  const today = todayKey()
  const horizonDays = horizon === "mes" ? daysToEndOfMonth(today) : horizon

  const inicio = useMemo(
    () => startingBalance(props.registers, props.balances, props.otherFunds),
    [props.registers, props.balances, props.otherFunds],
  )

  const fc = useMemo(
    () =>
      buildForecast({
        startBalance: inicio.value,
        entries: props.entries,
        schedules,
        dues: props.dues,
        balances: props.balances,
        // Sin banco no hay auto-match (nunca se da por pagado algo sin evidencia).
        bankTxs: props.bankOk ? props.bankTxs : [],
        today,
        horizonDays,
        dismissedPaid: dismissed,
        overrides,
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, horizonDays, dismissed, overrides],
  )

  const descartar = (key: string) => {
    setDismissed(dismissed.includes(key) ? dismissed : [...dismissed, key])
  }

  const mainName = inicio.mainId
    ? accountDisplayName(props.registers.find((r) => r.id === inicio.mainId)?.name || "").title
    : null
  return (
    <>
      {/* Registro de proyecciones a 90 días — sin título ni selector de
          horizonte: el register completo se navega con scroll en su caja. */}


      {/* Fórmula: inicial + ingresos − gastos = proyectado */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3">
        <div className="space-y-1 text-[12px]">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-neutral-300">
              Starting balance
              <span className="block text-[10px] text-neutral-500">
                {inicio.usedFallback
                  ? "No ★ account balance — sum of banks"
                  : `${mainName || "Account ★"}${inicio.extras.length ? ` + ${inicio.extras.length} ${inicio.extras.length === 1 ? "fondo" : "fondos"}` : ""}`}
              </span>
            </span>
            <span className={cn("font-mono font-bold tabular-nums", fc.start < 0 ? "text-rose-400" : "text-white")}>
              {money(fc.start)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-300">+ Income ({fc.incomeCount})</span>
            <span className="font-mono font-bold tabular-nums text-emerald-400">{money(fc.incomeTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-300">− Expenses ({fc.expenseCount})</span>
            <span className="font-mono font-bold tabular-nums text-rose-400">{money(fc.expenseTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-cyan-500/20 pt-1.5">
            <span className="font-bold text-cyan-300">= Projected balance ({fc.days.length} days)</span>
            <span className={cn("font-mono text-lg font-black tabular-nums", fc.end < 0 ? "text-rose-400" : "text-cyan-300")}>
              {money(fc.end)}
            </span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="rounded-lg border border-neutral-800 bg-black/40 px-2 py-1">
            <span className="block text-neutral-500">Lowest point</span>
            <span className={cn("font-mono font-bold", fc.lowest.balance < 0 ? "text-rose-400" : "text-neutral-200")}>
              {money(fc.lowest.balance)}
            </span>{" "}
            <span className="text-neutral-500">· {fechaDia(fc.lowest.date, today)}</span>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-black/40 px-2 py-1">
            <span className="block text-neutral-500">Includes</span>
            <span className="text-neutral-300">
              {fc.recurringCount} {fc.recurringCount === 1 ? "recurring" : "recurring"}
              {fc.cardCount > 0 && (
                <> · {fc.cardCount} {fc.cardCount === 1 ? "card" : "cards"}</>
              )}
            </span>
          </div>
        </div>
        {fc.lowest.balance < 0 && (
          <p className="mt-2 flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300">
            <AlertTriangle className="size-3.5 shrink-0" /> Balance goes negative on {fechaDia(fc.lowest.date, today)}.
          </p>
        )}
        {!props.bankOk && (
          <p className="mt-2 text-[10px] text-amber-300/90">
            Bank not synced: payments already made aren't detected. Hit SYNC.
          </p>
        )}
      </div>


      {/* Ya salieron del banco: no se restan dos veces. El usuario confirma o descarta. */}
      {fc.probablePaid.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
            Probablemente pagado · {fc.probablePaid.length}
          </p>
          <p className="mb-2 text-[10px] text-neutral-400">Found at the bank: no longer subtracted. Confirm or dismiss.</p>
          <div className="space-y-1.5">
            {fc.probablePaid.map((p) => (
              <div key={p.key} className="rounded-lg border border-neutral-800 bg-black/40 px-2 py-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-neutral-200">{p.entry.description || "Movimiento"}</span>
                  <span className="shrink-0 font-mono font-bold text-neutral-300">{money(Math.abs(Number(p.entry.amount) || 0))}</span>
                </div>
                <p className="truncate text-[10px] text-neutral-500">
                  Bank {fechaCorta(p.tx.date)} · {p.tx.detail} · {money(Math.abs(p.tx.amount))}
                </p>
                <div className="mt-1 flex gap-1.5">
                  {props.onMarkPaid && (
                    <button
                      type="button"
                      onClick={() => props.onMarkPaid?.(p.entry, String(p.tx.date).slice(0, 10))}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200"
                    >
                      <Check className="size-3" /> Yes, paid
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => descartar(p.key)}
                    className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
                  >
                    <X className="size-3" /> Not this one
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingresos con fecha pasada que no llegaron: fuera del total. */}
      {fc.overdueIncome.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">
            Overdue income · {money(fc.overdueIncomeTotal)}
          </p>
          <p className="mb-1.5 text-[10px] text-neutral-400">They didn't arrive and don't count in the projection.</p>
          <div className="space-y-1">
            {fc.overdueIncome.map((ln) => (
              <button
                key={ln.id}
                type="button"
                onClick={() => ln.entry && props.onEditEntry?.(ln.entry)}
                className="flex w-full items-center justify-between gap-2 text-left text-[12px]"
              >
                <span className="min-w-0 truncate text-neutral-300">
                  {ln.label} <span className="text-[10px] text-neutral-500">· {fechaCorta(ln.originalDate || ln.date)}</span>
                </span>
                <span className="shrink-0 font-mono text-amber-300">{money(Math.abs(ln.amount))}</span>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Projected register — columnas estilo Register, un día por fila, scroll hasta 90 days. */}
      <ProjectionRegister
        fc={fc}
        today={today}
        onEditEntry={props.onEditEntry}
        onPatchEntry={props.onPatchEntry}
        onAddEntry={props.onAddEntry}
        verDias={verDias}
        setVerDias={setVerDias}
        schedules={schedules}
        onNewRecurrente={() => setSheet({ mode: "create" })}
        onOpenRecurrente={(schedule, date) => setSheet({ mode: "edit", schedule, date })}
      />

      {sheet && (
        <RecurrenteSheet
          schedule={sheet.mode === "edit" ? sheet.schedule : null}
          date={sheet.mode === "edit" ? sheet.date : null}
          onClose={() => setSheet(null)}
          onCreate={handleCreate}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}

function LineRow(props: { line: ForecastLine; today: string; showDate: boolean; onEdit?: (e: CashFlowEntry) => void }) {
  const { line: ln } = props
  const editable = !!ln.entry && !!props.onEdit
  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => ln.entry && props.onEdit?.(ln.entry)}
      className="flex w-full items-center justify-between gap-2 py-0.5 text-left text-[12px] disabled:cursor-default"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold text-neutral-200">{ln.label}</span>
        <span className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-500">
          {props.showDate && <span>{fechaDia(ln.date, props.today)}</span>}
          <KindBadge line={ln} />
        </span>
      </span>
      <span className={cn("shrink-0 font-mono font-bold tabular-nums", ln.amount >= 0 ? "text-emerald-400" : "text-rose-400")}>
        {signed(ln.amount)}
      </span>
    </button>
  )
}


// ---------------------------------------------------------------------------
// Registro proyectado — FECHA · DESCRIPCIÓN · MONTO · SALDO ACUM. · BAL. PROYECTADO
// Una fila por día consecutivo (hoy → horizonte, hasta 90/91 filas) dentro de una
// caja con scroll. Saldo acumulado = asientos del libro; saldo proyectado = todo el
// horizonte (recurrentes, tarjetas, vencidos). La diferencia muestra dónde el dinero
// se pone débil; el saldo proyectado en rojo marca el quiebre.
// ---------------------------------------------------------------------------

type ProjRow = { line: ForecastLine | null; amount: number; balAcum: number; balProy: number }

function ProjectionRegister(props: {
  fc: Forecast
  today: string
  onEditEntry?: (e: CashFlowEntry) => void
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  onAddEntry?: (dateIso: string) => void
  verDias: boolean
  setVerDias: (v: boolean) => void
  schedules: ScheduledEntry[]
  onOpenRecurrente: (schedule: ScheduledEntry, date: string) => void
  onNewRecurrente: () => void
}) {
  const { fc, today, verDias } = props

  const rows = useMemo(() => {
    let acum = r2(fc.start)
    let proy = r2(fc.start)
    const out: ProjRow[] = []
    for (const d of fc.days) {
      for (const ln of d.lines) {
        proy = r2(proy + ln.amount)
        if (ln.kind === "proj" || ln.kind === "overdue") acum = r2(acum + ln.amount)
        out.push({ line: ln, amount: ln.amount, balAcum: acum, balProy: proy })
      }
      if (d.lines.length === 0) out.push({ line: null, amount: 0, balAcum: acum, balProy: proy })
    }
    return out
  }, [fc])

  const totalDias = fc.days.length
  const negDays = useMemo(() => fc.days.filter((d) => d.balance < 0).length, [fc])
  // Registro por FECHA | DESCRIPCIÓN | MONTO | SALDO ACUM. | BAL. PROYECTADO
  const cols = "grid grid-cols-[4.5rem_minmax(0,1fr)_4.75rem_5rem_5rem] gap-1"

  function descripcionDe(ln: ForecastLine): string {
    const d = String((ln.entry && (ln.entry.description || (ln.entry as any).detail)) || ln.label || "—")
    return d.slice(0, 28)
  }


  // Vista lista (la de siempre) como alternativa al registro.
  if (verDias) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            Movimientos · {fc.lines.length}
          </p>
          <button
            type="button"
            onClick={() => props.setVerDias(false)}
            className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
          >
            Register
          </button>
        </div>

        {fc.lines.length === 0 ? (
          <p className="text-[11px] text-neutral-500">No projected movements in this period.</p>
        ) : (
          <div className="space-y-1">
            {fc.lines.map((ln) => (
              <LineRow key={ln.id} line={ln} today={today} showDate onEdit={props.onEditEntry} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Register por defecto: days consecutivos con scroll.
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          Projected register · {totalDias} days
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => props.onNewRecurrente()}
            className="rounded-md border border-amber-400/50 px-2 py-0.5 text-[10px] font-bold text-amber-300"
          >
            + Recurrente
          </button>
          <button
            type="button"
            onClick={() => props.setVerDias(true)}
            className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
          >
            List
          </button>
        </div>
      </div>


      <div className={cn(cols, "border-b border-neutral-800 pb-1 text-[9px] font-black uppercase tracking-wide")}>
        <span className="text-neutral-400">Date</span>
        <span className="text-neutral-400">Description</span>
        <span className="text-right text-neutral-400">Amount</span>
        <span className="text-right text-neutral-400">Running bal.</span>
        <span className="text-right text-cyan-300">Bal. proyectado</span>
      </div>

      <div className="max-h-[min(58vh,480px)] min-h-[220px] overflow-y-auto overscroll-contain">
        {rows.length === 0 && (
          <p className="px-2 py-8 text-center text-[12px] text-neutral-500">No days in the horizon.</p>
        )}
        {rows.map((r, i) => {
          const ln = r.line
          const fecha = ln ? ln.date : fc.days[i]?.date || today
          const editable = !!ln?.entry && !!props.onEditEntry && !!props.onPatchEntry
          const rojo = r.balProy < 0
          const primeroDelDia = i === 0 || rows[i - 1].line?.date !== fecha
          const recSched =
            ln && ln.kind === "rec" && ln.scheduleId
              ? props.schedules.find((x) => x.id === ln.scheduleId) ?? null
              : null

          const cells = (
            <>
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold",
                  fecha === today ? "text-cyan-300" : "text-neutral-400",
                )}
              >
                {fecha === today ? "Today" : primeroDelDia ? fechaDia(fecha, today) : ""}
              </span>
              {/* Descripción + badge apilados: el badge nunca invade la columna del monto. */}
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span
                  className={cn(
                    "w-full truncate text-[12px] font-semibold",
                    ln ? (rojo ? "text-rose-200" : ln.kind === "rec" ? "text-neutral-400" : "text-neutral-100") : "text-neutral-600",
                  )}
                >
                  {ln ? descripcionDe(ln) : "no activity"}
                </span>
                {ln && <KindBadge line={ln} />}
              </span>
              {ln ? (
                editable ? (
                  <AmountCell line={ln} entry={ln.entry!} patch={props.onPatchEntry!} />
                ) : (
                  <span
                    className={cn(
                      "text-right font-mono text-[12px] font-bold tabular-nums",
                      ln.amount >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {signed(ln.amount)}
                  </span>
                )
              ) : (
                <span className="text-right text-neutral-700">—</span>
              )}
              <span
                className={cn(
                  "text-right font-mono text-[12px] font-bold tabular-nums",
                  r.balAcum < 0 ? "text-rose-400" : "text-neutral-200",
                )}
              >
                {money(r.balAcum)}
              </span>
              <span
                className={cn(
                  "text-right font-mono text-[12px] font-bold tabular-nums",
                  rojo ? "bg-rose-500/10 text-rose-400" : "text-cyan-200",
                )}
              >
                {money(r.balProy)}
              </span>
            </>
          )

          // Day con asiento → clic abre el editor completo. Recurrente → editor con alcance. Day vacío → alta con esa fecha.
          // El botón ES el grid (no flex): si no, las 5 columnas se enciman.
          if (ln) {
            return (
              <div key={ln.id} className={cn("border-b border-neutral-900/80 py-1.5", rojo && "bg-rose-500/5")}>
                {props.onEditEntry && ln.entry ? (
                  <button
                    type="button"
                    onClick={() => props.onEditEntry?.(ln.entry!)}
                    className={cn(cols, "w-full items-center text-left active:bg-neutral-900/60")}
                  >
                    {cells}
                  </button>
                ) : recSched ? (
                  <button
                    type="button"
                    onClick={() => props.onOpenRecurrente(recSched, ln.date)}
                    className={cn(cols, "w-full items-center text-left active:bg-neutral-900/60")}
                  >
                    {cells}
                  </button>
                ) : (
                  <div className={cn(cols, "items-center")}>{cells}</div>
                )}
              </div>
            )
          }
          return (
            <button
              key={`d:${fecha}`}
              type="button"
              onClick={() => props.onAddEntry?.(fecha)}
              className={cn(
                cols,
                "w-full items-center border-b border-neutral-900/80 py-1.5 text-left active:bg-neutral-900/60",
              )}
            >
              {cells}
            </button>
          )
        })}
      </div>

      <p className="mt-1.5 flex items-center justify-between gap-2 border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
        <span>
          {totalDias} consecutive days ·{" "}
          {negDays > 0 ? <span className="font-bold text-rose-400">{negDays} in red</span> : "no dips"}
        </span>
      </p>
    </div>
  )
}

/** Amount editable inline en el registro: Enter/blur guarda el cambio en el libro. */
function AmountCell(props: {
  line: ForecastLine
  entry: CashFlowEntry
  patch: (id: string, p: Partial<CashFlowEntry>) => void
}) {
  const { entry } = props
  const income = entry.type === "income"
  const signo = income ? 1 : -1
  const guardar = (raw: string) => {
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return
    const norm = r2(Math.abs(n) * signo)
    if (norm === r2(Number(entry.amount) || 0)) return
    props.patch(entry.id, { amount: norm, isManuallyEdited: true })
  }
  return (
    <span className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <span className={cn("font-mono text-[11px] font-bold", income ? "text-emerald-500" : "text-rose-500")}>
        {income ? "+" : "\u2212"}
      </span>
      <input
        key={`${entry.id}:${entry.amount}`}
        type="number"
        step="0.01"
        inputMode="decimal"
        defaultValue={String(Math.abs(Number(entry.amount) || 0) || "")}
        onBlur={(e) => guardar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Amount of ${entry.description || props.line.label}`}
        className={cn(
          "w-[3.5rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-[12px] font-bold tabular-nums outline-none",
          "focus:border-neutral-600 focus:bg-neutral-900",
          income ? "text-emerald-400" : "text-rose-400",
        )}
      />
    </span>
  )
}

/** Nota al pie: lo que el motor dejó fuera del horizonte. */
function FootNotes({ fc }: { fc: Forecast }) {
  if (fc.duplicatesSkipped <= 0 && fc.recurringPaidSkipped <= 0 && fc.beyondHorizonCount <= 0) return null
  return (
    <p className="mt-2 border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
      {[
        fc.duplicatesSkipped ? `${fc.duplicatesSkipped} recurring(s) ya en el libro` : "",
        fc.recurringPaidSkipped ? `${fc.recurringPaidSkipped} already paid at the bank` : "",
        fc.beyondHorizonCount ? `${fc.beyondHorizonCount} después del ${fechaCorta(fc.endDate)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  )
}

