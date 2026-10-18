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
import { type Trip, type TollBill, grossOf, netOf, money, tripDateOf } from "./types"
import { reconciliarCobrosAlLibro } from "./cash-flow-store"
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

type Filter = "ALL" | "PENDING" | "MATCHED" | "DIFF"

const RECON_TONE: Record<ReconState, { text: string; border: string; label: string }> = {
  pending: { text: "text-neutral-400", border: "border-neutral-700", label: "Unpaid" },
  ok: { text: "text-green-400", border: "border-green-500/40", label: "Cuadra" },
  short: { text: "text-rose-400", border: "border-rose-500/40", label: "Pagaron short" },
  over: { text: "text-sky-400", border: "border-sky-500/40", label: "Pagaron over" },
}

function signed(n: number): string {
  if (Math.abs(n) < 0.005) return money(0)
  return `${n > 0 ? "+" : "−"}${money(Math.abs(n))}`
}

function GrossByPlatformCard({ total, groups }: { total: number; groups: PlatformGroup[] }) {
  return (
    <div className="flex flex-[1.7] flex-col gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-2.5 py-3">
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">TOTAL GROSS</span>
      <span className="text-lg font-extrabold text-yellow-400">{money(total)}</span>
      {groups.length === 0 ? (
        <span className="text-[10px] text-neutral-600">No trips</span>
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

function ReconciliationPanel({ summary, groups }: { summary: ReconSummary; groups: PlatformGroup[] }) {
  const tone = Math.abs(summary.diff) < 0.005 ? RECON_TONE.ok : summary.diff < 0 ? RECON_TONE.short : RECON_TONE.over
  const withDiff = groups.filter((g) => Math.abs(g.diff) >= 0.005)
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-neutral-300">
          <Scale className="size-3.5 text-neutral-400" /> RECONCILIATION
        </p>
        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", tone.border, tone.text)}>
          {summary.problemCount === 0 ? "ALL MATCHED" : `${summary.problemCount} WITH DIFFERENCE`}
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
          {summary.pendingCount} unpaid
        </span>
        {summary.shortCount > 0 && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", RECON_TONE.short.border, RECON_TONE.short.text)}>
            {summary.shortCount} short
          </span>
        )}
        {summary.overCount > 0 && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", RECON_TONE.over.border, RECON_TONE.over.text)}>
            {summary.overCount} over
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
                title={`Esperado ${money(recon.expected)} · received ${money(recon.received ?? 0)}`}
              >
                {recon.state === "ok" ? "Cuadra" : signed(recon.diff)}
              </span>
              {recon.state !== "ok" && (
                <span
                  role="button"
                  tabIndex={0}
                  title={`Adjust earnings by ${signed(recon.diff)} to balance`}
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
            <span className="text-[9px] text-neutral-500">{group.pendingCount} unpaid</span>
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
  onApplyReconciliation: (t: Trip) => void
}) {
  const [filter, setFilter] = useState<Filter>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("platform")
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()))
  const [showDetail, setShowDetail] = useState(false)
  const [showActions, setShowActions] = useState(false)
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

  function reconciliarHaciaDinero() {
    const result = reconciliarCobrosAlLibro(trips, selectedDate)
    if (result.platforms === 0) {
      alert(`No net income on ${selectedDate} to send to MONEY.`)
      return
    }
    const msg =
      `Sent to MONEY as a projection:\n` +
      `• ${result.platforms} plataforma(s)\n` +
      `• Net total: $${result.totalNet.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
      (result.replacedPlaceholders > 0
        ? `• Replaced ${result.replacedPlaceholders} scheduled projection(s) for the day\n`
        : "") +
      `\nThe real bank balance wasn't modified.`
    alert(msg)
  }

  const tripsForDay = useMemo(() => trips.filter((t) => tripDateOf(t) === selectedDate), [trips, selectedDate])

  const visible = useMemo(() => {
    if (filter === "PENDING") return tripsForDay.filter((t) => t.status === "pending")
    if (filter === "MATCHED") return tripsForDay.filter((t) => t.status === "matched")
    if (filter === "DIFF") {
      return tripsForDay.filter((t) => {
        const state = reconStateOf(t)
        return state === "short" || state === "over"
      })
    }
    return tripsForDay
  }, [tripsForDay, filter])

  const counts = useMemo(() => {
    let pending = 0
    let matched = 0
    for (const t of tripsForDay) {
      if (t.status === "pending") pending += 1
      else if (t.status === "matched") matched += 1
    }
    return { all: tripsForDay.length, pending, matched, diff: reconSummary(tripsForDay).problemCount }
  }, [tripsForDay])

  const totals = useMemo(() => {
    const gross = visible.reduce((s, t) => s + grossOf(t), 0)
    const fee = visible.reduce((s, t) => s + t.platformFee, 0)
    const net = visible.reduce((s, t) => s + netOf(t), 0)
    return { gross, fee, net, pending: visible.filter((t) => t.status === "pending").length }
  }, [visible])

  const platformGroups = useMemo(() => groupByPlatform(visible), [visible])
  const summary = useMemo(() => reconSummary(visible), [visible])
  const grouped = sortKey === "platform"
  const flat = useMemo(() => (grouped ? [] : sortTrips(visible, sortKey)), [grouped, visible, sortKey])

  const filterChips: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "ALL", count: counts.all },
    { key: "PENDING", label: "PENDIENTES", count: counts.pending },
    { key: "MATCHED", label: "MATCHED", count: counts.matched },
    { key: "DIFF", label: "DIFERENCIA", count: counts.diff },
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-neutral-800 bg-black/95 px-4 pb-2.5 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-sm font-bold tracking-widest text-neutral-400">REGISTER</h1>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold",
                dayClosed ? "border-neutral-700 text-neutral-500" : "border-orange-400/50 text-orange-400",
              )}
            >
              {dayClosed ? "DAY CLOSED" : "DAY OPEN"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowActions(true)}
            aria-label="Register actions"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/60 text-neutral-300 transition-colors hover:border-neutral-600"
          >
            <EllipsisVertical className="size-4" />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1">
            <span className="text-[9px] font-bold tracking-wide text-neutral-500">DAY</span>
            <input
              type="date"
              aria-label="Log day"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setFilter("ALL")
              }}
              className="w-[118px] bg-transparent text-[11px] font-semibold text-neutral-200 outline-none"
            />
          </label>
          <span className="shrink-0 text-[10px] font-bold tracking-wide text-neutral-500">
            GROSS <strong className="text-sm text-yellow-400">{money(totals.gross)}</strong>
          </span>
          <span className="shrink-0 text-[10px] font-bold tracking-wide text-neutral-500">
            NET <strong className="text-sm text-green-400">{money(totals.net)}</strong>
          </span>
          <button
            type="button"
            onClick={reconciliarHaciaDinero}
            className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-emerald-300 transition-colors hover:bg-emerald-900/50"
            title="Send the day's net to MONEY as a projection (replaces scheduled)"
          >
            Reconcile → Money
          </button>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-label={showDetail ? "Hide breakdown and reconciliation" : "See breakdown and reconciliation"}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600"
          >
            {showDetail ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {showDetail && (
          <div className="space-y-2.5">
            <GrossByPlatformCard total={totals.gross} groups={platformGroups} />
            <ReconciliationPanel summary={summary} groups={platformGroups} />
          </div>
        )}

        <div className="space-y-3 pt-1">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-center text-sm text-neutral-600">
                {filter === "ALL" ? "No trips recorded yet." : "No trips in this view."}
              </p>
              {filter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setFilter("ALL")}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-xs font-bold text-neutral-300"
                >
                  See all
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

      {showActions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white">Acciones</h2>
              <button type="button" onClick={() => setShowActions(false)} className="rounded-lg p-1 text-neutral-400">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  closeDayAndCreateBill()
                  setShowActions(false)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-700 py-3 text-xs font-bold text-neutral-200"
              >
                <Lock className="size-4" />
                {dayClosed ? "DAY CLOSED" : "CLOSE DAY (locks today's log)"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-300"
                >
                  <Upload className="size-4" /> IMPORTAR JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExport()
                    setShowActions(false)
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-300"
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
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-900/60 bg-rose-950/20 py-2.5 text-xs font-bold text-rose-300"
              >
                REGISTER RESET
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

      <div className="border-t border-neutral-800 bg-black px-4 py-3">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3.5 text-base font-extrabold text-black active:scale-[0.99]"
        >
          <Plus className="size-5" /> ADD TRIP
        </button>
      </div>
    </div>
  )
}
