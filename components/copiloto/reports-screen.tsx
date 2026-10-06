"use client"

import { useMemo, useState } from "react"
import { Download, FileText, Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/dates"
import {
  grossOf,
  netOf,
  tripDateOf,
  money,
  type Expense,
  type Trip,
} from "./types"
import { expectedOf, receivedOf, reconStateOf } from "./reconciliation"

// REPORTES: Financial Statement por rango de fechas.
//
// Se genera a partir de los datos reales (viajes + gastos) del periodo elegido,
// con presets de semana/mes y rango personalizado. Sirve como estado financiero
// para impuestos (milla/deducciones) y para revisar el periodo.

type Preset = "week" | "lastWeek" | "month" | "lastMonth" | "last30" | "custom"

const PRESETS: { id: Preset; label: string }[] = [
  { id: "week", label: "Esta semana" },
  { id: "lastWeek", label: "Semana pasada" },
  { id: "month", label: "Este mes" },
  { id: "lastMonth", label: "Mes pasado" },
  { id: "last30", label: "Últimos 30 días" },
  { id: "custom", label: "Personalizado" },
]

// Fecha local del rango (antes era UTC: por la noche el rango se corría un día).
function iso(d: Date): string {
  return localDateKey(d)
}

// Rango de fechas del preset, en fechas locales "YYYY-MM-DD".
function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const today = iso(now)
  if (preset === "custom") return { from: customFrom || today, to: customTo || today }

  if (preset === "week") {
    const monday = new Date(now)
    const dow = (monday.getDay() + 6) % 7
    monday.setDate(monday.getDate() - dow)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: iso(monday), to: iso(sunday) }
  }
  if (preset === "lastWeek") {
    const monday = new Date(now)
    const dow = (monday.getDay() + 6) % 7
    monday.setDate(monday.getDate() - dow - 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: iso(monday), to: iso(sunday) }
  }
  if (preset === "month") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  if (preset === "lastMonth") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: iso(first), to: iso(last) }
  }
  // last30
  const start = new Date(now)
  start.setDate(start.getDate() - 29)
  return { from: iso(start), to: today }
}

function inRange(date: string, from: string, to: string): boolean {
  const d = String(date ?? "").slice(0, 10)
  return d >= from && d <= to
}

function Row({
  label,
  value,
  bold,
  tone,
  indent,
}: {
  label: string
  value: string
  bold?: boolean
  tone?: "income" | "expense" | "muted" | "total"
  indent?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1", indent && "pl-3")}>
      <span className={cn("text-[11px]", bold ? "font-bold text-neutral-200" : "text-neutral-400")}>{label}</span>
      <span
        className={cn(
          "shrink-0 font-mono text-[11px] tabular-nums",
          bold && "font-bold",
          tone === "income" && "text-emerald-400",
          tone === "expense" && "text-rose-400",
          tone === "muted" && "text-neutral-500",
          tone === "total" && "text-white",
          !tone && "text-neutral-300",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function ReportsScreen({ trips, expenses }: { trips: Trip[]; expenses: Expense[] }) {
  const [preset, setPreset] = useState<Preset>("month")
  const [customFrom, setCustomFrom] = useState(() => iso(new Date()))
  const [customTo, setCustomTo] = useState(() => iso(new Date()))

  const { from, to } = rangeFor(preset, customFrom, customTo)

  const data = useMemo(() => {
    const t = trips.filter((x) => inRange(tripDateOf(x), from, to))

    const byPlatform = new Map<string, { count: number; gross: number; net: number }>()
    let gross = 0
    let net = 0
    let tips = 0
    let tolls = 0
    let fees = 0
    let extra = 0
    let pendingTotal = 0
    let expectedTotal = 0
    let receivedTotal = 0

    for (const x of t) {
      const g = grossOf(x)
      const n = netOf(x)
      gross += g
      net += n
      tips += Number(x.tips) || 0
      tolls += Number(x.toll) || 0
      fees += Number(x.platformFee) || 0
      extra += Number(x.extraCash) || 0

      const p = byPlatform.get(x.platform) ?? { count: 0, gross: 0, net: 0 }
      p.count += 1
      p.gross += g
      p.net += n
      byPlatform.set(x.platform, p)

      const state = reconStateOf(x)
      expectedTotal += expectedOf(x)
      if (state !== "pending") receivedTotal += receivedOf(x) ?? 0
    }

    // Pendiente real de cobro: solo viajes reconciliados con diferencia negativa.
    for (const x of t) {
      const state = reconStateOf(x)
      if (state === "short") pendingTotal += Math.abs(expectedOf(x) - (receivedOf(x) ?? 0))
    }

    const e = expenses.filter((x) => inRange(x.date, from, to))
    const byCategory = new Map<string, number>()
    let expenseTotal = 0
    let business = 0
    let personal = 0
    for (const x of e) {
      const amount = Number(x.amount) || 0
      expenseTotal += amount
      byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + amount)
      if (x.classification === "business") business += amount
      else if (x.classification === "personal") personal += amount
    }

    const round = (n: number) => Math.round(n * 100) / 100
    return {
      tripsCount: t.length,
      gross: round(gross),
      net: round(net),
      tips: round(tips),
      tolls: round(tolls),
      fees: round(fees),
      extra: round(extra),
      byPlatform: [...byPlatform.entries()]
        .map(([platform, v]) => ({ platform, count: v.count, gross: round(v.gross), net: round(v.net) }))
        .sort((a, b) => b.net - a.net),
      expensesCount: e.length,
      expenseTotal: round(expenseTotal),
      byCategory: [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount: round(amount) }))
        .sort((a, b) => b.amount - a.amount),
      business: round(business),
      personal: round(personal),
      unclassified: round(expenseTotal - business - personal),
      result: round(net - expenseTotal),
      pendingTotal: round(pendingTotal),
      expectedTotal: round(expectedTotal),
      receivedTotal: round(receivedTotal),
    }
  }, [trips, expenses, from, to])

  function exportCsv() {
    const lines: string[] = []
    lines.push(`Financial Statement,${from} a ${to}`)
    lines.push("")
    lines.push("INGRESOS,VALOR")
    lines.push(`Bruto,${data.gross}`)
    lines.push(`Propinas,${data.tips}`)
    lines.push(`Extra cash,${data.extra}`)
    lines.push(`Peajes cobrados,${data.tolls}`)
    lines.push(`Comisiones de plataforma,${data.fees > 0 ? "-" : ""}${data.fees}`)
    lines.push(`NETO,${data.net}`)
    lines.push("")
    lines.push("POR PLATAFORMA,VIAJES,BRUTO,NETO")
    for (const p of data.byPlatform) lines.push(`${p.platform},${p.count},${p.gross},${p.net}`)
    lines.push("")
    lines.push("GASTOS,CATEGORIA,MONTO")
    for (const c of data.byCategory) lines.push(`Gasto,${c.category},${c.amount}`)
    lines.push(`TOTAL GASTOS,,${data.expenseTotal}`)
    lines.push("")
    lines.push("CLASIFICACION,MONTO")
    lines.push(`Business,${data.business}`)
    lines.push(`Personal,${data.personal}`)
    lines.push(`Sin clasificar,${data.unclassified}`)
    lines.push("")
    lines.push("RESULTADO,MONTO")
    lines.push(`Neto,${data.net}`)
    lines.push(`Gastos,${data.expenseTotal > 0 ? "-" : ""}${data.expenseTotal}`)
    lines.push(`RESULTADO DEL PERIODO,${data.result}`)
    lines.push("")
    lines.push("RECONCILIACION,MONTO")
    lines.push(`Esperado,${data.expectedTotal}`)
    lines.push(`Recibido,${data.receivedTotal}`)
    lines.push(`Pendiente de cobro,${data.pendingTotal}`)

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `financial-statement-${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="screen-frame">
      <div className="shrink-0 flex items-center justify-between px-4 pt-3">
        <h1 className="text-base font-extrabold tracking-tight text-white">Reportes</h1>
        <span className="shrink-0 rounded-full border border-sky-400/50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-sky-300">
          {from} → {to}
        </span>
      </div>

      <div className="screen-scroll space-y-3 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Rango */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-400">
            <FileText className="size-3.5 text-sky-300" /> RANGO DEL REPORTE
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                  preset === p.id
                    ? "border-sky-400/70 bg-sky-400/10 text-sky-300"
                    : "border-neutral-700 text-neutral-400",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-neutral-500">DESDE</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-neutral-500">HASTA</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
                />
              </label>
            </div>
          )}
        </section>

        {/* Estado financiero */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="mb-1 text-[11px] font-bold tracking-wide text-white">RESUMEN FINANCIERO</p>
          <p className="mb-2 text-[10px] text-neutral-500">
            {data.tripsCount} viajes · {data.expensesCount} gastos en el periodo
          </p>

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-400">Ingresos</p>
          <Row label="Bruto (earnings + extra + propinas + peajes)" value={money(data.gross)} tone="income" />
          <Row label="· Propinas" value={money(data.tips)} indent tone="muted" />
          <Row label="· Extra cash" value={money(data.extra)} indent tone="muted" />
          <Row label="· Peajes cobrados" value={money(data.tolls)} indent tone="muted" />
          <Row label="Comisiones de plataforma" value={`${data.fees > 0 ? "-" : ""}${money(data.fees)}`} tone="expense" />
          <Row label="NETO DE INGRESOS" value={money(data.net)} bold tone="total" />

          {data.byPlatform.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Por plataforma</p>
              {data.byPlatform.map((p) => (
                <Row key={p.platform} label={`${p.platform} (${p.count})`} value={money(p.net)} tone="muted" />
              ))}
            </>
          )}

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-rose-400">Gastos</p>
          {data.byCategory.length === 0 ? (
            <Row label="Sin gastos en el periodo" value={money(0)} tone="muted" />
          ) : (
            data.byCategory.map((c) => (
              <Row key={c.category} label={c.category} value={`-${money(c.amount)}`} tone="expense" />
            ))
          )}
          <Row
            label="TOTAL GASTOS"
            value={`${data.expenseTotal > 0 ? "-" : ""}${money(data.expenseTotal)}`}
            bold
            tone="total"
          />

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Clasificación fiscal</p>
          <Row label="💼 Business (deducible)" value={money(data.business)} tone="income" />
          <Row label="🏠 Personal" value={money(data.personal)} tone="muted" />
          {data.unclassified > 0 && (
            <Row label="Sin clasificar" value={money(data.unclassified)} tone="muted" />
          )}

          <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2">
            <span className="text-xs font-bold text-white">RESULTADO DEL PERIODO</span>
            <span className={cn("font-mono text-base font-black", data.result >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {money(data.result)}
            </span>
          </div>

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Reconciliación de cobros</p>
          <Row label="Esperado" value={money(data.expectedTotal)} tone="muted" />
          <Row label="Recibido" value={money(data.receivedTotal)} tone="income" />
          <Row label="Pendiente de cobro" value={money(data.pendingTotal)} tone={data.pendingTotal > 0 ? "expense" : "muted"} />
        </section>

        {/* Acciones */}
        <div className="flex gap-2 pb-2">
          <button
            type="button"
            onClick={exportCsv}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-200"
          >
            <Download className="size-4" /> EXPORTAR CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-200"
          >
            <Printer className="size-4" /> IMPRIMIR
          </button>
        </div>
      </div>
    </div>
  )
}
