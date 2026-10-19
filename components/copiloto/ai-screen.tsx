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
    label: "How much do I earn per hour?",
    prompt: "How much am I earning per hour (gross and net)? Analyze my hours worked and performance.",
  },
  {
    icon: Zap,
    label: "Analizar rentabilidad",
    prompt: "Analyze my total profitability comparing gross income, fares, commissions and expenses.",
  },
  {
    icon: Receipt,
    label: "Deductible expenses",
    prompt: "Which expenses are 100% tax-deductible (fuel, tolls, insurance)?",
  },
  {
    icon: Car,
    label: "Gas savings",
    prompt: "How can I cut fuel consumption and maximize my net margin?",
  },
  {
    icon: AlertTriangle,
    label: "How much is left to collect?",
    prompt:
      "Analyze my trips and reconciliations: how much is left to collect, from which platforms, and which specific trips have mismatches?",
  },
  {
    icon: Receipt,
    label: "This month's deductibles",
    prompt:
      "Summarize this month's tax-deductible expenses by category, with totals and tips.",
  },
  {
    icon: Sparkles,
    label: "Analyze my expenses",
    prompt:
      "[EXPENSE ANALYSIS] Review all my expenses: check each one is in the right category and classify them as business (deductible) or personal. Fix the wrong ones.",
  },
  {
    icon: Scale,
    label: "How to reconcile today",
    prompt:
      "Walk me step by step through reconciling today's earnings into MONEY (projection replacement, no duplicates) and what to check before touching the button.",
  },
  {
    icon: TrendingUp,
    label: "Day summary",
    prompt:
      "Give me an executive summary of today: trips, net by platform, expenses, and anything pending collection or classification.",
  },
]

const AI_HISTORY_KEY = "claris_ai_history"
const AI_HISTORY_LIMIT = 60

function welcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "👋 Hi. I'm your financial Copilot.\n\nI can help with:\n• Earnings, net, per hour and per platform\n• Expenses: category, Business vs Personal, deductibles\n• Reconcile today's earnings and mismatches\n• Reconcile with the bank (statement CSV)\n• Schedule payments/income in the ledger\n• Ideas for the day, tolls, fuel and reports\n\nWrite below or use a quick action.",
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
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
  // Schedules pendientes de aprobación (regla de gobernanza: no aplicar sin "sí").
  const [pendingSchedules, setPendingSchedules] = useState<ScheduledEntry[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bankFileRef = useRef<HTMLInputElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)

  // Subir foto al asistente: la analiza con Gemini y propone el bill/gasto para guardar.
  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || loading) return
    // Comprimir como el scanner (máx 1600px, JPEG 0.82) para no saturar el API.
    const comprimir = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(f)
        img.onload = () => {
          try {
            const maxDim = 1600
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
            const c = document.createElement("canvas")
            c.width = Math.round(img.width * scale)
            c.height = Math.round(img.height * scale)
            c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height)
            URL.revokeObjectURL(url)
            resolve(c.toDataURL("image/jpeg", 0.82))
          } catch (err) {
            URL.revokeObjectURL(url)
            reject(err)
          }
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error("No se pudo leer la imagen"))
        }
        img.src = url
      })
    let dataUrl: string
    try {
      dataUrl = await comprimir(file)
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: "No pude comprimir la foto.", time: new Date().toLocaleTimeString() },
      ])
      return
    }
    if (!dataUrl.startsWith("data:image/")) return
    const now = new Date().toLocaleTimeString()
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: "📷 Foto enviada al asistente", time: now }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      // Usar el endpoint de scan probado (devuelve vendor, amount, date, category).
      const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/)
      if (!m) throw new Error("bad image")
      const scanRes = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: m[2], mimeType: m[1] }),
      })
      const scan = await scanRes.json()
      if (!scanRes.ok || !scan || typeof scan.amount !== "number" || !(scan.amount > 0)) {
        throw new Error(scan?.error || "no data")
      }
      const sched = {
        kind: "expense" as const,
        description: String(scan.vendor || "Scanned bill"),
        category: String(scan.category || "Other"),
        amount: Number(scan.amount),
        startDate: String(scan.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
        frequency: "once" as const,
        nextDate: String(scan.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
        active: true,
      }
      let appliedNote = ""
      if (onApplySchedules) {
        onApplySchedules([sched])
        appliedNote = `\n\n✅ GUARDADO: ${sched.description} $${sched.amount.toFixed(2)} para el ${sched.startDate} en Proyecciones.`
      }
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `Leí la foto: ${sched.description} — $${sched.amount.toFixed(2)} (${sched.category}), fecha ${sched.startDate}.` + appliedNote,
        time: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: "No pude leer la foto. Intenta de nuevo.", time: new Date().toLocaleTimeString() },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleBankFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseBankCsv(text)
      if (!rows || rows.length === 0) {
        window.alert(
          "Couldn't read transactions from the file. Expected format (CSV): date, description, amount.",
        )
        return
      }
      setBankCsvName(file.name)
      const movimientos = rows
        .map((r) => `${r.date} | ${r.description} | ${r.amount >= 0 ? "+" : "-"}$${Math.abs(r.amount).toFixed(2)}`)
        .join("\n")
      sendMessage(
        `[BANK RECONCILIATION] I uploaded ${rows.length} bank transactions (${file.name}). Compare them with my trips and expenses, and tell me:\n` +
          `1) which transactions match trip payouts received (by amount and close date)\n` +
          `2) which transactions match my recorded expenses\n` +
          `3) differences, mismatches and under/over payments\n` +
          `4) transactions with no match\n\n` +
          `BANK TRANSACTIONS:\n${movimientos}`,
      )
    } catch {
      window.alert("Couldn't read the file.")
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
      tripsSummary: `${totalTrips} recorded trips: $${totalGross.toFixed(2)} gross, fees $${totalPlatformFees.toFixed(2)}, net payout $${netPayout.toFixed(2)}. Horas estimadas: ${estimatedHoursSpan}h. Ganancia/h: $${grossPerHour}/h bruto, $${netPerHour}/h neto.`,
      expensesSummary: `${expenses.length} expenses totaling $${totalExpenses.toFixed(2)} (${topCategory}). Profit after expenses: $${netProfit.toFixed(2)}.`,
      reconciliationSummary: `Reconciliation: expected $${recon.expected.toFixed(2)}, received $${recon.received.toFixed(2)}, difference $${recon.diff.toFixed(2)}. ${recon.pendingCount} unpaid, ${recon.shortCount} short, ${recon.overCount} over.`,
      financeSummaryText: `Finances: balance $${startingBalance.toFixed(2)}, reserve $${reserveBalance.toFixed(2)}, bills $${upcomingBillsTotal.toFixed(2)}, pending tolls $${unpaidTollsTotal.toFixed(2)}.`,
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

    // Aprobación de pendientes: "sí", "sí apruebo", "dale", "ok" → aplicar sin llamar al API.
    const esAprobacion = /^(s[ií][\s,.]*|sí[\s,.]*apruebo|dale|ok|aprobado)/i.test(content)
    if (esAprobacion && pendingSchedules.length > 0 && onApplySchedules) {
      const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content, time: now }
      const applied = onApplySchedules(pendingSchedules)
      setPendingSchedules([])
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `✅ Aplicado: ${applied} pago${applied === 1 ? "" : "s"} guardado${applied === 1 ? "" : "s"} en Proyecciones. ¿Algo más?`,
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        },
      ])
      setInput("")
      return
    }

    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
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
        let algoSeGuardo = false
        const matches = data.structured?.matches
        if (Array.isArray(matches) && matches.length > 0 && onApplyBankMatches) {
          const applied = onApplyBankMatches(matches)
          if (applied > 0) algoSeGuardo = true
          appliedNote = `\n\n✅ UPDATED: ${applied} trip${applied === 1 ? "" : "s"} with the bank payment.`
        }
        const schedules = data.structured?.schedules
        if (Array.isArray(schedules) && schedules.length > 0 && onApplySchedules) {
          // Gobernanza: si pide confirmación, guardar como pendiente (no aplicar todavía).
          if (data.structured?.needsConfirmation) {
            setPendingSchedules(schedules)
          } else {
            const applied = onApplySchedules(schedules)
            if (applied > 0) algoSeGuardo = true
            appliedNote += `\n\n✅ FINANCE: ${applied} schedule${applied === 1 ? "" : "es"} created${applied === 1 ? "" : "s"}.`
          }
        }
        const expenseUpdates = data.structured?.expenseUpdates
        if (Array.isArray(expenseUpdates) && expenseUpdates.length > 0 && onApplyExpenseUpdates) {
          const applied = onApplyExpenseUpdates(expenseUpdates)
          if (applied > 0) algoSeGuardo = true
          appliedNote += `\n\n🏷️ EXPENSES: ${applied} correction${applied === 1 ? "" : "es"} (category / Business-Personal).`
        }
        // VERIFICACIÓN: si el AI dice "guardado/registrado" pero nada se guardó, corregirlo.
        let replyText = data.reply
        const aiDiceGuardado = /registrad[oa]|guardad[oa]|listo|hecho/i.test(replyText)
        if (aiDiceGuardado && !algoSeGuardo && pendingSchedules.length === 0) {
          replyText += "\n\n⚠️ Nota: no se guardó nada todavía. Si ves este mensaje, dime qué falló."
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: replyText + appliedNote,
            time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: `⚠️ Error: ${data.error || "Couldn't get a response"}`,
            time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Connection error talking to the assistant.",
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
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
            if (window.confirm("Delete the whole saved conversation with the copilot?")) {
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
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quick access</p>
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
        <input
          ref={photoFileRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoFile}
          className="hidden"
        />
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => bankFileRef.current?.click()}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-950/40 py-2 text-[11px] font-bold text-sky-300 transition hover:bg-sky-900/40 disabled:opacity-50"
          >
            <Scale className="size-3.5" />
            {bankCsvName ? `Bank: ${bankCsvName}` : "Reconcile bank (CSV)"}
          </button>
          <button
            type="button"
            onClick={() => photoFileRef.current?.click()}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-950/40 py-2 text-[11px] font-bold text-violet-300 transition hover:bg-violet-900/40 disabled:opacity-50"
          >
            <Receipt className="size-3.5" />
            {loading ? "Reading..." : "Send photo"}
          </button>
        </div>

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
            placeholder="Write here… (Enter sends, Shift+Enter new line)"
            disabled={loading}
            className="max-h-28 min-h-[52px] flex-1 resize-none rounded-2xl border border-neutral-700 bg-neutral-900 px-3.5 py-3 text-[14px] leading-snug text-white placeholder-neutral-500 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black transition active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
