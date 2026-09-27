"use client"

import { useMemo, useRef, useState } from "react"
import { CalendarClock, Camera, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  EXPENSE_CATEGORIES,
  findDuplicateExpense,
  nextOccurrenceDate,
  scheduledEntryFromExpense,
  type Expense,
  type ExpenseClassification,
  type ScheduleFrequency,
  type ScheduledEntry,
  expenseTotal,
  money,
} from "./types"
import { MoneyInput } from "./money-input"

// Pantalla de gastos (pestaña EXPENSES). Mismo estilo que REGISTER y el mismo
// esquema de guardado que los viajes: el padre (copiloto-app) se encarga de
// persistir en localStorage + IndexedDB y de sincronizar.
//
// Además, cada gasto puede programarse con vencimiento y frecuencia: al guardar
// se crea también una entrada en claris_scheduled_entries (el ledger que ve
// FINANCE), para dar seguimiento a los pagos que se repiten. Y se clasifica
// como BUSINESS (deducible) o PERSONAL, manualmente o con la propuesta de la IA.

type Draft = {
  id: string | null
  date: string
  vendor: string
  category: string
  amount: number
  notes: string
  isAiGenerated?: boolean
  // Programación opcional: "once" = gasto único; el resto crea una entrada en
  // el ledger programado con su próxima fecha.
  frequency: ScheduleFrequency
  nextDate: string
  // Clasificación fiscal: business / personal / sin clasificar.
  classification?: ExpenseClassification
}

function emptyDraft(): Draft {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: null,
    date: today,
    vendor: "",
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    notes: "",
    isAiGenerated: false,
    frequency: "once",
    nextDate: today,
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
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold text-sky-400">
            <Sparkles className="size-2.5" /> ESCANEADO
          </span>
        )}
        {expense.isEditedByUser && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400">
            EDITADO
          </span>
        )}
        {expense.scheduled && (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold text-yellow-300">
            <CalendarClock className="size-2.5" /> PROGRAMADO
          </span>
        )}
        {expense.classification === "business" && (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
            💼 BUSINESS
          </span>
        )}
        {expense.classification === "personal" && (
          <span className="rounded-full border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-[9px] font-bold text-neutral-400">
            🏠 PERSONAL
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
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)

  // Categorías personalizadas: si la IA no tiene la categoría correcta, el
  // usuario añade una y queda disponible en el formulario y en el filtro.
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("claris_custom_categories") || "[]")
      return Array.isArray(raw) ? raw.filter((c) => typeof c === "string" && c.trim()) : []
    } catch {
      return []
    }
  })
  const [newCategory, setNewCategory] = useState("")

  function addCustomCategory() {
    const name = newCategory.trim()
    if (!name || name === "__new__") return
    if ([...EXPENSE_CATEGORIES, ...customCategories].some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDraft((d) => (d ? { ...d, category: name } : d))
      setNewCategory("")
      return
    }
    const next = [...customCategories, name]
    setCustomCategories(next)
    try {
      localStorage.setItem("claris_custom_categories", JSON.stringify(next))
    } catch {}
    setDraft((d) => (d ? { ...d, category: name } : d))
    setNewCategory("")
  }

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Redimensionar imagen para reducir payload y acelerar el OCR de Gemini
  async function resizeImage(file: File, maxDim = 1200): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("No se pudo inicializar canvas"))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82)
          resolve({ base64: dataUrl, mimeType: "image/jpeg" })
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsScanning(true)
      setScanStatus("Procesando imagen...")

      const { base64, mimeType } = await resizeImage(file)
      setScanStatus("Analizando con IA...")

      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "No se pudo analizar el recibo")
      }

      const { result } = json
      const scanDate = result.date || new Date().toISOString().slice(0, 10)
      setDraft({
        id: null,
        date: scanDate,
        vendor: result.vendor || "",
        category: result.category || EXPENSE_CATEGORIES[0],
        amount: Number(result.amount) || 0,
        notes: result.notes || "",
        isAiGenerated: true,
        frequency: "once",
        nextDate: scanDate,
      })
      setScanStatus("¡Recibo detectado! Revisa y guarda.")
      setTimeout(() => setScanStatus(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar"
      alert(`Error al escanear recibo: ${msg}`)
      setScanStatus(null)
    } finally {
      setIsScanning(false)
      e.target.value = ""
    }
  }

  function saveDraft() {
    if (!draft) return
    if (!draft.vendor.trim() || !Number.isFinite(draft.amount)) {
      window.alert("Completa el vendedor y el monto.")
      return
    }

    // Antes de guardar: ¿este recibo ya está registrado? Mismo vendedor, misma
    // fecha y mismo monto = el mismo ticket. Se avisa, y el usuario decide si
    // es un gasto legítimo distinto o un escaneo repetido.
    const dup = findDuplicateExpense(draft, expenses)
    if (dup) {
      const msg =
        `⚠️ Posible duplicado:\n\n` +
        `${dup.expense.vendor} · ${dup.expense.date} · ${money(dup.expense.amount)} · ${dup.expense.category}\n\n` +
        `Ya existe un gasto idéntico (vendedor + fecha + monto).\n\n` +
        `"Aceptar" lo guarda igual (¿dos compras iguales el mismo día?)\n` +
        `"Cancelar" no guarda nada.`
      if (!window.confirm(msg)) return
    }

    const expense: Expense = {
      id: draft.id ?? crypto.randomUUID(),
      date: draft.date,
      vendor: draft.vendor.trim(),
      category: draft.category,
      amount: Number(draft.amount) || 0,
      notes: draft.notes.trim() || undefined,
      isAiGenerated: Boolean(draft.isAiGenerated),
      isEditedByUser: draft.id !== null,
      scheduled: ["daily", "weekly", "monthly", "annual"].includes(draft.frequency),
      classification: draft.classification,
      savedAt: new Date().toISOString(),
    }
    onSave(expense)

    // Programación: si el gasto se repite, queda en el ledger que ve FINANCE
    // para dar seguimiento a cada pago con su vencimiento y frecuencia.
    // La guarda de frecuencia protege contra valores inesperados (la UI solo
    // produce los cinco válidos, pero nunca está de más).
    const RECURRING: ScheduleFrequency[] = ["daily", "weekly", "monthly", "annual"]
    if (RECURRING.includes(draft.frequency)) {
      const entry = scheduledEntryFromExpense(expense, draft.frequency, draft.nextDate || expense.date)
      try {
        const existing: ScheduledEntry[] = JSON.parse(localStorage.getItem("claris_scheduled_entries") || "[]")
        if (!Array.isArray(existing)) throw new Error("bad")
        const next = [entry, ...existing]
        localStorage.setItem("claris_scheduled_entries", JSON.stringify(next))
      } catch {
        try {
          localStorage.setItem("claris_scheduled_entries", JSON.stringify([entry]))
        } catch {}
      }
    }
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
      isAiGenerated: ex.isAiGenerated,
      frequency: "once",
      nextDate: ex.date,
      classification: ex.classification,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Inputs ocultos para captura directa de cámara o subida de archivo */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Header + totales + formulario + filtros */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-bold tracking-widest text-neutral-400">EXPENSES</h1>
          {!draft && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning}
                aria-label="Escanear recibo con cámara"
                className="flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-950/40 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-900/50 active:scale-95 disabled:opacity-50"
              >
                {isScanning ? (
                  <Loader2 className="size-3.5 animate-spin text-sky-400" />
                ) : (
                  <Camera className="size-3.5 text-sky-400" />
                )}
                <span>ESCANEAR</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                aria-label="Subir foto de recibo"
                className="flex items-center rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-300 hover:bg-neutral-800 active:scale-95 disabled:opacity-50"
                title="Subir archivo"
              >
                <Upload className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-black active:scale-95"
              >
                <Plus className="size-3.5" /> MANUAL
              </button>
            </div>
          )}
        </div>

        {/* Banner de estado de escaneo */}
        {scanStatus && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-xs font-semibold text-sky-300">
            {isScanning ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Sparkles className="size-3.5 shrink-0 text-yellow-400" />}
            <span>{scanStatus}</span>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <StatCard label="TOTAL GASTOS" value={money(total)} valueClass="text-rose-400" />
          <StatCard label="FILTRADOS" value={money(filteredTotal)} valueClass="text-amber-400" />
          <StatCard label="CANTIDAD" value={String(expenses.length)} valueClass="text-white" />
        </div>

        {/* Formulario (añadir / editar) */}
        {draft && (
          <section className="mt-3 rounded-2xl border border-neutral-700 bg-neutral-900/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-neutral-300">
                  {draft.id ? "EDITAR GASTO" : "NUEVO GASTO"}
                </span>
                {draft.isAiGenerated && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    <Sparkles className="size-2.5" /> DETECTADO POR IA
                  </span>
                )}
              </div>
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
                  {[...EXPENSE_CATEGORIES, ...customCategories].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__new__">＋ Nueva categoría…</option>
                </select>
              </label>
            </div>

            {/* Categoría personalizada: si la IA no tiene la correcta, se añade */}
            {draft.category === "__new__" && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nombre de la categoría nueva"
                  className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  className="shrink-0 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-bold text-black"
                >
                  Añadir
                </button>
              </div>
            )}

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

            {/* Clasificación fiscal: negocio (deducible) o personal */}
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-neutral-400">CLASIFICACIÓN</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["business", "💼 Negocio"],
                    ["personal", "🏠 Personal"],
                    ["", "Sin clasificar"],
                  ] as [ExpenseClassification | "", string][]
                ).map(([value, label]) => (
                  <button
                    key={value || "none"}
                    type="button"
                    onClick={() => setDraft({ ...draft, classification: value || undefined })}
                    className={cn(
                      "rounded-xl border py-2 text-[10px] font-bold",
                      (draft.classification ?? "") === value
                        ? value === "business"
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                          : value === "personal"
                            ? "border-neutral-500 bg-neutral-700/40 text-neutral-300"
                            : "border-neutral-500 bg-neutral-700/40 text-neutral-300"
                        : "border-neutral-800 text-neutral-500",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Programación del pago: vencimiento y frecuencia */}
            <div className="mt-2 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-2.5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-yellow-300/90">
                <CalendarClock className="size-3.5" /> ¿SE REPITE ESTE PAGO?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={draft.frequency}
                  onChange={(e) => {
                    const freq = e.target.value as ScheduleFrequency
                    setDraft({
                      ...draft,
                      frequency: freq,
                      // Al elegir frecuencia, la próxima fecha se calcula desde hoy
                      // o desde la fecha del gasto, la posterior.
                      nextDate: freq === "once" ? draft.date : nextOccurrenceDate(draft.date || draft.nextDate, freq),
                    })
                  }}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="once">Una vez</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
                {draft.frequency === "once" ? (
                  <div className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 text-[11px] text-neutral-400">
                    Vence el día del gasto ({draft.date})
                  </div>
                ) : (
                  <input
                    type="date"
                    value={draft.nextDate}
                    onChange={(e) => setDraft({ ...draft, nextDate: e.target.value })}
                    aria-label="Próximo vencimiento"
                    className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                  />
                )}
              </div>
              {draft.frequency !== "once" && (
                <p className="mt-1.5 text-[10px] leading-tight text-neutral-500">
                  Se guardará en el ledger programado de FINANCE y repetirá cada{" "}
                  {draft.frequency === "daily" ? "día" : draft.frequency === "weekly" ? "semana" : draft.frequency === "monthly" ? "mes" : "año"}.
                </p>
              )}
            </div>

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
            {[...EXPENSE_CATEGORIES, ...customCategories].map((c) => (
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