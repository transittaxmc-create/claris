"use client"

import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { grossOf, tripDateOf, type Trip } from "./types"

function hourOf(time: string): number | null {
  const m = String(time || "").match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  return h >= 0 && h <= 23 ? h : null
}

function label(h: number): string {
  const next = (h + 1) % 24
  const fmt = (n: number) => String(n).padStart(2, "0")
  return `${fmt(h)}–${fmt(next)}`
}

export function HourlyEarningsChart({
  trips,
  date,
}: {
  trips: Trip[]
  date: string
}) {
  const now = new Date()
  const currentHour = now.getHours()
  const isToday = date === now.toISOString().slice(0, 10) || date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const buckets = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of trips) {
      if (tripDateOf(t) !== date) continue
      const h = hourOf(t.time)
      if (h == null) continue
      map.set(h, (map.get(h) || 0) + grossOf(t))
    }
    // Show from earliest trip hour to latest (or current if today), min 6 hours window
    let minH = 24
    let maxH = -1
    for (const h of map.keys()) {
      minH = Math.min(minH, h)
      maxH = Math.max(maxH, h)
    }
    if (isToday) {
      minH = Math.min(minH, currentHour)
      maxH = Math.max(maxH, currentHour)
    }
    if (minH > maxH) {
      minH = isToday ? Math.max(0, currentHour - 2) : 8
      maxH = isToday ? Math.min(23, currentHour + 3) : 20
    }
    // Expand a bit for context
    minH = Math.max(0, minH - 1)
    maxH = Math.min(23, maxH + 1)

    const list: { hour: number; amount: number }[] = []
    for (let h = minH; h <= maxH; h++) {
      list.push({ hour: h, amount: Math.round((map.get(h) || 0) * 100) / 100 })
    }
    return list
  }, [trips, date, isToday, currentHour])

  const maxAmt = Math.max(1, ...buckets.map((b) => b.amount))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current || !isToday) return
    const el = scrollRef.current.querySelector(`[data-hour="${currentHour}"]`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
  }, [currentHour, isToday, buckets.length])

  if (buckets.length === 0) return null

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wide text-neutral-500">GROSS BY HOUR</span>
        <span className="text-[9px] text-neutral-600">$ per hour block</span>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {buckets.map((b) => {
          const pct = Math.round((b.amount / maxAmt) * 100)
          const active = isToday && b.hour === currentHour
          const color =
            b.amount === 0
              ? "bg-neutral-800"
              : pct >= 80
                ? "bg-emerald-500"
                : pct >= 50
                  ? "bg-yellow-400"
                  : pct >= 25
                    ? "bg-orange-400"
                    : "bg-sky-500"
          return (
            <div
              key={b.hour}
              data-hour={b.hour}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl border px-1 py-1.5",
                active ? "border-yellow-400/70 bg-yellow-400/10" : "border-neutral-800 bg-neutral-950/50",
              )}
            >
              <span className={cn("text-[9px] font-bold", active ? "text-yellow-300" : "text-neutral-500")}>
                {label(b.hour)}
              </span>
              <div className="flex h-16 w-full items-end justify-center">
                <div
                  className={cn("w-3.5 rounded-sm transition-all", color)}
                  style={{ height: `${Math.max(4, pct)}%` }}
                />
              </div>
              <span className={cn("text-[10px] font-bold tabular-nums", b.amount > 0 ? "text-white" : "text-neutral-600")}>
                ${b.amount.toFixed(0)}
              </span>
            </div>
          )
        })}
      </div>
      {isToday && (
        <p className="mt-1 text-[9px] text-neutral-600">
          Current hour {label(currentHour)} updates as you complete trips.
        </p>
      )}
    </section>
  )
}
