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

    const systemPrompt = `Eres Claris AI Copiloto, un asistente inteligente experto en contabilidad, finanzas personales y optimización de ganancias para conductores y repartidores de plataformas (Uber, Lyft, DoorDash, Amazon Flex, taxis y transporte).

INFORMACIÓN DEL USUARIO EN TIEMPO REAL:
- Resumen de Viajes/Ingresos: ${context?.tripsSummary || "Sin viajes registrados"}
- Total Viajes Registrados: ${context?.tripsCount || 0}
- Ingresos Totales Estimados: $${Number(context?.totalIncome || 0).toFixed(2)}
- Propinas Totales: $${Number(context?.totalTips || 0).toFixed(2)}
- Resumen de Gastos: ${context?.expensesSummary || "Sin gastos registrados"}
- Total Gastos Registrados: $${Number(context?.totalExpenses || 0).toFixed(2)}
- Ganancia Neta Calculada: $${Number(context?.netProfit || 0).toFixed(2)}
- Categoría de Gasto Principal: ${context?.topExpenseCategory || "N/A"}

TU MISIÓN:
1. Responder de forma rápida, clara, profesional, motivadora y concisa (al grano).
2. Analizar el rendimiento del conductor: ganancias por viaje, relación ingresos vs gastos, margen neto, consejos para maximizar propinas y deducir gastos de impuestos (IRS/Hacienda).
3. Ayudar a resolver dudas sobre deducibilidad de gastos (gasolina, mantenimiento, depreciación de auto, peajes, seguros, teléfono celular).
4. Sugerir mejores horarios, estrategias de ahorro de combustible y control de gastos hormiga.
5. Puedes usar emojis sobrios (🚗, 💰, ⛽, 📊, ⚡) para estructurar tus respuestas con viñetas o números cortos.
6. Si te hacen una pregunta que requiere cálculos con sus datos, usa los datos provistos en el resumen. Si te preguntan algo general sobre conducción, impuestos o finanzas de choferes, contesta con precisión y autoridad.`

    // Convert messages to Gemini contents format
    // Gemini roles: 'user' or 'model'
    const contents = [
      {
        role: "user",
        parts: [{ text: `[INSTRUCCIONES DE SISTEMA]:\n${systemPrompt}\n\nPor favor confirma que entendiste tu rol.` }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido perfectamente. Soy Claris AI Copiloto, listo para analizar tus viajes, gastos, deducciones fiscales y ayudarte a maximizar tus ganancias netas al volante." }],
      },
    ]

    for (const m of messages) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }],
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
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1200,
          },
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
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar respuesta."

    console.log(`[ai-chat] Respondido con éxito en ${Date.now() - start}ms`)

    return NextResponse.json({
      success: true,
      reply,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error(`[ai-chat] Error tras ${Date.now() - start}ms:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
