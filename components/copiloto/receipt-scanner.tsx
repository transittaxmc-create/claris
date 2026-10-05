"use client"

// ============================================================================
// ESCANEAR UN RECIBO
//
// Pantalla de tarea a pantalla completa: se abre, se hace la foto, la IA lee
// el recibo, se revisa y se guarda. Diseño según la referencia del cliente:
// cabecera navy, fondo claro, tarjetas blancas, GASTO/INGRESO naranja-azul,
// teclado numérico grande y botón azul de guardar.
//
// Los colores van en hexadecimal a propósito, NO con los tokens del tema: la
// app es oscura y esta pantalla es clara. Así queda aislada y no arrastra al
// resto de la aplicación.
//
// La lectura no la hace el navegador: manda la foto a /api/scan-receipt, que
// llama al modelo desde el servidor. Si la IA falla se dice qué pasó y los
// campos se rellenan a mano; nunca se inventan importes.
// ============================================================================

import { useCallback, useMemo, useRef, useState } from "react"
import { Camera, Check, Loader2, X } from "lucide-react"
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from "./types"
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

/** Reduce la foto antes de mandarla: una foto de móvil son 4 MB y no hace falta */
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
          reject(new Error("No se pudo preparar la imagen"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ image: c.toDataURL("image/jpeg", 0.82), mimeType: "image/jpeg" })
      }
      img.onerror = () => reject(new Error("No se pudo leer la foto"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("No se pudo abrir el archivo"))
    reader.readAsDataURL(file)
  })
}

/** El teclado numérico: introduce dígitos sobre el importe en texto */
function aplicarTecla(actual: string, tecla: string): string {
  if (tecla === "borrar") return actual.slice(0, -1)
  if (tecla === "limpiar") return ""
  if (tecla === ".") {
    if (actual.includes(".")) return actual
    return actual === "" ? "0." : actual + "."
  }
  // máximo dos decimales
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
  /** Guarda un gasto con la misma forma que el resto de la app */
  onSaveExpense: (e: Expense) => void
  /** Guarda un ingreso esperado (queda en el ledger que ve FINANCE) */
  onSaveIncome: (e: { description: string; category: string; amount: number; date: string; notes?: string }) => void
  /** Para la cabecera: el mes en curso */
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

  const inputRef = useRef<HTMLInputElement>(null)

  const balance = totales.ingresos - totales.gastos
  const pct = totales.presupuesto > 0 ? Math.min(100, Math.round((totales.gastos / totales.presupuesto) * 100)) : 0
  const listo = importe !== "" && Number(importe) > 0

  /* ------------------------------------------------------------------ */
  /* La foto -> la IA                                                    */
  /* ------------------------------------------------------------------ */
  const escanear = useCallback(async (file: File) => {
    setLeyendo(true)
    setAviso({ tipo: "info", texto: "Procesando la imagen…" })
    try {
      const { image, mimeType } = await reducir(file)
      setFoto(image)
      setAviso({ tipo: "info", texto: "Leyendo el recibo con IA…" })

      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || "No se pudo analizar el recibo")

      const r = json.result || {}
      if (r.date) setFecha(String(r.date).slice(0, 10))
      if (r.vendor) setComercio(String(r.vendor))
      if (r.amount != null && Number(r.amount) > 0) setImporte(Number(r.amount).toFixed(2))
      if (r.category && EXPENSE_CATEGORIES.includes(r.category as ExpenseCategory)) setCategoria(String(r.category))
      if (r.notes) setNotas(String(r.notes))
      if (typeof r.confidence === "number") setConfianza(r.confidence)
      setAviso({ tipo: "ok", texto: "Recibo leído. Revisa los datos y guarda." })
    } catch (err) {
      // Sin datos inventados: se dice el motivo y se rellena a mano.
      setAviso({ tipo: "error", texto: String((err as Error)?.message || err) })
    } finally {
      setLeyendo(false)
    }
  }, [])

  function guardar() {
    if (!listo) return
    const monto = Number(importe)
    const nombre = comercio.trim() || (direccion === "gasto" ? "Gasto sin nombre" : "Ingreso sin nombre")

    if (direccion === "ingreso") {
      onSaveIncome({ description: nombre, category: categoria, amount: monto, date: fecha, notes: notas.trim() || undefined })
      onClose()
      return
    }

    const expense: Expense = {
      id: crypto.randomUUID(),
      date: fecha,
      vendor: nombre,
      category: categoria,
      amount: monto,
      notes: notas.trim() || undefined,
      confidence: confianza ?? undefined,
      isAiGenerated: Boolean(foto),
      isEditedByUser: false,
      scheduled: false,
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

      {/* ---------------- cabecera navy ---------------- */}
      <header className="shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]" style={{ background: NAVY }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
          <h1 className="flex-1 text-base font-bold text-white">Escanear recibo</h1>
          {leyendo && <Loader2 className="size-4 animate-spin text-white/60" />}
        </div>

        {/* resumen del mes, como en la referencia */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Ingresos</p>
            <p className="text-sm font-extrabold" style={{ color: GREEN }}>
              {money(totales.ingresos)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Gastos</p>
            <p className="text-sm font-extrabold text-white">{money(totales.gastos)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Balance</p>
            <p className="text-sm font-extrabold" style={{ color: balance >= 0 ? GREEN : "#FF6B6B" }}>
              {money(balance)}
            </p>
          </div>
        </div>

        {totales.presupuesto > 0 && (
          <div className="mt-2.5">
            <div className="flex items-baseline justify-between text-[10px] text-white/60">
              <span>Presupuesto mensual</span>
              <span className="font-semibold text-white/80">{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GREEN }} />
            </div>
            <p className="mt-1 text-[10px] text-white/50">
              {money(totales.gastos)} de {money(totales.presupuesto)} gastados
            </p>
          </div>
        )}
      </header>

      {/* ---------------- cuerpo ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="rounded-2xl border bg-white p-3.5" style={{ borderColor: LINE }}>
          {/* GASTO | INGRESO */}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
            {(["gasto", "ingreso"] as Direccion[]).map((d) => {
              const activo = direccion === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDireccion(d)}
                  className="py-2.5 text-[13px] font-bold uppercase tracking-wide transition-colors"
                  style={{
                    background: activo ? (d === "gasto" ? ORANGE : BLUE) : "#fff",
                    color: activo ? "#fff" : "#6B7280",
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>

          {/* la foto */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={leyendo}
            className="mt-3.5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-[13px] font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: foto ? NAVY : BLUE }}
          >
            {leyendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {foto ? "REPETIR LA FOTO" : "TOMAR FOTO DEL RECIBO"}
          </button>

          {foto && (
            <div className="mt-2.5 overflow-hidden rounded-xl border" style={{ borderColor: LINE }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="Recibo escaneado" className="max-h-40 w-full object-contain" style={{ background: BG }} />
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

          {/* monto */}
          <div className="mt-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Monto
            </p>
            <div
              className="mt-1 flex items-baseline gap-1 rounded-xl px-3 py-2"
              style={{ background: BG, border: `1px solid ${LINE}` }}
            >
              <span className="text-xl font-bold" style={{ color: "#6B7280" }}>
                $
              </span>
              <span
                className="flex-1 text-right text-3xl font-extrabold tabular-nums"
                style={{ color: importe ? (direccion === "gasto" ? ORANGE : BLUE) : "#C4C9D2" }}
              >
                {importe || "0"}
              </span>
            </div>
          </div>

          {/* teclado numérico */}
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {teclas.flat().map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setImporte((v) => aplicarTecla(v, t))}
                aria-label={t === "borrar" ? "Borrar" : t}
                className="rounded-xl py-3 text-xl font-bold transition-colors active:opacity-70"
                style={{ background: BG, border: `1px solid ${LINE}`, color: "#1F2937" }}
              >
                {t === "borrar" ? "⌫" : t}
              </button>
            ))}
          </div>

          {/* comercio */}
          <label className="mt-3.5 block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Comercio
            </span>
            <input
              type="text"
              value={comercio}
              onChange={(e) => setComercio(e.target.value)}
              placeholder="Quién cobró"
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            />
          </label>

          {/* categoría */}
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Categoría
            </p>
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
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
                    style={{ background: c === categoria ? "#EEF3F9" : "#fff", color: "#1F2937", borderTop: `1px solid ${LINE}` }}
                  >
                    {c}
                    {c === categoria && <Check className="size-3.5" style={{ color: BLUE }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* fecha */}
          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Fecha
            </span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            />
          </label>

          {/* notas */}
          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Notas
            </span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Para qué fue"
              className="mt-1 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#fff", border: `1px solid ${LINE}`, color: "#1F2937" }}
            />
          </label>

          {/* guardar */}
          <button
            type="button"
            onClick={guardar}
            disabled={!listo}
            className="mt-3.5 w-full rounded-xl py-3.5 text-[14px] font-extrabold uppercase tracking-wide text-white transition-opacity disabled:opacity-40"
            style={{ background: direccion === "gasto" ? ORANGE : BLUE }}
          >
            Guardar {direccion}
          </button>
        </div>

        <p className="mt-2 px-1 pb-4 text-center text-[10.5px] leading-snug" style={{ color: "#8A93A3" }}>
          La foto se manda al servidor para leerla con IA. Si falla, los campos se rellenan a mano:
          <strong style={{ color: "#5B6472" }}> nunca se inventan importes</strong>.
        </p>
      </div>
    </div>
  )
}
