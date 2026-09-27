"use client"

import { useEffect, useState } from "react"
import { X, Trash2, Scale, CircleCheck, TrendingDown, TrendingUp, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Reconciliation, type Trip, type TripStatus, money, netOf } from "./types"
import { MoneyInput } from "./money-input"
import { diffOf, expectedOf, receivedOf, reconStateOf, applyDifferenceToTrip, round2, type ReconState } from "./reconciliation"

// Tono por estado, con el mismo criterio que en REGISTER para no confundir.
const TONE: Record<ReconState, { text: string; border: string; bg: string; label: string }> = {
  pending: { text: "text-neutral-400", border: "border-neutral-700", bg: "bg-neutral-900/60", label: "Falta registrar el pago" },
  ok: { text: "text-green-400", border: "border-green-500/40", bg: "bg-green-500/10", label: "El pago cuadra" },
  short: { text: "text-rose-400", border: "border-rose-500/40", bg: "bg-rose-500/10", label: "Pagaron de menos" },
  over: { text: "text-sky-400", border: "border-sky-500/40", bg: "bg-sky-500/10", label: "Pagaron de más" },
}

function signedMoney(n: number): string {
  if (Math.abs(n) < 0.005) return money(0)
  return `${n > 0 ? "+" : "−"}${money(Math.abs(n))}`
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

  const setRecon = (patch: Partial<Reconciliation>) =>
    setDraft((d) => (d ? { ...d, reconciliation: { ...(d.reconciliation ?? {}), ...patch } } : d))

  // Se calcula sobre el borrador para que la diferencia reaccione mientras se
  // escriben los montos, antes de guardar.
  const expected = expectedOf(draft)
  const received = receivedOf(draft)
  const state = reconStateOf(draft)
  const diff = diffOf(draft)
  const tone = TONE[state]
  const computedNet = round2(netOf(draft))
  // El esperado de la app solo se muestra aparte si se sobreescribió a mano.
  const overrideActive =
    typeof draft.reconciliation?.expected === "number" && Math.abs(expected - computedNet) >= 0.005

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
            <MoneyInput size="sm" label="EARNINGS" value={draft.earnings} onChange={(n) => set("earnings", n)} />
            <MoneyInput size="sm" label="EXTRA CASH" value={draft.extraCash} onChange={(n) => set("extraCash", n)} />
            <MoneyInput size="sm" label="TIPS" value={draft.tips} onChange={(n) => set("tips", n)} />
            <MoneyInput size="sm" label="TOLL" value={draft.toll} onChange={(n) => set("toll", n)} />
            <MoneyInput
              size="sm"
              label="PLATFORM FEE"
              value={draft.platformFee}
              onChange={(n) => set("platformFee", n)}
            />
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

          {/* Reconciliación: qué se esperaba cobrar contra qué llegó de verdad */}
          <section className={cn("rounded-2xl border p-3", tone.border, tone.bg)}>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-300">
                <Scale className="size-3.5" /> RECONCILIACIÓN
              </p>
              <span className={cn("flex items-center gap-1 text-[10px] font-bold", tone.text)}>
                {state === "ok" ? (
                  <CircleCheck className="size-3.5" />
                ) : state === "short" ? (
                  <TrendingDown className="size-3.5" />
                ) : state === "over" ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <Clock className="size-3.5" />
                )}
                {tone.label}
              </span>
            </div>

            <p className="mb-2 text-[10px] leading-tight text-neutral-500">
              Neto calculado por la app: <span className="font-bold text-neutral-300">{money(computedNet)}</span>
              {overrideActive && <span className="text-yellow-400"> · esperado fijado a mano: {money(expected)}</span>}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <MoneyInput
                size="sm"
                label="ESPERADO"
                value={expected}
                onChange={(n) => setRecon({ expected: round2(n) })}
              />
              <MoneyInput
                size="sm"
                label="RECIBIDO"
                value={received ?? 0}
                onChange={(n) => setRecon({ received: round2(n), reconciledAt: new Date().toISOString() })}
              />
            </div>

            <div className="mt-2 flex items-center justify-between rounded-xl border border-neutral-800 bg-black/30 px-3 py-2">
              <span className="text-[10px] font-bold tracking-wide text-neutral-400">DIFERENCIA</span>
              <span className={cn("text-base font-extrabold", tone.text)}>{signedMoney(diff)}</span>
            </div>

            <input
              value={draft.reconciliation?.note ?? ""}
              onChange={(e) => setRecon({ note: e.target.value })}
              placeholder="Nota del descuadre (opcional)"
              className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-xs text-white outline-none placeholder:text-neutral-600"
            />

            {/* Un toque: mueve la diferencia a EARNINGS para que cuadre */}
            {state !== "ok" && state !== "pending" && (
              <button
                type="button"
                onClick={() => setDraft((d) => (d ? applyDifferenceToTrip(d) : d))}
                className="mt-2 w-full rounded-xl border border-yellow-400/60 bg-yellow-400/10 py-2.5 text-xs font-bold text-yellow-400"
              >
                AJUSTAR EARNINGS EN {signedMoney(diff)} PARA QUE CUADRE
              </button>
            )}

            {received == null && (
              <p className="mt-2 text-[10px] leading-tight text-neutral-500">
                Escribe el monto que depositó la plataforma para ver si hay diferencia.
              </p>
            )}

            {received != null && (
              <button
                type="button"
                onClick={() => setRecon({ received: undefined, expected: undefined })}
                className="mt-2 w-full rounded-xl border border-neutral-700 py-2 text-[10px] font-bold text-neutral-400"
              >
                LIMPIAR RECONCILIACIÓN
              </button>
            )}
          </section>


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
