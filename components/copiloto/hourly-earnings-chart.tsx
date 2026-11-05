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

function shortLabel(h: number): string {
  const next = (h + 1) % 24
  return `${h}-${next}`
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
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const isToday = date === todayStr

  const buckets = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of trips) {
      if (tripDateOf(t) !== date) continue
      const h = hourOf(t.time)
      if (h == null) continue
      map.set(h, (map.get(h) || 0) + grossOf(t))
    }
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
      minH = isToday ? Math.max(0, currentHour - 1) : 8
      maxH = isToday ? Math.min(23, currentHour + 2) : 18
    }
    minH = Math.max(0, minH)
    maxH = Math.min(23, maxH)

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
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [currentHour, isToday, buckets.length])

  if (buckets.length === 0) return null

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 px-2 py-1.5">
      <div
        ref={scrollRef}
        className="flex items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {buckets.map((b) => {
          const pct = Math.round((b.amount / maxAmt) * 100)
          const active = isToday && b.hour === currentHour
          const barH = Math.max(6, Math.round((pct / 100) * 28))
          const color =
            b.amount === 0
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
              data-hour={b.hour}
              className={cn(
                "flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1",
                active && "bg-yellow-400/15 ring-1 ring-yellow-400/60",
              )}
            >
              <span className={cn("text-[8px] font-bold leading-none", active ? "text-yellow-300" : "text-neutral-500")}>
                {shortLabel(b.hour)}
              </span>
              <div className="flex h-7 w-full items-end justify-center">
                <div className={cn("w-2.5 rounded-sm", color)} style={{ height: barH }} />
              </div>
              <span className={cn("text-[9px] font-bold tabular-nums leading-none", b.amount > 0 ? "text-white" : "text-neutral-600")}>
                {b.amount > 0 ? `$${Math.round(b.amount)}` : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
