"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Wallet,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Calendar,
  Building2,
  Receipt,
  Car,
  FileSpreadsheet,
} from "lucide-react"
import { cn } from "@/lib/utils"
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

export function CashFlowRegister({
  startingActualBalance,
  onUpdateStartingBalance,
}: CashFlowRegisterProps) {
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Filters & search
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | "actual" | "projected">("all")

  // Collapsible accordions for Mobile
  const [showProjectedIncomes, setShowProjectedIncomes] = useState(false)
  const [showProjectedExpenses, setShowProjectedExpenses] = useState(false)

  // Edit / Create modal state
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setEntries(JSON.parse(saved))
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        const inThreeDays = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)

        const initialSeeds: CashFlowEntry[] = [
          {
            id: "seed-1",
            date: today,
            description: "Depósito Semanal Uber",
            source: "bank",
            sourceLabel: "Banco Chase",
            type: "income",
            status: "actual",
            amount: 485.5,
            category: "Ingreso Conducción",
            createdAt: new Date().toISOString(),
          },
          {
            id: "seed-2",
            date: today,
            description: "Gasolina Shell Autopista",
            source: "receipt",
            sourceLabel: "Recibo Escaneado",
            type: "expense",
            status: "actual",
            amount: 45.0,
            category: "Combustible",
            createdAt: new Date().toISOString(),
          },
          {
            id: "seed-3",
            date: tomorrow,
            description: "Ingreso estimado Lyft jornada",
            source: "projection",
            sourceLabel: "Proyección",
            type: "income",
            status: "projected",
            amount: 180.0,
            category: "Proyección Ingresos",
            createdAt: new Date().toISOString(),
          },
          {
            id: "seed-4",
            date: inThreeDays,
            description: "Factura E-ZPass Peajes Quincenal",
            source: "projection",
            sourceLabel: "Proyección",
            type: "expense",
            status: "projected",
            amount: 65.25,
            category: "Peajes",
            createdAt: new Date().toISOString(),
          },
        ]
        setEntries(initialSeeds)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSeeds))
      }
    } catch {
      // fallback
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Double Balance Calculations:
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

    const actualBalance = startingActualBalance + actualNet
    const projectedBalance = actualBalance + projectedNet

    return {
      actualBalance,
      projectedBalance,
      actualNet,
      projectedNet,
    }
  }, [entries, startingActualBalance])

  // Running Balances parallel calculation
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
        if (entry.type === "income") {
          currentProjectedRun += amt
        } else {
          currentProjectedRun -= amt
        }
      }

      return {
        ...entry,
        runningActual: currentActualRun,
        runningProjected: currentProjectedRun,
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

  const projectedIncomes = useMemo(
    () => entries.filter((e) => e.status === "projected" && e.type === "income"),
    [entries],
  )
  const projectedExpenses = useMemo(
    () => entries.filter((e) => e.status === "projected" && e.type === "expense"),
    [entries],
  )

  const totalProjectedIncome = useMemo(
    () => projectedIncomes.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
    [projectedIncomes],
  )
  const totalProjectedExpense = useMemo(
    () => projectedExpenses.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
    [projectedExpenses],
  )

  const saveEntries = (updated: CashFlowEntry[]) => {
    setEntries(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore persistence errors (private mode / quota)
    }
  }

  const handleOpenAddModal = (defaultType: CashFlowType = "income", defaultStatus: CashFlowStatus = "actual") => {
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
    if (confirm("¿Estás seguro de eliminar este registro del Libro Mayor?")) {
      const updated = entries.filter((e) => e.id !== id)
      saveEntries(updated)
    }
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
      entryToSave.source === "bank" || entryToSave.source === "receipt" || entryToSave.source === "trip"
    const markAsEdited = isFromAutomatedSource ? true : Boolean(entryToSave.isManuallyEdited)

    const finalEntry: CashFlowEntry = {
      ...entryToSave,
      amount: Number(entryToSave.amount),
      isManuallyEdited: markAsEdited,
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
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
            <Building2 className="size-2.5" /> {label || "Banco"}
          </span>
        )
      case "receipt":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400 border border-purple-500/20">
            <Receipt className="size-2.5" /> {label || "Recibo"}
          </span>
        )
      case "trip":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
            <Car className="size-2.5" /> {label || "Viaje"}
          </span>
        )
      case "projection":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
            <TrendingUp className="size-2.5" /> {label || "Proyectado"}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 border border-neutral-700">
            {label || "Manual"}
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* 2. ARQUITECTURA DE DOBLE BALANCE (STICKY HEADER) */}
      <div className="sticky top-0 z-20 -mx-4 -mt-3 border-b border-neutral-800 bg-black/95 px-4 py-3 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-3">
          {/* Balance Real del Banco */}
          <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/95 p-3 sm:p-4 shadow-sm">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-green-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400">
                Balance Real (Banco)
              </span>
              <Wallet className="size-3.5 sm:size-4 text-green-400" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-green-400">
              {money(balances.actualBalance)}
            </div>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              Reconciliado hoy
            </p>
          </div>

          {/* Balance Proyectado */}
          <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/95 p-3 sm:p-4 shadow-sm">
            <div
              className={cn(
                "absolute right-0 top-0 h-full w-1.5",
                balances.projectedBalance >= 0 ? "bg-cyan-500" : "bg-rose-500",
              )}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400">
                Balance Proyectado
              </span>
              <TrendingUp
                className={cn(
                  "size-3.5 sm:size-4",
                  balances.projectedBalance >= 0 ? "text-cyan-400" : "text-rose-400",
                )}
              />
            </div>
            <div
              className={cn(
                "mt-1 text-xl sm:text-2xl font-black tracking-tight",
                balances.projectedBalance >= 0 ? "text-cyan-400" : "text-rose-400",
              )}
            >
              {money(balances.projectedBalance)}
            </div>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              Impacto futuro estimado
            </p>
          </div>
        </div>

        {/* Toolbar rápida */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar movimiento, categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900/90 py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-yellow-400/50"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="rounded-xl border border-neutral-800 bg-neutral-900/90 px-2 py-1.5 text-xs text-neutral-300 outline-none"
            >
              <option value="all">Todos</option>
              <option value="actual">Solo Reales</option>
              <option value="projected">Solo Proyectados</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddModal("income", "projected")}
              className="flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/40"
              title="Añadir proyección futura"
            >
              <Plus className="size-3.5" /> Proyección
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal("expense", "actual")}
              className="flex items-center gap-1 rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-extrabold text-black hover:bg-yellow-300 shadow-sm"
            >
              <Plus className="size-3.5" /> Transacción
            </button>
          </div>
        </div>
      </div>
      {/* 3. SECCIONES COLAPSABLES (ACORDEONES PARA MOBILE) */}
      <div className="space-y-2">
        {/* Acordeón: Proyecciones de Ingresos */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowProjectedIncomes(!showProjectedIncomes)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-neutral-800/50"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                <ArrowDownLeft className="size-3.5" />
              </span>
              <div>
                <span className="text-xs font-bold text-white">Proyecciones de Ingresos</span>
                <span className="ml-2 text-[10px] text-neutral-500">
                  ({projectedIncomes.length} previstos)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-green-400">
                +{money(totalProjectedIncome)}
              </span>
              {showProjectedIncomes ? (
                <ChevronUp className="size-4 text-neutral-400" />
              ) : (
                <ChevronDown className="size-4 text-neutral-400" />
              )}
            </div>
          </button>

          {showProjectedIncomes && (
            <div className="border-t border-neutral-800/80 bg-black/40 p-3 space-y-2">
              {projectedIncomes.length === 0 ? (
                <p className="py-2 text-center text-xs text-neutral-500">
                  No hay ingresos proyectados aún.
                </p>
              ) : (
                projectedIncomes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-white">
                          {item.description}
                        </span>
                        {item.isManuallyEdited && (
                          <span className="rounded bg-yellow-400/10 px-1 py-0.2 text-[9px] text-yellow-300">
                            Editado
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        {item.date} · {item.category || "Ingreso"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-400">
                        +{money(item.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEditEntry(item)}
                        className="rounded-lg p-1 text-neutral-400 hover:text-white"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(item.id)}
                        className="rounded-lg p-1 text-neutral-500 hover:text-rose-400"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() => handleOpenAddModal("income", "projected")}
                className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-700 py-2 text-xs font-semibold text-neutral-300 hover:border-yellow-400/50 hover:text-yellow-400"
              >
                <Plus className="size-3" /> Añadir Ingreso Proyectado
              </button>
            </div>
          )}
        </div>
        {/* Acordeón: Proyecciones de Gastos */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowProjectedExpenses(!showProjectedExpenses)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-neutral-800/50"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <ArrowUpRight className="size-3.5" />
              </span>
              <div>
                <span className="text-xs font-bold text-white">Proyecciones de Gastos</span>
                <span className="ml-2 text-[10px] text-neutral-500">
                  ({projectedExpenses.length} programados)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-rose-400">
                -{money(totalProjectedExpense)}
              </span>
              {showProjectedExpenses ? (
                <ChevronUp className="size-4 text-neutral-400" />
              ) : (
                <ChevronDown className="size-4 text-neutral-400" />
              )}
            </div>
          </button>

          {showProjectedExpenses && (
            <div className="border-t border-neutral-800/80 bg-black/40 p-3 space-y-2">
              {projectedExpenses.length === 0 ? (
                <p className="py-2 text-center text-xs text-neutral-500">
                  No hay gastos programados aún.
                </p>
              ) : (
                projectedExpenses.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-white">
                          {item.description}
                        </span>
                        {item.isManuallyEdited && (
                          <span className="rounded bg-yellow-400/10 px-1 py-0.2 text-[9px] text-yellow-300">
                            Editado
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        {item.date} · {item.category || "Gasto"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-400">
                        -{money(item.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEditEntry(item)}
                        className="rounded-lg p-1 text-neutral-400 hover:text-white"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(item.id)}
                        className="rounded-lg p-1 text-neutral-500 hover:text-rose-400"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() => handleOpenAddModal("expense", "projected")}
                className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-700 py-2 text-xs font-semibold text-neutral-300 hover:border-yellow-400/50 hover:text-yellow-400"
              >
                <Plus className="size-3" /> Añadir Gasto Programado
              </button>
            </div>
          )}
        </div>
      </div>
      {/* 3 & 4. REGISTRO PRINCIPAL (MOBILE CARD LIST & DESKTOP GRID LEDGER) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5 text-yellow-400" />
            Libro Mayor / Cash Flow Register
          </span>
          <span className="text-[11px] text-neutral-500">
            {displayRows.length} movimientos
          </span>
        </div>

        {/* MOBILE VIEW (CARD LIST APILADA) */}
        <div className="space-y-2 block md:hidden">
          {displayRows.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center text-xs text-neutral-500">
              No hay movimientos que coincidan con la búsqueda.
            </div>
          ) : (
            displayRows.map((row) => {
              const isIncome = row.type === "income"
              const isActual = row.status === "actual"

              return (
                <div
                  key={row.id}
                  onClick={() => handleEditEntry(row)}
                  className="cursor-pointer rounded-2xl border border-neutral-800 bg-neutral-900/90 p-3 shadow-sm transition hover:border-neutral-700 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getSourceBadge(row.source, row.sourceLabel)}
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase",
                            isActual
                              ? "bg-neutral-800 text-neutral-300"
                              : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
                          )}
                        >
                          {isActual ? "Real" : "Proyectado"}
                        </span>
                        {row.isManuallyEdited && (
                          <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-bold text-yellow-300 border border-yellow-400/20">
                            Editado
                          </span>
                        )}
                      </div>
                      <h4 className="mt-1.5 truncate text-sm font-bold text-white">
                        {row.description}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> {row.date}
                        </span>
                        {row.category && <span>• {row.category}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={cn(
                          "text-base font-black",
                          isIncome ? "text-green-400" : "text-rose-400",
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {money(row.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Running Balances Footer */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-neutral-800/70 pt-2 text-[10px]">
                    <div className="flex items-center gap-1 text-neutral-400">
                      <span>Saldo Real:</span>
                      <strong className="text-neutral-200">
                        {money(row.runningActual)}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-400">
                      <span>Saldo Proy:</span>
                      <strong
                        className={
                          row.runningProjected >= 0 ? "text-cyan-400" : "text-rose-400"
                        }
                      >
                        {money(row.runningProjected)}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditEntry(row)
                        }}
                        className="rounded p-1 text-neutral-400 hover:text-white"
                        title="Editar movimiento"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteEntry(row.id)
                        }}
                        className="rounded p-1 text-neutral-500 hover:text-rose-400"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {/* DESKTOP VIEW (CLASSIC GRID LEDGER) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-950/80 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="py-3 pl-4 pr-2">Fecha</th>
                <th className="px-2 py-3">Fuente</th>
                <th className="px-3 py-3">Descripción</th>
                <th className="px-2 py-3 text-right text-green-400">Entrada Real</th>
                <th className="px-2 py-3 text-right text-rose-400">Salida Real</th>
                <th className="px-2 py-3 text-right text-emerald-300">Entrada Proy.</th>
                <th className="px-2 py-3 text-right text-amber-300">Salida Proy.</th>
                <th className="px-2 py-3 text-right text-white">Saldo Real Corrido</th>
                <th className="px-2 py-3 text-right text-cyan-300">Saldo Proy. Corrido</th>
                <th className="py-3 pl-2 pr-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70 font-medium">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-neutral-500">
                    No hay movimientos registrados o que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const isIncome = row.type === "income"
                  const isActual = row.status === "actual"

                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-neutral-800/40 group"
                    >
                      <td className="whitespace-nowrap py-2.5 pl-4 pr-2 font-mono text-[11px] text-neutral-300">
                        {row.date}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          {getSourceBadge(row.source, row.sourceLabel)}
                          {row.isManuallyEdited && (
                            <span
                              title="Editado manualmente"
                              className="rounded bg-yellow-400/20 px-1 py-0.2 text-[9px] font-bold text-yellow-300"
                            >
                              ✎
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            {row.description}
                          </span>
                          {row.category && (
                            <span className="text-[10px] text-neutral-400">
                              {row.category}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-green-400">
                        {isActual && isIncome ? `+${money(row.amount)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-rose-400">
                        {isActual && !isIncome ? `−${money(row.amount)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-emerald-300/80">
                        {!isActual && isIncome ? `+${money(row.amount)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-amber-300/80">
                        {!isActual && !isIncome ? `−${money(row.amount)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono font-bold text-white">
                        {money(row.runningActual)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-2 py-2.5 text-right font-mono font-bold",
                          row.runningProjected >= 0 ? "text-cyan-300" : "text-rose-400",
                        )}
                      >
                        {money(row.runningProjected)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditEntry(row)}
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                            title="Editar movimiento (100% editable)"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(row.id)}
                            className="rounded p-1 text-neutral-500 hover:bg-rose-950/40 hover:text-rose-400"
                            title="Eliminar"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL DE EDICIÓN TOTAL (100% EDITABLE) */}
      {isModalOpen && editingEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {editingEntry.id && entries.some((e) => e.id === editingEntry.id)
                    ? "Editar Movimiento"
                    : "Nuevo Movimiento"}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Libro Mayor · 100% de los campos editables
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white"
              >
                ✕
              </button>
            </div>

            {(editingEntry.source === "bank" ||
              editingEntry.source === "receipt" ||
              editingEntry.source === "trip") && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-2.5 text-xs text-yellow-200">
                <Sparkles className="size-4 shrink-0 text-yellow-400 mt-0.5" />
                <div>
                  <strong className="text-yellow-300">Dato importado / escaneado:</strong>{" "}
                  Puedes corregir o editar cualquier campo con total libertad.
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Tipo de Flujo</label>
                  <select
                    value={editingEntry.type}
                    onChange={(e) => setEditingEntry({ ...editingEntry, type: e.target.value as CashFlowType })}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                  >
                    <option value="income">Entrada / Ingreso (+)</option>
                    <option value="expense">Salida / Gasto (−)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Naturaleza</label>
                  <select
                    value={editingEntry.status}
                    onChange={(e) => setEditingEntry({ ...editingEntry, status: e.target.value as CashFlowStatus })}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                  >
                    <option value="actual">Real (Ejecutado)</option>
                    <option value="projected">Proyectado (Estimado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Descripción</label>
                <input
                  type="text"
                  value={editingEntry.description}
                  onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                  placeholder="Ej: Gasolina Shell, Pago Semanal Uber..."
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Monto ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={editingEntry.amount || ""}
                    onChange={(e) => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Fecha</label>
                  <input
                    type="date"
                    value={editingEntry.date}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Categoría</label>
                  <input
                    type="text"
                    value={editingEntry.category || ""}
                    onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
                    placeholder="Ej: Combustible, Peajes..."
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Fuente / Origen</label>
                  <select
                    value={editingEntry.source}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        source: e.target.value as CashFlowSource,
                        sourceLabel:
                          e.target.value === "bank"
                            ? "Banco"
                            : e.target.value === "receipt"
                              ? "Recibo"
                              : e.target.value === "trip"
                                ? "Viaje"
                                : e.target.value === "projection"
                                  ? "Proyección"
                                  : "Manual",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                  >
                    <option value="manual">Manual</option>
                    <option value="bank">Banco (Extracto / Ajuste)</option>
                    <option value="receipt">Recibo Escaneado</option>
                    <option value="trip">Viaje / DAILY Entry</option>
                    <option value="projection">Proyección Futura</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Etiqueta de Origen</label>
                <input
                  type="text"
                  value={editingEntry.sourceLabel || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, sourceLabel: e.target.value })}
                  placeholder="Ej: Banco Chase, Shell Recibo, Uber Trip..."
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Notas Adicionales</label>
                <textarea
                  rows={2}
                  value={editingEntry.notes || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  placeholder="Detalles opcionales..."
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-neutral-800 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveModal(editingEntry)}
                  className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black hover:bg-yellow-300 shadow-md"
                >
                  Guardar en Libro Mayor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


