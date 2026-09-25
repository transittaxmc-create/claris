"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Sparkles, Send, Loader2, Bot, User, TrendingUp, Receipt, Car, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Trip, Expense } from "./types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  time: string
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Analizar rentabilidad",
    prompt: "Analiza mi rentabilidad comparando ingresos y gastos.",
  },
  {
    icon: Receipt,
    label: "Gastos deducibles",
    prompt: "¿Qué gastos son deducibles al 100% de impuestos?",
  },
  {
    icon: Zap,
    label: "Consejos de propinas",
    prompt: "¿Qué estrategias sirven para aumentar mis propinas?",
  },
  {
    icon: Car,
    label: "Ahorro de gasolina",
    prompt: "¿Cómo puedo reducir el consumo de combustible?",
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
    const totalIncome = trips.reduce(
      (acc, t) => acc + (t.earnings || 0) + (t.tips || 0) + (t.extraCash || 0),
      0,
    )
    const totalTips = trips.reduce((acc, t) => acc + (t.tips || 0), 0)
    const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0)
    const netProfit = totalIncome - totalExpenses

    const expByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + (e.amount || 0)
    }
    const topCategory =
      Object.entries(expByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "Ninguna"

    return {
      tripsCount: totalTrips,
      totalIncome,
      totalTips,
      totalExpenses,
      netProfit,
      topExpenseCategory: topCategory,
      tripsSummary: `${totalTrips} viajes registrados totalizando $${totalIncome.toFixed(2)}`,
      expensesSummary: `${expenses.length} gastos registrados totalizando $${totalExpenses.toFixed(2)} (${topCategory}: mayor gasto)`,
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

        <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-right">
          <div>
            <div className="text-[9px] font-bold text-neutral-400">NETO ACTUAL</div>
            <div
              className={cn(
                "font-mono text-xs font-bold",
                metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              ${metrics.netProfit.toFixed(2)}
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

