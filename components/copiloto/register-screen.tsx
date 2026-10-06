"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Lock,
  Plus,
  ArrowRight,
  Download,
  Upload,
  ArrowUpDown,
  Scale,
  X,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/dates"
import { type Trip, type TollBill, grossOf, netOf, money } from "./types"
import { PlatformAvatar, PlatformBadge } from "./platform-avatar"
import { isVoucherPlatform } from "./platform-meta"
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

// Filtros de la cola de trabajo. DIFERENCIA es el que de verdad importa en una
// conciliación: los viajes donde lo recibido no cuadra con lo esperado. (Antes
// había un filtro LEDGER que caía en el mismo caso que ALL y no filtraba nada.)
type Filter = "ALL" | "PENDING" | "MATCHED" | "DIFF"

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
          {/* El vale depende de la plataforma, así que la tarjeta no puede
              contradecir el distintivo del desplegable. */}
          {(trip.isVoucher || isVoucherPlatform(trip.platform)) && (
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

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return localDateKey(next)
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
  const [showDetail, setShowDetail] = useState(false)
  const [showActions, setShowActions] = useState(false)
  // Las facturas de peaje se crean al cerrar el día; el seguimiento y el pago
  // viven en FINANCE, que lee la misma clave. Aquí solo se crean.
  const [tollBills, setTollBills] = useState<TollBill[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const savedBills = localStorage.getItem("claris_toll_bills")
      if (savedBills) setTollBills(JSON.parse(savedBills))
    } catch {}
  }, [])

  function closeDayAndCreateBill() {
    const serviceDate = localDateKey(new Date())
    const amount = trips.reduce((sum, trip) => sum + (Number(trip.toll) || 0), 0)
    setTollBills((current) => {
      if (current.some((bill) => bill.serviceDate === serviceDate)) return current
      const next = [{ id: crypto.randomUUID(), serviceDate, dueDate: addDays(serviceDate, 1), amount, status: "unpaid" as const }, ...current]
      localStorage.setItem("claris_toll_bills", JSON.stringify(next))
      return next
    })
    onCloseDay()
  }

  // El filtro es la única fuente de verdad: los totales, el desglose por
  // plataforma y el panel de reconciliación se recalculan todos desde aquí, así
  // que al filtrar por PENDIENTES todo lo que se ve son los pendientes.
  // DIFERENCIA es la cola real de la conciliación: lo recibido no cuadra.
  const visible = useMemo(() => {
    if (filter === "PENDING") return trips.filter((t) => t.status === "pending")
    if (filter === "MATCHED") return trips.filter((t) => t.status === "matched")
    if (filter === "DIFF") {
      return trips.filter((t) => {
        const state = reconStateOf(t)
        return state === "short" || state === "over"
      })
    }
    return trips
  }, [trips, filter])

  // Conteo por filtro: los chips del encabezado dicen cuánto hay en cada cola
  // sin tener que entrar a mirarla.
  const counts = useMemo(() => {
    let pending = 0
    let matched = 0
    for (const t of trips) {
      if (t.status === "pending") pending += 1
      else if (t.status === "matched") matched += 1
    }
    return { all: trips.length, pending, matched, diff: reconSummary(trips).problemCount }
  }, [trips])

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

  const filterChips: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "TODOS", count: counts.all },
    { key: "PENDING", label: "PENDIENTES", count: counts.pending },
    { key: "MATCHED", label: "PAGADOS", count: counts.matched },
    { key: "DIFF", label: "DIFERENCIA", count: counts.diff },
  ]

  return (
    <div className="screen-frame">
      {/* Encabezado fijo: se queda arriba mientras se baja por la lista, así el
          bruto, el neto y las colas pendientes nunca se pierden de vista. */}
      <header className="shrink-0 border-b border-neutral-800 bg-black/95 px-4 pb-2.5 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-white">Cobros</h1>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold",
                dayClosed ? "border-neutral-700 text-neutral-500" : "border-orange-400/50 text-orange-400",
              )}
            >
              {dayClosed ? "DÍA CERRADO" : "DÍA ABIERTO"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowActions(true)}
            aria-label="Acciones del registro"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/60 text-neutral-300 transition-colors hover:border-neutral-600"
          >
            <EllipsisVertical className="size-4" />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-[10px] font-bold tracking-wide text-neutral-500">
            BRUTO <strong className="tabular-nums text-sm text-yellow-400">{money(totals.gross)}</strong>
          </span>
          <span className="shrink-0 text-[10px] font-bold tracking-wide text-neutral-500">
            NETO <strong className="tabular-nums text-sm text-green-400">{money(totals.net)}</strong>
          </span>
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
              filter === "PENDING" ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400" : "border-orange-400/50 text-orange-400",
            )}
          >
            {counts.pending} PENDIENTES
          </button>
          <button
            type="button"
            onClick={() => setFilter("DIFF")}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
              counts.diff === 0
                ? "border-green-500/40 text-green-400"
                : filter === "DIFF"
                  ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
                  : "border-rose-500/50 text-rose-400",
            )}
          >
            {counts.diff === 0 ? "TODO CUADRA" : `${counts.diff} CON DIFERENCIA`}
          </button>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-label={showDetail ? "Ocultar desglose y reconciliación" : "Ver desglose y reconciliación"}
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600"
          >
            {showDetail ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="screen-scroll space-y-2.5 px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Filtros con su conteo. Ocupan la fila completa para que se vean los
            cuatro: el ORDEN vive en la hoja de acciones (no se usa a cada rato)
            y así ningún filtro queda cortado. */}
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                filter === chip.key ? "bg-yellow-400 text-black" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200",
              )}
            >
              {chip.label} {chip.count}
            </button>
          ))}
        </div>

        {/* Detalle plegado: desglose por plataforma y panel de conciliación.
            Cerrado, la información crítica sigue en los chips del encabezado. */}
        {showDetail && (
          <div className="space-y-2.5">
            <GrossByPlatformCard total={totals.gross} groups={platformGroups} />
            <ReconciliationPanel summary={summary} groups={platformGroups} />
          </div>
        )}

        {/* Trip list — agrupada por plataforma con subtotal, o plana */}
        <div className="space-y-3 pt-1">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-center text-sm text-neutral-600">
                {filter === "ALL" ? "Todavía no hay viajes registrados." : "No hay viajes en esta vista."}
              </p>
              {filter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setFilter("ALL")}
                  className="rounded-xl border border-neutral-700 px-3 py-1.5 text-[11px] font-bold text-neutral-300 transition-colors hover:border-neutral-500"
                >
                  VER TODOS LOS VIAJES
                </button>
              )}
            </div>
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

      {/* Hoja de ACCIONES: cerrar día, importar, exportar y reset. Son cosas de
          una vez al día o de vez en cuando, así que no ocupan la pantalla. */}
      {showActions && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => setShowActions(false)}
          role="presentation"
        >
          <div
            className="w-full rounded-t-3xl border-t border-neutral-800 bg-neutral-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold tracking-wide text-neutral-300">ACCIONES DEL REGISTRO</p>
              <button
                type="button"
                onClick={() => setShowActions(false)}
                aria-label="Cerrar acciones"
                className="flex size-7 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {/* Orden de la lista: por plataforma agrupa con subtotal; monto y
                  hora son listas planas. */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-400">
                  <ArrowUpDown className="size-3" /> ORDEN DE LA LISTA
                </p>
                <div className="flex gap-1.5">
                  {sortOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSortKey(option.key)}
                      className={cn(
                        "flex-1 rounded-xl border py-2 text-[10px] font-bold transition-colors",
                        sortKey === option.key
                          ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
                          : "border-neutral-800 text-neutral-400 hover:text-neutral-200",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeDayAndCreateBill()
                  setShowActions(false)
                }}
                disabled={dayClosed}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-colors",
                  dayClosed
                    ? "border-neutral-800 bg-neutral-900 text-neutral-500"
                    : "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
                )}
              >
                <Lock className="size-4" />
                {dayClosed ? "DÍA CERRADO" : "CERRAR DÍA (bloquea el registro de hoy)"}
              </button>

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
                  onClick={() => {
                    onExport()
                    setShowActions(false)
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-300 transition-colors hover:border-neutral-600"
                >
                  <Download className="size-4" /> EXPORTAR JSON
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onResetStorage()
                  setShowActions(false)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-900/60 bg-rose-950/20 py-2.5 text-xs font-bold text-rose-300 transition-colors hover:border-rose-700"
              >
                RESET DEL REGISTRO
              </button>
            </div>

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
        </div>
      )}

      {/* Add button */}
      <div className="shrink-0 border-t border-neutral-800 bg-black px-4 py-3">
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
