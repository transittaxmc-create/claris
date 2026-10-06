"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Sparkles, Send, Loader2, Bot, User, TrendingUp, Receipt, Car, Zap, AlertTriangle, Scale, Mic, Volume2, X } from "lucide-react"
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

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
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
]

// Historial de la conversación con el copiloto: se conserva entre sesiones para
// poder dar seguimiento a los análisis y reportes. Se limita a los últimos 60
// mensajes para no llenar el almacenamiento.
const AI_HISTORY_KEY = "claris_ai_history"
const AI_HISTORY_LIMIT = 60

function welcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "👋 ¡Hola! Soy tu Copiloto Financiero con Gemini AI. Tengo acceso en tiempo real a tus viajes y gastos registrados.\n\n¿En qué te puedo ayudar hoy? Puedes preguntarme sobre tus ganancias netas, qué gastos deducir de impuestos o cómo optimizar tu día.",
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
  currentSection = "Copiloto",
  onClose,
  onApplyBankMatches,
  onApplyExpenseUpdates,
  onApplySchedules,
}: {
  trips: Trip[]
  expenses: Expense[]
  currentSection?: string
  onClose?: () => void
  // La conciliación bancaria devuelve matches {tripId, amount}: el padre los
  // aplica a los viajes (received) y persiste.
  onApplyBankMatches?: (matches: { tripId: string; amount: number }[]) => number
  // El análisis de gastos devuelve correcciones {expenseId, category?,
  // classification?}: el padre las aplica a los gastos y persiste.
  onApplyExpenseUpdates?: (updates: { expenseId: string; category?: string; classification?: "business" | "personal" }[]) => number
  onApplySchedules?: (schedules: ScheduledEntry[]) => number
}) {
  const [messages, setMessages] = useState<Message[]>(() => loadHistory() ?? [welcomeMessage()])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [bankCsvName, setBankCsvName] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const bankFileRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(
    () => () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    },
    [],
  )

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const voiceWindow = window as SpeechWindow
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceNote("El dictado por voz no está disponible en este navegador. Puedes escribir tu pregunta.")
      return
    }

    setVoiceNote("El navegador procesará tu voz para transcribirla; revisa el texto antes de enviarlo a Claris AI.")
    try {
      const recognition = new Recognition()
      recognition.lang = "es-US"
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .filter((result) => result.isFinal)
          .map((result) => result[0].transcript.trim())
          .filter(Boolean)
          .join(" ")
        if (transcript) setInput((current) => [current.trim(), transcript].filter(Boolean).join(" "))
      }
      recognition.onerror = (event) => {
        setVoiceNote(
          event.error === "not-allowed"
            ? "Permite el acceso al micrófono en el navegador para dictar."
            : "No se pudo reconocer la voz. Inténtalo de nuevo o escribe tu pregunta.",
        )
        setListening(false)
      }
      recognition.onend = () => setListening(false)
      recognitionRef.current = recognition
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
      setVoiceNote("No se pudo iniciar el micrófono. Inténtalo de nuevo o escribe tu pregunta.")
    }
  }

  function readAloud(text: string) {
    if (!("speechSynthesis" in window)) {
      setVoiceNote("La lectura en voz alta no está disponible en este navegador.")
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "es-US"
    window.speechSynthesis.speak(utterance)
  }

  // Parser tolerante de estados de cuenta: vive en lib/bank-csv.ts (puro y
  // probado en Node), aquí solo se consume.

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

    // Mapeo detallado de viajes recientes para que la IA los examine minuciosamente.
    // Incluye id, fecha, esperado y recibido: son los datos que la conciliación
    // bancaria necesita para casar transacciones y ACTUALIZAR los viajes.
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

    // Reconciliación: esperado/recibido/diferencia. Es lo que le permite a la
    // IA responder "cuánto me falta por cobrar" con números reales.
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

    // Finanzas semanales + facturas: se leen de las mismas claves que usa
    // FINANCE, para que la IA y la pantalla vean lo mismo.
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

    // Pagos programados con vencimiento próximo: la IA puede recordarlos.
    const scheduledAll = Array.isArray(readJson("claris_scheduled_entries")) ? readJson("claris_scheduled_entries") : []
    const scheduledDueSoon = scheduledAll
      .filter((s: any) => s?.kind === "expense" && s?.active !== false && s?.nextDate)
      .map((s: any) => ({ description: s.description, amount: Number(s.amount) || 0, nextDate: s.nextDate, days: daysUntil(s.nextDate) }))
      .filter((s: any) => s.days >= -1 && s.days <= 7)
      .sort((a: any, b: any) => a.days - b.days)

    const financeSummary = {
      startingBalance,
      reserveBalance,
      upcomingBillsTotal,
      unpaidTollsTotal,
      unpaidTollBillCount: unpaidTollBills.length,
      scheduledCount: scheduledAll.length,
      scheduledDueSoon,
    }

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
      // Reconciliación y finanzas: lo nuevo para el asistente.
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
      finance: financeSummary,
      currentSection,
      tripsSummary: `${totalTrips} viajes registrados: $${totalGross.toFixed(2)} brutos (earnings $${totalEarnings.toFixed(2)} + propinas $${totalTips.toFixed(2)} + extra $${totalExtraCash.toFixed(2)} + peajes $${totalTolls.toFixed(2)}), comisiones de plataforma $${totalPlatformFees.toFixed(2)}, pago neto $${netPayout.toFixed(2)}. ${totalTips > 0 ? `Propinas: $${totalTips.toFixed(2)}.` : "Sin propinas."} Horas estimadas: ${estimatedHoursSpan}h (desde ${firstTripTime || "N/A"} hasta ${lastTripTime || "N/A"}). Ganancia/h estimada: $${grossPerHour}/h bruto, $${netPerHour}/h neto.`,
      expensesSummary: `${expenses.length} gastos registrados totalizando $${totalExpenses.toFixed(2)} (${topCategory}: mayor categoría). Beneficio tras gastos: $${netProfit.toFixed(2)}.`,
      reconciliationSummary: `Reconciliación de pagos: esperado $${recon.expected.toFixed(2)}, recibido $${recon.received.toFixed(2)}, diferencia $${recon.diff.toFixed(2)}. ${recon.pendingCount} viajes sin pago registrado, ${recon.shortCount} pagaron de menos, ${recon.overCount} pagaron de más, ${recon.okCount} cuadran.`,
      financeSummaryText: `Finanzas semanales: saldo disponible $${startingBalance.toFixed(2)}, reserva $${reserveBalance.toFixed(2)}, facturas próximas $${upcomingBillsTotal.toFixed(2)}, peajes pendientes $${unpaidTollsTotal.toFixed(2)} (${unpaidTollBills.length} facturas). Pagos programados con vencimiento en 7 días: ${scheduledDueSoon.length === 0 ? "ninguno" : scheduledDueSoon.map((s: any) => `${s.description} $${s.amount.toFixed(2)} (${s.days < 0 ? "vencido" : s.days === 0 ? "hoy" : `en ${s.days}d`})`).join(", ")}.`,
    }
  }, [trips, expenses, currentSection])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Seguimiento: cada mensaje (pregunta, respuesta o reporte) se guarda para
  // que la conversación sobreviva a un recargado o al cierre de la app.
  useEffect(() => {
    saveHistory(messages)
  }, [messages])
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
        // Actualizaciones estructuradas de la IA: pagos del banco (viajes) y
        // correcciones de gastos (categoría + business/personal).
        let appliedNote = ""
        const matches = data.structured?.matches
        if (Array.isArray(matches) && matches.length > 0 && onApplyBankMatches) {
          const applied = onApplyBankMatches(matches)
          appliedNote = `\n\n✅ ACTUALIZADO: ${applied} viaje${applied === 1 ? "" : "s"} marcado${applied === 1 ? "" : "s"} con el pago del banco. Revisa REGISTER para ver el descuadre restante.`
        }
        const schedules = data.structured?.schedules
        if (Array.isArray(schedules) && schedules.length > 0 && onApplySchedules) {
          const applied = onApplySchedules(schedules)
          appliedNote += `\\n\\n✅ FINANCE: ${applied} programación${applied === 1 ? "" : "es"} creada${applied === 1 ? "" : "s"} en el ledger programado.`
        }
        const expenseUpdates = data.structured?.expenseUpdates
        if (Array.isArray(expenseUpdates) && expenseUpdates.length > 0 && onApplyExpenseUpdates) {
          const applied = onApplyExpenseUpdates(expenseUpdates)
          appliedNote += `\n\n🏷️ GASTOS: ${applied} corrección${applied === 1 ? "" : "es"} aplicada${applied === 1 ? "" : "s"} (categoría y clasificación business/personal). Revisa EXPENSES.`
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
    <div className="screen-frame">
      {/* Top Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3">
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
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar copiloto"
              className="flex size-10 items-center justify-center rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              <X className="size-4" />
            </button>
          )}
          {/* Limpiar el historial guardado (el seguimiento empieza de nuevo) */}
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
            title="Borrar historial guardado"
          >
            LIMPIAR
          </button>
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
      <div className="screen-scroll space-y-4 p-4">
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
              <div className={cn("flex items-center gap-2 px-1", isUser ? "justify-end" : "justify-start")}>
                {!isUser && (
                  <button
                    type="button"
                    onClick={() => readAloud(m.content)}
                    aria-label="Leer respuesta en voz alta"
                    className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    <Volume2 className="size-3.5" />
                  </button>
                )}
                <span className="text-[9px] font-mono text-neutral-500">{m.time}</span>
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
        {/* Asistente de conciliación bancaria: CSV del banco -> la IA lo cruza
            con viajes y gastos usando el mismo contexto enriquecido. */}
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
          {bankCsvName ? `Conciliar banco: ${bankCsvName}` : "CONCILIAR CON EL BANCO (subir CSV del estado de cuenta)"}
        </button>

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
            placeholder="Escribe o dicta en tu teléfono una instrucción..."
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={loading}
            aria-label={listening ? "Detener dictado" : "Dictar pregunta"}
            aria-pressed={listening}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50",
              listening ? "border-rose-500 bg-rose-500/20 text-rose-300" : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-yellow-400",
            )}
          >
            <Mic className="size-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
        {voiceNote && (
          <p className="mt-2 text-[11px] leading-snug text-neutral-400" role="status">
            {voiceNote}
          </p>
        )}
      </div>
    </div>
  )
}
