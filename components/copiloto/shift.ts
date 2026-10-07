// Turno unificado de Copiloto: UNA sola fuente de verdad para "estoy trabajando".
//
// Antes había dos estados independientes que podían contradecirse:
//   - el cronómetro de HOY (claris_timer_on / claris_timer_started_at)
//   - el turno del DASHBOARD (claris_v1dash_shift)
// Ahora ambos usan este hook. START/BREAK/END controlan todo:
//   - el $/hora del DASHBOARD (horas activas reales, sin breaks)
//   - el cronómetro por bloques de HOY (MIS HORAS)
//   - las millas GPS para la deducción IRS
//
// Los breaks pausan la medición: el tiempo de break no cuenta como trabajado.
// El historial por hora (claris_hours_worked) conserva su formato, así que
// FINANCE ("¿CUÁNTO LLEVO HOY?") sigue funcionando sin cambios.

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { haversineKm } from "./v1-dash/v1-dash-zones"
import {
  commitWorkedRange,
  hourKeyOf,
  startOfHourMs,
  trimWorked,
  type WorkedHours,
} from "@/lib/production"

export const SHIFT_KEY = "claris_v1dash_shift"
export const SHIFT_LOG_KEY = "claris_v1dash_shift_logs"
export const SHIFT_START_KEY = "claris_v1dash_shift_start"
export const HOURLY_GOAL_KEY = "claris_hourly_goal"
export const WORKED_KEY = "claris_hours_worked"
const KEEP_DAYS = 30
const DEFAULT_HOURLY_GOAL = 60

// Claves viejas del cronómetro independiente (se migran una sola vez y se borran).
const LEGACY_ON_KEY = "claris_timer_on"
const LEGACY_STARTED_KEY = "claris_timer_started_at"
const LEGACY_SEEN_KEY = "claris_timer_last_seen"

const pad = (n: number) => String(n).padStart(2, "0")
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export type ShiftState = {
  date: string // YYYY-MM-DD del día del turno
  active: boolean // turno abierto (después de START, antes de END)
  clockIn: number | null // ms cuando se inició el turno
  breakMs: number // breaks acumulados (ms)
  breakStart: number | null // ms cuando empezó el break actual
  miles: number // millas GPS del turno
  measureStart: number | null // ms cuando empezó el tramo de medición actual (null si no se está midiendo)
  lastSeen: number | null // último heartbeat (para no contar tiempo con la app cerrada)
}

type GpsState = { status: "idle" | "watching" | "denied" | "error"; lastFix: string | null }

const EMPTY_SHIFT: ShiftState = {
  date: "",
  active: false,
  clockIn: null,
  breakMs: 0,
  breakStart: null,
  miles: 0,
  measureStart: null,
  lastSeen: null,
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

// Estado inicial: turno guardado, o migración del cronómetro viejo si estaba encendido.
function initShift(): ShiftState {
  const base = { ...EMPTY_SHIFT, date: dayKey(new Date()) }
  try {
    const saved = loadJson<Partial<ShiftState>>(SHIFT_KEY)
    if (saved && typeof saved === "object") return { ...base, ...saved }
    // Migración única: si el cronómetro viejo estaba encendido, el turno continúa.
    const wasOn = localStorage.getItem(LEGACY_ON_KEY) !== "0"
    const started = Number(localStorage.getItem(LEGACY_STARTED_KEY))
    if (wasOn && Number.isFinite(started) && started > 0 && Date.now() - started < 24 * 3600_000) {
      const migrated: ShiftState = {
        ...base,
        date: dayKey(new Date(started)),
        active: true,
        clockIn: started,
        measureStart: started,
        lastSeen: Date.now(),
      }
      localStorage.setItem(SHIFT_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    /* localStorage no disponible */
  } finally {
    // Las claves viejas ya no se usan: se borran para no revivir el turno dos veces.
    try {
      localStorage.removeItem(LEGACY_ON_KEY)
      localStorage.removeItem(LEGACY_STARTED_KEY)
      localStorage.removeItem(LEGACY_SEEN_KEY)
    } catch {}
  }
  return base
}

function loadWorked(): WorkedHours {
  const w = loadJson<WorkedHours>(WORKED_KEY)
  return w && typeof w === "object" ? w : {}
}

export function useShift() {
  const [now, setNow] = useState(() => new Date())
  const [shift, setShift] = useState<ShiftState>(initShift)
  const [worked, setWorked] = useState<WorkedHours>(loadWorked)
  const [hourlyGoal, setHourlyGoalState] = useState<number>(() => {
    const v = Number(localStorage.getItem(HOURLY_GOAL_KEY))
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_HOURLY_GOAL
  })
  const [gps, setGps] = useState<GpsState>({ status: "idle", lastFix: null })
  const [toast, setToast] = useState<string | null>(null)
  const shiftRef = useRef(shift)
  shiftRef.current = shift
  const watchId = useRef<number | null>(null)
  const lastPos = useRef<{ lat: number; lon: number } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const wakeLock = useRef<{ release: () => void } | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  // --- medición por bloques de hora -------------------------------------
  // Mientras se trabaja (turno activo y sin break), el tramo actual se va
  // partiendo en la hora en punto y se guarda en el historial. Al pausar
  // (break) o terminar, se consolida el tramo abierto.
  const commitOpen = useCallback((toMs: number) => {
    const s = shiftRef.current
    if (s.measureStart == null || toMs <= s.measureStart) return
    setWorked((w) => trimWorked(commitWorkedRange(w, s.measureStart as number, toMs), new Date(), KEEP_DAYS))
  }, [])

  // Tick de 1 s: reloj + corte de bloque en la hora en punto + heartbeat.
  useEffect(() => {
    const id = window.setInterval(() => {
      const tick = new Date()
      setNow(tick)
      const s = shiftRef.current
      if (s.active && s.breakStart == null && s.measureStart != null) {
        if (hourKeyOf(new Date(s.measureStart)) !== hourKeyOf(tick)) {
          const boundary = startOfHourMs(tick.getTime())
          setWorked((w) => trimWorked(commitWorkedRange(w, s.measureStart as number, boundary), tick, KEEP_DAYS))
          setShift((cur) => ({ ...cur, measureStart: boundary }))
        }
        if (tick.getTime() - (s.lastSeen ?? 0) > 30_000) {
          setShift((cur) => ({ ...cur, lastSeen: tick.getTime() }))
        }
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Recuperación: si la app se cerró con el turno midiendo, solo se cuenta el
  // tiempo en que la app estuvo viva (hasta el último heartbeat).
  useEffect(() => {
    const s = shiftRef.current
    if (s.active && s.breakStart == null && s.measureStart != null) {
      const seen = s.lastSeen ?? s.measureStart
      const upTo = Math.min(seen, startOfHourMs(Date.now()))
      if (upTo > s.measureStart) {
        setWorked((w) => trimWorked(commitWorkedRange(w, s.measureStart as number, upTo), new Date(), KEEP_DAYS))
      }
      setShift((cur) => ({ ...cur, measureStart: startOfHourMs(Date.now()), lastSeen: Date.now() }))
    } else if (s.active) {
      setShift((cur) => ({ ...cur, lastSeen: Date.now() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persistencia.
  useEffect(() => {
    try {
      localStorage.setItem(SHIFT_KEY, JSON.stringify(shift))
    } catch {}
  }, [shift])
  useEffect(() => {
    try {
      localStorage.setItem(WORKED_KEY, JSON.stringify(worked))
    } catch {}
  }, [worked])

  // --- GPS / wake lock ----------------------------------------------------
  const requestWake = useCallback(() => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => void }> } }
      nav.wakeLock?.request("screen").then((l) => (wakeLock.current = l)).catch(() => {})
    } catch {}
  }, [])
  const releaseWake = useCallback(() => {
    try {
      wakeLock.current?.release()
    } catch {}
    wakeLock.current = null
  }, [])

  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator)) return
    if (watchId.current != null) return
    setGps((g) => ({ ...g, status: "watching" }))
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setShift((s) => {
            if (!s.active) return s
            let miles = s.miles
            if (s.breakStart == null && lastPos.current) {
              const km = haversineKm(lastPos.current.lat, lastPos.current.lon, latitude, longitude)
              if (Number.isFinite(km) && km < 5) miles = Math.round((miles + km * 0.621371) * 100) / 100
            }
            lastPos.current = { lat: latitude, lon: longitude }
            return { ...s, miles }
          })
          setGps({ status: "watching", lastFix: new Date().toLocaleTimeString() })
        },
        () => setGps((g) => ({ ...g, status: "denied" })),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
      )
    } catch {
      setGps((g) => ({ ...g, status: "error" }))
    }
  }, [])

  const stopWatch = useCallback(() => {
    if (watchId.current != null) {
      try {
        navigator.geolocation.clearWatch(watchId.current)
      } catch {}
      watchId.current = null
    }
    lastPos.current = null
    setGps((g) => ({ ...g, status: "idle" }))
  }, [])

  const refreshGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGps((g) => ({ ...g, status: "error" }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastPos.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setGps({ status: "watching", lastFix: new Date().toLocaleTimeString() })
        showToast("📍 GPS listo")
      },
      () => {
        setGps((g) => ({ ...g, status: "denied" }))
        showToast("⚠️ GPS denegado: activa el permiso")
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    )
  }, [showToast])

  // --- acciones -------------------------------------------------------------
  const onStart = useCallback(() => {
    const t = Date.now()
    setShift({ date: dayKey(new Date(t)), active: true, clockIn: t, breakMs: 0, breakStart: null, miles: 0, measureStart: t, lastSeen: t })
    try {
      localStorage.setItem(SHIFT_START_KEY, String(t))
    } catch {}
    requestWake()
    startWatch()
    refreshGps()
    showToast("▶ Turno iniciado — ¡buena suerte!")
  }, [requestWake, startWatch, refreshGps, showToast])

  const onBreak = useCallback(() => {
    const cur = shiftRef.current
    if (!cur.active) return
    const t = Date.now()
    if (cur.breakStart != null) {
      // Terminar break: se reanuda la medición desde ahora.
      setShift({ ...cur, breakMs: cur.breakMs + (t - cur.breakStart), breakStart: null, measureStart: t, lastSeen: t })
      showToast("▶ De vuelta — a darle")
    } else {
      // Empezar break: se consolida el tramo abierto y se pausa la medición.
      commitOpen(t)
      setShift({ ...cur, breakStart: t, measureStart: null, lastSeen: t })
      showToast("⏸️ Break — el reloj se pausa")
    }
  }, [commitOpen, showToast])

  const onEnd = useCallback(() => {
    const cur = shiftRef.current
    if (!cur.active) return
    const t = Date.now()
    commitOpen(t)
    const activeHrs = cur.clockIn != null ? Math.max(0, (t - cur.clockIn - cur.breakMs - (cur.breakStart != null ? t - cur.breakStart : 0)) / 3_600_000) : 0
    try {
      const logs = loadJson<Array<Record<string, unknown>>>(SHIFT_LOG_KEY) ?? []
      logs.push({ date: cur.date, clockIn: cur.clockIn, clockOut: t, activeHrs: Math.round(activeHrs * 100) / 100, miles: cur.miles })
      localStorage.setItem(SHIFT_LOG_KEY, JSON.stringify(logs.slice(-60)))
    } catch {}
    setShift({ ...EMPTY_SHIFT, date: dayKey(new Date(t)) })
    releaseWake()
    stopWatch()
    showToast(`🏁 Turno cerrado: ${activeHrs.toFixed(1)} h · ${cur.miles.toFixed(1)} mi`)
  }, [commitOpen, releaseWake, stopWatch, showToast])

  const setHourlyGoal = useCallback((v: number) => {
    const n = Math.round(Number(v))
    if (!Number.isFinite(n) || n <= 0) return
    setHourlyGoalState(n)
    try {
      localStorage.setItem(HOURLY_GOAL_KEY, String(n))
    } catch {}
  }, [])

  // --- derivados --------------------------------------------------------------
  const isOnBreak = shift.active && shift.breakStart != null
  const working = shift.active && !isOnBreak
  const activeHoursDecimal = useMemo(() => {
    if (!shift.active || shift.clockIn == null) return 0
    const openBreak = shift.breakStart != null ? now.getTime() - shift.breakStart : 0
    const ms = now.getTime() - shift.clockIn - shift.breakMs - openBreak
    return Math.max(0, ms / 3_600_000)
  }, [shift.active, shift.clockIn, shift.breakMs, shift.breakStart, now])

  return {
    now,
    shiftActive: shift.active,
    isOnBreak,
    working,
    measureStart: shift.measureStart,
    activeHoursDecimal,
    shiftMiles: shift.miles,
    hourlyGoal,
    setHourlyGoal,
    gps,
    worked,
    toast,
    onStart,
    onBreak,
    onEnd,
    onRefreshGps: refreshGps,
  }
}

export type ShiftApi = ReturnType<typeof useShift>
