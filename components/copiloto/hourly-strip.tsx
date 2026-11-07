"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { grossOf, type Trip } from "./types"

// Cajita de producción por hora para TODAY (Miguel, 2026-11-04).
// Compacta, debajo de la línea TODAY, para ver de un vistazo cuánto va
// en la hora en curso sin mirar el cronómetro.
//
// Reglas:
// - Cada punto es una hora en punto (9, 10, 11...). El número es el GROSS
//   de los viajes GUARDADOS en esa hora (el mismo GROSS de arriba).
// - Un viaje en camino todavía no suma: suma cuando se guarda, al
//   completar el drop-off. La hora en curso se llena sola con cada viaje
//   guardado.
// - La línea corre sola para dejar la hora actual a la vista.
// - Al tocar la caja se abre la lista del día hora por hora: esa es la
//   estadística de la noche. Nada de promedios ni metas.
// - Privacidad: si los montos están tapados en TODAY, aquí también se
//   tapan (amountsVisible viene del mismo toque que muestra el GROSS).

export type HourBucket = { hour: number; total: number; trips: number }

export function hourOfTrip(t: Trip): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.time || "")
  if (!m) return null
  const h = Number(m[1])
  if (h < 0 || h > 23) return null
  return h
}

export function buildHourBuckets(trips: Trip[], currentHour: number): HourBucket[] {
  const byHour = new Map<number, { total: number; trips: number }>()
  for (const t of trips) {
    const h = hourOfTrip(t)
    if (h === null) continue
    const e = byHour.get(h) || { total: 0, trips: 0 }
    e.total = Math.round((e.total + grossOf(t)) * 100) / 100
    e.trips += 1
    byHour.set(h, e)
  }
  const hours = [...byHour.keys()]
  const start = hours.length ? Math.min(...hours) : currentHour
  const out: HourBucket[] = []
  for (let h = start; h <= currentHour; h++) {
    const e = byHour.get(h)
    out.push({ hour: h, total: e ? e.total : 0, trips: e ? e.trips : 0 })
  }
  return out
}

function hour12(h: number): number {
  const n = ((h % 24) + 24) % 24
  return n % 12 === 0 ? 12 : n % 12
}

function suffix(h: number): string {
  const n = ((h % 24) + 24) % 24
  return n < 12 ? "AM" : "PM"
}

// "9–10 AM", "11 AM–12 PM", "11 PM–12 AM": la hora en punto, como la dice Miguel.
export function hourRangeLabel(h: number): string {
  return `${hour12(h)} ${suffix(h)}–${hour12(h + 1)} ${suffix(h + 1)}`
}

export function HourlyStrip({ trips, amountsVisible }: { trips: Trip[]; amountsVisible: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentHour = now.getHours()
  const buckets = useMemo(() => buildHourBuckets(trips, currentHour), [trips, currentHour])
  const dayTotal = useMemo(() => buckets.reduce((s, b) => s + b.total, 0), [buckets])
  const current = buckets[buckets.length - 1]
  const minutes = now.getMinutes()

  // La línea se aplana cuando los montos están tapados: la forma no delata cifras.
  const shown = buckets
  const max = Math.max(1, ...shown.map((b) => b.total))

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [buckets.length])

  const money = (n: number) => `$${n.toFixed(2)}`
  const masked = "••••••"

  return (
    <section className="mt-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:col-span-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Ver la producción hora por hora"
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-[0.14em] text-neutral-300">
            PRODUCCIÓN POR HORA
          </span>
          <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold text-yellow-300">
            {open ? "OCULTAR" : "VER DETALLE"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-[1.15fr_0.85fr] gap-2">
          <div className="rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-yellow-200/80">Hora actual</p>
            <p className="mt-0.5 text-[11px] font-semibold text-neutral-200">{current ? hourRangeLabel(current.hour) : "—"}</p>
            <p className="mt-1 font-mono text-xl font-black tabular-nums text-yellow-300">
              {amountsVisible && current ? money(current.total) : masked}
            </p>
            <p className="text-[9px] text-neutral-400">van {minutes} min · {current?.trips ?? 0} viajes</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-black/30 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Total hoy</p>
            <p className="mt-1 font-mono text-xl font-black tabular-nums text-emerald-300">
              {amountsVisible ? money(dayTotal) : masked}
            </p>
            <p className="text-[9px] text-neutral-400">{trips.length} {trips.length === 1 ? "viaje" : "viajes"}</p>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="mt-2 flex items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" 
        >
          {shown.map((b) => {
            const pct = Math.round((b.total / max) * 100)
            const active = b.hour === currentHour
            const barH = Math.max(4, Math.round((pct / 100) * 22))
            const color =
              b.total === 0
                ? "bg-neutral-800"
                : pct >= 75
                  ? "bg-emerald-400"
                  : pct >= 45
                    ? "bg-yellow-400"
                    : pct >= 20
                      ? "bg-orange-400"
                      : "bg-sky-400"
            return (
              <div
                key={b.hour}
                className={`flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-0.5 ${active ? "bg-yellow-400/15 ring-1 ring-yellow-400/50" : ""}`}
              >
                <span className={`text-[7px] font-bold leading-none ${active ? "text-yellow-300" : "text-neutral-500"}`}>
                  {hour12(b.hour)}
                </span>
                <div className="flex h-5 w-full items-end justify-center">
                  <div className={`w-2 rounded-sm ${color}`} style={{ height: barH }} />
                </div>
                <span className={`text-[8px] font-bold tabular-nums leading-none ${b.total > 0 ? "text-white" : "text-neutral-600"}`}>
                  {b.total > 0 ? `$${Math.round(b.total)}` : "—"}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-1 text-center text-[9px] text-neutral-500">
          {trips.length === 0
            ? "Todavía no hay viajes guardados hoy"
            : open
              ? "Toca arriba para cerrar el detalle"
              : "Toca arriba para ver cada hora"}
        </p>
      </button>
      {open && (
        <div className="mt-1 border-t border-neutral-800 pt-1">
          {buckets.map((b) => (
            <div key={b.hour} className="flex items-center justify-between py-0.5 text-[11px]">
              <span className="font-mono text-neutral-400">{hourRangeLabel(b.hour)}</span>
              <span className="text-neutral-500">
                {b.trips} {b.trips === 1 ? "viaje" : "viajes"}
              </span>
              <span className="w-20 text-right font-mono font-bold tabular-nums text-white">
                {amountsVisible ? money(b.total) : masked}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-neutral-800 pt-1 text-[11px] font-bold">
            <span className="text-neutral-300">TOTAL DEL DÍA</span>
            <span className="font-mono tabular-nums text-emerald-300">
              {amountsVisible ? money(dayTotal) : masked}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
