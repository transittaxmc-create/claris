// Modal de auditoría de saldo (estilo Claris).
//
// NOTA: la extracción automática del saldo por visión IA (OCR) no está
// conectada todavía — requiere un endpoint de servidor (ej. /api/audit)
// que reciba el archivo y llame a un modelo con visión. Por ahora este
// modal permite subir el archivo como respaldo y aplicar el saldo a mano.

"use client"

import { useState } from "react"
import { useFinance } from "./finance-store"

export function BankAuditSheet() {
  const [open, setOpen] = useState(false)
  const [manualBalance, setManualBalance] = useState("")
  const { setStartingBalance } = useFinance()

  const apply = () => {
    const value = parseFloat(manualBalance)
    if (!Number.isNaN(value)) setStartingBalance(value)
    setOpen(false)
    setManualBalance("")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
              Sube una foto del extracto o ingresa el saldo real manualmente.
            </p>
            <input type="file" accept="image/*,application/pdf" className="w-full text-xs text-neutral-400" />
            <input
              type="number"
              inputMode="decimal"
              value={manualBalance}
              onChange={(e) => setManualBalance(e.target.value)}
              placeholder="Saldo real $"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
