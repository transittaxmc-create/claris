"use client"

import { useEffect, useMemo, useState } from "react"
import { grossOf, type Trip } from "./types"

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

export function hourRangeLabel(h: number): string {
  return `${hour12(h)}–${hour12(h + 1)} ${suffix(h + 1)}`
}

export function HourlyStrip({ trips, amountsVisible }: { trips: Trip[]; amountsVisible: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  const [open, setOpen] = useState(false)

  const currentHour = now.getHours()
  const buckets = useMemo(() => buildHourBuckets(trips, currentHour), [trips, currentHour])
  const dayTotal = useMemo(() => buckets.reduce((s, b) => s + b.total, 0), [buckets])
  const current = buckets[buckets.length - 1]
  const max = Math.max(1, ...buckets.map((b) => b.total))

  const money = (n: number) => `$${Math.round(n)}`
  const masked = "•••"

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl bg-neutral-900/60 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-neutral-500">
            {current ? hourRangeLabel(current.hour) : "—"}
          </span>
          <span className="text-sm font-bold tabular-nums text-white">
            {amountsVisible && current ? money(current.total) : masked}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {buckets.slice(-6).map((b) => {
            const pct = Math.round((b.total / max) * 100)
            const active = b.hour === currentHour
            return (
              <div
                key={b.hour}
                className={`h-5 w-1.5 rounded-sm ${
                  active ? "bg-yellow-400" : b.total > 0 ? "bg-emerald-400/70" : "bg-neutral-800"
                }`}
                style={{ height: active ? 20 : Math.max(6, Math.round((pct / 100) * 16)) }}
              />
            )
          })}
          <span className="ml-1 text-[10px] text-neutral-500">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="mt-1 rounded-xl bg-neutral-900/40 px-3 py-2">
          {buckets.map((b) => (
            <div key={b.hour} className="flex items-center justify-between py-0.5 text-[11px]">
              <span className="font-mono text-neutral-400">{hourRangeLabel(b.hour)}</span>
              <span className="text-neutral-500">{b.trips} viaje{b.trips === 1 ? "" : "s"}</span>
              <span className="w-14 text-right font-mono font-bold tabular-nums text-white">
                {amountsVisible ? money(b.total) : masked}
              </span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-neutral-800 pt-1 text-[11px] font-bold">
            <span className="text-neutral-300">Hoy</span>
            <span className="font-mono tabular-nums text-emerald-300">
              {amountsVisible ? money(dayTotal) : masked}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
