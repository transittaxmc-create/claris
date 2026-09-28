"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-store"

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

export function FinanceRegisterTable({
  mode = "bank",
  paymentsByDate = {},
  belowZeroDates = new Set<string>(),
}: {
  mode?: "bank" | "projected"
  paymentsByDate?: Record<string, { description: string; amount: number }[]>
  belowZeroDates?: Set<string>
}) {
  const { days, startingBalance, toggleWorkingDay, updatePlatformAmount, initializeWeek } = useFinance()

  useEffect(() => {
    if (days.length === 0) initializeWeek()
  }, [days.length, initializeWeek])

  let runningBalance = startingBalance
  const rows = days.map((day) => {
    const income = day.platforms.reduce(
      (sum, platform) => sum + (mode === "bank" ? Number(platform.actualAmount) || 0 : Number(platform.projectedAmount) || 0),
      0,
    )
    const expenses = (paymentsByDate[day.date] ?? []).reduce((sum, payment) => sum + payment.amount, 0)
    const net = income - expenses
    runningBalance += net
    return { day, income, expenses, net, balance: runningBalance }
  })

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950" aria-label={mode === "bank" ? "Registro bancario" : "Registro proyectado"}>
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <div>
          <h2 className="text-sm font-extrabold text-white">{mode === "bank" ? "Registro bancario" : "Registro proyectado"}</h2>
          <p className="mt-0.5 text-[10px] text-neutral-400">
            {mode === "bank" ? "Entradas reales y conciliación diaria" : "Banco + ingresos y pagos programados"}
          </p>
        </div>
        <span className="rounded-full bg-yellow-400/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-yellow-300">Editable</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left text-xs">
          <thead className="bg-neutral-900/70 text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-900 px-4 py-3 font-bold">Fecha</th>
              <th className="px-3 py-3 font-bold">Transacciones por plataforma</th>
              <th className="px-3 py-3 text-right font-bold">Entradas</th>
              <th className="px-3 py-3 text-right font-bold">Salidas</th>
              <th className="px-3 py-3 text-right font-bold">Neto</th>
              <th className="px-4 py-3 text-right font-bold">Balance acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            <tr className="bg-neutral-900/40 text-[11px]">
              <td className="sticky left-0 bg-neutral-900/90 px-4 py-2 font-semibold text-neutral-400">Saldo inicial</td>
              <td className="px-3 py-2 text-neutral-600">—</td>
              <td colSpan={3} className="px-3 py-2 text-right text-neutral-600">—</td>
              <td className="px-4 py-2 text-right font-bold text-white">${startingBalance.toFixed(2)}</td>
            </tr>
            {rows.map(({ day, income, expenses, net, balance }) => {
              const paymentsDue = paymentsByDate[day.date] ?? []
              const low = belowZeroDates.has(day.date) || balance < 0
              return (
                <tr key={day.id} className={cn("align-top", low && "bg-rose-950/20")}>
                  <td className="sticky left-0 z-[1] bg-neutral-950 px-4 py-3">
                    <div className="whitespace-nowrap font-bold capitalize text-white">{dayLabel(day.date)}</div>
                    <button
                      type="button"
                      onClick={() => toggleWorkingDay(day.id)}
                      className={cn("mt-1 rounded-full border px-2 py-0.5 text-[9px] font-bold", day.isWorkingDay ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300" : "border-neutral-700 text-neutral-500")}
                    >
                      {day.isWorkingDay ? "WORKING" : "OFF"}
                    </button>
                  </td>
                  <td className="min-w-[430px] px-3 py-2">
                    <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                      {day.platforms.map((platform) => {
                        const field = mode === "bank" ? "actualAmount" : "projectedAmount"
                        const value = platform[field]
                        return (
                          <label key={platform.platformName} className="flex min-w-0 items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/70 px-1.5 py-1 focus-within:border-yellow-400/60">
                            <span className="min-w-0 flex-1 truncate text-[9px] text-neutral-400" title={platform.platformName}>{platform.platformName}</span>
                            <span className="text-[9px] text-neutral-600">$</span>
                            <input
                              aria-label={`${platform.platformName} ${dayLabel(day.date)}`}
                              type="number"
                              inputMode="decimal"
                              value={value || ""}
                              placeholder="0"
                              onChange={(event) => updatePlatformAmount(day.id, platform.platformName, field, Number(event.target.value) || 0)}
                              className="w-[62px] bg-transparent text-right text-[10px] font-semibold text-white outline-none placeholder:text-neutral-700"
                            />
                          </label>
                        )
                      })}
                    </div>
                    {paymentsDue.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {paymentsDue.map((payment, index) => (
                          <span key={`${payment.description}-${index}`} className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-semibold text-amber-300">
                            {payment.description} −${payment.amount.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-400">${income.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-rose-300">{expenses ? `−$${expenses.toFixed(2)}` : "—"}</td>
                  <td className={cn("px-3 py-3 text-right font-bold", net >= 0 ? "text-emerald-400" : "text-rose-300")}>{net >= 0 ? "+" : "−"}${Math.abs(net).toFixed(2)}</td>
                  <td className={cn("px-4 py-3 text-right text-sm font-extrabold", low ? "text-rose-400" : "text-white")}>
                    ${balance.toFixed(2)}
                    <span className={cn("mt-1 block text-[9px] font-bold", low ? "text-rose-400" : "text-neutral-500")}>{low ? "BAJO" : "ACUMULADO"}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-500">Toca cualquier monto para corregirlo. Los cambios se guardan automáticamente.</p>
    </section>
  )
}
