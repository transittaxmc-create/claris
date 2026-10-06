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

INFORMACIÓN DEL USUARIO EN TIEMPO REAL:
- Sección abierta en la aplicación: ${context?.currentSection || "Copiloto"}
- Adapta tus instrucciones a esta pantalla y sugiere pasos concretos dentro de Claris cuando sea útil.
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
1. Análisis de Horas y Ganancias por Hora ($/hr): Si el conductor pregunta "¿Cuánto estoy ganando por hora?", "how much I making per hrs", analiza rigurosamente las horas trabajadas calculadas a partir del horario de sus viajes (${context?.firstTripTime || "--"} a ${context?.lastTripTime || "--"}), desglosando Gross por hora ($/hr) y Neto por hora ($/hr después de gastos).
2. Consultoría Financiera y Contable: Evaluar rentabilidad por viaje, costo operativo por hora, porcentaje de ingresos absorbido por gasolina u otros gastos, y margen neto.
3. Asesoría Fiscal (Taxes/Deducciones): Orientar sobre deducciones estándar de millas vs gastos reales (combustible, peajes, seguros, depreciación, teléfono). Cuando pregunten por deducciones del mes, agrupa los gastos por categoría con sus totales.
4. Análisis de Reconciliación: Si pregunta "cuánto me falta por cobrar", usa la sección RECONCILIACIÓN DE PAGOS. Señala plataformas, viajes concretos con su ruta y fecha, y el total pendiente de cobrar (suma de las diferencias negativas).
5. Conciliación Bancaria: Si el mensaje empieza con [CONCILIACIÓN BANCARIA], el usuario adjuntó transacciones de su banco. Crúzalas con la LISTA DE VIAJES RECIENTES (pagos que debería haber recibido), los gastos registrados y la reconciliación. Compara por monto exacto o cercano (±1%) y fecha próxima (±2 días). Reporta: (a) transacciones que coinciden con viajes, (b) transacciones que coinciden con gastos, (c) diferencias y descuadres con su monto, (d) transacciones sin correspondencia. Sé conciso y usa una tabla o lista clara.
6. Respuestas Claras, Estructuradas y Profesionales: Usa números exactos de los datos provistos. Si el usuario escribe en inglés o español, respóndele en el mismo idioma o de manera bilingüe clara. Emplea emojis sobrios (⏱️, 🚗, 💰, ⛽, 📊) para facilitar la lectura mientras conduce o descansa.
7. Si no hay viajes registrados o solo hay uno, explícale cómo se calcula la tasa horaria y estima escenarios realistas.`

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

    // Conciliación bancaria: si el último mensaje empieza con el marcador, la
    // respuesta debe ser JSON estructurado para poder ACTUALIZAR los viajes
    // (no solo reportar).
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
    const bankMode = String(lastUser).trimStart().startsWith("[CONCILIACIÓN BANCARIA]")
    const expenseMode = String(lastUser).trimStart().startsWith("[ANÁLISIS DE GASTOS]")
    const scheduleMode = /\b(program|programa|programar|programe|programado|programada|schedule|scheduled)\b/i.test(String(lastUser))
    const recordMode =
      !bankMode &&
      !expenseMode &&
      !scheduleMode &&
      /\b(registra|registrar|anota|anotar|agrega|agregar|crea|crear|guarda|guardar)\b/i.test(String(lastUser))

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
              `- bankAmount = el monto que el banco pagó (puede ser negativo si es un cargo).\n` +
              `- Si un viaje ya tiene received registrado, NO lo incluyas en matches salvo que el banco muestre otro monto.\n` +
              `- differences: enumera lo que NO cuadra (transacciones sin viaje, viajes sin pago en el extracto, diferencias de monto).\n` +
              `- reply: resume en pocas líneas cuántos pagos se reconocieron, cuánto se actualizará y cuáles son las diferencias más importantes.`,
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
          `REGLAS: interpreta español natural. Usa la fecha actual ${new Date().toISOString().slice(0, 10)}. Para "lunes a sábado" crea seis entradas semanales, una por día, para no programar domingos. Para "cada jueves" crea una entrada semanal comenzando el próximo jueves. Para "día 19 de cada mes" usa frecuencia monthly y una fecha inicial cuyo día sea 19. No inventes montos; convierte $400, 400 dólares y 400 en 400. Si faltan monto, frecuencia o fecha, devuelve schedules vacío y needsConfirmation true explicando qué falta. kind income para proyecciones/ingresos y expense para pagos/facturas. Cada entrada debe tener un id omitido; el cliente lo genera.`
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
              `{\n` +
              `  "reply": "texto breve en español con tu análisis",\n` +
              `  "expenseUpdates": [ { "expenseId": "el id exacto del gasto de la lista", "category": "Gasolina / Combustible", "classification": "business" } ]\n` +
              `}\n` +
              `REGLAS:\n` +
              `- expenseUpdates SOLO para gastos que necesiten corrección: categoría incorrecta o clasificación pendiente/incorrecta. Usa el id exacto de la LISTA DE GASTOS RECIENTES.\n` +
              `- category: una de las categorías del sistema ("Gasolina / Combustible", "Mantenimiento / Vehículo", "Peajes", "Alimentación / Comida", "Lavado de Auto", "Seguros / Permisos", "Varios"). Solo inclúyela si la actual está mal.\n` +
              `- classification: "business" si el gasto es del negocio y deducible (gasolina, peajes, mantenimiento, lavado, licencias), o "personal" si es personal (comida familiar, ocio). Inclúyela cuando falte o sea incorrecta.\n` +
              `- Los gastos que ya están bien categorizados Y clasificados NO van en expenseUpdates.\n` +
              `- reply: resume cuántos gastos corregiste, cuántos están bien, y el total de gastos business vs personal.`,
          },
        ],
      })
    }

    if (recordMode) {
      generationConfig = {
        temperature: 0.1,
        maxOutputTokens: 1600,
        responseMimeType: "application/json",
      }
      contents.push({
        role: "user",
        parts: [{
          text:
            `[SOLICITUD DE REGISTRO] El usuario pidió explícitamente registrar un viaje o gasto. No guardes ni afirmes que se guardó: prepara una propuesta para que la persona la revise y confirme en la app.\n` +
            `Responde SOLO JSON válido con: {"reply":"resumen breve o qué dato obligatorio falta","record":{"type":"trip"|"expense","date":"YYYY-MM-DD","amount":0,"vendor":"...","category":"...","platform":"Uber|Lyft|Eco Ride|Throo|AKI Technology|Classic Ryde|Aventus Ride|Cash|Other","earnings":0,"tips":0,"toll":0,"platformFee":0,"pickup":"...","dropoff":"...","time":"HH:mm","notes":"..." } o null}\n` +
            `Reglas: amount es monto del gasto; para viaje amount no se usa y earnings es la tarifa base. No inventes montos, vendedores, plataformas ni ubicaciones. Si faltan tipo de registro, monto o (para gasto) vendedor, devuelve record:null y pregunta lo que falta. Puedes usar la fecha/hora local actual como valor predeterminado cuando no se indique: ${new Date().toISOString().slice(0, 10)}. Usa SOLO categorías de gastos: Gasolina / Combustible, Mantenimiento / Vehículo, Peajes, Alimentación / Comida, Lavado de Auto, Seguros / Permisos, Varios. Para campos de dinero opcionales no mencionados usa 0; deja ubicación vacía si no se indicó.`
        }],
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

    // En modo banco / análisis de gastos se parsea el JSON estructurado; si el
    // modelo no lo cumple, se cae al texto plano y no se actualiza nada (más
    // seguro que aplicar mal).
    let reply = rawText
    let structured: {
      matches?: { tripId: string; amount: number }[]
      expenseUpdates?: { expenseId: string; category?: string; classification?: string }[]
      schedules?: Array<{ kind: "income" | "expense"; description: string; category?: string; amount: number; startDate: string; frequency: string; nextDate: string; active?: boolean }>
      record?: {
        type: "trip" | "expense"
        date: string
        amount?: number
        vendor?: string
        category?: string
        platform?: string
        earnings?: number
        tips?: number
        toll?: number
        platformFee?: number
        pickup?: string
        dropoff?: string
        time?: string
        notes?: string
      } | null
      needsConfirmation?: boolean
    } | null = null
    if (bankMode || expenseMode || scheduleMode || recordMode) {
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
            ["once", "daily", "weekly", "monthly", "annual"].includes(s.frequency) && /^\\d{4}-\\d{2}-\\d{2}$/.test(s.startDate) && /^\\d{4}-\\d{2}-\\d{2}$/.test(s.nextDate)
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
        if (recordMode) {
          const r = parsed.record
          if (
            r &&
            (r.type === "trip" || r.type === "expense") &&
            /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
            Number.isFinite(Date.parse(`${r.date}T12:00:00`)) &&
            (r.type === "expense"
              ? typeof r.vendor === "string" && r.vendor.trim().length > 0 &&
                Number.isFinite(Number(r.amount)) && Number(r.amount) > 0 &&
                ["Gasolina / Combustible", "Mantenimiento / Vehículo", "Peajes", "Alimentación / Comida", "Lavado de Auto", "Seguros / Permisos", "Varios"].includes(r.category)
              : typeof r.platform === "string" &&
                ["Uber", "Lyft", "Eco Ride", "Throo", "AKI Technology", "Classic Ryde", "Aventus Ride", "Cash", "Other"].includes(r.platform) &&
                Number.isFinite(Number(r.earnings)) && Number(r.earnings) > 0 &&
                Number.isFinite(Number(r.tips ?? 0)) && Number(r.tips ?? 0) >= 0 &&
                Number.isFinite(Number(r.toll ?? 0)) && Number(r.toll ?? 0) >= 0 &&
                Number.isFinite(Number(r.platformFee ?? 0)) && Number(r.platformFee ?? 0) >= 0)
          ) {
            structured.record = {
              type: r.type,
              date: r.date,
              ...(r.type === "expense"
                ? { amount: Number(r.amount), vendor: r.vendor.trim(), category: r.category }
                : {
                    platform: r.platform,
                    earnings: Number(r.earnings),
                    tips: Number(r.tips ?? 0),
                    toll: Number(r.toll ?? 0),
                    platformFee: Number(r.platformFee ?? 0),
                  }),
              pickup: typeof r.pickup === "string" ? r.pickup.trim().slice(0, 160) : "",
              dropoff: typeof r.dropoff === "string" ? r.dropoff.trim().slice(0, 160) : "",
              time: typeof r.time === "string" && /^\d{2}:\d{2}$/.test(r.time) ? r.time : "",
              notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 300) : "",
            }
          } else {
            structured.record = null
          }
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
