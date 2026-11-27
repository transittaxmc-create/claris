import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

// Lee el saldo disponible de una captura de pantalla del banco con Gemini.
// Devuelve { success, balance } para que FINANCE actualice su Saldo Disponible.
export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API not configured (GEMINI_API_KEY missing)" },
        { status: 503 },
      )
    }

    const { image, mimeType } = await req.json()
    if (!image) {
      return NextResponse.json({ error: "Missing base64 image" }, { status: 400 })
    }

    const cleanBase64 = image.replace(/^data:[^;]+;base64,/, "")
    const resolvedMime = mimeType || "image/jpeg"

    const prompt = `Eres un lector preciso de estados de cuenta bancarios. Analiza la imagen y extrae SOLO el saldo disponible actual (available balance). Responde ÚNICAMENTE con un objeto JSON válido:
{
  "balance": 1234.56,
  "balanceLabel": "texto corto con la etiqueta que viste (ej. Available, Disponible, Saldo)",
  "confidence": 0.9
}
Reglas:
- balance: número flotante, solo el saldo disponible/actual, sin símbolos de moneda.
- Si ves varios saldos (current, available, pending), usa el "available/disponible".
- Si no logras leer un saldo con confianza, pon balance: null y confidence: 0.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)

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
      console.error("[scan-balance] Gemini API error:", response.status, errText)
      return NextResponse.json(
        { error: `AI service error (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    let parsed: { balance?: number | null; balanceLabel?: string; confidence?: number }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = {}
    }

    const balance = typeof parsed.balance === "number" && Number.isFinite(parsed.balance) ? parsed.balance : null
    if (balance === null) {
      return NextResponse.json({ success: false, error: "Could not read the balance from the image" }, { status: 200 })
    }

    console.log(`[scan-balance] Saldo leído en ${Date.now() - start}ms: ${balance}`)
    return NextResponse.json({
      success: true,
      balance,
      balanceLabel: parsed.balanceLabel || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error(`[scan-balance] Fallo tras ${Date.now() - start}ms:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
