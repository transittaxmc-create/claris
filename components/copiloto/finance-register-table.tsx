"use client"

import { useEffect, useMemo, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-store"

type Payment = { description: string; amount: number }

type LedgerRow = {
  id: string
  date: string
  description: string
  source: "Banco" | "Proyectada" | "Sistema"
  income: number
  expense: number
  balance: number
  editor?: ReactNode
  low?: boolean
}

const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-US", { weekday: "short", day: "numeric", month: "short" })

export function FinanceRegisterTable({
  mode = "bank",
  paymentsByDate = {},
  belowZeroDates = new Set<string>(),
}: {
  mode?: "bank" | "projected"
  paymentsByDate?: Record<string, Payment[]>
  belowZeroDates?: Set<string>
}) {
  const { days, startingBalance, updatePlatformAmount, initializeWeek } = useFinance()

  useEffect(() => {
    if (days.length === 0) initializeWeek()
  }, [days.length, initializeWeek])

  const rows = useMemo(() => {
    let balance = startingBalance
    const result: LedgerRow[] = [
      { id: "opening", date: days[0]?.date ?? "", description: "Balance inicial del banco", source: "Banco", income: 0, expense: 0, balance },
    ]

    for (const day of days) {
      const actual = day.platforms.filter((platform) => platform.actualAmount !== null)
      const projected = day.platforms.filter((platform) => Number(platform.projectedAmount) > 0)
      const entries = mode === "bank"
        ? actual.map((platform) => ({ platform, isProjected: false }))
        : [
            ...actual.map((platform) => ({ platform, isProjected: false })),
            ...projected.map((platform) => ({ platform, isProjected: true })),
          ]

      for (const { platform, isProjected } of entries) {
        const amount = Number(isProjected ? platform.projectedAmount : platform.actualAmount) || 0
        balance += amount
        result.push({
          id: `${day.id}-${platform.platformName}-${isProjected ? "projected" : "actual"}`,
          date: day.date,
          description: platform.platformName,
          source: isProjected ? "Proyectada" : "Banco",
          income: amount,
          expense: 0,
          balance,
          editor: (
            <label className="inline-flex items-center gap-1">
              <span className="text-neutral-500">$</span>
              <input
                aria-label={`${isProjected ? "Proyección" : "Banco"} ${platform.platformName} ${dayLabel(day.date)}`}
                type="number"
                inputMode="decimal"
                value={amount}
                placeholder="0"
                onChange={(event) => {
                  const value = event.target.value
                  updatePlatformAmount(
                    day.id,
                    platform.platformName,
                    isProjected ? "projectedAmount" : "actualAmount",
                    !isProjected && value === "" ? null : Number(value) || 0,
                  )
                }}
                className="w-20 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right font-bold text-white outline-none hover:border-neutral-700 focus:border-yellow-400"
              />
            </label>
          ),
          low: balance < 0,
        })
      }

      if (mode === "projected") {
        for (const payment of paymentsByDate[day.date] ?? []) {
          balance -= payment.amount
          result.push({
            id: `${day.id}-${payment.description}`,
            date: day.date,
            description: payment.description,
            source: "Proyectada",
            income: 0,
            expense: payment.amount,
            balance,
            low: balance < 0 || belowZeroDates.has(day.date),
          })
        }
      }
    }
    return result
  }, [days, startingBalance, mode, paymentsByDate, belowZeroDates, updatePlatformAmount])

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950" aria-label={mode === "bank" ? "Registro bancario" : "Registro proyectado"}>
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <div>
          <h2 className="text-sm font-extrabold text-white">{mode === "bank" ? "Registro bancario" : "Registro proyectado"}</h2>
          <p className="mt-0.5 text-[10px] text-neutral-400">{mode === "bank" ? "Transacciones reales para reconciliación" : "Balance bancario + ingresos y pagos proyectados"}</p>
        </div>
        <span className="rounded-full bg-yellow-400/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-yellow-300">Editable</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-xs">
          <thead className="bg-neutral-900/80 text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-900 px-4 py-3 font-bold">Fecha</th>
              <th className="px-3 py-3 font-bold">Descripción</th>
              <th className="px-3 py-3 font-bold">Origen</th>
              <th className="px-3 py-3 text-right font-bold">Entrada</th>
              <th className="px-3 py-3 text-right font-bold">Salida</th>
              <th className="px-4 py-3 text-right font-bold">Balance acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {rows.map((row, index) => (
              <tr key={row.id} className={cn("align-middle", row.low && "bg-rose-950/25", index === 0 && "bg-neutral-900/50")}>
                <td className="sticky left-0 z-[1] whitespace-nowrap bg-neutral-950 px-4 py-3 font-semibold capitalize text-neutral-300">{index === 0 ? "—" : dayLabel(row.date)}</td>
                <td className="px-3 py-3 font-semibold text-white">{row.description}</td>
                <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold", row.source === "Banco" ? "bg-sky-400/10 text-sky-300" : row.source === "Proyectada" ? "bg-amber-400/10 text-amber-300" : "text-neutral-500")}>{row.source}</span></td>
                <td className="px-3 py-3 text-right font-bold text-emerald-400">{row.editor ?? (row.income ? `+${money(row.income)}` : "—")}</td>
                <td className="px-3 py-3 text-right font-semibold text-rose-300">{row.expense ? `−$${row.expense.toFixed(2)}` : "—"}</td>
                <td className={cn("px-4 py-3 text-right text-sm font-extrabold", row.low ? "text-rose-400" : "text-white")}>{money(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-500">Toca cualquier entrada para corregirla. El balance acumulado se recalcula automáticamente.</p>
    </section>
  )
}
