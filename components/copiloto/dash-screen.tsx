"use client"

import { useMemo } from "react"
import { Banknote, Car, CircleAlert, PiggyBank, ReceiptText, Wallet } from "lucide-react"
import { localDateKey } from "@/lib/dates"
import { grossOf, money, netOf, type Expense, type Trip } from "./types"
import { PlatformAvatar } from "./platform-avatar"

function StatCard({
  label,
  value,
  valueClass,
  icon,
}: {
  label: string
  value: string
  valueClass: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-bold tracking-wide text-neutral-500">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-extrabold ${valueClass}`}>{value}</p>
    </div>
  )
}

export function DashScreen({ trips, expenses }: { trips: Trip[]; expenses: Expense[] }) {
  const today = localDateKey(new Date())

  const data = useMemo(() => {
    const gross = trips.reduce((s, t) => s + grossOf(t), 0)
    const fee = trips.reduce((s, t) => s + (Number(t.platformFee) || 0), 0)
    const net = gross - fee
    const tips = trips.reduce((s, t) => s + (Number(t.tips) || 0), 0)
    const tolls = trips.reduce((s, t) => s + (Number(t.toll) || 0), 0)
    const pending = trips.filter((t) => t.status === "pending")
    const pendingAmount = pending.reduce((s, t) => s + netOf(t), 0)

    const byPlatform = new Map<string, { gross: number; count: number }>()
    for (const t of trips) {
      const g = byPlatform.get(t.platform) ?? { gross: 0, count: 0 }
      g.gross += grossOf(t)
      g.count += 1
      byPlatform.set(t.platform, g)
    }
    const platforms = [...byPlatform.entries()]
      .map(([platform, v]) => ({ platform, ...v }))
      .sort((a, b) => b.gross - a.gross)

    const expensesToday = expenses.filter((e) => e.date === today)
    const expensesTotal = expensesToday.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    return { gross, net, tips, tolls, pending, pendingAmount, platforms, expensesTotal, count: trips.length }
  }, [trips, expenses, today])

  const fecha = new Date().toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
      <div>
        <h1 className="text-lg font-extrabold text-white">Resumen del día</h1>
        <p className="text-xs capitalize text-neutral-500">{fecha}</p>
      </div>

      {data.count === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-6 py-10 text-center">
          <Car className="size-8 text-neutral-600" />
          <p className="text-sm font-bold text-neutral-300">Todavía no hay viajes registrados</p>
          <p className="text-xs text-neutral-500">
            Agrega tu primer viaje en COBROS y aquí verás tu resumen del día.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="BRUTO HOY"
              value={money(data.gross)}
              valueClass="text-yellow-400"
              icon={<Wallet className="size-3.5 text-yellow-400/70" />}
            />
            <StatCard
              label="NETO HOY"
              value={money(data.net)}
              valueClass="text-green-400"
              icon={<PiggyBank className="size-3.5 text-green-400/70" />}
            />
            <StatCard
              label="VIAJES"
              value={String(data.count)}
              valueClass="text-white"
              icon={<Car className="size-3.5 text-neutral-400" />}
            />
            <StatCard
              label="PENDIENTES DE COBRO"
              value={data.pending.length === 0 ? "Todo cuadra" : `${data.pending.length} · ${money(data.pendingAmount)}`}
              valueClass={data.pending.length === 0 ? "text-green-400" : "text-orange-400"}
              icon={<CircleAlert className="size-3.5 text-orange-400/70" />}
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
              <p className="text-[10px] font-bold tracking-wide text-neutral-500">PROPINAS</p>
              <p className="mt-1 text-base font-extrabold text-cyan-300">{money(data.tips)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
              <p className="text-[10px] font-bold tracking-wide text-neutral-500">PEAJES</p>
              <p className="mt-1 text-base font-extrabold text-cyan-300">{money(data.tolls)}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
              <p className="text-[10px] font-bold tracking-wide text-neutral-500">GASTOS HOY</p>
              <p className="mt-1 text-base font-extrabold text-red-400">{money(data.expensesTotal)}</p>
            </div>
          </div>

          {data.platforms.length > 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Banknote className="size-3.5 text-neutral-400" />
                <p className="text-[10px] font-bold tracking-wide text-neutral-500">POR PLATAFORMA</p>
              </div>
              <div className="flex flex-col gap-2">
                {data.platforms.map((p) => (
                  <div key={p.platform} className="flex items-center gap-2.5">
                    <PlatformAvatar platform={p.platform} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-200">
                      {p.platform}
                      <span className="ml-1.5 font-normal text-neutral-500">
                        {p.count} {p.count === 1 ? "viaje" : "viajes"}
                      </span>
                    </span>
                    <span className="text-xs font-extrabold text-yellow-400/90">{money(p.gross)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.pending.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3">
              <ReceiptText className="mt-0.5 size-4 shrink-0 text-orange-300" />
              <p className="text-xs text-orange-200">
                Tienes {data.pending.length} {data.pending.length === 1 ? "viaje pendiente" : "viajes pendientes"} de
                cobro por {money(data.pendingAmount)}. Revísalos en COBROS.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
