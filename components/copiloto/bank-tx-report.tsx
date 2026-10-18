"use client"

import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  categorizeAll,
  learnCorrection,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORY,
  type CategorizedTx,
} from "./auto-categorize"
import { AI_TRANSFER_CATEGORY, patchAIApunte } from "./ai-daily-classification"
import { looksLikeTransfer } from "./transfer-matcher"

// ============================================================================
// REPORTE SEMANAL POR VENDOR — Miguel revisa que la categorización esté bien.
// Semanas pendientes agrupadas por mes. Al verificar una semana, su reporte
// se borra. Las correcciones las aprende la AI para siempre.
// ============================================================================

const VERIFIED_KEY = "claris_report_verified_v1"

function money(n: number): string {
  const v = Number(n) || 0
  const t = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? "-" : ""}$${t}`
}

/** Lunes de la semana de una fecha YYYY-MM-DD (semana lun–dom). */
function mondayOf(dateStr: string): string {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const dow = (dt.getDay() + 6) % 7 // 0 = lunes
  dt.setDate(dt.getDate() - dow)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const p = (x: number) => String(x).padStart(2, "0")
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

function weekLabel(monday: string): string {
  const sun = addDays(monday, 6)
  const [, , d1] = monday.split("-").map(Number)
  const [, m2, d2] = sun.split("-").map(Number)
  return `${d1} – ${d2} ${MESES[m2 - 1]}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return `${MESES_LARGO[m - 1]} ${y}`
}

function loadVerified(): string[] {
  try {
    const raw = localStorage.getItem(VERIFIED_KEY)
    const p = raw ? JSON.parse(raw) : []
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function saveVerified(list: string[]) {
  try {
    localStorage.setItem(VERIFIED_KEY, JSON.stringify(list))
  } catch {}
}

const ALL_CATS = [...EXPENSE_CATEGORIES, INCOME_CATEGORY, AI_TRANSFER_CATEGORY]

function VendorCorrectSheet({
  vendor,
  week,
  txs,
  onSave,
  onClose,
}: {
  vendor: string
  week: string
  txs: CategorizedTx[]
  onSave: (category: string, classification: "business" | "personal") => void
  onClose: () => void
}) {
  const first = txs[0]
  const total = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const [cat, setCat] = useState(first.category)
  const [cls, setCls] = useState<"business" | "personal">(first.classification)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-neutral-700 bg-neutral-950 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-[10px] font-bold tracking-wide text-neutral-500">CORREGIR CATEGORÍA</p>
        <p className="mb-1 truncate text-sm font-bold text-white">{vendor}</p>
        <p className="mb-3 font-mono text-xs text-neutral-400">
          {weekLabel(week)} · {txs.length} movs · {money(total)}
        </p>
        <p className="mb-1.5 text-[10px] font-bold text-neutral-500">CATEGORÍA</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ALL_CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                cat === c
                  ? "border-amber-400/70 bg-amber-400/10 text-amber-300"
                  : "border-neutral-700 text-neutral-400",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mb-1.5 text-[10px] font-bold text-neutral-500">CLASIFICACIÓN</p>
        <div className="mb-4 flex gap-2">
          {(
            [
              { id: "business", label: "NEGOCIO" },
              { id: "personal", label: "PERSONAL" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setCls(o.id)}
              className={cn(
                "flex-1 rounded-2xl border py-2.5 text-xs font-extrabold",
                cls === o.id
                  ? o.id === "business"
                    ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-300"
                    : "border-sky-400/70 bg-sky-400/10 text-sky-300"
                  : "border-neutral-700 text-neutral-500",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onSave(cat, cls)
            onClose()
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3 text-sm font-extrabold text-black"
        >
          <Check className="size-4" /> Guardar
        </button>
      </div>
    </div>
  )
}

type VendorGroup = {
  vendor: string
  txs: CategorizedTx[]
  category: string
  classification: "business" | "personal"
  total: number
  uncategorized: boolean
}

export function BankTxReport() {
  const [txs, setTxs] = useState<{ date: string; detail: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<{ vendor: string; week: string; txs: CategorizedTx[] } | null>(null)
  const [version, setVersion] = useState(0)
  const [verified, setVerified] = useState<string[]>([])
  const [confirmWeek, setConfirmWeek] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)

  useEffect(() => {
    setVerified(loadVerified())
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    fetch("/api/bank/snapshot", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return
        const arr = Array.isArray(d?.transactions) ? d.transactions : []
        setTxs(
          arr.map((t: any) => ({
            date: String(t.date ?? "").slice(0, 10),
            detail: String(t.detail ?? t.bank_account ?? ""),
            amount: Number(t.amount) || 0,
          })),
        )
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const categorized = useMemo(
    () =>
      categorizeAll(txs).map((t) =>
        looksLikeTransfer(t.detail)
          ? { ...t, category: AI_TRANSFER_CATEGORY, classification: "personal" as const, uncategorized: false }
          : t,
      ),
    [txs, version],
  )

  // Semanas pendientes (no verificadas), newest first.
  const weeks = useMemo(() => {
    const map = new Map<string, CategorizedTx[]>()
    for (const t of categorized) {
      if (!t.date) continue
      const wk = mondayOf(t.date)
      if (verified.includes(wk)) continue
      const arr = map.get(wk) ?? []
      arr.push(t)
      map.set(wk, arr)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [categorized, verified])

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const [wk] of weeks) set.add(wk.slice(0, 7))
    return [...set].sort().reverse()
  }, [weeks])

  const activeMonth = month && months.includes(month) ? month : months[0] ?? null

  const weeksInMonth = useMemo(
    () => weeks.filter(([wk]) => wk.slice(0, 7) === activeMonth),
    [weeks, activeMonth],
  )

  function vendorGroups(wkTxs: CategorizedTx[]): VendorGroup[] {
    const map = new Map<string, CategorizedTx[]>()
    for (const t of wkTxs) {
      const arr = map.get(t.vendor) ?? []
      arr.push(t)
      map.set(t.vendor, arr)
    }
    return [...map.entries()]
      .map(([vendor, arr]) => ({
        vendor,
        txs: arr,
        category: arr[0].category,
        classification: arr[0].classification,
        total: arr.reduce((s, x) => s + (Number(x.amount) || 0), 0),
        uncategorized: arr.some((x) => x.uncategorized),
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }

  function handleSave(group: { vendor: string; txs: CategorizedTx[] }, category: string, classification: "business" | "personal") {
    learnCorrection(group.vendor, category, classification)
    for (const t of group.txs) {
      patchAIApunte(`ai:${t.id}`, {
        category,
        ...(category === AI_TRANSFER_CATEGORY ? {} : { classification }),
      })
    }
    setVersion((v) => v + 1)
  }

  function verifyWeek(wk: string) {
    if (confirmWeek !== wk) {
      setConfirmWeek(wk)
      return
    }
    const next = [...verified, wk]
    setVerified(next)
    saveVerified(next)
    setConfirmWeek(null)
  }

  const pendingCount = weeks.length

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-white">
        REPORTE SEMANAL
        {!loading && (
          <span className="ml-auto text-[10px] font-normal text-neutral-500">
            {pendingCount} semana{pendingCount === 1 ? "" : "s"} por revisar
          </span>
        )}
      </p>

      {loading && <p className="py-4 text-center text-xs text-neutral-500">Trayendo movimientos…</p>}
      {error && !loading && (
        <p className="py-4 text-center text-xs text-rose-400">No se pudo traer el banco. Revisa la conexión.</p>
      )}

      {!loading && !error && months.length > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMonth(m)
                setConfirmWeek(null)
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold",
                m === activeMonth
                  ? "border-amber-400/70 bg-amber-400/10 text-amber-300"
                  : "border-neutral-700 text-neutral-400",
              )}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}

      {!loading &&
        !error &&
        weeksInMonth.map(([wk, wkTxs]) => {
          const groups = vendorGroups(wkTxs)
          const noTransfer = wkTxs.filter((t) => t.category !== AI_TRANSFER_CATEGORY)
          const gastos = noTransfer.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
          const ingresos = noTransfer.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
          const confirming = confirmWeek === wk
          return (
            <div key={wk} className="mb-2 overflow-hidden rounded-xl border border-neutral-800">
              <div className="flex items-center gap-2 bg-neutral-950/60 px-2.5 py-2">
                <div className="flex-1">
                  <p className="text-xs font-bold text-neutral-200">{weekLabel(wk)}</p>
                  <p className="font-mono text-[10px] text-neutral-500">
                    <span className="text-rose-400">{money(gastos)}</span>
                    {" · "}
                    <span className="text-emerald-400">{money(ingresos)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => verifyWeek(wk)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold",
                    confirming
                      ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                      : "border-neutral-700 text-neutral-400",
                  )}
                >
                  <Check className="size-3" />
                  {confirming ? "Toca para borrar" : "Verificar"}
                </button>
              </div>
              <div className="divide-y divide-neutral-800/60">
                {groups.map((g) => (
                  <button
                    key={g.vendor}
                    type="button"
                    onClick={() => setEditing({ vendor: g.vendor, week: wk, txs: g.txs })}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left active:bg-neutral-800/40"
                  >
                    <span className="flex-1 truncate text-xs text-neutral-300">
                      {g.vendor}
                      {g.txs.length > 1 && (
                        <span className="ml-1 text-[10px] text-neutral-600">×{g.txs.length}</span>
                      )}
                      {g.uncategorized && <span className="ml-1 text-amber-400">•</span>}
                    </span>
                    <span className="max-w-[38%] shrink-0 truncate rounded-full bg-neutral-800 px-1.5 py-0.5 text-[9px] font-bold text-neutral-400">
                      {g.category}
                    </span>
                    <span
                      className={cn(
                        "w-16 shrink-0 text-right font-mono text-xs font-bold",
                        g.total < 0 ? "text-rose-300" : "text-emerald-300",
                      )}
                    >
                      {money(g.total)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}

      {!loading && !error && weeksInMonth.length === 0 && (
        <p className="py-4 text-center text-xs text-neutral-500">
          {weeks.length === 0 ? "Todo verificado." : "Sin semanas en este mes."}
        </p>
      )}

      {editing && (
        <VendorCorrectSheet
          vendor={editing.vendor}
          week={editing.week}
          txs={editing.txs}
          onClose={() => setEditing(null)}
          onSave={(cat, cls) => handleSave(editing, cat, cls)}
        />
      )}
    </section>
  )
}
