// Pantalla FINANCE ("Balance Diario"): dinero real del banco vs estimado,
// en vivo. Recalcula todo desde viajes + gastos + plan en cada render.
// Real money and estimates never share a cell.

"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EXPENSE_CATEGORIES, money, type Expense, type Trip } from "./types"
import {
  BANK_KEY,
  GOAL_KEY,
  PLAN_KEY,
  buildLedger,
  computeLiveMetrics,
  loadBankBalance,
  loadDayGoal,
  loadPlanItems,
  newPlanItemId,
  prettyDate,
  saveBankBalance,
  saveDayGoal,
  savePlanItems,
  todayKey,
  tripDateKey,
  WEEKDAYS_ES,
  type LedgerRow,
  type LedgerStatus,
  type PlanItem,
  type Recurrence,
} from "./finance"

// Re-export para que el padre pueda incluir estas claves en el export/import.
export { BANK_KEY, GOAL_KEY, PLAN_KEY }

type SubTab = "REGISTER" | "PLAN"

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`
}

function StatusChip({ status }: { status: LedgerStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
        status === "confirmed" && "border-green-400/60 text-green-400",
        status === "pending" && "border-orange-400/60 text-orange-400",
        status === "estimated" && "border-sky-400/60 text-sky-400",
      )}
    >
      {status === "confirmed" ? "Confirmed" : status === "pending" ? "Pending" : "Estimated"}
    </span>
  )
}

function HeroCard({
  label,
  value,
  valueClass,
  sub,
  subClass,
}: {
  label: string
  value: string
  valueClass: string
  sub?: string
  subClass?: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-2 py-3">
      <span className="text-center text-[10px] font-bold tracking-wide text-neutral-500">{label}</span>
      <span className={cn("text-lg font-extrabold tabular-nums", valueClass)}>{value}</span>
      {sub ? <span className={cn("text-[10px] font-semibold", subClass ?? "text-neutral-500")}>{sub}</span> : null}
    </div>
  )
}

function MiniStat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border border-neutral-800/80 bg-neutral-950 px-1 py-2">
      <span className="text-[9px] font-bold tracking-wide text-neutral-500">{label}</span>
      <span className={cn("text-sm font-extrabold tabular-nums", valueClass)}>{value}</span>
    </div>
  )
}

// Tarjeta densa por renglón del registro (legible en el teléfono).
function LedgerCard({ row }: { row: LedgerRow }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-neutral-300">
              {prettyDate(row.date)}
            </span>
            <span className="truncate text-[13px] font-bold text-white">{row.source}</span>
          </div>
          <span className="truncate text-[11px] text-neutral-500">{row.description}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.bank != null ? (
            <span className={cn("text-base font-extrabold tabular-nums", row.bank >= 0 ? "text-green-400" : "text-rose-400")}>
              {fmt(row.bank)}
            </span>
          ) : row.estIn != null ? (
            <span className="flex items-center gap-1 text-base font-extrabold tabular-nums text-sky-300">
              <ArrowUpRight className="size-3.5" />
              {fmt(row.estIn)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-base font-extrabold tabular-nums text-rose-300">
              <ArrowDownRight className="size-3.5" />
              {fmt(row.estOut != null ? -row.estOut : null)}
            </span>
          )}
          <StatusChip status={row.status} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-800/70 pt-2 text-[11px] tabular-nums">
        <span className="text-neutral-500">
          Real <span className="font-bold text-neutral-300">{fmt(row.realBalance)}</span>
        </span>
        <span className="text-neutral-500">
          Proy. <span className="font-bold text-yellow-300">{fmt(row.projectedBalance)}</span>
        </span>
      </div>
    </div>
  )
}

// Formulario de un renglón del PLAN (gasto fijo o entrada esperada).
const INPUT_CLS =
  "w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-yellow-400/60 focus:outline-none"

function PlanForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: PlanItem
  onSave: (p: PlanItem) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? "")
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
  const [direction, setDirection] = useState<"in" | "out">(initial?.direction ?? "out")
  const [cadence, setCadence] = useState<Recurrence>(initial?.cadence ?? "weekly")
  const [anchor, setAnchor] = useState(initial?.anchor ?? new Date().getDay())

  function save() {
    const value = Math.abs(Number(amount) || 0)
    if (!label.trim() || value <= 0) return
    onSave({
      id: initial?.id ?? newPlanItemId(),
      label: label.trim(),
      category,
      amount: value,
      direction,
      cadence,
      anchor: cadence === "weekly" ? anchor : cadence === "monthly" ? Math.min(Math.max(1, anchor), 28) : 0,
    })
  }

  return (
    <div className="space-y-2 rounded-2xl border border-yellow-400/30 bg-neutral-900/60 p-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDirection("in")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold",
            direction === "in" ? "border-green-400/60 text-green-400" : "border-neutral-800 text-neutral-500",
          )}
        >
          <ArrowUpRight className="size-3.5" /> Entrada
        </button>
        <button
          type="button"
          onClick={() => setDirection("out")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold",
            direction === "out" ? "border-rose-400/60 text-rose-400" : "border-neutral-800 text-neutral-500",
          )}
        >
          <ArrowDownRight className="size-3.5" /> Salida
        </button>
      </div>
      <input
        className={INPUT_CLS}
        placeholder="Nombre (ej. Renta, Uber semanal)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className={INPUT_CLS}
          inputMode="decimal"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        <select className={INPUT_CLS} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="Income">Income</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        {(["daily", "weekly", "monthly"] as Recurrence[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCadence(c)
              if (c === "weekly") setAnchor(new Date().getDay())
              if (c === "monthly") setAnchor(1)
            }}
            className={cn(
              "flex-1 rounded-xl border px-2 py-2 text-xs font-bold capitalize",
              cadence === c ? "border-yellow-400/60 text-yellow-300" : "border-neutral-800 text-neutral-500",
            )}
          >
            {c === "daily" ? "Diario" : c === "weekly" ? "Semanal" : "Mensual"}
          </button>
        ))}
      </div>
      {cadence === "weekly" ? (
        <div className="flex gap-1">
          {WEEKDAYS_ES.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setAnchor(i)}
              className={cn(
                "flex-1 rounded-lg border py-1.5 text-[11px] font-bold",
                anchor === i ? "border-yellow-400/60 text-yellow-300" : "border-neutral-800 text-neutral-500",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}
      {cadence === "monthly" ? (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>Día del mes</span>
          <input
            className={INPUT_CLS}
            inputMode="numeric"
            value={String(anchor)}
            onChange={(e) =>
              setAnchor(Math.min(28, Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))
            }
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!label.trim() || !(Number(amount) > 0)}
          className="flex-1 rounded-xl bg-yellow-400 py-2 text-sm font-extrabold text-black disabled:opacity-30"
        >
          {initial ? "Guardar" : "Añadir al plan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-bold text-neutral-300"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

// __NEXT__

const QUICK_PLAN: {
  label: string
  category: string
  direction: "in" | "out"
  cadence: Recurrence
  anchor: number
  amount: number
}[] = [
  { label: "Uber · ganancia esperada", category: "Income", direction: "in", cadence: "daily", anchor: 0, amount: 120 },
  { label: "Shell · gasolina semanal", category: "Gasolina / Combustible", direction: "out", cadence: "weekly", anchor: 5, amount: 40 },
  { label: "Geico · seguro auto", category: "Seguros / Permisos", direction: "out", cadence: "monthly", anchor: 19, amount: 150 },
  { label: "Renta apartamento", category: "Varios", direction: "out", cadence: "monthly", anchor: 1, amount: 2400 },
]

// __NEXT2__


export function FinanceScreen({ trips, expenses }: { trips: Trip[]; expenses: Expense[] }) {
  const [now, setNow] = useState(() => new Date())
  const [sub, setSub] = useState<SubTab>("REGISTER")
  const [filter, setFilter] = useState<"ALL" | LedgerStatus>("ALL")
  const [bank, setBank] = useState(0)
  const [bankDraft, setBankDraft] = useState("")
  const [editingBank, setEditingBank] = useState(false)
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [goal, setGoal] = useState(0)
  const [goalDraft, setGoalDraft] = useState("")
  const [editingGoal, setEditingGoal] = useState(false)
  const [horizon, setHorizon] = useState(21)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setBank(loadBankBalance())
    setPlan(loadPlanItems())
    const g = loadDayGoal()
    setGoal(g)
    setGoalDraft(g > 0 ? String(g) : "")
  }, [])

  const today = todayKey(now)

  const ledger = useMemo(
    () => buildLedger({ trips, expenses, plan, bankBalance: bank, horizonDays: horizon, today }),
    [trips, expenses, plan, bank, horizon, today],
  )
  const live = useMemo(() => computeLiveMetrics(trips, expenses, today), [trips, expenses, today])

  const visible = useMemo(() => {
    const list = filter === "ALL" ? ledger.rows : ledger.rows.filter((r) => r.status === filter)
    return [...list].reverse()
  }, [ledger, filter])

  function persistPlan(next: PlanItem[]) {
    setPlan(next)
    savePlanItems(next)
  }

  function commitBank() {
    const v = Number(bankDraft.replace(/[^0-9.]/g, ""))
    if (Number.isFinite(v) && v >= 0) {
      setBank(v)
      saveBankBalance(v)
    }
    setEditingBank(false)
  }

  function commitGoal() {
    const v = Number(goalDraft.replace(/[^0-9.]/g, ""))
    const clean = Number.isFinite(v) && v > 0 ? v : 0
    setGoal(clean)
    saveDayGoal(clean)
    setGoalDraft(clean > 0 ? String(clean) : "")
    setEditingGoal(false)
  }

  const goalPct = goal > 0 ? Math.min(100, (live.grossToday / goal) * 100) : 0
  const clock = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const updated = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-sm font-bold tracking-widest text-neutral-400">FINANCE</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-green-400/40 px-2.5 py-1 text-[10px] font-extrabold text-green-400">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-400" />
          </span>
          LIVE {clock}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className="-mt-1 text-[11px] text-neutral-500">
          Balance Diario · dinero real y estimado, separados. Actualizado {updated}.
        </p>

        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <HeroCard
              label="BANK BALANCE NOW"
              value={money(bank)}
              valueClass="text-white"
              sub={`${ledger.rows.filter((r) => r.status === "confirmed").length} movs. confirmados`}
            />
            <button
              type="button"
              onClick={() => {
                setBankDraft(bank > 0 ? String(bank) : "")
                setEditingBank((v) => !v)
              }}
              className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-neutral-800 py-1.5 text-[10px] font-bold text-neutral-400"
            >
              <Pencil className="size-3" /> {bank > 0 ? "Ajustar saldo" : "Poner mi saldo"}
            </button>
            {editingBank ? (
              <div className="mt-1 flex gap-1">
                <input
                  autoFocus
                  className={INPUT_CLS}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={bankDraft}
                  onChange={(e) => setBankDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitBank()}
                />
                <button
                  type="button"
                  onClick={commitBank}
                  className="shrink-0 rounded-xl bg-yellow-400 px-3 text-xs font-extrabold text-black"
                >
                  OK
                </button>
              </div>
            ) : null}
          </div>
          <HeroCard
            label="PENDING, NOT CLEARED"
            value={money(ledger.pendingNet)}
            valueClass={ledger.pendingNet >= 0 ? "text-orange-300" : "text-rose-400"}
            sub="ganado, no cobrado"
          />
          <HeroCard
            label={`PROJECTED · ${prettyDate(ledger.projectedThrough)}`}
            value={money(ledger.projectedEnd)}
            valueClass="text-yellow-300"
            sub={`+${money(ledger.estimatedIn)} / -${money(ledger.estimatedOut)} plan`}
          />
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-neutral-500">
              HOY · {live.tripsToday} VIAJES{live.firstTripTime ? ` · ${live.firstTripTime}→${live.lastTripTime}` : ""}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-300">
              <Wallet className="size-3" />
              {live.hoursSpan > 0 ? `${live.hoursSpan}h` : "sin turno aún"}
            </span>
          </div>
          <div className="flex gap-2">
            <MiniStat label="BRUTO" value={money(live.grossToday)} valueClass="text-yellow-400" />
            <MiniStat label="NETO" value={money(live.netToday - live.expensesToday)} valueClass="text-green-400" />
            <MiniStat label="$ / HORA" value={live.hoursSpan > 0 ? `$${live.netPerHour.toFixed(0)}` : "—"} valueClass="text-white" />
            <MiniStat label="GASTOS" value={money(live.expensesToday)} valueClass="text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
              <button type="button" onClick={() => setEditingGoal((v) => !v)} className="flex items-center gap-1 text-neutral-400">
                <Landmark className="size-3" /> META DEL DÍA {goal > 0 ? `· ${money(goal)}` : "· sin meta"}
              </button>
              <span className="text-neutral-500">{goal > 0 ? `${goalPct.toFixed(0)}%` : ""}</span>
            </div>
            {goal > 0 ? (
              <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={cn("h-full rounded-full transition-all", goalPct >= 100 ? "bg-green-400" : "bg-yellow-400")}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            ) : null}
            {editingGoal ? (
              <div className="mt-1 flex gap-1">
                <input
                  autoFocus
                  className={INPUT_CLS}
                  inputMode="decimal"
                  placeholder="Meta bruta del día, ej. 250"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitGoal()}
                />
                <button
                  type="button"
                  onClick={commitGoal}
                  className="shrink-0 rounded-xl bg-yellow-400 px-3 text-xs font-extrabold text-black"
                >
                  OK
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          {(["REGISTER", "PLAN"] as SubTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSub(t)}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs font-extrabold tracking-widest",
                sub === t ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300" : "border-neutral-800 text-neutral-500",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {sub === "REGISTER" ? (
          <>
            <div className="flex gap-1.5">
              {(["ALL", "confirmed", "pending", "estimated"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-[10px] font-bold uppercase",
                    filter === f ? "border-yellow-400/60 text-yellow-300" : "border-neutral-800 text-neutral-500",
                  )}
                >
                  {f === "ALL" ? "Todo" : f === "confirmed" ? "Real" : f === "pending" ? "Pend." : "Plan"}
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 p-6 text-center text-xs text-neutral-500">
                Sin movimientos aquí todavía. Registra viajes en ENTRY o añade tu plan en la pestaña PLAN.
              </div>
            ) : (
              <div className="space-y-2 pb-2">
                {visible.map((row) => (
                  <LedgerCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-neutral-500">HORIZONTE</span>
                <span className="text-[10px] font-bold text-yellow-300">→ {prettyDate(ledger.projectedThrough)}</span>
              </div>
              <div className="flex gap-1.5">
                {[7, 14, 21, 30].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizon(h)}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 text-[11px] font-bold",
                      horizon === h ? "border-yellow-400/60 text-yellow-300" : "border-neutral-800 text-neutral-500",
                    )}
                  >
                    {h}d
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2 text-center">
                <div className="flex-1 rounded-xl bg-neutral-950 py-2">
                  <p className="text-[9px] font-bold text-neutral-500">PLAN ENTRA</p>
                  <p className="text-sm font-extrabold tabular-nums text-green-400">+{money(ledger.estimatedIn)}</p>
                </div>
                <div className="flex-1 rounded-xl bg-neutral-950 py-2">
                  <p className="text-[9px] font-bold text-neutral-500">PLAN SALE</p>
                  <p className="text-sm font-extrabold tabular-nums text-rose-400">-{money(ledger.estimatedOut)}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingItem(null)
                setShowForm((v) => !v)
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-yellow-400 py-2.5 text-sm font-extrabold text-black"
            >
              <Plus className="size-4" /> Añadir fijo / esperado
            </button>
            {showForm && !editingItem ? (
              <PlanForm
                onSave={(p) => {
                  persistPlan([p, ...plan])
                  setShowForm(false)
                }}
                onCancel={() => setShowForm(false)}
              />
            ) : null}
            {editingItem ? (
              <PlanForm
                initial={editingItem}
                onSave={(p) => {
                  persistPlan(plan.map((x) => (x.id === p.id ? p : x)))
                  setEditingItem(null)
                }}
                onCancel={() => setEditingItem(null)}
              />
            ) : null}

            {plan.length === 0 && !showForm ? (
              <div className="space-y-2">
                <p className="text-[11px] text-neutral-500">Empieza rápido con estos típicos (tócalos para añadirlos):</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PLAN.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => persistPlan([{ ...q, id: newPlanItemId() }, ...plan])}
                      className="rounded-full border border-neutral-700 px-2.5 py-1.5 text-[11px] font-bold text-neutral-300"
                    >
                      + {q.label} · {money(q.amount)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2 pb-2">
              {plan.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-white">{p.label}</p>
                    <p className="text-[11px] text-neutral-500">
                      {p.cadence === "daily" ? "Diario" : p.cadence === "weekly" ? `Semanal · ${WEEKDAYS_ES[p.anchor % 7]}` : `Mensual · día ${p.anchor}`} · {p.category}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("text-sm font-extrabold tabular-nums", p.direction === "in" ? "text-green-400" : "text-rose-400")}>
                      {p.direction === "in" ? "+" : "-"}{money(p.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={() => {
                        setEditingItem(p)
                        setShowForm(false)
                      }}
                      className="rounded-lg border border-neutral-700 p-1.5 text-neutral-400"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Borrar"
                      onClick={() => persistPlan(plan.filter((x) => x.id !== p.id))}
                      className="rounded-lg border border-neutral-700 p-1.5 text-rose-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="pb-4 text-center text-[10px] text-neutral-600">
          Real money and estimates never share a cell. El saldo y el plan se guardan en este teléfono.
        </p>
      </div>
    </div>
  )
}




