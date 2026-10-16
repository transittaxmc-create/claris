"use client"

import { useEffect, useState } from "react"
import { CashFlowRegister } from "./cash-flow-register"
import type { Expense as CopilotoExpense, Trip } from "./types"

export function createTollBill(trips: { toll: number }[], serviceDate: string) {
  const amount = trips.reduce((sum, trip) => sum + (Number(trip.toll) || 0), 0)
  return {
    id: `bill-${Date.now()}`,
    serviceDate,
    dueDate: serviceDate,
    amount,
    status: "unpaid" as const,
  }
}

/** DINERO — Ledger first. Tap an account card to open its register. */
export function FinanceScreen(_props: {
  trips: Trip[]
  expenses: CopilotoExpense[]
  onSave: (e: CopilotoExpense) => void
  onDelete: (id: string) => void
}) {
  const [build, setBuild] = useState<string>("")
  useEffect(() => {
    let alive = true
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.short === "string") setBuild(d.short)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-4 pb-2 pt-2">
        <h1 className="text-2xl font-black tracking-tight text-white">Dinero</h1>
        <p className="text-[11px] text-neutral-400">Libro mayor · toca una cuenta para ver su registro</p>
        {build ? <p className="text-[9px] leading-tight text-neutral-600">build {build}</p> : null}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <CashFlowRegister startingActualBalance={0} />
      </div>
    </div>
  )
}
