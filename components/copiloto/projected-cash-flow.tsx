"use client"

/**
 * Shared PROJECTED REGISTER — forecast book (not per-account statement).
 * Bank available → recurring/proj income & expense → projected balance.
 * Newest days first so the latest movement is visible when the app opens.
 */

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry } from "./types"

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

function parseLocalDate(iso: string): Date {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function weekdayLabel(iso: string): string {
  return WEEKDAY[parseLocalDate(iso).getDay()]
}

function shortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

type FlowKind = "real" | "proj" | "due"

interface FlowLine {
  id: string
  date: string
  kind: FlowKind
  label: string
  amount: number
  entry?: CashFlowEntry
}

export function ProjectedCashFlow(props: {
  availableNow: number
  entries: CashFlowEntry[]
  dues?: Array<{ date: string; label: string; amount: number }>
  days?: number
  onEditEntry?: (e: CashFlowEntry) => void
}) {
  const horizon = props.days ?? 14

  const { groups, endBalance } = useMemo(() => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const end = new Date(today)
    end.setDate(end.getDate() + horizon)

    const lines: FlowLine[] = []

    for (const e of props.entries) {
      const d = String(e.date || "")
      if (!d) continue
      const dt = parseLocalDate(d)
      if (dt < today || dt > end) continue
      const amt = Math.abs(Number(e.amount) || 0)
      if (!amt) continue
      const isIncome = e.type === "income"
      lines.push({
        id: e.id,
        date: d.slice(0, 10),
        kind: e.status === "projected" ? "proj" : "real",
        label: e.description || e.category || (isIncome ? "Income" : "Expense"),
        amount: isIncome ? amt : -amt,
        entry: e,
      })
    }

    for (const due of props.dues || []) {
      const d = String(due.date || "")
      if (!d) continue
      const dt = parseLocalDate(d)
      if (dt < today || dt > end) continue
      const amt = Math.abs(Number(due.amount) || 0)
      if (!amt) continue
      lines.push({
        id: `due:${d}:${due.label}`,
        date: d.slice(0, 10),
        kind: "due",
        label: due.label || "Due",
        amount: -amt,
      })
    }

    lines.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount)

    const byDate = new Map<string, FlowLine[]>()
    for (const line of lines) {
      const arr = byDate.get(line.date) || []
      arr.push(line)
      byDate.set(line.date, arr)
    }

    const dates = [...byDate.keys()].filter((d) => (byDate.get(d) || []).length > 0).sort()
    let running = props.availableNow
    const groups = dates.map((date) => {
      const dayLines = byDate.get(date) || []
      const dayDelta = dayLines.reduce((s, l) => s + l.amount, 0)
      running = Math.round((running + dayDelta) * 100) / 100
      return { date, lines: dayLines, projectedBalance: running }
    })

    return { groups, endBalance: running }
  }, [props.availableNow, props.entries, props.dues, horizon])

  const health =
    endBalance >= props.availableNow * 0.9
      ? { label: "Stable", className: "text-emerald-400" }
      : endBalance >= 0
        ? { label: "Watch", className: "text-amber-400" }
        : { label: "Tight", className: "text-rose-400" }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/30 to-neutral-950/80"
      aria-label="Projected register"
    >
      <div className="flex items-end justify-between gap-2 border-b border-emerald-500/15 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400/90">
            Projected register
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Bank start · recurring · income/expense · projected balance
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Bank start</p>
          <p className="font-mono text-lg font-black tabular-nums text-white">{money(props.availableNow)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-neutral-800/80 px-3.5 py-2">
        <p className="text-[11px] text-neutral-400">
          Next {horizon} days · ending{" "}
          <span className="font-mono font-bold tabular-nums text-neutral-200">{money(endBalance)}</span>
        </p>
        <span className={cn("text-[11px] font-bold", health.className)}>{health.label}</span>
      </div>

      <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto overscroll-contain px-2.5 py-2.5">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-[12px] text-neutral-500">
            No forecasts yet. Add a bill or schedule income.
          </p>
        )}
        {[...groups].reverse().map((g) => (
          <div key={g.date} className="rounded-xl border border-neutral-800/90 bg-neutral-950/60">
            <p className="border-b border-neutral-800/60 px-2.5 py-1.5 text-[11px] font-bold text-neutral-300">
              {weekdayLabel(g.date)}
              <span className="font-normal text-neutral-500"> · {shortDate(g.date)}</span>
            </p>
            <ul className="divide-y divide-neutral-800/50">
              {g.lines.map((line) => (
                <li key={line.id}>
                  <button
                    type="button"
                    disabled={!line.entry || !props.onEditEntry}
                    onClick={() => line.entry && props.onEditEntry?.(line.entry)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-2 text-left",
                      line.entry && props.onEditEntry && "active:bg-neutral-900/80",
                    )}
                  >
                    <KindBadge kind={line.kind} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-neutral-200">
                      {line.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[12px] font-bold tabular-nums",
                        line.amount >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {line.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(line.amount)).replace(/^\$/, "")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-neutral-800/60 px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-emerald-500/90">→ Projected balance</span>
              <span className="font-mono text-[12px] font-black tabular-nums text-emerald-400">
                {money(g.projectedBalance)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function KindBadge({ kind }: { kind: FlowKind }) {
  const map = {
    real: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    proj: "border-sky-500/30 bg-sky-500/15 text-sky-300",
    due: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  } as const
  const label = kind === "real" ? "Real" : kind === "proj" ? "Proj" : "Due"
  return (
    <span
      className={cn(
        "inline-flex w-10 shrink-0 items-center justify-center rounded-md border py-0.5 text-[9px] font-black uppercase tracking-wide",
        map[kind],
      )}
    >
      {label}
    </span>
  )
}
