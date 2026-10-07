"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { haversineKm } from "./v1-dash-zones"

// Shift model ported intact from IslandCity Driver Accounting v1
// (islandcity.vercel.app). v1 persisted this shape under "ic_shift":
//   { date, active, clockIn, breakMs, breakStart, miles, hourlyGoal }
// Here it lives under "claris_v1dash_shift" so it never collides with v6 keys.
// The hourly goal is shared with the rest of v6 via "claris_hourly_goal"
// (the same key v6's cronómetro already uses), default 60 like v1.

export const V1DASH_SHIFT_KEY = "claris_v1dash_shift"
export const V1DASH_SHIFT_LOG_KEY = "claris_v1dash_shift_logs"
export const V1DASH_SHIFT_START_KEY = "claris_v1dash_shift_start"
export const HOURLY_GOAL_KEY = "claris_hourly_goal"
const DEFAULT_HOURLY_GOAL = 60

export type GpsFix = { lat: number; lng: number; acc?: number }

type ShiftState = {
  date: string
  active: boolean
  clockIn: number | null
  breakMs: number
  breakStart: number | null
  miles: number
}

function loadShift(): ShiftState | null {
  try {
    const raw = localStorage.getItem(V1DASH_SHIFT_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== "object") return null
    return {
      date: typeof p.date === "string" ? p.date : "",
      active: !!p.active,
      clockIn: typeof p.clockIn === "number" ? p.clockIn : null,
      breakMs: typeof p.breakMs === "number" ? p.breakMs : 0,
      breakStart: typeof p.breakStart === "number" ? p.breakStart : null,
      miles: typeof p.miles === "number" ? p.miles : 0,
    }
  } catch {
    return null
  }
}

function loadHourlyGoal(): number {
  try {
    const n = Number(localStorage.getItem(HOURLY_GOAL_KEY))
    if (Number.isFinite(n) && n > 0) return n
  } catch {}
  return DEFAULT_HOURLY_GOAL
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function useV1Shift(now: Date) {
  const [shift, setShift] = useState<ShiftState>(() => ({
    date: dayKey(new Date()),
    active: false,
    clockIn: null,
    breakMs: 0,
    breakStart: null,
    miles: 0,
    ...loadShift(),
  }))
  const [hourlyGoal, setHourlyGoalState] = useState<number>(() => loadHourlyGoal())
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const shiftRef = useRef(shift)
  shiftRef.current = shift
  const watchId = useRef<number | null>(null)
  const lastPos = useRef<{ lat: number; lng: number } | null>(null)
  const wakeLock = useRef<any>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  // Persist on every change (v1 saves ic_shift on each shift-state change).
  useEffect(() => {
    try {
      localStorage.setItem(
        V1DASH_SHIFT_KEY,
        JSON.stringify({ ...shift, hourlyGoal }),
      )
    } catch {}
  }, [shift, hourlyGoal])

  const setHourlyGoal = useCallback((v: number) => {
    setHourlyGoalState(v)
    try {
      localStorage.setItem(HOURLY_GOAL_KEY, String(v))
    } catch {}
  }, [])

  const requestWake = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLock.current = await (navigator as any).wakeLock.request("screen")
      }
    } catch {}
  }, [])

  const releaseWake = useCallback(async () => {
    try {
      await wakeLock.current?.release()
    } catch {}
    wakeLock.current = null
  }, [])

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      try {
        navigator.geolocation.clearWatch(watchId.current)
      } catch {}
      watchId.current = null
    }
    lastPos.current = null
  }, [])

  // Odometer: accumulate miles while on duty via GPS (v1 Ge callback behavior).
  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator) || watchId.current !== null) return
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords
          setGps({ lat: latitude, lng: longitude, acc: accuracy })
          const s = shiftRef.current
          if (!s.active || s.breakStart !== null) {
            lastPos.current = { lat: latitude, lng: longitude }
            return
          }
          const prev = lastPos.current
          lastPos.current = { lat: latitude, lng: longitude }
          if (prev) {
            const km = haversineKm(prev.lat, prev.lng, latitude, longitude)
            if (km < 5) {
              setShift((cur) => ({ ...cur, miles: cur.miles + km * 0.621371 }))
            }
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
      )
    } catch {}
  }, [])

  const refreshGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      showToast("GPS no disponible")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      () => showToast("GPS ERROR"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }, [showToast])

  // v1 onStart (ud)
  const onStart = useCallback(() => {
    const t = Date.now()
    setShift({ date: dayKey(new Date(t)), active: true, clockIn: t, breakMs: 0, breakStart: null, miles: 0 })
    try {
      localStorage.setItem(V1DASH_SHIFT_START_KEY, new Date(t).toISOString())
    } catch {}
    requestWake()
    startWatch()
    refreshGps()
    showToast("▶ Shift iniciado")
  }, [requestWake, startWatch, refreshGps, showToast])

  // v1 onBreak (Qu): toggle break
  const onBreak = useCallback(() => {
    setShift((cur) => {
      if (!cur.active) return cur
      if (cur.breakStart !== null) {
        showToast("▶ Resumed")
        return { ...cur, breakMs: cur.breakMs + (Date.now() - cur.breakStart), breakStart: null }
      }
      showToast("⏸️ Break iniciado")
      return { ...cur, breakStart: Date.now() }
    })
  }, [showToast])

  // v1 onEnd (Pa): close shift, append to shift log
  const onEnd = useCallback(() => {
    const cur = shiftRef.current
    const t = Date.now()
    const curBreak = cur.breakStart !== null ? t - cur.breakStart : 0
    const totalBreak = cur.breakMs + curBreak
    const workingMs = Math.max(t - (cur.clockIn ?? t) - totalBreak, 0)
    try {
      const log = JSON.parse(localStorage.getItem(V1DASH_SHIFT_LOG_KEY) || "[]")
      log.unshift({
        start: new Date(cur.clockIn ?? t).toISOString(),
        end: new Date(t).toISOString(),
        totalElapsedMs: Math.max(t - (cur.clockIn ?? t), 0),
        workingMs,
        breakMs: totalBreak,
        miles: cur.miles,
        sello: new Date().toISOString(),
      })
      localStorage.setItem(V1DASH_SHIFT_LOG_KEY, JSON.stringify(log.slice(0, 200)))
    } catch {}
    releaseWake()
    stopWatch()
    setShift((c) => ({ ...c, active: false, clockIn: null, breakStart: null, breakMs: totalBreak }))
    showToast("■ Shift terminado")
  }, [releaseWake, stopWatch, showToast])

  // v1 activeHoursDecimal (je): (now - clockIn - breakMs - openBreak) / 3.6e6
  const activeHoursDecimal = useMemo(() => {
    if (!shift.active || !shift.clockIn) return 0
    const t = now.getTime()
    const openBreak = shift.breakStart !== null ? Math.max(t - shift.breakStart, 0) : 0
    return Math.max((t - shift.clockIn - shift.breakMs - openBreak) / 36e5, 0)
  }, [shift, now])

  // Resume GPS watch if the shift was already active when the screen mounts.
  useEffect(() => {
    if (shift.active) startWatch()
    return () => stopWatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => stopWatch(), [stopWatch])

  return {
    shiftActive: shift.active,
    isOnBreak: shift.breakStart !== null,
    activeHoursDecimal,
    shiftMiles: shift.miles,
    hourlyGoal,
    setHourlyGoal,
    gps,
    onStart,
    onBreak,
    onEnd,
    onRefreshGps: refreshGps,
    toast,
  }
}
