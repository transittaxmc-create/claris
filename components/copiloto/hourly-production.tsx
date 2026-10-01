"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Timer, TrendingUp, Target, Play, Square, BarChart3, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { netOf, tripDateOf, type Trip } from "./types"
import {
  commitWorkedRange,
  hourKeyOf,
  hourlyAdvice,
  hourlyStats,
  hourlyTotals,
  hourWindow,
  improveAdvice,
  productionThisHour,
  startOfHourMs,
  timerReading,
  trimWorked,
  type WorkedHours,
} from "@/lib/production"

// Motivador de producción por hora, en formato COMPACTO.
//
// Cronómetro por bloques de una hora:
// - Al ENCENDER empieza a contar desde cero.
// - Al PARAR vuelve a cero (se apaga y se limpia).
// - Cada 60 minutos (al caer la hora en punto) vuelve a cero solo y arranca un
//   bloque nuevo, para que el número sea siempre "cuánto llevo en esta hora".
// - Lo trabajado de cada hora se guarda en el teléfono y se cruza con los viajes
//   para sacar la estadística por hora y los consejos de mejora.
//
// IMPORTANTE (posición): este componente devuelve un fragmento con varias piezas
// y está pensado para vivir DENTRO de una cuadrícula de dos columnas, como hijo
// directo. Los dos recuadros ocupan la segunda columna, al lado del box
// REF / INVOICE; el resto se extiende a las dos columnas con `col-span-2`.

const GOAL_KEY = "claris_hourly_goal"
const TIMER_ON_KEY = "claris_timer_on"
const TIMER_STARTED_KEY = "claris_timer_started_at"
const TIMER_SEEN_KEY = "claris_timer_last_seen"
const WORKED_KEY = "claris_hours_worked"
const KEEP_DAYS = 30
const DEFAULT_GOAL = 55

function loadNumber(key: string): number | null {
  try {
    const raw = Number(localStorage.getItem(key))
    return Number.isFinite(raw) && raw > 0 ? raw : null
  } catch {
    return null
  }
}

function loadGoal(): number {
  return loadNumber(GOAL_KEY) ?? DEFAULT_GOAL
}

// Por defecto el cronómetro está encendido: si el conductor nunca toca el botón,
// todo funciona como antes.
function loadTimerOn(): boolean {
  try {
    return localStorage.getItem(TIMER_ON_KEY) !== "0"
  } catch {
    return true
  }
}

function loadWorked(): WorkedHours {
  try {
    const raw = localStorage.getItem(WORKED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: WorkedHours = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const secs = Math.floor(Number(value))
      if (Number.isFinite(secs) && secs > 0) out[key] = Math.min(3600, secs)
    }
    return out
  } catch {
    return {}
  }
}

export function HourlyProduction({ trips }: { trips: Trip[] }) {
  const [now, setNow] = useState<Date>(() => new Date())
  const [goal, setGoal] = useState<number>(() => loadGoal())
  const [editingGoal, setEditingGoal] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [timerOn, setTimerOn] = useState<boolean>(() => loadTimerOn())
  const [startedAt, setStartedAt] = useState<number | null>(() => loadNumber(TIMER_STARTED_KEY))
  const [worked, setWorked] = useState<WorkedHours>(() => loadWorked())
  // Última hora vista: sirve para detectar el cambio de hora sin repetir trabajo.
  const lastHourKey = useRef<string>(hourKeyOf(new Date()))
  const recoveryDone = useRef(false)

  // Al abrir: si el cronómetro quedó encendido y la app estuvo cerrada, se
  // guardan las horas completas que quedaron a medias (hasta el último latido).
  useEffect(() => {
    if (recoveryDone.current) return
    recoveryDone.current = true
    const seen = loadNumber(TIMER_SEEN_KEY)
    if (!timerOn || startedAt === null || seen === null || seen <= startedAt) return
    const currentHourStart = startOfHourMs(Date.now())
    const upTo = Math.min(seen, currentHourStart)
    if (upTo <= startedAt) return
    setWorked((current) => trimWorked(commitWorkedRange(current, startedAt, upTo), new Date(), KEEP_DAYS))
    setStartedAt(currentHourStart)
  }, [timerOn, startedAt])

  // El reloj avanza cada segundo. Al caer la hora en punto se cierra el bloque
  // anterior (queda guardado) y el nuevo arranca en cero.
  useEffect(() => {
    const id = window.setInterval(() => {
      const tick = new Date()
      setNow(tick)
      if (!timerOn) return
      const key = hourKeyOf(tick)
      if (key !== lastHourKey.current) {
        const boundary = startOfHourMs(tick.getTime())
        setWorked((current) => trimWorked(commitWorkedRange(current, startedAt ?? boundary, boundary), tick, KEEP_DAYS))
        setStartedAt(boundary)
        lastHourKey.current = key
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerOn, startedAt])

  // Guardado: meta, estado del cronómetro y latido. El latido cada 30 s permite
  // recuperar las horas a medias si la app se cierra de golpe.
  useEffect(() => {
    try {
      localStorage.setItem(GOAL_KEY, String(goal))
      localStorage.setItem(TIMER_ON_KEY, timerOn ? "1" : "0")
      if (timerOn && startedAt !== null) {
        localStorage.setItem(TIMER_STARTED_KEY, String(startedAt))
        const seen = loadNumber(TIMER_SEEN_KEY) ?? 0
        if (Date.now() - seen > 30_000) localStorage.setItem(TIMER_SEEN_KEY, String(Date.now()))
      } else {
        localStorage.removeItem(TIMER_STARTED_KEY)
        localStorage.removeItem(TIMER_SEEN_KEY)
      }
    } catch {}
  }, [goal, timerOn, startedAt, now])

  useEffect(() => {
    try {
      localStorage.setItem(WORKED_KEY, JSON.stringify(worked))
    } catch {}
  }, [worked])

  const win = useMemo(() => hourWindow(now), [now])
  const timer = useMemo(() => timerReading({ now, on: timerOn, startedAt }), [now, timerOn, startedAt])

  const earned = useMemo(() => {
    const list = trips.map((t) => ({ date: tripDateOf(t), time: t.time, net: netOf(t) }))
    return productionThisHour(list, now)
    // now cambia cada segundo: el importe depende de la hora, no del segundo,
    // pero recalcular es barato y mantiene todo coherente al cambiar de hora.
  }, [trips, now])

  const advice = useMemo(() => hourlyAdvice(earned, win, goal), [earned, win, goal])

  // Estadística: lo producido (viajes) cruzado con lo trabajado (cronómetro).
  const stats = useMemo(() => {
    const list = trips.map((t) => ({ date: tripDateOf(t), time: t.time, net: netOf(t) }))
    return hourlyStats({ trips: list, worked })
  }, [trips, worked])

  const todayKey = hourKeyOf(now).slice(0, 10)
  const todayStats = useMemo(() => stats.filter((s) => s.day === todayKey), [stats, todayKey])
  const todayTotals = useMemo(() => hourlyTotals(todayStats, goal), [todayStats, goal])
  const tips = useMemo(() => improveAdvice({ stats, goalRate: goal }), [stats, goal])

  const toneClass =
    advice.tone === "goal-met"
      ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-300"
      : advice.tone === "on-track"
        ? "border-emerald-500/30 bg-emerald-950/15 text-emerald-300"
        : advice.tone === "reachable"
          ? "border-amber-500/40 bg-amber-950/20 text-amber-200"
          : "border-rose-500/40 bg-rose-950/20 text-rose-200"

  // Con el cronómetro apagado no se empuja a producir: se informa y se recuerda
  // encenderlo al volver.
  const adviceClass = timerOn ? toneClass : "border-neutral-700 bg-neutral-900/60 text-neutral-300"
  const adviceMessage = timerOn
    ? advice.message
    : `⏸ Cronómetro apagado y en cero. Esta hora llevas $${earned.toFixed(2)}. Enciéndelo cuando vuelvas a trabajar.`

  const elapsedPct = Math.min(100, Math.round((timer.elapsedSec / 3600) * 100))
  const mm = String(Math.floor(timer.elapsedSec / 60)).padStart(2, "0")
  const ss = String(timer.elapsedSec % 60).padStart(2, "0")

  // PARAR: guarda lo trabajado del bloque y vuelve a cero.
  function stopTimer() {
    const stoppedAt = Date.now()
    if (startedAt !== null && stoppedAt > startedAt) {
      setWorked((current) => trimWorked(commitWorkedRange(current, startedAt, stoppedAt), new Date(), KEEP_DAYS))
    }
    setTimerOn(false)
    setStartedAt(null)
  }

  // ENCENDER: bloque nuevo, contando desde cero.
  function startTimer() {
    const started = Date.now()
    setStartedAt(started)
    lastHourKey.current = hourKeyOf(new Date(started))
    setTimerOn(true)
  }

  return (
    <>
      {/* Los dos recuadros: cronómetro con su botón de encender/parar, y la
          producción de la hora. Van al lado del box REF / INVOICE. */}
      <div className="flex min-w-0 w-full items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-800 bg-black/25 px-2.5 py-1.5">
          <div className="flex items-center justify-between gap-1 text-[8px] font-bold tracking-wide text-neutral-500">
            <span className="flex items-center gap-1">
              <Timer className={cn("size-2.5", timer.running ? "text-yellow-400" : "text-neutral-600")} /> HORA
            </span>
            <span className={cn("shrink-0", timer.running ? "text-neutral-500" : "text-rose-400")}>
              {timer.running ? `${timer.remainingMin}m` : "OFF"}
            </span>
          </div>
          <div
            className={cn(
              "font-mono text-base font-black leading-tight",
              timer.running ? "text-white" : "text-neutral-600",
            )}
          >
            {mm}:{ss}
          </div>
          <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className={cn("h-full transition-all", timer.running ? "bg-yellow-400" : "bg-neutral-700")}
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={timerOn ? stopTimer : startTimer}
            title={timerOn ? "Parar y volver a cero porque terminé de trabajar" : "Encender el cronómetro desde cero"}
            className={cn(
              "mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border py-1 text-[8px] font-bold transition-colors",
              timerOn
                ? "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
            )}
          >
            {timerOn ? <Square className="size-2.5" /> : <Play className="size-2.5" />}
            {timerOn ? "PARAR" : "ENCENDER"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setEditingGoal((v) => !v)}
          title="Tocar para ajustar la meta por hora"
          className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-black/25 px-2.5 py-1.5 text-left transition-colors hover:border-neutral-700"
        >
          <div className="flex items-center gap-1 text-[8px] font-bold tracking-wide text-neutral-500">
            <TrendingUp className="size-2.5 text-emerald-400" /> $ / HORA
          </div>
          <div className={cn("text-base font-black leading-tight", timerOn ? "text-emerald-400" : "text-neutral-500")}>
            ${earned.toFixed(2)}
          </div>
          <div className="mt-0.5 truncate text-[8px] text-neutral-500">
            {!timerOn
              ? "en cero"
              : advice.remainingToGoal > 0
                ? `faltan $${advice.remainingToGoal.toFixed(2)}`
                : "meta cumplida"}
          </div>
          <div className="mt-0.5 flex items-center gap-0.5 text-[8px] font-bold text-yellow-400/90">
            <Target className="size-2.5" /> META ${goal}
          </div>
        </button>
      </div>

      {/* Ajuste de la meta (se abre al tocar el recuadro de $ / HORA) */}
      {editingGoal && (
        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
          <Target className="size-3 shrink-0 text-yellow-400" />
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="min-w-0 flex-1 accent-yellow-400"
          />
          <span className="w-12 shrink-0 text-right text-[11px] font-bold text-yellow-300">${goal}/h</span>
        </div>
      )}

      {/* Sugerencia realista, en una línea y a todo el ancho */}
      <p
        className={cn("col-span-2 rounded-xl border px-2.5 py-1.5 text-[9px] font-semibold leading-snug", adviceClass)}
      >
        {adviceMessage}
      </p>

      {/* Estadística por hora + cómo mejorar */}
      <button
        type="button"
        onClick={() => setShowStats((v) => !v)}
        aria-expanded={showStats}
        className="col-span-2 flex items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-2.5 py-1.5 text-[9px] font-bold text-neutral-300 transition-colors hover:border-neutral-600"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <BarChart3 className="size-3 shrink-0 text-yellow-400" /> MIS HORAS
          {todayTotals.measuredHours > 0 && (
            <span className="truncate font-semibold text-neutral-500">
              hoy ${todayTotals.produced.toFixed(2)} ·{" "}
              {todayTotals.rate !== null ? `$${todayTotals.rate.toFixed(0)}/h` : "sin tiempo"}
            </span>
          )}
        </span>
        <span className="shrink-0 text-neutral-500">{showStats ? "ocultar" : "ver"}</span>
      </button>

      {showStats && (
        <div className="col-span-2 space-y-2 rounded-xl border border-neutral-800 bg-black/30 p-2.5">
          {/* Hoy, hora por hora */}
          <div>
            <p className="text-[9px] font-bold tracking-wide text-neutral-400">HOY · HORA POR HORA</p>
            {todayStats.length === 0 ? (
              <p className="mt-1 text-[9px] text-neutral-500">
                Todavía no hay horas de hoy. Deja el cronómetro encendido mientras trabajas.
              </p>
            ) : (
              <div className="mt-1 flex flex-col">
                {todayStats.map((stat) => (
                  <div
                    key={stat.key}
                    className="flex items-center justify-between gap-2 border-b border-neutral-900 py-1 text-[10px] last:border-b-0"
                  >
                    <span className="font-mono text-neutral-400">{stat.label.slice(0, 5)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-neutral-500">
                        {stat.workedMin > 0 ? `${Math.round(stat.workedMin)}m` : "sin tiempo"}
                      </span>
                      <span
                        className={cn(
                          "w-14 text-right font-bold",
                          stat.rate === null
                            ? "text-neutral-400"
                            : stat.rate >= goal
                              ? "text-emerald-400"
                              : "text-amber-300",
                        )}
                      >
                        {stat.rate === null ? "—" : `$${stat.rate.toFixed(0)}/h`}
                      </span>
                      <span className="w-16 text-right font-extrabold text-white">${stat.produced.toFixed(2)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {todayStats.length > 0 && (
              <p className="mt-1.5 text-[9px] font-semibold text-neutral-400">
                HOY: <span className="text-white">${todayTotals.produced.toFixed(2)}</span> en{" "}
                {(todayTotals.workedMin / 60).toFixed(1)} h medidas · ritmo{" "}
                <span className="text-yellow-300">
                  {todayTotals.rate !== null ? `$${todayTotals.rate.toFixed(0)}/h` : "sin tiempo medido"}
                </span>{" "}
                · meta en {todayTotals.goalHours} de {todayTotals.measuredHours} horas
              </p>
            )}
          </div>

          {/* Cómo mejorar, con los números reales */}
          <div className="border-t border-neutral-800 pt-2">
            <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-wide text-yellow-300">
              <Lightbulb className="size-3" /> CÓMO MEJORAR
            </p>
            <div className="mt-1 flex flex-col gap-1.5">
              {tips.map((tip) => (
                <div key={tip.title} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2">
                  <p className="text-[10px] font-bold text-neutral-100">{tip.title}</p>
                  <p className="mt-0.5 text-[9px] leading-snug text-neutral-400">{tip.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
