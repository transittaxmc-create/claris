"use client"

import { useEffect, useState } from "react"
import { ChevronDown, MapPin, Coffee, Loader2, X, AlertTriangle, RotateCw, Edit2, DollarSign, Timer } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Trip, type LocationPoint, newTrip, grossOf, tripDateOf } from "./types"
import { PlatformAvatar, PlatformBadge } from "./platform-avatar"
import { isVoucherPlatform } from "./platform-meta"
import { HourlyProduction } from "./hourly-production"
import type { ShiftApi } from "./shift"
import {
  captureLocation,
  GpsAccuracyError,
  saveTempLocation,
  loadTempLocation,
  clearTempLocations,
  loadHeaderPlace,
  refreshHeaderPlace,
  type HeaderPlace,
} from "./geo"
import { MoneyInput } from "./money-input"

function LocationColumn({
  label,
  accent,
  loc,
  value,
  busy,
  disabled,
  lowAccuracy,
  onCapture,
  onManual,
  onClear,
  onConfirmManual,
}: {
  label: string
  accent: "green" | "sky"
  loc?: LocationPoint
  value: string
  busy: boolean
  disabled: boolean
  lowAccuracy?: { accuracy: number; errorMsg: string } | null
  onCapture: () => void
  onManual: (value: string) => void
  onClear: () => void
  onConfirmManual: () => void
}) {
  const border = accent === "green" ? "border-green-900/50" : "border-sky-900/50"
  const button = accent === "green" ? "bg-green-500 hover:bg-green-400" : "bg-sky-400 hover:bg-sky-300"

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/* Header con GPS badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-neutral-400">{label}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
            loc
              ? "bg-green-500/15 text-green-400 border border-green-500/30"
              : lowAccuracy
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "bg-neutral-800 text-neutral-400"
          )}
        >
          {busy
            ? "BUSCANDO..."
            : loc?.accuracy
            ? `GPS · ±${loc.accuracy}m`
            : "GPS"}
        </span>
      </div>

      {/* ESTADO 1: Confirmado (<= 50m) -> Banner Verde (Residencia) / Azul (Negocio) */}
      {loc ? (
        <div
          className={cn(
            "relative min-h-[118px] rounded-xl border p-3 transition-all",
            loc.banner === "blue"
              ? "border-sky-700/60 bg-sky-950/30 text-sky-100"
              : "border-emerald-700/60 bg-emerald-950/30 text-emerald-100"
          )}
        >
          <button
            type="button"
            aria-label={`Borrar ${label.toLowerCase()}`}
            onClick={onClear}
            className="absolute right-1.5 top-1.5 rounded-lg bg-black/40 p-1 text-neutral-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
          <div className="pr-5 text-[11px] leading-4">
            <div className="flex items-center gap-1.5 font-bold">
              <span>{loc.icon}</span>
              <span className={loc.banner === "blue" ? "text-sky-300" : "text-emerald-300"}>
                {loc.categoryLabel}
              </span>
              <span className="ml-auto rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-mono text-neutral-300">
                ±{loc.accuracy}m
              </span>
            </div>
            {loc.businessName && (
              <div className="mt-0.5 truncate font-semibold text-white">{loc.businessName}</div>
            )}
            <div className="mt-0.5 line-clamp-2 text-neutral-300">{loc.address || value}</div>
            <div className="mt-1 text-[10px] font-mono text-neutral-400">{loc.time} · {loc.day}</div>
          </div>
        </div>
      ) : lowAccuracy ? (
        /* ESTADO 2: Tarjeta Amarilla (Baja precisión > 50m o Error de sensor) */
        <div className="rounded-xl border border-amber-500/60 bg-amber-950/30 p-2.5 text-amber-200">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1 text-[11px] leading-tight">
              <div className="font-bold text-amber-300">Ubicación no confirmada</div>
              <div className="mt-0.5 text-[10px] text-neutral-300">{lowAccuracy.errorMsg}</div>
            </div>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={onCapture}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-500 py-1.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50"
            >
              <RotateCw className={cn("size-3", busy && "animate-spin")} />
              Reintentar GPS
            </button>
            <button
              type="button"
              onClick={onConfirmManual}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-500/50 bg-black/40 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-950/60 active:scale-[0.98]"
            >
              <Edit2 className="size-3" />
              Usar Manual
            </button>
          </div>
        </div>
      ) : (
        /* ESTADO 3: Entrada Manual Inicial */
        <>
          <input
            value={value}
            onChange={(e) => onManual(e.target.value)}
            placeholder={`Toca ${label.toLowerCase()}`}
            className={cn("rounded-lg border bg-neutral-950/60 px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-neutral-500", border)}
          />
          <button
            type="button"
            onClick={onCapture}
            disabled={disabled}
            className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold text-black active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 transition", button)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
            {busy ? "BUSCANDO..." : `${label} NOW`}
          </button>
        </>
      )}
    </div>
  )
}

export function EntryScreen({
  onSave,
  trips = [],
  shift,
}: {
  onSave: (t: Trip) => void
  trips?: Trip[]
  shift: ShiftApi
}) {
  const [draft, setDraft] = useState<Trip>(() => {
    const initial = newTrip()
    // Cargar puntos GPS guardados temporalmente si existen
    const p = loadTempLocation("pickup")
    const d = loadTempLocation("dropoff")
    if (p) {
      initial.pickup = p.address
      initial.pickupLoc = p
    }
    if (d) {
      initial.dropoff = d.address
      initial.dropoffLoc = d
    }
    return initial
  })

  const [platformOpen, setPlatformOpen] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [capturing, setCapturing] = useState<null | "pickup" | "dropoff">(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [lowAccuracy, setLowAccuracy] = useState<{ which: "pickup" | "dropoff"; accuracy: number; errorMsg: string } | null>(null)
  const [storageSaved, setStorageSaved] = useState(false)

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
      saveTempLocation(which, loc)
      if (lowAccuracy?.which === which) {
        setLowAccuracy(null)
      }
    } catch (e: any) {
      if (e instanceof GpsAccuracyError) {
        setLowAccuracy({ which, accuracy: e.accuracy, errorMsg: e.message })
      } else {
        setLowAccuracy({
          which,
          accuracy: 0,
          errorMsg: e instanceof Error ? e.message : "Error al obtener GPS",
        })
      }
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
    if (lowAccuracy?.which === which) {
      setLowAccuracy(null)
    }
    try {
      localStorage.removeItem(which === "pickup" ? "CURRENT_PICKUP" : "CURRENT_DROP_OFF")
    } catch {}
  }

  function confirmManual(which: "pickup" | "dropoff") {
    if (lowAccuracy?.which === which) {
      setLowAccuracy(null)
    }
  }

  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const updateNow = () => setNow(new Date())
    updateNow()
    const timer = window.setInterval(updateNow, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Ubicación actual (CALLE + CIUDAD) para la cabecera. Se muestra al instante
  // si hay una cacheada y se refresca en segundo plano sin bloquear la pantalla.
  const [place, setPlace] = useState<HeaderPlace | null>(null)

  useEffect(() => {
    let alive = true
    try {
      setPlace(loadHeaderPlace())
    } catch {}
    refreshHeaderPlace()
      .then((p) => {
        if (alive && p) setPlace(p)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const greeting = now
    ? now.getHours() < 12
      ? "Buenos días"
      : now.getHours() < 18
        ? "Buenas tardes"
        : "Buenas noches"
    : "Buenos días"

  function handleSave() {
    if (lowAccuracy) return

    // 1. Limpiar almacenamiento temporal de GPS (el viaje ya lo lleva dentro)
    clearTempLocations()

    // 2. Callback a la app principal: ella lo guarda en localStorage + IndexedDB
    onSave({ ...draft })

    // 3. Feedback STORAGE OK
    setStorageSaved(true)
    setTimeout(() => setStorageSaved(false), 2000)

    setDraft(newTrip())
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const todayTrips = trips.filter((trip) => tripDateOf(trip) === todayKey)
  const grossIncomeToday = todayTrips.reduce((total, trip) => total + grossOf(trip), 0)
  const tripCountToday = todayTrips.length

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-2 sm:px-8 sm:pt-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-white">{greeting}</h1>
          {/* From the GPS: CALLE, CIUDAD */}
          <p
            className="mt-0.5 flex items-center gap-1 text-xs"
            title={place?.address || undefined}
            suppressHydrationWarning
          >
            <MapPin className="size-3 shrink-0 text-yellow-400" />
            {place ? (
              <span className="truncate text-neutral-500">
                <span className="font-semibold text-neutral-300">{place.street || place.city}</span>
                {place.street && place.city ? <span>, {place.city}</span> : null}
              </span>
            ) : (
              <span className="truncate text-neutral-600">Buscando ubicación…</span>
            )}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-400">
          <span className="size-1.5 rounded-full bg-green-400" />
          GPS · Alta Precisión
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:content-start sm:gap-4 sm:px-8 sm:py-5">
        {/* Platform + break */}
        <div className="flex items-center gap-2 sm:col-span-2">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setPlatformOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={platformOpen}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PlatformAvatar platform={draft.platform} size={24} />
                <span className="truncate font-semibold text-white">{draft.platform}</span>
                <PlatformBadge platform={draft.platform} />
              </span>
              <ChevronDown className="size-4 shrink-0 text-neutral-500" />
            </button>

            {platformOpen && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={p === draft.platform}
                    onClick={() => {
                      // Una plataforma de vale marca el viaje como VOUCHER sin
                      // que el usuario tenga que tocar nada más.
                      setDraft((d) => ({ ...d, platform: p, isVoucher: isVoucherPlatform(p) }))
                      setPlatformOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-neutral-800",
                      p === draft.platform ? "text-yellow-400" : "text-neutral-200"
                    )}
                  >
                    <PlatformAvatar platform={p} size={22} />
                    <span className="min-w-0 flex-1 truncate">{p}</span>
                    <PlatformBadge platform={p} />
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
                : "border-neutral-700 bg-neutral-900 text-neutral-300"
            )}
          >
            <Coffee className="size-4" />
            {onBreak ? "ON BREAK" : "BREAK/LUNCH"}
          </button>
        </div>

        {/* ============================================== */}
        {/* BOX 1: ECONOMÍA — money fields */}
        {/* ============================================== */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-2.5 sm:col-span-2">
          {/* Box header */}
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">ECONOMÍA</span>
            <div className="ml-auto h-px flex-1 bg-neutral-800" />
          </div>

          {/* Row 1: EARNINGS + EXTRA CASH */}
          <div className="flex gap-2">
            <MoneyInput
              size="sm"
              label="EARNINGS"
              color="text-blue-400"
              value={draft.earnings}
              onChange={(n) => set("earnings", n)}
            />
            <MoneyInput
              size="sm"
              label="EXTRA CASH"
              color="text-green-400"
              value={draft.extraCash}
              onChange={(n) => set("extraCash", n)}
            />
          </div>

          {/* Row 2: TIPS + TOLLS + FEE */}
          <div className="mt-2 flex gap-2">
            <MoneyInput
              size="sm"
              label="TIPS"
              color="text-yellow-400"
              value={draft.tips}
              onChange={(n) => set("tips", n)}
            />
            <MoneyInput
              size="sm"
              label="TOLLS"
              color="text-amber-400"
              value={draft.toll}
              onChange={(n) => set("toll", n)}
            />
            <MoneyInput
              size="sm"
              label="FEE"
              color="text-rose-400"
              value={draft.platformFee}
              onChange={(n) => set("platformFee", n)}
            />
          </div>

        </section>

        {/* ============================================== */}
        {/* BOX 3: UBICACIONES — PICKUP + DROPOFF              */}
        {/* ============================================== */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 sm:col-span-2">
          {/* Box header */}
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="size-4 text-green-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">UBICACIONES</span>
            <div className="ml-auto h-px flex-1 bg-neutral-800" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <LocationColumn
              label="PICKUP"
              accent="green"
              loc={draft.pickupLoc}
              value={draft.pickup}
              busy={capturing === "pickup"}
              disabled={capturing !== null}
              lowAccuracy={lowAccuracy?.which === "pickup" ? lowAccuracy : null}
              onCapture={() => capture("pickup")}
              onManual={(val) => set("pickup", val)}
              onClear={() => clearLoc("pickup")}
              onConfirmManual={() => confirmManual("pickup")}
            />
            <LocationColumn
              label="DROPOFF"
              accent="sky"
              loc={draft.dropoffLoc}
              value={draft.dropoff}
              busy={capturing === "dropoff"}
              disabled={capturing !== null}
              lowAccuracy={lowAccuracy?.which === "dropoff" ? lowAccuracy : null}
              onCapture={() => capture("dropoff")}
              onManual={(val) => set("dropoff", val)}
              onClear={() => clearLoc("dropoff")}
              onConfirmManual={() => confirmManual("dropoff")}
            />
          </div>
          {geoError && (
            <p className="mt-2 text-center text-[11px] font-semibold text-rose-400">{geoError}</p>
          )}
        </section>

{/* ============================================== */}
        {/* BOX 2: CRONÓMETRO — timer + REF + HOY + MIS HORAS */}
        {/* ============================================== */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 sm:col-span-2">
          {/* Box header */}
          <div className="mb-3 flex items-center gap-2">
            <Timer className="size-4 text-yellow-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">CRONÓMETRO</span>
            <div className="ml-auto h-px flex-1 bg-neutral-800" />
          </div>

          {/* REF / INVOICE + HourlyProduction (timer + HOY + MIS HORAS + stats) */}
          <div className="grid grid-cols-[minmax(0,0.48fr)_minmax(0,1.52fr)] items-end gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wide text-neutral-500">REF / INVOICE</span>
              <input
                value={draft.ref}
                onChange={(e) => set("ref", e.target.value)}
                placeholder="Reference"
                className="min-h-[2.65rem] rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600"
              />
            </label>
            <HourlyProduction trips={trips} shift={shift} />
          </div>
        </section>

        {/* Resumen discreto al final: GROSS TODAY + REGISTER */}
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <div className="flex items-center justify-between rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[0.1em] text-emerald-300/70">GROSS TODAY</p>
              <p className="text-sm font-black tabular-nums text-emerald-300">${grossIncomeToday.toFixed(2)}</p>
            </div>
            <span className="shrink-0 text-[9px] text-neutral-500">{tripCountToday}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-sky-900/50 bg-sky-950/20 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[0.1em] text-sky-300/70">REGISTER</p>
              <p className="text-sm font-black tabular-nums text-sky-300">${trips.reduce((total, trip) => total + grossOf(trip), 0).toFixed(2)}</p>
            </div>
            <span className="shrink-0 text-[9px] text-neutral-500">all</span>
          </div>
        </div>
      </div>

      {/* Sticky record button con calidad y feedback */}
      <div className="shrink-0 border-t border-neutral-800 bg-black px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:py-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!!lowAccuracy}
          className={cn(
            "w-full rounded-2xl py-3 text-base font-extrabold tracking-wide transition-all",
            storageSaved
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : lowAccuracy
              ? "cursor-not-allowed bg-neutral-800 text-neutral-500 border border-neutral-700"
              : "bg-gradient-to-r from-yellow-500 to-amber-500 text-black active:scale-[0.99]"
          )}
        >
          {storageSaved ? "STORAGE OK ✓" : lowAccuracy ? "⚠️ RESUELVA GPS PRIMERO" : "+ GRABAR EN DISCO"}
        </button>
      </div>
    </div>
  )
}
