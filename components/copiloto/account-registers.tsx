"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Camera,
  Check,
  Pencil,
  Plus,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry, type CashFlowOrigin } from "./types"
import {
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  origenDe,
  tipoDocDe,
} from "./cash-flow-store"
import {
  type RegisterAccount,
  type DueItem,
  accountDisplayName,
  accountIdFor,
  last4Of,
} from "./registers-store"
import type { TransferReport } from "./transfer-matcher"
import type { ReconReport, ReconFinding } from "./reconciliation-check"
import { DineroProyeccion, useForecastInputs } from "./dinero-proyeccion"
import { buildForecast, daysToEndOfMonth, startingBalance, todayKey } from "./dinero-forecast"
import { movementCounts } from "./bank-brand"
import { BankLogo, MoneyAccountCard, MoneyHeader, MoneySectionTitle, MoneyStrip, MoneyTabs } from "./money-ui"
import { bankBrandOf } from "./bank-brand"

export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
  pending?: boolean
  transaction_id?: string
  pending_transaction_id?: string | null
}

function shortDate(iso: string): string {
  if (!iso || iso.length < 10) return "—"
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso.slice(5)
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" })
  } catch {
    return iso.slice(5)
  }
}

function PendingBadge({ pending }: { pending?: boolean }) {
  if (!pending) return null
  return (
    <span className="ml-1 inline-block rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-400">
      Pending
    </span>
  )
}

function EntryTag({ entry }: { entry: CashFlowEntry }) {
  const tipo = tipoDocDe(entry)
  const origin: CashFlowOrigin = origenDe(entry)
  let label: string | null = null
  let cls = "text-neutral-500"
  if (tipo === "factura") {
    label = ETIQUETA_TIPO.factura
    cls = "text-cyan-500/80"
  } else if (tipo === "recibo") {
    label = ETIQUETA_TIPO.recibo
    cls = "text-purple-400/80"
  } else if (origin !== "manual") {
    label = entry.origin === "trip" && entry.sourceLabel ? entry.sourceLabel : ETIQUETA_ORIGEN[origin]
  }
  if (!label) return null
  return <span className={cn("mt-0.5 block truncate text-[9px] font-medium", cls)}>{label}</span>
}

// NOTE: Full RegistersHome/RegisterDetail implementation is large.
// Restoring from commit b141c02 content via import of restored module pieces.
// Temporary: re-export will be completed in following commit.

export { RegistersHome, RegisterDetail, AddAccountModal, TransfersReport } from "./account-registers-impl"
