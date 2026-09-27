// Modal de auditoría de saldo (estilo Claris).
//
// Sube una captura de pantalla del banco: la IA lee el saldo disponible y lo
// aplica como saldo de partida de FINANCE. También permite aplicarlo a mano
// como respaldo (o si la lectura no es fiable).

"use client"

import { useState } from "react"
import { Loader2, Camera } from "lucide-react"
import { useFinance } from "./finance-store"

// Redimensiona la imagen para reducir el payload del OCR.
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
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.82), mimeType: "image/jpeg" })
      }
      img.onerror = () => reject(new Error("No se pudo leer la imagen"))
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function BankAuditSheet() {
  const [open, setOpen] = useState(false)
  const [manualBalance, setManualBalance] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const { setStartingBalance } = useFinance()

  const apply = () => {
    const value = parseFloat(manualBalance)
    if (!Number.isNaN(value)) {
      setStartingBalance(value)
      setStatus(`Saldo aplicado: $${value.toFixed(2)}`)
    }
    setOpen(false)
    setManualBalance("")
    setStatus(null)
  }

  // Captura del banco: OCR del saldo y aplicación automática.
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    setStatus("Leyendo saldo del banco...")
    try {
      const { base64, mimeType } = await resizeImage(file)
      const res = await fetch("/api/scan-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      })
      const json = await res.json()
      if (res.ok && json.success && Number.isFinite(json.balance)) {
        setStartingBalance(Number(json.balance))
        setStatus(`✅ Saldo del banco aplicado: $${Number(json.balance).toFixed(2)}`)
      } else {
        setStatus(`⚠️ ${json.error || "No se pudo leer el saldo"}. Ingrésalo a mano.`)
      }
    } catch {
      setStatus("⚠️ Error al leer la captura. Ingrésalo a mano.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setStatus(null)
        }}
        className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-400/20"
        title="Auditoría bancaria"
      >
        📷
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-sm space-y-3 rounded-t-2xl border border-neutral-800 bg-neutral-950 p-5 sm:rounded-2xl">
            <h3 className="text-sm font-bold text-white">Auditoría de Saldo</h3>
            <p className="text-[11px] text-neutral-400">
              Sube una captura del banco y la IA lee tu saldo disponible, o ingrésalo manualmente.
            </p>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 bg-neutral-900 py-3 text-xs font-bold text-neutral-300 hover:border-yellow-400/40">
              {busy ? (
                <Loader2 className="size-4 animate-spin text-yellow-400" />
              ) : (
                <Camera className="size-4 text-yellow-400" />
              )}
              {busy ? "Leyendo saldo..." : "Subir captura del banco"}
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={busy}
                className="hidden"
              />
            </label>

            {status && (
              <p className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-[11px] font-semibold text-neutral-200">
                {status}
              </p>
            )}

            <input
              type="number"
              inputMode="decimal"
              value={manualBalance}
              onChange={(e) => setManualBalance(e.target.value)}
              placeholder="Saldo real $ (manual)"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setStatus(null)
                }}
                className="flex-1 rounded-xl border border-neutral-700 py-2 text-xs font-semibold text-neutral-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={apply}
                className="flex-1 rounded-xl bg-yellow-400 py-2 text-xs font-bold text-black"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
