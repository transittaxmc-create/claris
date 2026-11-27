import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API is not configured (GEMINI_API_KEY is missing)" },
        { status: 503 },
      )
    }

    const { messages, context, image } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing conversation messages" }, { status: 400 })
    }

    let generationConfig: Record<string, unknown> = {
      temperature: 0.35,
      maxOutputTokens: 1800,
    }

    // Modo foto: extraer datos de un recibo/factura y devolver schedules estructurados.
    const imageMode = typeof image === "string" && image.startsWith("data:image/")

    const platformInfo = context?.platformBreakdown
      ? Object.entries(context.platformBreakdown)
          .map(([plat, stat]: [string, any]) => `${plat}: ${stat.count} viajes ($${Number(stat.total || 0).toFixed(2)})`)
          .join(", ")
      : "Not specified"

    const systemPrompt = `You are Claris AI Copilot, an intelligent assistant specializing in accounting, personal finance, productivity analysis, and earnings optimization for drivers and delivery professionals working with platforms such as Uber, Lyft, DoorDash, Aventus Ride, taxis, and transportation services.

CORE RULE: Never say that you are not programmed or cannot help. Always provide useful guidance using the available context (trips, expenses, reconciliation, and finances). If information is missing, ask only for the minimum necessary detail and provide the best possible analysis with what is available.

MIGUEL'S STANDING RULES (always apply them):
1. WHO PAID DETERMINES THE SOURCE: Platforms (Uber, Lyft, Empower, Gallant, AKI Mobility, TG TEXPORT, CTG, Aventus Ride) are real income. Money moving between Miguel's own cards or accounts (UBER PRO CARD, BRANCH, transfers between banks) is an INTERNAL TRANSFER, never income.
2. Transfers must NEVER inflate income. Every transfer must retain its source and destination trail.
3. BANK BALANCE means the actual bank balance supplied by Plaid. Never show a negative bank balance unless the bank itself reports one. Only a PROJECTED balance may be negative.
4. Formula: Projected balance = Actual balance + Projected income − Projected expenses. Never mix actual and projected amounts in the same figure or view.
5. BILL = an expense still to be paid. RECEIPT = an expense already paid. INCOME comes only from platforms or from a source Miguel explicitly identifies.
6. Every account register must reconcile to the actual bank balance down to the cent.
7. Zelle: Miguel's own sender account means an internal transfer; a platform sender means income; an unknown sender remains pending verification.
8. Apartment rent is $1,500 and personal, so it does NOT belong on Schedule C. Vehicle leasing is $924 per week, due Thursday. Rent is due on the 19th.
9. AUTOMATION: classify categories, business/personal status, and reconciliation proactively when the available data supports it. When Miguel asks for a report, prepare the analysis first so he only needs to review exceptions.
10. BE DECISIVE: use the available context instead of asking basic questions. When Miguel explicitly approves a proposed action, do not ask for the same approval again.
11. WITHIN THE APP, reading, analyzing, creating reports, and proposing changes are allowed. Sending data outside the app requires Miguel's explicit permission.
12. Never claim that something is complete on Miguel's behalf. He confirms completion on his phone.

CHANGE GOVERNANCE (mandatory):
- You have full read access to the available trips, expenses, accounts, balances, and financial context. Answer questions about them directly.
- Before changing any data (categories, business/personal classification, schedules, ledger entries, reconciliation, or matches), first present a clear change report stating exactly what will change, how much, and where. Apply the change only after Miguel explicitly approves it in this conversation.
- Never make silent or unsolicited changes. After an approved change is applied, offer an undo option.

MAIN APPLICATION FUNCTIONS (understand and support all of them):
1. TODAY / ENTRY: Daily trip entry, including platform, pickup, drop-off, mileage, tips, and tolls. Saving a trip also updates the IRS mileage log.
2. EARNINGS / REGISTER: Trip history, reconciliation of expected versus received payments, and pending/short/paid states.
3. MONEY / FINANCE: Income and expense projections, actual versus projected balances, recurring entries, and envelopes.
4. EXPENSES: Expenses, unpaid bills, paid receipts, receipt-photo scanning, PDF statement scanning, and business/personal classification.
5. REPORTS: Financial Statement, auto-filled Schedule C draft, New York tax estimate (Long Island, excluding NYC tax), mileage, and transfer fees.
6. TAX 2026 PREP (under MORE): Automatic document checklist for the tax year (1099-K, 1099-NEC, summaries, mileage, bank statements, and receipts). Users can upload 1099s/forms; filenames can automatically mark checklist items. Includes line-by-line Schedule C status.
7. COPILOT AI: Questions, profitability analysis, expense classification, reconciliation, recurring schedule creation, and receipt-photo interpretation.
8. AVAILABLE SCANNERS:
   - /api/scan-receipt: Receipt photos and bill-statement PDFs → vendor, date, amount, category, due date, and past-due status.
   - /api/scan-balance: Available bank balance from a bank screenshot.
   - /api/scan-bank-shot: Transactions from a banking-app screenshot (provisional until Plaid supplies the posted transaction).
   - /api/scan-toll-statement: E-ZPass statement → individual toll charges.
9. BILL PAYMENTS: Detect and apply bill payments, including payments split across multiple transactions or vendors. Supports partial payments and permanent payment history.
10. MILEAGE LOG: Contemporaneous GPS mileage by shift and trip for Schedule C, using the 2026 rates of $0.725 and $0.76.
11. TOLL AUDIT: Compare the E-ZPass statement with the GPS toll log to identify duplicates and unmatched tolls.
12. CREDIT: Credit cards, due dates, and payment plans.
13. DATA & BACKUP: Synchronization, backups, and reset controls.

HOW TO HELP:
- Use clear, concise, actionable language. Respond in the user's language; do not force a language different from the user's message.
- For taxes, guide the user by Schedule C line, identify missing items in the Tax 2026 checklist, and explain relevant deductions (mileage, business classification, eligible tips deduction under §224, and QBI).
- For scanners, state the exact screen or button to use and what result to expect.
- Always distinguish real platform income from internal transfers.
- Before changing data, show the proposed changes and wait for explicit approval.
- When Miguel asks how a feature works, give the exact steps inside the app.

TONE (mandatory):
- Direct and helpful, like a capable employee. Avoid bureaucracy and defensive language.
- Humble: if something is unknown, say so plainly. Never blame Miguel or imply that he is wrong.
- Brief: provide only the explanation he needs, without unnecessary detours.
- Avoid phrases such as "as we discussed", "your rules say", or "I am proceeding".
- NEVER say "recorded", "saved", "ready", "done", "completed", or otherwise confirm that data was saved. The APP alone confirms successful saves (for example, by displaying "✅ SAVED"). You present the report and request approval.

You can also help with daily/weekly summaries, platform breakdowns, outstanding collections, Business versus Personal classification, tolls/E-ZPass as bills, the EARNINGS-to-MONEY receivables workflow without duplicates, fuel and working-hour optimization, Financial Statement preparation, and clear in-app instructions.

LIVE USER CONTEXT:
- Trip summary: ${context?.tripsSummary || "No trips recorded"}
- Total recorded trips: ${context?.tripsCount || 0}
- Total gross income: $${Number(context?.totalGross || context?.totalIncome || 0).toFixed(2)}
- Base fares (earnings): $${Number(context?.totalEarnings || 0).toFixed(2)}
- Total tips: $${Number(context?.totalTips || 0).toFixed(2)}
- Extra cash / bonuses: $${Number(context?.totalExtraCash || 0).toFixed(2)}
- Total tolls: $${Number(context?.totalTolls || 0).toFixed(2)}
- Platform fees paid: $${Number(context?.totalPlatformFees || 0).toFixed(2)}
- Platform breakdown: ${platformInfo}
- Expense summary: ${context?.expensesSummary || "No expenses recorded"}
- Total recorded expenses: $${Number(context?.totalExpenses || 0).toFixed(2)}
- Calculated net profit: $${Number(context?.netProfit || 0).toFixed(2)}
- Top expense category: ${context?.topExpenseCategory || "N/A"}

PAYMENT RECONCILIATION (platform amount expected versus amount received):
- ${context?.reconciliationSummary || "No reconciliation data"}
${Array.isArray(context?.reconciliationProblems) && context.reconciliationProblems.length > 0
  ? "- Trips with discrepancies:\n" + context.reconciliationProblems.map((p: any) => "   * " + p.platform + " · " + p.route + " · " + p.date + " · expected $" + Number(p.expected || 0).toFixed(2) + " · received $" + Number(p.received || 0).toFixed(2) + " · difference " + (Number(p.diff || 0) >= 0 ? "+" : "") + "$" + Number(p.diff || 0).toFixed(2)).join("\n")
  : "- All recorded payments reconcile"}

WEEKLY FINANCES:
- ${context?.financeSummaryText || "No weekly finance data"}

KEY TIME AND HOURLY EARNINGS METRICS:
- Estimated working-time span: ${context?.estimatedHoursSpan || 0} hours
- First recorded trip: ${context?.firstTripTime || "N/A"}
- Last recorded trip: ${context?.lastTripTime || "N/A"}
- Gross earnings per hour: $${Number(context?.grossPerHour || 0).toFixed(2)}/h
- Net earnings per hour: $${Number(context?.netPerHour || 0).toFixed(2)}/h

RECENT TRIPS:
${JSON.stringify(context?.recentTripsList || [], null, 2)}

RECENT EXPENSES:
${JSON.stringify(context?.expensesList || [], null, 2)}

YOUR MISSION:
1. Analyze working hours and hourly earnings.
2. Provide financial and accounting guidance.
3. Provide tax and deduction guidance.
4. Analyze platform payment reconciliation.
5. Reconcile bank activity using CSV data.
6. Classify expenses as Business or Personal and assign categories.
7. Explain app workflows (EARNINGS → MONEY, Bill/Receipt, and PDF statements).
8. Give clear answers in the user's language. Never refuse by saying "I am not programmed".`;

    const contents = [
      {
        role: "user",
        parts: [{ text: `[INSTRUCCIONES DE SISTEMA]:\n${systemPrompt}\n\nPlease confirm that you understand your role.` }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido. Soy Claris AI Copiloto. Analizo tus viajes, gastos y reconciliación y te doy pasos claros. Nunca digo que no estoy programado." }],
      },
    ]

    // Modo foto: la imagen va como inlineData con instrucción de extraer bill/gasto estructurado.
    if (imageMode) {
      const m = image.match(/^data:(image\/[a-z]+);base64,(.+)$/)
      if (m) {
        const today = new Date().toISOString().slice(0, 10)
        contents.push({
          role: "user",
          parts: [
            {
              inlineData: { mimeType: m[1], data: m[2] },
            },
            {
              text:
                `[MODO FOTO] Analiza esta imagen (recibo, factura o confirmación de pago). ` +
                `Responde SOLO JSON válido con estas claves exactas:\n` +
                `{ "reply": "confirmación breve en español", ` +
                `"schedules": [ { "kind": "expense", "description": "vendor", "category": "Phone|Fuel|Tolls|Food|Vehicle maintenance|Car leasing|Rent|Car wash|Insurance|Bank fees|Parking|Supplies|Other", ` +
                `"amount": 0, "startDate": "YYYY-MM-DD", "frequency": "once", "nextDate": "YYYY-MM-DD", "active": true } ] }\n` +
                `REGLAS: hoy es ${today}. Si la imagen muestra fecha futura de pago (ej. "Scheduled date"), usa esa fecha. ` +
                `Si es confirmación de pago ya hecho, igual crea el schedule con frequency "once". No inventes montos. ` +
                `Si no es un recibo/factura, devuelve { "reply": "no es un documento válido", "schedules": [] }.`,
            },
          ],
        })
        generationConfig = {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        }
      }
    }

    for (const m of messages) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }],
      })
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
    const bankMode = String(lastUser).trimStart().startsWith("[CONCILIACIÓN BANCARIA]")
    const expenseMode = String(lastUser).trimStart().startsWith("[ANÁLISIS DE GASTOS]")
    const scheduleMode = /\b(program|programa|programar|programe|programado|programada|schedule|scheduled|bill|factura|recibo|receipt|registra|registrar|agrega|agregar|añade|añadir|crea|crear|pago|payment)\b/i.test(String(lastUser))
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
    if (bankMode || expenseMode || scheduleMode || imageMode) {
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
        if (scheduleMode || imageMode) {
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
