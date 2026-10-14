"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Sparkles, Send, Loader2, Bot, User, TrendingUp, Receipt, Car, Zap, AlertTriangle, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import { grossOf, tripDateOf, daysUntil, netOf, type Trip, type Expense, type ScheduledEntry } from "./types"
import { reconSummary, reconViewOf, expectedOf, receivedOf } from "./reconciliation"
import { parseBankCsv } from "@/lib/bank-csv"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  time: string
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "¿Cuánto gano por hora?",
    prompt: "¿Cuánto estoy ganando por hora (gross y neto)? Analiza mis horas trabajadas y rendimiento.",
  },
  {
    icon: Zap,
    label: "Analizar rentabilidad",
    prompt: "Analiza mi rentabilidad total comparando ingresos brutos, tarifas, comisiones y gastos.",
  },
  {
    icon: Receipt,
    label: "Gastos deducibles",
    prompt: "¿Qué gastos son deducibles al 100% de impuestos (gasolina, peajes, seguros)?",
  },
  {
    icon: Car,
    label: "Ahorro de gasolina",
    prompt: "¿Cómo puedo reducir el consumo de combustible y maximizar mi margen neto?",
  },
  {
    icon: AlertTriangle,
    label: "¿Cuánto me falta por cobrar?",
    prompt:
      "Analiza mis viajes y reconciliaciones: ¿cuánto me falta por cobrar, de qué plataformas y cuáles son los viajes concretos con descuadre?",
  },
  {
    icon: Receipt,
    label: "Deducibles del mes",
    prompt:
      "Hazme un resumen de mis gastos deducibles de impuestos de este mes por categoría, con totales y consejos.",
  },
  {
    icon: Sparkles,
    label: "Analizar mis gastos",
    prompt:
      "[ANÁLISIS DE GASTOS] Revisa todos mis gastos: verifica que cada uno esté en la categoría correcta y clasifícalos como business (deducible) o personal. Corrige los que estén mal.",
  },
  {
    icon: Scale,
    label: "Cómo reconciliar hoy",
    prompt:
      "Explícame paso a paso cómo reconciliar los cobros de hoy hacia DINERO (reemplazo de proyección, sin duplicar) y qué debo revisar antes de tocar el botón.",
  },
  {
    icon: TrendingUp,
    label: "Resumen del día",
    prompt:
      "Dame un resumen ejecutivo de hoy: viajes, neto por plataforma, gastos, y si hay algo pendiente de cobrar o clasificar.",
  },
]

const AI_HISTORY_KEY = "claris_ai_history"
const AI_HISTORY_LIMIT = 60

function welcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "👋 Hola. Soy tu Copiloto financiero.\n\nPuedo ayudarte con:\n• Ganancias, neto, por hora y por plataforma\n• Gastos: categoría, Business vs Personal, deducibles\n• Reconciliar cobros del día y descuadres\n• Conciliar con el banco (CSV del statement)\n• Programar pagos/ingresos en el ledger\n• Ideas para el día, peajes, gasolina y reportes\n\nEscribe abajo o usa un acceso rápido.",
    time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
  }
}

function loadHistory(): Message[] | null {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.filter(
      (m): m is Message => m && typeof m.id === "string" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
  } catch {
    return null
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(messages.slice(-AI_HISTORY_LIMIT)))
  } catch {}
}

export function AIScreen({
  trips,
  expenses,
  onApplyBankMatches,
  onApplyExpenseUpdates,
  onApplySchedules,
}: {
  trips: Trip[]
  expenses: Expense[]
  onApplyBankMatches?: (matches: { tripId: string; amount: number }[]) => number
  onApplyExpenseUpdates?: (updates: { expenseId: string; category?: string; classification?: "business" | "personal" }[]) => number
  onApplySchedules?: (schedules: ScheduledEntry[]) => number
}) {
  const [messages, setMessages] = useState<Message[]>(() => loadHistory() ?? [welcomeMessage()])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [bankCsvName, setBankCsvName] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bankFileRef = useRef<HTMLInputElement>(null)

  async function handleBankFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseBankCsv(text)
      if (!rows || rows.length === 0) {
        window.alert(
          "No se pudieron leer transacciones del archivo. Formato esperado (CSV): fecha, descripción, monto.",
        )
        return
      }
      setBankCsvName(file.name)
      const movimientos = rows
        .map((r) => `${r.date} | ${r.description} | ${r.amount >= 0 ? "+" : "-"}$${Math.abs(r.amount).toFixed(2)}`)
        .join("\n")
      sendMessage(
        `[CONCILIACIÓN BANCARIA] Subí ${rows.length} transacciones de mi banco (${file.name}). Compáralas con mis viajes y gastos, y dime:\n` +
          `1) qué transacciones coinciden con pagos recibidos de viajes (por monto y fecha cercana)\n` +
          `2) qué transacciones coinciden con mis gastos registrados\n` +
          `3) diferencias, descuadres y pagos de menos o de más\n` +
          `4) transacciones sin correspondencia\n\n` +
          `TRANSACCIONES DEL BANCO:\n${movimientos}`,
      )
    } catch {
      window.alert("No se pudo leer el archivo.")
    }
  }

  const metrics = useMemo(() => {
    const totalTrips = trips.length
    const totalEarnings = trips.reduce((acc, t) => acc + (t.earnings || 0), 0)
    const totalTips = trips.reduce((acc, t) => acc + (t.tips || 0), 0)
    const totalExtraCash = trips.reduce((acc, t) => acc + (t.extraCash || 0), 0)
    const totalTolls = trips.reduce((acc, t) => acc + (t.toll || 0), 0)
    const totalPlatformFees = trips.reduce((acc, t) => acc + (t.platformFee || 0), 0)
    const totalGross = trips.reduce((acc, t) => acc + grossOf(t), 0)
    const netPayout = totalGross - totalPlatformFees
    const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0)
    const netProfit = netPayout - totalExpenses

    const platformBreakdown: Record<string, { count: number; total: number }> = {}
    for (const t of trips) {
      const p = t.platform || "Other"
      if (!platformBreakdown[p]) platformBreakdown[p] = { count: 0, total: 0 }
      platformBreakdown[p].count += 1
      platformBreakdown[p].total += grossOf(t)
    }

    const timesMinutes: number[] = []
    for (const t of trips) {
      if (t.time && typeof t.time === "string") {
        const parts = t.time.split(":")
        if (parts.length >= 2) {
          const hh = parseInt(parts[0], 10)
          const mm = parseInt(parts[1], 10)
          if (!isNaN(hh) && !isNaN(mm)) timesMinutes.push(hh * 60 + mm)
        }
      }
    }

    let estimatedHoursSpan = 0
    let firstTripTime = ""
    let lastTripTime = ""
    if (timesMinutes.length >= 2) {
      timesMinutes.sort((a, b) => a - b)
      const minM = timesMinutes[0]
      const maxM = timesMinutes[timesMinutes.length - 1]
      estimatedHoursSpan = Number(((Math.max(0, maxM - minM) + 25) / 60).toFixed(1))
      firstTripTime = `${String(Math.floor(minM / 60)).padStart(2, "0")}:${String(minM % 60).padStart(2, "0")}`
      lastTripTime = `${String(Math.floor(maxM / 60)).padStart(2, "0")}:${String(maxM % 60).padStart(2, "0")}`
    } else if (timesMinutes.length === 1) {
      estimatedHoursSpan = 1.0
      firstTripTime = trips[0].time || ""
      lastTripTime = trips[0].time || ""
    }

    const grossPerHour = estimatedHoursSpan > 0 ? Number((totalGross / estimatedHoursSpan).toFixed(2)) : 0
    const netPerHour = estimatedHoursSpan > 0 ? Number((netPayout / estimatedHoursSpan).toFixed(2)) : 0

    const expByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + (e.amount || 0)
    }
    const topCategory = Object.entries(expByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "Ninguna"

    const recentTripsList = trips.slice(-50).map((t) => ({
      id: t.id,
      platform: t.platform,
      date: tripDateOf(t),
      earnings: t.earnings,
      tips: t.tips,
      extraCash: t.extraCash,
      fee: t.platformFee,
      net: netOf(t),
      expected: expectedOf(t),
      received: receivedOf(t),
      time: t.time,
      pickup: t.pickup ? t.pickup.slice(0, 35) : "",
      dropoff: t.dropoff ? t.dropoff.slice(0, 35) : "",
      status: t.status,
    }))

    const expensesList = expenses.slice(-50).map((e) => ({
      id: e.id,
      vendor: e.vendor,
      category: e.category,
      amount: e.amount,
      date: e.date,
      classification: e.classification ?? null,
    }))

    const recon = reconSummary(trips)
    const reconciliationProblems = trips
      .map((t) => ({ trip: t, view: reconViewOf(t) }))
      .filter(({ view }) => view.state === "short" || view.state === "over")
      .slice(-10)
      .map(({ trip, view }) => ({
        platform: trip.platform,
        route: trip.pickup && trip.dropoff ? `${trip.pickup.slice(0, 25)} → ${trip.dropoff.slice(0, 25)}` : "— → —",
        date: tripDateOf(trip),
        expected: view.expected,
        received: view.received,
        diff: view.diff,
        state: view.state,
      }))

    const readJson = (key: string): any => {
      try {
        return JSON.parse(localStorage.getItem(key) || "null")
      } catch {
        return null
      }
    }
    const financeWeek = readJson("claris_finance_week_v1")
    const startingBalance = Number(financeWeek?.startingBalance) || 0
    const reserveBalance = Number(financeWeek?.reserveBalance) || 0
    const upcomingExpenses = Array.isArray(financeWeek?.upcomingExpenses) ? financeWeek.upcomingExpenses : []
    const upcomingBillsTotal = upcomingExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0)
    const unpaidTollBills = (Array.isArray(readJson("claris_toll_bills")) ? readJson("claris_toll_bills") : []).filter(
      (b: any) => b?.status === "unpaid",
    )
    const unpaidTollsTotal = unpaidTollBills.reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0)
    const scheduledAll = Array.isArray(readJson("claris_scheduled_entries")) ? readJson("claris_scheduled_entries") : []
    const scheduledDueSoon = scheduledAll
      .filter((s: any) => s?.kind === "expense" && s?.active !== false && s?.nextDate)
      .map((s: any) => ({ description: s.description, amount: Number(s.amount) || 0, nextDate: s.nextDate, days: daysUntil(s.nextDate) }))
      .filter((s: any) => s.days >= -1 && s.days <= 7)
      .sort((a: any, b: any) => a.days - b.days)

    return {
      tripsCount: totalTrips,
      totalGross,
      netPayout,
      netProfit,
      totalEarnings,
      totalTips,
      totalExtraCash,
      totalTolls,
      totalPlatformFees,
      totalExpenses,
      topExpenseCategory: topCategory,
      platformBreakdown,
      estimatedHoursSpan,
      firstTripTime,
      lastTripTime,
      grossPerHour,
      netPerHour,
      recentTripsList,
      expensesList,
      reconciliation: {
        expected: recon.expected,
        received: recon.received,
        diff: recon.diff,
        pendingCount: recon.pendingCount,
        shortCount: recon.shortCount,
        overCount: recon.overCount,
        okCount: recon.okCount,
        problemCount: recon.problemCount,
      },
      reconciliationProblems,
      finance: { startingBalance, reserveBalance, upcomingBillsTotal, unpaidTollsTotal, unpaidTollBillCount: unpaidTollBills.length, scheduledCount: scheduledAll.length, scheduledDueSoon },
      tripsSummary: `${totalTrips} viajes registrados: $${totalGross.toFixed(2)} brutos, comisiones $${totalPlatformFees.toFixed(2)}, pago neto $${netPayout.toFixed(2)}. Horas estimadas: ${estimatedHoursSpan}h. Ganancia/h: $${grossPerHour}/h bruto, $${netPerHour}/h neto.`,
      expensesSummary: `${expenses.length} gastos totalizando $${totalExpenses.toFixed(2)} (${topCategory}). Beneficio tras gastos: $${netProfit.toFixed(2)}.`,
      reconciliationSummary: `Reconciliación: esperado $${recon.expected.toFixed(2)}, recibido $${recon.received.toFixed(2)}, diferencia $${recon.diff.toFixed(2)}. ${recon.pendingCount} sin pago, ${recon.shortCount} de menos, ${recon.overCount} de más.`,
      financeSummaryText: `Finanzas: saldo $${startingBalance.toFixed(2)}, reserva $${reserveBalance.toFixed(2)}, facturas $${upcomingBillsTotal.toFixed(2)}, peajes pendientes $${unpaidTollsTotal.toFixed(2)}.`,
    }
  }, [trips, expenses])

  useEffect(() => {
    const box = messagesScrollRef.current
    if (box) box.scrollTop = box.scrollHeight
    else messagesEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages, loading])

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend || input).trim()
    if (!content || loading) return

    const now = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content, time: now }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          context: metrics,
        }),
      })

      const data = await response.json()
      if (response.ok && data.reply) {
        let appliedNote = ""
        const matches = data.structured?.matches
        if (Array.isArray(matches) && matches.length > 0 && onApplyBankMatches) {
          const applied = onApplyBankMatches(matches)
          appliedNote = `\n\n✅ ACTUALIZADO: ${applied} viaje${applied === 1 ? "" : "s"} con el pago del banco.`
        }
        const schedules = data.structured?.schedules
        if (Array.isArray(schedules) && schedules.length > 0 && onApplySchedules) {
          const applied = onApplySchedules(schedules)
          appliedNote += `\n\n✅ FINANCE: ${applied} programación${applied === 1 ? "" : "es"} creada${applied === 1 ? "" : "s"}.`
        }
        const expenseUpdates = data.structured?.expenseUpdates
        if (Array.isArray(expenseUpdates) && expenseUpdates.length > 0 && onApplyExpenseUpdates) {
          const applied = onApplyExpenseUpdates(expenseUpdates)
          appliedNote += `\n\n🏷️ GASTOS: ${applied} corrección${applied === 1 ? "" : "es"} (categoría / Business-Personal).`
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply + appliedNote,
            time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: `⚠️ Error: ${data.error || "No se pudo obtener respuesta"}`,
            time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Error de conexión al consultar el asistente.",
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl border border-yellow-500/30 bg-gradient-to-tr from-yellow-500/20 to-amber-500/30">
            <Sparkles className="size-4 text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-wide text-white">GEMINI COPILOTO</h1>
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                ONLINE
              </span>
            </div>
            <p className="text-[10px] font-medium text-neutral-400">Asistente Contable y Fiscal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("¿Borrar toda la conversación guardada con el copiloto?")) {
              try {
                localStorage.removeItem(AI_HISTORY_KEY)
              } catch {}
              setMessages([welcomeMessage()])
            }
          }}
          className="rounded-xl border border-neutral-700 bg-neutral-900/60 px-2 py-1.5 text-[10px] font-bold text-neutral-400 hover:text-white"
        >
          LIMPIAR
        </button>
      </div>

      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]"
      >
        {messages.map((m) => {
          const isUser = m.role === "user"
          return (
            <div
              key={m.id}
              className={cn("flex max-w-[90%] gap-2.5", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                  isUser ? "border-neutral-700 bg-neutral-800 text-neutral-300" : "border-yellow-400/30 bg-yellow-400/20 text-yellow-300",
                )}
              >
                {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>
              <div className="space-y-1">
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug",
                    isUser
                      ? "rounded-tr-sm bg-yellow-400 text-black"
                      : "rounded-tl-sm border border-neutral-800 bg-neutral-900 text-neutral-200",
                  )}
                >
                  {m.content}
                </div>
                <p className={cn("text-[9px] text-neutral-600", isUser && "text-right")}>{m.time}</p>
              </div>
            </div>
          )
        })}
        {loading && (
          <div className="mr-auto flex max-w-[85%] gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-yellow-400/30 bg-yellow-400/20 text-yellow-300">
              <Bot className="size-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs text-neutral-400">
              <Loader2 className="size-3.5 animate-spin text-yellow-400" />
              Pensando…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && (
        <div className="shrink-0 px-3 pb-1 pt-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Accesos rápidos</p>
          <div className="grid max-h-28 grid-cols-2 gap-1.5 overflow-y-auto">
            {QUICK_PROMPTS.map((qp) => {
              const Icon = qp.icon
              return (
                <button
                  key={qp.label}
                  type="button"
                  onClick={() => sendMessage(qp.prompt)}
                  className="flex items-center gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-2 text-left transition hover:border-neutral-700 hover:bg-neutral-800/60"
                >
                  <Icon className="size-3.5 shrink-0 text-yellow-400" />
                  <span className="text-[11px] font-semibold leading-tight text-neutral-300">{qp.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-neutral-800 bg-neutral-950 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <input
          ref={bankFileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={handleBankFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => bankFileRef.current?.click()}
          disabled={loading}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-950/40 py-2 text-[11px] font-bold text-sky-300 transition hover:bg-sky-900/40 disabled:opacity-50"
        >
          <Scale className="size-3.5" />
          {bankCsvName ? `Banco: ${bankCsvName}` : "Conciliar banco (CSV)"}
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              window.setTimeout(() => {
                const box = messagesScrollRef.current
                if (box) box.scrollTop = box.scrollHeight
                inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
              }, 300)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Escribe aquí… (Enter envía, Shift+Enter nueva línea)"
            disabled={loading}
            className="max-h-28 min-h-[52px] flex-1 resize-none rounded-2xl border border-neutral-700 bg-neutral-900 px-3.5 py-3 text-[14px] leading-snug text-white placeholder-neutral-500 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black transition active:scale-95 disabled:opacity-40"
            aria-label="Enviar"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
