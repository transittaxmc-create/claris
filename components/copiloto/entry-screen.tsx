"use client"

import { useMemo, useState } from "react"
import { ChevronDown, MapPin, Pencil, Coffee } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Trip, newTrip, money } from "./types"

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

export function EntryScreen({
  onSave,
}: {
  onSave: (t: Trip) => void
}) {
  const [draft, setDraft] = useState<Trip>(() => newTrip())
  const [platformOpen, setPlatformOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)

  const set = <K extends keyof Trip>(key: K, val: Trip[K]) =>
    setDraft((d) => ({ ...d, [key]: val }))

  const gross = useMemo(
    () => draft.earnings + draft.extraCash + draft.tips + draft.toll,
    [draft],
  )
  const net = useMemo(() => gross - draft.platformFee, [gross, draft.platformFee])

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening"

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
          <p className="text-xs text-neutral-500">
            {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
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
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wide text-neutral-400">PICKUP</span>
                <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                  GPS
                </span>
              </div>
              <input
                value={draft.pickup}
                onChange={(e) => set("pickup", e.target.value)}
                placeholder="Toca pickup"
                className="rounded-lg border border-green-900/40 bg-green-950/30 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-green-700"
              />
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-green-500 py-2 text-sm font-bold text-black active:scale-[0.98]"
              >
                <MapPin className="size-4" /> PICKUP NOW
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wide text-neutral-400">DROPOFF</span>
                <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                  GPS
                </span>
              </div>
              <input
                value={draft.dropoff}
                onChange={(e) => set("dropoff", e.target.value)}
                placeholder="Toca dropoff"
                className="rounded-lg border border-blue-900/40 bg-blue-950/30 px-2.5 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-blue-700"
              />
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-400 py-2 text-sm font-bold text-black active:scale-[0.98]"
              >
                <MapPin className="size-4" /> DROPOFF NOW
              </button>
            </div>
          </div>
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
              label="TOLL"
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

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/5 p-3">
            <p className="text-[11px] font-bold tracking-wide text-yellow-400">NET PAYOUT</p>
            <p className="text-2xl font-extrabold text-green-400">{money(net)}</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
            <p className="text-[11px] font-bold tracking-wide text-neutral-400">GROSS INCOME</p>
            <p className="text-2xl font-extrabold text-white">{money(gross)}</p>
          </div>
        </div>
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
