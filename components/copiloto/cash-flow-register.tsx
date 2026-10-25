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
  migrateCategory,
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
  last4Of,
  esFondoPermitido,
  addManualAccount,
  deleteManualAccount,
  setManualBalance,
  setMainAccount,
  setDueDay,
  upcomingDues,
  type RegisterAccount,
} from "./registers-store"
import { matchTransfers, looksLikeTransfer, type TransferReport } from "./transfer-matcher"
import { LiabilitiesEntryCard, LiabilitiesScreen } from "./liabilities-screen"
import { SHOTS_CHANGED_EVENT, loadShotTxs, pendingShotsSum } from "./screenshot-txs"
import { AI_CLASS_LAST_KEY, aiApuntesForFindings } from "./ai-daily-classification"
import {
  runReconciliationCheck,
  loadDecisions,
  saveDecision,
  RECON_LAST_AUTO_KEY,
  type ReconReport,
  type ReconFinding,
} from "./reconciliation-check"
import {
  RegistersHome,
  RegisterDetail,
  BankTxEdit,
  AddAccountModal,
  TransfersReport,
  type BankTx,
} from "./account-registers"
import { FINANCE_SYNCED_EVENT } from "./finance-sync"

interface CashFlowRegisterProps {
  startingActualBalance: number
  onUpdateStartingBalance?: (newBal: number) => void
  /** Escanear factura/recibo desde un register: abre el escáner AI de la app. */
  onOpenScanner?: (docTipo?: string) => void
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
  const [bankTxEdit, setBankTxEdit] = useState<BankTx | null>(null)

  const [view, setView] = useState<
    { kind: "home" } | { kind: "account"; id: string } | { kind: "transfers" } | { kind: "liabilities" }
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

  // Reconciliación diaria: reporte + aprobación de Miguel. Nada se aplica solo.
  const [reconReport, setReconReport] = useState<ReconReport | null>(null)
  const [reconLoading, setReconLoading] = useState(false)
  const reconAutoRan = useRef(false)

  const fetchBank = useCallback(async () => {
    setBankLoading(true)
    setBankError(false)
    try {
      const r = await fetch(`/api/bank/snapshot?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
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
    const refresh = window.setInterval(fetchBank, 5 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBank()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(refresh)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [fetchBank])

  const loadLedger = useCallback(() => {
    try {
      const raw = localStorage.getItem(LEDGER_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const lista: CashFlowEntry[] = Array.isArray(parsed) ? parsed : []
      const sinSem = sinSemillas(lista)
      // Etiquetas viejas ("Recibo escaneado") → origen + tipo por separado.
      const { lista: limpio, cambio } = normalizarLibro(sinSem)
      // Migración a inglés (2026-10-18): normalizar categorías viejas.
      let migro = false
      for (const e of limpio) {
        const c = (e as any)?.category
        if (typeof c === "string") {
          const m = migrateCategory(c)
          if (m !== c) {
            ;(e as any).category = m
            migro = true
          }
        }
      }
      setEntries(limpio)
      if (cambio || migro || sinSem.length !== lista.length) {
        try {
          localStorage.setItem(LEDGER_KEY, JSON.stringify(limpio))
        } catch {}
      }
    } catch {
      setEntries([])
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  // Sync con Supabase trajo cambios de otro teléfono: releer libro, cuentas y
  // otros fondos (registers se recalcula porque depende de `entries`).
  useEffect(() => {
    const onSynced = () => {
      loadLedger()
      setOtherFunds(loadJson<string[]>(OTHER_FUNDS_KEY, []))
    }
    window.addEventListener(FINANCE_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(FINANCE_SYNCED_EVENT, onSynced)
  }, [loadLedger])

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

  // Plan B (Miguel, 2026-10-25): el balance de cada cuenta del banco se
  // CALCULA — Plaid + los provisionales de screenshot que Plaid aún no
  // trae. Nada se teclea: el número sale de sumar los movimientos, y es
  // el mismo balance que alimenta MONEY, el register y el SALDO INICIAL
  // de Proyecciones. Cuando Plaid baja el real, el provisional sale y el
  // total no se mueve (continuidad al centavo).
  const [shotsTick, setShotsTick] = useState(0)
  useEffect(() => {
    const onShots = () => setShotsTick((t) => t + 1)
    window.addEventListener(SHOTS_CHANGED_EVENT, onShots)
    return () => window.removeEventListener(SHOTS_CHANGED_EVENT, onShots)
  }, [])

  const balances = useMemo(() => {
    const out: Record<string, number | null> = {}
    const allShots = loadShotTxs()
    for (const r of registers) {
      let b = accountBalance(r, bankAccounts as any)
      if (b != null && r.source !== "manual" && allShots.length > 0) {
        const exact = bankTxs.filter((t) => accountIdFor(String(t.bank_account || "")) === r.id)
        const txs =
          exact.length > 0
            ? exact
            : bankTxs.filter((t) => last4Of(String(t.bank_account || "")) === last4Of(r.name))
        const adj = pendingShotsSum(allShots, r.id, txs)
        if (adj) b = Math.round((b + adj) * 100) / 100
      }
      out[r.id] = b
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registers, bankAccounts, bankTxs, shotsTick])

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

  // Chequeo de reconciliación: por cuenta, en orden. Solo genera el reporte;
  // cada hallazgo se aplica únicamente cuando Miguel lo aprueba.
  const runRecon = useCallback(() => {
    setReconLoading(true)
    try {
      const report = runReconciliationCheck({
        registers: registers.map((r) => ({
          id: r.id,
          name: r.name,
          kind: r.kind,
          source: r.source,
          isMain: r.isMain,
        })),
        balances,
        entries: entries.map((e) => ({
          id: e.id,
          date: String(e.date || "").slice(0, 10),
          description: e.description || e.category || "",
          amount: Number(e.amount) || 0,
          type: e.type,
          status: e.status,
          accountId: (e as CashFlowEntry & { accountId?: string }).accountId,
        })),
        bankTxs: bankTxs.map((t) => ({
          date: String(t.date || "").slice(0, 10),
          bank_account: String(t.bank_account || ""),
          detail: String(t.detail || ""),
          amount: Number(t.amount) || 0,
          daily_balance:
            t.daily_balance !== null && t.daily_balance !== undefined && Number.isFinite(Number(t.daily_balance))
              ? Number(t.daily_balance)
              : null,
        })),
        transfers: transferReport,
        bankOk: !bankError && bankAccounts.length > 0,
        decisions: loadDecisions(),
      })
      setReconReport(report)
      try {
        localStorage.setItem(RECON_LAST_AUTO_KEY, new Date().toISOString().slice(0, 10))
      } catch {}
    } finally {
      setReconLoading(false)
    }
  }, [registers, balances, bankTxs, bankError, bankAccounts.length, entries, transferReport])

  // Automático una vez al día, después del sync del banco. Si no hay datos
  // del banco, el reporte lo dice en voz alta (nunca un falso "todo bien").
  useEffect(() => {
    if (reconAutoRan.current || bankLoading || !isLoaded) return
    reconAutoRan.current = true
    runRecon()
  }, [bankLoading, isLoaded, runRecon])

  // AI · CLASIFICACIÓN DIARIA — una vez al día, con el banco y el libro listos:
  // la AI toma los movimientos "sin clasificar" del chequeo y crea los apuntes
  // YA categorizados (reglas + lo aprendido). Miguel solo revisa en REPORTES.
  const aiDailyRan = useRef(false)
  useEffect(() => {
    if (aiDailyRan.current || bankLoading || !isLoaded || !reconReport) return
    aiDailyRan.current = true
    if (!reconReport.ok) return
    const today = new Date().toISOString().slice(0, 10)
    let last = ""
    try {
      last = localStorage.getItem(AI_CLASS_LAST_KEY) || ""
    } catch {}
    if (last === today) return
    const nuevos = aiApuntesForFindings(reconReport.accounts.flatMap((a) => a.findings))
    if (nuevos.length > 0) {
      setEntries((prev) => {
        const next = [...nuevos, ...prev]
        try {
          localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
    }
    try {
      localStorage.setItem(AI_CLASS_LAST_KEY, today)
    } catch {}
  }, [bankLoading, isLoaded, reconReport])

  const dropFinding = useCallback((key: string) => {
    setReconReport((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        accounts: prev.accounts.map((a) => ({
          ...a,
          findings: a.findings.filter((f) => f.key !== key),
        })),
      }
    })
  }, [])

  // Aprobaciones con updates funcionales: seguro en "Aprobar todo" y clics rápidos.
  const handleApproveFinding = useCallback(
    (f: ReconFinding) => {
      saveDecision(f.key, "a")
      const act = f.proposedAction
      if (act.kind === "eliminar-duplicado" && act.entryId) {
        const delId = act.entryId
        setEntries((prev) => {
          const next = prev.filter((e) => e.id !== delId)
          try {
            localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
          } catch {}
          return next
        })
      } else if (act.kind === "crear-apunte" && f.bankTx) {
        const amt = Number(f.bankTx.amount) || 0
        // Regla de transfers JAMAS inflan ingresos: si el movimiento tiene
        // pinta de transferencia interna (Zelle, transfer, wire...) se crea
        // con origen "transfer" y etiqueta "Internal transfer", no como un
        // ingreso bancario mas. El mismo dolar movido no es ingreso nuevo.
        const esTransfer = looksLikeTransfer(String(f.bankTx.detail || ""))
        const nuevo = {
          id: `bank-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          date: f.bankTx.date,
          description: f.bankTx.detail,
          amount: Math.abs(amt),
          type: amt < 0 ? "expense" : "income",
          status: "actual",
          source: "bank",
          origin: esTransfer ? "transfer" : "bank",
          sourceLabel: esTransfer ? "Internal transfer" : "Bank",
          category: "",
          notes: "",
          accountId: f.accountId,
        } as CashFlowEntry
        setEntries((prev) => {
          const next = [nuevo, ...prev]
          try {
            localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
          } catch {}
          return next
        })
      }
      dropFinding(f.key)
    },
    [dropFinding],
  )

  const handleRejectFinding = useCallback(
    (f: ReconFinding) => {
      saveDecision(f.key, "r")
      dropFinding(f.key)
    },
    [dropFinding],
  )

  const handleEditFinding = useCallback(
    (f: ReconFinding) => {
      if (f.entryId) {
        const e = entries.find((x) => x.id === f.entryId)
        if (e) {
          setEditingEntry(e)
          setIsModalOpen(true)
          return
        }
      }
      if (f.bankTx) {
        const amt = Number(f.bankTx.amount) || 0
        setEditingEntry({
          id: `tmp-${Date.now()}`,
          date: f.bankTx.date,
          description: f.bankTx.detail,
          amount: Math.abs(amt),
          type: amt < 0 ? "expense" : "income",
          status: "actual",
          source: "bank",
          origin: "bank",
          sourceLabel: "Bank",
          category: "",
          notes: "",
          accountId: f.accountId,
        } as CashFlowEntry)
        setIsModalOpen(true)
      }
    },
    [entries],
  )

  const handleApproveAllFindings = useCallback(() => {
    const all = (reconReport?.accounts || []).flatMap((a) => a.findings)
    for (const f of all) handleApproveFinding(f)
  }, [reconReport, handleApproveFinding])

  const handleOpenAddModal = (type: CashFlowType, status: CashFlowStatus, dateIso?: string) => {
    const iso =
      dateIso ||
      (() => {
        const today = new Date()
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      })()
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

  // Proyectado → "Sí, pagado": la factura/ingreso pasa a real con la fecha del
  // banco. Funcional para no pisar cambios recientes del estado.
  const handleMarkPaid = useCallback((entry: CashFlowEntry, paidDate: string) => {
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.id === entry.id
          ? { ...e, status: "actual" as CashFlowStatus, date: paidDate || e.date, isManuallyEdited: true }
          : e,
      )
      try {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  // Match confirmado con ajuste: marca el original como pagado y crea un
  // asiento de ajuste por la diferencia (ej. fee de plataforma). El día
  // queda cuadrado: proyectado = banco + ajuste.
  const handleConfirmWithAdjustment = useCallback(
    (entry: CashFlowEntry, paidDate: string, adjustmentAmount: number, reason: string) => {
      const diff = Math.round(Number(adjustmentAmount || 0) * 100) / 100
      if (Math.abs(diff) < 0.011) {
        handleMarkPaid(entry, paidDate)
        return
      }
      const now = new Date().toISOString()
      const adj: CashFlowEntry = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `adj-${Date.now()}`,
        date: paidDate || entry.date,
        description: `Adjustment: ${reason}`,
        source: "manual",
        sourceLabel: "Match adjustment",
        type: diff < 0 ? "expense" : "income",
        status: "actual",
        amount: Math.abs(diff),
        category: /fee/i.test(reason) ? "Bank fees" : "Adjustment",
        notes: `Balances "${entry.description || "entry"}": bank vs projected diff ${diff < 0 ? "-" : "+"}$${Math.abs(diff).toFixed(2)}`,
        createdAt: now,
        isManuallyEdited: true,
      }
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: "actual" as CashFlowStatus, date: paidDate || e.date, isManuallyEdited: true }
            : e,
        )
        next.unshift(adj)
        try {
          localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
    },
    [handleMarkPaid],
  )

  const handleSaveEntry = (finalEntry: CashFlowEntry) => {
    const exists = entries.some((e) => e.id === finalEntry.id)
    saveEntries(exists ? entries.map((e) => (e.id === finalEntry.id ? finalEntry : e)) : [finalEntry, ...entries])
    setIsModalOpen(false)
    setEditingEntry(null)
  }

  // Edición inline desde el registro proyectado (monto/fecha): guarda en el libro.
  const handlePatchEntry = useCallback(
    (id: string, patch: Partial<CashFlowEntry>) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...patch, isManuallyEdited: true } : e))
        try {
          localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
    },
    [],
  )

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
    (reg: RegisterAccount): BankTx[] => {
      // 1. Match exacto por ID
      const exact = bankTxs.filter((t) => accountIdFor(String(t.bank_account || "")) === reg.id)
      if (exact.length > 0) return exact
      // 2. Fallback por últimos 4 dígitos (Plaid cambia nombres)
      const want4 = last4Of(reg.name)
      if (want4) {
        return bankTxs.filter((t) => last4Of(String(t.bank_account || "")) === want4)
      }
      return exact
    },
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
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Feed del banco (diseño MONEY): estado en vivo + sincronizar. */}
      <div className="sticky top-0 z-20 -mx-1 border-b border-[#262633] bg-[#0a0a0f]/95 px-3 py-1.5 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 px-1 text-[10px] font-bold text-[#9a9cb0]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                bankError ? "bg-[#ff5d6c]" : bankLoading ? "animate-pulse bg-[#f5b84c]" : "bg-[#2fbf71]",
              )}
            />
            <span className="tracking-wider text-[#0a7cff]">PLAID</span>
            <span className="text-[#f2f3f7]">Bank feed</span>
          </span>
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-[9px]",
              bankError
                ? "border-rose-800 bg-rose-950 text-rose-300"
                : "border-emerald-800 bg-emerald-950 text-emerald-300",
            )}
          >
            {bankError ? "OFFLINE" : "LIVE"}
          </span>
          <button
            type="button"
            onClick={fetchBank}
            disabled={bankLoading}
            title={bankUpdatedAt ? `Bank synced ${bankUpdatedAt}` : "Sync bank"}
            className="rounded border border-[#262633] bg-[#16161f] px-2 py-0.5 text-[9px] font-bold text-[#f2f3f7] active:scale-95 disabled:opacity-50"
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
            bankTxs={bankTxs}
            bankOk={!bankError && bankAccounts.length > 0}
            onSyncBank={fetchBank}
            otherFunds={otherFunds}
            onToggleOtherFund={(id) => {
              setOtherFunds((prev) => {
                const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                try {
                  localStorage.setItem(OTHER_FUNDS_KEY, JSON.stringify(next))
                } catch {}
                return next
              })
            }}
            onMarkPaid={handleMarkPaid}
            onConfirmWithAdjustment={handleConfirmWithAdjustment}
            dues={dues}
            pairCount={transferReport.pairs.length}
            looseCount={transferReport.unmatchedOut.length + transferReport.unmatchedIn.length}
            entries={entries}
            reconReport={reconReport}
            reconLoading={reconLoading}
            onRunRecon={runRecon}
            onApproveFinding={handleApproveFinding}
            onRejectFinding={handleRejectFinding}
            onEditFinding={handleEditFinding}
            onApproveAllFindings={handleApproveAllFindings}
            onEditEntry={(e) => {
              setEditingEntry(e)
              setIsModalOpen(true)
            }}
            onPatchEntry={handlePatchEntry}
            onAddEntry={(dateIso) => handleOpenAddModal("expense", "projected", dateIso)}
            onOpenAccount={(id) => setView({ kind: "account", id })}
            onAddAccount={() => setShowAddAccount(true)}
            onOpenTransfers={() => setView({ kind: "transfers" })}
          />
        )}

        {view.kind === "home" && (
          <div className="mt-3 px-2">
            <LiabilitiesEntryCard onOpen={() => setView({ kind: "liabilities" })} />
          </div>
        )}

        {view.kind === "liabilities" && (
          <LiabilitiesScreen bankTxs={bankTxs} onBack={() => setView({ kind: "home" })} />
        )}

        {view.kind === "account" && activeAccount && bankTxEdit && (
          <BankTxEdit
            tx={bankTxEdit}
            onBack={() => setBankTxEdit(null)}
            onSaved={() => {
              setBankTxEdit(null)
              fetchBank()
            }}
          />
        )}

        {view.kind === "account" && activeAccount && !bankTxEdit && (
          <RegisterDetail
            account={activeAccount}
            balance={balances[activeAccount.id] ?? null}
            bankTxs={txsForAccount(activeAccount)}
            entries={entriesForAccount(activeAccount)}
            otherFunds={
              activeAccount.isMain
                ? (() => {
                    // Miguel (2026-10-18): en fondos solo PayPal, Venmo y Square. Si hay
                    // varios "PayPal", se muestra el vivo (mayor |balance|).
                    const cands = registers.filter(
                      (r) => r.id !== activeAccount.id && r.kind === "bank" && esFondoPermitido(r),
                    )
                    const byBase = new Map<string, typeof cands>()
                    for (const r of cands) {
                      const nm = r.name || ""
                      const base = /venmo/i.test(nm) ? "venmo" : /square/i.test(nm) ? "square" : "paypal"
                      byBase.set(base, [...(byBase.get(base) ?? []), r])
                    }
                    const picked: typeof cands = []
                    for (const arr of byBase.values()) {
                      const sorted = [...arr].sort(
                        (a, b) => Math.abs(balances[b.id] ?? 0) - Math.abs(balances[a.id] ?? 0),
                      )
                      if (sorted[0]) picked.push(sorted[0])
                    }
                    return picked.map((r) => ({
                      reg: r,
                      balance: balances[r.id] ?? null,
                      checked: otherFunds.includes(r.id),
                    }))
                  })()
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
            onAddAdjust={() => {
              // El ajuste de balance se hace AHORA como una entrada del register:
              // una apunte con propósito de balancear (no hay pantalla de ajuste).
              const today = new Date()
              const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
              setEditingEntry({
                id: `tmp-adj-${Date.now()}`,
                date: iso,
                description: "Balance adjustment",
                amount: 0,
                type: "income",
                status: "actual",
                source: "manual",
                origin: "manual",
                sourceLabel: "Ajuste",
                category: "Ajuste",
                notes: "Entry to balance the register",
                accountId: activeAccount.id,
              } as CashFlowEntry)
              setIsModalOpen(true)
            }}
            onScanDoc={(t) => props.onOpenScanner?.(t)}
            onEditBankTx={(t) => setBankTxEdit(t)}
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
              setDueDay(id, day)
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
              <label className="text-[10px] font-bold uppercase text-neutral-400">Bill o Receipt</label>
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
                <option value="projected">Bill — payable</option>
                <option value="actual">Receipt (Receipt) — already paid</option>
              </select>
            </div>
          </div>
          {editingEntry.type === "income" && (
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400">Income source</label>
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
