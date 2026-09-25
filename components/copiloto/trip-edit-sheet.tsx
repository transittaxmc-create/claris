"use client"

import { useEffect, useState } from "react"
import { X, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Trip, type TripStatus } from "./types"

function Num({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold tracking-wide text-neutral-400">{label}</span>
      <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2">
        <span className="mr-1 text-xs text-neutral-500">$</span>
        <input
  type="number"
  inputMode="decimal"
  step="0.01"
  value={value === 0 ? "" : String(value)}
          onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-neutral-600"
        />
      </div>
    </label>
  )
}

export function TripEditSheet({
  trip,
  onClose,
  onSave,
  onDelete,
}: {
  trip: Trip | null
  onClose: () => void
  onSave: (t: Trip) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<Trip | null>(trip)

  useEffect(() => setDraft(trip), [trip])

  if (!trip || !draft) return null

  const set = <K extends keyof Trip>(key: K, val: Trip[K]) =>
    setDraft((d) => (d ? { ...d, [key]: val } : d))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[90%] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border-t border-neutral-800 bg-neutral-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-base font-bold text-white">Editar viaje</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Platform */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">PLATAFORMA</span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("platform", p as Platform)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    p === draft.platform
                      ? "border-yellow-400 bg-yellow-400/15 text-yellow-400"
                      : "border-neutral-700 text-neutral-300",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Voucher + status */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set("isVoucher", !draft.isVoucher)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-bold",
                draft.isVoucher
                  ? "border-orange-400 bg-orange-400/15 text-orange-400"
                  : "border-neutral-700 text-neutral-400",
              )}
            >
              {draft.isVoucher ? "VOUCHER ✓" : "VOUCHER"}
            </button>
            {(["pending", "matched"] as TripStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase",
                  draft.status === s
                    ? s === "pending"
                      ? "border-orange-400 bg-orange-400/15 text-orange-400"
                      : "border-green-400 bg-green-400/15 text-green-400"
                    : "border-neutral-700 text-neutral-400",
                )}
              >
                {s === "pending" ? "Pendiente" : "Matched"}
              </button>
            ))}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <Num label="EARNINGS" value={draft.earnings} onChange={(n) => set("earnings", n)} />
            <Num label="EXTRA CASH" value={draft.extraCash} onChange={(n) => set("extraCash", n)} />
            <Num label="TIPS" value={draft.tips} onChange={(n) => set("tips", n)} />
            <Num label="TOLL" value={draft.toll} onChange={(n) => set("toll", n)} />
            <Num label="PLATFORM FEE" value={draft.platformFee} onChange={(n) => set("platformFee", n)} />
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wide text-neutral-400">HORA</span>
              <input
                value={draft.time}
                onChange={(e) => set("time", e.target.value)}
                placeholder="14:46"
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm font-semibold text-white outline-none placeholder:text-neutral-600"
              />
            </label>
          </div>

          {/* Locations */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">PICKUP</span>
            <input
              value={draft.pickup}
              onChange={(e) => set("pickup", e.target.value)}
              placeholder="Dirección de recogida"
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">DROPOFF</span>
            <input
              value={draft.dropoff}
              onChange={(e) => set("dropoff", e.target.value)}
              placeholder="Dirección de entrega"
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">REF / INVOICE</span>
            <input
              value={draft.ref}
              onChange={(e) => set("ref", e.target.value)}
              placeholder="Reference"
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </label>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 border-t border-neutral-800 px-4 py-3">
          <button
            type="button"
            onClick={() => onDelete(draft.id)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3 text-sm font-extrabold text-black active:scale-[0.99]"
          >
            GUARDAR CAMBIOS
          </button>
        </div>
      </div>
    </div>
  )
}
