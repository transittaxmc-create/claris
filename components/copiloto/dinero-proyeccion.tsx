"use client"

// DINERO · Vista PROYECTADO (estilo Quicken).
// Toda la matemática vive en dinero-forecast.ts (puro y probado); este
// componente solo lee recurrentes / descartes y pinta el resultado.

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, CreditCard, MoreHorizontal, Pencil, Receipt, Repeat, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { money, migrateCategory, EXPENSE_CATEGORIES, type CashFlowEntry, type ScheduledEntry } from "./types"
import { INCOME_CATEGORY } from "./auto-categorize"
import { PendingDeposits } from "./pending-deposits"
import { accountDisplayName, type DueItem, type RegisterAccount } from "./registers-store"
import {
  FREQ_LABEL,
  SCHEDULE_OVERRIDES_KEY,
  addDaysIso,
  buildForecast,
  daysInMonth,
  daysToEndOfMonth,
  r2,
  startingBalance,
  todayKey,
  type ForecastBankTx,
  type ForecastLine,
  type Forecast,
  type ScheduleOverride,
} from "./dinero-forecast"
import { FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT, FORECAST_DISMISSED_KEY } from "./finance-sync"
import { ProjectedCashFlow } from "./projected-cash-flow"

export function useForecastInputs() {
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    const read = () => {
      try {
        const rawSchedules = JSON.parse(localStorage.getItem(FINANCE_SCHEDULES_KEY) || "[]")
        const rawDismissed = JSON.parse(localStorage.getItem(FORECAST_DISMISSED_KEY) || "[]")
        setSchedules(Array.isArray(rawSchedules) ? rawSchedules : [])
        setDismissed(Array.isArray(rawDismissed) ? rawDismissed.map(String) : [])
      } catch {
        setSchedules([])
        setDismissed([])
      }
    }
    read()
    window.addEventListener(FINANCE_SYNCED_EVENT, read)
    return () => window.removeEventListener(FINANCE_SYNCED_EVENT, read)
  }, [])

  return { schedules, dismissed }
}

export function DineroProyeccion(props: {
  registers?: Array<{ id: string; isMain?: boolean }>
  balances?: Record<string, number>
  dues?: Array<{ date: string; label: string; amount: number }>
  entries?: CashFlowEntry[]
  onEditEntry?: (e: CashFlowEntry) => void
}) {
  // Balance disponible: suma de cuentas bancarias (igual que el header)
  let available = 0
  const balances = props.balances || {}
  const registers = props.registers || []
  for (const r of registers) {
    const bal = balances[r.id]
    if (bal === null || bal === undefined) continue
    // Solo bancos (no tarjetas) — misma regla del header
    available += bal
  }
  available = Math.round(available * 100) / 100
  return (
    <ProjectedCashFlow
      availableNow={available}
      entries={(props.entries || []) as CashFlowEntry[]}
      dues={props.dues || []}
      onEditEntry={props.onEditEntry}
    />
  )
}
