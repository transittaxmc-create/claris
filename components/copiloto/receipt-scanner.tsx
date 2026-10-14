"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Camera, Check, Loader2, X } from "lucide-react"
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type ExpenseDocType } from "./types"
import { localDateKey } from "@/lib/dates"

const NAVY = "#082A4F"
const ORANGE = "#F86810"
const BLUE = "#0078C8"
const GREEN = "#10A858"
const BG = "#F0F0F0"
const LINE = "#E0E0E0"

type Direccion = "gasto" | "ingreso"
type Totales = { ingresos: number; gastos: number; presupuesto: number }

const money = (n: number) =>
  (n < 0 ? "-" : "") +
  "$" +
  Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function reducir(file: File, maxDim = 1600): Promise<{ image: string; mimeType: string }> {
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
        const c = document.createElement("canvas")
        c.width = width
        c.height = height
        const ctx = c.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not prepare image"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ image: c.toDataURL("image/jpeg", 0.82), mimeType: "image/jpeg" })
      }
      img.onerror = () => reject(new Error("Could not read photo"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Could not open file"))
    reader.readAsDataURL(file)
  })
}

function aplicarTecla(actual: string, tecla: string): string {
  if (tecla === "borrar") return actual.slice(0, -1)
  if (tecla === "limpiar") return ""
  if (tecla === ".") {
    if (actual.includes(".")) return actual
    return actual === "" ? "0." : actual + "."
  }
  if (actual.includes(".") && actual.split(".")[1].length >= 2) return actual
  if (actual === "0") return tecla
  if (actual.replace(".", "").length >= 9) return actual
  return actual + tecla
}

export function ReceiptScanner({
  onClose,
  onSaveExpense,
  onSaveIncome,
  totales,
}: {
  onClose: () => void
  onSaveExpense: (e: Expense) => void
  onSaveIncome: (e: { description: string; category: string; amount: number; date: string; notes?: string }) => void
  totales: Totales
}) {
  const [direccion, setDireccion] = useState<Direccion>("gasto")
  const [foto, setFoto] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error" | "info"; texto: string } | null>(null)
  const [confianza, setConfianza] = useState<number | null>(null)
  const [importe, setImporte] = useState("")
  const [comercio, setComercio] = useState("")
  const [categoria, setCategoria] = useState<string>(EXPENSE_CATEGORIES[0])
  const [notas, setNotas] = useState("")
  const [fecha, setFecha] = useState(localDateKey(new Date()))
  const [verCategorias, setVerCategorias] = useState(false)
  // Empty until user chooses — Easy Pass / Tower look like receipts but are Bills
  const [docTipo, setDocTipo] = useState<ExpenseDocType | "">("")
  const inputRef = useRef<HTMLInputElement>(null)

  const balance = totales.ingresos - totales.gastos
  const listo = importe !== "" && Number(importe) > 0 && (docTipo === "factura" || docTipo === "recibo")

  const escanear = useCallback(async (file: File) => {
    setLeyendo(true)
    setAviso({ tipo: "info", texto: "Processing image…" })
    try {
      const { image, mimeType } = await reducir(file)
      setFoto(image)
      setDocTipo("")
      setAviso({ tipo: "info", texto: "Reading document with AI…" })
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not analyze document")
      const r = json.result || {}
      if (r.date) setFecha(String(r.date).slice(0, 10))
      if (r.vendor) setComercio(String(r.vendor))
      if (r.amount != null && Number(r.amount) > 0) setImporte(Number(r.amount).toFixed(2))
      if (r.category && EXPENSE_CATEGORIES.includes(r.category as ExpenseCategory)) setCategoria(String(r.category))
      if (r.notes) setNotas(String(r.notes))
      if (typeof r.confidence === "number") setConfianza(r.confidence)
      setAviso({ tipo: "ok", texto: "Document read. Select Bill or Receipt, then save." })
    } catch (err) {
      setAviso({ tipo: "error", texto: String((err as Error)?.message || err) })
    } finally {
      setLeyendo(false)
    }
  }, [])

  function guardar() {
    if (!listo) return
    if (docTipo !== "factura" && docTipo !== "recibo") {
      setAviso({ tipo: "error", texto: "Select document type: Bill (to pay) or Receipt (already paid)." })
      return
    }
    const monto = Number(importe)
    const nombre = comercio.trim() || (direccion === "gasto" ? "Unnamed expense" : "Unnamed income")
    if (direccion === "ingreso") {
      onSaveIncome({ description: nombre, category: categoria, amount: monto, date: fecha, notes: notas.trim() || undefined })
      onClose()
      return
    }
    const attached = foto || undefined
    const expense: Expense = {
      id: crypto.randomUUID(),
      date: fecha,
      vendor: nombre,
      category: categoria,
      amount: monto,
      notes: attached || notas.trim() || undefined,
      confidence: confianza ?? undefined,
      isAiGenerated: docTipo === "recibo" || Boolean(foto),
      isEditedByUser: false,
      scheduled: docTipo === "factura",
      docType: docTipo as ExpenseDocType,
      savedAt: new Date().toISOString(),
    }
    onSaveExpense(expense)
    onClose()
  }

  const teclas = useMemo(
    () => [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      [".", "0", "borrar"],
    ],
    [],
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: BG }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) escanear(f)
          e.target.value = ""
        }}
      />
      <header className="shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]" style={{ background: NAVY }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="size-5" />
          </button>
          <h1 className="flex-1 text-base font-bold text-white">Scan document</h1>
          {leyendo && <Loader2 className="size-4 animate-spin text-white/60" />}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Income</p>
            <p className="text-sm font-extrabold" style={{ color: GREEN }}>{money(totales.ingresos)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Expenses</p>
            <p className="text-sm font-extrabold text-white">{money(totales.gastos)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Balance</p>
            <p className="text-sm font-extrabold" style={{ color: balance >= 0 ? GREEN : "#FF6B6B" }}>{money(balance)}</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="rounded-2xl border bg-white p-3.5" style={{ borderColor: LINE }}>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
            {(["gasto", "ingreso"] as Direccion[]).map((d) => {
              const activo = direccion === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDireccion(d)}
                  className="py-2.5 text-[13px] font-bold uppercase tracking-wide"
                  style={{
                    background: activo ? (d === "gasto" ? ORANGE : BLUE) : "#fff",
                    color: activo ? "#fff" : "#6B7280",
                  }}
                >
                  {d === "gasto" ? "Expense" : "Income"}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={leyendo}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: foto ? NAVY : BLUE }}
          >
            {leyendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {foto ? "RETAKE PHOTO" : "TAKE PHOTO"}
          </button>

          {foto && (
            <div className="mt-2.5 overflow-hidden rounded-xl border" style={{ borderColor: LINE }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="Document" className="max-h-40 w-full object-contain" style={{ background: BG }} />
            </div>
          )}

          {aviso && (
            <p
              className="mt-2.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold leading-snug"
              style={{
                background: aviso.tipo === "ok" ? "#E8F7EF" : aviso.tipo === "error" ? "#FDECEF" : "#EEF3F9",
                color: aviso.tipo === "ok" ? "#0B7A43" : aviso.tipo === "error" ? "#B3123B" : "#37527A",
              }}
            >
              {aviso.texto}
            </p>
          )}

          <div className="mt-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Amount</p>
            <div className="mt-1 flex items-baseline gap-1 rounded-xl px-3 py-2" style={{ background: BG, border: `1px solid ${LINE}` }}>
              <span className="text-xl font-bold" style={{ color: "#6B7280" }}>$</span>
              <span className="flex-1 text-right text-3xl font-extrabold tabular-nums" style={{ color: importe ? (direccion === "gasto" ? ORANGE : BLUE) : "#C4C9D2" }}>
                {importe || "0"}
              </span>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {teclas.flat().map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setImporte((v) => aplicarTecla(v, t))}
                className="rounded-xl py-3 text-xl font-bold"
                style={{ background: BG, border: `1px solid ${LINE}`, color: "#1F2937" }}
              >
                {t === "borrar" ? "⌫" : t}
              </button>
            ))}
          </div>

          <label className="mt-3.5 block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Vendor</span>
            <input
              type="text"
              value={comercio}
              onChange={(e) => setComercio(e.target.value)}
              placeholder="Who charged"
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            />
          </label>

          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Category</p>
            <button
              type="button"
              onClick={() => setVerCategorias((v) => !v)}
              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            >
              {categoria}
              <span style={{ color: "#9CA3AF" }}>{verCategorias ? "▲" : "▼"}</span>
            </button>
            {verCategorias && (
              <div className="mt-1 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategoria(c)
                      setVerCategorias(false)
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium"
                    style={{ background: c === categoria ? "#EEF3F9" : "#fff", color: "#1F2937", borderTop: `1px solid ${LINE}` }}
                  >
                    {c}
                    {c === categoria && <Check className="size-3.5" style={{ color: BLUE }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Date</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            />
          </label>

          {/* REQUIRED dropdown: Bill = payable | Receipt = match bank */}
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Document type <span style={{ color: ORANGE }}>*</span>
            </p>
            <select
              value={docTipo}
              onChange={(e) => setDocTipo(e.target.value as ExpenseDocType | "")}
              className="mt-1.5 w-full rounded-xl px-3 py-3 text-[14px] font-bold outline-none"
              style={{
                background: docTipo ? "#fff" : "#FFF7ED",
                border: `2px solid ${docTipo ? LINE : ORANGE}`,
                color: "#1F2937",
              }}
            >
              <option value="">— Select type —</option>
              <option value="factura">Bill — to pay later (e.g. Easy Pass, Tower, invoice)</option>
              <option value="recibo">Receipt — already paid (match to bank statement)</option>
            </select>
            <p className="mt-1.5 text-[10px] leading-snug" style={{ color: "#8A93A3" }}>
              {docTipo === "factura"
                ? "Saved as a projected payable in the ledger until you pay it."
                : docTipo === "recibo"
                  ? "Saved as a posted expense with photo attached to match the bank."
                  : "Toll invoices (Easy Pass, SunPass, Tower) are usually Bills, not receipts."}
            </p>
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Notes</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Optional notes"
              className="mt-1 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            />
          </label>

          <button
            type="button"
            onClick={guardar}
            disabled={!listo}
            className="mt-3.5 w-full rounded-xl py-3.5 text-[14px] font-extrabold uppercase tracking-wide text-white disabled:opacity-40"
            style={{ background: direccion === "gasto" ? ORANGE : BLUE }}
          >
            Save {direccion === "gasto" ? "expense" : "income"}
          </button>
        </div>

        <p className="mt-2 px-1 pb-4 text-center text-[10.5px] leading-snug" style={{ color: "#8A93A3" }}>
          Photo is sent to the server for AI reading. If it fails, fill fields manually —
          <strong style={{ color: "#5B6472" }}> amounts are never invented</strong>.
        </p>
      </div>
    </div>
  )
}
