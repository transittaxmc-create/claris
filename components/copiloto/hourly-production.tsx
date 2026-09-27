"use client"

import { useEffect, useMemo, useState } from "react"
import { Timer, TrendingUp, Target, Play, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { netOf, tripDateOf, type Trip } from "./types"
import { hourWindow, hourlyAdvice, productionThisHour, timerReading } from "@/lib/production"

// Motivador de producción por hora, en formato COMPACTO.
//
// - Cronómetro que se reinicia en cada hora en punto (no acumula entre horas).
// - Botón de ENCENDER / PARAR: cuando el conductor termina de trabajar apaga el
//   cronómetro y el tiempo deja de correr, aunque la hora siga avanzando. Al
//   volver a encenderlo sigue contando la hora en curso. El estado se guarda en
//   el teléfono, así que sobrevive a recargar la pantalla.
// - Caja con lo producido en la hora y lo que falta para la meta.
// - Sugerencia realista: si el ritmo necesario para la meta no es alcanzable a
//   estas alturas, lo dice claramente en vez de pedir algo imposible. Con el
//   cronómetro apagado no mete presión: avisa que está apagado.
//
// IMPORTANTE (posición): este componente devuelve un fragmento con tres piezas
// y está pensado para vivir DENTRO de una cuadrícula de dos columnas, como hijo
// directo. La primera pieza (los dos recuadros) ocupa la segunda columna, al
// lado del box REF / INVOICE; el deslizador de la meta y la sugerencia se
// extienden a las dos columnas con `col-span-2`.

const GOAL_KEY = "claris_hourly_goal"
const TIMER_ON_KEY = "claris_timer_on"
const TIMER_STOPPED_KEY = "claris_timer_stopped_at"
const DEFAULT_GOAL = 55

function loadGoal(): number {
  try {
    const raw = Number(localStorage.getItem(GOAL_KEY))
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GOAL
  } catch {
    return DEFAULT_GOAL
  }
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

function loadStoppedAt(): number | null {
  try {
    const raw = Number(localStorage.getItem(TIMER_STOPPED_KEY))
    return Number.isFinite(raw) && raw > 0 ? raw : null
  } catch {
    return null
  }
}

export function HourlyProduction({ trips }: { trips: Trip[] }) {
  const [now, setNow] = useState<Date>(() => new Date())
  const [goal, setGoal] = useState<number>(() => loadGoal())
  const [editing, setEditing] = useState(false)
  const [timerOn, setTimerOn] = useState<boolean>(() => loadTimerOn())
  const [stoppedAt, setStoppedAt] = useState<number | null>(() => loadStoppedAt())

  // El cronómetro avanza cada segundo; al cambiar la hora el cálculo se
  // reinicia solo, porque la ventana se deriva de `now`.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(GOAL_KEY, String(goal))
    } catch {}
  }, [goal])

  useEffect(() => {
    try {
      localStorage.setItem(TIMER_ON_KEY, timerOn ? "1" : "0")
      if (timerOn) localStorage.removeItem(TIMER_STOPPED_KEY)
      else if (stoppedAt !== null) localStorage.setItem(TIMER_STOPPED_KEY, String(stoppedAt))
    } catch {}
  }, [timerOn, stoppedAt])

  const win = useMemo(() => hourWindow(now), [now])
  const timer = useMemo(() => timerReading({ now, on: timerOn, stoppedAt }), [now, timerOn, stoppedAt])

  const earned = useMemo(() => {
    const list = trips.map((t) => ({ date: tripDateOf(t), time: t.time, net: netOf(t) }))
    return productionThisHour(list, now)
    // now cambia cada segundo: el importe depende de la hora, no del segundo,
    // pero recalcular es barato y mantiene todo coherente al cambiar de hora.
  }, [trips, now])

  const advice = useMemo(() => hourlyAdvice(earned, win, goal), [earned, win, goal])

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
    : `⏸ Cronómetro apagado: el reloj no corre. Esta hora llevas $${earned.toFixed(2)}. Enciéndelo cuando vuelvas a trabajar.`

  const elapsedPct = Math.min(100, Math.round((timer.elapsedSec / 3600) * 100))
  const mm = String(Math.floor(timer.elapsedSec / 60)).padStart(2, "0")
  const ss = String(timer.elapsedSec % 60).padStart(2, "0")

  function toggleTimer() {
    if (timerOn) {
      setStoppedAt(Date.now())
      setTimerOn(false)
    } else {
      setStoppedAt(null)
      setTimerOn(true)
    }
  }

  return (
    <>
      {/* Los dos recuadros: cronómetro con su botón de encender/parar, y la
          producción de la hora. Van al lado del box REF / INVOICE. */}
      <div className="flex shrink-0 items-stretch gap-1.5">
        <div className="flex w-[74px] flex-col rounded-xl border border-neutral-800 bg-black/25 px-2 py-1.5">
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
              timer.running ? "text-white" : "text-neutral-500",
            )}
          >
            {mm}:{ss}
          </div>
          <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className={cn("h-full transition-all", timer.running ? "bg-yellow-400" : "bg-neutral-600")}
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={toggleTimer}
            title={timerOn ? "Parar el cronómetro porque terminé de trabajar" : "Encender el cronómetro para trabajar"}
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
          onClick={() => setEditing((v) => !v)}
          title="Tocar para ajustar la meta por hora"
          className="w-[84px] rounded-xl border border-neutral-800 bg-black/25 px-2 py-1.5 text-left transition-colors hover:border-neutral-700"
        >
          <div className="flex items-center gap-1 text-[8px] font-bold tracking-wide text-neutral-500">
            <TrendingUp className="size-2.5 text-emerald-400" /> $ / HORA
          </div>
          <div className={cn("text-base font-black leading-tight", timerOn ? "text-emerald-400" : "text-neutral-500")}>
            ${earned.toFixed(2)}
          </div>
          <div className="mt-0.5 truncate text-[8px] text-neutral-500">
            {!timerOn
              ? "en pausa"
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
      {editing && (
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
        className={cn(
          "col-span-2 rounded-xl border px-2.5 py-1.5 text-[9px] font-semibold leading-snug",
          adviceClass,
        )}
      >
        {adviceMessage}
      </p>
    </>
  )
}
