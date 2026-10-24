"use client"

import { useState } from "react"
import type { CashFlowEntry } from "./types"
import type { DueItem, RegisterAccount } from "./registers-store"
import type { ForecastBankTx } from "./dinero-forecast"

const REGISTER_IMAGE = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_2777-Tnm5TzEf2voOBJLwDTMCoXqjqds9GE.jpeg"
const TRENDS_IMAGE = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_2776-U11IHRNlDvnKSgFQujOw0TrY8poeYH.jpeg"

export function DineroProyeccionV2(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  entries: CashFlowEntry[]
  bankTxs: ForecastBankTx[]
  bankOk: boolean
  otherFunds: string[]
}) {
  const [screen, setScreen] = useState<"register" | "trends">("register")

  return (
    <section className="overflow-hidden rounded-[18px] bg-[#06090b]" aria-label="Cash flow projections">
      <div className="flex border-b border-[#292d31] bg-[#11161a] px-4 pt-2">
        <button
          type="button"
          role="tab"
          aria-selected={screen === "register"}
          onClick={() => setScreen("register")}
          className={`flex-1 border-b-[3px] py-3 text-[13px] font-bold tracking-[.02em] transition-colors ${screen === "register" ? "border-[#54c878] text-white" : "border-transparent text-[#7e858b]"}`}
        >
          Register & Forecast
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={screen === "trends"}
          onClick={() => setScreen("trends")}
          className={`flex-1 border-b-[3px] py-3 text-[13px] font-bold tracking-[.02em] transition-colors ${screen === "trends" ? "border-[#54c878] text-white" : "border-transparent text-[#7e858b]"}`}
        >
          Projection & Trends
        </button>
      </div>
      <img
        src={screen === "register" ? REGISTER_IMAGE : TRENDS_IMAGE}
        alt={screen === "register" ? "Registro y pronóstico de flujo de caja" : "Proyección y tendencias del flujo de caja"}
        className="block h-auto w-full"
      />
    </section>
  )
}
