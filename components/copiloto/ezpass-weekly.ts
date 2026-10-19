/**
 * E-ZPass weekly bill (Miguel's rule, 2026-10-19):
 *
 * - Every day, the GPS-detected tolls are totaled.
 * - They accumulate into ONE open bill due Friday (not one transaction per day).
 * - Monday $30 → Friday bill $30. Tuesday $30 more → Friday bill $60.
 * - Partial payments before Friday deduct from the bill (FIFO via open-bills-store).
 * - Goal: by Friday, the whole week's tolls are paid.
 * - The Friday bill also appears in Projections as a one-time "Tolls" expense
 *   (schedule id `ezpass-weekly-{fridayISO}`, amount = remaining to pay).
 *
 * Idempotent: per-day amounts already accumulated are tracked, so re-running
 * (or editing a trip later) only applies the delta. Never double-adds.
 */
"use client"

import { tripDateOf } from "./types"
import type { Trip, ScheduledEntry } from "./types"
import {
  loadOpenBills,
  saveOpenBills,
  createOpenBill,
  type OpenBill,
} from "./open-bills-store"
import { FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./finance-sync"

const TRACK_KEY = "claris_ezpass_weekly_v1"
const BILL_PREFIX = "E-ZPass"
const SCHEDULE_PREFIX = "ezpass-weekly-"

type Track = Record<string, Record<string, number>> // fridayISO -> { dayISO: amount }

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

function loadTrack(): Track {
  try {
    const raw = localStorage.getItem(TRACK_KEY)
    const p = JSON.parse(raw || "{}")
    return p && typeof p === "object" ? p : {}
  } catch {
    return {}
  }
}

function saveTrack(t: Track): void {
  try {
    localStorage.setItem(TRACK_KEY, JSON.stringify(t))
  } catch {}
}

/** Upcoming Friday for a given day (Mon–Fri → that Friday; Sat/Sun → next Friday). */
export function fridayOfWeek(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || "")
  if (!m) return isoDate
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  const dow = d.getDay() // 0=Sun … 5=Fri 6=Sat
  let add = (5 - dow + 7) % 7
  if (dow === 6 || dow === 0) add = (5 - dow + 7) % 7 // Sat/Sun → next Friday
  d.setDate(d.getDate() + add)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function readSchedules(): ScheduledEntry[] {
  try {
    const raw = localStorage.getItem(FINANCE_SCHEDULES_KEY)
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeSchedules(list: ScheduledEntry[]): void {
  try {
    localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

/** Find this Friday's E-ZPass bill, or create it. */
function fridayBill(bills: OpenBill[], fridayISO: string): OpenBill {
  let bill = bills.find((b) => b.id === `${SCHEDULE_PREFIX}${fridayISO}`)
  if (!bill) {
    bill = {
      ...createOpenBill({
        description: `${BILL_PREFIX} — week of ${fridayISO}`,
        amount: 0,
        dueDate: fridayISO,
        category: "Tolls",
      }),
      id: `${SCHEDULE_PREFIX}${fridayISO}`,
    }
    bills.push(bill)
  }
  return bill
}

function deriveStatus(original: number, remaining: number): OpenBill["status"] {
  if (remaining <= 0.009) return "paid"
  if (remaining < original - 0.009) return "partial"
  return "open"
}

/**
 * Sync GPS tolls into Friday bills. Returns the current (this week's) Friday
 * bill totals for display. Safe to call on every trips change.
 */
export function syncEzpassWeekly(trips: Trip[]): { friday: string; total: number; remaining: number } | null {
  // 1. Tolls per day (only days with tolls > 0)
  const perDay = new Map<string, number>()
  for (const t of trips) {
    const toll = Number(t.toll) || 0
    if (toll <= 0) continue
    const day = tripDateOf(t)
    perDay.set(day, round2((perDay.get(day) || 0) + toll))
  }
  if (perDay.size === 0) return null

  const track = loadTrack()
  const bills = loadOpenBills()
  let changed = false
  const todayFriday = fridayOfWeek(new Date().toISOString().slice(0, 10))

  for (const [day, total] of perDay) {
    const friday = fridayOfWeek(day)
    const already = track[friday]?.[day] || 0
    const delta = round2(total - already)
    if (Math.abs(delta) < 0.005) continue

    const bill = fridayBill(bills, friday)
    bill.originalAmount = round2(bill.originalAmount + delta)
    bill.remainingAmount = round2(Math.max(0, bill.remainingAmount + delta))
    bill.status = deriveStatus(bill.originalAmount, bill.remainingAmount)

    if (!track[friday]) track[friday] = {}
    track[friday][day] = total
    changed = true
  }

  if (changed) {
    saveOpenBills(bills)
    saveTrack(track)
  }

  // 2. Mirror the current Friday bill into Projections (one-time expense)
  const current = bills.find((b) => b.id === `${SCHEDULE_PREFIX}${todayFriday}`)
  const schedules = readSchedules()
  const schedId = `${SCHEDULE_PREFIX}${todayFriday}`
  const existing = schedules.find((s) => s.id === schedId)
  const amount = current ? round2(current.remainingAmount) : 0

  if (current && amount > 0.009) {
    const entry: ScheduledEntry = {
      id: schedId,
      kind: "expense",
      description: `${BILL_PREFIX} — due Friday`,
      category: "Tolls",
      amount,
      startDate: todayFriday,
      nextDate: todayFriday,
      frequency: "once",
      active: true,
    }
    if (existing) {
      Object.assign(existing, entry)
    } else {
      schedules.push(entry)
    }
    writeSchedules(schedules)
  } else if (existing) {
    // Bill fully paid (or no tolls): remove from projections
    writeSchedules(schedules.filter((s) => s.id !== schedId))
  }

  if (!current) return null
  return { friday: todayFriday, total: round2(current.originalAmount), remaining: round2(current.remainingAmount) }
}

/** This week's Friday bill for display (no sync). */
export function currentEzpassBill(): { friday: string; total: number; remaining: number; status: string } | null {
  const friday = fridayOfWeek(new Date().toISOString().slice(0, 10))
  const bill = loadOpenBills().find((b) => b.id === `${SCHEDULE_PREFIX}${friday}`)
  if (!bill) return null
  return {
    friday,
    total: round2(bill.originalAmount),
    remaining: round2(bill.remainingAmount),
    status: bill.status,
  }
}
