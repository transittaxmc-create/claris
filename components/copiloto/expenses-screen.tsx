"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Camera, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/dates"
import {
  EXPENSE_CATEGORIES,
  findDuplicateExpense,
  nextOccurrenceDate,
  scheduledEntryFromExpense,
  type Expense,
  type ExpenseClassification,
  type ScheduleFrequency,
  type ScheduledEntry,
  expenseTotal,
  money,
} from "./types"
import { MoneyInput } from "./money-input"
import { sugerirTipoDoc } from "./cash-flow-store"
import { accountBalance, accountDisplayName, accountIdFor, buildRegisters } from "./registers-store"
import {
  addBillPayment,
  billForLearnedRule,
  billPaidTotal,
  billRemaining,
  billStatus,
  detectBillPayments,
  isBill,
  isBillOpen,
  learnedRuleFor,
  learnConfirm,
  learnDismiss,
  newBillPayment,
  offerReceiptBillMatch,
  removeBillPayment,
  ruleKeyFor,
  syncBillToProjections,
  bankTxIdOf,
  vendorFuzzyMatch,
  type BankTxIn,
  type DetectedPayment,
} from "./bill-payments"

// ---------------------------------------------------------------------------
// Emparejar recibos con el statement del banco.
// Mismas convenciones que transfer-matcher.ts: ±$0.01 y ventana de 4 días.
// Solo se MUESTRA la coincidencia; nunca se borra ni fusiona nada solo.
// ---------------------------------------------------------------------------
interface BankTxLite {
  date: string
  bank_account: string
  detail: string
  amount: number
}

const MATCH_AMOUNT_TOL = 0.011
const MATCH_DAY_WINDOW = 4

function daysBetween(a: string, b: string): number {
  const t = (s: string) => new Date(`${String(s).slice(0, 10)}T12:00:00`).getTime()
  const ms = t(a) - t(b)
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 86400000)) : 999
}

/** Busca el cargo bancario que corresponde a un gasto (mismo monto, fecha cercana).
 * Cubre recibos Y facturas/bills: si el cargo ya salió en el banco, el gasto
 * queda marcado como matched (prueba definitiva, archivada).
 * Si el gasto tiene cuenta indicada, solo se busca en ESA cuenta; si no,
 * se busca en all (comportamiento anterior para entradas viejas). */
function bankMatchFor(expense: Expense, bankTxs: BankTxLite[]): BankTxLite | null {
  if (!bankTxs || bankTxs.length === 0) return null
  // Recibos (ya pagados) y facturas/bills (por pagar): ambos pueden tener su
  // cargo en el banco. Los manuales sin docType también se intentan.
  const esRecibo = expense.scanned || expense.isAiGenerated || expense.docType === "recibo"
  const esFactura = expense.docType === "factura"
  if (!esRecibo && !esFactura && expense.docType === "manual") return null
  const need = Math.abs(Number(expense.amount) || 0)
  if (need <= 0) return null
  const scopeId = expense.accountId || ""
  let best: BankTxLite | null = null
  let bestDays = 999
  for (const tx of bankTxs) {
    if (scopeId && accountIdFor(String(tx.bank_account || "")) !== scopeId) continue
    const amt = Number(tx.amount)
    if (!Number.isFinite(amt) || amt >= -MATCH_AMOUNT_TOL) continue // solo salidas
    if (Math.abs(Math.abs(amt) - need) > MATCH_AMOUNT_TOL) continue
    const d = daysBetween(tx.date, expense.date)
    if (d > MATCH_DAY_WINDOW) continue
    if (d < bestDays) {
      bestDays = d
      best = tx
    }
  }
  return best
}

// Pantalla de gastos (pestaña EXPENSES). Mismo estilo que REGISTER y el mismo
// esquema de guardado que los viajes: el padre (copiloto-app) se encarga de
// persistir en localStorage + IndexedDB y de sincronizar.
//
// Además, cada gasto puede programarse con vencimiento y frecuencia: al guardar
// se crea también una entrada en claris_scheduled_entries (el ledger que ve
// FINANCE), para dar seguimiento a los pagos que se repiten. Y se clasifica
// como BUSINESS (deducible) o PERSONAL, manualmente o con la propuesta de la IA.

type Draft = {
  id: string | null
  date: string
  vendor: string
  category: string
  amount: number
  notes: string
  isAiGenerated?: boolean
  // Factura (por pagar) o Recibo (ya pagado). Se elige siempre; "" = sin elegir.
  docType?: "factura" | "recibo" | ""
  // Programación opcional: "once" = gasto único; el resto crea una entrada en
  // el ledger programado con su próxima fecha.
  frequency: ScheduleFrequency
  nextDate: string
  // Clasificación fiscal: business / personal / sin clasificar.
  classification?: ExpenseClassification
  // Cuenta/register de donde salió (editable; "" = sin indicar).
  accountId?: string
}

function emptyDraft(): Draft {
  const today = localDateKey(new Date())
  return {
    id: null,
    date: today,
    vendor: "",
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    notes: "",
    isAiGenerated: false,
    frequency: "once",
    nextDate: today,
  }
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-2 py-3">
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">{label}</span>
      <span className={cn("text-lg font-extrabold", valueClass)}>{value}</span>
    </div>
  )
}

function ExpenseRow({
  expense,
  onEdit,
  onDelete,
  bankMatch,
  accountName,
  onAddPayment,
  onDeletePayment,
  accountNameById,
}: {
  expense: Expense
  onEdit: (e: Expense) => void
  onDelete: (id: string) => void
  bankMatch?: BankTxLite | null
  accountName?: string | null
  onAddPayment?: (billId: string) => void
  onDeletePayment?: (billId: string, paymentId: string) => void
  accountNameById?: Map<string, string>
}) {
  const esFactura = isBill(expense)
  const pagado = esFactura ? billPaidTotal(expense) : 0
  const resta = esFactura ? billRemaining(expense) : 0
  const estado = esFactura ? billStatus(expense) : "abierta"
  const pagos = esFactura ? (Array.isArray(expense.payments) ? expense.payments : []) : []
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-bold text-white">{expense.vendor || "(no vendor)"}</span>
          <span className="text-[11px] text-neutral-500">{expense.date}</span>
        </div>
        <p className="shrink-0 text-base font-extrabold text-rose-400">{money(expense.amount)}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[10px] font-bold text-neutral-300">
          {expense.category}
        </span>
        {(expense.isAiGenerated || expense.scanned) && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold text-sky-400">
            <Sparkles className="size-2.5" /> SCANNED
          </span>
        )}
        {expense.docType === "factura" && (
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold text-cyan-300">
            BILL
          </span>
        )}
        {expense.docType === "recibo" && (
          <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold text-purple-300">
            RECEIPT
          </span>
        )}
        {expense.isEditedByUser && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400">
            EDITED
          </span>
        )}
        {expense.scheduled && (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold text-yellow-300">
            <CalendarClock className="size-2.5" /> SCHEDULED
          </span>
        )}
        {expense.classification === "business" && (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
            💼 BUSINESS
          </span>
        )}
        {expense.classification === "personal" && (
          <span className="rounded-full border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-[9px] font-bold text-neutral-400">
            🏠 PERSONAL
          </span>
        )}
        {(bankMatch || expense.bankMatched) && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300"
            title={
              expense.bankMatched
                ? `Matched ${expense.bankMatched.date} · ${expense.bankMatched.detail} · $${Math.abs(expense.bankMatched.amount).toFixed(2)}`
                : `${bankMatch?.detail || "Bank"} · ${String(bankMatch?.date).slice(0, 10)} · ${bankMatch?.bank_account || ""}`
            }
          >
            🏦 IN BANK{expense.bankMatched ? " ✓" : ""}
          </span>
        )}
        {accountName && (
          <span
            className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[9px] font-bold text-neutral-300"
            title="Account it came from"
          >
            {accountName}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onEdit(expense)}
          className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] font-bold text-neutral-300 hover:text-white"
        >
          <Pencil className="size-3" /> EDIT
        </button>
        <button
          type="button"
          onClick={() => onDelete(expense.id)}
          aria-label="Delete expense"
          className="flex items-center gap-1 rounded-lg border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] font-bold text-rose-400 hover:text-rose-300"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {esFactura && (
        <div className="mt-2 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-neutral-300">
              Total {money(expense.amount)} <span className="text-neutral-600">·</span>{" "}
              <span className="text-emerald-400">Paid {money(pagado)}</span>{" "}
              <span className="text-neutral-600">·</span>{" "}
              <span className={resta > 0.009 ? "text-amber-300" : "text-neutral-400"}>
                {money(resta)} left
              </span>
            </p>
            {estado === "pagada" ? (
              <span className="shrink-0 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-300">
                PAID
              </span>
            ) : (
              <span className="inline-flex shrink-0 animate-pulse items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black text-amber-300">
                ⏳ Pending balance
              </span>
            )}
          </div>
          {pagos.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="min-w-0 truncate text-neutral-400">
                    {String(p.date).slice(0, 10)} · {money(p.amount)}
                    {p.accountId && accountNameById?.get(p.accountId)
                      ? ` · ${accountNameById.get(p.accountId)}`
                      : ""}
                    {p.source === "banco" ? " · 🏦" : p.source === "recibo" ? " · 🧾" : ""}
                    {p.auto ? (
                      <span className="ml-1 rounded bg-sky-500/20 px-1 py-px text-[8px] font-black text-sky-300">
                        auto
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeletePayment?.(expense.id, p.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-rose-400 hover:bg-rose-950/40"
                    title="Remove payment (undo)"
                  >
                    quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          {estado === "abierta" && onAddPayment && (
            <button
              type="button"
              onClick={() => onAddPayment(expense.id)}
              className="mt-1.5 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-1.5 text-[10px] font-extrabold text-cyan-200 active:scale-[0.99]"
            >
              ＋ RECORD PAYMENT
            </button>
          )}
        </div>
      )}

      {expense.notes && <p className="mt-2 line-clamp-2 text-[11px] leading-tight text-neutral-500">{expense.notes}</p>}
    </div>
  )
}

export function ExpensesScreen({
  expenses,
  onSave,
  onDelete,
  onScanReceipt,
}: {
  expenses: Expense[]
  onSave: (e: Expense) => void
  onDelete: (id: string) => void
  /** Abre el escáner nuevo, a pantalla completa. Si no viene, se usa el de antes. */
  onScanReceipt?: () => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState("")
  // Orden: lo más nuevo arriba por defecto (siempre al abrir).
  const [newestFirst, setNewestFirst] = useState(true)
  const [category, setCategory] = useState("All")
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)

  // Categorías personalizadas: si la IA no tiene la categoría correcta, el
  // usuario añade una y queda disponible en el formulario y en el filtro.
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("claris_custom_categories") || "[]")
      return Array.isArray(raw) ? raw.filter((c) => typeof c === "string" && c.trim()) : []
    } catch {
      return []
    }
  })
  const [newCategory, setNewCategory] = useState("")

  // Snapshot del banco (para emparejar recibos con el statement).
  // Se trae once al abrir la pantalla; si falla, simplemente no hay matches.
  const [bankTxs, setBankTxs] = useState<BankTxLite[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  useEffect(() => {
    let alive = true
    fetch("/api/bank/snapshot", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) {
          if (Array.isArray(j.transactions)) setBankTxs(j.transactions)
          if (Array.isArray(j.accounts)) setBankAccounts(j.accounts)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Registers/cuentas para "¿De qué cuenta salió?" (mismos que DINERO).
  const registers = useMemo(() => {
    try {
      return buildRegisters(bankAccounts)
    } catch {
      return []
    }
  }, [bankAccounts])
  const balances = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const r of registers) {
      try {
        out[r.id] = accountBalance(r, bankAccounts)
      } catch {
        out[r.id] = null
      }
    }
    return out
  }, [registers, bankAccounts])
  const orderedRegisters = useMemo(
    () => [...registers].sort((a, b) => Number(b.isMain) - Number(a.isMain)),
    [registers],
  )
  const defaultAccountId = (registers.find((r) => r.isMain) || registers[0])?.id || ""
  const accountNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of registers) m.set(r.id, `${accountDisplayName(r.name).title}${r.isMain ? " ★" : ""}`)
    return m
  }, [registers])

  // Mapa gasto.id -> cargo bancario coincidente (recibos y facturas).
  const bankMatches = useMemo(() => {
    const m = new Map<string, BankTxLite>()
    if (bankTxs.length === 0) return m
    for (const e of expenses) {
      const b = bankMatchFor(e, bankTxs)
      if (b) m.set(e.id, b)
    }
    return m
  }, [expenses, bankTxs])

  // Persistir matches: cuando el cargo aparece en el banco, el gasto queda
  // marcado como matched con los datos del banco (prueba archivada para futuro).
  // Solo persiste los nuevos; el ref evita re-guardar en cada render.
  const persistedMatches = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const e of expenses) {
      if (e.bankMatched || persistedMatches.current.has(e.id)) continue
      const b = bankMatches.get(e.id)
      if (!b) continue
      persistedMatches.current.add(e.id)
      onSave({
        ...e,
        bankMatched: {
          date: String(b.date || "").slice(0, 10),
          detail: b.detail || "Bank",
          amount: Number(b.amount) || 0,
          matchedAt: new Date().toISOString(),
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankMatches])

  // ---- Sistema de pago de facturas por partes ----
  // Formulario compacto "Record payment" (monto + cuenta + fecha).
  const [payDraft, setPayDraft] = useState<{ billId: string; amount: string; accountId: string; date: string } | null>(null)
  // Sugerencias descartadas por Miguel (no vuelven a salir en esta sesión).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // Cargos ya procesados por auto-clasificación (no repetir).
  const autoDoneRef = useRef<Set<string>>(new Set())

  // Detección: cargos bancarios que parecen pagos de facturas abiertas.
  // Incluye pago dividido (varios cargos que suman el resto).
  const detected: DetectedPayment[] = useMemo(() => {
    if (bankTxs.length === 0) return []
    const txs: BankTxIn[] = bankTxs.map((t) => ({
      date: String(t.date || ""),
      bank_account: String(t.bank_account || ""),
      detail: String(t.detail || ""),
      amount: Number(t.amount) || 0,
    }))
    return detectBillPayments(expenses, txs).filter((d) => !dismissed.has(d.id))
  }, [expenses, bankTxs, dismissed])

  // Auto-clasificación por aprendizaje: si el vendedor ya tiene 2+
  // confirmaciones hacia una factura, se adjunta solo (etiqueta "auto",
  // se puede quitar). Nunca pide permiso, pero siempre se puede deshacer.
  useEffect(() => {
    if (detected.length === 0) return
    for (const d of detected) {
      if (autoDoneRef.current.has(d.id)) continue
      const rule = learnedRuleFor(ruleKeyFor(d.txs[0]?.detail))
      if (!rule) continue
      const bill = billForLearnedRule(expenses, rule)
      if (!bill || bill.id !== d.billId) continue
      autoDoneRef.current.add(d.id)
      let updated = bill
      for (const tx of d.txs) {
        updated = addBillPayment(updated, {
          amount: Math.abs(Number(tx.amount) || 0),
          accountId: accountIdFor(String(tx.bank_account || "")) || undefined,
          date: String(tx.date).slice(0, 10),
          source: "banco",
          bankTxId: bankTxIdOf(tx),
          auto: true,
        })
      }
      onSave(updated)
      syncBillToProjections(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected])

  // Sugerencias visibles (las auto-clasificadas no se muestran: ya se adjuntaron).
  const visibleDetected = useMemo(
    () => detected.filter((d) => !autoDoneRef.current.has(d.id)),
    [detected],
  )

  function attachDetected(d: DetectedPayment) {
    const bill = expenses.find((e) => e.id === d.billId)
    if (!bill || !isBillOpen(bill)) return
    let updated = bill
    for (const tx of d.txs) {
      updated = addBillPayment(updated, {
        amount: Math.abs(Number(tx.amount) || 0),
        accountId: accountIdFor(String(tx.bank_account || "")) || undefined,
        date: String(tx.date).slice(0, 10),
        source: "banco",
        bankTxId: bankTxIdOf(tx),
      })
    }
    onSave(updated)
    syncBillToProjections(updated)
    // Aprende: este vendedor paga esta factura (con 2+, se auto-clasifica).
    learnConfirm(ruleKeyFor(d.txs[0]?.detail), bill, updated.payments?.[updated.payments.length - 1]?.accountId)
    autoDoneRef.current.add(d.id)
  }

  function dismissDetected(d: DetectedPayment) {
    setDismissed((prev) => new Set(prev).add(d.id))
    autoDoneRef.current.add(d.id)
    learnDismiss(ruleKeyFor(d.txs[0]?.detail))
  }

  function openPayDraft(billId: string) {
    const bill = expenses.find((e) => e.id === billId)
    if (!bill) return
    setPayDraft({
      billId,
      amount: String(billRemaining(bill) > 0 ? billRemaining(bill) : ""),
      accountId: bill.accountId || defaultAccountId || "",
      date: localDateKey(new Date()),
    })
  }

  function savePayDraft() {
    if (!payDraft) return
    const bill = expenses.find((e) => e.id === payDraft.billId)
    if (!bill || !isBillOpen(bill)) {
      setPayDraft(null)
      return
    }
    const monto = Number(payDraft.amount)
    if (!Number.isFinite(monto) || monto <= 0) {
      window.alert("Enter the payment amount.")
      return
    }
    if (monto > billRemaining(bill) + 0.011) {
      if (!window.confirm(`The payment (${money(monto)}) exceeds the remaining (${money(billRemaining(bill))}). Save anyway?`)) return
    }
    const updated = addBillPayment(bill, {
      amount: monto,
      accountId: payDraft.accountId || undefined,
      date: payDraft.date || localDateKey(new Date()),
      source: "manual",
    })
    onSave(updated)
    syncBillToProjections(updated)
    learnConfirm(ruleKeyFor(bill.vendor), bill, payDraft.accountId || undefined)
    setPayDraft(null)
  }

  function deletePayment(billId: string, paymentId: string) {
    const bill = expenses.find((e) => e.id === billId)
    if (!bill) return
    if (!window.confirm("Remove this payment from the bill?")) return
    const updated = removeBillPayment(bill, paymentId)
    onSave(updated)
    syncBillToProjections(updated)
  }

  function addCustomCategory() {
    const name = newCategory.trim()
    if (!name || name === "__new__") return
    if ([...EXPENSE_CATEGORIES, ...customCategories].some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDraft((d) => (d ? { ...d, category: name } : d))
      setNewCategory("")
      return
    }
    const next = [...customCategories, name]
    setCustomCategories(next)
    try {
      localStorage.setItem("claris_custom_categories", JSON.stringify(next))
    } catch {}
    setDraft((d) => (d ? { ...d, category: name } : d))
    setNewCategory("")
  }

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = expenses.filter((e) => {
      const matchesSearch = !term || (e.vendor ?? "").toLowerCase().includes(term)
      const matchesCategory = category === "All" || e.category === category
      return matchesSearch && matchesCategory
    })
    // Lo más nuevo arriba por defecto; toggle para invertir.
    list.sort((a, b) => {
      const cmp = String(b.date || "").localeCompare(String(a.date || ""))
      if (cmp !== 0) return cmp
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    })
    return newestFirst ? list : [...list].reverse()
  }, [expenses, search, category, newestFirst])

  const total = useMemo(() => expenseTotal(expenses), [expenses])
  const filteredTotal = useMemo(() => expenseTotal(filtered), [filtered])

  // Redimensionar imagen para reducir payload y acelerar el OCR de Gemini
  async function resizeImage(file: File, maxDim = 1200): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Couldn't initialize canvas"))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82)
          resolve({ base64: dataUrl, mimeType: "image/jpeg" })
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function readFileAsDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsScanning(true)
      // Un PDF es un STATEMENT de bill: va directo, sin pasar por el canvas
      // de fotos (que solo maneja imágenes y lo rompería).
      const esPdf = file.type === "application/pdf"

      let base64: string
      let mimeType: string
      if (esPdf) {
        if (file.size > 15 * 1024 * 1024) {
          throw new Error("The PDF is larger than 15 MB")
        }
        setScanStatus("Leyendo el statement...")
        base64 = await readFileAsDataUrl(file)
        mimeType = "application/pdf"
      } else {
        setScanStatus("Procesando imagen...")
        const r = await resizeImage(file)
        base64 = r.base64
        mimeType = r.mimeType
      }
      setScanStatus("Analyzing with AI...")

      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType, kind: esPdf ? "bill" : undefined }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Couldn't analyze the receipt")
      }

      const { result } = json
      const scanDate = result.date || localDateKey(new Date())
      if (result.isBill) {
        // Bill: el draft nace como FACTURA con fecha = vencimiento y monto =
        // lo que vence ese día. Lo atrasado y el total quedan en las notas.
        const notas: string[] = []
        if (result.notes) notas.push(String(result.notes))
        if (Number(result.pastDue) > 0) {
          notas.push(`Past due per the statement: $${Number(result.pastDue).toFixed(2)} (was due immediately).`)
        }
        if (Number(result.totalDue) > 0 && Number(result.totalDue) !== Number(result.amount)) {
          notas.push(`Statement total: $${Number(result.totalDue).toFixed(2)}.`)
        }
        const dueDate = result.dueDate || scanDate
        setDraft({
          id: null,
          date: dueDate,
          vendor: result.vendor || "",
          category: result.category || EXPENSE_CATEGORIES[0],
          amount: Number(result.amount) || 0,
          notes: notas.join(" "),
          isAiGenerated: true,
          docType: "factura",
          frequency: "once",
          nextDate: dueDate,
          accountId: defaultAccountId || undefined,
        })
        setScanStatus("Bill detected! Review and save.")
      } else {
        setDraft({
          id: null,
          date: scanDate,
          vendor: result.vendor || "",
          category: result.category || EXPENSE_CATEGORIES[0],
          amount: Number(result.amount) || 0,
          notes: result.notes || "",
          isAiGenerated: true,
          docType: "",
          frequency: "once",
          nextDate: scanDate,
          accountId: defaultAccountId || undefined,
        })
        setScanStatus("Receipt detected! Review and save.")
      }
      setTimeout(() => setScanStatus(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar"
      alert(`Error scanning receipt: ${msg}`)
      setScanStatus(null)
    } finally {
      setIsScanning(false)
      e.target.value = ""
    }
  }

  async function saveDraft() {
    if (!draft) return
    if (!draft.vendor.trim() || !Number.isFinite(draft.amount)) {
      window.alert("Completa el vendedor y el monto.")
      return
    }

    // Antes de guardar: ¿este recibo ya está registrado? Mismo vendedor, misma
    // fecha y mismo monto = el mismo ticket. Se avisa, y el usuario decide si
    // es un gasto legítimo distinto o un escaneo repetido.
    if (draft.docType !== "factura" && draft.docType !== "recibo") {
      window.alert("Elige el tipo: Bill (payable) o Receipt (already paid).")
      return
    }
    const dup = findDuplicateExpense(expenses, draft)
    if (dup) {
      const msg =
        `⚠️ Possible duplicate:\n\n` +
        `${dup.expense.vendor} · ${dup.expense.date} · ${money(dup.expense.amount)} · ${dup.expense.category}\n\n` +
        `An identical expense already exists (vendor + date + amount).\n\n` +
        `"OK" saves it anyway (two identical purchases the same day?)\n` +
        `"Cancel" saves nothing.`
      if (!window.confirm(msg)) return
    }

    const expense: Expense = {
      id: draft.id ?? crypto.randomUUID(),
      date: draft.date,
      vendor: draft.vendor.trim(),
      category: draft.category,
      amount: Number(draft.amount) || 0,
      notes: draft.notes.trim() || undefined,
      isAiGenerated: Boolean(draft.isAiGenerated),
      scanned: Boolean(draft.isAiGenerated) || undefined,
      docType: draft.docType,
      isEditedByUser: draft.id !== null,
      scheduled: draft.docType === "factura" || ["daily", "weekly", "monthly", "annual"].includes(draft.frequency),
      classification: draft.classification,
      // Account/register de donde salió (editable; el match 🏦 se limita a ella).
      accountId: draft.accountId || undefined,
      savedAt: new Date().toISOString(),
    }
    onSave(expense)

    // ¿Este recibo es pago de una factura abierta? Se ofrece una sola vez;
    // si Miguel acepta, el pago se amarra a la factura (y se aprende).
    if (expense.docType === "recibo") {
      const hit = offerReceiptBillMatch(expenses, {
        vendor: expense.vendor,
        amount: expense.amount,
        date: expense.date,
        accountId: expense.accountId,
        id: expense.id,
      })
      if (hit) {
        const withPay = addBillPayment(hit.bill, hit.payment)
        onSave(withPay)
        syncBillToProjections(withPay)
        learnConfirm(ruleKeyFor(expense.vendor), hit.bill, expense.accountId)
      }
    }

    // Auto-push to Dual Register projections with pending due date
    // (fire-and-forget con timeout: no debe frisar el SAVE si el otro servidor no responde).
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      fetch('https://islandcity-register1.vercel.app/api/ingest/bill-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          vendor: expense.vendor,
          amount: expense.amount,
          date: expense.date,
          dueDate: expense.date, // pending due date = receipt date
          category: expense.category,
          notes: expense.notes || '',
          source: 'claris-expenses',
          externalId: expense.id
        })
      }).finally(() => clearTimeout(t))
    } catch (e) {
      console.warn('[claris] Failed to push to Dual Register', e)
    }

    // Programación: si el gasto se repite, queda en el ledger que ve FINANCE
    // para dar seguimiento a cada pago con su vencimiento y frecuencia.
    // La guarda de frecuencia protege contra valores inesperados (la UI solo
    // produce los cinco válidos, pero nunca está over).
    const RECURRING: ScheduleFrequency[] = ["daily", "weekly", "monthly", "annual"]
    if (RECURRING.includes(draft.frequency)) {
      const entry = scheduledEntryFromExpense(expense, draft.frequency, draft.nextDate || expense.date)
      try {
        const existing: ScheduledEntry[] = JSON.parse(localStorage.getItem("claris_scheduled_entries") || "[]")
        if (!Array.isArray(existing)) throw new Error("bad")
        // El recurrente de ESTE gasto se ACTUALIZA, no se duplica: antes
        // cada guardado anteponía una copia nueva con el mismo id
        // (el leasing quedó dos veces y Proyecciones no cuadraba).
        const next = [entry, ...existing.filter((s) => s && s.id !== entry.id)]
        localStorage.setItem("claris_scheduled_entries", JSON.stringify(next))
      } catch {
        try {
          localStorage.setItem("claris_scheduled_entries", JSON.stringify([entry]))
        } catch {}
      }
    }
    setDraft(null)
  }

  function deleteWithConfirm(id: string) {
    if (window.confirm("Delete this expense?")) onDelete(id)
  }

  function editFromRow(ex: Expense) {
    setDraft({
      id: ex.id,
      date: ex.date,
      vendor: ex.vendor,
      category: ex.category,
      amount: ex.amount,
      notes: ex.notes ?? "",
      isAiGenerated: ex.isAiGenerated,
      docType: ex.docType === "factura" || ex.docType === "recibo" ? ex.docType : ex.scheduled ? "factura" : "recibo",
      frequency: "once",
      nextDate: ex.date,
      classification: ex.classification,
      // La cuenta se puede cambiar al editar (todo editable).
      accountId: ex.accountId || defaultAccountId || undefined,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Inputs ocultos para captura directa de cámara o subida de archivo */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Header + totales + formulario + filtros */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-bold tracking-widest text-neutral-400">EXPENSES</h1>
          {!draft && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => (onScanReceipt ? onScanReceipt() : cameraInputRef.current?.click())}
                disabled={isScanning}
                aria-label="Scan receipt with camera"
                className="flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-950/40 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-900/50 active:scale-95 disabled:opacity-50"
              >
                {isScanning ? (
                  <Loader2 className="size-3.5 animate-spin text-sky-400" />
                ) : (
                  <Camera className="size-3.5 text-sky-400" />
                )}
                <span>ESCANEAR</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                aria-label="Upload receipt photo or bill statement PDF"
                className="flex items-center rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-300 hover:bg-neutral-800 active:scale-95 disabled:opacity-50"
                title="Upload photo or statement (PDF)"
              >
                <Upload className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...emptyDraft(), accountId: defaultAccountId || undefined })}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-black active:scale-95"
              >
                <Plus className="size-3.5" /> MANUAL
              </button>
            </div>
          )}
        </div>

        {/* Banner de estado de escaneo */}
        {scanStatus && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-xs font-semibold text-sky-300">
            {isScanning ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Sparkles className="size-3.5 shrink-0 text-yellow-400" />}
            <span>{scanStatus}</span>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <StatCard label="TOTAL EXPENSES" value={money(total)} valueClass="text-rose-400" />
          <StatCard label="FILTRADOS" value={money(filteredTotal)} valueClass="text-amber-400" />
          <StatCard label="CANTIDAD" value={String(expenses.length)} valueClass="text-white" />
        </div>

        {/* Formulario (añadir / editar) */}
        {draft && (
          <section className="mt-3 rounded-2xl border border-neutral-700 bg-neutral-900/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-neutral-300">
                  {draft.id ? "EDIT EXPENSE" : "NEW EXPENSE"}
                </span>
                {draft.isAiGenerated && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    <Sparkles className="size-2.5" /> AI DETECTED
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setDraft(null)} className="text-[11px] font-bold text-rose-400">
                CANCEL
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-400">DATE</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-400">CATEGORY</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                >
                  {[...EXPENSE_CATEGORIES, ...customCategories].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__new__">+ New category…</option>
                </select>
              </label>
            </div>

            {/* Factura o Recibo: decide dónde suma o resta en el libro mayor */}
            <div className="mt-2">
              <span className="text-[10px] font-bold text-neutral-400">
                TYPE <span className="text-amber-400">*</span>
              </span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(
                  [
                    ["factura", "BILL", "payable"],
                    ["recibo", "RECEIPT", "already paid"],
                  ] as const
                ).map(([key, titulo, sub]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft({ ...draft, docType: key })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left",
                      draft.docType === key
                        ? "border-yellow-400 bg-yellow-400/15 text-yellow-300"
                        : "border-neutral-700 bg-neutral-950 text-neutral-300",
                    )}
                  >
                    <span className="block text-xs font-extrabold">{titulo}</span>
                    <span className="block text-[10px] text-neutral-500">{sub}</span>
                  </button>
                ))}
              </div>
              {!draft.docType && sugerirTipoDoc(draft.vendor, draft.notes) === "factura" && (
                <p className="mt-1 text-[10px] text-amber-400">Suggested: Bill (looks like a toll or account payable).</p>
              )}
            </div>

            {/* ¿De qué cuenta salió? Dropdown compacto (mismo que el escáner). */}
            {orderedRegisters.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] font-bold text-neutral-400">
                  WHICH ACCOUNT DID IT COME FROM? <span className="text-amber-400">*</span>
                </span>
                <select
                  value={draft.accountId || ""}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value || undefined })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                >
                  {orderedRegisters.map((r) => {
                    const b = balances[r.id]
                    return (
                      <option key={r.id} value={r.id}>
                        {accountDisplayName(r.name).title}
                        {r.isMain ? " ★" : ""} ·{" "}
                        {typeof b === "number"
                          ? (b < 0 ? "-" : "") +
                            "$" +
                            Math.abs(b).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Category personalizada: si la IA no tiene la correcta, se añade */}
            {draft.category === "__new__" && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name"
                  className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  className="shrink-0 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-bold text-black"
                >
                  Add
                </button>
              </div>
            )}

            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">VENDEDOR</span>
              <input
                value={draft.vendor}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                placeholder="BP Gas Station, E-ZPass…"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
              />
            </label>

            <div className="mt-2">
              <MoneyInput
                label="AMOUNT"
                color="text-rose-400"
                value={draft.amount}
                onChange={(n) => setDraft({ ...draft, amount: n })}
              />
            </div>

            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">NOTAS</span>
              <input
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Opcional"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
              />
            </label>

            {/* Clasificación fiscal: negocio (deducible) o personal */}
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-neutral-400">CLASSIFICATION</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["business", "💼 Negocio"],
                    ["personal", "🏠 Personal"],
                    ["", "Unclassified"],
                  ] as [ExpenseClassification | "", string][]
                ).map(([value, label]) => (
                  <button
                    key={value || "none"}
                    type="button"
                    onClick={() => setDraft({ ...draft, classification: value || undefined })}
                    className={cn(
                      "rounded-xl border py-2 text-[10px] font-bold",
                      (draft.classification ?? "") === value
                        ? value === "business"
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                          : value === "personal"
                            ? "border-neutral-500 bg-neutral-700/40 text-neutral-300"
                            : "border-neutral-500 bg-neutral-700/40 text-neutral-300"
                        : "border-neutral-800 text-neutral-500",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Programación del pago: vencimiento y frecuencia */}
            <div className="mt-2 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-2.5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-yellow-300/90">
                <CalendarClock className="size-3.5" /> DOES THIS PAYMENT REPEAT?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={draft.frequency}
                  onChange={(e) => {
                    const freq = e.target.value as ScheduleFrequency
                    setDraft({
                      ...draft,
                      frequency: freq,
                      // Al elegir frecuencia, la próxima fecha se calcula desde hoy
                      // o desde la fecha del gasto, la posterior.
                      nextDate: freq === "once" ? draft.date : nextOccurrenceDate(draft.date || draft.nextDate, freq),
                    })
                  }}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="once">Once</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
                {draft.frequency === "once" ? (
                  <div className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 text-[11px] text-neutral-400">
                    Due on the expense date ({draft.date})
                  </div>
                ) : (
                  <input
                    type="date"
                    value={draft.nextDate}
                    onChange={(e) => setDraft({ ...draft, nextDate: e.target.value })}
                    aria-label="Next due date"
                    className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                  />
                )}
              </div>
              {draft.frequency !== "once" && (
                <p className="mt-1.5 text-[10px] leading-tight text-neutral-500">
                  It will be saved to the FINANCE scheduled ledger and repeat every{" "}
                  {draft.frequency === "daily" ? "day" : draft.frequency === "weekly" ? "week" : draft.frequency === "monthly" ? "month" : "year"}.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={saveDraft}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3 text-sm font-extrabold text-black active:scale-[0.99]"
            >
              {draft.id ? "SAVE CHANGES" : "SAVE EXPENSE"}
            </button>
          </section>
        )}

        {/* Filtros */}
        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor"
              className="w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="max-w-[45%] rounded-xl border border-neutral-800 bg-neutral-950 px-2 py-2 text-[11px] text-neutral-300 outline-none"
          >
            <option value="All">All</option>
            {[...EXPENSE_CATEGORIES, ...customCategories].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            title={newestFirst ? "Oldest first" : "Newest first"}
            className="shrink-0 rounded-xl border border-neutral-800 bg-neutral-950 px-2 py-2 text-[11px] font-bold text-neutral-300"
          >
            {newestFirst ? "↓ New" : "↑ Old"}
          </button>
        </div>
      </div>

      {/* Pagos detectados en el banco: Miguel aprueba (✓) o descarta (✕).
          Nunca se aplica solo (salvo regla aprendida con 2+ confirmaciones). */}
      {visibleDetected.length > 0 && (
        <div className="mx-4 mt-2 rounded-2xl border border-sky-500/40 bg-sky-950/40 p-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-sky-300">
            🔎 Payments detected ({visibleDetected.length})
          </p>
          <div className="space-y-2">
            {visibleDetected.map((d) => (
              <div key={d.id} className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-2.5">
                <p className="text-[11px] font-bold text-white">
                  {d.isSplit ? "Split payment of " : "Possible payment of "}
                  <span className="text-cyan-300">{d.billVendor}</span>
                  <span className="text-neutral-500"> · {money(d.billRemaining)} left</span>
                </p>
                <div className="mt-1 space-y-0.5">
                  {d.txs.map((tx) => (
                    <p key={bankTxIdOf(tx)} className="text-[10px] text-neutral-400">
                      {money(Math.abs(Number(tx.amount) || 0))} ·{" "}
                      {accountNameById.get(accountIdFor(String(tx.bank_account || ""))) ||
                        String(tx.bank_account || "bank")}{" "}
                      · {String(tx.date).slice(0, 10)}
                    </p>
                  ))}
                </div>
                {d.isSplit && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-300">
                    = {money(d.total)} across {d.txs.length} accounts
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => attachDetected(d)}
                    className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/50 py-1.5 text-[11px] font-extrabold text-emerald-300 active:scale-[0.99]"
                  >
                    ✓ IS PAYMENT
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissDetected(d)}
                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 py-1.5 text-[11px] font-extrabold text-neutral-400 active:scale-[0.99]"
                  >
                    ✕ NOT IT
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario compacto: registrar un pago a una factura */}
      {payDraft && (
        <div className="mx-4 mt-2 rounded-2xl border border-cyan-500/40 bg-neutral-900/80 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-300">Record payment</p>
            <button type="button" onClick={() => setPayDraft(null)} className="text-[11px] font-bold text-rose-400">
              CANCEL
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">AMOUNT</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={payDraft.amount}
                onChange={(e) => setPayDraft({ ...payDraft, amount: e.target.value })}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">DATE</span>
              <input
                type="date"
                value={payDraft.date}
                onChange={(e) => setPayDraft({ ...payDraft, date: e.target.value })}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
              />
            </label>
          </div>
          {orderedRegisters.length > 0 && (
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">WHICH ACCOUNT DID IT COME FROM?</span>
              <select
                value={payDraft.accountId}
                onChange={(e) => setPayDraft({ ...payDraft, accountId: e.target.value })}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Not specified</option>
                {orderedRegisters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {accountDisplayName(r.name).title}
                    {r.isMain ? " ★" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={savePayDraft}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-2.5 text-sm font-extrabold text-black active:scale-[0.99]"
          >
            SAVE PAYMENT
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-neutral-600">
              {expenses.length === 0 ? "No expenses yet." : "No expense matches the filter."}
            </p>
            {expenses.length === 0 && !draft && (
              <button
                type="button"
                onClick={() => setDraft({ ...emptyDraft(), accountId: defaultAccountId || undefined })}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300"
              >
                <Plus className="size-3.5" /> ADD FIRST EXPENSE
              </button>
            )}
          </div>
        ) : (
          filtered.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              onEdit={editFromRow}
              onDelete={deleteWithConfirm}
              bankMatch={bankMatches.get(e.id) ?? null}
              accountName={e.accountId ? accountNameById.get(e.accountId) ?? null : null}
              onAddPayment={openPayDraft}
              onDeletePayment={deletePayment}
              accountNameById={accountNameById}
            />
          ))
        )}
      </div>
    </div>
  )
}