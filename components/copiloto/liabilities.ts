// Cuentas LIABILITY por deuda (modelo aprobado por Miguel, 2026-10-25,
// investigado de Quicken Business / QuickBooks):
//
// - Cada deuda recurrente lleva su PROPIA cuenta liability. Al programarla
//   en Proyecciones (un ScheduledEntry de gasto), cada ciclo abre SOLO su
//   Open Bill en esa cuenta: una factura enlazada al recurrente
//   (originScheduleId + fecha del ciclo).
// - La cuenta vive en dos estados: $0 (nada se debe) o el balance del bill
//   abierto (Total − Pagado = Resta). Nunca mezcla dinero del banco.
// - Todo pago — de UNA cuenta o DIVIDIDO entre varias — se aplica contra UN
//   bill específico y lo resta (motor bill-payments.ts). La CATEGORÍA es el
//   puente: un cargo del banco con la categoría de la deuda se propone como
//   pago de su bill; el match exacto por vendedor se aplica solo (auto,
//   deshacible); lo demás queda POR CONFIRMAR de un toque.
// - La cuenta guarda el historial: total pagado en el año y cuántos pagos —
//   el número que alimenta el Financial Statement y la deducción de taxes.
//
// Almacén propio (claris_liabilities_v1): los bills de ciclo NO viven en
// ic_expenses porque la raíz de la app persiste esa lista entera desde su
// estado en memoria y pisaría estos bills. Las facturas de ic_expenses
// (escáner/Gastos) se leen solo para mostrar: si una factura externa es la
// gemela de un ciclo (mismo proveedor, fecha ±3 días, monto cercano), la
// externa manda — es la que trae los pagos reales — y el ciclo se suprime.

import {
  addBillPayment,
  billPaidTotal,
  billPayments,
  billRemaining,
  detectBillPayments,
  isBill,
  isBillOpen,
  removeBillPayment,
  daysBetween,
  bankTxIdOf,
  type BankTxIn,
  type DetectedPayment,
} from "./bill-payments"
import { expandSchedule, SCHEDULE_OVERRIDES_KEY, type ScheduleOverride } from "./dinero-forecast"
import { FINANCE_SCHEDULES_KEY } from "./finance-sync"
import { loadExpenses } from "./storage"
import { normalizeVendorName, type Expense, type ScheduledEntry } from "./types"

export {
  addBillPayment,
  removeBillPayment,
  billPayments,
  billPaidTotal,
  billRemaining,
  isBillOpen,
  detectBillPayments,
}
export type { DetectedPayment }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export const LIABILITIES_KEY = "claris_liabilities_v1"
export const LIABILITY_DISMISSED_KEY = "claris_liability_dismissed_v1"

export function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---------------------------------------------------------------------------
// Almacén propio de bills de ciclo
// ---------------------------------------------------------------------------

export function loadCycleBills(): Expense[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIABILITIES_KEY) || "[]")
    return Array.isArray(raw) ? (raw as Expense[]) : []
  } catch {
    return []
  }
}

export function saveCycleBills(bills: Expense[]): void {
  try {
    localStorage.setItem(LIABILITIES_KEY, JSON.stringify(bills))
  } catch {}
}

/** Facturas del almacén general (escáner/Gastos) — SOLO LECTURA aquí. */
export function loadExternalBills(): Expense[] {
  try {
    return (loadExpenses() || []).filter(isBill)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Carga de recurrentes y excepciones (mismo storage que Proyecciones)
// ---------------------------------------------------------------------------

export function loadSchedules(): ScheduledEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FINANCE_SCHEDULES_KEY) || "[]")
    return Array.isArray(raw) ? (raw as ScheduledEntry[]) : []
  } catch {
    return []
  }
}

export function loadOverrides(): ScheduleOverride[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SCHEDULE_OVERRIDES_KEY) || "[]")
    return Array.isArray(raw) ? (raw as ScheduleOverride[]) : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Auto-apertura de bills por ciclo
// ---------------------------------------------------------------------------

/**
 * Materializa el Open Bill de cada ciclo de cada recurrente de gasto:
 * desde el ancla del recurrente hasta el PRÓXIMO ciclo después de hoy.
 * Idempotente (id determinístico + chequeo por originScheduleId y fecha).
 * Respeta los overrides de Proyecciones (skip = ese ciclo no abre bill;
 * amount = monto de ese ciclo).
 */
export function ensureCycleBills(
  schedules: ScheduledEntry[],
  ownBills: Expense[],
  today: string,
): { bills: Expense[]; created: number } {
  const overrides = loadOverrides()
  // Bills duplicados por id (de estados viejos): uno solo, el que tenga pagos.
  const byBillId = new Map<string, Expense>()
  for (const b of ownBills || []) {
    if (!b || !b.id) continue
    const prev = byBillId.get(b.id)
    if (!prev || (b.payments?.length || 0) > (prev.payments?.length || 0)) byBillId.set(b.id, b)
  }
  const own = [...byBillId.values()]
  const existing = new Set(
    own.filter((e) => e.originScheduleId).map((e) => `${e.originScheduleId}|${String(e.date).slice(0, 10)}`),
  )
  const out = [...own]
  let created = 0
  const from = addDays(today, -370)
  const to = addDays(today, 45)
  const seenSch = new Set<string>()
  for (const s of schedules || []) {
    if (!s || s.kind !== "expense" || s.active === false) continue
    if (seenSch.has(s.id)) continue
    seenSch.add(s.id)
    const amt = r2(Math.abs(Number(s.amount) || 0))
    if (amt < 0.01) continue
    // expandSchedule corta por nextDate; para materializar ciclos pasados se
    // le pasa el ancla como nextDate (los ciclos viejos también son deuda).
    const dates = expandSchedule({ ...s, nextDate: s.startDate }, from, to)
    if (dates.length === 0) continue
    const fut = dates.filter((d) => d > today).sort()
    const keep = new Set([...dates.filter((d) => d <= today), ...(fut.length ? [fut[0]] : [])])
    for (const d of dates) {
      if (!keep.has(d)) continue
      if (existing.has(`${s.id}|${d}`)) continue
      const ov = overrides.find((o) => o.scheduleId === s.id && o.date === d)
      if (ov?.skip) continue
      const effAmt =
        ov && Number.isFinite(Number(ov.amount)) && Number(ov.amount) >= 0 ? r2(Number(ov.amount)) : amt
      if (effAmt < 0.01) continue
      const now = new Date().toISOString()
      out.push({
        id: `bill-${s.id}-${d}`,
        date: d,
        vendor: s.description || s.category || "Bill",
        category: s.category || "Other",
        amount: effAmt,
        docType: "factura",
        scheduled: true,
        originScheduleId: s.id,
        isAiGenerated: false,
        isEditedByUser: false,
        payments: [],
        notes: "Automatic Open Bill from the Projections recurring",
        createdAt: now,
        updatedAt: now,
      })
      existing.add(`${s.id}|${d}`)
      created++
    }
  }
  return { bills: out, created }
}

// ---------------------------------------------------------------------------
// Cuentas liability (una por deuda)
// ---------------------------------------------------------------------------

export interface DebtCycle {
  bill: Expense
  total: number
  paid: number
  remaining: number
  open: boolean
  /** true = viene de ic_expenses (Gastos/escáner): aquí solo se muestra. */
  external: boolean
}

export interface DebtAccount {
  id: string
  name: string
  category: string
  scheduleId?: string
  bills: DebtCycle[]
  /** Lo que se debe ahora: suma de la Resta de los bills abiertos. */
  openRemaining: number
  /** Récord anual para taxes: total pagado este año y cuántos pagos. */
  yearPaid: number
  yearCount: number
  year: string
}

const norm = (s: unknown) => normalizeVendorName(s)

/** ¿La factura externa es la gemela de este bill de ciclo? (mismo proveedor,
 *  fecha a ±3 días y monto cercano) — la externa manda, trae los pagos. */
function isTwin(external: Expense, cycle: Expense): boolean {
  if (Math.abs(daysBetween(String(external.date), String(cycle.date))) > 3) return false
  const a = Math.abs(Number(external.amount) || 0)
  const b = Math.abs(Number(cycle.amount) || 0)
  if (Math.abs(a - b) > Math.max(0.011, b * 0.02)) return false
  const na = norm(external.vendor)
  const nb = norm(cycle.vendor)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

export function buildDebts(
  schedules: ScheduledEntry[],
  ownBills: Expense[],
  externalBills: Expense[],
  today: string,
): DebtAccount[] {
  const year = today.slice(0, 4)
  const debts = new Map<string, DebtAccount>()
  const newDebt = (id: string, name: string, category: string, scheduleId?: string): DebtAccount => ({
    id,
    name,
    category,
    scheduleId,
    bills: [],
    openRemaining: 0,
    yearPaid: 0,
    yearCount: 0,
    year,
  })
  const addBill = (debt: DebtAccount, bill: Expense, external: boolean) => {
    const c: DebtCycle = {
      bill,
      total: r2(Number(bill.amount) || 0),
      paid: billPaidTotal(bill),
      remaining: billRemaining(bill),
      open: isBillOpen(bill),
      external,
    }
    debt.bills.push(c)
    if (c.open) debt.openRemaining = r2(debt.openRemaining + c.remaining)
    for (const p of billPayments(bill)) {
      if (String(p.date).startsWith(year)) {
        debt.yearPaid = r2(debt.yearPaid + (Number(p.amount) || 0))
        debt.yearCount++
      }
    }
  }
  for (const s of schedules || []) {
    if (!s || s.kind !== "expense" || s.active === false) continue
    if (Math.abs(Number(s.amount) || 0) < 0.01) continue
    debts.set(`sched:${s.id}`, newDebt(`sched:${s.id}`, s.description || s.category || "Deuda", s.category || "Other", s.id))
  }
  // Bills de ciclo: si tienen gemela externa, la externa los reemplaza.
  const suppressed = new Set<string>()
  for (const b of ownBills) {
    if (!isBill(b) || !b.originScheduleId) continue
    const twin = externalBills.find((e) => isTwin(e, b))
    if (twin) suppressed.add(b.id)
  }
  for (const b of ownBills) {
    if (!isBill(b) || suppressed.has(b.id)) continue
    const debt = b.originScheduleId ? debts.get(`sched:${b.originScheduleId}`) : undefined
    if (debt) addBill(debt, b, false)
    else {
      const key = `vendor:${norm(b.vendor) || b.id}`
      if (!debts.has(key)) debts.set(key, newDebt(key, b.vendor || "Deuda", b.category || "Other"))
      addBill(debts.get(key)!, b, false)
    }
  }
  // Facturas externas: a su recurrente si están enlazadas; si son gemelas de
  // un ciclo, a la cuenta de ese recurrente; el resto, por proveedor.
  for (const e of externalBills) {
    if (e.originScheduleId && debts.has(`sched:${e.originScheduleId}`)) {
      addBill(debts.get(`sched:${e.originScheduleId}`)!, e, true)
      continue
    }
    const cycleTwin = ownBills.find((b) => b.originScheduleId && isTwin(e, b))
    if (cycleTwin && debts.has(`sched:${cycleTwin.originScheduleId}`)) {
      addBill(debts.get(`sched:${cycleTwin.originScheduleId}`)!, e, true)
      continue
    }
    const key = `vendor:${norm(e.vendor) || e.id}`
    if (!debts.has(key)) debts.set(key, newDebt(key, e.vendor || "Deuda", e.category || "Other"))
    addBill(debts.get(key)!, e, true)
  }
  const list = [...debts.values()]
  for (const d of list) d.bills.sort((a, b) => String(b.bill.date).localeCompare(String(a.bill.date)))
  list.sort((a, b) => b.openRemaining - a.openRemaining || a.name.localeCompare(b.name))
  return list
}

// ---------------------------------------------------------------------------
// Detección de pagos: vendedor (motor) + puente por CATEGORÍA
// ---------------------------------------------------------------------------

export interface CategoryProposal {
  id: string
  billId: string
  billVendor: string
  billRemaining: number
  tx: BankTxIn
}

const GENERIC_CATS = new Set(["", "other", "banco", "transferencia", "transfer", "uncategorized"])

/**
 * Puente de Miguel: un cargo del banco cuya CATEGORÍA es la categoría de la
 * deuda se propone como pago de su bill abierto (aunque el texto del cargo
 * no nombre al proveedor). Si el cargo encaja en 2+ bills, no se propone.
 * Los cargos ya aplicados a cualquier bill no se reprocesan.
 */
export function categoryProposals(bills: Expense[], bankTxs: (BankTxIn & { category?: string | null })[]): CategoryProposal[] {
  const open = (bills || []).filter(isBillOpen)
  if (open.length === 0) return []
  const used = new Set<string>()
  for (const b of open) for (const p of billPayments(b)) if (p.bankTxId) used.add(p.bankTxId)
  const out: CategoryProposal[] = []
  for (const tx of bankTxs) {
    const amt = Number(tx.amount)
    if (!Number.isFinite(amt) || amt >= -0.009) continue
    const cat = norm(tx.category)
    if (GENERIC_CATS.has(cat)) continue
    const tid = bankTxIdOf(tx)
    if (used.has(tid)) continue
    const cands = open.filter(
      (b) =>
        norm(b.category) === cat &&
        Math.abs(amt) <= billRemaining(b) + 0.011 &&
        daysBetween(tx.date, b.date) <= 21,
    )
    if (cands.length !== 1) continue
    const b = cands[0]
    out.push({
      id: `cat:${b.id}:${tid}`,
      billId: b.id,
      billVendor: b.vendor,
      billRemaining: billRemaining(b),
      tx: { date: tx.date, bank_account: tx.bank_account, detail: tx.detail, amount: tx.amount },
    })
  }
  return out
}

/** ¿La detección suma EXACTO lo que resta del bill? (regla de auto-aplicar). */
export function isExactDetection(bills: Expense[], d: DetectedPayment): boolean {
  const bill = bills.find((e) => e.id === d.billId)
  if (!bill) return false
  return Math.abs(d.total - billRemaining(bill)) <= 0.011
}

/** Aplica los cargos de una detección como pagos del bill (fuente banco). */
export function applyDetection(
  bill: Expense,
  d: DetectedPayment,
  accountIdFor?: (bankAccount: string) => string,
  auto = false,
): Expense {
  let updated = bill
  for (const tx of d.txs) {
    updated = addBillPayment(updated, {
      // Pago grupal: el cargo cubre varios bills — a este le toca su parte.
      amount: d.isGroup && d.share ? Math.abs(d.share) : Math.abs(Number(tx.amount) || 0),
      accountId: accountIdFor?.(String(tx.bank_account || "")) || undefined,
      date: String(tx.date).slice(0, 10),
      source: "banco",
      bankTxId: bankTxIdOf(tx),
      ...(auto ? { auto: true } : {}),
    })
  }
  return updated
}

// ---------------------------------------------------------------------------
// Historial anual (1 ene – 31 dic): lo que alimenta el Financial Statement
// ---------------------------------------------------------------------------

export interface YearPaymentRow {
  date: string
  debtName: string
  billDate: string
  amount: number
  /** banco | recibo | manual */
  source: string
  /** Cuenta desde donde salió (del id estable del cargo), si aplica. */
  account: string
  auto?: boolean
  note?: string
}

export interface DebtYearHistory {
  debtId: string
  name: string
  category: string
  /** Suma de los bills cuya fecha cae en el año. */
  billedYear: number
  /** Suma de los pagos con fecha en el año. */
  paidYear: number
  /** Cuántos pagos se hicieron en el año. */
  countYear: number
  /** Lo que resta de los bills del año. */
  remainingYear: number
}

export interface YearHistory {
  year: string
  perDebt: DebtYearHistory[]
  payments: YearPaymentRow[]
  totalBilled: number
  totalPaid: number
  totalCount: number
}

function accountOf(bankTxId?: string): string {
  if (!bankTxId) return ""
  const seg = String(bankTxId).split("|")
  return seg.length >= 2 ? seg[1] : ""
}

/**
 * El año completo por deuda: cada bill abierto en el año y cada pago
 * aplicado — no importa de qué cuenta salió el pago — con sus totales.
 * El bill cuadra: pagado completo = resta $0; si no, queda su balance.
 */
export function buildYearHistory(debts: DebtAccount[], year: string): YearHistory {
  const perDebt: DebtYearHistory[] = []
  const payments: YearPaymentRow[] = []
  let totalBilled = 0
  let totalPaid = 0
  let totalCount = 0
  for (const d of debts || []) {
    const h: DebtYearHistory = {
      debtId: d.id,
      name: d.name,
      category: d.category,
      billedYear: 0,
      paidYear: 0,
      countYear: 0,
      remainingYear: 0,
    }
    for (const c of d.bills) {
      if (String(c.bill.date).startsWith(year)) {
        h.billedYear = r2(h.billedYear + c.total)
        h.remainingYear = r2(h.remainingYear + c.remaining)
      }
      for (const p of billPayments(c.bill)) {
        if (!String(p.date).startsWith(year)) continue
        h.paidYear = r2(h.paidYear + (Number(p.amount) || 0))
        h.countYear++
        payments.push({
          date: String(p.date).slice(0, 10),
          debtName: d.name,
          billDate: String(c.bill.date).slice(0, 10),
          amount: r2(Number(p.amount) || 0),
          source: p.source,
          account: accountOf(p.bankTxId),
          auto: p.auto,
          note: p.note,
        })
      }
    }
    if (h.billedYear > 0 || h.countYear > 0) {
      perDebt.push(h)
      totalBilled = r2(totalBilled + h.billedYear)
      totalPaid = r2(totalPaid + h.paidYear)
      totalCount += h.countYear
    }
  }
  payments.sort((a, b) => b.date.localeCompare(a.date))
  perDebt.sort((a, b) => b.paidYear - a.paidYear || b.billedYear - a.billedYear)
  return { year, perDebt, payments, totalBilled, totalPaid, totalCount }
}

/** IDs estables de los cargos del banco ya aplicados a algún bill. */
export function appliedBankTxIds(bills: Expense[]): Set<string> {
  const out = new Set<string>()
  for (const b of bills || []) for (const p of billPayments(b)) if (p.bankTxId) out.add(p.bankTxId)
  return out
}

export interface CategoryYearSum {
  category: string
  total: number
  count: number
}

const TRANSFER_CATS = new Set(["transferencia", "transfer", "transfers"])

/**
 * Gastos del año que NO son bill (ej. gasolina): salidas reales del banco
 * sumadas por categoría, 1 ene – 31 dic. Fuera: transferencias internas y
 * los cargos ya aplicados a un bill (esos viven en el historial de bills;
 * contarlos aquí duplicaría el gasto en el Financial Statement).
 */
export function categoryYearSums(
  bankTxs: (BankTxIn & { category?: string | null })[],
  year: string,
  applied: Set<string>,
): CategoryYearSum[] {
  const map = new Map<string, CategoryYearSum>()
  for (const tx of bankTxs || []) {
    if (!String(tx.date).startsWith(year)) continue
    const amt = Number(tx.amount)
    if (!Number.isFinite(amt) || amt >= -0.009) continue
    if (applied.has(bankTxIdOf(tx))) continue
    const raw = String(tx.category || "").trim()
    const n = norm(raw)
    if (TRANSFER_CATS.has(n)) continue
    const label = !raw || n === "banco" ? "Sin categoría" : raw
    const row = map.get(label) || { category: label, total: 0, count: 0 }
    row.total = r2(row.total + Math.abs(amt))
    row.count++
    map.set(label, row)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Aplica un cargo suelto (puente por categoría) como pago del bill. */
export function applyCategoryProposal(
  bill: Expense,
  p: CategoryProposal,
  accountIdFor?: (bankAccount: string) => string,
): Expense {
  return addBillPayment(bill, {
    amount: Math.abs(Number(p.tx.amount) || 0),
    accountId: accountIdFor?.(String(p.tx.bank_account || "")) || undefined,
    date: String(p.tx.date).slice(0, 10),
    source: "banco",
    bankTxId: bankTxIdOf(p.tx),
    note: "Por categoría",
  })
}
