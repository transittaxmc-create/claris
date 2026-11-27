"use client"

import { useEffect, useState } from "react"
import { X, Trash2, Scale, CircleCheck, TrendingDown, TrendingUp, Clock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, tripDateInputValue, type Platform, type Reconciliation, type Trip, type TripOutcome, type TripStatus, money, netOf } from "./types"
import { MoneyInput } from "./money-input"
import { SelectorLogo } from "./selector-logo"
import { PlatformBadge } from "./platform-avatar"
import { isVoucherPlatform } from "./platform-meta"
import { diffOf, expectedOf, receivedOf, reconStateOf, applyDifferenceToTrip, round2, type ReconState } from "./reconciliation"

// Tono por estado, con el mismo criterio que en REGISTER para no confundir.
const TONE: Record<ReconState, { text: string; border: string; bg: string; label: string }> = {
  pending: { text: "text-neutral-400", border: "border-neutral-700", bg: "bg-neutral-900/60", label: "Record the payment" },
  ok: { text: "text-green-400", border: "border-green-500/40", bg: "bg-green-500/10", label: "Payment balances" },
  short: { text: "text-rose-400", border: "border-rose-500/40", bg: "bg-rose-500/10", label: "Pagaron short" },
  over: { text: "text-sky-400", border: "border-sky-500/40", bg: "bg-sky-500/10", label: "Pagaron over" },
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
  const [platformOpen, setPlatformOpen] = useState(false)

  useEffect(() => setDraft(trip), [trip])

  if (!trip || !draft) return null

  const set = <K extends keyof Trip>(key: K, val: Trip[K]) =>
    setDraft((d) => (d ? { ...d, [key]: val } : d))

  const setDate = (date: string) =>
    setDraft((d) => {
      if (!d || !date) return d
      const time = d.time || "12:00"
      return { ...d, raw: { ...(d.raw ?? {}), datetime: `${date}T${time}:00` } }
    })

  const setRecon = (patch: Partial<Reconciliation>) =>
    setDraft((d) => (d ? { ...d, reconciliation: { ...(d.reconciliation ?? {}), ...patch } } : d))

  // Trabajo que no se hizo (Miguel, 2026-11-24): NO SHOW cierra el
  // trabajo en $5 (reemplaza la tarifa; los $5 cuentan como ganado y
  // siguen editables después) y CANCELED lo cierra en $0 sin borrarlo
  // — queda de récord. Tocar la marca activa la quita y el viaje
  // vuelve a normal (el monto se vuelve a escribir a mano, como
  // siempre). Nada más cambia: el guardado es el de siempre y el
  // cobro del día se actualiza solo con el monto nuevo.
  const toggleOutcome = (o: TripOutcome) =>
    setDraft((d) => {
      if (!d) return d
      if (d.outcome === o) return { ...d, outcome: undefined }
      if (o === "noshow") return { ...d, outcome: o, earnings: 5, extraCash: 0, tips: 0, toll: 0, platformFee: 0 }
      return { ...d, outcome: o, earnings: 0, extraCash: 0, tips: 0, toll: 0, platformFee: 0 }
    })

  const receivedLabel = (() => {
    if (!draft.createdAt) return null
    const dt = new Date(draft.createdAt)
    if (Number.isNaN(dt.getTime())) return null
    return dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
  })()

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
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[90%] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border-t border-neutral-800 bg-neutral-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-base font-bold text-white">Edit trip</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Platform — IGUAL que en TODAY (Miguel, 2026-11-24): la
              misma caja con el logo 56×30 + nombre que abre la misma
              lista de filas (logo 56×30 + nombre + badge). La caja
              muestra la plataforma del viaje que se edita; al elegir
              una se marca amarilla en la lista y se cierra. Solo cambia
              lo visual: la lógica (platform + isVoucher) es la misma
              de antes. La lista se abre dentro de la hoja, no flotando,
              para que no se salga de Edit trip. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">PLATAFORMA</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPlatformOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={platformOpen}
                className="flex h-12 w-full items-center justify-between gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <SelectorLogo platform={draft.platform} width={56} height={30} />
                  <span className="truncate text-xs font-semibold text-white">{draft.platform}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-neutral-500" />
              </button>
              {platformOpen && (
                <div
                  role="listbox"
                  className="mt-1.5 max-h-[280px] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="option"
                      aria-selected={p === draft.platform}
                      onClick={() => {
                        // Mantiene isVoucher en sintonía con la plataforma elegida.
                        setDraft((d) => (d ? { ...d, platform: p as Platform, isVoucher: isVoucherPlatform(p as Platform) } : d))
                        setPlatformOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-neutral-800",
                        p === draft.platform ? "text-yellow-400" : "text-neutral-200",
                      )}
                    >
                      <SelectorLogo platform={p as Platform} width={56} height={30} />
                      <span className="min-w-0 flex-1 truncate">{p}</span>
                      <PlatformBadge platform={p as Platform} />
                    </button>
                  ))}
                </div>
              )}
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
                {s === "pending" ? "Pending" : "Matched"}
              </button>
            ))}
          </div>

          {/* Trabajo no realizado: NO SHOW ($5) / CANCELED ($0, récord) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">TRIP DIDN'T HAPPEN?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleOutcome("noshow")}
                aria-pressed={draft.outcome === "noshow"}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-bold",
                  draft.outcome === "noshow"
                    ? "border-rose-400 bg-rose-400/15 text-rose-400"
                    : "border-neutral-700 text-neutral-400",
                )}
              >
                {draft.outcome === "noshow" ? "NO SHOW ✓" : "NO SHOW"}
              </button>
              <button
                type="button"
                onClick={() => toggleOutcome("canceled")}
                aria-pressed={draft.outcome === "canceled"}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-bold",
                  draft.outcome === "canceled"
                    ? "border-neutral-300 bg-neutral-300/15 text-neutral-200"
                    : "border-neutral-700 text-neutral-400",
                )}
              >
                {draft.outcome === "canceled" ? "CANCELED ✓" : "CANCELED"}
              </button>
            </div>
            {draft.outcome === "noshow" && (
              <p className="text-[10px] leading-tight text-neutral-500">
                Closed at $5. The amount stays editable if the no-show fee is ever different.
              </p>
            )}
            {draft.outcome === "canceled" && (
              <p className="text-[10px] leading-tight text-neutral-500">
                Closed at $0. The trip stays on the record — it is not deleted.
              </p>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput size="sm" label="FARE" color="text-green-400" value={draft.earnings} onChange={(n) => set("earnings", n)} />
            <MoneyInput size="sm" label="EXTRA CASH" color="text-green-400" value={draft.extraCash} onChange={(n) => set("extraCash", n)} />
            <MoneyInput size="sm" label="TIPS" color="text-green-400" value={draft.tips} onChange={(n) => set("tips", n)} />
            <MoneyInput size="sm" label="TOLL" color="text-amber-400" value={draft.toll} onChange={(n) => set("toll", n)} />
            <MoneyInput
              size="sm"
              label="PLATFORM FEE"
              color="text-red-500"
              value={draft.platformFee}
              onChange={(n) => set("platformFee", n)}
            />
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wide text-neutral-400">HOUR</span>
              <input
                value={draft.time}
                onChange={(e) => {
                  const time = e.target.value
                  setDraft((d) => (d ? { ...d, time, raw: { ...(d.raw ?? {}), datetime: `${tripDateInputValue(d)}T${time || "12:00"}:00` } } : d))
                }}
                placeholder="14:46"
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm font-semibold text-white outline-none placeholder:text-neutral-600"
              />
              <input
                type="date"
                aria-label="Transaction date"
                value={tripDateInputValue(draft)}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-white outline-none"
              />
            </label>
          </div>

          {/* Notes — E-ZPass deja aquí el desglose de peajes */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">NOTES</span>
            <textarea
              value={draft.notes || ""}
              onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
              rows={2}
              placeholder="Toll breakdown…"
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </label>

          {/* Reconciliación: qué se esperaba cobrar contra qué llegó de verdad */}
          <section className={cn("rounded-2xl border p-3", tone.border, tone.bg)}>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-300">
                <Scale className="size-3.5" /> RECONCILIATION
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
              Net calculated by the app: <span className="font-bold text-neutral-300">{money(computedNet)}</span>
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
                label="RECEIVED"
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
              placeholder="Mismatch note (optional)"
              className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-xs text-white outline-none placeholder:text-neutral-600"
            />

            {/* Un toque: mueve la diferencia a EARNINGS para que cuadre */}
            {state !== "ok" && state !== "pending" && (
              <button
                type="button"
                onClick={() => setDraft((d) => (d ? applyDifferenceToTrip(d) : d))}
                className="mt-2 w-full rounded-xl border border-yellow-400/60 bg-yellow-400/10 py-2.5 text-xs font-bold text-yellow-400"
              >
                ADJUST EARNINGS BY {signedMoney(diff)} TO BALANCE
              </button>
            )}

            {received == null && (
              <p className="mt-2 text-[10px] leading-tight text-neutral-500">
                Enter the amount the platform deposited to see if there's a difference.
              </p>
            )}

            {received != null && (
              <button
                type="button"
                onClick={() => setRecon({ received: undefined, expected: undefined })}
                className="mt-2 w-full rounded-xl border border-neutral-700 py-2 text-[10px] font-bold text-neutral-400"
              >
                CLEAR RECONCILIATION
              </button>
            )}
          </section>


          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">PICKUP</span>
            <input
              value={draft.pickup}
              onChange={(e) => set("pickup", e.target.value)}
              placeholder="Pickup address"
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wide text-neutral-400">DROPOFF</span>
            <input
              value={draft.dropoff}
              onChange={(e) => set("dropoff", e.target.value)}
              placeholder="Drop-off address"
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

          {/* Estampe: cuándo subió/recibió este trabajo (solo si el
              viaje lo trae; a los viejos no se les inventa). */}
          {receivedLabel && (
            <p className="text-[10px] text-neutral-500">
              Received: <span className="font-semibold text-neutral-400">{receivedLabel}</span>
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex gap-3 border-t border-neutral-800 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this trip? This can't be undone.")) onDelete(draft.id)
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3 text-sm font-extrabold text-black active:scale-[0.99]"
          >
            SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  )
}
