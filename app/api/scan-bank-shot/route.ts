import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 45

// PLAN B (Miguel, 2026-10-25): lee los MOVIMIENTOS visibles en un screenshot
// de la app del banco (Citi, PayPal…) con Gemini. Esos movimientos entran
// como PROVISIONALES en el register de la cuenta y actualizan el balance al
// momento, mientras Plaid trae los reales; cuando Plaid los baja, el cliente
// los empareja (monto exacto, fecha ±2 días) y el provisional desaparece —
// nunca se duplica. Aquí solo se EXTRAE; el dedupe vive en el cliente
// (components/copiloto/screenshot-txs.ts).
export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API de IA no configurada (GEMINI_API_KEY ausente)" },
        { status: 503 },
      )
    }

    const { image, mimeType, today } = await req.json()
    if (!image) {
      return NextResponse.json({ error: "Falta la imagen en base64" }, { status: 400 })
    }
    const hoy = typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10)

    const cleanBase64 = image.replace(/^data:[^;]+;base64,/, "")
    const resolvedMime = mimeType || "image/jpeg"

    const prompt = `Eres un lector preciso de capturas de apps bancarias (Citibank, PayPal, etc.). Hoy es ${hoy}. Extrae TODOS los movimientos visibles en la imagen y responde ÚNICAMENTE con un objeto JSON válido:
{
  "balance": 1234.56,
  "accountLast4": "6393",
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "texto del movimiento", "amount": -41.34, "pending": false }
  ]
}
Reglas:
- amount: número con signo. NEGATIVO si el dinero SALIÓ de la cuenta (pagos, compras, retiros, transferencias enviadas, fees). POSITIVO si ENTRÓ (depósitos, créditos, reembolsos, transferencias recibidas). Usa los signos +/-, colores, columnas débito/crédito o el contexto para decidir.
- date: fecha del movimiento en formato YYYY-MM-DD. Si la imagen muestra solo "Oct 24" o "10/24", completa el año con el de hoy (${hoy.slice(0, 4)}); si esa fecha quedara en el futuro, usa el año anterior. Si un movimiento dice "Pending" sin fecha clara, usa la fecha que muestre o la de hoy.
- description: el texto del comercio/movimiento tal como aparece, sin inventar.
- pending: true solo si la imagen lo marca pendiente.
- balance: el saldo actual/disponible de la cuenta visible en la imagen, o null si no se ve.
- accountLast4: últimos 4 dígitos de la cuenta si se ven, o null.
- Si un renglón no es un movimiento (encabezados, botones, totales), no lo incluyas.
- No inventes movimientos que no estén visibles.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 35000)

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
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: resolvedMime, data: cleanBase64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error("[scan-bank-shot] Gemini API error:", response.status, errText)
      return NextResponse.json(
        { error: `Error del servicio de IA (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    let parsed: any = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = {}
    }

    const txs = (Array.isArray(parsed.transactions) ? parsed.transactions : [])
      .map((t: any) => {
        const amount = Number(t?.amount)
        if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return null
        const date = typeof t?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : hoy
        return {
          date,
          description: String(t?.description || "Movimiento").slice(0, 120),
          amount: Math.round(amount * 100) / 100,
          pending: Boolean(t?.pending),
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      balance: typeof parsed.balance === "number" && Number.isFinite(parsed.balance) ? parsed.balance : null,
      accountLast4: parsed.accountLast4 ? String(parsed.accountLast4).slice(-4) : null,
      transactions: txs,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error("[scan-bank-shot] Fallo:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
