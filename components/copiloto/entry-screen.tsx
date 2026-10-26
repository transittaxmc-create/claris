"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, MapPin, Coffee, Loader2, X, AlertTriangle, RotateCw, Edit2, DollarSign, Play, Pause, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Trip, type LocationPoint, newTrip, grossOf, tripDateOf } from "./types"
import { PlatformAvatar, PlatformBadge } from "./platform-avatar"
import { isVoucherPlatform } from "./platform-meta"
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
import { detectNewTolls, rateFor, formatTollNote, appendNote } from "./toll-detect"

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
    <div className="flex min-w-0 flex-col gap-1">
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
            aria-label={`Delete ${label.toLowerCase()}`}
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
              <div className="font-bold text-amber-300">Location not confirmed</div>
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
            className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold text-black active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 transition", button)}
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
  // Montos ocultos al abrir (privacidad ante el cliente): cada uno se muestra con un toque.
  const [showGross, setShowGross] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  // NOTES colapsada por defecto: así todo TODAY cabe sin scroll.
  const [notesOpen, setNotesOpen] = useState(false)
  // E-ZPass: peajes ya cobrados en este viaje (no duplicar) + aviso visual
  const tollHit = useRef<Set<string>>(new Set())
  const [tollFlash, setTollFlash] = useState<string | null>(null)

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
      if (which === "pickup") tollHit.current.clear() // viaje nuevo: detección E-ZPass armada
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
          errorMsg: e instanceof Error ? e.message : "Couldn't get GPS",
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
    if (which === "pickup" && !shift.shiftActive) shift.stopGpsWatch()
    if (lowAccuracy?.which === which) {
      setLowAccuracy(null)
    }
    try {
      localStorage.removeItem(which === "pickup" ? "CURRENT_PICKUP" : "CURRENT_DROP_OFF")
    } catch {}
    if (which === "pickup") tollHit.current.clear()
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

  // E-ZPass automático: con el viaje activo (pickup capturado), cada fix del
  // GPS se cruza con las plazas 2026. Peaje nuevo → se suma a toll y se anota
  // "[HH:MM] Estación - $X.XX" en notas. No duplica en el mismo viaje.
  // El GPS continuo arranca con el viaje aunque no se haya presionado START.
  const gpsFix = shift.gps
  const tripActive = draft.pickupLoc != null
  useEffect(() => {
    if (tripActive) shift.ensureGpsWatch()
  }, [tripActive])
  useEffect(() => {
    if (!gpsFix || !tripActive) return
    const now = new Date()
    const fresh = detectNewTolls(gpsFix.lat, gpsFix.lng, gpsFix.heading ?? null, tollHit.current, now)
    if (fresh.length === 0) return
    fresh.forEach((p) => tollHit.current.add(p.name))
    setDraft((d) => {
      let toll = d.toll || 0
      let notes = d.notes || ""
      const labels: string[] = []
      for (const p of fresh) {
        const { text, amount } = formatTollNote(p, now)
        notes = appendNote(notes, text)
        if (amount != null) toll = Math.round((toll + amount) * 100) / 100
        labels.push(amount != null ? `${p.name} +$${amount.toFixed(2)}` : p.name)
      }
      return { ...d, toll, notes }
    })
    setTollFlash(`🛣️ ${fresh.map((p) => {
      const r = rateFor(p, now)
      return r != null ? `${p.name} +$${r.toFixed(2)}` : p.name
    }).join(" · ")}`)
    window.setTimeout(() => setTollFlash(null), 4000)
  }, [gpsFix, tripActive])

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

  // La ubicación del header se refresca sola mientras la página está abierta
  // (cada 20 s, con posición fresca), para que diga dónde está mientras maneja.
  useEffect(() => {
    let alive = true
    let busy = false
    const poll = async () => {
      if (!alive || busy || document.hidden) return
      busy = true
      try {
        const p = await refreshHeaderPlace({ fresh: true })
        if (alive && p) {
          setPlace((prev) => (prev && prev.street === p.street && prev.city === p.city ? prev : p))
        }
      } catch {
        // sin GPS en este ciclo: se reintenta en el siguiente
      } finally {
        busy = false
      }
    }
    const id = window.setInterval(poll, 20_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const greeting = now
    ? now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening"
    : "Good morning"

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
    tollHit.current.clear()
    // Si el turno no está corriendo, el GPS era solo para peajes: apagarlo.
    if (!shift.shiftActive) shift.stopGpsWatch()
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const todayTrips = trips.filter((trip) => tripDateOf(trip) === todayKey)
  const grossIncomeToday = todayTrips.reduce((total, trip) => total + grossOf(trip), 0)

  function toggleGross() {
    setShowGross((v) => !v)
  }

  function toggleRegister() {
    setShowRegister((v) => !v)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header FIJO (shrink-0, nunca scrollea): saludo, localización, fecha
          y una sola fila de controles del turno, todos de la misma altura */}
      <div className="shrink-0 px-4 pb-2 pt-2 sm:px-8 sm:pt-3">
        <h1 className="truncate text-2xl font-bold text-white">{greeting}</h1>
        {/* From the GPS: BARRIO · CALLE, CIUDAD */}
        <p
          className="mt-0.5 flex items-center gap-1.5 text-sm"
          title={place?.address || undefined}
          suppressHydrationWarning
        >
          <MapPin className="size-4 shrink-0 text-yellow-400" />
          {place ? (
            <span className="truncate text-neutral-500">
              {place.neighborhood ? (
                <span className="font-semibold text-neutral-200">{place.neighborhood}</span>
              ) : null}
              {place.neighborhood && (place.street || place.city) ? <span> · </span> : null}
              <span className="font-semibold text-neutral-200">{place.street || place.city}</span>
              {place.street && place.city ? <span>, {place.city}</span> : null}
            </span>
          ) : (
            <span className="truncate text-neutral-600">Looking up location…</span>
          )}
        </p>
        {/* Fecha completa, pegada a la localización */}
        <p
          className="mt-1 whitespace-nowrap text-base font-bold text-neutral-100"
          suppressHydrationWarning
        >
          {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        {/* Fila de controles: estado + millas a la izquierda, botones a la
            derecha — todo a h-8, una sola línea alineada */}
        <div className="mt-2 flex items-center gap-2.5 border-t border-neutral-800/60 pt-2">
          {shift.shiftActive ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {shift.isOnBreak ? "ON BREAK" : "ON SHIFT"}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-neutral-500">
              <span className="size-1.5 rounded-full bg-neutral-600" />
              OFF SHIFT
            </span>
          )}
          {/* Contador de millas IRS — corre solo con el turno activo */}
          {shift.shiftActive && (
            <span
              title="Millas de negocio (IRS) — se guardan al cerrar el turno"
              className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 font-mono text-[11px] font-bold tabular-nums text-sky-300"
            >
              {shift.shiftMiles.toFixed(1)} mi
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {!shift.shiftActive ? (
              <button
                type="button"
                onClick={shift.onStart}
                className="flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3.5 text-xs font-bold text-emerald-300"
              >
                <Play className="size-3" /> START
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={shift.onBreak}
                  title={shift.isOnBreak ? "Resume the shift" : "Pause the shift"}
                  className={cn(
                    "flex h-8 items-center justify-center gap-1 rounded-lg border px-3.5 text-xs font-bold",
                    shift.isOnBreak
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/50 bg-amber-500/10 text-amber-300",
                  )}
                >
                  {shift.isOnBreak ? <Play className="size-3" /> : <Pause className="size-3" />}
                  {shift.isOnBreak ? "RESUME" : "PAUSE"}
                </button>
                <button
                  type="button"
                  onClick={shift.onEnd}
                  title="End the shift"
                  className="flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-300"
                >
                  <Square className="size-3" /> END
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* TODAY + REGISTER — juntos en una línea, bien cuadrado */}
      <div className="flex shrink-0 items-stretch border-b border-neutral-800/60 bg-black sm:px-8">
        <button
          type="button"
          onClick={toggleGross}
          title={showGross ? "Tap to hide the amount" : "Tap to show the amount"}
          className="flex flex-1 items-center justify-between gap-2 px-4 py-1.5"
        >
          <span className="text-[10px] font-bold tracking-[0.15em] text-emerald-300/70">TODAY</span>
          <span className="font-mono text-base font-black tabular-nums text-emerald-300">
            {showGross ? `$${grossIncomeToday.toFixed(2)}` : "••••••"}
          </span>
        </button>
        <div className="w-px bg-neutral-800/60" />
        <button
          type="button"
          onClick={toggleRegister}
          title={showRegister ? "Tap to hide the amount" : "Tap to show the amount"}
          className="flex flex-1 items-center justify-between gap-2 px-4 py-1.5"
        >
          <span className="text-[10px] font-bold tracking-[0.15em] text-sky-300/70">REGISTER</span>
          <span className="font-mono text-base font-black tabular-nums text-sky-300">
            {showRegister ? `$${trips.reduce((total, trip) => total + grossOf(trip), 0).toFixed(2)}` : "••••••"}
          </span>
        </button>
      </div>

      {/* Body FIJO (regla de Miguel: nada scrollea, todo queda visible) */}
      <div className="flex-1 space-y-1.5 overflow-hidden px-4 py-1.5 sm:grid sm:grid-cols-2 sm:content-start sm:gap-4 sm:px-8 sm:py-5">
        {/* Platform + break */}
        <div className="flex items-center gap-2 sm:col-span-2">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setPlatformOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={platformOpen}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2"
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
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
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
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-2 sm:col-span-2">
          {/* Box header */}
          <div className="mb-1.5 flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">ECONOMY</span>
            <div className="ml-auto h-px flex-1 bg-neutral-800" />
          </div>

          {/* Row 1: FARE + EXTRA CASH */}
          <div className="flex gap-2">
            <MoneyInput
              size="sm"
              label="FARE"
              color="text-green-400"
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
          <div className="mt-1.5 flex gap-2">
            <MoneyInput
              size="sm"
              label="TIPS"
              color="text-green-400"
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
              color="text-red-500"
              value={draft.platformFee}
              onChange={(n) => set("platformFee", n)}
            />
          </div>

        </section>

        {/* ============================================== */}
        {/* BOX 3: UBICACIONES — PICKUP + DROPOFF              */}
        {/* ============================================== */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-2.5 sm:col-span-2">
          {/* Box header */}
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="size-4 text-green-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">LOCATIONS</span>
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

        {/* BOX 4: NOTAS — colapsada por defecto para que TODO quepa sin
            scroll; se abre tocando el encabezado. El aviso de peaje (tollFlash)
            se ve siempre. */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-2.5 sm:col-span-2">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="flex w-full items-center gap-2"
            aria-expanded={notesOpen}
          >
            <Edit2 className="size-4 text-neutral-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">NOTES</span>
            {draft.notes ? <span className="size-1.5 rounded-full bg-sky-400" /> : null}
            <div className="ml-1 h-px flex-1 bg-neutral-800" />
            <ChevronDown className={cn("size-4 shrink-0 text-neutral-500 transition-transform", notesOpen && "rotate-180")} />
          </button>
          {tollFlash && (
            <p className="mt-2 rounded-lg bg-sky-950/60 px-2 py-1 text-[11px] font-semibold text-sky-300">{tollFlash}</p>
          )}
          {notesOpen && (
            <textarea
              value={draft.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Toll breakdown appears here automatically…"
              className="mt-2 w-full resize-none rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          )}
        </section>

      </div>

      {/* Sticky record button con calidad y feedback */}
      <div className="shrink-0 border-t border-neutral-800 bg-black px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 sm:px-8 sm:py-5">
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
          {storageSaved ? "STORAGE OK ✓" : lowAccuracy ? "⚠️ FIX GPS FIRST" : "+ SAVE TO DISK"}
        </button>
      </div>
    </div>
  )
}
