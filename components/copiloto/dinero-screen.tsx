"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Link2, Loader2, Receipt, Trash2, AlertTriangle } from "lucide-react"

type Row = {
  id: string
  isReal: boolean
  date: string
  detailPrimary: string
  detailSecondary: string
  amount: number
  realBalance: number
  hasReceipt: boolean
  status?: string
}

type ApiRow = Record<string, unknown>
const money = (value: number, decimals = 2) => `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("es-US", { day: "2-digit", month: "short" }).replace(".", "")
const relativeDate = (date: string) => {
  const diff = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000)
  return diff === 0 ? "Hoy" : diff > 0 ? `En ${diff} día${diff === 1 ? "" : "s"}` : `Hace ${Math.abs(diff)} día${diff === -1 ? "" : "s"}`
}

async function save(action: string, payload: unknown) {
  const response = await fetch("/api/dinero/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error ?? "No se pudo guardar")
  return result
}

export function DineroScreen() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/dinero/sync", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error); return data })
      .then((data) => {
        const bank = (data.bankRows as ApiRow[]).map((item) => ({
          id: String(item.id), isReal: true, date: String(item.date),
          detailPrimary: String(item.detail_primary || item.detail || "Movimiento bancario"), detailSecondary: String(item.detail_secondary || item.bank_account || "Cuenta principal"),
          amount: Number(item.amount ?? (Number(item.credit ?? 0) - Number(item.debit ?? 0))) || 0, realBalance: Number(item.daily_balance) || 0, hasReceipt: Boolean(item.has_receipt),
        }))
        const base = bank[0]?.realBalance ?? 0
        const projections = (data.projections as ApiRow[]).map((item) => ({ id: String(item.id), isReal: false, date: String(item.due_date), detailPrimary: String(item.detail_primary || "Compromiso"), detailSecondary: String(item.detail_secondary || item.origin_module || "Programado"), amount: Number(item.amount) || 0, realBalance: base, hasReceipt: false, status: String(item.status || "pending") }))
        setRows([...bank, ...projections])
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo cargar Dinero"))
      .finally(() => setLoading(false))
  }, [])

  const latestRealBalance = rows.find((row) => row.isReal)?.realBalance ?? 0
  const projectedBalances = useMemo(() => {
    let balance = latestRealBalance
    return rows.map((row) => { if (!row.isReal) balance += row.amount; return [row.id, balance] as const })
  }, [rows, latestRealBalance])
  const projectedBalance = latestRealBalance + rows.filter((row) => !row.isReal).reduce((sum, row) => sum + row.amount, 0)

  async function updateRow(row: Row, patch: Partial<Row>) {
    const next = { ...row, ...patch }
    setRows((current) => current.map((item) => item.id === row.id ? next : item))
    setSaving(row.id); setError(null)
    try {
      await save(row.isReal ? "UPDATE_BANK_ROW" : "UPDATE_PROJECTION", row.isReal ? { id: row.id, date: next.date, detail_primary: next.detailPrimary, detail_secondary: next.detailSecondary, amount: next.amount } : { id: row.id, due_date: next.date, detail_primary: next.detailPrimary, detail_secondary: next.detailSecondary, amount: next.amount })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar") }
    finally { setSaving(null) }
  }

  async function deleteProjection(id: string) {
    setRows((current) => current.filter((row) => row.id !== id)); setSaving(id)
    try { await save("DELETE_PROJECTION", { id }) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo borrar") }
    finally { setSaving(null) }
  }

  async function matchProjection(id: string) {
    const target = rows.find((row) => row.id === id)
    const bank = rows.find((row) => row.isReal && Math.abs(row.amount - (target?.amount ?? 0)) < 0.01)
    if (!bank) { setError("No hay un movimiento bancario compatible para cotejar."); return }
    setSaving(id)
    try { await save("MATCH_PROJECTION", { projectionId: id, bankTransactionId: bank.id }); setRows((current) => current.filter((row) => row.id !== id)) } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cotejar") }
    finally { setSaving(null) }
  }

  return <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-neutral-950 text-neutral-100">
    <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/95 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-extrabold tracking-[0.16em] text-emerald-400">COPILOTO · DINERO</span><span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[9px] font-bold text-emerald-300">EN RUTA</span></div>
      <div className="grid grid-cols-3 gap-1.5 text-center"><Summary label="BANCO REAL" value={money(latestRealBalance)} tone="text-emerald-400" /><Summary label="PROYECTADO" value={money(projectedBalance)} tone="text-sky-400" /><Summary label="CIERRE" value="$0.00" tone="text-emerald-400" /></div>
    </header>
    {error && <p role="alert" className="border-b border-rose-900 bg-rose-950/60 px-3 py-2 text-[11px] text-rose-200">{error}</p>}
    {loading ? <div className="flex items-center justify-center gap-2 p-8 text-xs text-neutral-400"><Loader2 className="size-4 animate-spin" />Cargando historial…</div> : <div className="w-full overflow-x-hidden pb-16"><table className="w-full table-fixed border-collapse text-left"><thead className="bg-black text-[9px] uppercase text-neutral-500"><tr><th className="w-[16%] p-1.5">Fecha</th><th className="w-[32%] p-1.5">Descripción</th><th className="w-[20%] p-1.5 text-right">Balance real</th><th className="w-[23%] p-1.5 text-right">Transacción</th><th className="w-[9%] p-1 text-center">Estado</th></tr></thead><tbody className="divide-y divide-neutral-800 text-xs">{rows.map((row) => { const projected = projectedBalances.find(([id]) => id === row.id)?.[1] ?? latestRealBalance; return <tr key={row.id} className={row.isReal ? "bg-neutral-950" : "bg-emerald-950/20"}><td className="p-1.5 align-top"><input aria-label="Fecha" type="date" value={row.date} onChange={(event) => updateRow(row, { date: event.target.value })} className="w-full bg-transparent text-[10px] font-bold text-neutral-200 outline-none" /><span className="block text-[9px] text-neutral-500">{row.isReal ? "Banco" : relativeDate(row.date)}</span></td><td className="p-1.5 align-top"><input aria-label="Descripción principal" value={row.detailPrimary} onChange={(event) => updateRow(row, { detailPrimary: event.target.value })} className="w-full truncate bg-transparent text-[11px] font-semibold text-white outline-none" /><input aria-label="Descripción secundaria" value={row.detailSecondary} onChange={(event) => updateRow(row, { detailSecondary: event.target.value })} className="w-full truncate bg-transparent text-[9px] text-neutral-400 outline-none" /></td><td className="p-1.5 align-top text-right"><span className="text-[11px] font-bold text-emerald-400">{money(row.realBalance)}</span><span className="block text-[8px] text-neutral-500">{row.isReal ? "Verificado" : "Pendiente"}</span></td><td className="p-1.5 align-top text-right"><input aria-label="Monto" type="number" step="0.01" value={row.amount} onChange={(event) => updateRow(row, { amount: Number(event.target.value) || 0 })} className={`w-full bg-transparent text-right text-[11px] font-black outline-none ${row.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`} /><span className="mt-0.5 inline-block rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-[8px] font-bold text-neutral-300">PROY: {money(projected, 0)}</span>{!row.isReal && <span className="mt-1 flex justify-end gap-1"><button type="button" onClick={() => matchProjection(row.id)} aria-label="Cotejar proyección" className="rounded bg-emerald-600/30 p-1 text-emerald-300"><Link2 className="size-3" /></button><button type="button" onClick={() => deleteProjection(row.id)} aria-label="Borrar proyección" className="rounded bg-rose-600/30 p-1 text-rose-300"><Trash2 className="size-3" /></button></span>}</td><td className="p-1 text-center align-top">{saving === row.id ? <Loader2 className="mx-auto size-3.5 animate-spin text-sky-400" /> : row.hasReceipt ? <CheckCircle2 className="mx-auto size-3.5 text-emerald-400" /> : row.isReal ? <AlertTriangle className="mx-auto size-3.5 text-amber-400" /> : <Receipt className="mx-auto size-3.5 text-neutral-500" />}</td></tr> })}</tbody></table>{!rows.length && <p className="p-8 text-center text-xs text-neutral-500">No hay movimientos sincronizados todavía.</p>}</div>}
  </main>
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className="rounded border border-neutral-800 bg-neutral-900 p-2"><p className="text-[8px] font-bold text-neutral-500">{label} ($)</p><p className={`mt-0.5 text-xs font-black ${tone}`}>{value}</p></div> }
