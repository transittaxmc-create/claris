// Pantalla FINANCE — Gastos y Finanzas (paquete recibido en Downloads/files,
// adaptado a Claris: sin zustand, estilo negro/neutral + amarillo).
//
// Sub-pestañas:
// - CAJA: saldo disponible, facturas 7 días, alerta de déficit + corrida de
//   caja diaria (semana Lun→Dom con montos por plataforma editables).
// - PLAN: superávit invertible + plan de pagos + ledger programado.
// - PEAJES: facturas de peajes generadas al cerrar el día en REGISTER.
// - MIS GASTOS: registro rápido de gastos operativos + reserva 10%.
//
// Estado semanal en ./finance-store (localStorage claris_finance_week_v1,
// viaja con el export/import vía storage.ts). Ledger programado y facturas
// de peajes en claris_scheduled_entries / claris_toll_bills (mismas claves
// que el flujo v0 de REGISTER, para que ambos lados vean lo mismo).

"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  PlusCircle,
  Printer,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/dates"
import { BankAuditSheet } from "./bank-audit-sheet"
import { ExpenseRegisterForm } from "./expense-register-form"
import { FinanceRegisterTable } from "./finance-register-table"
import { UpcomingBillsForm } from "./upcoming-bills-form"
import { useFinance, applyRealTrips, computeRealWeekTotals } from "./finance-store"
import { computePanorama, tollBillsToPayments } from "./finance-bridge"
import { planToCover, hourlyStats, hourlyTotals } from "@/lib/production"
import { moneyAlerts, tightestDay } from "@/lib/decisions"
import { reconSummary } from "./reconciliation"
import {
  daysUntil,
  grossOf,
  money,
  netOf,
  tripDateOf,
  type Expense as CopilotoExpense,
  type ScheduleFrequency,
  type ScheduledEntry,
  type TollBill,
  type Trip,
} from "./types"
import { CashFlowRegister } from "./cash-flow-register"
import { ExpensesScreen } from "./expenses-screen"

type SubTab = "caja" | "libro" | "plan" | "peajes" | "gastos"
type RegisterView = "bank" | "projected"

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return localDateKey(next)
}
const SCHEDULE_FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: "once", label: "Una vez" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "annual", label: "Anual" },
]

function suggestScheduleCategory(value: string): string {
  const text = value.toLowerCase()
  if (text.includes("gas")) return "Gasolina / Combustible"
  if (text.includes("seguro")) return "Seguros / Permisos"
  if (text.includes("renta") || text.includes("alquiler")) return "Vivienda"
  if (text.includes("comida") || text.includes("restaurante")) return "Alimentación / Comida"
  return "Varios"
}

function newScheduleDraft(): ScheduledEntry {
  const today = localDateKey(new Date())
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sch-${Date.now()}`,
    kind: "expense",
    description: "",
    category: "Varios",
    amount: 0,
    startDate: today,
    nextDate: today,
    frequency: "monthly",
    active: true,
  }
}

function ScheduleLedger({
  schedules,
  onSave,
  onDelete,
}: {
  schedules: ScheduledEntry[]
  onSave: (entry: ScheduledEntry) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<Partial<ScheduledEntry> | null>(null)
  const [aiNote, setAiNote] = useState("")

  function commit() {
    if (!draft?.description?.trim() || !(Number(draft.amount) > 0)) return
    const today = localDateKey(new Date())
    onSave({
      id: typeof draft.id === "string" && draft.id ? draft.id : `sch-${Date.now()}`,
      kind: draft.kind ?? "expense",
      description: draft.description.trim(),
      category: draft.category ?? "Varios",
      amount: Number(draft.amount) || 0,
      startDate: draft.startDate ?? today,
      endDate: draft.endDate || undefined,
      occurrences: draft.occurrences ? Number(draft.occurrences) : undefined,
      frequency: draft.frequency ?? "monthly",
      nextDate: draft.nextDate ?? draft.startDate ?? today,
      active: draft.active ?? true,
    })
    setDraft(null)
    setAiNote("")
  }

  return (
    <section className="rounded-2xl border border-yellow-400/30 bg-neutral-900/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-white">
            <CalendarClock className="size-4 text-yellow-400" /> LEDGER PROGRAMADO
          </p>
          <p className="text-[11px] text-neutral-500">
            Ingresos y gastos editables, con fecha final u ocurrencias.
          </p>
        </div>
        <Sparkles className="size-4 text-yellow-400" />
      </div>
      {draft ? (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-700 bg-black/30 p-3">
          <input
            autoFocus
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onBlur={(e) => {
              const category = suggestScheduleCategory(e.target.value)
              setDraft((current) => ({ ...current, category }))
              setAiNote(`IA: categoría sugerida “${category}”.`)
            }}
            placeholder="Descripción (ej. gasolina)"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none"
          />
          <div className="flex gap-2">
            <select
              value={draft.kind ?? "expense"}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as "income" | "expense" })}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={draft.amount ?? 0}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              className="w-28 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-white"
              placeholder="Monto"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.startDate ?? localDateKey(new Date())}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value, nextDate: e.target.value })}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white"
            />
            <select
              value={draft.frequency ?? "monthly"}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value as ScheduleFrequency })}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white"
            >
              {SCHEDULE_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.endDate ?? ""}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              aria-label="Fecha final (opcional)"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white"
            />
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={draft.occurrences ?? ""}
              onChange={(e) => setDraft({ ...draft, occurrences: Number(e.target.value) || undefined })}
              aria-label="Ocurrencias (opcional)"
              placeholder="Veces"
              className="w-28 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white"
            />
          </div>
          {aiNote ? <p className="text-[11px] text-yellow-300/80">{aiNote}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null)
                setAiNote("")
              }}
              className="flex-1 rounded-xl border border-neutral-700 py-2 text-xs font-bold text-neutral-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={commit}
              className="flex-1 rounded-xl bg-yellow-400 py-2 text-xs font-extrabold text-black"
            >
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(newScheduleDraft())
            setAiNote("")
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-700 py-2.5 text-xs font-bold text-neutral-300"
        >
          <Plus className="size-3.5" /> Nueva programación
        </button>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        {schedules.length === 0 && !draft ? (
          <p className="py-1 text-center text-[11px] text-neutral-600">Sin programaciones todavía.</p>
        ) : null}
        {schedules.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-black/20 p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{entry.description}</p>
              <p className="text-[10px] text-neutral-500">
                {entry.kind === "income" ? "Ingreso" : "Gasto"} · {entry.frequency} · desde {entry.startDate}
                {entry.endDate ? ` → ${entry.endDate}` : ""}
              </p>
            </div>
            <strong className={entry.kind === "income" ? "text-green-400" : "text-rose-400"}>
              {money(entry.amount)}
            </strong>
            <button
              type="button"
              onClick={() => setDraft({ ...entry })}
              aria-label="Editar programación"
              className="rounded-lg border border-neutral-700 p-1.5 text-neutral-400"
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              aria-label="Eliminar programación"
              className="rounded-lg border border-neutral-700 p-1.5 text-rose-400"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function TollBills({ bills, onTogglePaid }: { bills: TollBill[]; onTogglePaid: (id: string) => void }) {
  const unpaid = bills.filter((b) => b.status === "unpaid").length
  return (
    <section className="rounded-2xl border border-sky-500/30 bg-sky-950/10 p-3.5" aria-label="Facturas de peajes">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Receipt className="size-4 shrink-0 text-sky-400" /> FACTURAS DE PEAJES
          </p>
          <p className="text-[11px] text-neutral-500">
            Factura diaria generada al cerrar REGISTER; vence al día siguiente.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-right text-[10px] font-bold text-sky-400">
          {unpaid} pendientes
        </span>
      </div>
      {bills.length === 0 ? (
        <p className="py-2 text-center text-xs text-neutral-600">Todavía no hay facturas diarias.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-black/20 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">Peajes del {bill.serviceDate}</p>
                <p className="text-[10px] text-neutral-500">
                  Vence {bill.dueDate} · {bill.status === "paid" ? "Pagada" : "Pendiente"}
                </p>
              </div>
              <strong className="text-sky-300">{money(bill.amount)}</strong>
              <button
                type="button"
                onClick={() => onTogglePaid(bill.id)}
                aria-label="Cambiar estado de factura"
                className={cn(
                  "rounded-lg border p-1.5",
                  bill.status === "paid"
                    ? "border-green-500/50 text-green-400"
                    : "border-neutral-700 text-neutral-400",
                )}
              >
                <Check className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
// Crea la factura de peajes del día (misma API que el paquete remoto v0;
// REGISTER la genera al cerrar el día).
export function createTollBill(trips: { toll: number }[], serviceDate: string): TollBill {
  const amount = trips.reduce((sum, trip) => sum + (Number(trip.toll) || 0), 0)
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bill-${Date.now()}`,
    serviceDate,
    dueDate: addDays(serviceDate, 1),
    amount,
    status: "unpaid",
  }
}


export function FinanceScreen({
  trips,
  expenses,
  onSave,
  onDelete,
}: {
  trips: Trip[]
  expenses: CopilotoExpense[]
  onSave: (e: CopilotoExpense) => void
  onDelete: (id: string) => void
}) {
  const [activeTab, setActiveTab] = useState<SubTab>("caja")
  const [registerView, setRegisterView] = useState<RegisterView>("bank")
  // SIMPLE deja el héroe, el resumen de la semana, las tres preguntas y los
  // avisos; COMPLETO añade el detalle de lo que vence en los próximos 7 días.
  // Se recuerda en el teléfono (claris_finance_mode).
  const [mode, setMode] = useState<"simple" | "completo">("completo")
  
  const { startingBalance, days, setStartingBalance, resetAllData } = useFinance()
  const { getUpcomingExpensesTotal, getInvestableSurplus, getEmergencyPlan } = useFinance()
  const upcomingBills = getUpcomingExpensesTotal(7)
  const { amount: surplus, isSafe } = getInvestableSurplus()
  const emergencyData = getEmergencyPlan()

  // Datos REALES del copiloto -> corrida de caja. Se aplican cada vez que los
  // viajes cambian, agrupados por día y plataforma en la columna REAL.
  const realTrips = useMemo(
    () =>
      trips.map((t) => ({
        date: tripDateOf(t),
        platform: t.platform,
        net: netOf(t),
      })),
    [trips],
  )
  const realTotals = useMemo(() => computeRealWeekTotals(realTrips), [realTrips])
  useEffect(() => {
    applyRealTrips(realTrips)
  }, [realTrips])

  // Ledger programado + facturas de peajes: mismas claves que REGISTER.
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [bills, setBills] = useState<TollBill[]>([])
  useEffect(() => {
    try {
      const s = localStorage.getItem("claris_scheduled_entries")
      if (s) setSchedules(JSON.parse(s))
      const b = localStorage.getItem("claris_toll_bills")
      if (b) setBills(JSON.parse(b))
      const m = localStorage.getItem("claris_finance_mode")
      if (m === "simple" || m === "completo") setMode(m)
    } catch {}
  }, [])

  function changeMode(next: "simple" | "completo") {
    setMode(next)
    try {
      localStorage.setItem("claris_finance_mode", next)
    } catch {}
  }

  // Panorama semanal: balance real + proyección diaria + cobertura de pagos en
  // su vencimiento. Lo calcula finance-bridge (lógica pura y probada).
  const panorama = useMemo(() => {
    const scheduled = [
      ...schedules
        .filter((s) => s.kind === "expense" && s.active !== false && s.nextDate)
        .map((s) => ({ description: s.description, amount: Number(s.amount) || 0, nextDate: s.nextDate })),
      // Los peajes del día ya se acumulan en una factura con vencimiento
      // (createTollBill). Sin esto el panorama decía "cubierto" ignorando un
      // pago que vence mañana: se avisaba de ellos pero no se planificaban.
      ...tollBillsToPayments(bills),
    ]
    const expenseList = expenses.map((e) => ({ date: e.date, amount: e.amount }))
    return computePanorama({
      startingBalance,
      days,
      scheduled,
      expenses: expenseList,
      trips: realTrips,
    })
  }, [startingBalance, days, schedules, expenses, realTrips, bills])

  const paymentsByDate: Record<string, { description: string; amount: number }[]> = {}
  for (const d of panorama.days) {
    if (d.payments.length > 0) {
      paymentsByDate[d.date] = d.payments.map((p) => ({ description: p.description, amount: p.amount }))
    }
  }
  const belowZeroDates = new Set(panorama.days.filter((d) => d.belowZero).map((d) => d.date))
  const todayKey = localDateKey(new Date())
  const todayPlatformTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const trip of trips) {
      if (tripDateOf(trip) !== todayKey) continue
      totals.set(trip.platform, (totals.get(trip.platform) ?? 0) + grossOf(trip))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [trips, todayKey])
  const grossToday = todayPlatformTotals.reduce((total, [, amount]) => total + amount, 0)
  const registerGrossTotal = trips.reduce((total, trip) => total + grossOf(trip), 0)

  // Plan realista: horas/días de trabajo necesarios para cubrir el faltante a la
  // meta por hora del usuario, antes del vencimiento más próximo.
  const coverPlan = useMemo(() => {
    let goalRate = 60
    try {
      const stored = Number(localStorage.getItem("claris_hourly_goal"))
      if (Number.isFinite(stored) && stored > 0) goalRate = stored
    } catch {}
    const dueSoon = schedules
      .filter((s) => s.kind === "expense" && s.active !== false && s.nextDate)
      .map((s) => daysUntil(s.nextDate))
      .filter((d) => d >= 0)
    const daysUntilDue = dueSoon.length > 0 ? Math.max(1, Math.min(...dueSoon)) : 7
    return planToCover({ shortfall: panorama.shortfall, goalRate, hoursPerDay: 8, daysUntilDue })
  }, [panorama.shortfall, schedules])

  // ---------------------------------------------------------------------------
  // DECISIONES: las tres preguntas (¿me están pagando?, ¿cuánto llevo hoy?,
  // ¿me alcanza la semana?).
  // Todo se calcula con lo que ya existe: no se guardan datos nuevos.
  //
  // Aquí estaba la tarjeta "¿PUEDO GASTAR?". Se quitó porque leía
  // `upcomingExpenses` del store mientras el panorama lee
  // `claris_scheduled_entries`: dos listas distintas de "lo que hay que
  // pagar", así que la tarjeta decía "sin compromisos pendientes" mientras
  // el resumen de abajo listaba los pagos. El panorama ya es la respuesta
  // buena y sale justo debajo.
  // ---------------------------------------------------------------------------

  // Meta por hora del conductor (la misma que usa el cronómetro de ENTRY).
  const goalRate = useMemo(() => {
    try {
      const stored = Number(localStorage.getItem("claris_hourly_goal"))
      if (Number.isFinite(stored) && stored > 0) return stored
    } catch {}
    return 55
  }, [])



  // ¿ME ESTÁN PAGANDO? Esperado menos recibido, y cuántos días lleva el más viejo.
  const porCobrar = useMemo(() => {
    const summary = reconSummary(trips)
    const pendientes = trips.filter((t) => t.status === "pending")
    const atraso = pendientes.length > 0 ? Math.max(0, -Math.min(...pendientes.map((t) => daysUntil(tripDateOf(t))))) : 0
    return {
      amount: Math.max(0, Math.round((summary.expected - summary.received) * 100) / 100),
      count: pendientes.length,
      oldestDays: atraso,
    }
  }, [trips])

  // ¿CUÁNTO LLEVO HOY? Lo mismo que muestra el cronómetro de ENTRY.
  const hoy = useMemo(() => {
    let worked: Record<string, number> = {}
    try {
      const raw = localStorage.getItem("claris_hours_worked")
      if (raw) worked = JSON.parse(raw) ?? {}
    } catch {}
    const list = trips.map((t) => ({ date: tripDateOf(t), time: t.time, net: netOf(t) }))
    const stats = hourlyStats({ trips: list, worked, day: localDateKey(new Date()) })
    const totals = hourlyTotals(stats, goalRate)
    return { produced: totals.produced, rate: totals.rate, goalHours: totals.goalHours, measuredHours: totals.measuredHours }
  }, [trips, goalRate])

  // ¿ME ALCANZA LA SEMANA? El día que aprieta, con lo que vence ese día.
  const diaAjustado = useMemo(() => tightestDay(panorama.days), [panorama.days])

  // QUÉ HACER AHORA: máximo tres, urgente primero y luego por dinero.
  const avisos = useMemo(() => {
    const vencidos = schedules
      .filter((s) => s.kind === "expense" && s.active !== false && s.nextDate && daysUntil(s.nextDate) < 0)
      .map((s) => ({
        description: s.description,
        amount: Number(s.amount) || 0,
        daysLate: -daysUntil(s.nextDate),
      }))
    const sinRecibo = expenses.filter((e) => !e.isAiGenerated && Number(e.amount) > 0)
    const sinClasificar = expenses.filter((e) => !e.classification)
    const peajesImpagos = bills.filter((b) => b.status === "unpaid")
    return moneyAlerts({
      overdue: vencidos,
      unpaidTollBills: {
        count: peajesImpagos.length,
        amount: peajesImpagos.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      },
      shortfall: panorama.shortfall,
      tightDay: diaAjustado,
      expensesWithoutReceipt: {
        count: sinRecibo.length,
        amount: sinRecibo.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      },
      unclassified: { count: sinClasificar.length },
    })
  }, [schedules, expenses, bills, panorama.shortfall, diaAjustado])

  function saveSchedule(entry: ScheduledEntry) {
    setSchedules((current) => {
      const next = current.some((item) => item.id === entry.id)
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...current]
      try {
        localStorage.setItem("claris_scheduled_entries", JSON.stringify(next))
      } catch {}
      return next
    })
  }
  function deleteSchedule(id: string) {
    setSchedules((current) => {
      const next = current.filter((e) => e.id !== id)
      try {
        localStorage.setItem("claris_scheduled_entries", JSON.stringify(next))
      } catch {}
      return next
    })
  }
  function toggleBill(id: string) {
    setBills((current) => {
      const next = current.map((b) =>
        b.id === id ? { ...b, status: b.status === "paid" ? ("unpaid" as const) : ("paid" as const) } : b,
      )
      try {
        localStorage.setItem("claris_toll_bills", JSON.stringify(next))
      } catch {}
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-4 pb-3 pt-3">
        {/* Fila 1: el título manda; el subtítulo no compite con él. */}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-white">Finanzas</h1>
          <p className="shrink-0 text-[11px] text-neutral-400">Tu dinero y tus pagos</p>
        </div>
        {/* Fila 2: controles en su propia línea. SIMPLE/COMPLETO ocupa todo el
            ancho que sobra, así no se encoge el selector al lado de los iconos. */}
        <div className="mt-2.5 flex items-center gap-2">
          {/* SIMPLE / COMPLETO: un toque para ver menos o ver todo. */}
          <div
            className="flex min-w-0 flex-1 rounded-full border border-neutral-800 bg-neutral-900 p-0.5 text-[11px] font-bold"
            role="group"
            aria-label="Nivel de detalle"
          >
            <button
              type="button"
              onClick={() => changeMode("simple")}
              aria-pressed={mode === "simple"}
              className={cn(
                "min-h-[32px] flex-1 rounded-full px-3 transition-colors",
                mode === "simple" ? "bg-yellow-400 text-black" : "text-neutral-400 hover:text-white",
              )}
            >
              SIMPLE
            </button>
            <button
              type="button"
              onClick={() => changeMode("completo")}
              aria-pressed={mode === "completo"}
              className={cn(
                "min-h-[32px] flex-1 rounded-full px-3 transition-colors",
                mode === "completo" ? "bg-yellow-400 text-black" : "text-neutral-400 hover:text-white",
              )}
            >
              COMPLETO
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Deseas reiniciar todos los valores a $0.00 para empezar de cero?")) {
                resetAllData()
              }
            }}
            aria-label="Reiniciar valores a $0.00"
            className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            title="Reiniciar a $0.00"
          >
            <RotateCcw className="size-4" />
          </button>
          <div className="shrink-0">
            <BankAuditSheet />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 text-[11px] font-semibold sm:grid-cols-5">
          {(
            [
              ["caja", "Corrida de Caja"],
              ["libro", "Libro Mayor"],
              ["plan", "Plan de Pagos"],
              ["peajes", "Peajes"],
              ["gastos", "Mis Gastos"],
            ] as [SubTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                // text-center + leading-tight: con 5 etiquetas en 390 px,
                // "Corrida de Caja" se cortaba en dos líneas desalineadas.
                "rounded-lg px-1 py-2 text-center leading-tight transition-all",
                activeTab === key ? "bg-yellow-400 text-black shadow-md" : "text-neutral-400 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === "caja" && (
          <div className="space-y-3">

            {/* RESUMEN: los cuatro números de la semana, SIEMPRE visibles
                (en SIMPLE y en COMPLETO). Es la vista de la semana de un vistazo. */}
            <section
              className={cn(
                "rounded-2xl border p-3.5",
                panorama.covered ? "border-emerald-500/30 bg-emerald-950/15" : "border-rose-500/40 bg-rose-950/20",
              )}
            >
              <div className="mb-3 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <p className="text-[11px] font-bold tracking-wide text-neutral-300">
                  RESUMEN DE LA SEMANA
                  <span className="ml-1 font-semibold text-neutral-500">· {realTotals.realTripCount} viajes</span>
                </p>
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold",
                    panorama.covered ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
                  )}
                >
                  {panorama.covered
                    ? "✅ TUS INGRESOS CUBREN TUS PAGOS"
                    : `⚠️ FALTAN $${panorama.shortfall.toFixed(2)}`}
                </span>
              </div>

              {/* 2×2 en teléfono: cuatro columnas seguidas dejaban los importes
                  a ~85 px y se cortaban en un ancho de 390 px. */}
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-xl bg-black/25 p-2.5">
                  <div className="text-[9px] font-bold text-neutral-500">INGRESOS</div>
                  <div className="text-sm font-extrabold text-emerald-400">
                    {panorama.weekIncomeReal > 0 ? "+" : ""}${panorama.weekIncomeReal.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl bg-black/25 p-2.5">
                  <div className="text-[9px] font-bold text-neutral-500">GASTOS</div>
                  <div className="text-sm font-extrabold text-rose-400">
                    {panorama.weekExpenses > 0 ? "-" : ""}${panorama.weekExpenses.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl bg-black/25 p-2.5">
                  <div className="text-[9px] font-bold text-neutral-500">PAGOS PRÓXIMOS</div>
                  <div className="text-sm font-extrabold text-amber-300">
                    {panorama.weekPayments > 0 ? "-" : ""}${panorama.weekPayments.toFixed(2)}
                  </div>
                </div>
                <div className={cn("rounded-xl p-2.5", panorama.covered ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                  <div className="text-[9px] font-bold text-neutral-400">BALANCE PROYECTADO</div>
                  <div className={cn("text-sm font-black", panorama.covered ? "text-emerald-400" : "text-rose-400")}>
                    ${panorama.finalBalance.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Días en riesgo: si algún día cae por debajo de cero, se muestra */}
              {!panorama.covered && (
                <div className="mt-2.5 flex flex-col gap-1">
                  {panorama.days
                    .filter((d) => d.belowZero)
                    .map((d) => (
                      <p key={d.date} className="text-[10px] text-rose-300">
                        📉 {d.date}: quedarías en <strong>-${Math.abs(d.balanceAfter).toFixed(2)}</strong>
                        {d.payments.length > 0 ? ` (vence ${d.payments.map((p) => p.description).join(", ")})` : ""}
                      </p>
                    ))}
                </div>
              )}

              {/* Plan realista: cuántas horas/días de trabajo hacen falta para
                  cubrir el faltante, a la meta por hora del usuario. */}
              {!panorama.covered && (
                <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-2.5 py-2 text-[10px] font-semibold leading-snug text-amber-200">
                  🗓️ PLAN REALISTA · {coverPlan.message}
                </p>
              )}
            </section>

            {/* PREGUNTAS RÁPIDAS: la explicación del héroe en dos tarjetas. */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-2.5">
                <p className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-neutral-500">
                  <Receipt className="size-3 text-amber-400" /> ¿ME ESTÁN PAGANDO?
                </p>
                <div className="mt-1 text-lg font-extrabold tracking-tight text-amber-300">
                  {money(porCobrar.amount)}
                </div>
                <p className="mt-0.5 text-[9.5px] leading-snug text-neutral-400">
                  <strong className="text-neutral-200">{porCobrar.count}</strong>{" "}
                  {porCobrar.count === 1 ? "viaje" : "viajes"} sin pagar
                  {porCobrar.oldestDays > 0 ? (
                    <>
                      {" "}
                      · el más viejo <strong className="text-amber-300">{porCobrar.oldestDays} días</strong>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-2.5">
                <p className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-neutral-500">
                  <TrendingUp className="size-3 text-emerald-400" /> ¿CUÁNTO LLEVO HOY?
                </p>
                <div className="mt-1 text-lg font-extrabold tracking-tight text-emerald-400">{money(hoy.produced)}</div>
                <p className="mt-0.5 text-[9.5px] leading-snug text-neutral-400">
                  {hoy.rate !== null ? (
                    <>
                      <strong className="text-neutral-200">${hoy.rate.toFixed(0)}/h</strong> · meta ${Math.round(goalRate)}
                    </>
                  ) : (
                    <>sin tiempo medido hoy</>
                  )}{" "}
                  · {hoy.goalHours} de {hoy.measuredHours} horas
                </p>
              </div>
            </div>

            {/* QUÉ HACER AHORA: máximo tres, urgente primero y luego por dinero. */}
            {avisos.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
                <p className="px-3 pb-1 pt-2.5 text-[9px] font-bold tracking-[0.12em] text-neutral-500">
                  QUÉ HACER AHORA · {avisos.length}
                </p>
                {avisos.map((aviso) => (
                  <div
                    key={aviso.id}
                    className="flex items-center gap-2.5 border-t border-white/5 px-3 py-2"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        aviso.tone === "danger" ? "bg-rose-400" : aviso.tone === "warn" ? "bg-amber-400" : "bg-sky-400",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-bold text-neutral-100">{aviso.title}</span>
                      <span className="block text-[9.5px] text-neutral-500">{aviso.detail}</span>
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-neutral-600" />
                  </div>
                ))}
              </section>
            )}

            {/* COMPLETO añade lo operativo: qué vence en los próximos 7 días. */}
            {mode === "completo" && (
              <>
            {/* Seguimiento de pagos programados: qué vence en los próximos 7 días */}
            {(() => {
              const soon = schedules
                .filter((s) => s.kind === "expense" && s.active !== false)
                .map((s) => ({ s, days: daysUntil(s.nextDate) }))
                .filter(({ days }) => days >= -1 && days <= 7)
                .sort((a, b) => a.days - b.days)
              if (soon.length === 0) return null
              const total = soon.reduce((acc, { s }) => acc + (Number(s.amount) || 0), 0)
              return (
                <section className="rounded-2xl border border-yellow-400/25 bg-yellow-400/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-yellow-300">
                      <CalendarClock className="size-3.5" /> PRÓXIMOS PAGOS (7 días)
                    </p>
                    <span className="text-[10px] font-bold text-neutral-400">
                      {soon.length} pago{soon.length === 1 ? "" : "s"} · total{" "}
                      <strong className="text-white">${total.toFixed(2)}</strong>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {soon.map(({ s, days }) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate font-semibold text-neutral-200">
                          {s.description}
                          <span className="text-neutral-500"> · {s.category}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-bold tabular-nums text-neutral-300">${Number(s.amount || 0).toFixed(2)}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                              days < 0
                                ? "bg-rose-500/15 text-rose-400"
                                : days === 0
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-neutral-800 text-neutral-400",
                            )}
                          >
                            {days < 0 ? "venció ayer" : days === 0 ? "HOY" : `en ${days}d`}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })()}
              </>
            )}

            {emergencyData.hasDeficit && (
              <div className="space-y-2 rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-xs">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Riesgo de Déficit Proyectado</span>
                </div>
                <p className="text-neutral-300">
                  Faltan <strong className="text-white">${emergencyData.deficitAmount.toFixed(2)}</strong>{" "}
                  para cubrir <strong className="text-white">{emergencyData.targetPaymentName}</strong>.
                </p>
                <div className="rounded-lg border border-red-800/40 bg-red-900/40 p-2 text-[11px] text-red-200">
                  ⚡ Meta sugerida: Incrementar{" "}
                  <strong>+${emergencyData.suggestedDailyIncrease.toFixed(2)}/día</strong> en los{" "}
                  {emergencyData.daysRemaining} días laborables restantes.
                </div>
              </div>
            )}

            <p className="text-[9px] font-bold tracking-[0.12em] text-neutral-500">REGISTROS</p>

            <div className="flex print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-[11px] font-bold text-neutral-200 transition hover:border-yellow-400 hover:text-yellow-300 active:bg-neutral-800"
              >
                <Printer className="size-3.5" /> Imprimir PDF · ambos registros
              </button>
            </div>
            <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 print:hidden" aria-label="Resumen de ingresos de hoy">
              <div className="grid grid-cols-2 gap-px border-b border-neutral-800 bg-neutral-800">
                <div className="bg-neutral-900/70 px-3.5 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">Gross today</p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">Trabajo de hoy · todas las plataformas</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-emerald-300">{money(grossToday)}</p>
                </div>
                <div className="bg-neutral-900/70 px-3.5 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-300">Register total</p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">Historial completo abierto</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-sky-300">{money(registerGrossTotal)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-neutral-800 sm:grid-cols-4">
                {todayPlatformTotals.length > 0 ? todayPlatformTotals.map(([platform, amount]) => (
                  <div key={platform} className="min-w-0 bg-neutral-950 px-3 py-2.5">
                    <p className="truncate text-[9px] font-bold uppercase tracking-wide text-neutral-500">{platform}</p>
                    <p className="mt-0.5 text-sm font-extrabold tabular-nums text-white">{money(amount)}</p>
                  </div>
                )) : (
                  <p className="col-span-2 bg-neutral-950 px-3 py-3 text-[10px] text-neutral-500 sm:col-span-4">Aún no hay transacciones registradas hoy.</p>
                )}
              </div>
            </section>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-1 print:hidden">
              <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Vistas del register">
                {([['bank', 'Registro bancario'], ['projected', 'Registro proyectado']] as [RegisterView, string][]).map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={registerView === view}
                    onClick={() => setRegisterView(view)}
                    className={cn('rounded-xl px-3 py-2.5 text-left text-[11px] font-extrabold transition', registerView === view ? 'bg-yellow-400 text-black' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white')}
                  >
                    {label}
                    <span className={cn('mt-0.5 block text-[9px] font-medium', registerView === view ? 'text-black/70' : 'text-neutral-600')}>
                      {view === 'bank' ? 'Editable · conciliación' : 'Banco + ingresos y pagos futuros'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <FinanceRegisterTable mode={registerView} paymentsByDate={registerView === 'projected' ? paymentsByDate : {}} belowZeroDates={registerView === 'projected' ? belowZeroDates : new Set<string>()} />
            <section className="hidden print:block print:bg-white print:p-4 print:text-black">
              <h1 className="mb-2 text-xl font-bold">Finance · Registros completos</h1>
              <h2 className="mb-1 text-base font-bold">Registro bancario · conciliación</h2>
              <FinanceRegisterTable mode="bank" paymentsByDate={{}} belowZeroDates={new Set<string>()} />
              <h2 className="mb-1 mt-8 text-base font-bold">Registro proyectado · banco + ingresos y pagos</h2>
              <FinanceRegisterTable mode="projected" paymentsByDate={paymentsByDate} belowZeroDates={belowZeroDates} />
            </section>
          </div>
        )}
        {activeTab === "libro" && (
          <CashFlowRegister
            startingActualBalance={startingBalance}
            onUpdateStartingBalance={setStartingBalance}
          />
        )}
        {activeTab === "plan" && (
          <div className="space-y-3">
            <div
              className={cn(
                "rounded-2xl border p-3.5",
                isSafe ? "border-emerald-500/30 bg-emerald-950/15" : "border-amber-500/30 bg-amber-950/10",
              )}
            >
              <p className="text-[9px] font-bold tracking-[0.12em] text-neutral-500">
                SUPERÁVIT INVERTIBLE
              </p>
              <div className={cn("mt-1 text-2xl font-extrabold", isSafe ? "text-emerald-400" : "text-amber-300")}>
                ${surplus.toFixed(2)}
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
                <ShieldCheck className={cn("size-3.5 shrink-0", isSafe ? "text-emerald-400" : "text-amber-300")} />{" "}
                {isSafe ? "Fondo de reserva de imprevistos cubierto" : "Reserva de seguridad bloqueada"}
              </p>
            </div>
            <UpcomingBillsForm />
            <ScheduleLedger schedules={schedules} onSave={saveSchedule} onDelete={deleteSchedule} />
          </div>
        )}

        {activeTab === "peajes" && (
          <div className="space-y-3">
            <TollBills bills={bills} onTogglePaid={toggleBill} />
          </div>
        )}

        {activeTab === "gastos" && (
          <div className="space-y-3">
            <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-3.5">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
                <PlusCircle className="size-4 text-yellow-400" />
                Registrar Nuevo Gasto Operativo
              </h3>
              <ExpenseRegisterForm />
            </div>
            {/* Gastos del copiloto (viajes/sincronizados): misma lista de la pestaña EXPENSES. */}
            <ExpensesScreen expenses={expenses} onSave={onSave} onDelete={onDelete} />
          </div>
        )}
      </div>
    </div>
  )
}



