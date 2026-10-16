// ============================================================================
// ACCOUNT REGISTERS — clean home: real balances only, no $0 noise.
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
  CreditCard,
  Landmark,
  Plus,
  Receipt,
  Star,
  TrendingUp,
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
        entries={(props.entries || []).filter((e) => Math.abs(Number(e.amount) || 0) > 0)}
        dues={dueLines.filter((d) => d.amount > 0.009)}
        onEditEntry={props.onEditEntry}
      />

      <div>
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          Accounts · {registers.length}
        </p>
        <p className="mb-1.5 px-1 text-[11px] text-neutral-500">Tap a card to open its register</p>
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
            <span className="text-[9px] font-bold">Add</span>
          </button>
        </div>
      </div>

      {dues.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <CalendarClock className="size-3.5 text-amber-300" /> Upcoming dues
          </p>
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
        </div>
      )}

      {(pairCount > 0 || looseCount > 0) && (
        <button
          type="button"
          onClick={props.onOpenTransfers}
          className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-left active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-[12px] font-bold text-neutral-200">
            <ArrowLeftRight className="size-4 text-cyan-300" /> Transfers
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold">
            {pairCount > 0 && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">{pairCount} ok</span>
            )}
            {looseCount > 0 && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{looseCount} unmatched</span>
            )}
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
  const [limit, setLimit] = useState("")
  const [dueDay, setDueDay] = useState("")
  const [balance, setBalance] = useState("")
  const canSave = name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={props.onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-white">Add account</h3>
        <div className="mt-3 space-y-3">
          <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400" />
          <div className="grid grid-cols-2 gap-2">
            {(["bank", "card"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-xl border py-2.5 text-xs font-bold", kind === k ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300" : "border-neutral-700 text-neutral-300")}>
                {k === "bank" ? "Bank" : "Card"}
              </button>
            ))}
          </div>
          <input type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance / debt" className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400" />
          <div className="flex gap-2">
            <button type="button" onClick={props.onClose} className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300">Cancel</button>
            <button type="button" disabled={!canSave} onClick={() => props.onSave({ name: name.trim(), kind, limit: limit ? parseFloat(limit) : null, dueDay: dueDay ? parseInt(dueDay) || null : null, balance: balance ? parseFloat(balance) : 0 })} className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black disabled:opacity-40">Create</button>
          </div>
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
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={props.onBack} className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-[12px] font-bold text-yellow-300">
          <ArrowLeft className="size-4" /> Accounts
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-white">{r.name}</p>
          <p className="text-[10px] text-neutral-500">{isCard ? "Card register" : "Bank register"}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{isCard ? "Debt" : "Balance"}</p>
        <p className={cn("mt-1 text-3xl font-black tabular-nums", (props.balance || 0) < 0 && !isCard ? "text-rose-400" : "text-emerald-400")}>
          {props.balance === null ? "—" : money(props.balance)}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={props.onAddBill} className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200">+ Bill</button>
        <button type="button" onClick={props.onAddPost} className="flex-1 rounded-xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200">+ Receipt</button>
      </div>
      <div className="space-y-1.5">
        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">This account register</p>
        {props.entries.length === 0 && props.bankTxs.length === 0 && (
          <p className="rounded-xl border border-neutral-800 px-3 py-4 text-center text-[12px] text-neutral-500">No movements yet</p>
        )}
        {props.entries.map((e) => (
          <button key={e.id} type="button" onClick={() => props.onEditEntry(e)} className="flex w-full items-center gap-2 rounded-xl border border-neutral-800 px-2.5 py-2 text-left">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{e.description || e.category || "Entry"}</p>
              <p className="text-[10px] text-neutral-500">{shortDate(e.date)}</p>
            </div>
            <span className={cn("font-mono text-[12px] font-bold", e.type === "income" ? "text-emerald-400" : "text-rose-400")}>
              {money(Math.abs(Number(e.amount) || 0))}
            </span>
          </button>
        ))}
        {props.bankTxs.slice(0, 30).map((t, i) => (
          <div key={`${t.date}-${i}`} className="flex items-center gap-2 rounded-xl border border-neutral-800/80 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-neutral-200">{t.detail}</p>
              <p className="text-[10px] text-neutral-500">{shortDate(t.date)} · Bank</p>
            </div>
            <span className={cn("font-mono text-[12px] font-bold", t.amount >= 0 ? "text-emerald-400" : "text-rose-400")}>{money(t.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TransfersReport(props: { report: TransferReport; onBack: () => void }) {
  const { report } = props
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950/95 p-2 backdrop-blur">
        <button type="button" onClick={props.onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-[12px] font-bold text-yellow-300">
          <ArrowLeft className="size-4" /> Accounts
        </button>
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold text-white">Transfers</p>
          <p className="text-[10px] text-neutral-500">Not the register · tap Accounts</p>
        </div>
      </div>
      <div className="flex gap-2 text-[11px] font-bold">
        <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-300">{report.pairs.length} matched</span>
        <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-300">{report.unmatchedOut.length + report.unmatchedIn.length} unmatched</span>
      </div>
      {report.pairs.slice(0, 15).map((p) => (
        <div key={p.id} className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-[12px]">
          <p className="font-semibold text-emerald-200">{p.originLabel || "Transfer"}</p>
          <p className="text-neutral-400">{p.outTx.bank_account} → {p.inTx.bank_account} · ${p.amount.toFixed(2)}</p>
        </div>
      ))}
      {report.unmatchedOut.slice(0, 8).map((t, i) => (
        <div key={`out-${i}`} className="rounded-xl border border-amber-500/20 px-3 py-2 text-[12px]">
          <p className="font-semibold text-amber-200">Unmatched · {t.bank_account}</p>
          <p className="truncate text-neutral-400">{t.detail}</p>
        </div>
      ))}
    </div>
  )
}
