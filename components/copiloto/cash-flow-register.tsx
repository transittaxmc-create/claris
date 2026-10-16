"use client"

// DUAL REGISTER per account — one register per bank/card.
// Home: health strip + projected cash flow + account grid.
// Detail: that account's register. Flat navigation, editable rows.

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LEDGER_KEY,
  ETIQUETA_ORIGEN,
  etiquetaCombinada,
  normalizarLibro,
  origenDe,
  sinSemillas,
} from "./cash-flow-store"
import {
  money,
  type CashFlowEntry,
  type CashFlowOrigin,
  type CashFlowSource,
  type CashFlowStatus,
  type CashFlowType,
} from "./types"
import {
  buildRegisters,
  accountBalance,
  accountIdFor,
  addManualAccount,
  deleteManualAccount,
  setManualBalance,
  setMainAccount,
  upcomingDues,
  type RegisterAccount,
} from "./registers-store"
import { matchTransfers, type TransferReport } from "./transfer-matcher"
import {
  RegistersHome,
  RegisterDetail,
  AddAccountModal,
  TransfersReport,
  type BankTx,
} from "./account-registers"

interface CashFlowRegisterProps {
  startingActualBalance: number
  onUpdateStartingBalance?: (newBal: number) => void
}

interface SnapshotAccount {
  name?: string
  current_balance?: number
  institution?: string | null
}

interface AutoRecon {
  billId: string
  detail: string
  amount: number
  date: string
}

const RECON_KEY = "claris_autorecon_v1"
const OTHER_FUNDS_KEY = "claris_other_funds_v1"

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function CashFlowRegister({
  startingActualBalance,
  onUpdateStartingBalance,
}: CashFlowRegisterProps) {
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null)

  const [view, setView] = useState<
    { kind: "home" } | { kind: "account"; id: string } | { kind: "transfers" }
  >({ kind: "home" })
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [otherFunds, setOtherFunds] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadJson<string[]>(OTHER_FUNDS_KEY, []),
  )
  const [autoRecon, setAutoRecon] = useState<AutoRecon[]>(() =>
    typeof window === "undefined" ? [] : loadJson<AutoRecon[]>(RECON_KEY, []),
  )

  const [bankAccounts, setBankAccounts] = useState<SnapshotAccount[]>([])
  const [bankTxs, setBankTxs] = useState<BankTx[]>([])
  const [bankTotal, setBankTotal] = useState<number | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState(false)
  const [bankUpdatedAt, setBankUpdatedAt] = useState<string | null>(null)

  const fetchBank = useCallback(async () => {
    setBankLoading(true)
    setBankError(false)
    try {
      const r = await fetch("/api/bank/snapshot", { cache: "no-store" })
      if (!r.ok) throw new Error("bank feed failed")
      const j = await r.json()
      setBankTotal(typeof j.total_balance === "number" ? j.total_balance : null)
      setBankAccounts(Array.isArray(j.accounts) ? j.accounts : [])
      setBankTxs(Array.isArray(j.transactions) ? j.transactions : [])
      setBankUpdatedAt(typeof j.as_of === "string" ? j.as_of : new Date().toISOString())
    } catch {
      setBankError(true)
    } finally {
      setBankLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBank()
  }, [fetchBank])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEDGER_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const lista: CashFlowEntry[] = Array.isArray(parsed) ? parsed : []
      const sinSem = sinSemillas(lista)
      // Etiquetas viejas ("Recibo escaneado") → origen + tipo por separado.
      const { lista: limpio, cambio } = normalizarLibro(sinSem)
      setEntries(limpio)
      if (cambio || sinSem.length !== lista.length) {
        try {
          localStorage.setItem(LEDGER_KEY, JSON.stringify(limpio))
        } catch {}
      }
    } catch {
      setEntries([])
    }
    setIsLoaded(true)
  }, [])

  const saveEntries = (next: CashFlowEntry[]) => {
    setEntries(next)
    try {
      localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
    } catch {}
  }

  const registers = useMemo(
    () => buildRegisters(bankAccounts as any),
    [bankAccounts, showAddAccount, entries],
  )

  const balances = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const r of registers) {
      out[r.id] = accountBalance(r, bankAccounts as any)
    }
    return out
  }, [registers, bankAccounts])

  const dues = useMemo(() => upcomingDues(registers), [registers])

  const transferReport: TransferReport = useMemo(() => {
    const txs = bankTxs.map((t) => ({
      date: t.date,
      bank_account: t.bank_account,
      detail: t.detail,
      amount: t.amount,
    }))
    return matchTransfers(txs)
  }, [bankTxs])

  const handleOpenAddModal = (type: CashFlowType, status: CashFlowStatus) => {
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    setEditingEntry({
      id: `tmp-${Date.now()}`,
      date: iso,
      description: "",
      amount: 0,
      type,
      status,
      source: status === "projected" ? "projection" : "manual",
      origin: "manual",
      sourceLabel: etiquetaCombinada(
        "manual",
        type === "expense" ? (status === "projected" ? "factura" : "recibo") : null,
      ),
      category: "",
      notes: "",
    } as CashFlowEntry)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this entry?")) return
    saveEntries(entries.filter((e) => e.id !== id))
  }

  const handleSaveEntry = (finalEntry: CashFlowEntry) => {
    const exists = entries.some((e) => e.id === finalEntry.id)
    saveEntries(exists ? entries.map((e) => (e.id === finalEntry.id ? finalEntry : e)) : [finalEntry, ...entries])
    setIsModalOpen(false)
    setEditingEntry(null)
  }

  const handleAddAccount = (input: {
    name: string
    kind: "bank" | "card"
    limit?: number | null
    dueDay?: number | null
    balance?: number | null
  }) => {
    addManualAccount(input as any)
    setShowAddAccount(false)
    setBankAccounts((prev) => [...prev])
  }

  const entriesForAccount = useCallback(
    (reg: RegisterAccount): CashFlowEntry[] =>
      entries.filter((e) => {
        const aid = (e as CashFlowEntry & { accountId?: string }).accountId
        if (aid) return aid === reg.id
        return reg.isMain
      }),
    [entries],
  )

  const txsForAccount = useCallback(
    (reg: RegisterAccount): BankTx[] =>
      bankTxs.filter((t) => accountIdFor(String(t.bank_account || "")) === reg.id),
    [bankTxs],
  )

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-neutral-500">Loading ledger…</div>
    )
  }

  const activeAccount = view.kind === "account" ? registers.find((r) => r.id === view.id) || null : null

  return (
    <div
      className="flex w-full flex-col overflow-x-hidden px-1"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="sticky top-0 z-20 border-b border-neutral-800 bg-black/95 px-3 py-1.5 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 px-1 text-[10px] font-bold text-neutral-400">
          <span className="tracking-wider text-emerald-400">DUAL REGISTER</span>
          <span className="rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[9px] text-emerald-300">
            EN VIVO
          </span>
          <button
            type="button"
            onClick={fetchBank}
            disabled={bankLoading}
            title={bankUpdatedAt ? `Bank synced ${bankUpdatedAt}` : "Sync bank now"}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[9px] font-bold text-neutral-300 active:scale-95 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1">
              <RefreshCw className={cn("size-2.5", bankLoading && "animate-spin")} />
              {bankLoading ? "SYNCING" : bankError ? "RETRY" : "SYNC"}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-2">
        {view.kind === "home" && (
          <RegistersHome
            registers={registers}
            balances={balances}
            dues={dues}
            pairCount={transferReport.pairs.length}
            looseCount={transferReport.unmatchedOut.length + transferReport.unmatchedIn.length}
            entries={entries}
            onEditEntry={(e) => {
              setEditingEntry(e)
              setIsModalOpen(true)
            }}
            onOpenAccount={(id) => setView({ kind: "account", id })}
            onAddAccount={() => setShowAddAccount(true)}
            onOpenTransfers={() => setView({ kind: "transfers" })}
          />
        )}

        {view.kind === "account" && activeAccount && (
          <RegisterDetail
            account={activeAccount}
            balance={balances[activeAccount.id] ?? null}
            bankTxs={txsForAccount(activeAccount)}
            entries={entriesForAccount(activeAccount)}
            otherFunds={
              activeAccount.isMain
                ? registers
                    .filter((r) => r.id !== activeAccount.id && r.kind === "bank")
                    .map((r) => ({
                      reg: r,
                      balance: balances[r.id] ?? null,
                      checked: otherFunds.includes(r.id),
                    }))
                : []
            }
            onToggleOtherFund={(id) => {
              setOtherFunds((prev) => {
                const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                try {
                  localStorage.setItem(OTHER_FUNDS_KEY, JSON.stringify(next))
                } catch {}
                return next
              })
            }}
            onBack={() => setView({ kind: "home" })}
            onAddBill={() => handleOpenAddModal("expense", "projected")}
            onAddPost={() => handleOpenAddModal("expense", "actual")}
            onEditEntry={(e) => {
              setEditingEntry(e)
              setIsModalOpen(true)
            }}
            onDeleteEntry={handleDelete}
            onSetDocKind={(id, kind) => {
              saveEntries(
                entries.map((e) => {
                  if (e.id !== id) return e
                  const origin = origenDe(e)
                  if (kind === "bill") {
                    return {
                      ...e,
                      status: "projected" as CashFlowStatus,
                      source: "projection" as CashFlowSource,
                      origin,
                      sourceLabel: etiquetaCombinada(origin, "factura"),
                      isManuallyEdited: true,
                    }
                  }
                  return {
                    ...e,
                    status: "actual" as CashFlowStatus,
                    source: "receipt" as CashFlowSource,
                    origin,
                    sourceLabel: etiquetaCombinada(origin, "recibo"),
                    isManuallyEdited: true,
                  }
                }),
              )
            }}
            onInlineAmount={(id, raw) => {
              const n = parseFloat(raw)
              if (!Number.isFinite(n)) return
              saveEntries(entries.map((e) => (e.id === id ? { ...e, amount: n } : e)))
            }}
            onSetMain={(id) => {
              setMainAccount(id)
              setBankAccounts((prev) => [...prev])
            }}
            onSaveDueDay={(id, day) => {
              try {
                const { setDueDay } = require("./registers-store")
                setDueDay(id, day)
              } catch {}
              setBankAccounts((prev) => [...prev])
            }}
            onSaveManualBalance={(id, v) => {
              setManualBalance(id, v)
              setBankAccounts((prev) => [...prev])
            }}
            onDeleteManual={(id) => {
              deleteManualAccount(id)
              setBankAccounts((prev) => [...prev])
              setView({ kind: "home" })
            }}
          />
        )}

        {view.kind === "transfers" && (
          <TransfersReport report={transferReport} onBack={() => setView({ kind: "home" })} />
        )}
      </div>

      {showAddAccount && (
        <AddAccountModal onClose={() => setShowAddAccount(false)} onSave={handleAddAccount} />
      )}

      {isModalOpen && editingEntry && (
        <EntryModal
          editingEntry={editingEntry}
          setEditingEntry={setEditingEntry}
          entries={entries}
          onSave={handleSaveEntry}
          onClose={() => {
            setIsModalOpen(false)
            setEditingEntry(null)
          }}
        />
      )}

      {viewingReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewingReceipt(null)}
        >
          <img src={viewingReceipt} alt="Receipt" className="max-h-[80vh] w-full object-contain" />
        </div>
      )}
    </div>
  )
}

export function EntryModal(props: {
  editingEntry: CashFlowEntry
  setEditingEntry: (e: CashFlowEntry) => void
  entries: CashFlowEntry[]
  onSave: (e: CashFlowEntry) => void
  onClose: () => void
}) {
  const { editingEntry, setEditingEntry, entries, onSave, onClose } = props
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-extrabold text-white">
          {entries.some((e) => e.id === editingEntry.id) ? "Edit entry" : "New entry"}
        </h3>
        <p className="mb-3 text-[10px] text-neutral-500">All fields editable · corrections always allowed</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Description</label>
            <input
              type="text"
              value={editingEntry.description || ""}
              onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                value={editingEntry.amount || ""}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })
                }
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Date</label>
              <input
                type="date"
                value={(editingEntry.date || "").slice(0, 10)}
                onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-yellow-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Type</label>
              <select
                value={editingEntry.type}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, type: e.target.value as CashFlowType })
                }
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Factura o Recibo</label>
              <select
                value={editingEntry.status}
                onChange={(e) => {
                  const st = e.target.value as CashFlowStatus
                  const isBill = st === "projected"
                  const origin = origenDe(editingEntry)
                  setEditingEntry({
                    ...editingEntry,
                    status: st,
                    source: isBill ? "projection" : "receipt",
                    origin,
                    sourceLabel: etiquetaCombinada(
                      origin,
                      editingEntry.type === "expense" ? (isBill ? "factura" : "recibo") : null,
                    ),
                    isManuallyEdited: true,
                  })
                }}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="projected">Factura (Bill) — por pagar</option>
                <option value="actual">Recibo (Receipt) — ya pagado</option>
              </select>
            </div>
          </div>
          {editingEntry.type === "income" && (
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Origen del ingreso</label>
              <select
                value={origenDe(editingEntry)}
                onChange={(e) => {
                  const o = e.target.value as CashFlowOrigin
                  setEditingEntry({
                    ...editingEntry,
                    origin: o,
                    sourceLabel: etiquetaCombinada(o, null),
                  })
                }}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
              >
                {(Object.keys(ETIQUETA_ORIGEN) as CashFlowOrigin[]).map((o) => (
                  <option key={o} value={o}>
                    {ETIQUETA_ORIGEN[o]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Category</label>
            <input
              type="text"
              value={editingEntry.category || ""}
              onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
              placeholder="e.g. Fuel, EZPass, Insurance"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(editingEntry)}
              className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
