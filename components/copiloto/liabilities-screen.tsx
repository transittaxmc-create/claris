"use client"

// PAYABLES — cuentas liability por deuda (Miguel, 2026-10-25).
//
// Cada deuda recurrente programada en Proyecciones abre sola su Open Bill
// en su cuenta; la cuenta muestra $0 o lo que resta del bill. Los pagos del
// banco se detectan (vendedor o categoría), el match exacto se aplica solo
// (auto, deshacible) y el resto queda POR CONFIRMAR de un toque. Cada bill
// lleva Total | Pagado | Resta y el historial de pagos; la cuenta acumula
// el récord del año (total pagado + cuántos pagos) para el Financial
// Statement y los taxes.

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { money, type Expense, type ScheduledEntry } from "./types"
import { accountDisplayName, accountIdFor, buildRegisters } from "./registers-store"
import {
  learnConfirm,
  learnDismiss,
  ruleKeyFor,
  syncBillToProjections,
  bankTxIdOf,
  type BankTxIn,
} from "./bill-payments"
import { FINANCE_SYNCED_EVENT } from "./finance-sync"
import { loadShotTxs, saveShotTxs } from "./screenshot-txs"
import type { BankTx } from "./account-registers-impl"
import {
  LIABILITY_DISMISSED_KEY,
  addBillPayment,
  appliedBankTxIds,
  applyCategoryProposal,
  applyDetection,
  billPayments,
  buildDebts,
  buildYearHistory,
  categoryProposals,
  categoryYearSums,
  detectBillPayments,
  ensureCycleBills,
  isExactDetection,
  loadCycleBills,
  loadExternalBills,
  loadSchedules,
  removeBillPayment,
  saveCycleBills,
  todayLocal,
  type CategoryProposal,
  type DebtAccount,
  type DetectedPayment,
} from "./liabilities"

const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
function fmtFecha(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return `${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function loadDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LIABILITY_DISMISSED_KEY) || "[]")
    return new Set(Array.isArray(raw) ? raw : [])
  } catch {
    return new Set()
  }
}
function saveDismissed(s: Set<string>): void {
  try {
    localStorage.setItem(LIABILITY_DISMISSED_KEY, JSON.stringify([...s]))
  } catch {}
}

/** Cuenta desde donde salió un pago bancario (del id estable del cargo). */
function accountLabelOf(bankTxId?: string): string {
  if (!bankTxId) return ""
  const seg = bankTxId.split("|")
  return seg.length >= 2 ? seg[1] : ""
}

/**
 * Cuentas elegibles como "pagado desde" (Miguel, 2026-10-29): el bill puede
 * estar programado contra Citibank ★ en Proyecciones, pero el pago real
 * pudo salir de PayPal u otra cuenta — el pago lleva SU cuenta y el bill
 * queda linkeado a ella. La lista sale de los nombres de cuenta del banco
 * (buildRegisters agrega las manuales: PayPal, Branch, Venmo, Lyft…).
 */
function useAccountOptions(bankTxs: BankTx[]): { id: string; label: string; isMain: boolean }[] {
  return useMemo(() => {
    try {
      const names = [...new Set((bankTxs || []).map((t) => String(t.bank_account || "")).filter(Boolean))]
      const regs = buildRegisters(names.map((name) => ({ name }) as any))
      return regs.map((r) => ({
        id: r.id,
        label: accountDisplayName(r.name).title,
        isMain: Boolean(r.isMain),
      }))
    } catch {
      return []
    }
  }, [bankTxs])
}

function accountNameOf(options: { id: string; label: string }[], accountId?: string): string {
  if (!accountId) return ""
  return options.find((o) => o.id === accountId)?.label || ""
}

function useLiabilityData(bankTxs: BankTx[]) {
  const [ownBills, setOwnBills] = useState<Expense[]>([])
  const [externalBills, setExternalBills] = useState<Expense[]>([])
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  const autoDoneRef = useRef<Set<string>>(new Set())
  const today = todayLocal()

  useEffect(() => {
    const sched = loadSchedules()
    const { bills, created } = ensureCycleBills(sched, loadCycleBills(), todayLocal())
    // Bills cuyo recurrente ya no existe (se borró): huérfanos, se retiran.
    const schIds = new Set(sched.map((s) => s.id))
    const kept = bills.filter((b) => !b.originScheduleId || schIds.has(b.originScheduleId))
    if (created > 0 || kept.length !== bills.length) saveCycleBills(kept)
    setSchedules(sched)
    setOwnBills(kept)
    setExternalBills(loadExternalBills())
    setDismissed(loadDismissed())
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const debts = useMemo(
    () => buildDebts(schedules, ownBills, externalBills, today),
    [schedules, ownBills, externalBills, today],
  )
  const totalOwed = useMemo(() => debts.reduce((s, d) => s + d.openRemaining, 0), [debts])

  // Historial del año (1 ene – 31 dic) para el Financial Statement.
  const year = today.slice(0, 4)
  const yearHistory = useMemo(() => buildYearHistory(debts, year), [debts, year])
  const catSums = useMemo(
    () => categoryYearSums(bankTxs || [], year, appliedBankTxIds([...ownBills, ...externalBills])),
    [bankTxs, year, ownBills, externalBills],
  )

  const persistBill = (updated: Expense, bills: Expense[] = ownBills) => {
    const next = bills.map((b) => (b.id === updated.id ? updated : b))
    setOwnBills(next)
    saveCycleBills(next)
    syncBillToProjections(updated)
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
    return next
  }

  // --- Detección de pagos del banco contra los bills de ciclo ---
  const bankTxIns: BankTxIn[] = useMemo(
    () =>
      (bankTxs || []).map((t) => ({
        date: String(t.date || ""),
        bank_account: String(t.bank_account || ""),
        detail: String(t.detail || ""),
        amount: Number(t.amount) || 0,
      })),
    [bankTxs],
  )
  const detections = useMemo(
    () => detectBillPayments(ownBills, bankTxIns).filter((d) => !dismissed.has(d.id)),
    [ownBills, bankTxIns, dismissed],
  )
  const catProposals = useMemo(() => {
    const inDetections = new Set<string>()
    for (const d of detections) for (const tx of d.txs) inDetections.add(bankTxIdOf(tx))
    return categoryProposals(ownBills, bankTxs || []).filter(
      (p) => !dismissed.has(p.id) && !inDetections.has(bankTxIdOf(p.tx)),
    )
  }, [ownBills, bankTxs, detections, dismissed])

  // Match EXACTO por vendedor (ej. el leasing dividido que suma la resta):
  // se aplica solo, con etiqueta auto y siempre deshacible (regla de Miguel).
  useEffect(() => {
    if (!ready || detections.length === 0) return
    const exact = detections.filter((d) => isExactDetection(ownBills, d) && !autoDoneRef.current.has(d.id))
    if (exact.length === 0) return
    let bills = ownBills
    for (const d of exact) {
      const bill = bills.find((b) => b.id === d.billId)
      if (!bill) continue
      autoDoneRef.current.add(d.id)
      const updated = applyDetection(bill, d, accountIdFor, true)
      bills = bills.map((b) => (b.id === updated.id ? updated : b))
      syncBillToProjections(updated)
    }
    setOwnBills(bills)
    saveCycleBills(bills)
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detections, ready])

  const confirmDetection = (d: DetectedPayment) => {
    const bill = ownBills.find((b) => b.id === d.billId)
    if (!bill) return
    const updated = applyDetection(bill, d, accountIdFor, false)
    persistBill(updated)
    learnConfirm(ruleKeyFor(d.txs[0]?.detail), bill, updated.payments?.[updated.payments.length - 1]?.accountId)
    autoDoneRef.current.add(d.id)
  }
  const dismissDetection = (d: DetectedPayment) => {
    const next = new Set(dismissed)
    next.add(d.id)
    setDismissed(next)
    saveDismissed(next)
    learnDismiss(ruleKeyFor(d.txs[0]?.detail))
  }
  const confirmCategory = (p: CategoryProposal) => {
    const bill = ownBills.find((b) => b.id === p.billId)
    if (!bill) return
    persistBill(applyCategoryProposal(bill, p, accountIdFor))
  }
  const dismissCategory = (p: CategoryProposal) => {
    const next = new Set(dismissed)
    next.add(p.id)
    setDismissed(next)
    saveDismissed(next)
  }

  return {
    ready,
    debts,
    totalOwed,
    year,
    yearHistory,
    catSums,
    ownBills,
    persistBill,
    detections: detections.filter((d) => !isExactDetection(ownBills, d)),
    catProposals,
    confirmDetection,
    dismissDetection,
    confirmCategory,
    dismissCategory,
    today,
  }
}

// ---------------------------------------------------------------------------
// Tarjeta de entrada en MONEY (también auto-abre los bills del ciclo)
// ---------------------------------------------------------------------------

export function LiabilitiesEntryCard(props: { onOpen: () => void }) {
  const data = useLiabilityData([])
  const conDeuda = data.debts.filter((d) => d.openRemaining > 0.009).length
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="flex w-full items-center justify-between rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3 text-left active:scale-[.99]"
    >
      <span>
        <span className="block text-[11px] font-extrabold tracking-[.08em] text-[#f5b84c]">PAYABLES</span>
        <span className="mt-0.5 block text-[11px] text-neutral-400">
          {data.ready
            ? conDeuda > 0
              ? `${conDeuda} ${conDeuda === 1 ? "account" : "accounts"} with an open balance`
              : "All settled"
            : "Loading…"}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span
          className="font-mono text-[17px] font-semibold tabular-nums"
          style={{ color: data.totalOwed > 0.009 ? "#ff5d6c" : "#2fbf71" }}
        >
          {money(data.totalOwed)}
        </span>
        <ChevronRight className="size-4 text-neutral-500" />
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Pantalla completa
// ---------------------------------------------------------------------------

export function LiabilitiesScreen(props: { bankTxs: BankTx[]; onBack: () => void }) {
  const data = useLiabilityData(props.bankTxs)
  const accountOptions = useAccountOptions(props.bankTxs)
  const [tab, setTab] = useState<"pagar" | "historial">("pagar")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [payDraft, setPayDraft] = useState<{ billId: string; amount: string; date: string; accountId: string } | null>(null)
  const selected: DebtAccount | null = data.debts.find((d) => d.id === selectedId) || null

  const saveManualPayment = () => {
    if (!payDraft) return
    const bill = data.ownBills.find((b) => b.id === payDraft.billId)
    const monto = Number(payDraft.amount)
    if (!bill || !Number.isFinite(monto) || monto <= 0) {
      setPayDraft(null)
      return
    }
    const updated = addBillPayment(bill, {
      amount: Math.round(monto * 100) / 100,
      date: payDraft.date || data.today,
      source: "manual",
      // La cuenta REAL de donde salió el pago (puede no ser la de la
      // proyección): queda linkeada en el bill para siempre.
      accountId: payDraft.accountId || undefined,
    })
    data.persistBill(updated)
    // PROVISIONAL en el register de la cuenta que pagó (Miguel,
    // 2026-10-29): el pago se ve AL MOMENTO en ese register y su balance
    // lo refleja; cuando Plaid baja el cargo real, el provisional se
    // reemplaza solo (match monto exacto, fecha ±5 días) — sin duplicar.
    const pays = Array.isArray(updated.payments) ? updated.payments : []
    const nuevo = pays[pays.length - 1]
    if (nuevo && nuevo.accountId) {
      try {
        const shots = loadShotTxs().filter((s) => s.paymentId !== nuevo.id)
        shots.push({
          id: `shot-pay-${nuevo.id}`,
          accountId: nuevo.accountId,
          date: String(nuevo.date).slice(0, 10),
          detail: bill.vendor,
          amount: -Math.abs(Math.round(monto * 100) / 100),
          createdAt: new Date().toISOString(),
          source: "payment",
          paymentId: nuevo.id,
          billId: bill.id,
        })
        saveShotTxs(shots)
      } catch {}
    }
    setPayDraft(null)
  }

  const removePayment = (bill: Expense, paymentId: string) => {
    data.persistBill(removeBillPayment(bill, paymentId))
    // Su provisional también sale (el balance de la cuenta se compone solo).
    try {
      const shots = loadShotTxs()
      const next = shots.filter((s) => s.paymentId !== paymentId)
      if (next.length !== shots.length) saveShotTxs(next)
    } catch {}
  }

  return (
    <div className="flex w-full flex-col px-1 pb-6">
      <div className="flex items-center gap-2 px-1 py-2">
        <button
          type="button"
          onClick={selected ? () => setSelectedId(null) : props.onBack}
          className="grid size-8 place-items-center rounded-full border border-[#262633] bg-[#16161f] text-neutral-300 active:scale-95"
          aria-label="Back"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div>
          <h2 className="text-[15px] font-extrabold tracking-wide text-[#f2f3f7]">
            {selected ? selected.name : "Payables"}
          </h2>
          <p className="text-[11px] text-neutral-400">
            {selected
              ? `${selected.category} · ${selected.year}: ${money(selected.yearPaid)} paid · ${selected.yearCount} payments`
              : "Each debt, its own account: $0 or its bill's balance"}
          </p>
        </div>
        {!selected && (
          <span
            className="ml-auto font-mono text-[16px] font-semibold tabular-nums"
            style={{ color: data.totalOwed > 0.009 ? "#ff5d6c" : "#2fbf71" }}
          >
            {money(data.totalOwed)}
          </span>
        )}
      </div>

      {!selected && (
        <div className="mx-1 mb-1 mt-1 flex rounded-[10px] border border-[#262633] bg-[#0a0a0f] p-0.5">
          {(
            [
              ["pagar", "PAYABLES"],
              ["historial", `HISTORY ${data.year}`],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 rounded-[8px] py-1.5 text-[11px] font-extrabold tracking-wide active:scale-[.99]"
              style={{
                background: tab === t ? "#262633" : "transparent",
                color: tab === t ? "#f2f3f7" : "#9a9cb0",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!selected && tab === "pagar" && (data.detections.length > 0 || data.catProposals.length > 0) && (
        <section className="mt-1 rounded-[14px] border border-[#3a2f14] bg-[#171307] px-3 py-2.5">
          <h3 className="text-[11px] font-extrabold tracking-[.08em] text-[#f5b84c]">TO CONFIRM</h3>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            Bank payments that look like they belong to a bill. Applying links them to that bill and subtracts them from the debt.
          </p>
          {data.detections.map((d) => (
            <div key={d.id} className="mt-2 border-t border-[#262633] pt-2">
              <p className="text-[12.5px] font-semibold text-neutral-100">
                {d.billVendor} — {money(d.billRemaining)} remaining
              </p>
              {d.txs.map((tx) => (
                <p key={bankTxIdOf(tx)} className="mt-0.5 flex justify-between text-[12px] text-neutral-300">
                  <span>
                    {fmtFecha(tx.date)} · {tx.bank_account} · {tx.detail}
                  </span>
                  <span className="font-mono tabular-nums">{money(Math.abs(tx.amount))}</span>
                </p>
              ))}
              {d.isSplit && <p className="mt-0.5 text-[11px] text-[#f5b84c]">Payment split across accounts</p>}
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => data.confirmDetection(d)}
                  className="rounded-lg bg-[#2fbf71] px-3 py-1.5 text-[12px] font-bold text-black active:scale-95"
                >
                  Apply {money(d.total)}
                </button>
                <button
                  type="button"
                  onClick={() => data.dismissDetection(d)}
                  className="rounded-lg border border-[#262633] px-3 py-1.5 text-[12px] font-semibold text-neutral-300 active:scale-95"
                >
                  Not this one
                </button>
              </div>
            </div>
          ))}
          {data.catProposals.map((p) => (
            <div key={p.id} className="mt-2 border-t border-[#262633] pt-2">
              <p className="text-[12.5px] font-semibold text-neutral-100">
                {p.billVendor} — {money(p.billRemaining)} remaining <span className="text-[#f5b84c]">(by category)</span>
              </p>
              <p className="mt-0.5 flex justify-between text-[12px] text-neutral-300">
                <span>
                  {fmtFecha(p.tx.date)} · {p.tx.bank_account} · {p.tx.detail}
                </span>
                <span className="font-mono tabular-nums">{money(Math.abs(p.tx.amount))}</span>
              </p>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => data.confirmCategory(p)}
                  className="rounded-lg bg-[#2fbf71] px-3 py-1.5 text-[12px] font-bold text-black active:scale-95"
                >
                  Apply {money(Math.abs(p.tx.amount))}
                </button>
                <button
                  type="button"
                  onClick={() => data.dismissCategory(p)}
                  className="rounded-lg border border-[#262633] px-3 py-1.5 text-[12px] font-semibold text-neutral-300 active:scale-95"
                >
                  Not this one
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!selected &&
        tab === "pagar" &&
        data.debts.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedId(d.id)}
            className="mt-2.5 flex w-full items-center justify-between rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3 text-left active:scale-[.99]"
          >
            <span>
              <span className="block text-[13.5px] font-bold text-[#f2f3f7]">{d.name}</span>
              <span className="mt-0.5 block text-[11px] text-neutral-400">
                {d.category} · {d.year}: {money(d.yearPaid)} paid · {d.yearCount} payments
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span
                className="font-mono text-[15.5px] font-semibold tabular-nums"
                style={{ color: d.openRemaining > 0.009 ? "#ff5d6c" : "#2fbf71" }}
              >
                {d.openRemaining > 0.009 ? money(d.openRemaining) : "$0.00"}
              </span>
              <ChevronRight className="size-4 text-neutral-500" />
            </span>
          </button>
        ))}
      {!selected && tab === "pagar" && data.ready && data.debts.length === 0 && (
        <p className="px-2 py-6 text-center text-[12.5px] text-neutral-400">
          No scheduled debts yet. When you schedule a recurring expense in Projections, its liability account
          opens here on its own with its first bill.
        </p>
      )}

      {!selected && tab === "historial" && (
        <div className="mt-1">
          {/* Resumen del año de bills */}
          <div className="rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3">
            <p className="text-[11px] font-extrabold tracking-[.08em] text-neutral-400">
              BILLS · {data.year} (JAN 1 – DEC 31)
            </p>
            <div className="mt-2 grid grid-cols-3 text-center">
              <div>
                <p className="text-[10px] font-bold tracking-wider text-neutral-500">BILLED</p>
                <p className="font-mono text-[14px] tabular-nums text-neutral-100">{money(data.yearHistory.totalBilled)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-neutral-500">PAID</p>
                <p className="font-mono text-[14px] tabular-nums text-[#2fbf71]">{money(data.yearHistory.totalPaid)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-neutral-500">PAYMENTS</p>
                <p className="font-mono text-[14px] tabular-nums text-neutral-100">{data.yearHistory.totalCount}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">
              Every payment applied to its bill, no matter which account it came from. This feeds the Financial Statement and the
              tax deduction.
            </p>
          </div>

          {/* Por deuda */}
          {data.yearHistory.perDebt.map((h) => (
            <button
              key={h.debtId}
              type="button"
              onClick={() => setSelectedId(h.debtId)}
              className="mt-2.5 flex w-full items-center justify-between rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3 text-left active:scale-[.99]"
            >
              <span>
                <span className="block text-[13.5px] font-bold text-[#f2f3f7]">{h.name}</span>
                <span className="mt-0.5 block text-[11px] text-neutral-400">
                  {h.category} · Billed {money(h.billedYear)} · {h.countYear} payments
                  {h.remainingYear > 0.009 ? ` · ${money(h.remainingYear)} left` : " · Up to date"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-mono text-[15.5px] font-semibold tabular-nums text-[#2fbf71]">
                  {money(h.paidYear)}
                </span>
                <ChevronRight className="size-4 text-neutral-500" />
              </span>
            </button>
          ))}

          {/* Cada pago del año */}
          {data.yearHistory.payments.length > 0 && (
            <div className="mt-3 rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3">
              <p className="text-[11px] font-extrabold tracking-[.08em] text-neutral-400">
                PAYMENTS IN {data.year} · {data.yearHistory.payments.length}
              </p>
              {data.yearHistory.payments.map((p, i) => (
                <p
                  key={`${p.date}-${p.debtName}-${i}`}
                  className="flex items-center justify-between border-t border-[#1a1c24] py-1.5 text-[12px] text-neutral-300 first:border-t-0"
                >
                  <span>
                    {fmtFecha(p.date)} · {p.debtName}
                    <span className="text-neutral-500">
                      {" "}
                      · {p.source === "banco" ? p.account || "Bank" : p.source === "recibo" ? "Receipt" : "Manual"}
                      {p.note ? ` · ${p.note}` : ""}
                      {p.auto ? " · auto" : ""}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">{money(p.amount)}</span>
                </p>
              ))}
            </div>
          )}

          {/* Gastos sin bill, por categoría */}
          <div className="mt-3 rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3">
            <p className="text-[11px] font-extrabold tracking-[.08em] text-neutral-400">
              EXPENSES BY CATEGORY · {data.year} (NO BILL)
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Real money out of the bank, summed by category — like gas, which isn't a bill. No internal
              transfers and no double-counting payments already applied to bills.
            </p>
            {data.catSums.length === 0 && (
              <p className="py-3 text-center text-[12px] text-neutral-500">No bank expenses this year yet.</p>
            )}
            {data.catSums.map((c) => (
              <p
                key={c.category}
                className="flex items-center justify-between border-t border-[#1a1c24] py-1.5 text-[12.5px] text-neutral-200 first:border-t-0"
              >
                <span>
                  {c.category} <span className="text-neutral-500">· {c.count} txns</span>
                </span>
                <span className="font-mono tabular-nums">{money(c.total)}</span>
              </p>
            ))}
            {data.catSums.length > 0 && (
              <p className="flex items-center justify-between border-t border-[#262633] pt-2 text-[12.5px] font-bold text-neutral-100">
                <span>Total expenses by category</span>
                <span className="font-mono tabular-nums">
                  {money(data.catSums.reduce((s, c) => s + c.total, 0))}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-1">
          <div className="rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3">
            <p className="text-[11px] font-extrabold tracking-[.08em] text-neutral-400">OWED NOW</p>
            <p
              className="mt-0.5 font-mono text-[20px] font-semibold tabular-nums"
              style={{ color: selected.openRemaining > 0.009 ? "#ff5d6c" : "#2fbf71" }}
            >
              {money(selected.openRemaining)}
            </p>
            <p className="mt-1 text-[11.5px] text-neutral-400">
              Record {selected.year} (for taxes): <b className="text-neutral-200">{money(selected.yearPaid)}</b>{" "}
              paid in {selected.yearCount} payments
            </p>
          </div>

          {selected.bills.map((c) => (
            <div key={c.bill.id} className="mt-2.5 rounded-[14px] border border-[#262633] bg-[#101018] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#f2f3f7]">Bill · {fmtFecha(c.bill.date)}</p>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide"
                  style={{
                    color: !c.open ? "#2fbf71" : c.paid > 0 ? "#f5b84c" : "#ff5d6c",
                    background: "rgba(255,255,255,.05)",
                  }}
                >
                  {!c.open ? "PAID" : c.paid > 0 ? "PARTIAL" : "OPEN"}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-3 text-center">
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-neutral-500">TOTAL</p>
                  <p className="font-mono text-[13.5px] tabular-nums text-neutral-100">{money(c.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-neutral-500">PAID</p>
                  <p className="font-mono text-[13.5px] tabular-nums text-[#2fbf71]">{money(c.paid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-neutral-500">LEFT</p>
                  <p
                    className="font-mono text-[13.5px] font-semibold tabular-nums"
                    style={{ color: c.remaining > 0.009 ? "#ff5d6c" : "#2fbf71" }}
                  >
                    {money(c.remaining)}
                  </p>
                </div>
              </div>

              {billPayments(c.bill).length > 0 && (
                <div className="mt-2 border-t border-[#262633] pt-1.5">
                  {billPayments(c.bill).map((p) => (
                    <p key={p.id} className="flex items-center justify-between py-0.5 text-[12px] text-neutral-300">
                      <span>
                        {fmtFecha(p.date)} ·{" "}
                        {p.source === "banco"
                          ? accountLabelOf(p.bankTxId) || "Bank"
                          : p.source === "recibo"
                            ? "Receipt"
                            : "Manual"}
                        {p.source !== "banco" && accountNameOf(accountOptions, p.accountId)
                          ? ` · ${accountNameOf(accountOptions, p.accountId)}`
                          : ""}
                        {p.note ? ` · ${p.note}` : ""}
                        {p.auto ? <span className="text-[#f5b84c]"> · auto</span> : null}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono tabular-nums">{money(p.amount)}</span>
                        {!c.external && (
                          <button
                            type="button"
                            aria-label="Remove payment"
                            onClick={() => removePayment(c.bill, p.id)}
                            className="grid size-5 place-items-center rounded-full border border-[#262633] text-neutral-400 active:scale-90"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    </p>
                  ))}
                </div>
              )}

              {c.open && !c.external && payDraft?.billId !== c.bill.id && (
                <button
                  type="button"
                  onClick={() =>
                    setPayDraft({
                      billId: c.bill.id,
                      amount: String(c.remaining || ""),
                      date: data.today,
                      accountId: (accountOptions.find((o) => o.isMain) || accountOptions[0])?.id || "",
                    })
                  }
                  className="mt-2 rounded-lg border border-[#262633] px-3 py-1.5 text-[12px] font-semibold text-neutral-200 active:scale-95"
                >
                  Record payment
                </button>
              )}
              {c.open && !c.external && payDraft?.billId === c.bill.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-[#262633] pt-2">
                  <label className="flex flex-col gap-1 text-[10.5px] font-bold tracking-wider text-neutral-400">
                    AMOUNT
                    <input
                      value={payDraft.amount}
                      onChange={(e) => setPayDraft({ ...payDraft, amount: e.target.value })}
                      inputMode="decimal"
                      className="w-24 rounded-lg border border-[#262633] bg-[#0a0a0f] px-2 py-1.5 font-mono text-[13px] text-neutral-100 outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10.5px] font-bold tracking-wider text-neutral-400">
                    DATE
                    <input
                      type="date"
                      value={payDraft.date}
                      onChange={(e) => setPayDraft({ ...payDraft, date: e.target.value })}
                      className="rounded-lg border border-[#262633] bg-[#0a0a0f] px-2 py-1.5 text-[13px] text-neutral-100 outline-none"
                    />
                  </label>
                  {accountOptions.length > 0 && (
                    <label className="flex flex-col gap-1 text-[10.5px] font-bold tracking-wider text-neutral-400">
                      PAID FROM
                      <select
                        value={payDraft.accountId}
                        onChange={(e) => setPayDraft({ ...payDraft, accountId: e.target.value })}
                        className="rounded-lg border border-[#262633] bg-[#0a0a0f] px-2 py-1.5 text-[13px] text-neutral-100 outline-none"
                      >
                        {accountOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                            {o.isMain ? " ★" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={saveManualPayment}
                    className="rounded-lg bg-[#2fbf71] px-3 py-1.5 text-[12px] font-bold text-black active:scale-95"
                  >
                    Save payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayDraft(null)}
                    className="rounded-lg border border-[#262633] px-3 py-1.5 text-[12px] font-semibold text-neutral-300 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {c.external && (
                <p className="mt-2 text-[10.5px] text-neutral-500">
                  Bill from Expenses/scanner — its history shows here; its payments are managed in Expenses.
                </p>
              )}
            </div>
          ))}
          {selected.bills.length === 0 && (
            <p className="px-2 py-6 text-center text-[12.5px] text-neutral-400">
              This debt has no bills yet. The next cycle will open its own automatically.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
