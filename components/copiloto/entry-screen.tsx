"use client"

import { useEffect, useState } from "react"
import { ChevronDown, MapPin, Coffee, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Trip, type LocationPoint, newTrip } from "./types"
import { captureLocation } from "./geo"

function MoneyField({
  label,
  color,
  value,
  onChange,
}: {
  label: string
  color: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={cn("text-[11px] font-bold tracking-wide", color)}>{label}</span>
      <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 focus-within:border-neutral-600">
        <span className="mr-1 text-sm text-neutral-500">$</span>
        <input
          inputMode="decimal"
          value={value === 0 ? "" : String(value)}
          onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="w-full bg-transparent text-base font-semibold text-white outline-none placeholder:text-neutral-600"
        />
      </div>
    </label>
  )
}

function LocationColumn({
  label,
  accent,
  loc,
  value,
  busy,
  disabled,
  onCapture,
  onManual,
  onClear,
}: {
  label: string
  accent: "green" | "sky"
  loc?: LocationPoint
  value: string
  busy: boolean
  disabled: boolean
  onCapture: () => void
  onManual: (value: string) => void
  onClear: () => void
}) {
  const border = accent === "green" ? "border-green-900/50" : "border-sky-900/50"
  const button = accent === "green" ? "bg-green-500" : "bg-sky-400"

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-neutral-400">{label}</span>
        <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">GPS</span>
      </div>
      {loc ? (
        <div className={cn("relative min-h-[104px] rounded-lg border bg-green-950/30 p-2", border)}>
          <button
            type="button"
            aria-label={`Borrar ${label.toLowerCase()}`}
            onClick={onClear}
            className="absolute right-1 top-1 rounded p-1 text-neutral-500 hover:text-white"
          >
            <X className="size-3" />
          </button>
          <div className="pr-4 text-[11px] leading-4 text-neutral-300">
            <div className="font-bold text-white">{loc.icon} {loc.categoryLabel}</div>
            {loc.businessName && <div className="truncate text-green-300">{loc.businessName}</div>}
            <div className="mt-0.5 line-clamp-2 text-neutral-400">{loc.address || value}</div>
            <div className="mt-1 text-[10px] text-neutral-500">{loc.time} · {loc.day}</div>
          </div>
        </div>
      ) : (
        <input
          value={value}
          onChange={(e) => onManual(e.target.value)}
          placeholder={`Toca ${label.toLowerCase()}`}
          className={cn("rounded-lg border bg-neutral-950/60 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-500", border)}
        />
      )}
      <button
        type="button"
        onClick={onCapture}
        disabled={disabled}
        className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold text-black active:scale-[0.98] disabled:cursor-wait disabled:opacity-60", button)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
        {busy ? "BUSCANDO..." : `${label} NOW`}
      </button>
    </div>
  )
}

export function EntryScreen({
  onSave,
}: {
  onSave: (t: Trip) => void
}) {
  const [draft, setDraft] = useState<Trip>(() => newTrip())
  const [platformOpen, setPlatformOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [capturing, setCapturing] = useState<null | "pickup" | "dropoff">(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  const set = <K extends keyof Trip>(key: K, val: Trip[K]) =>
    setDraft((d) => ({ ...d, [key]: val }))

  async function capture(which: "pickup" | "dropoff") {
    setGeoError(null)
    setCapturing(which)
    try {
      const loc = await captureLocation()
      setDraft((d) => ({
        ...d,
        [which]: loc.address,
        [which === "pickup" ? "pickupLoc" : "dropoffLoc"]: loc,
      }))
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "No se pudo obtener el GPS")
    } finally {
      setCapturing(null)
    }
  }

  function clearLoc(which: "pickup" | "dropoff") {
    setDraft((d) => ({
      ...d,
      [which]: "",
      [which === "pickup" ? "pickupLoc" : "dropoffLoc"]: undefined,
    }))
  }

  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const updateNow = () => setNow(new Date())
    updateNow()
    const timer = window.setInterval(updateNow, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const greeting = now
    ? now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening"
    : "Good morning"

  function handleSave() {
    onSave({ ...draft })
    setDraft(newTrip())
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{greeting}</h1>
          <p className="text-xs text-neutral-500" suppressHydrationWarning>
            {now
              ? `${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
              : "—"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-400">
          <span className="size-1.5 rounded-full bg-green-400" />
          GPS · 3rd Ave · ±14m
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Platform + break */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setPlatformOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5"
            >
              <span className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black">
                  {draft.platform.slice(0, 1)}
                </span>
                <span className="font-semibold text-white">{draft.platform}</span>
              </span>
              <ChevronDown className="size-4 text-neutral-500" />
            </button>
            {platformOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      set("platform", p as Platform)
                      setPlatformOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-2.5 text-left text-sm hover:bg-neutral-800",
                      p === draft.platform ? "text-yellow-400" : "text-neutral-200",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOnBreak((b) => !b)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors",
              onBreak
                ? "border-orange-400 bg-orange-400/15 text-orange-400"
                : "border-neutral-700 bg-neutral-900 text-neutral-300",
            )}
          >
            <Coffee className="size-4" />
            {onBreak ? "ON BREAK" : "BREAK/LUNCH"}
          </button>
        </div>

        {/* Earnings / Extra cash */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="flex gap-3">
            <MoneyField
              label="EARNINGS"
              color="text-blue-400"
              value={draft.earnings}
              onChange={(n) => set("earnings", n)}
            />
            <MoneyField
              label="EXTRA CASH"
              color="text-green-400"
              value={draft.extraCash}
              onChange={(n) => set("extraCash", n)}
            />
          </div>
        </section>

        {/* Pickup / Dropoff */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <LocationColumn
              label="PICKUP"
              accent="green"
              loc={draft.pickupLoc}
              value={draft.pickup}
              busy={capturing === "pickup"}
              disabled={capturing !== null}
              onCapture={() => capture("pickup")}
              onManual={(v) => set("pickup", v)}
              onClear={() => clearLoc("pickup")}
            />
            <LocationColumn
              label="DROPOFF"
              accent="sky"
              loc={draft.dropoffLoc}
              value={draft.dropoff}
              busy={capturing === "dropoff"}
              disabled={capturing !== null}
              onCapture={() => capture("dropoff")}
              onManual={(v) => set("dropoff", v)}
              onClear={() => clearLoc("dropoff")}
            />
          </div>
          {geoError && (
            <p className="mt-2 text-center text-[11px] font-semibold text-rose-400">{geoError}</p>
          )}
        </section>

        {/* Tips / Toll / Platform fee */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="flex gap-2">
            <MoneyField
              label="TIPS"
              color="text-yellow-400"
              value={draft.tips}
              onChange={(n) => set("tips", n)}
            />
            <MoneyField
              label="TOLLS"
              color="text-amber-400"
              value={draft.toll}
              onChange={(n) => set("toll", n)}
            />
            <MoneyField
              label="FEE"
              color="text-rose-400"
              value={draft.platformFee}
              onChange={(n) => set("platformFee", n)}
            />
          </div>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">REF / INVOICE</span>
            <input
              value={draft.ref}
              onChange={(e) => set("ref", e.target.value)}
              placeholder="Reference"
              className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600"
            />
          </label>
        </section>

      </div>

      {/* Sticky record button */}
      <div className="border-t border-neutral-800 bg-black px-4 py-3">
        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3.5 text-base font-extrabold tracking-wide text-black active:scale-[0.99]"
        >
          + GRABAR EN DISCO
        </button>
      </div>
    </div>
  )
}
