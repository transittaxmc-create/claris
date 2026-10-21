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

// FILE TOO LARGE - SEE LOCAL ARTIFACT - THIS IS A BROKEN STUB
export function DineroProyeccion() { return null }
