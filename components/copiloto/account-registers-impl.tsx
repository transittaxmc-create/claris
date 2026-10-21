"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry } from "./types"
import type { RegisterAccount, DueItem } from "./registers-store"
import { accountDisplayName, last4Of } from "./registers-store"
import type { TransferReport } from "./transfer-matcher"
import type { ReconReport, ReconFinding } from "./reconciliation-check"
import { DineroProyeccion, useForecastInputs } from "./dinero-proyeccion"
import { buildForecast, daysToEndOfMonth, startingBalance, todayKey } from "./dinero-forecast"
import { movementCounts, bankBrandOf } from "./bank-brand"
import { MoneyAccountCard, MoneyHeader, MoneySectionTitle, MoneyStrip, MoneyTabs } from "./money-ui"
import { Plus, ArrowLeftRight } from "lucide-react"

export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
  pending?: boolean
  transaction_id?: string
  pending_transaction_id?: string | null
}

function PendingBadge({ pending }: { pending?: boolean }) {
  if (!pending) return null
  return (
    <span className="ml-1 inline-block rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-400">
      Pending
    </span>
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
  reconReport?: ReconReport | null
  reconLoading?: boolean
  onRunRecon?: () => void
  onApproveFinding?: (f: ReconFinding) => void
  onRejectFinding?: (f: ReconFinding) => void
  onEditFinding?: (f: ReconFinding) => void
  onApproveAllFindings?: () => void
  bankTxs?: BankTx[]
  bankOk?: boolean
  onSyncBank?: () => void
  otherFunds?: string[]
  onToggleOtherFund?: (id: string) => void
  onMarkPaid?: (e: CashFlowEntry, paidDate: string) => void
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  onAddEntry?: (dateIso: string) => void
  onConfirmWithAdjustment?: (e: CashFlowEntry, paidDate: string, adj: number, reason: string) => void
}) {
  const { registers, balances, dues, pairCount, looseCount } = props
  const [vista, setVista] = useState(0)

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

  const principal = registers.find((r) => r.isMain) || registers[0] || null
  const mainName = (() => {
    if (!principal) return "Account"
    const b = bankBrandOf(principal.name, principal.institution)
    return b.id === "generic" ? accountDisplayName(principal.name).title.replace(/\s*·+\s*\d{4}$/, "") : b.short
  })()

  const movCount = movementCounts(
    registers,
    props.bankOk ? props.bankTxs || [] : [],
    (props.entries || []) as { accountId?: string }[],
    (n) => n,
  )

  const { schedules, dismissed } = useForecastInputs()
  const proyectadoMes = (() => {
    const today = todayKey()
    const inicio = startingBalance(registers, balances, props.otherFunds || [])
    return buildForecast({
      startBalance: inicio.value,
      entries: props.entries || [],
      schedules,
      dues,
      balances,
      bankTxs: props.bankOk ? props.bankTxs || [] : [],
      today,
      horizonDays: daysToEndOfMonth(today),
      dismissedPaid: dismissed,
    })
  })()

  // Orden: principal primero, luego con balance+movimientos, luego solo balance.
  // Sin balance ni movimientos se ocultan (no se borran; reaparecen solos).
  const ordered = [...registers]
    .filter((r) => {
      if (r.isMain) return true
      const bal = balances[r.id] ?? 0
      const mov = movCount[r.id] ?? 0
      return bal !== 0 || mov > 0
    })
    .sort((a, b) => {
      if (a.isMain && !b.isMain) return -1
      if (b.isMain && !a.isMain) return 1
      const aBal = balances[a.id] ?? 0
      const bBal = balances[b.id] ?? 0
      const aMov = movCount[a.id] ?? 0
      const bMov = movCount[b.id] ?? 0
      const aScore = (aBal !== 0 && aMov > 0) ? 2 : (aBal !== 0 ? 1 : 0)
      const bScore = (bBal !== 0 && bMov > 0) ? 2 : (bBal !== 0 ? 1 : 0)
      if (bScore !== aScore) return bScore - aScore
      return Math.abs(bBal) - Math.abs(aBal)
    })

  return (
    <div className="flex flex-col gap-3 overflow-x-hidden">
      <MoneyHeader page={vista as 0 | 1} onPage={setVista} />
      <MoneyTabs page={vista as 0 | 1} onPage={setVista} registerLabel={`${mainName} Register`} />
      <MoneyStrip
        cells={[
          {
            label: "REAL BANK",
            value: principal && balances[principal.id] != null ? money(balances[principal.id] as number) : money(available),
            tone: "plain",
            active: vista === 0,
            onClick: () => setVista(0),
          },
          {
            label: "PROJECTED MONTH",
            value: money(proyectadoMes.end),
            tone: proyectadoMes.end < 0 ? "neg" : "plain",
            active: vista === 1,
            onClick: () => setVista(1),
          },
        ]}
      />

      {vista === 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#262633] bg-[#111119] px-2 py-1.5 text-center">
            <p className="text-[10px] text-[#9a9cb0]">
              Disponible{" "}
              <span className={cn("font-mono font-bold tabular-nums", available < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]")}>
                {money(available)}
              </span>
            </p>
            <p className="border-x border-[#262633] text-[10px] text-[#9a9cb0]">
              Debo <span className="font-mono font-bold tabular-nums text-[#ff5d6c]">{money(owe)}</span>
            </p>
            <p className="text-[10px] text-[#9a9cb0]">
              Net{" "}
              <span className={cn("font-mono font-bold tabular-nums", net < 0 ? "text-[#ff5d6c]" : "text-[#f2f3f7]")}>
                {money(net)}
              </span>
            </p>
          </div>

          <div>
            <MoneySectionTitle>ACCOUNTS · {ordered.length}</MoneySectionTitle>
            <div className="grid grid-cols-2 gap-2.5 max-[360px]:grid-cols-1">
              {ordered.map((r) => (
                <MoneyAccountCard
                  key={r.id}
                  name={accountDisplayName(r.name).title}
                  rawName={r.name}
                  institution={r.institution}
                  subtitle={`${last4Of(r.name) ? `•••• ${last4Of(r.name)}` : r.institution || r.name} · ${r.kind === "card" ? "Credit Card" : "Checking"}`}
                  balance={balances[r.id] ?? null}
                  main={r.isMain}
                  count={movCount[r.id] ?? 0}
                  onClick={() => props.onOpenAccount(r.id)}
                  fundChecked={(props.otherFunds || []).includes(r.id)}
                  onToggleFund={
                    !r.isMain && r.kind === "bank" && (balances[r.id] ?? 0) > 0 && props.onToggleOtherFund
                      ? () => props.onToggleOtherFund?.(r.id)
                      : undefined
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={props.onAddAccount}
              className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-[14px] border border-dashed border-[#262633] p-3 text-[#9a9cb0]"
            >
              <Plus className="size-4" />
              <span className="text-[13px] font-semibold">Add account</span>
            </button>
          </div>

          {(pairCount > 0 || looseCount > 0) && (
            <button
              type="button"
              onClick={props.onOpenTransfers}
              className="flex items-center justify-between rounded-[14px] border border-[#262633] bg-[#16161f] px-3.5 py-3 text-left active:scale-[.99]"
            >
              <span className="flex items-center gap-2 text-[13px] font-bold text-[#f2f3f7]">
                <ArrowLeftRight className="size-4 text-[#5b8cff]" /> Transferencias
              </span>
              <span className="font-mono text-[10px] font-bold text-[#9a9cb0]">
                {pairCount} matched · {looseCount} abiertas
              </span>
            </button>
          )}
        </>
      )}

      {vista === 1 && (
        <DineroProyeccion
          registers={registers}
          balances={balances}
          dues={dues}
          entries={props.entries || []}
          bankTxs={props.bankTxs || []}
          bankOk={props.bankOk === true}
          otherFunds={props.otherFunds || []}
          onEditEntry={props.onEditEntry}
          onPatchEntry={props.onPatchEntry}
          onAddEntry={props.onAddEntry}
          onMarkPaid={props.onMarkPaid}
          onConfirmWithAdjustment={props.onConfirmWithAdjustment}
        />
      )}
    </div>
  )
}

export function RegisterDetail(props: {
  account: RegisterAccount
  balance: number | null
  entries: CashFlowEntry[]
  bankTxs: BankTx[]
  otherFunds?: unknown
  onBack: () => void
  onEditEntry?: (e: CashFlowEntry) => void
  onDeleteEntry?: (id: string) => void
  onAddEntry?: (...args: any[]) => void
  onOpenScanner?: () => void
  onSetDocKind?: (...args: any[]) => void
  onInlineAmount?: (...args: any[]) => void
  onSetMain?: (...args: any[]) => void
  onSaveDueDay?: (...args: any[]) => void
  onSaveManualBalance?: (...args: any[]) => void
  onDeleteManual?: (...args: any[]) => void
  [key: string]: any
}) {
  const reg = props.account
  const { balance, entries, bankTxs } = props
  const lines = useMemo(() => {
    const out: { key: string; date: string; detail: string; amount: number; pending?: boolean; entry?: CashFlowEntry }[] = []
    for (const t of bankTxs || []) {
      out.push({
        key: `bank-${t.transaction_id || t.date + t.detail + t.amount}`,
        date: String(t.date || "").slice(0, 10),
        detail: t.detail || "Bank",
        amount: Number(t.amount) || 0,
        pending: Boolean(t.pending),
      })
    }
    for (const e of entries || []) {
      const amt = Math.abs(Number(e.amount) || 0)
      out.push({
        key: `entry-${e.id}`,
        date: String(e.date || "").slice(0, 10),
        detail: e.description || e.category || "Entry",
        amount: e.type === "income" ? amt : -amt,
        entry: e,
      })
    }
    out.sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date))
      if (byDate !== 0) return byDate
      return String(b.key).localeCompare(String(a.key))
    })
    return out
  }, [bankTxs, entries])

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={props.onBack} className="self-start text-[12px] font-bold text-[#5b8cff]">
        ← Accounts
      </button>
      <div className="rounded-2xl border border-[#262633] bg-[#111119] p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{accountDisplayName(reg.name).title}</p>
        <p className={cn("mt-1 font-mono text-[22px] font-bold tabular-nums", (balance ?? 0) < 0 ? "text-[#ff5d6c]" : "text-[#f2f3f7]")}>
          {balance == null ? "—" : money(balance)}
        </p>
      </div>
      <div className="space-y-1">
        {lines.slice(0, 120).map((line) => (
          <button
            key={line.key}
            type="button"
            onClick={() => line.entry && props.onEditEntry?.(line.entry)}
            className="flex w-full items-center gap-2 rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2 text-left"
          >
            <span className="w-12 shrink-0 font-mono text-[10px] text-neutral-500">{shortDate(line.date)}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-neutral-100">
              {line.detail}
              <PendingBadge pending={line.pending} />
            </span>
            <span className={cn("shrink-0 font-mono text-[12px] font-bold tabular-nums", line.amount < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]")}>
              {money(line.amount)}
            </span>
          </button>
        ))}
        {lines.length === 0 && <p className="px-1 text-[12px] text-neutral-500">No movements yet. Press SYNC.</p>}
      </div>
    </div>
  )
}

export function AddAccountModal(props: {
  onClose: () => void
  onSave: (input: { name: string; kind: "bank" | "card"; limit?: number | null; dueDay?: number | null; balance?: number | null }) => void
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"bank" | "card">("bank")
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3">
      <div className="w-full max-w-md rounded-2xl border border-[#262633] bg-[#111119] p-4">
        <p className="mb-3 text-[14px] font-bold text-[#f2f3f7]">Add account</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="mb-2 w-full rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2 text-[13px] text-[#f2f3f7]"
        />
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setKind("bank")} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-bold", kind === "bank" ? "bg-[#5b8cff] text-white" : "bg-[#262633] text-neutral-400")}>Bank</button>
          <button type="button" onClick={() => setKind("card")} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-bold", kind === "card" ? "bg-[#5b8cff] text-white" : "bg-[#262633] text-neutral-400")}>Card</button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={props.onClose} className="flex-1 rounded-xl border border-[#262633] py-2 text-[13px] font-bold text-neutral-300">Cancel</button>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return
              props.onSave({ name: name.trim(), kind })
              setName("")
            }}
            className="flex-1 rounded-xl bg-[#5b8cff] py-2 text-[13px] font-bold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function TransfersReport(props: {
  report: TransferReport
  onBack: () => void
}) {
  const pairs = props.report?.pairs || []
  const open = (props.report?.unmatchedOut?.length || 0) + (props.report?.unmatchedIn?.length || 0)
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={props.onBack} className="self-start text-[12px] font-bold text-[#5b8cff]">
        ← Back
      </button>
      <p className="text-[14px] font-bold text-[#f2f3f7]">Transferencias</p>
      <p className="text-[12px] text-neutral-400">
        {pairs.length} matched · {open} open
      </p>
      <div className="space-y-1">
        {pairs.slice(0, 50).map((p) => (
          <div key={p.id} className="rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2 text-[12px] text-neutral-200">
            <p className="font-bold">{money(p.amount)}</p>
            <p className="text-[11px] text-neutral-400">{p.originLabel}</p>
            <p className="font-mono text-[10px] text-neutral-500">{p.outDate} → {p.inDate}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
