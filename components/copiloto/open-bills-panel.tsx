"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleDollarSign, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/dates"
import {
  applyPayment,
  createOpenBill,
  loadOpenBills,
  saveOpenBills,
  sortBillsFifo,
  totalOpenRemaining,
  type OpenBill,
} from "./open-bills-store"

function money(n: number): string {
  return `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function OpenBillsPanel() {
  const [bills, setBills] = useState<OpenBill[]>([])
  const [hydrated, setHydrated] = useState(false)

  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")
  const [due, setDue] = useState(() => localDateKey(new Date()))

  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(() => localDateKey(new Date()))
  const [payBillId, setPayBillId] = useState<string>("")
  const [payNote, setPayNote] = useState("")
  const [lastMsg, setLastMsg] = useState<string | null>(null)

  useEffect(() => {
    setBills(loadOpenBills())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveOpenBills(bills)
  }, [bills, hydrated])

  const ordered = useMemo(() => sortBillsFifo(bills), [bills])
  const openOnes = ordered.filter((b) => b.status !== "paid")
  const paidOnes = ordered.filter((b) => b.status === "paid").slice(0, 8)
  const remainingTotal = totalOpenRemaining(bills)

  function addBill() {
    const value = parseFloat(amount)
    if (!desc.trim() || !value || value <= 0 || !due) return
    const bill = createOpenBill({ description: desc.trim(), amount: value, dueDate: due })
    setBills((prev) => [bill, ...prev])
    setDesc("")
    setAmount("")
    setLastMsg(`Cuenta por pagar creada: ${bill.description} ${money(value)}`)
  }

  function recordPayment() {
    const value = parseFloat(payAmount)
    if (!value || value <= 0) return
    const { bills: next, applications, leftover } = applyPayment(bills, {
      amount: value,
      date: payDate,
      note: payNote.trim() || undefined,
      billId: payBillId || undefined,
    })
    if (applications.length === 0) {
      setLastMsg("No hay cuentas por pagar abiertas para descontar este pago.")
      return
    }
    setBills(next)
    setPayAmount("")
    setPayNote("")
    const lines = applications.map(
      (a) => `• ${a.description}: ${money(a.amount)} (queda ${money(a.remainingAfter)})`,
    )
    const extra = leftover > 0.009 ? `\nSobrante no aplicado: ${money(leftover)}` : ""
    setLastMsg(`Descontado de cuentas por pagar (más vieja → más nueva):\n${lines.join("\n")}${extra}`)
  }

  function removeBill(id: string) {
    if (!window.confirm("¿Borrar esta cuenta por pagar y su historial?")) return
    setBills((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <section
      className="rounded-2xl border border-violet-500/30 bg-violet-950/10 p-3.5"
      aria-label="Cuentas por pagar — no es por cobrar ni recibo"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-violet-300">
            <CircleDollarSign className="size-3.5" />
            CUENTAS POR PAGAR (AP)
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
            Esto es cuentas por pagar: lo que tú debes. No es recibo ni cuenta por cobrar. Cada pago
            descuenta de la más vieja hasta $0; el sobrante a la siguiente.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-right">
          <p className="text-[9px] font-bold text-violet-300">POR PAGAR</p>
          <p className="font-mono text-sm font-extrabold text-white">{money(remainingTotal)}</p>
        </div>
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/50 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Nueva cuenta por pagar</p>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Ej. Carro, EZPass (lo que debo)"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="924.00"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <button
          type="button"
          onClick={addBill}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 py-2 text-xs font-bold text-violet-200"
        >
          <Plus className="size-3.5" /> Añadir cuenta por pagar
        </button>
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
          Registrar pago (descuenta de por pagar)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Monto pagado"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <select
          value={payBillId}
          onChange={(e) => setPayBillId(e.target.value)}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white"
        >
          <option value="">Descuenta la más vieja primero</option>
          {openOnes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.description} · queda {money(b.remainingAmount)}
            </option>
          ))}
        </select>
        <input
          value={payNote}
          onChange={(e) => setPayNote(e.target.value)}
          placeholder="Nota (ej. parcial carro / EZPass)"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={recordPayment}
          className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-black"
        >
          Descontar de por pagar
        </button>
      </div>

      {lastMsg && (
        <p className="mb-3 whitespace-pre-wrap rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-[11px] leading-snug text-neutral-300">
          {lastMsg}
        </p>
      )}

      <div className="space-y-1.5">
        {openOnes.length === 0 && (
          <p className="text-[11px] text-neutral-500">Nada por pagar. Todo en $0.</p>
        )}
        {openOnes.map((b) => (
          <div key={b.id} className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{b.description}</p>
                <p className="text-[10px] text-neutral-500">
                  Vence {b.dueDate} · Original {money(b.originalAmount)}
                  {b.status === "partial" && " · parcial"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono text-xs font-extrabold tabular-nums",
                    b.status === "partial" ? "text-amber-300" : "text-violet-200",
                  )}
                >
                  {money(b.remainingAmount)}
                </span>
                <button
                  type="button"
                  aria-label="Borrar"
                  onClick={() => removeBill(b.id)}
                  className="rounded-lg border border-neutral-700 p-1 text-rose-400"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
            {b.payments.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 border-t border-neutral-800/80 pt-1.5">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 text-[10px] text-neutral-400">
                    <span>
                      {p.date}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                    <span className="font-mono text-emerald-400/90">−{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {paidOnes.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-neutral-800 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Pagadas / cerradas en $0</p>
          {paidOnes.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
              <span className="flex min-w-0 items-center gap-1 truncate">
                <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
                <span className="truncate">{b.description}</span>
              </span>
              <span className="shrink-0 font-mono">{money(b.originalAmount)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
