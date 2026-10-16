"use client"

// DUAL REGISTER por cuenta — un register por cada banco/tarjeta.
// Portada: una tarjeta por cuenta (swipe horizontal) + vencimientos.
// Detalle: el register de ESA cuenta. Sin scroll largo, sin expandibles.

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  etiquetaCombinada,
  LEDGER_KEY,
  normalizarLibro,
  origenDe,
  sinSemillas,
} from "./cash-flow-store"
import {
  money,
  type CashFlowEntry,
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

  // Vista: portada | detalle de cuenta | reporte de transferencias
  const [view, setView] = useState<{ kind: "home" } | { kind: "account"; id: string } | { kind: "transfers" }>({ kind: "home" })
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [otherFunds, setOtherFunds] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadJson<string[]>(OTHER_FUNDS_KEY, []),
  )
  const [autoRecon, setAutoRecon] = useState<AutoRecon[]>(() =>
    typeof window === "undefined" ? [] : loadJson<AutoRecon[]>(RECON_KEY, []),
  )

  // ---- Real bank feed (islandcity-register1, shared Supabase) ----
  const [bankTotal, setBankTotal] = useState<number | null>(null)
  const [bankAccounts, setBankAccounts] = useState<SnapshotAccount[]>([])
  const [bankTxs, setBankTxs] = useState<BankTx[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState(false)
  const [bankUpdatedAt, setBankUpdatedAt] = useState<string | null>(null)

  const fetchBank = useCallback(async () => {
    setBankLoading(true)
    setBankError(false)
    try {
      const r = await fetch("/api/bank/snapshot", { cache: "no-store" })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setBankTotal(typeof j.total_balance === "number" ? j.total_balance : null)
      setBankAccounts(Array.isArray(j.accounts) ? j.accounts : [])
      setBankTxs(Array.isArray(j.transactions) ? j.transactions : [])
      setBankUpdatedAt(typeof j.as_of === "string" ? j.as_of : null)
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
      const saved = localStorage.getItem(LEDGER_KEY)
      const parsed = saved ? JSON.parse(saved) : []
      const lista: CashFlowEntry[] = Array.isArray(parsed) ? parsed : []
      const sinSem = sinSemillas(lista)
      // Etiquetas viejas ("Recibo escaneado") → origen + tipo por separado.
      const { lista: limpio, cambio } = normalizarLibro(sinSem)
      setEntries(limpio)
      if (cambio || sinSem.length !== lista.length) localStorage.setItem(LEDGER_KEY, JSON.stringify(limpio))
    } catch {
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // ---- Registers por cuenta ----
  const registers: RegisterAccount[] = useMemo(
    () => (isLoaded ? buildRegisters(bankAccounts) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoaded, bankAccounts],
  )

  const balances = useMemo(() => {
    const m: Record<string, number | null> = {}
    for (const r of registers) m[r.id] = accountBalance(r, bankAccounts)
    return m
  }, [registers, bankAccounts])

  const mainReg = registers.find((r) => r.isMain) || registers[0] || null

  const transferReport: TransferReport = useMemo(() => matchTransfers(bankTxs), [bankTxs])

  const dues = useMemo(() => upcomingDues(registers), [registers])

  // ---- Auto-reconciliación: bill proyectado + salida real del banco = pagado ----
  const reconKey = useRef("")
  useEffect(() => {
    if (!isLoaded || bankTxs.length === 0) return
    const projectedBills = entries.filter((e) => e.status === "projected" && e.type === "expense")
    const key = `${bankTxs.length}|${projectedBills.length}`
    if (reconKey.current === key) return
    reconKey.current = key

    const matched: AutoRecon[] = []
    const updated = entries.map((e) => {
      if (e.status !== "projected" || e.type !== "expense") return e
      const amt = Math.abs(Number(e.amount) || 0)
      if (amt <= 0) return e
      const hit = bankTxs.find(
        (t) =>
          Number(t.amount) < -0.011 &&
          Math.abs(Math.abs(Number(t.amount)) - amt) < 0.011 &&
          String(t.date).slice(0, 10) >= String(e.date).slice(0, 10),
      )
      if (hit) {
        matched.push({ billId: String(e.id), detail: e.description || "Bill", amount: amt, date: String(hit.date).slice(0, 10) })
        return { ...e, status: "actual" as CashFlowStatus, source: "receipt" as CashFlowSource, sourceLabel: "Receipt", isManuallyEdited: true }
      }
      return e
    })

    if (matched.length > 0) {
      try {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(updated))
      } catch {}
      setEntries(updated)
      setAutoRecon((prev) => {
        const next = [...matched, ...prev].slice(0, 30)
        try {
          localStorage.setItem(RECON_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
    }
  }, [isLoaded, bankTxs, entries])

  // ---- Helpers de entries ----
  const saveEntries = useCallback((updated: CashFlowEntry[]) => {
    setEntries(updated)
    try {
      localStorage.setItem(LEDGER_KEY, JSON.stringify(updated))
    } catch {}
  }, [])

  const currentAccountId = view.kind === "account" ? view.id : mainReg?.id || null

  const handleOpenAddModal = (defaultType: CashFlowType = "income", defaultStatus: CashFlowStatus = "actual") => {
    const today = new Date().toISOString().slice(0, 10)
    setEditingEntry({
      id: crypto.randomUUID(),
      date: today,
      description: "",
      source: defaultStatus === "projected" ? "projection" : "manual",
      origin: "manual",
      sourceLabel: etiquetaCombinada("manual", defaultType === "expense" ? (defaultStatus === "projected" ? "factura" : "recibo") : null),
      type: defaultType,
      status: defaultStatus,
      amount: 0,
      category: defaultType === "income" ? "Income" : "General",
      isManuallyEdited: false,
      notes: "",
      createdAt: new Date().toISOString(),
      accountId: currentAccountId || undefined,
    } as CashFlowEntry)
    setIsModalOpen(true)
  }

  const handleEditEntry = (entry: CashFlowEntry) => {
    setEditingEntry({ ...entry })
    setIsModalOpen(true)
  }

  const handleDeleteEntry = (id: string) => {
    if (confirm("Delete this ledger entry?")) {
      saveEntries(entries.filter((e) => e.id !== id))
    }
  }

  const handleInlineAmount = (id: string, raw: string) => {
    const parsed = parseFloat(raw)
    if (!Number.isFinite(parsed)) return
    saveEntries(
      entries.map((e) =>
        e.id === id ? { ...e, amount: Math.round(Math.abs(parsed) * 100) / 100, isManuallyEdited: true } : e,
      ),
    )
  }

  const handleSetDocKind = (id: string, kind: "bill" | "receipt") => {
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
  }

  const handleSaveModal = (entryToSave: CashFlowEntry) => {
    if (!entryToSave.description.trim()) {
      alert("Please enter a description.")
      return
    }
    if (!(Number(entryToSave.amount) > 0)) {
      alert("Please enter an amount greater than 0.")
      return
    }
    const finalEntry: CashFlowEntry = {
      ...entryToSave,
      amount: Number(entryToSave.amount),
      isManuallyEdited: true,
      accountId: (entryToSave as CashFlowEntry).accountId || currentAccountId || undefined,
    }
    const exists = entries.some((e) => e.id === finalEntry.id)
    saveEntries(exists ? entries.map((e) => (e.id === finalEntry.id ? finalEntry : e)) : [finalEntry, ...entries])
    setIsModalOpen(false)
    setEditingEntry(null)
  }

  // ---- Handlers de cuentas ----
  const handleAddAccount = (input: { name: string; kind: "bank" | "card"; limit?: number | null; dueDay?: number | null; balance?: number | null }) => {
    addManualAccount(input)
    setShowAddAccount(false)
    // fuerza reconstrucción de registers
    setBankAccounts((prev) => [...prev])
  }

  const refreshRegisters = useCallback(() => {
    setBankAccounts((prev) => [...prev])
  }, [])

  const handleToggleOtherFund = (id: string) => {
    setOtherFunds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      try {
        localStorage.setItem(OTHER_FUNDS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const txsForAccount = useCallback(
    (reg: RegisterAccount): BankTx[] =>
      bankTxs.filter((t) => accountIdFor(String(t.bank_account || "")) === reg.id),
    [bankTxs],
  )

  const entriesForAccount = useCallback(
    (reg: RegisterAccount): CashFlowEntry[] =>
      entries.filter((e) => {
        const aid = (e as CashFlowEntry).accountId
        if (aid) return aid === reg.id
        return reg.isMain // sin asignar → cuenta principal
      }),
    [entries],
  )

  if (!isLoaded) {
    return <div className="flex items-center justify-center py-12 text-sm text-neutral-500">Loading ledger…</div>
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
      {/* Header fijo: DUAL REGISTER + LIVE + SYNC */}
      <div className="sticky top-0 z-20 border-b border-neutral-800 bg-black/95 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 px-1 text-[10px] font-bold text-neutral-400">
          <span className="tracking-wider text-emerald-400">DUAL REGISTER</span>
          <span className="rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[9px] text-emerald-300">LIVE</span>
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
        {bankTotal !== null && (
          <p className="mt-1 text-center text-[10px] text-neutral-500">
            Total bancos: <span className={cn("font-bold tabular-nums", bankTotal < 0 ? "text-rose-400" : "text-emerald-400")}>{money(bankTotal)}</span>
          </p>
        )}
      </div>

      <div className="mt-2.5">
        {view.kind === "home" && (
          <RegistersHome
            registers={registers}
            balances={balances}
            dues={dues}
            pairCount={transferReport.pairs.length}
            looseCount={transferReport.unmatchedOut.length + transferReport.unmatchedIn.length}
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
                ? registers.filter((r) => r.id !== activeAccount.id && r.kind === "bank").map((r) => ({ reg: r, balance: balances[r.id] ?? null, checked: otherFunds.includes(r.id) }))
                : []
            }
            onToggleOtherFund={handleToggleOtherFund}
            onBack={() => setView({ kind: "home" })}
            onAddBill={() => handleOpenAddModal("expense", "projected")}
            onAddPost={() => handleOpenAddModal("expense", "actual")}
            onEditEntry={handleEditEntry}
            onDeleteEntry={handleDeleteEntry}
            onSetDocKind={handleSetDocKind}
            onInlineAmount={handleInlineAmount}
            onSetMain={(id) => { setMainAccount(id); refreshRegisters() }}
            onSaveDueDay={() => refreshRegisters()}
            onSaveManualBalance={() => refreshRegisters()}
            onDeleteManual={(id) => { deleteManualAccount(id); setView({ kind: "home" }); refreshRegisters() }}
          />
        )}

        {view.kind === "transfers" && (
          <TransfersReport report={transferReport} autoReconciled={autoRecon} onBack={() => setView({ kind: "home" })} />
        )}
      </div>

      {showAddAccount && (
        <AddAccountModal onClose={() => setShowAddAccount(false)} onSave={handleAddAccount} />
      )}

      {viewingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setViewingReceipt(null)}>
          <div className="max-h-[90vh] max-w-lg overflow-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-2" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-bold text-neutral-300">Attached receipt</span>
              <button type="button" onClick={() => setViewingReceipt(null)} className="rounded-lg px-2 py-1 text-xs font-bold text-neutral-400 hover:text-white">
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingReceipt} alt="Receipt" className="max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}

      {isModalOpen && editingEntry && (
        <EntryModal
          editingEntry={editingEntry}
          setEditingEntry={setEditingEntry}
          entries={entries}
          onSave={handleSaveModal}
          onClose={() => { setIsModalOpen(false); setEditingEntry(null) }}
        />
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 sm:rounded-2xl">
        <h3 className="mb-1 text-sm font-extrabold text-white">
          {entries.some((e) => e.id === editingEntry.id) ? "Edit entry" : "New entry"}
        </h3>
        <p className="mb-3 text-[10px] leading-snug text-neutral-500">
          Fix anything the scanner got wrong. Every field is editable.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Description / Vendor</label>
            <input
              type="text"
              autoFocus
              value={editingEntry.description}
              onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editingEntry.amount || ""}
                onChange={(e) => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Date</label>
              <input
                type="date"
                value={editingEntry.date}
                onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Income / Expense</label>
              <select
                value={editingEntry.type}
                onChange={(e) => setEditingEntry({ ...editingEntry, type: e.target.value as CashFlowType })}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="income">Income (+)</option>
                <option value="expense">Expense (−)</option>
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
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Category</label>
            <input
              type="text"
              value={editingEntry.category || ""}
              onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
              placeholder="e.g. Tolls, Fuel, Insurance"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Notes</label>
            <textarea
              value={
                editingEntry.notes && String(editingEntry.notes).startsWith("data:image")
                  ? ""
                  : editingEntry.notes || ""
              }
              onChange={(e) => {
                const prev = editingEntry.notes || ""
                const keepImg = prev.startsWith("data:image") ? prev : undefined
                setEditingEntry({
                  ...editingEntry,
                  notes: e.target.value.trim() ? e.target.value : keepImg || "",
                })
              }}
              rows={2}
              placeholder="Optional notes (photo attachment kept if present)"
              className="mt-1 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
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
