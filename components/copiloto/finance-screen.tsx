"use client"

import { LockKeyhole, MoreHorizontal, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type Trip } from "./types"

type FinanceStatus = "Estimated" | "Pending" | "Confirmed" | "MasterReconciled"

type FinanceRow = {
  id: string
  date: string
  source: string
  category: "Income" | "Expense"
  bankReal: number | null
  estimatedIn: number
  estimatedOut: number
  status: FinanceStatus
  locked?: boolean
}

const SAMPLE_ROWS: FinanceRow[] = [
  { id: "invoice", date: "2026-09-24", source: "Client Invoice #1023", category: "Income", bankReal: 1500, estimatedIn: 1500, estimatedOut: 0, status: "Confirmed" },
  { id: "rent", date: "2026-09-23", source: "Office Rent", category: "Expense", bankReal: -2100, estimatedIn: 0, estimatedOut: 2100, status: "Confirmed" },
  { id: "subscription", date: "2026-09-26", source: "Upcoming Service Subscription", category: "Expense", bankReal: null, estimatedIn: 0, estimatedOut: 40, status: "Estimated" },
  { id: "deposit", date: "2026-09-27", source: "Future Client Deposit", category: "Income", bankReal: null, estimatedIn: 650, estimatedOut: 0, status: "Estimated" },
  { id: "utilities", date: "2026-09-28", source: "Predicted Utility Bill", category: "Expense", bankReal: null, estimatedIn: 0, estimatedOut: 1300, status: "Estimated" },
]

function statusLabel(status: FinanceStatus) {
  return status === "MasterReconciled" ? "Master Reconciled" : status
}

function statusClass(status: FinanceStatus) {
  if (status === "Confirmed") return "bg-emerald-100 text-emerald-900"
  if (status === "Pending") return "bg-amber-100 text-amber-900"
  if (status === "MasterReconciled") return "border border-amber-300 bg-amber-100 font-bold text-amber-950"
  return "bg-violet-100 text-violet-950"
}

function displayAmount(value: number | null) {
  return value === null ? "—" : money(value)
}

export function FinanceScreen({ trips }: { trips: Trip[] }) {
  const confirmedTrips = trips.filter((trip) => trip.status === "matched")
  const bankBalance = 3040 + confirmedTrips.reduce((sum, trip) => sum + trip.earnings, 0)
  const pending = SAMPLE_ROWS.filter((row) => row.status === "Pending").reduce((sum, row) => sum + row.estimatedOut, 0)
  const projected = bankBalance + SAMPLE_ROWS.reduce((sum, row) => sum + row.estimatedIn - row.estimatedOut, 0)

  const rows = SAMPLE_ROWS.map((row, index) => ({
    ...row,
    realBalance: row.bankReal === null ? null : bankBalance - index * 500,
    projectedBalance: bankBalance + SAMPLE_ROWS.slice(0, index + 1).reduce((sum, item) => sum + item.estimatedIn - item.estimatedOut, 0),
  }))

  return (
    <section className="h-full overflow-y-auto bg-[#f7f9f8] px-4 py-5 text-slate-950 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1240px] space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Bank balance now" value={bankBalance} tone="blue" />
          <SummaryCard label="Pending, not cleared" value={pending} tone="gold" />
          <SummaryCard label="Projected balance" value={projected} tone="violet" />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Dual Reconciliation Register</h1>
              <p className="mt-1 text-xs text-slate-500">Bank-confirmed amounts stay separate from projected cashflow.</p>
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="size-4" /> Upload statement
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold text-slate-700">
                <tr>{["Date", "Source/Description", "Category", "Bank (real)", "Est. in", "Est. out", "Real balance", "Projected balance", "Status", "Action"].map((heading) => <th key={heading} className="border-b border-slate-200 px-4 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">{row.date}</td>
                    <td className="max-w-56 px-4 py-3 font-medium">{row.source}</td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3 font-medium">{displayAmount(row.bankReal)}</td>
                    <td className="px-4 py-3">{displayAmount(row.estimatedIn || null)}</td>
                    <td className="px-4 py-3">{displayAmount(row.estimatedOut || null)}</td>
                    <td className="px-4 py-3">{displayAmount(row.realBalance)}</td>
                    <td className="px-4 py-3">{displayAmount(row.projectedBalance)}</td>
                    <td className="px-4 py-3"><span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", statusClass(row.status))}>{row.status === "MasterReconciled" && <LockKeyhole className="mr-1 size-3" />}{statusLabel(row.status)}</span></td>
                    <td className="px-4 py-3 text-slate-500"><button type="button" aria-label={`Actions for ${row.source}`} className="rounded p-1 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "blue" | "gold" | "violet" }) {
  const colors = { blue: "bg-blue-200 border-blue-300", gold: "bg-amber-200 border-amber-300", violet: "bg-indigo-300 border-indigo-400" }
  return <div className={cn("rounded-xl border px-4 py-4 shadow-sm", colors[tone])}><p className="text-base font-medium">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight">{money(value)}</p></div>
}

export type { FinanceRow, FinanceStatus }
export const SAMPLE_FINANCE_ROWS = SAMPLE_ROWS

export function applyMasterReconciliation(rows: FinanceRow[], monthKey: string, statementEndingBalance: number) {
  const monthRows = rows.filter((row) => row.date.startsWith(monthKey))
  const calculatedEndingBalance = monthRows.reduce((sum, row) => sum + (row.status === "Confirmed" || row.status === "MasterReconciled" ? row.bankReal ?? 0 : 0), 0)
  const discrepancyAmount = Math.abs(statementEndingBalance - calculatedEndingBalance)
  const isMatch = discrepancyAmount < 0.01
  const batchId = `BATCH-${monthKey}-${crypto.randomUUID().slice(0, 8)}`
  return {
    updatedRows: rows.map((row) => row.date.startsWith(monthKey) && isMatch && row.status === "Confirmed" ? { ...row, status: "MasterReconciled" as const, locked: true, masterReconciledBatchId: batchId } : row),
    auditRecord: { monthKey, statementEndingBalance, calculatedEndingBalance, discrepancyAmount, reconciledAt: new Date().toISOString(), status: isMatch ? "AUDITED_MATCH" as const : "DISCREPANCY_FLAGGED" as const, totalTransactionsLocked: isMatch ? monthRows.length : 0 },
  }
}

export type MonthlyAuditRecord = ReturnType<typeof applyMasterReconciliation>["auditRecord"]
export type ReconciledLedgerRow = ReturnType<typeof applyMasterReconciliation>["updatedRows"][number]

export default FinanceScreen
