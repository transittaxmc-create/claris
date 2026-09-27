"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Lock, Plus, ArrowRight, Download, Upload, CalendarClock, Sparkles, Pencil, Trash2, Receipt, Check, ArrowUpDown, Scale, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { type Trip, type ScheduledEntry, type ScheduleFrequency, type TollBill, grossOf, netOf, money } from "./types"
import { PlatformAvatar, PlatformBadge } from "./platform-avatar"
import {
  diffOf,
  expectedOf,
  groupByPlatform,
  reconStateOf,
  reconSummary,
  receivedOf,
  sortTrips,
  type PlatformGroup,
  type ReconState,
  type ReconSummary,
  type SortKey,
} from "./reconciliation"

type Filter = "ALL" | "PENDING" | "MATCHED" | "LEDGER"

// Colores por estado de reconciliación, en un solo sitio para que la tarjeta
// del viaje, el subtotal por plataforma y el panel usen exactamente el mismo.
const RECON_TONE: Record<ReconState, { text: string; border: string; label: string }> = {
  pending: { text: "text-neutral-400", border: "border-neutral-700", label: "Sin pago" },
  ok: { text: "text-green-400", border: "border-green-500/40", label: "Cuadra" },
  short: { text: "text-rose-400", border: "border-rose-500/40", label: "Pagaron de menos" },
  over: { text: "text-sky-400", border: "border-sky-500/40", label: "Pagaron de más" },
}

// Firmado: se usa tanto para el descuadre como para el ajuste.
function signed(n: number): string {
  if (Math.abs(n) < 0.005) return money(0)
  return `${n > 0 ? "+" : "−"}${money(Math.abs(n))}`
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-2 py-3">
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">{label}</span>
      <span className={cn("text-lg font-extrabold", valueClass)}>{value}</span>
    </div>
  )
}

// TOTAL GROSS con el desglose por plataforma dentro de la misma caja, que se
// recalcula con lo que esté filtrado en ese momento.
function GrossByPlatformCard({ total, groups }: { total: number; groups: PlatformGroup[] }) {
  return (
    <div className="flex flex-[1.7] flex-col gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-2.5 py-3">
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">TOTAL GROSS</span>
      <span className="text-lg font-extrabold text-yellow-400">{money(total)}</span>
      {groups.length === 0 ? (
        <span className="text-[10px] text-neutral-600">Sin viajes</span>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map((g) => (
            <div key={g.platform} className="flex items-center justify-between gap-2 text-[10px] leading-tight">
              <span className="flex min-w-0 items-center gap-1">
                <PlatformAvatar platform={g.platform} size={14} />
                <span className="truncate font-semibold text-neutral-300">{g.platform}</span>
                <span className="shrink-0 text-neutral-600">×{g.count}</span>
              </span>
              <span className="shrink-0 font-bold text-yellow-400/90">{money(g.gross)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Panel de reconciliación: cuánto se esperaba, cuánto llegó y la diferencia.
// El descuadre agregado ignora los viajes sin pago registrado, así que solo
// muestra lo que de verdad hay que arreglar.
function ReconciliationPanel({ summary, groups }: { summary: ReconSummary; groups: PlatformGroup[] }) {
  const tone = Math.abs(summary.diff) < 0.005 ? RECON_TONE.ok : summary.diff < 0 ? RECON_TONE.short : RECON_TONE.over
  const withDiff = groups.filter((g) => Math.abs(g.diff) >= 0.005)

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-neutral-300">
          <Scale className="size-3.5 text-neutral-400" /> RECONCILIACIÓN
        </p>
        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", tone.border, tone.text)}>
          {summary.problemCount === 0 ? "TODO CUADRA" : `${summary.problemCount} CON DIFERENCIA`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-neutral-500">ESPERADO</span>
          <span className="text-sm font-extrabold text-neutral-200">{money(summary.expected)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-neutral-500">RECIBIDO</span>
          <span className="text-sm font-extrabold text-neutral-200">{money(summary.received)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-neutral-500">DIFERENCIA</span>
          <span className={cn("text-sm font-extrabold", tone.text)}>{signed(summary.diff)}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[9px] font-bold text-neutral-400">
          {summary.pendingCount} sin pago
        </span>
        {summary.shortCount > 0 && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", RECON_TONE.short.border, RECON_TONE.short.text)}>
            {summary.shortCount} de menos
          </span>
        )}
        {summary.overCount > 0 && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", RECON_TONE.over.border, RECON_TONE.over.text)}>
            {summary.overCount} de más
          </span>
        )}
        {summary.okCount > 0 && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", RECON_TONE.ok.border, RECON_TONE.ok.text)}>
            {summary.okCount} cuadran
          </span>
        )}
      </div>

      {withDiff.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t border-neutral-800 pt-2">
          {withDiff.map((g) => (
            <div key={g.platform} className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-neutral-300">{g.platform}</span>
              <span className={cn("font-bold", g.diff < 0 ? RECON_TONE.short.text : RECON_TONE.over.text)}>
                {signed(g.diff)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TripCard({
  trip,
  onClick,
  onApplyReconciliation,
}: {
  trip: Trip
  onClick: () => void
  onApplyReconciliation: (t: Trip) => void
}) {
  const recon = {
    state: reconStateOf(trip),
    expected: expectedOf(trip),
    received: receivedOf(trip),
    diff: diffOf(trip),
  }
  const route =
    trip.pickup && trip.dropoff
      ? `${trip.pickup} → ${trip.dropoff}`
      : trip.dropoff
        ? `— → ${trip.dropoff}`
        : trip.pickup
          ? `${trip.pickup} → —`
          : "— → —"

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3.5 text-left transition-colors hover:border-neutral-600 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PlatformAvatar platform={trip.platform} size={24} />
          <span className="truncate font-bold text-white">{trip.platform}</span>
          {trip.isVoucher && (
            <span className="shrink-0 rounded-full border border-orange-400/60 px-2 py-0.5 text-[9px] font-bold text-orange-400">
              VOUCHER
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-extrabold text-green-400">{money(netOf(trip))}</p>
          <p className="text-[11px] text-neutral-500">{trip.time}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 truncate text-xs text-neutral-400">
          <ArrowRight className="size-3 shrink-0 text-neutral-600" />
          <span className="truncate">{route}</span>
        </p>
        <span className="flex shrink-0 items-center gap-1">
          {/* La diferencia manda sobre el estado manual: si no cuadra, se ve. */}
          {recon.state === "pending" ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
                trip.status === "pending"
                  ? "border-orange-400/60 text-orange-400"
                  : "border-green-400/60 text-green-400",
              )}
            >
              {trip.status === "pending" ? "Pendiente" : "Matched"}
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
                  RECON_TONE[recon.state].border,
                  RECON_TONE[recon.state].text,
                )}
                title={`Esperado ${money(recon.expected)} · recibido ${money(recon.received ?? 0)}`}
              >
                {recon.state === "ok" ? "Cuadra" : signed(recon.diff)}
              </span>
              {/* Arreglar el descuadre sin abrir el editor */}
              {recon.state !== "ok" && (
                <span
                  role="button"
                  tabIndex={0}
                  title={`Ajustar earnings en ${signed(recon.diff)} para que cuadre`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onApplyReconciliation(trip)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      e.preventDefault()
                      onApplyReconciliation(trip)
                    }
                  }}
                  className="rounded-full border border-yellow-400/60 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold uppercase text-yellow-400"
                >
                  Ajustar
                </span>
              )}
            </>
          )}
        </span>
      </div>
    </button>
  )
}

// Bloque de una plataforma: cabecera con su nombre, su subtotal y su descuadre,
// y debajo sus viajes. Es lo que permite ver de un vistazo cuánto va por cada
// plataforma y cuál no cuadra.
function PlatformGroupBlock({
  group,
  onEdit,
  onApplyReconciliation,
}: {
  group: PlatformGroup
  onEdit: (t: Trip) => void
  onApplyReconciliation: (t: Trip) => void
}) {
  const hasDiff = Math.abs(group.diff) >= 0.005
  const diffTone = group.diff < 0 ? RECON_TONE.short : RECON_TONE.over

  return (
    <section className="rounded-2xl border border-neutral-800 bg-black/20 p-2">
      <header className="mb-2 flex items-start justify-between gap-2 px-1.5 pt-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <PlatformAvatar platform={group.platform} size={18} />
            <span className="truncate text-xs font-extrabold tracking-wide text-white">{group.platform}</span>
            <PlatformBadge platform={group.platform} />
            <span className="shrink-0 rounded-full border border-neutral-700 px-1.5 py-0.5 text-[9px] font-bold text-neutral-400">
              {group.count}
            </span>
          </div>
          <p className="text-[10px] text-neutral-500">
            Bruto <span className="font-bold text-yellow-400/90">{money(group.gross)}</span> · neto{" "}
            <span className="font-bold text-green-400">{money(group.net)}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {hasDiff && (
            <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", diffTone.border, diffTone.text)}>
              {signed(group.diff)}
            </span>
          )}
          {group.pendingCount > 0 && (
            <span className="text-[9px] text-neutral-500">{group.pendingCount} sin pago</span>
          )}
        </div>
      </header>

      <div className="space-y-2">
        {group.trips.map((t) => (
          <TripCard key={t.id} trip={t} onClick={() => onEdit(t)} onApplyReconciliation={onApplyReconciliation} />
        ))}
      </div>
    </section>
  )
}

function nextOccurrence(date: string, frequency: ScheduleFrequency): string {
  const d = new Date(`${date}T12:00:00`)
  if (frequency === "daily") d.setDate(d.getDate() + 1)
  if (frequency === "weekly") d.setDate(d.getDate() + 7)
  if (frequency === "monthly") d.setMonth(d.getMonth() + 1)
  if (frequency === "annual") d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
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
  const frequencies: { value: ScheduleFrequency; label: string }[] = [
    { value: "once", label: "Una vez" }, { value: "daily", label: "Diario" },
    { value: "weekly", label: "Semanal" }, { value: "monthly", label: "Mensual" }, { value: "annual", label: "Anual" },
  ]
  function suggestCategory(value: string) {
    const text = value.toLowerCase()
    const category = text.includes("gas") ? "Gasolina / Combustible" : text.includes("seguro") ? "Seguros / Permisos" : text.includes("renta") || text.includes("alquiler") ? "Vivienda" : text.includes("comida") || text.includes("restaurante") ? "Alimentación / Comida" : "Varios"
    setDraft((current) => ({ ...current, category }))
    setAiNote(`IA: categoría sugerida “${category}”.`)
  }
  return <section className="rounded-2xl border border-yellow-500/30 bg-neutral-900/60 p-3">
    <div className="mb-3 flex items-center justify-between"><div><p className="flex items-center gap-2 text-sm font-extrabold text-white"><CalendarClock className="size-4 text-yellow-400" /> LEDGER PROGRAMADO</p><p className="text-[11px] text-neutral-500">Edita proyecciones y corrige cualquier fecha.</p></div><Sparkles className="size-4 text-yellow-400" /></div>
    {draft ? <div className="flex flex-col gap-2 rounded-xl border border-neutral-700 bg-black/30 p-3">
      <input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={(e) => suggestCategory(e.target.value)} placeholder="Descripción (ej. gasolina)" className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none" />
      <div className="flex gap-2"><select value={draft.kind ?? "expense"} onChange={(e) => setDraft({ ...draft, kind: e.target.value as "income" | "expense" })} className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white"><option value="expense">Gasto</option><option value="income">Ingreso</option></select><input type="number" min="0" value={draft.amount ?? 0} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} className="w-28 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-white" placeholder="Monto" /></div>
      <div className="flex gap-2"><input type="date" value={draft.startDate ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft({ ...draft, startDate: e.target.value, nextDate: e.target.value })} className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white" /><select value={draft.frequency ?? "monthly"} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as ScheduleFrequency })} className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white">{frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
      <div className="flex gap-2"><input type="date" value={draft.endDate ?? ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white" aria-label="Fecha final opcional" /><input type="number" min="1" value={draft.occurrences ?? ""} onChange={(e) => setDraft({ ...draft, occurrences: e.target.value ? Number(e.target.value) : undefined })} className="w-28 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-white" placeholder="# veces" /></div>
      <p className="text-[11px] text-neutral-500">Categoría: <span className="text-yellow-400">{draft.category ?? "Varios"}</span> {aiNote}</p><div className="flex gap-2"><button type="button" onClick={() => setDraft(null)} className="flex-1 rounded-lg border border-neutral-700 py-2 text-xs text-neutral-300">Cancelar</button><button type="button" onClick={() => { if (!draft.description || !draft.startDate) return; onSave({ id: draft.id ?? crypto.randomUUID(), kind: draft.kind ?? "expense", description: draft.description, category: draft.category ?? "Varios", amount: Number(draft.amount) || 0, startDate: draft.startDate, endDate: draft.endDate, occurrences: draft.occurrences, frequency: draft.frequency ?? "monthly", nextDate: draft.nextDate ?? draft.startDate, active: true }); setDraft(null) }} className="flex-1 rounded-lg bg-yellow-400 py-2 text-xs font-bold text-black">Guardar programación</button></div>
    </div> : <button type="button" onClick={() => setDraft({ kind: "expense", frequency: "monthly", category: "Varios", startDate: new Date().toISOString().slice(0, 10) })} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 py-3 text-xs font-bold text-neutral-300"><Plus className="size-4" /> PROGRAMAR INGRESO O GASTO</button>}
    <div className="flex flex-col gap-2">{schedules.length === 0 ? <p className="py-3 text-center text-xs text-neutral-600">No hay movimientos programados.</p> : schedules.map((entry) => <div key={entry.id} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-black/20 p-2.5"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{entry.description}</p><p className="text-[10px] text-neutral-500">{entry.category} · {entry.frequency} · próximo {entry.nextDate}</p></div><strong className={entry.kind === "income" ? "text-green-400" : "text-rose-400"}>{entry.kind === "income" ? "+" : "−"}{money(entry.amount)}</strong><button type="button" onClick={() => setDraft(entry)} aria-label="Editar programación"><Pencil className="size-3 text-neutral-400" /></button><button type="button" onClick={() => onDelete(entry.id)} aria-label="Eliminar programación"><Trash2 className="size-3 text-neutral-500" /></button></div>)}</div>
  </section>
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

function TollBills({ bills, onTogglePaid }: { bills: TollBill[]; onTogglePaid: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-sky-500/30 bg-sky-950/10 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-white"><Receipt className="size-4 text-sky-400" /> FACTURAS DE PEAJES</p>
          <p className="text-[11px] text-neutral-500">Al cerrar el día se crea una factura para pagar mañana.</p>
        </div>
        <span className="text-[10px] font-bold text-sky-400">{bills.filter((bill) => bill.status === "unpaid").length} pendientes</span>
      </div>
      {bills.length === 0 ? <p className="py-2 text-center text-xs text-neutral-600">Todavía no hay facturas diarias.</p> : <div className="flex flex-col gap-2">{bills.map((bill) => <div key={bill.id} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-black/20 p-2.5"><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">Peajes del {bill.serviceDate}</p><p className="text-[10px] text-neutral-500">Vence {bill.dueDate} · {bill.status === "paid" ? "Pagada" : "Pendiente"}</p></div><strong className="text-sky-300">{money(bill.amount)}</strong><button type="button" onClick={() => onTogglePaid(bill.id)} aria-label={bill.status === "paid" ? "Marcar factura pendiente" : "Marcar factura pagada"} className={cn("rounded-lg border p-1.5", bill.status === "paid" ? "border-green-500/50 text-green-400" : "border-neutral-700 text-neutral-400")}><Check className="size-3" /></button></div>)}</div>}
    </section>
  )
}

export function RegisterScreen({
  trips,
  onEdit,
  onAdd,
  onCloseDay,
  dayClosed,
  onExport,
  onImport,
  onResetStorage,
  onApplyReconciliation,
}: {
  trips: Trip[]
  onEdit: (t: Trip) => void
  onAdd: () => void
  onCloseDay: () => void
  dayClosed: boolean
  onExport: () => void
  onImport: (file: File) => void
  onResetStorage: () => void
  // Ajusta un viaje para que su neto cuadre con el pago recibido.
  onApplyReconciliation: (t: Trip) => void
}) {
  const [filter, setFilter] = useState<Filter>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("platform")
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [tollBills, setTollBills] = useState<TollBill[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("claris_scheduled_entries")
      if (saved) setSchedules(JSON.parse(saved))
      const savedBills = localStorage.getItem("claris_toll_bills")
      if (savedBills) setTollBills(JSON.parse(savedBills))
    } catch {}
  }, [])

  function saveSchedule(entry: ScheduledEntry) {
    setSchedules((current) => {
      const next = current.some((item) => item.id === entry.id) ? current.map((item) => item.id === entry.id ? entry : item) : [entry, ...current]
      localStorage.setItem("claris_scheduled_entries", JSON.stringify(next))
      return next
    })
  }

  function deleteSchedule(id: string) {
    setSchedules((current) => {
      const next = current.filter((entry) => entry.id !== id)
      localStorage.setItem("claris_scheduled_entries", JSON.stringify(next))
      return next
    })
  }

  function closeDayAndCreateBill() {
    const serviceDate = new Date().toISOString().slice(0, 10)
    const amount = trips.reduce((sum, trip) => sum + (Number(trip.toll) || 0), 0)
    setTollBills((current) => {
      if (current.some((bill) => bill.serviceDate === serviceDate)) return current
      const next = [{ id: crypto.randomUUID(), serviceDate, dueDate: addDays(serviceDate, 1), amount, status: "unpaid" as const }, ...current]
      localStorage.setItem("claris_toll_bills", JSON.stringify(next))
      return next
    })
    onCloseDay()
  }

  function toggleBill(id: string) {
    setTollBills((current) => {
      const next = current.map((bill) => bill.id === id ? { ...bill, status: bill.status === "paid" ? "unpaid" as const : "paid" as const } : bill)
      localStorage.setItem("claris_toll_bills", JSON.stringify(next))
      return next
    })
  }

  // El filtro es la única fuente de verdad: los totales, el desglose por
  // plataforma y el panel de reconciliación se recalculan todos desde aquí, así
  // que al filtrar por PENDING todo lo que se ve son los pendientes.
  const visible = useMemo(() => {
    if (filter === "PENDING") return trips.filter((t) => t.status === "pending")
    if (filter === "MATCHED") return trips.filter((t) => t.status === "matched")
    return trips
  }, [trips, filter])

  const totals = useMemo(() => {
    const gross = visible.reduce((s, t) => s + grossOf(t), 0)
    const fee = visible.reduce((s, t) => s + t.platformFee, 0)
    return { gross, fee, net: gross - fee, pending: visible.filter((t) => t.status === "pending").length }
  }, [visible])

  // Desglose por plataforma del TOTAL GROSS (misma caja).
  const platformGroups = useMemo(() => groupByPlatform(visible), [visible])

  // Esperado vs. recibido de lo que se está viendo.
  const summary = useMemo(() => reconSummary(visible), [visible])

  // Agrupado por plataforma con subtotal, o lista plana ordenada por monto/hora.
  const grouped = sortKey === "platform"
  const flat = useMemo(() => (grouped ? [] : sortTrips(visible, sortKey)), [grouped, visible, sortKey])

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "platform", label: "PLATAFORMA" },
    { key: "amount", label: "MONTO" },
    { key: "time", label: "HORA" },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-sm font-bold tracking-widest text-neutral-400">REGISTER</h1>
        <span className="rounded-full border border-orange-400/50 px-2.5 py-1 text-[11px] font-bold text-orange-400">
          {totals.pending} pending
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Stats — el TOTAL GROSS lleva dentro su desglose por plataforma */}
        <div className="flex items-stretch gap-2">
          <GrossByPlatformCard total={totals.gross} groups={platformGroups} />
          <StatCard label="TOTAL NET" value={money(totals.net)} valueClass="text-green-400" />
          <StatCard label="COUNT PENDING" value={String(totals.pending)} valueClass="text-white" />
        </div>

        {/* Reconciliación: esperado vs. recibido y el descuadre a arreglar */}
        <ReconciliationPanel summary={summary} groups={platformGroups} />

        {/* REGISTER conserva únicamente los viajes para reconciliarlos con invoices y pagos de plataformas. */}

        {/* Filters */}
        <div className="flex gap-2">
          {(["ALL", "PENDING", "MATCHED", "LEDGER"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors",
                filter === f
                  ? "bg-yellow-400 text-black"
                  : "bg-neutral-900 text-neutral-400 hover:text-neutral-200",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Close day */}
        <button
          type="button"
          onClick={closeDayAndCreateBill}
          disabled={dayClosed}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-bold transition-colors",
            dayClosed
              ? "border-neutral-700 bg-neutral-900 text-neutral-500"
              : "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
          )}
        >
          <Lock className="size-4" />
          {dayClosed ? "DÍA CERRADO" : "CERRAR DÍA (bloquea el registro de hoy)"}
        </button>

        {/* Import / Export */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-300 transition-colors hover:border-neutral-600"
          >
            <Upload className="size-4" /> IMPORTAR JSON
          </button>
          <button
            type="button"
            onClick={onResetStorage}
            className="flex items-center justify-center gap-2 rounded-2xl border border-rose-900/60 bg-rose-950/20 px-3 py-3 text-xs font-bold text-rose-300 transition-colors hover:border-rose-700"
          >
            RESET
          </button>
          <button
            type="button"
            onClick={onExport}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-300 transition-colors hover:border-neutral-600"
          >
            <Download className="size-4" /> EXPORTAR JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImport(file)
              e.target.value = ""
            }}
          />
        </div>

        {/* Orden: por plataforma agrupa con subtotal; monto y hora son listas planas */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
            <ArrowUpDown className="size-3" /> ORDEN
          </span>
          <div className="flex flex-1 gap-1.5">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  "flex-1 rounded-lg border py-1.5 text-[10px] font-bold transition-colors",
                  sortKey === opt.key
                    ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
                    : "border-neutral-800 text-neutral-400 hover:text-neutral-200",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trip list — agrupada por plataforma con subtotal, o plana */}
        <div className="space-y-3 pt-1">
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-600">No hay viajes en esta vista.</p>
          ) : grouped ? (
            platformGroups.map((group) => (
              <PlatformGroupBlock
                key={group.platform}
                group={group}
                onEdit={onEdit}
                onApplyReconciliation={onApplyReconciliation}
              />
            ))
          ) : (
            flat.map((t) => (
              <TripCard key={t.id} trip={t} onClick={() => onEdit(t)} onApplyReconciliation={onApplyReconciliation} />
            ))
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="border-t border-neutral-800 bg-black px-4 py-3">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3.5 text-base font-extrabold text-black active:scale-[0.99]"
        >
          <Plus className="size-5" /> AGREGAR VIAJE
        </button>
      </div>
    </div>
  )
}
