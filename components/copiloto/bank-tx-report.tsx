"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, RefreshCw, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  categorizeAll,
  groupByCategory,
  learnCorrection,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORY,
  type CategorizedTx,
} from "./auto-categorize"
import { AI_TRANSFER_CATEGORY, patchAIApunte } from "./ai-daily-classification"
import { looksLikeTransfer } from "./transfer-matcher"

function money(n: number): string {
  const v = Number(n) || 0
  const t = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? "-" : ""}$${t}`
}

const ALL_CATS = [...EXPENSE_CATEGORIES, INCOME_CATEGORY, AI_TRANSFER_CATEGORY]

function CorrectSheet({
  tx,
  onSave,
  onClose,
}: {
  tx: CategorizedTx
  onSave: (category: string, classification: "business" | "personal") => void
  onClose: () => void
}) {
  const [cat, setCat] = useState(tx.category)
  const [cls, setCls] = useState<"business" | "personal">(tx.classification)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-neutral-700 bg-neutral-950 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-[10px] font-bold tracking-wide text-neutral-500">CORREGIR CATEGORÍA</p>
        <p className="mb-1 truncate text-sm font-bold text-white">{tx.vendor}</p>
        <p className="mb-3 font-mono text-xs text-neutral-400">
          {tx.date} · {money(tx.amount)}
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

export function BankTxReport() {
  const [txs, setTxs] = useState<{ date: string; detail: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<CategorizedTx | null>(null)
  const [version, setVersion] = useState(0) // para refrescar tras correcciones
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

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
        // Regla de transfers: una transferencia interna (Zelle, etc.) JAMÁS
        // se reporta como ingreso — es el mismo dólar movido entre cuentas.
        looksLikeTransfer(t.detail)
          ? { ...t, category: AI_TRANSFER_CATEGORY, classification: "personal" as const, uncategorized: false }
          : t,
      ),
    [txs, version],
  )
  const groups = useMemo(() => groupByCategory(categorized), [categorized])
  const uncatCount = useMemo(() => categorized.filter((t) => t.uncategorized).length, [categorized])

  function handleSave(tx: CategorizedTx, category: string, classification: "business" | "personal") {
    // 1) La AI aprende la corrección de Miguel para siempre.
    learnCorrection(tx.vendor, category, classification)
    // 2) El apunte ya creado en el libro se corrige AHORA (mismo id "ai:…").
    patchAIApunte(`ai:${tx.id}`, {
      category,
      ...(category === AI_TRANSFER_CATEGORY ? {} : { classification }),
    })
    setVersion((v) => v + 1)
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-white">
        <Sparkles className="size-3.5 text-amber-300" /> AI · CLASIFICACIÓN DIARIA
        {loading ? null : (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-neutral-500">
            {categorized.length} movs
            {uncatCount > 0 && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-bold text-amber-300">
                {uncatCount} sin categorizar
              </span>
            )}
          </span>
        )}
      </p>

      {loading && <p className="py-4 text-center text-xs text-neutral-500">Trayendo movimientos…</p>}
      {error && !loading && (
        <p className="py-4 text-center text-xs text-rose-400">No se pudo traer el banco. Revisa la conexión.</p>
      )}

      {!loading &&
        !error &&
        groups.map((g) => {
          const open = openGroups[g.category] ?? g.category === "Other / Varios"
          return (
            <div key={g.category} className="mb-2 overflow-hidden rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setOpenGroups((o) => ({ ...o, [g.category]: !open }))}
                className="flex w-full items-center gap-2 bg-neutral-950/60 px-2.5 py-2 text-left"
              >
                <span className="flex-1 truncate text-xs font-bold text-neutral-200">{g.category}</span>
                <span className="text-[10px] text-neutral-500">{g.items.length}</span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold",
                    g.total < 0 ? "text-rose-400" : "text-emerald-400",
                  )}
                >
                  {money(g.total)}
                </span>
                <span className="text-[10px] text-neutral-600">{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div className="divide-y divide-neutral-800/60">
                  {g.items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditing(t)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left active:bg-neutral-800/40"
                    >
                      <span className="w-14 shrink-0 text-[10px] text-neutral-500">{t.date.slice(5)}</span>
                      <span className="flex-1 truncate text-xs text-neutral-300">{t.vendor}</span>
                      {t.learned && (
                        <span className="shrink-0 rounded-full bg-violet-400/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-300">
                          APRENDIDA
                        </span>
                      )}
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                          t.classification === "business"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-sky-400/15 text-sky-300",
                        )}
                      >
                        {t.classification === "business" ? "NEG" : "PER"}
                      </span>
                      <span
                        className={cn(
                          "w-16 shrink-0 text-right font-mono text-xs font-bold",
                          t.amount < 0 ? "text-rose-300" : "text-emerald-300",
                        )}
                      >
                        {money(t.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

      {!loading && !error && groups.length === 0 && (
        <p className="py-4 text-center text-xs text-neutral-500">Sin movimientos del banco.</p>
      )}

      {editing && (
        <CorrectSheet
          tx={editing}
          onClose={() => setEditing(null)}
          onSave={(cat, cls) => handleSave(editing, cat, cls)}
        />
      )}
    </section>
  )
}

export function BankTxReportRefresh() {
  return <RefreshCw className="size-3.5" />
}
