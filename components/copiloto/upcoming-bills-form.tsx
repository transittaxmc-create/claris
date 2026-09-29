// Formulario de plan de pagos: próximas facturas con nombre, monto,
// vencimiento y prioridad (estilo Claris).

"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-store"
import { localDateKey } from "@/lib/dates"

export function UpcomingBillsForm() {
  const { upcomingExpenses, addUpcomingExpense, removeUpcomingExpense } = useFinance()
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState(localDateKey(new Date()))
  const [priority, setPriority] = useState<1 | 2>(1)

  const submit = () => {
    const value = parseFloat(amount)
    if (!name.trim() || !value || value <= 0 || !dueDate) return
    addUpcomingExpense({ name: name.trim(), amount: value, dueDate, priority })
    setName("")
    setAmount("")
  }

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="text-sm font-bold uppercase text-white">Plan de Pagos</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre (ej. Renta, Geico)"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
      />
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto $"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
        />
      </div>
      <div className="flex gap-2">
        {([1, 2] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={cn(
              "flex-1 rounded-xl border py-2 text-xs font-bold",
              priority === p
                ? p === 1
                  ? "border-rose-400/60 text-rose-300"
                  : "border-yellow-400/60 text-yellow-300"
                : "border-neutral-700 text-neutral-500",
            )}
          >
            {p === 1 ? "🔴 Crítico" : "🟡 Secundario"}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={submit}
        className="w-full rounded-xl bg-yellow-400 py-2.5 text-sm font-extrabold text-black"
      >
        Añadir factura
      </button>

      {upcomingExpenses.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-800 pt-2">
          {[...upcomingExpenses]
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">
                    {e.priority === 1 ? "🔴 " : "🟡 "}
                    {e.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">Vence {e.dueDate}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-extrabold tabular-nums text-neutral-200">
                    ${e.amount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    aria-label="Borrar factura"
                    onClick={() => removeUpcomingExpense(e.id)}
                    className="rounded-lg border border-neutral-700 p-1.5 text-rose-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
