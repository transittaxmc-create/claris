"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Sparkles, Send, Loader2, Bot, User, TrendingUp, Receipt, Car, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { grossOf, type Trip, type Expense } from "./types"

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
]

export function AIScreen({
  trips,
  expenses,
}: {
  trips: Trip[]
  expenses: Expense[]
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 ¡Hola! Soy tu Copiloto Financiero con Gemini AI. Tengo acceso en tiempo real a tus viajes y gastos registrados.\n\n¿En qué te puedo ayudar hoy? Puedes preguntarme sobre tus ganancias netas, qué gastos deducir de impuestos o cómo optimizar tu día.",
      time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const metrics = useMemo(() => {
    const totalTrips = trips.length

    // Se usan grossOf/netOf de types.ts en vez de repetir la aritmética aquí.
    // Antes este bloque calculaba su propio "bruto" y su propio "neto", y no
    // coincidían con REGISTER: el neto se comía los peajes y no restaba el
    // platformFee, así que la IA reportaba un número distinto al de la pantalla
    // de registro para los mismos viajes.
    const totalEarnings = trips.reduce((acc, t) => acc + (t.earnings || 0), 0)
    const totalTips = trips.reduce((acc, t) => acc + (t.tips || 0), 0)
    const totalExtraCash = trips.reduce((acc, t) => acc + (t.extraCash || 0), 0)
    const totalTolls = trips.reduce((acc, t) => acc + (t.toll || 0), 0)
    const totalPlatformFees = trips.reduce((acc, t) => acc + (t.platformFee || 0), 0)
    const totalGross = trips.reduce((acc, t) => acc + grossOf(t), 0)
    // Lo que realmente te pagan: bruto menos comisiones. Es el TOTAL NET de REGISTER.
    const netPayout = totalGross - totalPlatformFees
    const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0)
    // Lo que te queda de verdad después de gastos. Ojo: no es el "neto" de
    // REGISTER, que solo descuenta comisiones de plataforma.
    const netProfit = netPayout - totalExpenses

    // Agrupación por plataforma, con el mismo bruto canónico que REGISTER
    const platformBreakdown: Record<string, { count: number; total: number }> = {}
    for (const t of trips) {
      const p = t.platform || "Other"
      if (!platformBreakdown[p]) platformBreakdown[p] = { count: 0, total: 0 }
      platformBreakdown[p].count += 1
      platformBreakdown[p].total += grossOf(t)
    }

    // Análisis de tiempos y estimación de horas
    const timesMinutes: number[] = []
    for (const t of trips) {
      if (t.time && typeof t.time === "string") {
        const parts = t.time.split(":")
        if (parts.length >= 2) {
          const hh = parseInt(parts[0], 10)
          const mm = parseInt(parts[1], 10)
          if (!isNaN(hh) && !isNaN(mm)) {
            timesMinutes.push(hh * 60 + mm)
          }
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
      const diffMinutes = Math.max(0, maxM - minM)
      // Agregamos un buffer típico estimado por el último viaje (~25 min)
      estimatedHoursSpan = Number(((diffMinutes + 25) / 60).toFixed(1))
      firstTripTime = `${String(Math.floor(minM / 60)).padStart(2, "0")}:${String(minM % 60).padStart(2, "0")}`
      lastTripTime = `${String(Math.floor(maxM / 60)).padStart(2, "0")}:${String(maxM % 60).padStart(2, "0")}`
    } else if (timesMinutes.length === 1) {
      estimatedHoursSpan = 1.0 // 1 hora base para 1 viaje
      firstTripTime = trips[0].time || ""
      lastTripTime = trips[0].time || ""
    }

    // Tasa por hora calculada basada en el lapso de viajes.
    // netPerHour usa el pago neto (bruto − comisiones), no el beneficio tras
    // gastos: es la magnitud comparable con grossPerHour.
    const grossPerHour = estimatedHoursSpan > 0 ? Number((totalGross / estimatedHoursSpan).toFixed(2)) : 0
    const netPerHour = estimatedHoursSpan > 0 ? Number((netPayout / estimatedHoursSpan).toFixed(2)) : 0

    const expByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + (e.amount || 0)
    }
    const topCategory =
      Object.entries(expByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "Ninguna"

    // Mapeo detallado de viajes recientes para que la IA los examine minuciosamente
    const recentTripsList = trips.slice(-15).map((t) => ({
      platform: t.platform,
      earnings: t.earnings,
      tips: t.tips,
      extraCash: t.extraCash,
      fee: t.platformFee,
      time: t.time,
      pickup: t.pickup ? t.pickup.slice(0, 35) : "",
      dropoff: t.dropoff ? t.dropoff.slice(0, 35) : "",
      status: t.status,
    }))

    const expensesList = expenses.slice(-10).map((e) => ({
      vendor: e.vendor,
      category: e.category,
      amount: e.amount,
      date: e.date,
    }))

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
      tripsSummary: `${totalTrips} viajes registrados: $${totalGross.toFixed(2)} brutos (earnings $${totalEarnings.toFixed(2)} + propinas $${totalTips.toFixed(2)} + extra $${totalExtraCash.toFixed(2)} + peajes $${totalTolls.toFixed(2)}), comisiones de plataforma $${totalPlatformFees.toFixed(2)}, pago neto $${netPayout.toFixed(2)}. ${totalTips > 0 ? `Propinas: $${totalTips.toFixed(2)}.` : "Sin propinas."} Horas estimadas: ${estimatedHoursSpan}h (desde ${firstTripTime || "N/A"} hasta ${lastTripTime || "N/A"}). Ganancia/h estimada: $${grossPerHour}/h bruto, $${netPerHour}/h neto.`,
      expensesSummary: `${expenses.length} gastos registrados totalizando $${totalExpenses.toFixed(2)} (${topCategory}: mayor categoría). Beneficio tras gastos: $${netProfit.toFixed(2)}.`,
    }
  }, [trips, expenses])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])
  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend || input).trim()
    if (!content || loading) return

    const now = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      time: now,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: metrics,
        }),
      })

      const data = await response.json()
      if (response.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply,
            time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: `⚠️ Error en Gemini AI: ${data.error || "No se pudo obtener respuesta"}`,
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
    <div className="flex h-full flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-yellow-500/20 to-amber-500/30 border border-yellow-500/30">
            <Sparkles className="size-4 text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-white tracking-wide">GEMINI COPILOTO</h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-medium">Asistente Contable y Fiscal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {metrics.estimatedHoursSpan > 0 && (
            <div className="hidden sm:flex flex-col items-end rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-right">
              <div className="text-[9px] font-bold text-neutral-400">GANANCIA / HORA</div>
              <div className="font-mono text-xs font-bold text-yellow-400">
                ${metrics.grossPerHour}/h
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-right">
            <div>
              {/* Mismo número que el TOTAL NET de REGISTER: bruto − comisiones.
                  Los gastos no entran aquí, para que las dos pantallas cuadren. */}
              <div className="text-[9px] font-bold text-neutral-400">NETO ACTUAL</div>
              <div
                className={cn(
                  "font-mono text-xs font-bold",
                  metrics.netPayout >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                ${metrics.netPayout.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => {
          const isUser = m.role === "user"
          return (
            <div
              key={m.id}
              className={cn("flex gap-2.5 max-w-[90%]", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  isUser
                    ? "bg-neutral-800 text-neutral-200 border border-neutral-700"
                    : "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30",
                )}
              >
                {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>

              <div className="space-y-1">
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                    isUser
                      ? "bg-yellow-400 text-black font-medium rounded-tr-sm"
                      : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-sm",
                  )}
                >
                  {m.content}
                </div>
                <div
                  className={cn(
                    "text-[9px] text-neutral-500 font-mono px-1",
                    isUser ? "text-right" : "text-left",
                  )}
                >
                  {m.time}
                </div>
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex gap-2.5 mr-auto max-w-[85%]">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
              <Bot className="size-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs text-neutral-400">
              <Loader2 className="size-3.5 animate-spin text-yellow-400" />
              <span>Analizando datos con Gemini...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 pt-1">
          <p className="mb-2 text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
            Preguntas sugeridas:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_PROMPTS.map((qp, idx) => {
              const Icon = qp.icon
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(qp.prompt)}
                  className="flex items-center gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-2 text-left transition hover:border-neutral-700 hover:bg-neutral-800/60"
                >
                  <Icon className="size-3.5 shrink-0 text-yellow-400" />
                  <span className="text-[11px] font-semibold text-neutral-300 leading-tight">
                    {qp.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-neutral-800 bg-neutral-950 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta a tu copiloto sobre tus finanzas..."
            disabled={loading}
            className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-black font-bold transition hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}

