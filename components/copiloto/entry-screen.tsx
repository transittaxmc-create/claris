"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, MapPin, Coffee, Loader2, X, AlertTriangle, RotateCw, Edit2, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform, type Trip, type LocationPoint, newTrip, grossOf, tripDateOf } from "./types"
import { PlatformBadge } from "./platform-avatar"
import { SelectorLogo } from "./selector-logo"
import { NumPad } from "./num-pad"
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
import { moneyTextFromNumber, moneyTextToNumber, normalizeMoneyText } from "@/lib/money"
import { detectNewTolls, rateFor, formatTollNote, appendNote } from "./toll-detect"
import { applyDispatchToTrip, findDispatchDuplicate, type DispatchScan } from "./dispatch-scan"
import { loadShiftTolls, SHIFT_TOLLS_EVENT } from "./shift-tolls"
import { perHourOf, shiftGrossOf, shiftWindowOf, shiftWindowTrips } from "./per-hour"
import { setHomeGeo } from "./mileage-log"

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
            ? "SEARCHING..."
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
              Retry GPS
            </button>
            <button
              type="button"
              onClick={onConfirmManual}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-500/50 bg-black/40 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-950/60 active:scale-[0.98]"
            >
              <Edit2 className="size-3" />
              Enter manually
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
            className={cn("rounded-lg border bg-neutral-950/60 px-2.5 py-2.5 text-[13px] text-white outline-none placeholder:text-neutral-500", border)}
          />
          <button
            type="button"
            onClick={onCapture}
            disabled={disabled}
            className={cn("flex items-center justify-center gap-1.5 rounded-lg py-3 text-sm font-bold text-black active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 transition", button)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
            {busy ? "SEARCHING..." : `${label} NOW`}
          </button>
        </>
      )}
    </div>
  )
}


/**
 * Tarjeta compacta de una entrada de dinero de TODAY (modelo de 5 tarjetas
 * del clon V8, integrado a pedido de Miguel 2026-10-31 para recoger la
 * página). La lógica de edición es la MISMA de MoneyInput: el texto se
 * conserva tal como se escribe (permite estados intermedios "-", "12."),
 * se normaliza al escribir y el número se confirma al salir; el valor
 * sigue llegando al mismo campo del draft de siempre.
 */
function EarningsCard({
  icon,
  label,
  color,
  value,
  onChange,
  inputId,
  onActivate,
}: {
  icon: string
  label: string
  color: string
  value: number
  onChange: (n: number) => void
  inputId?: string
  onActivate?: () => void
}) {
  // null = no se está editando -> se muestra el valor numérico real.
  const [text, setText] = useState<string | null>(null)
  const display = text ?? moneyTextFromNumber(value)
  const negative = display.trim().startsWith("-")

  function edit(next: string) {
    const clean = normalizeMoneyText(next)
    setText(clean)
    onChange(moneyTextToNumber(clean))
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-black/50 px-1.5 py-3 text-center">
      <div className="text-lg" aria-hidden>
        {icon}
      </div>
      <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <input
        id={inputId}
        type="text"
        inputMode={inputId === "fare-input" ? "none" : "decimal"}
        readOnly={inputId === "fare-input"}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        value={display}
        onFocus={(e) => {
          setText(moneyTextFromNumber(value))
          onActivate?.()
          if (inputId === "fare-input") {
            // Mata el teclado del sistema en iOS
            setTimeout(() => e.target.blur(), 10)
          }
        }}
        onBlur={() => {
          const clean = normalizeMoneyText(display)
          setText(null)
          onChange(moneyTextToNumber(clean))
        }}
        onChange={(e) => edit(e.target.value)}
        placeholder="$0"
        className={cn(
          // text-[18px]! : la regla global anti-zoom fija los inputs a
          // 16px !important; el !important de la utilidad gana por
          // especificidad y el número se ve más grande (18px sigue
          // sobre el mínimo anti-zoom de iOS, la página no salta).
          "mt-1 w-full min-w-0 bg-transparent text-center text-[18px]! font-bold outline-none placeholder:text-neutral-600",
          negative ? "text-rose-300" : color,
        )}
      />
    </div>
  )
}

export function EntryScreen({
  onSave,
  trips = [],
  shift,
  onGoDashboard,
  onGoMessages,
  dispatchFill,
  onDispatchConsumed,
}: {
  onSave: (t: Trip) => void
  trips?: Trip[]
  shift: ShiftApi
  onGoDashboard?: () => void
  onGoMessages?: () => void
  /** Lectura de una foto de despacho (botón flotante) lista para llenar el borrador. */
  dispatchFill?: { scan: DispatchScan; n: number } | null
  onDispatchConsumed?: () => void
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
  const [activeField, setActiveField] = useState<string | null>(null)
  const [fareText, setFareText] = useState("")
  const [onBreak, setOnBreak] = useState(false)
  const [capturing, setCapturing] = useState<null | "pickup" | "dropoff">(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [lowAccuracy, setLowAccuracy] = useState<{ which: "pickup" | "dropoff"; accuracy: number; errorMsg: string } | null>(null)
  const [storageSaved, setStorageSaved] = useState(false)
  // REGISTER oculto al abrir (privacidad ante el cliente): se muestra con un toque.
  // TODAY siempre visible, sin puntitos (orden de Miguel, 2026-11-20).
  const [showRegister, setShowRegister] = useState(false)
  // Bombillito de mensajes (Miguel, 2026-11-26): cuenta los mensajes del
  // CRM que siguen PENDIENTES en este aparato — la misma copia local
  // (claris_crm_messages_v1) que alimenta el contador de la pestaña
  // Messages del CRM. Se relee al montar, al volver el foco y cada 15 s:
  // la luz de TODAY nunca depende de que él abra el CRM primero.
  const [pendingMessages, setPendingMessages] = useState(0)
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("claris_crm_messages_v1")
        const parsed = raw ? JSON.parse(raw) : []
        setPendingMessages(
          Array.isArray(parsed)
            ? parsed.filter((m: { status?: string }) => m?.status === "pending").length
            : 0,
        )
      } catch {}
    }
    read()
    const id = window.setInterval(read, 15_000)
    window.addEventListener("focus", read)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", read)
    }
  }, [])
  // NOTES colapsada por defecto: así todo TODAY cabe sin scroll.
  const [notesOpen, setNotesOpen] = useState(false)
  // E-ZPass: peajes ya cobrados en este viaje (no duplicar) + aviso visual
  const tollHit = useRef<Set<string>>(new Set())
  // Indicador de MOMENTO de peaje (Miguel, 2026-11-22): los contadores de
  // peajes viven SOLO en el DASHBOARD; aquí queda una línea fina y fija
  // abajo que avisa en el momento en que la detección anota una pasada
  // (del viaje abierto o del diario del turno) y vuelve a quedar quieta.
  const [tollPing, setTollPing] = useState<{ plaza: string; amount: number | null; n: number } | null>(null)
  const tollPingTimer = useRef<number | null>(null)
  const pingToll = (plaza: string, amount: number | null) => {
    setTollPing({ plaza, amount, n: Date.now() })
    if (tollPingTimer.current) window.clearTimeout(tollPingTimer.current)
    tollPingTimer.current = window.setTimeout(() => setTollPing(null), 5000)
  }
  // Diario de peajes del turno (pasadas entre trabajos): cuando entra una
  // pasada NUEVA al diario, el indicador avisa al momento.
  const seenDiaryIds = useRef<Set<string>>(new Set(loadShiftTolls().map((t) => t.id)))
  useEffect(() => {
    const refresh = () => {
      const fresh = loadShiftTolls().filter((t) => !seenDiaryIds.current.has(t.id))
      fresh.forEach((t) => seenDiaryIds.current.add(t.id))
      if (fresh.length > 0) {
        const last = fresh[fresh.length - 1]
        pingToll(last.plaza, last.amount)
      }
    }
    window.addEventListener(SHIFT_TOLLS_EVENT, refresh)
    return () => window.removeEventListener(SHIFT_TOLLS_EVENT, refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = <K extends keyof Trip>(key: K, val: Trip[K]) =>
    setDraft((d) => ({ ...d, [key]: val }))

  // Foto → TODAY (botón flotante): cuando llega una lectura de despacho,
  // el borrador se llena solo. Miguel solo revisa y toca el SAVE de
  // siempre — nada se guarda automáticamente. El aviso es una línea
  // pasajera bajo la fila de plataformas; no cambia la geometría.
  const [scanMsg, setScanMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const scanMsgTimer = useRef<number | null>(null)
  const showScanMsg = (tipo: "ok" | "error", texto: string) => {
    setScanMsg({ tipo, texto })
    if (scanMsgTimer.current) window.clearTimeout(scanMsgTimer.current)
    scanMsgTimer.current = window.setTimeout(() => setScanMsg(null), 6000)
  }
  const lastDispatchN = useRef(0)
  useEffect(() => {
    if (!dispatchFill || dispatchFill.n === lastDispatchN.current) return
    lastDispatchN.current = dispatchFill.n
    const scan = dispatchFill.scan
    // Anti-duplicado (segunda red, con los viajes ya en pantalla).
    const dup = findDispatchDuplicate(trips, scan)
    if (dup) {
      showScanMsg("error", `This job is already entered (${scan.voucherNo ? `Voucher ${scan.voucherNo}` : `Conf# ${scan.confNo}`}). Nothing was filled.`)
    } else {
      setDraft((d) => applyDispatchToTrip(scan, d))
      setNotesOpen(true)
      showScanMsg("ok", "Trip filled from the photo — review it and tap SAVE")
    }
    onDispatchConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchFill])

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
  // "[Oct 29 · HH:MM] Estación - $X.XX" en notas (día y hora, Miguel
  // 2026-10-29). Si pasan varios peajes en el viaje, se suman todos.
  // No duplica la misma plaza en el mismo viaje.
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
    const lastFresh = fresh[fresh.length - 1]
    pingToll(lastFresh.name, rateFor(lastFresh, now))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Cursor directo a FARE para el siguiente viaje
    setTimeout(() => {
      const el = document.getElementById("fare-input") as HTMLInputElement | null
      if (el) { el.focus(); el.select() }
    }, 50)
    // Si el turno no está corriendo, el GPS era solo para peajes: apagarlo.
    if (!shift.shiftActive) shift.stopGpsWatch()
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const todayTrips = trips.filter((trip) => tripDateOf(trip) === todayKey)

  // Primer slot fijo = el primero de la lista (Miguel, 2026-11-23):
  // tocar un botón rápido cambia la plataforma del viaje, pero el
  // primer cuadro NUNCA cambia ni se duplica la plataforma elegida.
  const firstPlatform = PLATFORMS[0]
  // Top platforms for quick buttons: 2 most used + 2 most used vouchers
  const quickPlatforms = (() => {
    const counts = new Map<string, number>()
    for (const t of trips) {
      const p = t.platform || "Other"
      counts.set(p, (counts.get(p) || 0) + 1)
    }
    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([p]) => p !== firstPlatform)
    const top = sorted.slice(0, 2).map(([p]) => p)
    const vouchers = sorted.filter(([p]) => isVoucherPlatform(p as any)).slice(0, 2).map(([p]) => p)
    const seen = new Set<string>()
    const out: string[] = []
    for (const p of [...top, ...vouchers]) {
      if (!seen.has(p) && out.length < 4) { seen.add(p); out.push(p) }
    }
    // Fallback if few trips
    if (out.length < 4) {
      for (const p of ["Uber", "Lyft", "Aventus Ride", "Classic Ryde", "Throo", "CO-OP Drive"]) {
        if (p !== firstPlatform && !seen.has(p) && out.length < 4) { seen.add(p); out.push(p) }
      }
    }
    return out
  })()
  const grossIncomeToday = todayTrips.reduce((total, trip) => total + grossOf(trip), 0)
  // $/h del chip = LA MISMA cuenta del DASHBOARD (fuente única:
  // components/copiloto/per-hour.ts): gross de la ventana del turno ÷
  // horas activas desde el START, con su fallback por lapso de viajes
  // cuando no hay turno activo (Miguel, 2026-11-24: el por hora cuenta
  // desde que prende el turno). La fórmula anterior dividía el gross
  // de hoy entre los SEGUNDOS trabajados guardados de 30 días tratados
  // como horas — el chip vivía en $0/h aunque entraran viajes.
  const winTrips = shiftWindowTrips(trips, shiftWindowOf(shift.shiftActive, shift.clockIn, shift.lastShift), todayKey)
  const perHourToday = perHourOf(shiftGrossOf(winTrips), shift.activeHoursDecimal, winTrips, Date.now())
  const hourlyRate = perHourToday > 0 ? perHourToday : null
  const goal = shift.hourlyGoal || 30

  function toggleRegister() {
    setShowRegister((v) => !v)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header FIJO (shrink-0, nunca scrollea): modelo del clon V8
          (integrado 2026-10-31) — marca + pastilla GPS, saludo, tagline,
          localización con la fecha corta a la derecha. Los controles del
          turno viven SOLO en el DASHBOARD (la tira de abajo salió de
          TODAY el 2026-11-22, a pedido de Miguel). El pt-[18px] (+10px
          sobre el pt-2 original) baja el header un poco para que no
          quede debajo del skin transparente de arriba del teléfono
          (Miguel, 2026-11-22). Los logos del selector de plataformas
          también crecieron a pedido suyo ese día (rápidos 16→24,
          desplegable 20→28); la letra del nombre no cambió. Después
          pasaron a cajas rectangulares anchas (SelectorLogo) con el
          logo completo y centrado, sin el recorte del círculo. */}
      <div className="shrink-0 px-4 pb-2 pt-[18px] sm:px-8 sm:pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-500">
              <svg className="size-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L4 6v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V6l-8-4z"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <h1 className="text-xl font-bold text-white">Copiloto <span className="text-lime-400">V7</span></h1>
          </div>
          {/* Acceso directo al DASHBOARD (Miguel, 2026-11-22): pastilla
              gemela a la del GPS, en el espacio vacío del centro de la
              fila — no mueve ni achica nada del header. */}
          {onGoDashboard ? (
            <button
              type="button"
              onClick={onGoDashboard}
              title="Open the DASHBOARD"
              className="flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-300/10 px-2 py-1.5 text-[9px] font-bold tracking-[0.08em] text-amber-200"
            >
              <Gauge className="size-3" />
              DASHBOARD
            </button>
          ) : null}
          {/* Bombillito de mensajes (Miguel, 2026-11-26): en el hueco donde
              vivía la pastilla "GPS ready" va ahora el aviso MESSAGE, del
              mismo tamaño. La luz parpadea suave mientras haya mensajes
              del CRM pendientes y queda quieta y apagada cuando no hay
              ninguno; ignorar un mensaje a propósito (Discard) lo saca de
              pendientes y apaga la luz, cerrarlo sin responder la deja
              prendida. Tocarla abre el CRM directo en la pestaña Messages.
              El GPS READY bajó a la caja LOCATIONS, junto a pickup/drop-off. */}
          <button
            type="button"
            onClick={onGoMessages}
            title={pendingMessages > 0 ? `${pendingMessages} pending message${pendingMessages === 1 ? "" : "s"} — open Messages` : "Open Messages"}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              pendingMessages > 0
                ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                : "border-neutral-700 bg-neutral-800/40 text-neutral-400",
            )}
          >
            <span className={cn("size-1.5 rounded-full", pendingMessages > 0 ? "animate-pulse bg-amber-300" : "bg-neutral-500")} />
            MESSAGE
          </button>
        </div>
        <p className="mt-1 text-lg font-bold leading-tight text-white">{greeting}</p>
        <p className="text-sm text-neutral-500">Drive safe. Earn smart.</p>
        <p
          className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400"
          title={place?.address || undefined}
          suppressHydrationWarning
        >
          <MapPin className="size-3 shrink-0 text-lime-400" />
          {place ? (
            <span className="truncate">
              {place.neighborhood || place.street || place.city}
              {place.city && place.street ? `, ${place.city}` : ""}
            </span>
          ) : (
            <span>Looking up location…</span>
          )}
          <span className="ml-auto shrink-0 text-neutral-500" suppressHydrationWarning>
            {today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </p>
      </div>

      {/* TODAY + REGISTER — juntos en una línea, bien cuadrado */}
      <div className="flex shrink-0 items-stretch border-b border-neutral-800/60 bg-black sm:px-8">
        <div className="flex flex-1 items-center justify-between gap-2 px-4 py-1.5">
          <span className="flex items-center gap-1">
            <span className="text-[10px] font-bold tracking-[0.15em] text-emerald-300/70">TODAY</span>
            <button type="button" onClick={() => {
              if (shift.gps) { setHomeGeo(shift.gps.lat, shift.gps.lng); alert("Home set") }
              else alert("Waiting for GPS")
            }} className="rounded border border-neutral-700 px-1.5 py-0.5 text-[8px] text-neutral-400">Set home</button>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-base font-black tabular-nums text-emerald-300">
              {`$${grossIncomeToday.toFixed(2)}`}
            </span>
            {hourlyRate !== null && (
              <span className={`font-mono text-[10px] font-bold tabular-nums ${hourlyRate >= goal ? "text-emerald-400" : "text-amber-400"}`}>
                ${hourlyRate.toFixed(0)}/h
              </span>
            )}
          </span>
        </div>
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

      {/* Body: la parte de ENTRADAS (plataforma, ECONOMY, LOCATIONS) cabe
          completa sin scroll y el header y SAVE quedan fijos fuera de este
          div. El scroll existe SOLO para bajar a las NOTES cuando se abren
          (aclaración de Miguel, 2026-10-26: las notas pueden quedar abajo;
          lo que nunca puede requerir scroll es entrar datos ni salvar). */}
      <div className="flex flex-1 flex-col justify-evenly gap-2 overflow-y-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:content-start sm:gap-4 sm:px-8 sm:py-5">
        {/* Platform + break — EXACTAMENTE como estaba en V7, con los
            logos originales de cada plataforma (orden de Miguel,
            2026-10-31: "en la V7 prefiero dejarla como está esa parte").
            La tarjeta del clon NO se aplicó aquí. */}
        <div className="flex items-center gap-1.5 sm:col-span-2">
          <div className="relative min-w-0 flex-[1.1]">
            {/* Primer cuadro fijo en el primero de la lista (Miguel,
                2026-11-23): abre la lista completa; la plataforma del
                viaje se marca con el marco amarillo en su botón rápido. */}
            <button
              type="button"
              onClick={() => setPlatformOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={platformOpen}
              className="flex h-12 w-full items-center justify-between gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <SelectorLogo platform={firstPlatform} width={56} height={30} />
                <span className="truncate text-xs font-semibold text-white">{firstPlatform}</span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-neutral-500" />
            </button>
            {platformOpen && (
              <div
                role="listbox"
                className="fixed inset-x-4 top-32 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={p === draft.platform}
                    onClick={() => {
                      setDraft((d) => ({ ...d, platform: p, isVoucher: isVoucherPlatform(p) }))
                      setPlatformOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-neutral-800",
                      p === draft.platform ? "text-yellow-400" : "text-neutral-200"
                    )}
                  >
                    <SelectorLogo platform={p} width={56} height={30} />
                    <span className="min-w-0 flex-1 truncate">{p}</span>
                    <PlatformBadge platform={p} />
                  </button>
                ))}
              </div>
            )}
          </div>
          {quickPlatforms.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={p}
              onClick={() => setDraft((d) => ({ ...d, platform: p as any, isVoucher: isVoucherPlatform(p as any) }))}
              className={cn(
                "flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg border px-0.5 transition-colors",
                draft.platform === p
                  ? "border-yellow-400 bg-yellow-400/15 text-yellow-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300"
              )}
            >
              {/* Solo el logo, centrado (Miguel, 2026-11-22): el nombre
                  escrito debajo duplicaba el que ya trae el arte del
                  logo (Lyft dice "lyft", Uber dice "Uber"). Sin la
                  letra, la caja del logo crece de alto (26 → 32). */}
              <SelectorLogo platform={p as Platform} width={52} height={32} />
            </button>
          ))}
        </div>

        {/* Aviso pasajero del llenado por foto (solo mientras dura el
            mensaje; no es una fila permanente). */}
        {scanMsg && (
          <p
            role="status"
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-semibold sm:col-span-2",
              scanMsg.tipo === "ok" ? "bg-emerald-950/60 text-emerald-300" : "bg-rose-950/60 text-rose-300",
            )}
          >
            {scanMsg.texto}
          </p>
        )}

        {/* ============================================== */}
        {/* BOX 1: TODAY'S EARNINGS — 5 tarjetas compactas en una sola fila
            (modelo traído del clon V8 a pedido de Miguel, 2026-10-31, para
            recoger y organizar la página). Cada tarjeta escribe al MISMO
            campo del draft que la caja anterior (earnings, tips, toll,
            platformFee, extraCash); LOCATIONS, la captura GPS y el resto
            de TODAY quedan como estaban. */}
        {/* ============================================== */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">TODAY'S EARNINGS</span>
            <span className="text-[9px] text-neutral-500">All values in USD</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <EarningsCard icon="💼" label="FARE" color="text-green-400" value={draft.earnings} onChange={(n) => set("earnings", n)} inputId="fare-input" onActivate={() => setActiveField("fare")} />
            <EarningsCard icon="⭐" label="TIPS" color="text-green-400" value={draft.tips} onChange={(n) => set("tips", n)} />
            <EarningsCard icon="🛣️" label="TOLLS" color="text-amber-400" value={draft.toll} onChange={(n) => set("toll", n)} />
            <EarningsCard icon="%" label="FEE" color="text-red-500" value={draft.platformFee} onChange={(n) => set("platformFee", n)} />
            <EarningsCard icon="$" label="EXTRA" color="text-green-400" value={draft.extraCash} onChange={(n) => set("extraCash", n)} />
          </div>
          {activeField && (
            <div className="mt-2">
              <NumPad
                onKey={(k) => {
                  // Punto rodando (Miguel, 2026-11-24): los dígitos que
                  // se teclean SON los centavos — 4-0-2-5 -> $40.25.
                  // La tecla "." queda en el teclado pero no hace nada.
                  setFareText((cur) => {
                    let digits = cur.replace(/[^0-9]/g, "")
                    if (k === "back") digits = digits.slice(0, -1)
                    else if (/^[0-9]$/.test(k)) digits = (digits + k).slice(-12)
                    else return cur
                    const num = digits.length ? Number(digits) / 100 : 0
                    set("earnings", num)
                    return digits
                  })
                }}
                onDone={() => { setActiveField(null); setFareText("") }}
              />
            </div>
          )}
        </section>

        {/* ============================================== */}
        {/* BOX 3: UBICACIONES — PICKUP + DROPOFF              */}
        {/* ============================================== */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 sm:col-span-2">
          {/* Box header */}
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="size-4 text-green-400" />
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">LOCATIONS</span>
            <div className="h-px flex-1 bg-neutral-800" />
            {/* GPS READY vive ahora aquí (Miguel, 2026-11-26): junto a
                pickup/drop-off — verde y encendido con el GPS activo,
                gris cuando está apagado. El estado es el mismo de siempre
                (place, de geo.ts); no hay una segunda lógica de GPS. */}
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
                place
                  ? "border-lime-500/50 bg-lime-500/10 text-lime-400"
                  : "border-neutral-700 bg-neutral-800 text-neutral-500",
              )}
            >
              <span className={cn("size-1.5 rounded-full", place ? "bg-lime-400" : "bg-neutral-500")} />
              {place ? "GPS READY" : "GPS OFF"}
            </span>
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
            scroll; se abre tocando el encabezado. */}
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

      {/* Indicador de momento de peaje (Miguel, 2026-11-22): la tira del
          turno y el contador acumulativo de peajes SALIERON de TODAY — el
          turno se controla SOLO desde el DASHBOARD y los contadores de
          peajes viven SOLO allá. Aquí queda una sola línea fina y FIJA
          (altura constante: la página nunca salta) que está quieta y, en
          el momento en que la detección anota una pasada, la enseña unos
          segundos y vuelve a quedar quieta. */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-950 px-4 py-1.5 sm:px-8" aria-live="polite">
        <div className="flex h-[18px] items-center">
          {tollPing ? (
            <span key={tollPing.n} className="truncate text-[11px] font-semibold text-emerald-300">
              ✓ Toll detected · {tollPing.plaza}
              {tollPing.amount != null ? ` $${tollPing.amount.toFixed(2)}` : ""} · sumando al tablero
            </span>
          ) : (
            <span className="truncate text-[10px] font-semibold tracking-[0.12em] text-neutral-500">
              🛣️ E-ZPASS · TOLLS ARE ADDED IN THE DASHBOARD
            </span>
          )}
        </div>
      </div>

      {/* Sticky record button con calidad y feedback */}
      {/* Barra SAVE pegada abajo (Miguel, 2026-11-09): sin la franja negra
          vacía que quedaba bajo el botón — el padding inferior grande y el
          strip por hora salieron de aquí; la barra baja y la página llena
          la pantalla hasta la navegación. El safe-area lo maneja el
          BottomNav, que es el último elemento. */}
      <div className="shrink-0 border-t border-neutral-800 bg-black px-4 pb-2 pt-2 sm:px-8 sm:py-5">
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
