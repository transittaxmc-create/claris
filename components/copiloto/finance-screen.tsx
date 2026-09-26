// Pantalla FINANCE — Gastos y Finanzas (paquete recibido en Downloads/files,
// adaptado a Claris: sin zustand, estilo negro/neutral + amarillo).
//
// Tres sub-pestañas: CAJA (saldo, facturas 7d, déficit, corrida diaria),
// PLAN (superávit + plan de pagos) y MIS GASTOS (registro + reserva 10%).
// Estado en ./finance-store (localStorage claris_finance_week_v1), viaja con
// el export/import vía storage.ts (ALL_KEYS).

"use client"

import { useState } from "react"
import { AlertTriangle, PlusCircle, RotateCcw, ShieldCheck, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { BankAuditSheet } from "./bank-audit-sheet"
import { ExpenseRegisterForm } from "./expense-register-form"
import { FinanceRegisterTable } from "./finance-register-table"
import { UpcomingBillsForm } from "./upcoming-bills-form"
import { useFinance } from "./finance-store"
import type { Expense as CopilotoExpense } from "./types"

type SubTab = "caja" | "plan" | "gastos"
export function FinanceScreen({
  expenses,
  onSave,
  onDelete,
}: {
  expenses: CopilotoExpense[]
  onSave: (e: CopilotoExpense) => void
  onDelete: (id: string) => void
}) {
  void expenses
  void onSave
  void onDelete
  const [activeTab, setActiveTab] = useState<SubTab>("caja")

  const { startingBalance, reserveBalance, resetAllData } = useFinance()
  const { getUpcomingExpensesTotal, getInvestableSurplus, getEmergencyPlan } = useFinance()
  const upcomingBills = getUpcomingExpensesTotal(7)
  const { amount: surplus, isSafe } = getInvestableSurplus()
  const emergencyData = getEmergencyPlan()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 pb-3 pt-3">
        <div>
          <h1 className="text-xl font-extrabold text-white">Gastos y Finanzas</h1>
          <p className="text-xs text-neutral-400">Corrida de caja, plan de pagos y reconciliación</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Deseas reiniciar todos los valores a $0.00 para empezar de cero?")) {
                resetAllData()
              }
            }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            title="Reiniciar a $0.00"
          >
            <RotateCcw className="size-4" />
          </button>
          <BankAuditSheet />
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("caja")}
            className={cn(
              "rounded-lg py-2 transition-all",
              activeTab === "caja" ? "bg-yellow-400 text-black shadow-md" : "text-neutral-400 hover:text-white",
            )}
          >
            Corrida de Caja
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={cn(
              "rounded-lg py-2 transition-all",
              activeTab === "plan" ? "bg-yellow-400 text-black shadow-md" : "text-neutral-400 hover:text-white",
            )}
          >
            Plan de Pagos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gastos")}
            className={cn(
              "rounded-lg py-2 transition-all",
              activeTab === "gastos" ? "bg-yellow-400 text-black shadow-md" : "text-neutral-400 hover:text-white",
            )}
          >
            Mis Gastos
          </button>
        </div>
        {activeTab === "caja" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4">
                <div className="absolute right-0 top-0 h-full w-1.5 bg-green-400" />
                <span className="text-[10px] font-bold uppercase text-neutral-400">Saldo Disponible</span>
                <div className="mt-1 text-2xl font-black text-green-400">${startingBalance.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4">
                <span className="text-[10px] font-bold uppercase text-neutral-400">Facturas 7 Días</span>
                <div className="mt-1 text-2xl font-black text-white">${upcomingBills.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-2.5 text-[11px] text-neutral-400">
              <Wallet className="size-3.5 shrink-0 text-yellow-300" />
              <span>
                Reserva de imprevistos: <strong className="text-white">${reserveBalance.toFixed(2)}</strong>{" "}
                (10% de cada gasto registrado)
              </span>
            </div>

            {emergencyData.hasDeficit && (
              <div className="space-y-2 rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-xs">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Riesgo de Déficit Proyectado</span>
                </div>
                <p className="text-neutral-300">
                  Faltan <strong className="text-white">${emergencyData.deficitAmount.toFixed(2)}</strong>{" "}
                  para cubrir <strong className="text-white">{emergencyData.targetPaymentName}</strong>.
                </p>
                <div className="rounded-lg border border-red-800/40 bg-red-900/40 p-2 text-[11px] text-red-200">
                  ⚡ Meta sugerida: Incrementar{" "}
                  <strong>+${emergencyData.suggestedDailyIncrease.toFixed(2)}/día</strong> en los{" "}
                  {emergencyData.daysRemaining} días laborables restantes.
                </div>
              </div>
            )}

            <FinanceRegisterTable />
          </div>
        )}
        {activeTab === "plan" && (
          <div className="space-y-3">
            <div className="space-y-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Superávit Invertible
              </span>
              <div className="text-2xl font-extrabold text-green-400">${surplus.toFixed(2)}</div>
              <p className="flex items-center gap-1 text-[11px] text-neutral-400">
                <ShieldCheck className="size-3.5 text-green-400" />{" "}
                {isSafe ? "Fondo de reserva de imprevistos cubierto" : "Reserva de seguridad bloqueada"}
              </p>
            </div>
            <UpcomingBillsForm />
          </div>
        )}

        {activeTab === "gastos" && (
          <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase text-white">
              <PlusCircle className="size-4 text-yellow-300" />
              Registrar Nuevo Gasto Operativo
            </h3>
            <ExpenseRegisterForm />
          </div>
        )}
      </div>
    </div>
  )
}



