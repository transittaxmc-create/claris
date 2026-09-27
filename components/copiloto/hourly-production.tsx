"use client"

import { useEffect, useMemo, useState } from "react"
import { Timer, TrendingUp, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { netOf, tripDateOf, type Trip } from "./types"
import { hourWindow, hourlyAdvice, productionThisHour } from "@/lib/production"

// Motivador de producción por hora.
//
// - Cronómetro que se reinicia en cada hora en punto (no acumula entre horas).
// - Caja con lo producido en la hora y el ritmo proyectado ($/h).
// - Sugerencia realista: si el ritmo necesario para la meta no es alcanzable a
//   estas alturas, lo dice claramente en vez de pedir algo imposible.

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

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-400">
          <Timer className="size-3.5 text-yellow-400" /> PRODUCCIÓN DE ESTA HORA
        </p>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-neutral-700 px-2 py-0.5 text-[9px] font-bold text-neutral-400 hover:text-white"
          title="Ajustar la meta por hora"
        >
          <Target className="size-2.5" /> META ${goal}/h
        </button>
      </div>

      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="flex-1 accent-yellow-400"
          />
          <span className="w-10 text-right text-[11px] font-bold text-yellow-300">${goal}</span>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        {/* Cronómetro de la hora en curso */}
        <div className="rounded-xl border border-neutral-800 bg-black/25 p-2">
          <div className="text-[9px] font-bold text-neutral-500">CRONÓMETRO · {win.label}</div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-black text-white">
              {String(Math.floor(win.elapsedSec / 60)).padStart(2, "0")}:
              {String(win.elapsedSec % 60).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-neutral-500">/ 60:00</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-yellow-400 transition-all" style={{ width: `${elapsedPct}%` }} />
          </div>
          <div className="mt-1 text-[9px] text-neutral-500">
            {win.remainingMin > 0 ? `quedan ${win.remainingMin} min` : "hora cerrada"}
          </div>
        </div>

        {/* Producción de la hora y ritmo */}
        <div className="rounded-xl border border-neutral-800 bg-black/25 p-2">
          <div className="text-[9px] font-bold text-neutral-500">PRODUCIENDO / HORA</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-400">${earned.toFixed(2)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-400">
            <TrendingUp className="size-3" />
            {advice.projectedRate !== null ? (
              <span>
                ritmo <strong className="text-neutral-200">${advice.projectedRate.toFixed(0)}/h</strong>
              </span>
            ) : (
              <span>calculando ritmo…</span>
            )}
          </div>
          <div className="mt-1 text-[9px] text-neutral-500">
            {advice.remainingToGoal > 0 ? `faltan $${advice.remainingToGoal.toFixed(2)}` : "meta cumplida"}
            {advice.neededRate !== null && advice.remainingToGoal > 0
              ? ` · necesitarías $${advice.neededRate.toFixed(0)}/h`
              : ""}
          </div>
        </div>
      </div>

      {/* Sugerencia realista */}
      <p className={cn("mt-2 rounded-xl border px-2.5 py-2 text-[10px] font-semibold leading-snug", toneClass)}>
        {advice.message}
      </p>
    </section>
  )
}
