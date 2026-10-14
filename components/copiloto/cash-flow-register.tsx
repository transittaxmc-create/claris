"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Wallet,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Search,
  Building2,
  Receipt,
  Car,
  Link2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { sinSemillas } from "./cash-flow-store"
import {
  money,
  type CashFlowEntry,
  type CashFlowSource,
  type CashFlowStatus,
  type CashFlowType,
} from "./types"

const STORAGE_KEY = "claris_cash_flow_entries"

interface CashFlowRegisterProps {
  startingActualBalance: number
  onUpdateStartingBalance?: (newBal: number) => void
}

function shortDate(iso: string): string {
  if (!iso || iso.length < 10) return iso || "—"
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso.slice(5)
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
  } catch {
    return iso.slice(5)
  }
}

function weekdayShort(iso: string): string {
  if (!iso || iso.length < 10) return ""
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(d.getTime())) return ""
    const w = d.toLocaleDateString("es-ES", { weekday: "short" })
    return w.charAt(0).toUpperCase() + w.slice(1).replace(".", "")
  } catch {
    return ""
  }
}

function relativeDate(iso: string): string {
  if (!iso || iso.length < 10) return ""
  try {
    const target = new Date(`${iso.slice(0, 10)}T12:00:00`)
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
    if (diff === 0) return "Hoy"
    if (diff === 1) return "Mañana"
    if (diff === -1) return "Ayer"
    if (diff > 1) return `En ${diff} días`
    return `Hace ${Math.abs(diff)} días`
  } catch {
    return ""
  }
}

export function CashFlowRegister({
  startingActualBalance,
  onUpdateStartingBalance,
}: CashFlowRegisterProps) {
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | "actual" | "projected">("all")
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) : []
      const lista: CashFlowEntry[] = Array.isArray(parsed) ? parsed : []
      const limpio = sinSemillas(lista)
      setEntries(limpio)
      if (limpio.length !== lista.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limpio))
      }
    } catch {
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const balances = useMemo(() => {
    let actualNet = 0
    let projectedNet = 0
    for (const e of entries) {
      const amt = Number(e.amount) || 0
      if (e.status === "actual") {
        if (e.type === "income") actualNet += amt
        else actualNet -= amt
      } else {
        if (e.type === "income") projectedNet += amt
        else projectedNet -= amt
      }
    }
    const actualBalance = Math.round((startingActualBalance + actualNet) * 100) / 100
    const projectedBalance = Math.round((actualBalance + projectedNet) * 100) / 100
    return { actualBalance, projectedBalance, actualNet, projectedNet }
  }, [entries, startingActualBalance])

  const calculatedRows = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      if (cmp !== 0) return cmp
      return (a.createdAt || "").localeCompare(b.createdAt || "")
    })
    let currentActualRun = startingActualBalance
    let currentProjectedRun = startingActualBalance
    return sorted.map((entry) => {
      const amt = Number(entry.amount) || 0
      if (entry.status === "actual") {
        if (entry.type === "income") {
          currentActualRun += amt
          currentProjectedRun += amt
        } else {
          currentActualRun -= amt
          currentProjectedRun -= amt
        }
      } else {
        if (entry.type === "income") currentProjectedRun += amt
        else currentProjectedRun -= amt
      }
      return {
        ...entry,
        runningActual: Math.round(currentActualRun * 100) / 100,
        runningProjected: Math.round(currentProjectedRun * 100) / 100,
      }
    })
  }, [entries, startingActualBalance])

  const displayRows = useMemo(() => {
    return calculatedRows
      .filter((row) => {
        if (filterType === "actual" && row.status !== "actual") return false
        if (filterType === "projected" && row.status !== "projected") return false
        if (!searchTerm.trim()) return true
        const term = searchTerm.toLowerCase()
        return (
          row.description.toLowerCase().includes(term) ||
          (row.category || "").toLowerCase().includes(term) ||
          (row.sourceLabel || "").toLowerCase().includes(term) ||
          row.date.includes(term)
        )
      })
      .reverse()
  }, [calculatedRows, filterType, searchTerm])

  const saveEntries = useCallback((updated: CashFlowEntry[]) => {
    setEntries(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {}
  }, [])

  const handleOpenAddModal = (
    defaultType: CashFlowType = "income",
    defaultStatus: CashFlowStatus = "actual",
  ) => {
    const today = new Date().toISOString().slice(0, 10)
    setEditingEntry({
      id: crypto.randomUUID(),
      date: today,
      description: "",
      source: defaultStatus === "projected" ? "projection" : "manual",
      sourceLabel: defaultStatus === "projected" ? "Proyección" : "Manual",
      type: defaultType,
      status: defaultStatus,
      amount: 0,
      category: defaultType === "income" ? "Ingresos" : "Varios",
      isManuallyEdited: false,
      notes: "",
      createdAt: new Date().toISOString(),
    })
    setIsModalOpen(true)
  }

  const handleEditEntry = (entry: CashFlowEntry) => {
    setEditingEntry({ ...entry })
    setIsModalOpen(true)
  }

  const handleDeleteEntry = (id: string) => {
    if (confirm("¿Eliminar este registro del Libro Mayor?")) {
      saveEntries(entries.filter((e) => e.id !== id))
    }
  }

  const handleInlineAmount = (id: string, raw: string) => {
    const parsed = parseFloat(raw)
    if (!Number.isFinite(parsed)) return
    const updated = entries.map((e) =>
      e.id === id
        ? { ...e, amount: Math.round(Math.abs(parsed) * 100) / 100, isManuallyEdited: true }
        : e,
    )
    saveEntries(updated)
  }

  const handleMatch = (id: string) => {
    const updated = entries.map((e) =>
      e.id === id
        ? {
            ...e,
            status: "actual" as CashFlowStatus,
            source: "bank" as CashFlowSource,
            sourceLabel: e.sourceLabel || "Banco",
            isManuallyEdited: true,
          }
        : e,
    )
    saveEntries(updated)
  }

  const handleSaveModal = (entryToSave: CashFlowEntry) => {
    if (!entryToSave.description.trim()) {
      alert("Por favor ingresa una descripción.")
      return
    }
    if (!(Number(entryToSave.amount) > 0)) {
      alert("Por favor ingresa un monto válido mayor a 0.")
      return
    }
    const isFromAutomatedSource =
      entryToSave.source === "bank" ||
      entryToSave.source === "receipt" ||
      entryToSave.source === "trip"
    const finalEntry: CashFlowEntry = {
      ...entryToSave,
      amount: Number(entryToSave.amount),
      isManuallyEdited: isFromAutomatedSource ? true : Boolean(entryToSave.isManuallyEdited),
    }
    const exists = entries.some((e) => e.id === finalEntry.id)
    const updated = exists
      ? entries.map((e) => (e.id === finalEntry.id ? finalEntry : e))
      : [finalEntry, ...entries]
    saveEntries(updated)
    setIsModalOpen(false)
    setEditingEntry(null)
  }

  const getSourceBadge = (source: CashFlowSource, label?: string) => {
    switch (source) {
      case "bank":
        return (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-semibold text-blue-400 border border-blue-500/20">
            <Building2 className="size-2" /> {label || "Banco"}
          </span>
        )
      case "receipt":
        return (
          <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/10 px-1 py-0.5 text-[9px] font-semibold text-purple-400 border border-purple-500/20">
            <Receipt className="size-2" /> {label || "Recibo"}
          </span>
        )
      case "trip":
        return (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold text-amber-400 border border-amber-500/20">
            <Car className="size-2" /> {label || "Viaje"}
          </span>
        )
      case "projection":
        return (
          <span className="inline-flex items-center gap-0.5 rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] font-semibold text-cyan-400 border border-cyan-500/20">
            <TrendingUp className="size-2" /> {label || "Proyectado"}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-0.5 rounded bg-neutral-800 px-1 py-0.5 text-[9px] font-semibold text-neutral-400 border border-neutral-700">
            {label || "Manual"}
          </span>
        )
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-neutral-500">
        Cargando libro mayor…
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col overflow-x-hidden px-1">
      <div className="sticky top-0 z-20 border-b border-neutral-800 bg-black/95 px-3 py-2.5 backdrop-blur-md">
        <div className="mb-1.5 flex items-center justify-center gap-2 px-1 text-[10px] font-bold text-neutral-400">
          <span className="tracking-wider text-emerald-400">COPILOTO · DINERO</span>
          <span className="rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[9px] text-emerald-300">
            EN RUTA
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-[8px] font-bold uppercase text-neutral-400">BANCO REAL</div>
            <div className="mt-0.5 text-xs font-black tabular-nums text-emerald-400">
              {money(balances.actualBalance)}
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-[8px] font-bold uppercase text-neutral-400">PROYECTADO</div>
            <div
              className={cn(
                "mt-0.5 text-xs font-black tabular-nums",
                balances.projectedBalance >= 0 ? "text-cyan-400" : "text-rose-400",
              )}
            >
              {money(balances.projectedBalance)}
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-[8px] font-bold uppercase text-neutral-400">CIERRE</div>
            <div className="mt-0.5 text-xs font-black tabular-nums text-emerald-400">$0.00</div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 px-0.5">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/90 py-1.5 pl-7 pr-2 text-[11px] text-white placeholder-neutral-500 outline-none focus:border-yellow-400/50"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | "actual" | "projected")}
            className="rounded-lg border border-neutral-800 bg-neutral-900/90 px-1.5 py-1.5 text-[10px] text-neutral-300 outline-none"
          >
            <option value="all">Todos</option>
            <option value="actual">Reales</option>
            <option value="projected">Proy.</option>
          </select>
          <button
            type="button"
            onClick={() => handleOpenAddModal("income", "projected")}
            className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-1.5 text-[10px] font-bold text-cyan-300"
            title="Añadir proyección"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddModal("expense", "actual")}
            className="mr-0.5 shrink-0 rounded-lg bg-yellow-400 p-1.5 text-[10px] font-extrabold text-black"
            title="Nueva transacción"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 w-full overflow-x-hidden">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/90 text-[9px] uppercase text-neutral-400">
              <th className="w-[15%] p-1.5 font-bold">Fecha</th>
              <th className="w-[32%] p-1.5 font-bold">Descripción</th>
              <th className="w-[18%] p-1.5 text-right font-bold">Banco ($)</th>
              <th className="w-[25%] p-1.5 text-right font-bold">Transac.</th>
              <th className="w-[10%] p-1 text-center font-bold">Rec.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/80">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-neutral-500">
                  {isLoaded ? "Sin movimientos. Añade una transacción o proyección." : "Cargando…"}
                </td>
              </tr>
            ) : (
              displayRows.map((row) => {
                const isActual = row.status === "actual"
                const isIncome = row.type === "income"
                const signedAmt = isIncome ? row.amount : -row.amount
                const hasReceipt =
                  row.source === "receipt" ||
                  row.source === "bank" ||
                  row.source === "trip" ||
                  Boolean(row.notes)
                return (
                  <tr
                    key={row.id}
                    className={cn("text-[11px]", isActual ? "bg-neutral-900/30" : "bg-emerald-950/15")}
                  >
                    <td className="p-1.5 align-top">
                      <div className="font-bold leading-tight text-neutral-200">{shortDate(row.date)}</div>
                      <div className="text-[9px] font-semibold leading-tight text-amber-400/90">
                        {weekdayShort(row.date)}
                      </div>
                      <div className="text-[8px] leading-tight text-neutral-500">
                        {relativeDate(row.date) || (isActual ? "Banco" : "Pendiente")}
                      </div>
                    </td>
                    <td className="overflow-hidden p-1.5 align-top">
                      <div className="truncate font-semibold leading-tight text-neutral-100">
                        {row.description || "—"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-neutral-400">
                        {getSourceBadge(row.source, row.sourceLabel)}
                        {row.category && <span className="truncate">{row.category}</span>}
                      </div>
                    </td>
                    <td className="p-1.5 text-right align-top">
                      <div className="font-bold tabular-nums leading-tight text-emerald-400">
                        {isActual ? money(row.runningActual) : "—"}
                      </div>
                      <div className="text-[8px] text-neutral-500">{isActual ? "Chase" : "Pendiente"}</div>
                    </td>
                    <td className="p-1.5 text-right align-top">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={signedAmt}
                        key={`${row.id}-${row.amount}`}
                        onBlur={(e) => {
                          const v = e.target.value
                          if (v !== "" && v !== String(signedAmt)) handleInlineAmount(row.id, v)
                        }}
                        className={cn(
                          "w-full border-b border-transparent bg-transparent text-right text-[11px] font-black tabular-nums outline-none focus:border-yellow-400/50",
                          signedAmt >= 0 ? "text-emerald-400" : "text-rose-400",
                        )}
                      />
                      <div className="mt-0.5 inline-block whitespace-nowrap rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-[8px] font-bold leading-none text-neutral-300">
                        PROY: {money(row.runningProjected)}
                      </div>
                      {!isActual && (
                        <div className="mt-1 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleMatch(row.id)}
                            className="rounded bg-emerald-600/30 p-1 text-emerald-400 hover:bg-emerald-600/50"
                            title="Match con banco"
                          >
                            <Link2 className="size-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(row.id)}
                            className="rounded bg-rose-600/30 p-1 text-rose-400 hover:bg-rose-600/50"
                            title="Borrar proyección"
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                        </div>
                      )}
                      {isActual && (
                        <div className="mt-1 flex justify-end gap-0.5">
                          <button type="button" onClick={() => handleEditEntry(row)} className="p-0.5 text-neutral-500 hover:text-white" title="Editar">
                            <Pencil className="size-2.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteEntry(row.id)} className="p-0.5 text-neutral-500 hover:text-rose-400" title="Eliminar">
                            <Trash2 className="size-2.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-1 text-center align-top">
                      {hasReceipt ? (
                        <CheckCircle2 className="mx-auto size-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="mx-auto size-3.5 text-amber-400" />
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {onUpdateStartingBalance && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <span className="text-[10px] font-bold uppercase text-neutral-400">Balance inicial banco</span>
          <input
            type="number"
            step="0.01"
            defaultValue={startingActualBalance}
            onBlur={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isFinite(v)) onUpdateStartingBalance(Math.round(v * 100) / 100)
            }}
            className="w-28 border-b border-neutral-700 bg-transparent text-right text-xs font-bold tabular-nums text-emerald-400 outline-none focus:border-yellow-400"
          />
        </div>
      )}

      {isModalOpen && editingEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 shadow-2xl sm:rounded-2xl">
            <h3 className="mb-3 text-sm font-extrabold text-white">
              {entries.some((e) => e.id === editingEntry.id) ? "Editar movimiento" : "Nuevo movimiento"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Descripción</label>
                <input
                  type="text"
                  autoFocus
                  value={editingEntry.description}
                  onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingEntry.amount || ""}
                    onChange={(e) => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Fecha</label>
                  <input
                    type="date"
                    value={editingEntry.date}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Tipo</label>
                  <select
                    value={editingEntry.type}
                    onChange={(e) => setEditingEntry({ ...editingEntry, type: e.target.value as CashFlowType })}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="income">Ingreso (+)</option>
                    <option value="expense">Gasto (−)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Estado</label>
                  <select
                    value={editingEntry.status}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        status: e.target.value as CashFlowStatus,
                        source: e.target.value === "projected" ? "projection" : editingEntry.source,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="actual">Real (Banco)</option>
                    <option value="projected">Proyectado</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingEntry(null)
                  }}
                  className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveModal(editingEntry)}
                  className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
