// ============================================================================
// ACCOUNT REGISTERS — home (one card per account) + per-account detail.
// Miguel rules: not overcrowded, readable, no long vertical scroll, no expandables.
// ============================================================================

"use client"

import { useState } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Camera,
  Car,
  CheckCircle2,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Star,
  Trash2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry, type CashFlowOrigin } from "./types"
import {
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  origenDe,
  tipoDocDe,
} from "./cash-flow-store"
import {
  type RegisterAccount,
  type DueItem,
  setDueDay as saveDueDay,
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

function renderBadges(row: CashFlowEntry) {
  const base =
    "inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0.5 text-[10px] font-semibold"
  const origin: CashFlowOrigin = origenDe(row)
  const tipo = tipoDocDe(row)
  const originStyle: Record<CashFlowOrigin, string> = {
    scan: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    manual: "border-neutral-700 bg-neutral-800 text-neutral-400",
    bank: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    trip: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  }
  return (
    <>
      <span className={cn(base, originStyle[origin])}>
        {origin === "scan" && <Camera className="size-2.5" />}
        {origin === "bank" && <Building2 className="size-2.5" />}
        {origin === "trip" && <Car className="size-2.5" />}
        {row.origin === "trip" && row.sourceLabel ? row.sourceLabel : ETIQUETA_ORIGEN[origin]}
      </span>
      {tipo === "factura" && (
        <span className={cn(base, "border-cyan-500/30 bg-cyan-500/10 text-cyan-300")}>
          <TrendingUp className="size-2.5" /> {ETIQUETA_TIPO.factura}
        </span>
      )}
      {tipo === "recibo" && (
        <span className={cn(base, "border-purple-500/30 bg-purple-500/10 text-purple-300")}>
          <Receipt className="size-2.5" /> {ETIQUETA_TIPO.recibo}
        </span>
      )}
    </>
  )
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
        entries={props.entries || []}
        dues={dueLines}
        onEditEntry={props.onEditEntry}
      />

      <div>
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          Accounts · {registers.length}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {registers.map((r) => {
            const bal = balances[r.id]
            const isCard = r.kind === "card"
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => props.onOpenAccount(r.id)}
                className={cn(
                  "rounded-xl border p-2 text-left active:scale-[0.98]",
                  r.isMain
                    ? "border-yellow-400/50 bg-yellow-400/[0.06]"
                    : "border-neutral-800 bg-neutral-900/70",
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
                <p className="mt-1 truncate text-[10px] font-bold leading-tight text-white">{r.name}</p>
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
            className="flex min-h-[76px] flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-neutral-700 bg-transparent p-2 text-neutral-400 active:scale-[0.98]"
          >
            <Plus className="size-4" />
            <span className="text-[9px] font-bold">Add account</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          <CalendarClock className="size-3.5 text-amber-300" /> Upcoming dues
        </p>
        {dues.length === 0 ? (
          <p className="text-[11px] text-neutral-500">No due days set. Add payment day on each card.</p>
        ) : (
          <div className="space-y-1.5">
            {dues.slice(0, 5).map((d) => (
              <div key={d.accountId} className="flex items-center justify-between text-[12px]">
                <span className="truncate font-semibold text-neutral-200">{d.accountName}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-neutral-400">{d.nextDate.slice(5)}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-black",
                      d.daysUntil <= 0
                        ? "bg-rose-500/20 text-rose-300"
                        : d.daysUntil <= 5
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-neutral-800 text-neutral-300",
                    )}
                  >
                    {d.daysUntil <= 0 ? "DUE" : `${d.daysUntil}d`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={props.onOpenTransfers}
        className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-left active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 text-[12px] font-bold text-neutral-200">
          <ArrowLeftRight className="size-4 text-cyan-300" /> Transfers between accounts
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">{pairCount} ok</span>
          {looseCount > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{looseCount} unmatched</span>
          )}
        </span>
      </button>
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
  const [limit, setLimit] = useState("")
  const [dueDay, setDueDay] = useState("")
  const [balance, setBalance] = useState("")
  const canSave = name.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-extrabold text-white">Add account</h3>
        <p className="mb-3 mt-0.5 text-[10px] text-neutral-500">Its register is created automatically.</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chase Checking, Amex Gold"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["bank", "card"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold",
                  kind === k
                    ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                    : "border-neutral-700 bg-neutral-900 text-neutral-300",
                )}
              >
                {k === "bank" ? <Landmark className="size-4" /> : <CreditCard className="size-4" />}
                {k === "bank" ? "Bank" : "Card"}
              </button>
            ))}
          </div>
          {kind === "card" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Limit</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="$"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Due day</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="15"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">
              {kind === "card" ? "Current debt" : "Current balance"}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="$0.00"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={props.onClose}
              className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                props.onSave({
                  name: name.trim(),
                  kind,
                  limit: limit ? parseFloat(limit) : null,
                  dueDay: dueDay ? Math.min(31, Math.max(1, parseInt(dueDay) || 0)) || null : null,
                  balance: balance ? parseFloat(balance) : 0,
                })
              }
              className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black disabled:opacity-40"
            >
              Create register
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// NOTE: RegisterDetail + TransfersReport kept in companion chunk via re-export pattern.
// Full detail views remain below for account drill-in.

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
  const [dueDraft, setDueDraft] = useState(r.dueDay ? String(r.dueDay) : "")
  const [balDraft, setBalDraft] = useState(
    r.manualBalance !== null && r.manualBalance !== undefined ? String(r.manualBalance) : "",
  )

  const projectedBills = props.entries.filter((e) => e.status === "projected" && e.type === "expense")
  const projectedTotal = projectedBills.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const otherFundsSum = props.otherFunds.filter((o) => o.checked).reduce((s, o) => s + (o.balance || 0), 0)
  const baseBal = props.balance || 0
  const projectedClosing = Math.round((baseBal + otherFundsSum - projectedTotal) * 100) / 100

  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-white">{r.name}</p>
          <p className="text-[10px] text-neutral-500">
            {isCard ? "Credit card" : "Bank account"}
            {r.institution ? ` · ${r.institution}` : ""}
            {r.isMain ? " · ★ Main" : ""}
          </p>
        </div>
        {!r.isMain && (
          <button
            type="button"
            onClick={() => props.onSetMain(r.id)}
            className="rounded-lg border border-neutral-700 px-2 py-1.5 text-[10px] font-bold text-neutral-300 active:scale-95"
          >
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> Main
            </span>
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          {isCard ? "Current debt" : "Balance"}
        </p>
        <p
          className={cn(
            "mt-1 text-3xl font-black tabular-nums",
            (props.balance || 0) < 0 && !isCard ? "text-rose-400" : "text-emerald-400",
          )}
        >
          {props.balance === null ? "—" : money(props.balance)}
        </p>
        {r.isMain && (
          <div className="mt-2 rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-2">
            <p className="text-[9px] font-bold text-cyan-300/80">PROJECTED CLOSE</p>
            <p
              className={cn(
                "text-lg font-black tabular-nums",
                projectedClosing >= 0 ? "text-cyan-300" : "text-rose-400",
              )}
            >
              {money(projectedClosing)}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={props.onAddBill}
          className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200"
        >
          + Bill
        </button>
        <button
          type="button"
          onClick={props.onAddPost}
          className="flex-1 rounded-xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200"
        >
          + Receipt
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Register</p>
        {props.entries.length === 0 && props.bankTxs.length === 0 && (
          <p className="rounded-xl border border-neutral-800 px-3 py-4 text-center text-[12px] text-neutral-500">
            No movements yet. Add a bill, receipt, or sync the bank.
          </p>
        )}
        {props.entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => props.onEditEntry(e)}
            className="flex w-full items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/50 px-2.5 py-2 text-left active:bg-neutral-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{e.description || e.category || "Entry"}</p>
              <p className="text-[10px] text-neutral-500">
                {shortDate(e.date)} · {e.status === "projected" ? "Bill" : "Receipt"}
              </p>
            </div>
            <span
              className={cn(
                "font-mono text-[12px] font-bold tabular-nums",
                e.type === "income" ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {e.type === "income" ? "+" : "−"}
              {money(Math.abs(Number(e.amount) || 0))}
            </span>
          </button>
        ))}
        {props.bankTxs.slice(0, 20).map((t, i) => (
          <div
            key={`${t.date}-${t.detail}-${i}`}
            className="flex items-center gap-2 rounded-xl border border-neutral-800/80 bg-neutral-950/30 px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-neutral-200">{t.detail}</p>
              <p className="text-[10px] text-neutral-500">{shortDate(t.date)} · Bank</p>
            </div>
            <span
              className={cn(
                "font-mono text-[12px] font-bold tabular-nums",
                t.amount >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {money(t.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TransfersReport(props: {
  report: TransferReport
  onBack: () => void
}) {
  const { report } = props
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <p className="text-[14px] font-extrabold text-white">Transfers</p>
          <p className="text-[10px] text-neutral-500">Matched pairs vs unmatched bank lines</p>
        </div>
      </div>
      <div className="flex gap-2 text-[11px] font-bold">
        <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-300">{report.pairs.length} matched</span>
        <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-300">
          {report.unmatchedOut.length + report.unmatchedIn.length} unmatched
        </span>
      </div>
      {report.pairs.slice(0, 12).map((p, i) => (
        <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-[12px]">
          <p className="font-semibold text-emerald-200">Matched transfer</p>
          <p className="text-neutral-400">{JSON.stringify(p).slice(0, 120)}…</p>
        </div>
      ))}
      {report.pairs.length === 0 && (
        <p className="text-[12px] text-neutral-500">No matched transfers yet.</p>
      )}
    </div>
  )
}
