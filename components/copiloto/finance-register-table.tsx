// Tabla de corrida de caja diaria (adaptada al estilo Claris: negro/neutral +
// amarillo, sin slate). Expandible por día para editar proyectado/real por
// plataforma.

"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-store"

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

export function FinanceRegisterTable({
  paymentsByDate = {},
  belowZeroDates = new Set<string>(),
}: {
  // Pagos programados que vencen cada día: se muestran bajo la fila del día.
  paymentsByDate?: Record<string, { description: string; amount: number }[]>
  // Días cuyo balance proyectado cae por debajo de cero (fondo rojo).
  belowZeroDates?: Set<string>
}) {
  const { days, toggleWorkingDay, updatePlatformAmount, initializeWeek, getDailyRunningBalances } =
    useFinance()
  const rows = getDailyRunningBalances()
  const [openDayId, setOpenDayId] = useState<string | null>(null)

  useEffect(() => {
    if (days.length === 0) initializeWeek()
  }, [days.length, initializeWeek])

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/90">
      <div className="border-b border-neutral-800 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
          Corrida de Caja Diaria
        </span>
      </div>

      <div className="divide-y divide-neutral-800">
        {rows.map((row) => {
          const day = days.find((d) => d.id === row.dayId)
          if (!day) return null
          const isOpen = openDayId === row.dayId
          const paymentsDue = paymentsByDate[day.date] ?? []
          const inRed = belowZeroDates.has(day.date)

          return (
            <div key={row.dayId} className={cn(inRed && "bg-rose-950/20")}>
              <button
                type="button"
                onClick={() => setOpenDayId(isOpen ? null : row.dayId)}
                className="flex min-h-[68px] w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold capitalize text-white">
                    {dayLabel(day.date)}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {day.isWorkingDay || row.dayTotal > 0
                      ? `+$${row.dayTotal.toFixed(2)}`
                      : "Día libre — $0.00"}
                  </span>
                  {/* Pagos que vencen este día */}
                  {paymentsDue.map((p, i) => (
                    <span key={i} className="text-[10px] font-semibold text-amber-300">
                      ⌛ {p.description} −${p.amount.toFixed(2)}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={cn(
                        "text-sm font-bold",
                        row.isLow ? "text-rose-400" : "text-green-400",
                      )}
                    >
                      ${row.runningBalance.toFixed(2)}
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold",
                        row.isLow ? "bg-red-500/15 text-rose-400" : "bg-emerald-500/15 text-green-400",
                      )}
                    >
                      {row.isLow ? "ALERTA BAJO" : "OPTIMO"}
                    </span>
                  </div>

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleWorkingDay(day.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation()
                        toggleWorkingDay(day.id)
                      }
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[10px] font-bold",
                      day.isWorkingDay
                        ? "border-yellow-400/30 bg-yellow-400/15 text-yellow-300"
                        : "border-neutral-700 bg-neutral-800 text-neutral-400",
                    )}
                  >
                    {day.isWorkingDay ? "WORKING" : "OFF"}
                  </span>
                </div>
              </button>

              {isOpen && day.isWorkingDay && (
                <div className="space-y-2 px-4 pb-3">
                  {day.platforms.map((p) => (
                    <div key={p.platformName} className="grid grid-cols-3 items-center gap-2 text-xs">
                      <span className="text-neutral-300">{p.platformName}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={p.projectedAmount || ""}
                        placeholder="Proyectado"
                        onChange={(e) =>
                          updatePlatformAmount(
                            day.id,
                            p.platformName,
                            "projectedAmount",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={p.actualAmount || ""}
                        placeholder="Real"
                        onChange={(e) =>
                          updatePlatformAmount(
                            day.id,
                            p.platformName,
                            "actualAmount",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-neutral-500">Generando la semana...</p>
        )}
      </div>
    </div>
  )
}
