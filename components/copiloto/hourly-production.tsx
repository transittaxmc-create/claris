"use client"

import { useEffect, useMemo, useState } from "react"
import { Timer, TrendingUp, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { netOf, tripDateOf, type Trip } from "./types"
import { hourWindow, hourlyAdvice, productionThisHour } from "@/lib/production"

// Motivador de producción por hora, en formato COMPACTO.
//
// - Cronómetro que se reinicia en cada hora en punto (no acumula entre horas).
// - Caja con lo producido en la hora y lo que falta para la meta.
// - Sugerencia realista: si el ritmo necesario para la meta no es alcanzable a
//   estas alturas, lo dice claramente en vez de pedir algo imposible.
//
// IMPORTANTE (posición): este componente devuelve un fragmento con tres piezas
// y está pensado para vivir DENTRO de una cuadrícula de dos columnas, como hijo
// directo. La primera pieza (los dos recuadros) ocupa la segunda columna, al
// lado del box REF / INVOICE; el deslizador de la meta y la sugerencia se
// extienden a las dos columnas con `col-span-2`.

const GOAL_KEY = "claris_hourly_goal"
const DEFAULT_GOAL = 55

function loadGoal(): number {
  try {
    const raw = Number(localStorage.getItem(GOAL_KEY))
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GOAL
  } catch {
    return DEFAULT_GOAL
  }
}

export function HourlyProduction({ trips }: { trips: Trip[] }) {
  const [now, setNow] = useState<Date>(() => new Date())
  const [goal, setGoal] = useState<number>(() => loadGoal())
  const [editing, setEditing] = useState(false)

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

  const win = useMemo(() => hourWindow(now), [now])

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

  const elapsedPct = Math.min(100, Math.round((win.elapsedMin / 60) * 100))
  const mm = String(Math.floor(win.elapsedSec / 60)).padStart(2, "0")
  const ss = String(win.elapsedSec % 60).padStart(2, "0")

  return (
    <>
      {/* Los dos recuadros: cronómetro + producción de la hora. Van al lado del
          box REF / INVOICE para no llenar la pantalla. */}
      <div className="flex shrink-0 items-stretch gap-1.5">
        <div className="w-[70px] rounded-xl border border-neutral-800 bg-black/25 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[8px] font-bold tracking-wide text-neutral-500">
            <Timer className="size-2.5 text-yellow-400" /> HORA
          </div>
          <div className="font-mono text-base font-black leading-tight text-white">
            {mm}:{ss}
          </div>
          <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-yellow-400 transition-all" style={{ width: `${elapsedPct}%` }} />
          </div>
          <div className="mt-0.5 text-[8px] text-neutral-500">
            {win.remainingMin > 0 ? `quedan ${win.remainingMin}m` : "cerrada"}
          </div>
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
          <div className="text-base font-black leading-tight text-emerald-400">${earned.toFixed(2)}</div>
          <div className="mt-0.5 truncate text-[8px] text-neutral-500">
            {advice.remainingToGoal > 0 ? `faltan $${advice.remainingToGoal.toFixed(2)}` : "meta cumplida"}
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
          toneClass,
        )}
      >
        {advice.message}
      </p>
    </>
  )
}
