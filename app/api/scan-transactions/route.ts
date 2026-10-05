import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 45

// Lee la LISTA de transacciones de una captura del banco con Gemini.
// Devuelve { success, transactions: [{ date, description, amount, type, category }] }
// para que el registro las muestre en vista previa y el usuario confirme.
// El anti-duplicado lo hace el cliente con bankMoveId (id determinista).
export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API de IA no configurada (GEMINI_API_KEY ausente)" },
        { status: 503 },
      )
    }

    const { image, mimeType } = await req.json()
    if (!image) {
      return NextResponse.json({ error: "Falta la imagen en base64" }, { status: 400 })
    }

    const cleanBase64 = image.replace(/^data:[^;]+;base64,/, "")
    const resolvedMime = mimeType || "image/jpeg"

    const prompt = `Eres un lector preciso de movimientos bancarios. Analiza la imagen (captura de app bancaria o estado de cuenta) y extrae TODAS las transacciones visibles como lista. Responde ÚNICAMENTE con un objeto JSON válido:
{
  "transactions": [
    { "date": "2026-10-05", "description": "SHELL GAS STATION", "amount": 45.20, "type": "expense", "category": "Combustible" },
    { "date": "2026-10-04", "description": "UBER PAYOUT", "amount": 312.80, "type": "income", "category": "Plataforma" }
  ],
  "accountHint": "Chase ...4521",
  "confidence": 0.85
}
Reglas:
- date: formato YYYY-MM-DD. Si la imagen solo muestra "Oct 3" sin año, usa el año actual. Si no hay fecha legible, usa la fecha de hoy.
- description: texto del comercio/movimiento tal como aparece, sin recortar de más.
- amount: número positivo SIEMPRE (el signo lo da "type"), sin símbolos de moneda.
- type: "expense" si es cargo/retiro/pago, "income" si es depósito/abono/pago recibido.
- category: una de: Combustible, Comida, Mantenimiento, Peajes, Plataforma, Transferencia, Nómina, Servicios, Otro. Si dudas, "Otro".
- NO incluyas filas de saldo/balance, solo movimientos.
- Si no ves transacciones legibles, devuelve "transactions": [] con confidence 0.`

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
      console.error("[scan-transactions] Gemini API error:", response.status, errText)
      return NextResponse.json(
        { error: `Error del servicio de IA (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    let parsed: {
      transactions?: Array<{ date?: string; description?: string; amount?: number; type?: string; category?: string }>
      accountHint?: string
      confidence?: number
    }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = {}
    }

    const transactions = (Array.isArray(parsed.transactions) ? parsed.transactions : [])
      .map((t) => ({
        date: String(t?.date || "").slice(0, 10),
        description: String(t?.description || "").trim(),
        amount: typeof t?.amount === "number" && Number.isFinite(t.amount) ? Math.round(t.amount * 100) / 100 : 0,
        type: t?.type === "income" ? "income" : "expense",
        category: String(t?.category || "Otro").trim() || "Otro",
      }))
      .filter((t) => t.date && t.description && t.amount > 0)

    console.log(`[scan-transactions] ${transactions.length} movimientos en ${Date.now() - start}ms`)
    return NextResponse.json({
      success: true,
      transactions,
      accountHint: parsed.accountHint || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error(`[scan-transactions] Fallo tras ${Date.now() - start}ms:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
