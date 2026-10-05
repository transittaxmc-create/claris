"use client"

// ============================================================================
// REGISTRO BANCARIO
//
// Un solo registro limpio, pensado para el teléfono:
//  - Varias cuentas bancarias (2, 3, 4...) con su balance cada una.
//  - Balance REAL (lo que el banco dice) y balance PROYECTADO (real + futuro).
//  - Un solo botón "+" para añadir: manual, foto del banco (AI), recibo (AI)
//    o ingreso/gasto recurrente (una vez, diario, semanal, mensual, anual).
//  - La foto del banco la lee la AI y propone movimientos; tú confirmas.
//    Los duplicados entre fotos se omiten solos (id determinista).
//  - Todo editable. Vista completa imprimible en PDF.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/dates"
import type { BankAccount, CashFlowEntry, CashFlowType, RecurringRule, ScheduleFrequency } from "./types"
import { newBankAccount, normalizeVendorName, expandRecurringRule } from "./types"
import {
  leerLibroMayor,
  guardarMovimiento,
  leerCuentas,
  guardarCuenta,
  CUENTAS_KEY,
  LEDGER_KEY,
  leerReglas,
  crearRegla,
  eliminarRegla,
  alternarRegla,
  movimientoDeBanco,
} from "./cash-flow-store"
import {
  Plus,
  Camera,
  ReceiptText,
  Repeat,
  Pencil,
  Trash2,
  Printer,
  X,
  Check,
  Landmark,
  ChevronDown,
} from "lucide-react"

const money = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`
const todayIso = () => localDateKey(new Date())
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-US", { weekday: "short", day: "numeric", month: "short" })

const FREQS: { key: ScheduleFrequency; label: string }[] = [
  { key: "once", label: "Una vez" },
  { key: "daily", label: "Diaria" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensual" },
  { key: "annual", label: "Anual" },
]

type SheetKind = null | "add" | "manual" | "recurring" | "import" | "edit" | "account" | "openings"

type ImportRow = {
  date: string
  description: string
  amount: number
  type: "income" | "expense"
  category: string
  dup: boolean // id exacto ya existe
  maybeDup: boolean // posible duplicado de recibo (fecha+monto+palabra)
  checked: boolean
}

function tokens(s: string): string[] {
  return normalizeVendorName(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
}

// ¿Este renglón importado podría ser el mismo que un recibo ya guardado?
function posibleDuplicadoDeRecibo(
  row: { date: string; description: string; amount: number },
  entries: CashFlowEntry[],
): boolean {
  const toks = new Set(tokens(row.description))
  if (toks.size === 0) return false
  const cents = Math.round(row.amount * 100)
  return entries.some(
    (e) =>
      (e.source === "receipt" || e.source === "manual") &&
      e.date === row.date &&
      Math.abs(Math.round(e.amount * 100) - cents) <= 1 &&
      tokens(e.description).some((t) => toks.has(t)),
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function CashFlowRegister({
  startingActualBalance,
  onUpdateStartingBalance,
}: {
  startingActualBalance: number
  onUpdateStartingBalance?: (newBal: number) => void
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [activeAccount, setActiveAccount] = useState<string>("all")
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState("")
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importKind, setImportKind] = useState<"bank" | "receipt">("bank")
  const [importAccountId, setImportAccountId] = useState<string>("")
  const [editing, setEditing] = useState<CashFlowEntry | null>(null)
  const [confirmMsg, setConfirmMsg] = useState("")

  // Formularios
  const [mDesc, setMDesc] = useState("")
  const [mAmount, setMAmount] = useState("")
  const [mType, setMType] = useState<CashFlowType>("expense")
  const [mDate, setMDate] = useState(todayIso())
  const [mCat, setMCat] = useState("")

  const [rKind, setRKind] = useState<"income" | "expense">("expense")
  const [rDesc, setRDesc] = useState("")
  const [rAmount, setRAmount] = useState("")
  const [rFreq, setRFreq] = useState<ScheduleFrequency>("monthly")
  const [rStart, setRStart] = useState(todayIso())
  const [rEnd, setREnd] = useState("")

  const [aName, setAName] = useState("")
  const [aLast4, setALast4] = useState("")
  const [aOpening, setAOpening] = useState("")

  const bankInput = useRef<HTMLInputElement>(null)
  const receiptInput = useRef<HTMLInputElement>(null)

  // ---------- Carga + migración ----------
  useEffect(() => {
    let accs = leerCuentas()
    if (accs.length === 0) {
      const def: BankAccount = { ...newBankAccount("Banco principal"), openingBalance: Number(startingActualBalance) || 0 }
      accs = [def]
      try {
        localStorage.setItem(CUENTAS_KEY, JSON.stringify(accs))
      } catch {}
    }
    const defId = accs[0].id
    const raw = leerLibroMayor()
    let changed = false
    const fixed = raw.map((e) => {
      if (!e.accountId) {
        changed = true
        return { ...e, accountId: defId }
      }
      return e
    })
    if (changed) {
      try {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(fixed))
      } catch {}
    }
    setAccounts(accs)
    setEntries(fixed)
    setRules(leerReglas())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = () => {
    setEntries(leerLibroMayor())
    setRules(leerReglas())
    setAccounts(leerCuentas())
  }

  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name || "—"

  // ---------- Balances ----------
  const { realBalance, projectedBalance, rows } = useMemo(() => {
    const inScope = (e: CashFlowEntry) => activeAccount === "all" || e.accountId === activeAccount
    const opening =
      activeAccount === "all"
        ? accounts.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0)
        : Number(accounts.find((a) => a.id === activeAccount)?.openingBalance) || 0

    const actuals = entries.filter((e) => e.status === "actual" && inScope(e))
    const storedProjected = entries.filter((e) => e.status === "projected" && inScope(e))

    const from = localDateKey(new Date(Date.now() - 90 * 864e5))
    const to = localDateKey(new Date(Date.now() + 365 * 864e5))
    const ruleEntries = rules
      .filter((r) => r.active && (activeAccount === "all" || !r.accountId || r.accountId === activeAccount))
      .flatMap((r) => expandRecurringRule(r, from, to))

    const net = (list: CashFlowEntry[]) =>
      list.reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0)

    const real = opening + net(actuals)
    const futureProjected = [...storedProjected, ...ruleEntries].filter((e) => e.date >= todayIso())
    const projected = real + net(futureProjected)

    const listRows = [...actuals, ...storedProjected, ...ruleEntries.filter((e) => e.date >= from)]
    listRows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    const chrono = [...listRows].sort((a, b) => (a.date < b.date ? -1 : 1))
    let run = opening
    const runMap = new Map<string, number>()
    for (const e of chrono) {
      run += e.type === "income" ? e.amount : -e.amount
      runMap.set(e.id, run)
    }

    return {
      realBalance: real,
      projectedBalance: projected,
      rows: listRows.map((e) => ({ e, run: runMap.get(e.id) ?? 0 })),
    }
  }, [entries, rules, accounts, activeAccount])

  // ---------- Acciones ----------
  const closeSheet = () => {
    setSheet(null)
    setScanError("")
  }

  const saveManual = () => {
    const amount = Number(mAmount)
    if (!mDesc.trim() || !(amount > 0)) return
    const accId = activeAccount === "all" ? accounts[0]?.id : activeAccount
    guardarMovimiento({
      id: `claris:manual:${Date.now()}`,
      date: mDate,
      description: mDesc.trim(),
      source: "manual",
      sourceLabel: "Manual",
      type: mType,
      status: "actual",
      amount: Math.round(amount * 100) / 100,
      category: mCat.trim() || undefined,
      accountId: accId,
      createdAt: new Date().toISOString(),
    })
    setMDesc("")
    setMAmount("")
    setMCat("")
    setMDate(todayIso())
    refresh()
    closeSheet()
  }

  const saveRecurring = () => {
    const amount = Number(rAmount)
    if (!rDesc.trim() || !(amount > 0)) return
    const accId = activeAccount === "all" ? accounts[0]?.id : activeAccount
    crearRegla({
      kind: rKind,
      description: rDesc.trim(),
      amount: Math.round(amount * 100) / 100,
      frequency: rFreq,
      startDate: rStart,
      endDate: rEnd || undefined,
      accountId: accId,
    })
    setRDesc("")
    setRAmount("")
    setREnd("")
    setRStart(todayIso())
    refresh()
    setRulesOpen(true)
    closeSheet()
  }

  const saveAccount = () => {
    if (!aName.trim()) return
    const next = guardarCuenta(aName.trim(), aLast4)
    const created = next[next.length - 1]
    if (created && aOpening) {
      created.openingBalance = Number(aOpening) || 0
      try {
        localStorage.setItem(CUENTAS_KEY, JSON.stringify(next))
      } catch {}
    }
    setAccounts(next)
    setAName("")
    setALast4("")
    setAOpening("")
    closeSheet()
  }

  const saveEdit = () => {
    if (!editing) return
    guardarMovimiento({ ...editing, isManuallyEdited: true })
    setEditing(null)
    refresh()
    closeSheet()
  }

  const deleteEditing = () => {
    if (!editing) return
    if (!confirm("¿Borrar este movimiento?")) return
    try {
      const raw = leerLibroMayor().filter((e) => e.id !== editing.id)
      localStorage.setItem(LEDGER_KEY, JSON.stringify(raw))
    } catch {}
    setEditing(null)
    refresh()
    closeSheet()
  }

  const saveOpenings = (id: string, value: string) => {
    const next = accounts.map((a) => (a.id === id ? { ...a, openingBalance: Number(value) || 0 } : a))
    try {
      localStorage.setItem(CUENTAS_KEY, JSON.stringify(next))
    } catch {}
    setAccounts(next)
    if (onUpdateStartingBalance) {
      onUpdateStartingBalance(next.reduce((s, a) => s + (Number(a.openingBalance) || 0), 0))
    }
  }

  // ---------- Importación por foto ----------
  const pickPhoto = (kind: "bank" | "receipt") => {
    setSheet(null)
    setScanError("")
    if (kind === "bank") bankInput.current?.click()
    else receiptInput.current?.click()
  }

  const handlePhoto = async (file: File, kind: "bank" | "receipt") => {
    setScanning(true)
    setScanError("")
    try {
      const b64 = await fileToBase64(file)
      const endpoint = kind === "bank" ? "/api/scan-transactions" : "/api/scan-receipt"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, mimeType: file.type || "image/jpeg" }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || "La AI no pudo leer la foto")

      const accId = activeAccount === "all" ? accounts[0]?.id || "" : activeAccount
      setImportAccountId(accId)
      setImportKind(kind)

      if (kind === "bank") {
        const list = (json.transactions || []) as Array<{
          date: string
          description: string
          amount: number
          type: string
          category: string
        }>
        const existingIds = new Set(entries.map((e) => e.id))
        const rows: ImportRow[] = list.map((t) => {
          const cand = movimientoDeBanco(accId, {
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type === "income" ? "income" : "expense",
            category: t.category,
          })
          const dup = existingIds.has(cand.id)
          return {
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type === "income" ? "income" : "expense",
            category: t.category || "Otro",
            dup,
            maybeDup: !dup && posibleDuplicadoDeRecibo(t, entries),
            checked: !dup,
          }
        })
        if (rows.length === 0) throw new Error("No se encontraron movimientos en la foto")
        setImportRows(rows)
      } else {
        const r = json.receipt || json
        const vendor = String(r.vendor || r.comercio || "Recibo")
        const amount = Number(r.amount ?? r.total ?? 0)
        if (!(amount > 0)) throw new Error("No se pudo leer el monto del recibo")
        const rdate = String(r.date || r.fecha || todayIso()).slice(0, 10)
        const row: ImportRow = {
          date: rdate,
          description: vendor,
          amount: Math.round(amount * 100) / 100,
          type: "expense",
          category: String(r.category || r.categoria || "Otro"),
          dup: false,
          maybeDup: posibleDuplicadoDeRecibo({ date: rdate, description: vendor, amount }, entries),
          checked: true,
        }
        setImportRows([row])
      }
      setSheet("import")
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "No se pudo leer la foto")
    } finally {
      setScanning(false)
    }
  }

  const confirmImport = () => {
    const accId = importAccountId || accounts[0]?.id || ""
    let nuevas = 0
    let omitidas = 0
    for (const row of importRows) {
      if (!row.checked) {
        omitidas++
        continue
      }
      const mov = movimientoDeBanco(accId, {
        date: row.date,
        description: row.description,
        amount: row.amount,
        type: row.type,
        category: row.category,
      })
      if (importKind === "receipt") {
        mov.source = "receipt"
        mov.sourceLabel = "Recibo"
      }
      const before = leerLibroMayor().length
      guardarMovimiento(mov)
      // upsert: si el id ya existía, la lista no crece
      if (leerLibroMayor().length > before) nuevas++
      else omitidas++
    }
    refresh()
    setSheet(null)
    setImportRows([])
    setConfirmMsg(`${nuevas} nueva${nuevas === 1 ? "" : "s"} · ${omitidas} duplicada${omitidas === 1 ? "" : "s"} omitida${omitidas === 1 ? "" : "s"}`)
    setTimeout(() => setConfirmMsg(""), 4000)
  }

  const sheetTitle: Record<Exclude<SheetKind, null>, string> = {
    add: "Añadir al registro",
    manual: "Movimiento manual",
    recurring: "Ingreso / gasto recurrente",
    import: importKind === "bank" ? "Revisar movimientos" : "Revisar recibo",
    edit: "Editar movimiento",
    account: "Nueva cuenta",
    openings: "Saldos iniciales",
  }

  return (
    <div className="space-y-3 print:hidden">
      <input
        ref={bankInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handlePhoto(f, "bank")
          e.target.value = ""
        }}
      />
      <input
        ref={receiptInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handlePhoto(f, "receipt")
          e.target.value = ""
        }}
      />

      {/* Cuentas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setActiveAccount("all")}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition",
            activeAccount === "all" ? "bg-yellow-400 text-black" : "bg-neutral-900 text-neutral-400 border border-neutral-800",
          )}
        >
          Todas
        </button>
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setActiveAccount(a.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition",
              activeAccount === a.id ? "bg-yellow-400 text-black" : "bg-neutral-900 text-neutral-400 border border-neutral-800",
            )}
          >
            {a.name}
            {a.last4 ? ` •${a.last4}` : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSheet("account")}
          aria-label="Añadir cuenta"
          className="shrink-0 rounded-full border border-dashed border-neutral-700 px-3 py-1.5 text-xs font-bold text-neutral-400"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Dos balances */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSheet("openings")}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-left"
        >
          <p className="text-[10px] font-bold tracking-wider text-emerald-400/80">BALANCE REAL</p>
          <p className="mt-0.5 truncate text-xl font-extrabold text-emerald-300">{money(realBalance)}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
            <Pencil className="size-2.5" /> Lo que el banco dice
          </p>
        </button>
        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-3">
          <p className="text-[10px] font-bold tracking-wider text-sky-400/80">PROYECTADO</p>
          <p className="mt-0.5 truncate text-xl font-extrabold text-sky-300">{money(projectedBalance)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">Real + programado a futuro</p>
        </div>
      </div>

      {/* Acciones: solo dos botones */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSheet("add")}
          disabled={scanning}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-yellow-400 py-3 text-sm font-extrabold text-black active:scale-[0.99] disabled:opacity-60"
        >
          <Plus className="size-4" /> {scanning ? "Leyendo foto…" : "Añadir"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Ver completo e imprimir"
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-300"
        >
          <Printer className="size-4" /> PDF
        </button>
      </div>
      {scanError && <p className="text-xs font-semibold text-rose-400">{scanError}</p>}
      {confirmMsg && <p className="text-xs font-semibold text-emerald-400">{confirmMsg}</p>}

      {/* Programados */}
      <button
        type="button"
        onClick={() => setRulesOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-neutral-300">
          <Repeat className="size-3.5 text-amber-400" />
          Programados
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
            {rules.filter((r) => r.active).length}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-neutral-500 transition-transform", rulesOpen && "rotate-180")} />
      </button>
      {rulesOpen && (
        <div className="space-y-1.5">
          {rules.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-800 px-3 py-3 text-center text-[11px] text-neutral-600">
              Nada programado. Usa “Añadir” → “Recurrente”.
            </p>
          )}
          {rules.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2",
                r.active ? "border-neutral-800 bg-neutral-900/60" : "border-neutral-800/60 bg-neutral-900/30 opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  alternarRegla(r.id)
                  refresh()
                }}
                aria-label={r.active ? "Pausar" : "Activar"}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  r.active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-neutral-700 text-neutral-500",
                )}
              >
                {r.active ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{r.description}</p>
                <p className="text-[10px] text-neutral-500">
                  {FREQS.find((f) => f.key === r.frequency)?.label}
                  {" · "}desde {dayLabel(r.startDate)}
                  {r.endDate ? ` hasta ${dayLabel(r.endDate)}` : ""}
                  {r.accountId ? ` · ${accountName(r.accountId)}` : ""}
                </p>
              </div>
              <span className={cn("shrink-0 text-xs font-extrabold", r.kind === "income" ? "text-emerald-400" : "text-rose-300")}>
                {r.kind === "income" ? "+" : "−"}{money(r.amount).replace("−", "")}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Borrar esta programación?")) {
                    eliminarRegla(r.id)
                    refresh()
                  }
                }}
                aria-label="Borrar programación"
                className="shrink-0 rounded-lg p-1.5 text-neutral-600 hover:text-rose-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Movimientos */}
      <div className="space-y-1">
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-neutral-800 px-4 py-8 text-center text-xs text-neutral-600">
            Sin movimientos. Toca “Añadir” o toma una foto de tu banco.
          </p>
        )}
        {rows.slice(0, 120).map(({ e, run }) => {
          const projected = e.status === "projected"
          const fromRule = e.id.startsWith("claris:regla:")
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                if (fromRule) {
                  setRulesOpen(true)
                  return
                }
                setEditing({ ...e })
                setSheet("edit")
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left",
                projected ? "border-dashed border-amber-500/30 bg-amber-950/10" : "border-neutral-800/80 bg-neutral-900/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{e.description}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
                  <span className="capitalize">{dayLabel(e.date)}</span>
                  {activeAccount === "all" && e.accountId && <span>· {accountName(e.accountId)}</span>}
                  {projected && <span className="rounded bg-amber-500/15 px-1 font-bold text-amber-400">Proy.</span>}
                  {fromRule && <Repeat className="size-2.5 text-amber-500" />}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("text-xs font-extrabold", e.type === "income" ? "text-emerald-400" : "text-rose-300")}>
                  {e.type === "income" ? "+" : "−"}{money(e.amount).replace("−", "")}
                </p>
                <p className="text-[10px] tabular-nums text-neutral-500">{money(run)}</p>
              </div>
            </button>
          )
        })}
        {rows.length > 120 && (
          <p className="py-2 text-center text-[11px] text-neutral-600">
            Mostrando los 120 más recientes · usa el PDF para verlos todos
          </p>
        )}
      </div>

      {/* Hoja inferior */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0" onClick={closeSheet}>
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-neutral-800 bg-neutral-950 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white">{sheetTitle[sheet]}</h3>
              <button type="button" onClick={closeSheet} aria-label="Cerrar" className="rounded-full bg-neutral-900 p-1.5 text-neutral-400">
                <X className="size-4" />
              </button>
            </div>

            {sheet === "add" && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { k: "manual", icon: Pencil, label: "Manual", desc: "Escribirlo" },
                    { k: "bank", icon: Camera, label: "Foto del banco", desc: "La AI lo lee" },
                    { k: "receipt", icon: ReceiptText, label: "Recibo", desc: "Foto del ticket" },
                    { k: "recurring", icon: Repeat, label: "Recurrente", desc: "Programar" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => {
                      if (o.k === "manual") {
                        setMDate(todayIso())
                        setSheet("manual")
                      } else if (o.k === "recurring") {
                        setRStart(todayIso())
                        setSheet("recurring")
                      } else {
                        pickPhoto(o.k)
                      }
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-4 active:scale-[0.98]"
                  >
                    <o.icon className="size-5 text-yellow-400" />
                    <span className="text-xs font-extrabold text-white">{o.label}</span>
                    <span className="text-[10px] text-neutral-500">{o.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {sheet === "manual" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {(["expense", "income"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMType(t)}
                      className={cn(
                        "rounded-xl border py-2 text-xs font-extrabold",
                        mType === t
                          ? t === "income"
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                            : "border-rose-500 bg-rose-500/15 text-rose-300"
                          : "border-neutral-800 text-neutral-500",
                      )}
                    >
                      {t === "income" ? "Entrada" : "Salida"}
                    </button>
                  ))}
                </div>
                <input
                  value={mDesc}
                  onChange={(e) => setMDesc(e.target.value)}
                  placeholder="Descripción (ej. Shell gasolina)"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={mAmount}
                    onChange={(e) => setMAmount(e.target.value)}
                    placeholder="Monto"
                    type="number"
                    inputMode="decimal"
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                  />
                  <input
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                    type="date"
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                  />
                </div>
                <input
                  value={mCat}
                  onChange={(e) => setMCat(e.target.value)}
                  placeholder="Categoría (opcional)"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                />
                <button
                  type="button"
                  onClick={saveManual}
                  disabled={!mDesc.trim() || !(Number(mAmount) > 0)}
                  className="w-full rounded-2xl bg-yellow-400 py-3 text-sm font-extrabold text-black disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            )}

            {sheet === "recurring" && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {(["expense", "income"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRKind(t)}
                      className={cn(
                        "rounded-xl border py-2 text-xs font-extrabold",
                        rKind === t
                          ? t === "income"
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                            : "border-rose-500 bg-rose-500/15 text-rose-300"
                          : "border-neutral-800 text-neutral-500",
                      )}
                    >
                      {t === "income" ? "Ingreso" : "Gasto"}
                    </button>
                  ))}
                </div>
                <input
                  value={rDesc}
                  onChange={(e) => setRDesc(e.target.value)}
                  placeholder={rKind === "income" ? "Ej. Hoy me gano 400" : "Ej. Renta del carro"}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                />
                <input
                  value={rAmount}
                  onChange={(e) => setRAmount(e.target.value)}
                  placeholder="Monto"
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                />
                <p className="text-[11px] font-bold text-neutral-500">FRECUENCIA</p>
                <div className="flex flex-wrap gap-1.5">
                  {FREQS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setRFreq(f.key)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-bold",
                        rFreq === f.key ? "bg-yellow-400 text-black" : "border border-neutral-800 text-neutral-400",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-neutral-500">DESDE</span>
                    <input
                      value={rStart}
                      onChange={(e) => setRStart(e.target.value)}
                      type="date"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-neutral-500">HASTA</span>
                    <input
                      value={rEnd}
                      onChange={(e) => setREnd(e.target.value)}
                      type="date"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                    />
                  </label>
                </div>
                {rFreq !== "once" && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        setREnd(localDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)))
                      }}
                      className="flex-1 rounded-full border border-neutral-800 py-1.5 text-[11px] font-bold text-neutral-400"
                    >
                      Fin de mes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        setREnd(localDateKey(new Date(d.getFullYear(), 11, 31)))
                      }}
                      className="flex-1 rounded-full border border-neutral-800 py-1.5 text-[11px] font-bold text-neutral-400"
                    >
                      Fin de año
                    </button>
                    <button
                      type="button"
                      onClick={() => setREnd("")}
                      className="flex-1 rounded-full border border-neutral-800 py-1.5 text-[11px] font-bold text-neutral-400"
                    >
                      Sin fin (12 m.)
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={saveRecurring}
                  disabled={!rDesc.trim() || !(Number(rAmount) > 0)}
                  className="w-full rounded-2xl bg-yellow-400 py-3 text-sm font-extrabold text-black disabled:opacity-40"
                >
                  Programar
                </button>
              </div>
            )}

            {sheet === "import" && (
              <div className="space-y-2">
                <p className="text-[11px] text-neutral-500">
                  La AI leyó {importRows.length}. Revisa y confirma: lo duplicado se omite solo.
                </p>
                <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
                  {importRows.map((row, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={row.dup}
                      onClick={() => setImportRows((rs) => rs.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r)))}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left",
                        row.dup ? "border-neutral-800 bg-neutral-900/40 opacity-50" : "border-neutral-800 bg-neutral-900/70",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border",
                          row.checked && !row.dup ? "border-yellow-400 bg-yellow-400 text-black" : "border-neutral-700 text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-white">{row.description}</span>
                        <span className="block text-[10px] text-neutral-500">
                          {dayLabel(row.date)}
                          {row.dup && <span className="ml-1 font-bold text-neutral-500">· ya está</span>}
                          {!row.dup && row.maybeDup && <span className="ml-1 font-bold text-amber-400">· ¿duplicado de recibo?</span>}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-xs font-extrabold", row.type === "income" ? "text-emerald-400" : "text-rose-300")}>
                        {row.type === "income" ? "+" : "−"}{money(row.amount).replace("−", "")}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={!importRows.some((r) => r.checked && !r.dup)}
                  className="w-full rounded-2xl bg-yellow-400 py-3 text-sm font-extrabold text-black disabled:opacity-40"
                >
                  Confirmar ({importRows.filter((r) => r.checked && !r.dup).length})
                </button>
              </div>
            )}

            {sheet === "edit" && editing && (
              <div className="space-y-2.5">
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editing.amount || ""}
                    onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) || 0 })}
                    type="number"
                    inputMode="decimal"
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                  />
                  <input
                    value={editing.date}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    type="date"
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value as CashFlowType })}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="expense">Salida</option>
                    <option value="income">Entrada</option>
                  </select>
                  <select
                    value={editing.accountId || ""}
                    onChange={(e) => setEditing({ ...editing, accountId: e.target.value || undefined })}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={deleteEditing}
                    className="flex items-center justify-center gap-1 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="flex-1 rounded-2xl bg-yellow-400 py-3 text-sm font-extrabold text-black"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {sheet === "account" && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 rounded-xl bg-neutral-900/60 px-3 py-2 text-[11px] text-neutral-500">
                  <Landmark className="size-4 text-neutral-500" />
                  Ej. Chase, TD Bank, Capital One…
                </div>
                <input
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                  placeholder="Nombre del banco"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={aLast4}
                    onChange={(e) => setALast4(e.target.value)}
                    placeholder="Últimos 4 (opcional)"
                    inputMode="numeric"
                    maxLength={4}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                  />
                  <input
                    value={aOpening}
                    onChange={(e) => setAOpening(e.target.value)}
                    placeholder="Saldo inicial"
                    type="number"
                    inputMode="decimal"
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-yellow-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveAccount}
                  disabled={!aName.trim()}
                  className="w-full rounded-2xl bg-yellow-400 py-3 text-sm font-extrabold text-black disabled:opacity-40"
                >
                  Añadir cuenta
                </button>
              </div>
            )}

            {sheet === "openings" && (
              <div className="space-y-2">
                <p className="text-[11px] text-neutral-500">Punto de partida del balance real de cada cuenta.</p>
                {accounts.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
                      {a.name}{a.last4 ? ` •${a.last4}` : ""}
                    </span>
                    <span className="text-neutral-500">$</span>
                    <input
                      defaultValue={a.openingBalance || ""}
                      onBlur={(e) => saveOpenings(a.id, e.target.value)}
                      placeholder="0"
                      type="number"
                      inputMode="decimal"
                      className="w-28 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-right text-sm font-bold text-white outline-none focus:border-yellow-400"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vista de impresión: el registro completo */}
      <div className="hidden print:block print:bg-white print:p-6 print:text-black">
        <h1 className="text-xl font-bold">Registro bancario</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {activeAccount === "all" ? "Todas las cuentas" : accountName(activeAccount)} · {new Date().toLocaleDateString("es-US")}
        </p>
        <div className="mt-3 flex gap-6">
          <div>
            <p className="text-xs uppercase text-neutral-500">Balance real</p>
            <p className="text-lg font-extrabold">{money(realBalance)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500">Balance proyectado</p>
            <p className="text-lg font-extrabold">{money(projectedBalance)}</p>
          </div>
        </div>
        <table className="mt-4 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 pr-2 font-bold">Fecha</th>
              <th className="py-2 pr-2 font-bold">Descripción</th>
              <th className="py-2 pr-2 font-bold">Cuenta</th>
              <th className="py-2 pr-2 text-right font-bold">Entrada</th>
              <th className="py-2 pr-2 text-right font-bold">Salida</th>
              <th className="py-2 text-right font-bold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, run }) => (
              <tr key={e.id} className="border-b border-neutral-300">
                <td className="whitespace-nowrap py-1.5 pr-2">{e.date}</td>
                <td className="py-1.5 pr-2">
                  {e.description}
                  {e.status === "projected" ? " (proy.)" : ""}
                </td>
                <td className="py-1.5 pr-2">{accountName(e.accountId)}</td>
                <td className="py-1.5 pr-2 text-right">{e.type === "income" ? money(e.amount) : "—"}</td>
                <td className="py-1.5 pr-2 text-right">{e.type === "expense" ? money(e.amount) : "—"}</td>
                <td className="py-1.5 text-right font-bold">{money(run)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
