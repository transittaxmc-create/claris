"use client"

// POR DEPOSITAR — caparazón (Miguel, 2026-10-18).
// Balances que las plataformas (Uber, Lyft, Limosys) aguantan hasta que él los
// transfiere. Visible al frente en la vista Proyectado: aunque no entra al
// balance proyectado, él quiere saber cuánto viene en camino.
// Manual por ahora (las plataformas no se importan solas). Después se
// acumulará de los viajes y se limpiará al llegar el depósito al banco.

import { useEffect, useState } from "react"
import type { Platform } from "./types"
import { MoneySectionTitle } from "./money-ui"
import { PlatformAvatar } from "./platform-avatar"

export type PlatformKey = "uber" | "lyft" | "limosys"

const PLATFORMS: { key: PlatformKey; label: string; platform: Platform }[] = [
  { key: "uber", label: "Uber", platform: "Uber" },
  { key: "lyft", label: "Lyft", platform: "Lyft" },
  { key: "limosys", label: "Limosys", platform: "Limosys" },
]

const KEY = "claris_pending_deposits_v1"

type Balances = Record<PlatformKey, number>

const ZERO: Balances = { uber: 0, lyft: 0, limosys: 0 }

function load(): Balances {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...ZERO }
    const p = JSON.parse(raw)
    return {
      uber: Number(p?.uber) || 0,
      lyft: Number(p?.lyft) || 0,
      limosys: Number(p?.limosys) || 0,
    }
  } catch {
    return { ...ZERO }
  }
}

const money = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PendingDeposits() {
  const [bal, setBal] = useState<Balances>({ ...ZERO })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setBal(load())
    setLoaded(true)
  }, [])

  const set = (key: PlatformKey, v: number) => {
    const next = { ...bal, [key]: Math.max(0, Math.round((Number(v) || 0) * 100) / 100) }
    setBal(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {}
  }

  const total = bal.uber + bal.lyft + bal.limosys

  return (
    <div>
      <MoneySectionTitle>PENDING DEPOSITS</MoneySectionTitle>
      <div className="rounded-[14px] border border-[#262633] bg-[#111119] p-3">
        <p className="mb-2 text-[10px] leading-snug text-[#9a9cb0]">
          What the platforms hold until you transfer it. Not in the projection — for reference
          referencia. Manual: no se importa solo.
        </p>
        <div className="space-y-1.5">
          {PLATFORMS.map(({ key, label, platform }) => (
            <div
              key={key}
              className="flex items-center gap-2.5 rounded-xl border border-[#262633] bg-[#16161f] px-2.5 py-2"
            >
              <PlatformAvatar platform={platform} size={28} />
              <span className="min-w-0 flex-1 text-[13px] font-bold text-[#f2f3f7]">{label}</span>
              {loaded ? (
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[13px] text-[#9a9cb0]">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bal[key] === 0 ? "" : String(bal[key])}
                    onChange={(e) => set(key, Number(e.target.value))}
                    placeholder="0.00"
                    aria-label={`Pending balance in ${label}`}
                    className="w-24 rounded-lg border border-[#262633] bg-[#0a0a0f] px-2 py-1 text-right font-mono text-[13px] font-bold text-[#f2f3f7] placeholder:text-[#4a4c5e]"
                  />
                </span>
              ) : (
                <span className="font-mono text-[13px] text-[#4a4c5e]">…</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-[#262633] pt-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#9a9cb0]">
            Total incoming
          </span>
          <span className="font-mono text-[15px] font-extrabold text-[#2fbf71]">{money(total)}</span>
        </div>
      </div>
    </div>
  )
}
