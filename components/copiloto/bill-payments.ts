// Sistema de pago de facturas por partes.
//
// Una factura (Expense con docType "factura") puede pagarse en varios pagos,
// desde distintas cuentas. Cada pago cae en el register de su cuenta; la
// factura lleva la cuenta Total | Pagado | Resta y se cancela sola al
// completarse. Los pagos detectados del banco se PROPONEN (nunca se aplican
// solos, salvo regla aprendida) y Miguel los aprueba con ✓ o los descarta
// con ✕. Todo editable siempre.

import {
  normalizeVendorName,
  newBillPayment,
  money,
  type BillPayment,
  type BillPaymentSource,
  type Expense,
} from "./types"

export type { BillPayment, BillPaymentSource }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

/** ¿Es factura (por pagar)? */
export function isBill(e: Expense): boolean {
  return e.docType === "factura"
}

export function billPayments(e: Expense): BillPayment[] {
  return Array.isArray(e.payments) ? e.payments : []
}

/** Total pagado a la factura. */
export function billPaidTotal(e: Expense): number {
  return r2(billPayments(e).reduce((s, p) => s + (Number(p.amount) || 0), 0))
}

/** Lo que resta payable. */
export function billRemaining(e: Expense): number {
  return r2((Number(e.amount) || 0) - billPaidTotal(e))
}

export type BillStatus = "abierta" | "pagada"

/** La factura se cancela sola cuando lo pagado cubre el total. */
export function billStatus(e: Expense): BillStatus {
  if (!isBill(e)) return "abierta"
  return billRemaining(e) <= 0.009 ? "pagada" : "abierta"
}

export function isBillOpen(e: Expense): boolean {
  return isBill(e) && billStatus(e) === "abierta"
}

export function addBillPayment(
  e: Expense,
  p: Omit<BillPayment, "id" | "createdAt">,
): Expense {
  const payment = newBillPayment(p)
  return { ...e, payments: [...billPayments(e), payment], updatedAt: new Date().toISOString() }
}

export function removeBillPayment(e: Expense, paymentId: string): Expense {
  return {
    ...e,
    payments: billPayments(e).filter((p) => p.id !== paymentId),
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Coincidencia de vendedor (difusa)
// ---------------------------------------------------------------------------

/** "CB LIVERY" ≈ "cb livery" ≈ "CB LIVERY 12345". */
export function vendorFuzzyMatch(a: unknown, b: unknown): boolean {
  const na = normalizeVendorName(a)
  const nb = normalizeVendorName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const ta = na.split(" ").filter((t) => t.length > 2)
  const tb = nb.split(" ").filter((t) => t.length > 2)
  if (ta.length === 0 || tb.length === 0) return na.includes(nb) || nb.includes(na)
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  return short.every((t) => long.some((u) => u.includes(t) || t.includes(u)))
}

export function daysBetween(a: string, b: string): number {
  const t = (s: string) => new Date(`${String(s).slice(0, 10)}T12:00:00`).getTime()
  const ms = t(a) - t(b)
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 86400000)) : 999
}

// ---------------------------------------------------------------------------
// Detección bancaria
// ---------------------------------------------------------------------------

export type BankTxIn = {
  date: string
  bank_account: string
  detail: string
  amount: number
}

/** Id estable para un cargo bancario (para no sugerirlo dos veces). */
export function bankTxIdOf(tx: BankTxIn): string {
  return [String(tx.date).slice(0, 10), String(tx.bank_account || ""), String(tx.detail || ""), String(tx.amount)].join("|")
}

const DETECT_AMOUNT_TOL = 0.011
const DETECT_DAY_WINDOW = 7

export type DetectedPayment = {
  /** Id estable del grupo (para descartes). */
  id: string
  billId: string
  billVendor: string
  billRemaining: number
  txs: BankTxIn[]
  total: number
  /** true = los cargos suman el total de la factura (pago dividido). */
  isSplit: boolean
}

function txMatchesBill(bill: Expense, tx: BankTxIn, remaining: number): boolean {
  const amt = Number(tx.amount)
  if (!Number.isFinite(amt) || amt >= -0.009) return false // solo salidas
  if (Math.abs(amt) > remaining + DETECT_AMOUNT_TOL) return false
  if (!vendorFuzzyMatch(bill.vendor, tx.detail)) return false
  if (daysBetween(tx.date, bill.date) > DETECT_DAY_WINDOW) return false
  return true
}

/**
 * Detecta pagos de facturas entre los cargos bancarios.
 * - Agrupa por factura; si varios cargos de distintas cuentas suman el resto
 *   (±$0.01), se propone como UN pago dividido.
 * - Un cargo que encaje en varias facturas abiertas se omite (ambiguo).
 * - Nunca toca nada: devuelve sugerencias para que Miguel apruebe.
 */
export function detectBillPayments(expenses: Expense[], bankTxs: BankTxIn[]): DetectedPayment[] {
  const bills = expenses.filter(isBillOpen)
  if (bills.length === 0 || bankTxs.length === 0) return []
  const used = new Set<string>()
  for (const b of bills) for (const p of billPayments(b)) if (p.bankTxId) used.add(p.bankTxId)

  const remainingByBill = new Map(bills.map((b) => [b.id, billRemaining(b)]))

  // cargo -> facturas candidatas
  const matches = new Map<string, { tx: BankTxIn; billId: string }[]>()
  for (const tx of bankTxs) {
    const tid = bankTxIdOf(tx)
    if (used.has(tid)) continue
    const cands: { tx: BankTxIn; billId: string }[] = []
    for (const b of bills) {
      if (txMatchesBill(b, tx, remainingByBill.get(b.id) ?? 0)) cands.push({ tx, billId: b.id })
    }
    // Ambiguo (encaja en 2+ facturas): no se sugiere, Miguel lo anota a mano.
    if (cands.length === 1) matches.set(tid, cands)
  }
  if (matches.size === 0) return []

  // Agrupar por factura
  const byBill = new Map<string, BankTxIn[]>()
  for (const [, cands] of matches) {
    const { tx, billId } = cands[0]
    if (!byBill.has(billId)) byBill.set(billId, [])
    byBill.get(billId)!.push(tx)
  }

  const out: DetectedPayment[] = []
  for (const [billId, txs] of byBill) {
    const bill = bills.find((b) => b.id === billId)
    if (!bill) continue
    const remaining = remainingByBill.get(billId) ?? 0
    const total = r2(txs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0))
    const isSplit = txs.length > 1 && Math.abs(total - remaining) <= 0.011
    if (isSplit) {
      // Un pago dividido: se propone junto.
      out.push({
        id: `split:${billId}:${txs.map(bankTxIdOf).sort().join(";")}`,
        billId,
        billVendor: bill.vendor,
        billRemaining: remaining,
        txs: [...txs].sort((a, b) => String(a.date).localeCompare(String(b.date))),
        total,
        isSplit: true,
      })
    } else {
      for (const tx of txs) {
        out.push({
          id: `single:${billId}:${bankTxIdOf(tx)}`,
          billId,
          billVendor: bill.vendor,
          billRemaining: remaining,
          txs: [tx],
          total: r2(Math.abs(Number(tx.amount) || 0)),
          isSplit: false,
        })
      }
    }
  }
  return out.sort((a, b) => String(a.txs[0]?.date || "").localeCompare(String(b.txs[0]?.date || "")))
}

// ---------------------------------------------------------------------------
// Recibo escaneado -> ¿es pago de una factura abierta?
// ---------------------------------------------------------------------------

/**
 * Si UN solo recibo encaja en UNA sola factura abierta (vendedor + monto ≤
 * resto), se devuelve para ofrecer "¿Es pago de esta factura?".
 */
export function findBillForReceipt(
  expenses: Expense[],
  receipt: { vendor: string; amount: number },
): Expense | null {
  const need = Math.abs(Number(receipt.amount) || 0)
  if (need <= 0) return null
  const cands = expenses.filter(
    (b) =>
      isBillOpen(b) &&
      vendorFuzzyMatch(b.vendor, receipt.vendor) &&
      need <= billRemaining(b) + DETECT_AMOUNT_TOL,
  )
  return cands.length === 1 ? cands[0] : null
}

/** Pregunta a Miguel si el recibo es pago de la factura; devuelve el pago o null. */
export function offerReceiptBillMatch(
  expenses: Expense[],
  receipt: { vendor: string; amount: number; date: string; accountId?: string; id: string },
): { bill: Expense; payment: Omit<BillPayment, "id" | "createdAt"> } | null {
  const bill = findBillForReceipt(expenses, receipt)
  if (!bill) return null
  const ok = window.confirm(
    `This receipt from ${receipt.vendor} (${money(Math.abs(receipt.amount))}) es pago de la factura "${bill.vendor}"?\n\nRestan ${money(billRemaining(bill))}.`,
  )
  if (!ok) return null
  return {
    bill,
    payment: {
      amount: Math.abs(Number(receipt.amount) || 0),
      accountId: receipt.accountId,
      date: String(receipt.date).slice(0, 10),
      source: "recibo",
      receiptId: receipt.id,
    },
  }
}

// ---------------------------------------------------------------------------
// Aprendizaje: el asistente aprende de las decisiones de Miguel
// ---------------------------------------------------------------------------

const RULES_KEY = "claris_learned_rules"

export type LearnedRule = {
  /** Vendedor de la factura tal como Miguel la tiene (para re-encontrarla). */
  billVendor: string
  accountId?: string
  /** Veces que Miguel confirmó este mapeo. Con 2+, el 3er caso se auto-clasifica. */
  confirmations: number
}

export function loadLearnedRules(): Record<string, LearnedRule> {
  try {
    const raw = JSON.parse(localStorage.getItem(RULES_KEY) || "{}")
    if (raw && typeof raw === "object") return raw as Record<string, LearnedRule>
  } catch {}
  return {}
}

export function saveLearnedRules(rules: Record<string, LearnedRule>): void {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules))
  } catch {}
}

/** Clave de la regla: vendedor normalizado del cargo/recibo. */
export function ruleKeyFor(vendor: unknown): string {
  return normalizeVendorName(vendor)
}

/** Miguel confirmó: este vendedor paga esta factura. Suma una confirmación. */
export function learnConfirm(vendor: unknown, bill: Expense, accountId?: string): void {
  const key = ruleKeyFor(vendor)
  if (!key) return
  const rules = loadLearnedRules()
  const cur = rules[key]
  rules[key] = {
    billVendor: bill.vendor,
    accountId: accountId || cur?.accountId,
    confirmations: (cur?.confirmations || 0) + 1,
  }
  saveLearnedRules(rules)
}

/** Miguel descartó la sugerencia: la regla se reinicia (no se vuelve a proponer igual). */
export function learnDismiss(vendor: unknown): void {
  const key = ruleKeyFor(vendor)
  if (!key) return
  const rules = loadLearnedRules()
  if (rules[key]) {
    rules[key] = { ...rules[key], confirmations: 0 }
    saveLearnedRules(rules)
  }
}

/**
 * ¿Este vendedor ya tiene 2+ confirmaciones hacia una factura?
 * Si sí, el caso repetitivo se puede clasificar solo (con etiqueta "auto").
 */
export function learnedRuleFor(vendor: unknown): LearnedRule | null {
  const key = ruleKeyFor(vendor)
  if (!key) return null
  const r = loadLearnedRules()[key]
  return r && r.confirmations >= 2 ? r : null
}

/** Busca la factura abierta a la que apunta una regla aprendida. */
export function billForLearnedRule(expenses: Expense[], rule: LearnedRule): Expense | null {
  const cands = expenses.filter((b) => isBillOpen(b) && vendorFuzzyMatch(b.vendor, rule.billVendor))
  return cands.length === 1 ? cands[0] : null
}

// ---------------------------------------------------------------------------
// Proyecciones: la factura proyectada muestra el RESTO, no el total
// ---------------------------------------------------------------------------

const PROJECTION_MATCH_DAYS = 31

/**
 * Escribe en el ledger de proyecciones (claris_cash_flow_entries): la entrada
 * proyectada de la factura pasa a mostrar lo que RESTA; si está pagada, sale
 * de las proyecciones. Se enlaza por vendedor (difuso) y fecha cercana.
 */
export function syncBillToProjections(bill: Expense): void {
  let entries: any[]
  try {
    const raw = JSON.parse(localStorage.getItem("claris_cash_flow_entries") || "[]")
    if (!Array.isArray(raw)) return
    entries = raw
  } catch {
    return
  }
  const remaining = billRemaining(bill)
  let changed = false
  const next: any[] = []
  for (const e of entries) {
    if (
      e &&
      e.type === "expense" &&
      e.status === "projected" &&
      vendorFuzzyMatch(e.description, bill.vendor) &&
      daysBetween(String(e.date || ""), bill.date) <= PROJECTION_MATCH_DAYS
    ) {
      changed = true
      if (remaining <= 0.009) continue // pagada: sale de proyecciones
      const sign = Number(e.amount) < 0 ? -1 : 1
      next.push({ ...e, amount: sign * remaining })
      continue
    }
    next.push(e)
  }
  if (changed) {
    try {
      localStorage.setItem("claris_cash_flow_entries", JSON.stringify(next))
    } catch {}
  }
}
