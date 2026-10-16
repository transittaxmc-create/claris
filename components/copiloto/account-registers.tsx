"use client"

import { useState } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarClock,
  CreditCard,
  Landmark,
  Plus,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry } from "./types"
import {
  type RegisterAccount,
  type DueItem,
  accountDisplayName,
  last4Of,
} from "./registers-store"
import type { TransferReport } from "./transfer-matcher"
import { ProjectedCashFlow } from "./projected-cash-flow"

export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
}

function shortDate(iso: string): string {
  if (!iso || iso.length < 10) return "—"
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso.slice(5)
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" })
  } catch {
    return iso.slice(5)
  }
}

export function RegistersHome(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  pairCount: number
  looseCount: number
  entries?: CashFlowEntry[]
  onOpenAccount: (id: string) => void
  onAddAccount: () => void
  onOpenTransfers: () => void
  onEditEntry?: (e: CashFlowEntry) => void
}) {
  const { registers, balances, dues, pairCount, looseCount } = props

  let available = 0
  let owe = 0
  for (const r of registers) {
    const bal = balances[r.id]
    if (bal === null || bal === undefined) continue
    if (r.kind === "card") owe += Math.abs(bal)
    else available += bal
  }
  available = Math.round(available * 100) / 100
  owe = Math.round(owe * 100) / 100
  const net = Math.round((available - owe) * 100) / 100

  const dueLines = dues.slice(0, 8).map((d) => {
    const bal = balances[d.accountId]
    const amt = bal !== null && bal !== undefined ? Math.abs(bal) : 0
    return { date: d.nextDate, label: `${d.accountName} due`, amount: amt }
  })

  return (
    <div className="flex flex-col gap-2.5 overflow-x-hidden">
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-2.5">
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Available</p>
          <p className={cn("font-mono text-base font-black tabular-nums", available < 0 ? "text-rose-400" : "text-emerald-400")}>
            {money(available)}
          </p>
        </div>
        <div className="border-x border-neutral-800 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Owe</p>
          <p className="font-mono text-base font-black tabular-nums text-rose-400">{money(owe)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Net</p>
          <p className={cn("font-mono text-base font-black tabular-nums", net < 0 ? "text-rose-400" : "text-white")}>
            {money(net)}
          </p>
        </div>
      </div>

      <ProjectedCashFlow
        availableNow={available}
        entries={(props.entries || []).filter((e) => Math.abs(Number(e.amount) || 0) > 0)}
        dues={dueLines.filter((d) => d.amount > 0.009)}
        onEditEntry={props.onEditEntry}
      />

      <div>
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          Accounts · {registers.length}
        </p>
        <p className="mb-1.5 px-1 text-[11px] text-neutral-500">
          Name + last 4 · ★ = main (Citi ···93) · tap for statement
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {registers.map((r) => {
            const bal = balances[r.id]
            const isCard = r.kind === "card"
            const d = accountDisplayName(r.name)
            const tail = last4Of(r.name)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => props.onOpenAccount(r.id)}
                className={cn(
                  "rounded-xl border p-2 text-left active:scale-[0.98]",
                  r.isMain ? "border-yellow-400/50 bg-yellow-400/[0.06]" : "border-neutral-800 bg-neutral-900/70",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-black",
                      isCard ? "bg-purple-500/15 text-purple-300" : "bg-blue-500/15 text-blue-300",
                    )}
                  >
                    {isCard ? <CreditCard className="size-2" /> : <Landmark className="size-2" />}
                    {isCard ? "CARD" : "BANK"}
                  </span>
                  {r.isMain && <Star className="size-2.5 fill-yellow-400 text-yellow-400" />}
                </div>
                <p className="mt-1 truncate text-[10px] font-bold leading-tight text-white">{d.title}</p>
                {tail && (
                  <p className="font-mono text-[9px] font-semibold tabular-nums text-neutral-500">···{tail}</p>
                )}
                <p
                  className={cn(
                    "mt-0.5 text-base font-black tabular-nums leading-tight",
                    bal === null ? "text-neutral-500" : bal < 0 ? "text-rose-400" : "text-emerald-400",
                  )}
                >
                  {bal === null ? "—" : money(bal)}
                </p>
              </button>
            )
          })}
          <button
            type="button"
            onClick={props.onAddAccount}
            className="flex min-h-[76px] flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-neutral-700 p-2 text-neutral-400"
          >
            <Plus className="size-4" />
            <span className="text-[9px] font-bold">Add</span>
          </button>
        </div>
      </div>

      {dues.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <CalendarClock className="size-3.5 text-amber-300" /> Upcoming dues
          </p>
          {dues.slice(0, 5).map((d) => (
            <div key={d.accountId} className="flex items-center justify-between text-[12px]">
              <span className="truncate font-semibold text-neutral-200">{accountDisplayName(d.accountName).title}</span>
              <span className="text-neutral-400">{d.nextDate.slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      {(pairCount > 0 || looseCount > 0) && (
        <button
          type="button"
          onClick={props.onOpenTransfers}
          className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-[12px] font-bold text-neutral-200">
            <ArrowLeftRight className="size-4 text-cyan-300" /> Transfers
          </span>
          <span className="text-[10px] font-bold text-neutral-400">
            {pairCount} matched · {looseCount} open
          </span>
        </button>
      )}
    </div>
  )
}

export function AddAccountModal(props: {
  onClose: () => void
  onSave: (input: {
    name: string
    kind: "bank" | "card"
    limit?: number | null
    dueDay?: number | null
    balance?: number | null
  }) => void
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"bank" | "card">("bank")
  const [balance, setBalance] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={props.onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-white">Add account</h3>
        <input
          className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CitiBank ···6393"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["bank", "card"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-xl border py-2.5 text-xs font-bold",
                kind === k ? "border-yellow-400/60 text-yellow-300" : "border-neutral-700 text-neutral-300",
              )}
            >
              {k === "bank" ? "Bank" : "Card"}
            </button>
          ))}
        </div>
        <input
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white"
          type="number"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Balance"
        />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={props.onClose} className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300">
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => props.onSave({ name: name.trim(), kind, balance: balance ? parseFloat(balance) : 0 })}
            className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

export function RegisterDetail(props: {
  account: RegisterAccount
  balance: number | null
  bankTxs: BankTx[]
  entries: CashFlowEntry[]
  otherFunds: { reg: RegisterAccount; balance: number | null; checked: boolean }[]
  onToggleOtherFund: (id: string) => void
  onBack: () => void
  onAddBill: () => void
  onAddPost: () => void
  onEditEntry: (e: CashFlowEntry) => void
  onDeleteEntry: (id: string) => void
  onSetDocKind: (id: string, kind: "bill" | "receipt") => void
  onInlineAmount: (id: string, raw: string) => void
  onSetMain: (id: string) => void
  onSaveDueDay: (id: string, day: number | null) => void
  onSaveManualBalance: (id: string, v: number) => void
  onDeleteManual: (id: string) => void
}) {
  const { account: r } = props
  const isCard = r.kind === "card"
  const d = accountDisplayName(r.name)

  type Line = {
    key: string
    date: string
    detail: string
    amount: number
    dailyBalance: number | null
    kind: "bank" | "entry"
    entry?: CashFlowEntry
  }

  const statementLines: Line[] = (() => {
    const lines: Line[] = []
    for (const t of props.bankTxs) {
      lines.push({
        key: `bank:${t.date}:${t.detail}:${t.amount}`,
        date: String(t.date || "").slice(0, 10),
        detail: t.detail || "Bank",
        amount: Number(t.amount) || 0,
        dailyBalance:
          t.daily_balance !== null && t.daily_balance !== undefined && Number.isFinite(Number(t.daily_balance))
            ? Number(t.daily_balance)
            : null,
        kind: "bank",
      })
    }
    for (const e of props.entries) {
      const amt = Math.abs(Number(e.amount) || 0)
      lines.push({
        key: `entry:${e.id}`,
        date: String(e.date || "").slice(0, 10),
        detail: e.description || e.category || "Entry",
        amount: e.type === "income" ? amt : -amt,
        dailyBalance: null,
        kind: "entry",
        entry: e,
      })
    }
    lines.sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.amount) - Math.abs(a.amount))
    const hasAnyBal = lines.some((l) => l.dailyBalance !== null)
    if (!hasAnyBal && props.balance !== null && Number.isFinite(props.balance)) {
      let run = Number(props.balance)
      for (const line of lines) {
        line.dailyBalance = Math.round(run * 100) / 100
        run = run - line.amount
      }
    }
    return lines
  })()

  return (
    <div className="flex min-h-0 flex-col gap-3 px-1">
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-[12px] font-bold text-yellow-300"
        >
          <ArrowLeft className="size-4" /> Accounts
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-white">
            {d.title}
            {r.isMain ? " ★" : ""}
          </p>
          <p className="truncate text-[10px] text-neutral-500">
            {r.name} · {isCard ? "Card" : "Bank"} statement · newest on top
          </p>
        </div>
      </div>

      <div className="shrink-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          {isCard ? "Debt" : "Current balance"}
          {r.isMain ? " · MAIN" : ""}
        </p>
        <p
          className={cn(
            "mt-1 text-3xl font-black tabular-nums",
            (props.balance || 0) < 0 && !isCard ? "text-rose-400" : "text-emerald-400",
          )}
        >
          {props.balance === null ? "—" : money(props.balance)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={props.onAddBill} className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200">
          + Bill
        </button>
        <button type="button" onClick={props.onAddPost} className="flex-1 rounded-xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200">
          + Receipt
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/80">
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_72px_78px] gap-1 border-b border-neutral-800 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
          <span>Date · Detail</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Balance</span>
        </div>
        <div className="max-h-[min(58vh,480px)] min-h-[200px] overflow-y-auto overscroll-contain">
          {statementLines.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-neutral-500">No movements · Sync bank</p>
          )}
          {statementLines.map((line) => {
            const body = (
              <div className="grid grid-cols-[minmax(0,1fr)_72px_78px] items-start gap-1 border-b border-neutral-900/80 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-500">{shortDate(line.date)}</p>
                  <p className="truncate text-[12px] font-medium leading-snug text-neutral-100">{line.detail}</p>
                  {line.kind === "bank" && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400/80">Bank</span>
                  )}
                </div>
                <p
                  className={cn(
                    "text-right font-mono text-[12px] font-bold tabular-nums",
                    line.amount >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {line.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(line.amount)).replace(/^\$/, "")}
                </p>
                <p className="text-right font-mono text-[11px] font-semibold tabular-nums text-neutral-300">
                  {line.dailyBalance === null ? "—" : money(line.dailyBalance)}
                </p>
              </div>
            )
            if (line.entry) {
              return (
                <button key={line.key} type="button" onClick={() => props.onEditEntry(line.entry!)} className="w-full text-left active:bg-neutral-900/60">
                  {body}
                </button>
              )
            }
            return <div key={line.key}>{body}</div>
          })}
        </div>
      </div>
    </div>
  )
}

export function TransfersReport(props: { report: TransferReport; onBack: () => void }) {
  const { report } = props
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950/95 p-2">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-[12px] font-bold text-yellow-300"
        >
          <ArrowLeft className="size-4" /> Accounts
        </button>
        <div>
          <p className="text-[14px] font-extrabold text-white">Transfers</p>
          <p className="text-[10px] text-neutral-500">Not the statement register</p>
        </div>
      </div>
      <p className="text-[11px] text-neutral-400">
        {report.pairs.length} matched · {report.unmatchedOut.length + report.unmatchedIn.length} unmatched
      </p>
      {report.pairs.slice(0, 12).map((p) => (
        <div key={p.id} className="rounded-xl border border-emerald-500/20 px-3 py-2 text-[12px]">
          <p className="font-semibold text-emerald-200">{p.originLabel || "Transfer"}</p>
          <p className="text-neutral-400">
            {p.outTx.bank_account} → {p.inTx.bank_account} · ${p.amount.toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  )
}
