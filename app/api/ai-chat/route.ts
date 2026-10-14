import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API de Gemini no configurada (GEMINI_API_KEY ausente)" },
        { status: 503 },
      )
    }

    const { messages, context } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Faltan los mensajes de conversación" }, { status: 400 })
    }

    const platformInfo = context?.platformBreakdown
      ? Object.entries(context.platformBreakdown)
          .map(([plat, stat]: [string, any]) => `${plat}: ${stat.count} viajes ($${Number(stat.total || 0).toFixed(2)})`)
          .join(", ")
      : "No especificado"

    const systemPrompt = `Eres Claris AI Copiloto, un asistente inteligente experto en contabilidad, finanzas personales, análisis de productividad y optimización de ganancias para conductores y repartidores de plataformas (Uber, Lyft, DoorDash, Aventus Ride, taxis y transporte).

REGLA CLAVE: Nunca digas que "no estás programado" o que no puedes ayudar. Siempre orienta con los datos del contexto (viajes, gastos, reconciliación, finanzas). Si falta un dato, pide el mínimo necesario y ofrece el mejor análisis posible con lo disponible.

También puedes ayudar con: resúmenes del día/semana, por plataforma, pendientes de cobro, clasificación Business vs Personal, peajes/Easy Pass como facturas, guía de reconciliar COBROS→DINERO (reemplazo sin duplicar), optimización de gasolina y horas, preparación de un financial statement, y pasos claros para el usuario en la app.

INFORMACIÓN DEL USUARIO EN TIEMPO REAL:
- Resumen General de Viajes: ${context?.tripsSummary || "Sin viajes registrados"}
- Total Viajes Registrados: ${context?.tripsCount || 0}
- Ingresos Brutos Totales (Gross): $${Number(context?.totalGross || context?.totalIncome || 0).toFixed(2)}
- Tarifas Base (Earnings): $${Number(context?.totalEarnings || 0).toFixed(2)}
- Propinas Totales (Tips): $${Number(context?.totalTips || 0).toFixed(2)}
- Extra Cash / Bonos: $${Number(context?.totalExtraCash || 0).toFixed(2)}
- Peajes Totales (Tolls): $${Number(context?.totalTolls || 0).toFixed(2)}
- Comisiones de Plataforma pagadas: $${Number(context?.totalPlatformFees || 0).toFixed(2)}
- Desglose por Plataforma: ${platformInfo}
- Resumen de Gastos: ${context?.expensesSummary || "Sin gastos registrados"}
- Total Gastos Registrados: $${Number(context?.totalExpenses || 0).toFixed(2)}
- Ganancia Neta Calculada (Net Profit): $${Number(context?.netProfit || 0).toFixed(2)}
- Categoría de Gasto Principal: ${context?.topExpenseCategory || "N/A"}

RECONCILIACIÓN DE PAGOS (esperado vs. recibido de las plataformas):
- ${context?.reconciliationSummary || "Sin datos de reconciliación"}
${Array.isArray(context?.reconciliationProblems) && context.reconciliationProblems.length > 0
  ? `- Viajes con descuadre:\n${context.reconciliationProblems.map((p: any) => `   * ${p.platform} · ${p.route} · ${p.date} · esperado $${Number(p.expected || 0).toFixed(2)} · recibido $${Number(p.received || 0).toFixed(2)} · diferencia ${Number(p.diff || 0) >= 0 ? "+" : ""}$${Number(p.diff || 0).toFixed(2)}`).join("\n")}`
  : "- Todos los pagos registrados cuadran"}

FINANZAS SEMANALES:
- ${context?.financeSummaryText || "Sin datos de finanzas semanales"}

MÉTRICAS CLAVE DE TIEMPO Y GANANCIA POR HORA (HOURLY RATE):
- Lapso de Horas Estimadas Trabajadas: ${context?.estimatedHoursSpan || 0} horas
- Primer Viaje Registrado a las: ${context?.firstTripTime || "N/A"}
- Último Viaje Registrado a las: ${context?.lastTripTime || "N/A"}
- Ganancia Bruta por Hora (Gross / hr): $${Number(context?.grossPerHour || 0).toFixed(2)}/h
- Ganancia Neta por Hora (Net / hr): $${Number(context?.netPerHour || 0).toFixed(2)}/h

LISTA DE VIAJES RECIENTES:
${JSON.stringify(context?.recentTripsList || [], null, 2)}

LISTA DE GASTOS RECIENTES:
${JSON.stringify(context?.expensesList || [], null, 2)}

TU MISIÓN:
1. Análisis de Horas y Ganancias por Hora ($/hr).
2. Consultoría Financiera y Contable.
3. Asesoría Fiscal (Taxes/Deducciones).
4. Análisis de Reconciliación de cobros.
5. Conciliación Bancaria con CSV.
6. Clasificación de gastos Business vs Personal y categorías.
7. Guía de uso de la app (COBROS→DINERO, Bill/Receipt, PDF statement).
8. Respuestas claras en el idioma del usuario. Nunca rechaces con "no estoy programado".`

    const contents = [
      {
        role: "user",
        parts: [{ text: `[INSTRUCCIONES DE SISTEMA]:\n${systemPrompt}\n\nPor favor confirma que entendiste tu rol.` }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido. Soy Claris AI Copiloto. Analizo tus viajes, gastos y reconciliación y te doy pasos claros. Nunca digo que no estoy programado." }],
      },
    ]

    for (const m of messages) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }],
      })
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
    const bankMode = String(lastUser).trimStart().startsWith("[CONCILIACIÓN BANCARIA]")
    const expenseMode = String(lastUser).trimStart().startsWith("[ANÁLISIS DE GASTOS]")
    const scheduleMode = /\b(program|programa|programar|programe|programado|programada|schedule|scheduled)\b/i.test(String(lastUser))

    let generationConfig: Record<string, unknown> = {
      temperature: 0.35,
      maxOutputTokens: 1800,
    }
    if (bankMode) {
      generationConfig = {
        temperature: 0.1,
        maxOutputTokens: 2200,
        responseMimeType: "application/json",
      }
      contents.push({
        role: "user",
        parts: [
          {
            text:
              `[FORMATO DE RESPUESTA OBLIGATORIO] Responde ÚNICAMENTE un objeto JSON válido con estas claves exactas:\n` +
              `{\n` +
              `  "reply": "texto breve en español con tu análisis",\n` +
              `  "matches": [ { "tripId": "el id exacto del viaje de la lista", "bankAmount": 85.66, "note": "UBER PAYMENT" } ],\n` +
              `  "differences": [ "descripciones cortas de descuadres o transacciones sin correspondencia" ]\n` +
              `}\n` +
              `REGLAS:\n` +
              `- matches SOLO para transacciones que coinciden con un viaje por monto (±1%) y fecha (±2 días). Usa el id exacto de la LISTA DE VIAJES RECIENTES.\n` +
              `- bankAmount = el monto que el banco pagó.\n` +
              `- differences: enumera lo que NO cuadra.\n` +
              `- reply: resume en pocas líneas.`,
          },
        ],
      })
    }

    if (scheduleMode) {
      generationConfig = {
        temperature: 0.1,
        maxOutputTokens: 2400,
        responseMimeType: "application/json",
      }
      contents.push({
        role: "user",
        parts: [{ text:
          `[ACCIÓN FINANCIERA OBLIGATORIA] El usuario quiere crear pagos o ingresos programados. Responde SOLO JSON válido con estas claves exactas:\n` +
          `{ "reply": "confirmación breve", "schedules": [ { "kind": "expense" o "income", "description": "...", "category": "...", "amount": 0, "startDate": "YYYY-MM-DD", "frequency": "once"|"daily"|"weekly"|"monthly"|"annual", "nextDate": "YYYY-MM-DD", "active": true } ], "needsConfirmation": false }\n` +
          `REGLAS: interpreta español natural. Usa la fecha actual ${new Date().toISOString().slice(0, 10)}. No inventes montos.`
        }],
      })
    }

    if (expenseMode) {
      generationConfig = {
        temperature: 0.1,
        maxOutputTokens: 2200,
        responseMimeType: "application/json",
      }
      contents.push({
        role: "user",
        parts: [
          {
            text:
              `[FORMATO DE RESPUESTA OBLIGATORIO] Responde ÚNICAMENTE un objeto JSON válido con estas claves exactas:\n` +
              `{ "reply": "texto breve", "expenseUpdates": [ { "expenseId": "id", "category": "Gasolina / Combustible", "classification": "business" } ] }\n` +
              `REGLAS: solo correcciones necesarias; classification business|personal.`,
          },
        ],
      })
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          generationConfig,
        }),
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error("[ai-chat] Gemini API error:", response.status, errText)
      return NextResponse.json(
        { error: `Error en servicio Gemini AI (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar respuesta."

    let reply = rawText
    let structured: {
      matches?: { tripId: string; amount: number }[]
      expenseUpdates?: { expenseId: string; category?: string; classification?: string }[]
      schedules?: Array<{ kind: "income" | "expense"; description: string; category?: string; amount: number; startDate: string; frequency: string; nextDate: string; active?: boolean }>
      needsConfirmation?: boolean
    } | null = null
    if (bankMode || expenseMode || scheduleMode) {
      try {
        const parsed = JSON.parse(rawText)
        reply = typeof parsed.reply === "string" && parsed.reply ? parsed.reply : rawText
        structured = {}
        if (bankMode) {
          const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : []
          structured.matches = rawMatches
            .filter((m: any) => m && typeof m.tripId === "string" && Number.isFinite(Number(m.bankAmount)))
            .map((m: any) => ({ tripId: m.tripId, amount: Number(m.bankAmount) }))
        }
        if (scheduleMode) {
          const rawSchedules = Array.isArray(parsed.schedules) ? parsed.schedules : []
          structured.schedules = rawSchedules.filter((s: any) =>
            s && (s.kind === "income" || s.kind === "expense") && typeof s.description === "string" && Number.isFinite(Number(s.amount)) && Number(s.amount) > 0 &&
            ["once", "daily", "weekly", "monthly", "annual"].includes(s.frequency) && /^\d{4}-\d{2}-\d{2}$/.test(s.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(s.nextDate)
          ).map((s: any) => ({
            kind: s.kind, description: s.description.trim(), category: typeof s.category === "string" ? s.category : "Varios", amount: Number(s.amount),
            startDate: s.startDate, frequency: s.frequency, nextDate: s.nextDate, active: s.active !== false,
          }))
          structured.needsConfirmation = parsed.needsConfirmation === true
        }
        if (expenseMode) {
          const rawUpdates = Array.isArray(parsed.expenseUpdates) ? parsed.expenseUpdates : []
          structured.expenseUpdates = rawUpdates
            .filter((u: any) => {
              if (!u || typeof u.expenseId !== "string" || !u.expenseId) return false
              const catOk = u.category === undefined || (typeof u.category === "string" && u.category.trim().length > 0)
              const clsOk = u.classification === undefined || u.classification === "business" || u.classification === "personal"
              return catOk && clsOk && (u.category !== undefined || u.classification !== undefined)
            })
            .map((u: any) => ({
              expenseId: u.expenseId,
              ...(u.category !== undefined ? { category: u.category } : {}),
              ...(u.classification !== undefined ? { classification: u.classification } : {}),
            }))
        }
      } catch {
        structured = null
      }
    }

    console.log(`[ai-chat] Respondido con éxito en ${Date.now() - start}ms`)

    return NextResponse.json({
      success: true,
      reply,
      ...(structured ? { structured } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error(`[ai-chat] Error tras ${Date.now() - start}ms:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
