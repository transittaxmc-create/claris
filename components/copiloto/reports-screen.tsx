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
import { BankTxReport } from "./bank-tx-report"
import { MileageReport } from "./mileage-report"
import { milesByHalfYear } from "./mileage-log"
import {
  ScheduleCDraft,
  computeScheduleC,
  DEFAULT_SCHEDULE_C_OPTS,
  type ScheduleCOpts,
} from "./schedule-c-draft"

type Preset = "week" | "lastWeek" | "month" | "lastMonth" | "last30" | "custom"

const PRESETS: { id: Preset; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last30", label: "Last 30 days" },
  { id: "custom", label: "Personalizado" },
]

function iso(d: Date): string {
  return localDateKey(d)
}

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
  const [scOpts, setScOpts] = useState<ScheduleCOpts>(() => {
    // Las millas se llenan solas del registro IRS; Miguel puede corregirlas.
    try {
      const y = new Date().getFullYear()
      const { h1, h2 } = milesByHalfYear(y)
      if (h1 > 0 || h2 > 0) return { ...DEFAULT_SCHEDULE_C_OPTS, milesH1: h1, milesH2: h2 }
    } catch {}
    return DEFAULT_SCHEDULE_C_OPTS
  })

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
    lines.push("INCOME,VALUE")
    lines.push(`Bruto,${data.gross}`)
    lines.push(`Propinas,${data.tips}`)
    lines.push(`Extra cash,${data.extra}`)
    lines.push(`Peajes cobrados,${data.tolls}`)
    lines.push(`Platform fees,${data.fees > 0 ? "-" : ""}${data.fees}`)
    lines.push(`NET,${data.net}`)
    lines.push("")
    lines.push("BY PLATFORM,TRIPS,GROSS,NET")
    for (const p of data.byPlatform) lines.push(`${p.platform},${p.count},${p.gross},${p.net}`)
    lines.push("")
    lines.push("EXPENSES,CATEGORY,AMOUNT")
    for (const c of data.byCategory) lines.push(`Expense,${c.category},${c.amount}`)
    lines.push(`TOTAL EXPENSES,,${data.expenseTotal}`)
    lines.push("")
    lines.push("CLASSIFICATION,AMOUNT")
    lines.push(`Business,${data.business}`)
    lines.push(`Personal,${data.personal}`)
    lines.push(`Unclassified,${data.unclassified}`)
    lines.push("")
    lines.push("RESULT,AMOUNT")
    lines.push(`Net,${data.net}`)
    lines.push(`Expenses,${data.expenseTotal > 0 ? "-" : ""}${data.expenseTotal}`)
    lines.push(`PERIOD RESULT,${data.result}`)
    lines.push("")
    lines.push("RECONCILIATION,AMOUNT")
    lines.push(`Esperado,${data.expectedTotal}`)
    lines.push(`Recibido,${data.receivedTotal}`)
    lines.push(`Pending collection,${data.pendingTotal}`)

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `financial-statement-${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const esc = (s: string | number) =>
      String(s)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
    const moneyHtml = (n: number) => {
      const v = Number(n) || 0
      const t = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `${v < 0 ? "-" : ""}$${t}`
    }
    // Schedule C (DRAFT) — mismas cifras que la sección en pantalla
    const sc = computeScheduleC(
      trips.filter((x) => inRange(tripDateOf(x), from, to)).map((x) => ({ gross: grossOf(x), platformFee: Number(x.platformFee) || 0 })),
      expenses.filter((x) => inRange(x.date, from, to)),
      from,
      to,
      scOpts,
    )
    const scRows = sc.lines
      .map(
        (l) =>
          `<tr${l.total ? ' class="total"' : ""}><td><b>${esc(l.line)}</b> ${esc(l.label)}${l.note ? `<br/><span style="color:#888;font-size:11px">${esc(l.note)}</span>` : ""}</td><td class="r">${moneyHtml(l.amount)}</td></tr>`,
      )
      .join("")
    const platformRows = data.byPlatform
      .map(
        (p) =>
          `<tr><td>${esc(p.platform)}</td><td class="r">${p.count}</td><td class="r">${moneyHtml(p.gross)}</td><td class="r">${moneyHtml(p.net)}</td></tr>`,
      )
      .join("")
    const categoryRows =
      data.byCategory.length === 0
        ? `<tr><td colspan="2">No expenses</td></tr>`
        : data.byCategory
            .map((c) => `<tr><td>${esc(c.category)}</td><td class="r">-${moneyHtml(c.amount)}</td></tr>`)
            .join("")
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Financial Statement ${esc(from)} – ${esc(to)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; color: #111; background: #fff; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin: 18px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: 800; border-top: 2px solid #111; border-bottom: none; padding-top: 8px; }
  .result { margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px; display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; }
  .pos { color: #0a7a3e; } .neg { color: #b3123b; }
  @media print { body { padding: 12px; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px">
    <button onclick="window.print()" style="padding:10px 16px;font-weight:700;border-radius:8px;border:none;background:#FBBF24;cursor:pointer">
      Print / Save as PDF
    </button>
  </div>
  <h1>Financial Statement</h1>
  <p class="sub">Copiloto Dual Register · ${esc(from)} → ${esc(to)} · Generated ${esc(new Date().toLocaleString())}</p>
  <h2>Income</h2>
  <table>
    <tr><td>Gross</td><td class="r">${moneyHtml(data.gross)}</td></tr>
    <tr><td>Tips</td><td class="r">${moneyHtml(data.tips)}</td></tr>
    <tr><td>Extra cash</td><td class="r">${moneyHtml(data.extra)}</td></tr>
    <tr><td>Tolls collected</td><td class="r">${moneyHtml(data.tolls)}</td></tr>
    <tr><td>Platform fees</td><td class="r">-${moneyHtml(data.fees)}</td></tr>
    <tr class="total"><td>NET</td><td class="r">${moneyHtml(data.net)}</td></tr>
  </table>
  <h2>By platform</h2>
  <table>
    <tr><td><b>Platform</b></td><td class="r"><b>Trips</b></td><td class="r"><b>Gross</b></td><td class="r"><b>Net</b></td></tr>
    ${platformRows || "<tr><td colspan=\"4\">No trips</td></tr>"}
  </table>
  <h2>Expenses</h2>
  <table>
    ${categoryRows}
    <tr class="total"><td>TOTAL EXPENSES</td><td class="r">-${moneyHtml(data.expenseTotal)}</td></tr>
  </table>
  <h2>Tax classification</h2>
  <table>
    <tr><td>Business (deductible)</td><td class="r">${moneyHtml(data.business)}</td></tr>
    <tr><td>Personal</td><td class="r">${moneyHtml(data.personal)}</td></tr>
    <tr><td>Unclassified</td><td class="r">${moneyHtml(data.unclassified)}</td></tr>
  </table>
  <h2>Schedule C — DRAFT (IRS 2025)</h2>
  <p class="sub" style="margin-bottom:8px">Auto-filled from this statement. A CPA must review before filing.</p>
  <table>
    ${scRows}
  </table>
  <h2>Tax estimate (informational)</h2>
  <table>
    <tr><td>Self-employment tax (15.3%)</td><td class="r">${moneyHtml(sc.seTax)}</td></tr>
    <tr><td>½ SE deductible</td><td class="r">${moneyHtml(sc.halfSE)}</td></tr>
    <tr><td>QBI deduction (20%)</td><td class="r">${moneyHtml(sc.qbi)}</td></tr>
  </table>
  <h2>Collections reconciliation</h2>
  <table>
    <tr><td>Expected</td><td class="r">${moneyHtml(data.expectedTotal)}</td></tr>
    <tr><td>Received</td><td class="r">${moneyHtml(data.receivedTotal)}</td></tr>
    <tr><td>Outstanding</td><td class="r">${moneyHtml(data.pendingTotal)}</td></tr>
  </table>
  <div class="result">
    <span>PERIOD RESULT</span>
    <span class="${data.result >= 0 ? "pos" : "neg"}">${moneyHtml(data.result)}</span>
  </div>
  <script>setTimeout(function(){ window.print(); }, 350);</script>
</body>
</html>`
    const w = window.open("", "_blank")
    if (!w) {
      alert("Allow pop-ups to generate the PDF statement.")
      return
    }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-sm font-bold tracking-widest text-neutral-400">REPORTS</h1>
        <span className="rounded-full border border-sky-400/50 px-2.5 py-1 text-[11px] font-bold text-sky-300">
          {from} → {to}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-400">
            <FileText className="size-3.5 text-sky-300" /> REPORT RANGE
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
                <span className="text-[9px] font-bold text-neutral-500">FROM</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-neutral-500">UNTIL</span>
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

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="mb-1 text-[11px] font-bold tracking-wide text-white">FINANCIAL STATEMENT</p>
          <p className="mb-2 text-[10px] text-neutral-500">
            {data.tripsCount} trips · {data.expensesCount} expenses in the period
          </p>

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-400">Income</p>
          <Row label="Bruto (earnings + extra + propinas + peajes)" value={money(data.gross)} tone="income" />
          <Row label="· Propinas" value={money(data.tips)} indent tone="muted" />
          <Row label="· Extra cash" value={money(data.extra)} indent tone="muted" />
          <Row label="· Peajes cobrados" value={money(data.tolls)} indent tone="muted" />
          <Row label="Platform fees" value={`${data.fees > 0 ? "-" : ""}${money(data.fees)}`} tone="expense" />
          <Row label="INCOME NET" value={money(data.net)} bold tone="total" />

          {data.byPlatform.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">By platform</p>
              {data.byPlatform.map((p) => (
                <Row key={p.platform} label={`${p.platform} (${p.count})`} value={money(p.net)} tone="muted" />
              ))}
            </>
          )}

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-rose-400">Expenses</p>
          {data.byCategory.length === 0 ? (
            <Row label="No expenses in the period" value={money(0)} tone="muted" />
          ) : (
            data.byCategory.map((c) => (
              <Row key={c.category} label={c.category} value={`-${money(c.amount)}`} tone="expense" />
            ))
          )}
          <Row
            label="TOTAL EXPENSES"
            value={`${data.expenseTotal > 0 ? "-" : ""}${money(data.expenseTotal)}`}
            bold
            tone="total"
          />

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Tax classification</p>
          <Row label="Business (deducible)" value={money(data.business)} tone="income" />
          <Row label="Personal" value={money(data.personal)} tone="muted" />
          {data.unclassified > 0 && (
            <Row label="Unclassified" value={money(data.unclassified)} tone="muted" />
          )}

          <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2">
            <span className="text-xs font-bold text-white">PERIOD RESULT</span>
            <span className={cn("font-mono text-base font-black", data.result >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {money(data.result)}
            </span>
          </div>

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Earnings reconciliation</p>
          <Row label="Esperado" value={money(data.expectedTotal)} tone="muted" />
          <Row label="Recibido" value={money(data.receivedTotal)} tone="income" />
          <Row label="Pending collection" value={money(data.pendingTotal)} tone={data.pendingTotal > 0 ? "expense" : "muted"} />
        </section>

        <BankTxReport />

        <ScheduleCDraft trips={trips} expenses={expenses} from={from} to={to} opts={scOpts} onOpts={setScOpts} />

        <MileageReport />

        <div className="flex flex-col gap-2 pb-4">
          <button
            type="button"
            onClick={exportPdf}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-3.5 text-sm font-extrabold text-black active:scale-[0.99]"
          >
            <Printer className="size-4" /> PDF / Financial Statement
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-200"
            >
              <Download className="size-4" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-3 text-xs font-bold text-neutral-200"
            >
              <Printer className="size-4" /> Print page
            </button>
          </div>
          <p className="text-center text-[10px] text-neutral-500">
            PDF opens a clean statement — use Share → Print → Save as PDF on your phone.
          </p>
        </div>
      </div>
    </div>
  )
}
