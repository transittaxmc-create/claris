"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { EXPENSE_CATEGORIES, type Expense, expenseTotal, money } from "./types"
import { MoneyInput } from "./money-input"

// Pantalla de gastos (pestaña EXPENSES). Mismo estilo que REGISTER y el mismo
// esquema de guardado que los viajes: el padre (copiloto-app) se encarga de
// persistir en localStorage + IndexedDB y de sincronizar.

type Draft = {
  id: string | null
  date: string
  vendor: string
  category: string
  amount: number
  notes: string
}

function emptyDraft(): Draft {
  return {
    id: null,
    date: new Date().toISOString().slice(0, 10),
    vendor: "",
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    notes: "",
  }
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-2 py-3">
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">{label}</span>
      <span className={cn("text-lg font-extrabold", valueClass)}>{value}</span>
    </div>
  )
}

function ExpenseRow({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense
  onEdit: (e: Expense) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-bold text-white">{expense.vendor || "(sin vendedor)"}</span>
          <span className="text-[11px] text-neutral-500">{expense.date}</span>
        </div>
        <p className="shrink-0 text-base font-extrabold text-rose-400">{money(expense.amount)}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[10px] font-bold text-neutral-300">
          {expense.category}
        </span>
        {expense.isAiGenerated && (
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold text-sky-400">
            IA
          </span>
        )}
        {expense.isEditedByUser && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400">
            EDITADO
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onEdit(expense)}
          className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] font-bold text-neutral-300 hover:text-white"
        >
          <Pencil className="size-3" /> EDITAR
        </button>
        <button
          type="button"
          onClick={() => onDelete(expense.id)}
          aria-label="Eliminar gasto"
          className="flex items-center gap-1 rounded-lg border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] font-bold text-rose-400 hover:text-rose-300"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {expense.notes && <p className="mt-2 text-[11px] leading-tight text-neutral-500">{expense.notes}</p>}
    </div>
  )
}

export function ExpensesScreen({
  expenses,
  onSave,
  onDelete,
}: {
  expenses: Expense[]
  onSave: (e: Expense) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todas")

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return expenses.filter((e) => {
      const matchesSearch = !term || (e.vendor ?? "").toLowerCase().includes(term)
      const matchesCategory = category === "Todas" || e.category === category
      return matchesSearch && matchesCategory
    })
  }, [expenses, search, category])

  const total = useMemo(() => expenseTotal(expenses), [expenses])
  const filteredTotal = useMemo(() => expenseTotal(filtered), [filtered])

  function saveDraft() {
    if (!draft) return
    if (!draft.vendor.trim() || !Number.isFinite(draft.amount)) {
      window.alert("Completa el vendedor y el monto.")
      return
    }
    const expense: Expense = {
      id: draft.id ?? crypto.randomUUID(),
      date: draft.date,
      vendor: draft.vendor.trim(),
      category: draft.category,
      amount: Number(draft.amount) || 0,
      notes: draft.notes.trim() || undefined,
      isAiGenerated: false,
      isEditedByUser: draft.id !== null,
      savedAt: new Date().toISOString(),
    }
    onSave(expense)
    setDraft(null)
  }

  function deleteWithConfirm(id: string) {
    if (window.confirm("¿Eliminar este gasto?")) onDelete(id)
  }

  function editFromRow(ex: Expense) {
    setDraft({
      id: ex.id,
      date: ex.date,
      vendor: ex.vendor,
      category: ex.category,
      amount: ex.amount,
      notes: ex.notes ?? "",
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header + totales + formulario + filtros */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold tracking-widest text-neutral-400">EXPENSES</h1>
          {!draft && (
            <button
              type="button"
              onClick={() => setDraft(emptyDraft())}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-black active:scale-95"
            >
              <Plus className="size-3.5" /> NUEVO GASTO
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <StatCard label="TOTAL GASTOS" value={money(total)} valueClass="text-rose-400" />
          <StatCard label="FILTRADOS" value={money(filteredTotal)} valueClass="text-amber-400" />
          <StatCard label="CANTIDAD" value={String(expenses.length)} valueClass="text-white" />
        </div>

        {/* Formulario (añadir / editar) */}
        {draft && (
          <section className="mt-3 rounded-2xl border border-neutral-700 bg-neutral-900/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300">
                {draft.id ? "EDITAR GASTO" : "NUEVO GASTO"}
              </span>
              <button type="button" onClick={() => setDraft(null)} className="text-[11px] font-bold text-rose-400">
                CANCELAR
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-400">FECHA</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-400">CATEGORÍA</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">VENDEDOR</span>
              <input
                value={draft.vendor}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                placeholder="BP Gas Station, E-ZPass…"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
              />
            </label>

            <div className="mt-2">
              <MoneyInput
                label="MONTO"
                color="text-rose-400"
                value={draft.amount}
                onChange={(n) => setDraft({ ...draft, amount: n })}
              />
            </div>

            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400">NOTAS</span>
              <input
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Opcional"
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
              />
            </label>

            <button
              type="button"
              onClick={saveDraft}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3 text-sm font-extrabold text-black active:scale-[0.99]"
            >
              {draft.id ? "GUARDAR CAMBIOS" : "GUARDAR GASTO"}
            </button>
          </section>
        )}

        {/* Filtros */}
        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vendedor"
              className="w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="max-w-[45%] rounded-xl border border-neutral-800 bg-neutral-950 px-2 py-2 text-[11px] text-neutral-300 outline-none"
          >
            <option value="Todas">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-neutral-600">
              {expenses.length === 0 ? "Sin gastos todavía." : "Ningún gasto coincide con el filtro."}
            </p>
            {expenses.length === 0 && !draft && (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300"
              >
                <Plus className="size-3.5" /> AÑADIR PRIMER GASTO
              </button>
            )}
          </div>
        ) : (
          filtered.map((e) => (
            <ExpenseRow key={e.id} expense={e} onEdit={editFromRow} onDelete={deleteWithConfirm} />
          ))
        )}
      </div>
    </div>
  )
}