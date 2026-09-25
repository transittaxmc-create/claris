import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

interface AnalysisResult {
  vendor: string
  date: string
  amount: number
  category: string
  notes?: string
  confidence?: number
}

const CATEGORIES = [
  "Gasolina / Combustible",
  "Comida / Dieta",
  "Peaje",
  "Parking",
  "Mantenimiento / Taller",
  "Seguro / Impuestos",
  "Telefonía",
  "Otros",
]

export async function POST(req: Request) {
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

    // Normaliza el base64 si incluye el prefijo data:...;base64,
    const cleanBase64 = image.replace(/^data:[^;]+;base64,/, "")
    const resolvedMime = mimeType || "image/jpeg"

    const prompt = `Analiza esta imagen de un recibo, factura o ticket de gasto. Extrae los siguientes campos en formato JSON estricto:
- vendor: nombre del comercio, gasolinera, restaurante o proveedor (texto corto).
- date: fecha del recibo en formato YYYY-MM-DD. Si no tiene año usa el año actual (2026).
- amount: total a pagar como número flotante (ej: 45.50). Si no está claro, 0.
- category: una de las siguientes opciones exactas: ${CATEGORIES.map((c) => `"${c}"`).join(", ")}.
- notes: breve descripción opcional de los ítems principales (ej: "Gasolina 95 - 32L").
- confidence: número entre 0 y 1 indicando qué tan legible es el recibo.

Responde ÚNICAMENTE un objeto JSON válido con esas claves exactas.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: resolvedMime,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Gemini Vision API error:", response.status, errText)
      return NextResponse.json(
        { error: `Error del servicio de IA (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const parsed: AnalysisResult = JSON.parse(rawText)

    // Validar y normalizar categoría
    const matchedCat = CATEGORIES.find(
      (c) => c.toLowerCase() === (parsed.category || "").toLowerCase(),
    )
    if (matchedCat) parsed.category = matchedCat
    else parsed.category = "Otros"

    return NextResponse.json({
      success: true,
      result: parsed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error("receipt scan error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
