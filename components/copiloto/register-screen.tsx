"use client"

import { useMemo, useRef, useState } from "react"
import { Lock, Plus, ArrowRight, Download, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { type Trip, grossOf, netOf, money } from "./types"

type Filter = "ALL" | "PENDING" | "MATCHED" | "LEDGER"

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

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
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
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white text-[9px] font-bold text-black">
            {trip.platform.slice(0, 1)}
          </span>
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
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
            trip.status === "pending"
              ? "border-orange-400/60 text-orange-400"
              : "border-green-400/60 text-green-400",
          )}
        >
          {trip.status === "pending" ? "Pendiente" : "Matched"}
        </span>
      </div>
    </button>
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
}: {
  trips: Trip[]
  onEdit: (t: Trip) => void
  onAdd: () => void
  onCloseDay: () => void
  dayClosed: boolean
  onExport: () => void
  onImport: (file: File) => void
  onResetStorage: () => void
}) {
  const [filter, setFilter] = useState<Filter>("ALL")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totals = useMemo(() => {
    const gross = trips.reduce((s, t) => s + grossOf(t), 0)
    const fee = trips.reduce((s, t) => s + t.platformFee, 0)
    const net = gross - fee
    const pending = trips.filter((t) => t.status === "pending").length
    return { gross, fee, net, pending }
  }, [trips])

  const visible = useMemo(() => {
    if (filter === "PENDING") return trips.filter((t) => t.status === "pending")
    if (filter === "MATCHED") return trips.filter((t) => t.status === "matched")
    return trips
  }, [trips, filter])

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
        {/* Stats */}
        <div className="flex gap-2">
          <StatCard label="TOTAL GROSS" value={money(totals.gross)} valueClass="text-yellow-400" />
          <StatCard label="TOTAL NET" value={money(totals.net)} valueClass="text-green-400" />
          <StatCard label="COUNT PENDING" value={String(totals.pending)} valueClass="text-white" />
        </div>

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
          onClick={onCloseDay}
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

        {/* Trip list */}
        <div className="space-y-3 pt-1">
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-600">No hay viajes en esta vista.</p>
          ) : (
            visible.map((t) => <TripCard key={t.id} trip={t} onClick={() => onEdit(t)} />)
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
