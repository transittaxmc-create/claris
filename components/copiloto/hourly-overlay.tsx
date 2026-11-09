"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, X } from "lucide-react"
import { localDateKey } from "@/lib/dates"
import { money, type Trip } from "./types"
import { buildHourBuckets, hourRangeLabel } from "./hourly-strip"

// Cuadro sobrepuesto de producción por hora (Miguel, 2026-11-09): vive en
// EARNINGS, se abre con un botón y se cierra. NO cubre toda la pantalla —
// es un panel sobrepuesto para ver el detalle hora por hora con números
// grandes y claros y poder analizar. Antes esto era un strip fijo debajo
// del SAVE en TODAY; Miguel pidió moverlo aquí y quitarlo de TODAY.
export function HourlyOverlay({
  trips,
  dateKey,
  onClose,
}: {
  trips: Trip[]
  dateKey: string
  onClose: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const isToday = dateKey === localDateKey(now)
  const currentHour = now.getHours()
  const minutesElapsed = now.getMinutes()

  const buckets = useMemo(() => {
    const all = buildHourBuckets(trips, isToday ? currentHour : 23)
    if (isToday) return all
    // Día pasado: se recortan las horas vacías del final del día.
    let end = all.length
    while (end > 0 && all[end - 1].trips === 0 && all[end - 1].total === 0) end--
    return all.slice(0, end)
  }, [trips, isToday, currentHour])

  const dayTotal = useMemo(() => buckets.reduce((s, b) => s + b.total, 0), [buckets])
  const totalTrips = useMemo(() => buckets.reduce((s, b) => s + b.trips, 0), [buckets])
  const max = Math.max(1, ...buckets.map((b) => b.total))
  const current = isToday ? buckets[buckets.length - 1] : undefined

  const dateLabel = new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[84dvh] w-full max-w-md flex-col rounded-t-2xl border border-neutral-700 bg-neutral-950 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del panel */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-yellow-400" />
            <h2 className="text-sm font-extrabold tracking-wide text-white">HOURLY</h2>
            <span className="text-xs font-semibold text-neutral-400">{dateLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hourly"
            className="rounded-lg p-1 text-neutral-400"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Resumen en números grandes */}
        <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-neutral-800 px-4 py-3">
          <div>
            <p className="text-[9px] font-bold tracking-widest text-neutral-500">
              {isToday && current ? `NOW · ${hourRangeLabel(current.hour)}` : "TOTAL"}
            </p>
            <p className="font-mono text-xl font-black tabular-nums text-yellow-300">
              {money(isToday && current ? current.total : dayTotal)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-widest text-neutral-500">DAY TOTAL</p>
            <p className="font-mono text-xl font-black tabular-nums text-emerald-300">{money(dayTotal)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-widest text-neutral-500">
              {isToday ? "ELAPSED" : "TRIPS"}
            </p>
            <p className="font-mono text-xl font-black tabular-nums text-white">
              {isToday ? `${minutesElapsed} min` : totalTrips}
            </p>
          </div>
        </div>

        {/* Detalle hora por hora */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {buckets.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">No trips recorded for this day.</p>
          ) : (
            buckets.map((b) => {
              const active = isToday && b.hour === currentHour
              return (
                <div
                  key={b.hour}
                  className={`flex items-center gap-3 px-4 py-2 ${active ? "bg-yellow-400/10" : ""}`}
                >
                  <span className="w-[86px] shrink-0 font-mono text-[13px] font-semibold text-neutral-300">
                    {hourRangeLabel(b.hour)}
                  </span>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${active ? "bg-yellow-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.max(0, Math.round((b.total / max) * 100))}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-neutral-500">
                    {b.trips} trip{b.trips === 1 ? "" : "s"}
                  </span>
                  <span className="w-[78px] shrink-0 text-right font-mono text-[15px] font-extrabold tabular-nums text-white">
                    {money(b.total)}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Total al pie del panel */}
        <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 px-4 py-3">
          <span className="text-xs font-bold tracking-wide text-neutral-400">
            TOTAL · {totalTrips} trip{totalTrips === 1 ? "" : "s"}
          </span>
          <span className="font-mono text-lg font-black tabular-nums text-emerald-300">{money(dayTotal)}</span>
        </div>
      </div>
    </div>
  )
}
