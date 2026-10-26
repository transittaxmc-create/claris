"use client"

import { useCallback, useState } from "react"

/**
 * Minimal Plaid Link launcher. Loads the official script on demand.
 * After success, exchanges public_token and triggers bank SYNC.
 */
export function PlaidConnectButton({ onLinked }: { onLinked?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const tokRes = await fetch("/api/plaid/create-link-token", { method: "POST" })
      const tokJson = await tokRes.json()
      if (!tokRes.ok || !tokJson.link_token) {
        throw new Error(tokJson.error || tokJson.hint || "Could not create the link token")
      }

      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-plaid-link="1"]') as HTMLScriptElement | null
        if (existing && (window as any).Plaid) {
          resolve()
          return
        }
        const s = document.createElement("script")
        s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        s.async = true
        s.dataset.plaidLink = "1"
        s.onload = () => resolve()
        s.onerror = () => reject(new Error("No se pudo cargar Plaid Link"))
        document.body.appendChild(s)
      })

      const handler = (window as any).Plaid.create({
        token: tokJson.link_token,
        onSuccess: async (public_token: string, metadata: any) => {
          try {
            const ex = await fetch("/api/plaid/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_token,
                institution_name: metadata?.institution?.name || null,
              }),
            })
            const j = await ex.json()
            if (!ex.ok) throw new Error(j.error || "exchange_failed")
            onLinked?.()
          } catch (e: any) {
            setError(e?.message || "Error saving the bank")
          } finally {
            setBusy(false)
          }
        },
        onExit: () => setBusy(false),
      })
      handler.open()
    } catch (e: any) {
      setError(e?.message || "Error")
      setBusy(false)
    }
  }, [onLinked])

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="rounded-xl border border-[#5b8cff]/40 bg-[#5b8cff]/10 px-3 py-2 text-[12px] font-bold text-[#8eb6ff] disabled:opacity-50"
      >
        {busy ? "Abriendo Plaid…" : "Conectar banco (Plaid)"}
      </button>
      {error && <p className="text-[10px] text-[#ff5d6c]">{error}</p>}
    </div>
  )
}
