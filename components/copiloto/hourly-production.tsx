"use client"

import { useMemo, useState } from "react"
import { Timer, TrendingUp, Target, Play, Pause, Square, BarChart3, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { netOf, tripDateOf, type Trip } from "./types"
import {
  hourKeyOf,
  hourlyStats,
  hourlyTotals,
  improveAdvice,
  productionThisHour,
  timerReading,
} from "@/lib/production"
import type { ShiftApi } from "./shift"

// Motivador de producción por hora, en formato COMPACTO.
//
// Usa el TURNO UNIFICADO (components/copiloto/shift.ts): el mismo START / PAUSA /
// PARAR que el DASHBOARD. El tiempo de break no cuenta como trabajado y ambas
// pantallas siempre dicen lo mismo.
//
// - ENCENDER = START: empieza el turno (y la medición) desde cero.
// - PAUSA/SEGUIR = BREAK: pausa y reanuda sin cerrar el turno.
// - PARAR = END SHIFT: cierra el turno y la medición vuelve a cero.
// - Cada 60 minutos (al caer la hora en punto) el bloque vuelve a cero solo,
//   para que el número sea siempre "cuánto llevo en esta hora". El bloque
//   anterior queda guardado en MIS HORAS.
//
// IMPORTANTE (posición): este componente devuelve un fragmento con varias piezas
// y está pensado para vivir DENTRO de una cuadrícula de dos columnas, como hijo
// directo. Los dos recuadros ocupan la segunda columna, al lado del box
// REF / INVOICE; el resto se extiende a las dos columnas con `col-span-2`.

export function HourlyProduction({ trips, shift }: { trips: Trip[]; shift: ShiftApi }) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const goal = shift.hourlyGoal
  const now = shift.now

  // Bloque en curso: corre solo mientras se trabaja (turno activo y sin break).
  const timer = timerReading({ now, on: shift.working, startedAt: shift.measureStart })

  const earned = useMemo(() => {
    const list = trips.map((t) => ({ date: tripDateOf(t), time: t.time, net: netOf(t) }))
    return productionThisHour(list, now)
    // now cambia cada segundo: el importe depende de la hora, no del segundo,
    // pero recalcular es barato y mantiene todo coherente al cambiar de hora.
  }, [trips, now])

  // Estadística: lo producido (viajes) cruzado con lo trabajado (turno).
  const stats = useMemo(() => {
    const list = trips.map((t) => ({ date: tripDateOf(t), time: t.time, net: netOf(t) }))
    return hourlyStats({ trips: list, worked: shift.worked })
  }, [trips, shift.worked])

  const todayKey = hourKeyOf(now).slice(0, 10)
  const todayStats = useMemo(() => stats.filter((s) => s.day === todayKey), [stats, todayKey])
  const todayTotals = useMemo(() => hourlyTotals(todayStats, goal), [todayStats, goal])
  const tips = useMemo(() => improveAdvice({ stats, goalRate: goal }), [stats, goal])

  const elapsedPct = Math.min(100, Math.round((timer.elapsedSec / 3600) * 100))
  const mm = String(Math.floor(timer.elapsedSec / 60)).padStart(2, "0")
  const ss = String(timer.elapsedSec % 60).padStart(2, "0")
  const statusLabel = timer.running ? `${timer.remainingMin}m` : shift.isOnBreak ? "PAUSA" : "OFF"

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
            <span className={cn("shrink-0", timer.running ? "text-neutral-500" : shift.isOnBreak ? "text-amber-400" : "text-rose-400")}>
              {statusLabel}
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
          {!shift.shiftActive ? (
            <button
              type="button"
              onClick={shift.onStart}
              title="Empezar el turno: el cronómetro arranca desde cero"
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/10 py-1 text-[8px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <Play className="size-2.5" />
              ENCENDER
            </button>
          ) : (
            <div className="mt-1.5 flex w-full gap-1">
              <button
                type="button"
                onClick={shift.onBreak}
                title={shift.isOnBreak ? "Terminar el break y seguir midiendo" : "Pausar la medición sin cerrar el turno"}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-lg border py-1 text-[8px] font-bold transition-colors",
                  shift.isOnBreak
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
                )}
              >
                <Pause className="size-2.5" />
                {shift.isOnBreak ? "SEGUIR" : "PAUSA"}
              </button>
              <button
                type="button"
                onClick={shift.onEnd}
                title="Cerrar el turno: la medición vuelve a cero"
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/10 py-1 text-[8px] font-bold text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                <Square className="size-2.5" />
                PARAR
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEditingGoal((v) => !v)}
          title="Tocar para ajustar la meta por hora"
          className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-black/25 px-2.5 py-1.5 text-left transition-colors hover:border-neutral-700"
        >
          <div className="flex items-center gap-1 text-[8px] font-bold tracking-wide text-neutral-500">
            <TrendingUp className="size-2.5 text-emerald-400" /> HOY
          </div>
          <div className={cn("text-base font-black leading-tight", shift.shiftActive ? "text-emerald-400" : "text-neutral-500")}>
            ${earned.toFixed(2)}
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
            value={shift.hourlyGoal}
            onChange={(e) => shift.setHourlyGoal(Number(e.target.value))}
            className="min-w-0 flex-1 accent-yellow-400"
          />
          <span className="w-12 shrink-0 text-right text-[11px] font-bold text-yellow-300">${shift.hourlyGoal}/h</span>
        </div>
      )}

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
