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

/** DINERO (diseño MONEY) — cuentas con su marca, registro por cuenta y proyecciones. */
export function FinanceScreen(props: {
  trips: Trip[]
  expenses: CopilotoExpense[]
  onSave: (e: CopilotoExpense) => void
  onDelete?: (id: string) => void
  /** Escanear factura/recibo desde un register: sube hasta el escáner AI. */
  onOpenScanner?: (docTipo?: string) => void
}) {
  const [build, setBuild] = useState<string>("")
  useEffect(() => {
    let alive = true
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.short === "string") {
          let t = ""
          if (typeof d.checkedAt === "string") {
            const dt = new Date(d.checkedAt)
            if (!isNaN(dt.getTime())) {
              t = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
            }
          }
          setBuild(`v7 · ${d.short}${t ? ` · ${t}` : ""}`)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return (
    <div
      className="flex h-full flex-col bg-[#0a0a0f]"
      style={{
        backgroundImage:
          "radial-gradient(1200px 600px at 50% -10%, rgba(91,140,255,.10), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,92,255,.08), transparent 55%)",
      }}
    >
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <CashFlowRegister startingActualBalance={0} onOpenScanner={props.onOpenScanner} />
        {build ? <p className="mt-3 text-center font-mono text-[9px] leading-tight text-[#66687c]">{build}</p> : null}
      </div>
    </div>
  )
}
