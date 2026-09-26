// Formulario de registro rápido de gastos operativos (estilo Claris).
// Descuenta del saldo disponible y separa 10% a la Reserva de Imprevistos.

"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { FINANCE_EXPENSE_CATEGORIES, useFinance, type FinanceExpenseCategory } from "./finance-store"

export function ExpenseRegisterForm() {
  const { addExpense, loggedExpenses } = useFinance()
  const [category, setCategory] = useState<FinanceExpenseCategory>("Combustible")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

  const submit = () => {
    const value = parseFloat(amount)
    if (!value || value <= 0) return
    addExpense({ category, amount: value, note: note || undefined })
    setAmount("")
    setNote("")
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {FINANCE_EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-xl border px-2 py-2 text-xs font-semibold transition-colors",
              category === c
                ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-300",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Monto $"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
      />

      <button
        type="button"
        onClick={submit}
        className="w-full rounded-xl bg-yellow-400 py-2.5 font-bold text-black"
      >
        Registrar Gasto
      </button>

      <p className="text-[10px] text-neutral-500">
        Se descuenta del saldo disponible y separa 10% para la Reserva de Imprevistos.
      </p>

      {loggedExpenses.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-800 pt-2">
          {loggedExpenses
            .slice()
            .reverse()
            .slice(0, 8)
            .map((e) => (
              <div key={e.id} className="flex justify-between text-xs">
                <span className="text-neutral-400">{e.category}</span>
                <span className="font-semibold text-rose-400">-${e.amount.toFixed(2)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
