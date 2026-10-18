/**
 * Open bills + partial payments (FIFO).
 *
 * Example: car payment $924. Pay $400 today and $524 later → same bill,
 * remaining goes to zero. If several bills are open, a payment without a
 * target billId clears oldest dueDate first, then the next, and so on.
 */
"use client"

import { migrateCategory } from "./types"

export type BillPayment = {
  id: string
  date: string
  amount: number
  note?: string
}

export type OpenBill = {
  id: string
  description: string
  originalAmount: number
  remainingAmount: number
  dueDate: string
  category?: string
  status: "open" | "partial" | "paid"
  payments: BillPayment[]
  createdAt: string
}

const KEY = "claris_open_bills_v1"

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

function deriveStatus(original: number, remaining: number): OpenBill["status"] {
  if (remaining <= 0.009) return "paid"
  if (remaining < original - 0.009) return "partial"
  return "open"
}

export function loadOpenBills(): OpenBill[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((b: any) => b && typeof b.id === "string" && typeof b.description === "string")
      .map((b: any) => {
        const originalAmount = round2(b.originalAmount)
        const remainingAmount = round2(Math.max(0, b.remainingAmount ?? originalAmount))
        return {
          id: b.id,
          description: String(b.description),
          originalAmount,
          remainingAmount,
          dueDate: String(b.dueDate || "").slice(0, 10),
          category: typeof b.category === "string" ? migrateCategory(b.category) : undefined,
          status: deriveStatus(originalAmount, remainingAmount),
          payments: Array.isArray(b.payments)
            ? b.payments.map((p: any) => ({
                id: String(p.id || uid()),
                date: String(p.date || "").slice(0, 10),
                amount: round2(p.amount),
                note: typeof p.note === "string" ? p.note : undefined,
              }))
            : [],
          createdAt: String(b.createdAt || new Date().toISOString()),
        } satisfies OpenBill
      })
  } catch {
    return []
  }
}

export function saveOpenBills(bills: OpenBill[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bills))
  } catch {}
}

export function createOpenBill(input: {
  description: string
  amount: number
  dueDate: string
  category?: string
}): OpenBill {
  const amount = round2(input.amount)
  const now = new Date().toISOString()
  return {
    id: uid(),
    description: input.description.trim() || "Bill",
    originalAmount: amount,
    remainingAmount: amount,
    dueDate: input.dueDate.slice(0, 10),
    category: input.category,
    status: "open",
    payments: [],
    createdAt: now,
  }
}

/** Oldest due first; paid bills stay at the end for history. */
export function sortBillsFifo(bills: OpenBill[]): OpenBill[] {
  return [...bills].sort((a, b) => {
    const aPaid = a.status === "paid" ? 1 : 0
    const bPaid = b.status === "paid" ? 1 : 0
    if (aPaid !== bPaid) return aPaid - bPaid
    const d = a.dueDate.localeCompare(b.dueDate)
    if (d !== 0) return d
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export type PaymentApplication = {
  billId: string
  description: string
  amount: number
  remainingAfter: number
}

/**
 * Apply a payment. If billId is set, that bill is first; leftover still goes FIFO.
 * Never creates negative remaining. Returns updated list + how the money was split.
 */
export function applyPayment(
  bills: OpenBill[],
  payment: { amount: number; date: string; note?: string; billId?: string },
): { bills: OpenBill[]; applications: PaymentApplication[]; leftover: number } {
  let left = round2(payment.amount)
  if (left <= 0) return { bills, applications: [], leftover: 0 }

  const applications: PaymentApplication[] = []
  const byId = new Map(bills.map((b) => [b.id, { ...b, payments: [...b.payments] }]))

  const order: string[] = []
  if (payment.billId && byId.has(payment.billId)) order.push(payment.billId)
  for (const b of sortBillsFifo(bills)) {
    if (b.status === "paid") continue
    if (!order.includes(b.id)) order.push(b.id)
  }

  for (const id of order) {
    if (left <= 0.009) break
    const bill = byId.get(id)
    if (!bill || bill.remainingAmount <= 0.009) continue

    const applied = round2(Math.min(left, bill.remainingAmount))
    if (applied <= 0) continue

    const pay: BillPayment = {
      id: uid(),
      date: payment.date.slice(0, 10),
      amount: applied,
      note: payment.note,
    }
    bill.payments = [...bill.payments, pay]
    bill.remainingAmount = round2(bill.remainingAmount - applied)
    bill.status = deriveStatus(bill.originalAmount, bill.remainingAmount)
    byId.set(id, bill)
    applications.push({
      billId: id,
      description: bill.description,
      amount: applied,
      remainingAfter: bill.remainingAmount,
    })
    left = round2(left - applied)
  }

  const next = bills.map((b) => byId.get(b.id) ?? b)
  return { bills: next, applications, leftover: left }
}

export function totalOpenRemaining(bills: OpenBill[]): number {
  return round2(bills.filter((b) => b.status !== "paid").reduce((s, b) => s + b.remainingAmount, 0))
}
