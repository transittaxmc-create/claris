import { NextResponse } from "next/server"
import { EXPENSE_CATEGORIES } from "@/components/copiloto/types"

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

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[scan-receipt] GEMINI_API_KEY no configurada")
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

    console.log(`[scan-receipt] Recibida imagen: ${resolvedMime}, base64 len: ${cleanBase64.length}`)

    const prompt = `You are an expert accountant who analyzes tickets, receipts and invoices for Uber, Lyft and transportation drivers.
Carefully analyze the attached receipt image and extract the following fields with maximum precision in strict JSON format:

1. vendor: Clear business name of the seller, establishment or company (e.g.: "Shell", "Chevron", "McDonald's", "AutoZone", "E-ZPass", "Car Wash Express"). Avoid cryptic legal names if the commercial brand name is visible.
2. date: Ticket date in exactly YYYY-MM-DD format. If you only see day and month, assume year 2026.
3. amount: Final total paid (grand total after taxes and tips if applicable) as a float (e.g.: 42.75). No currency symbols or commas.
4. category: Classify MANDATORILY into ONE of these exact system categories:
${EXPENSE_CATEGORIES.map((c) => `   - "${c}"`).join("\n")}
   Classification rules:
   * Gas stations, diesel, fuel -> "Fuel"
   * Auto shops, oil change, tires, parts, repairs -> "Vehicle maintenance"
   * Tolls, highways, toll tags (E-ZPass, SunPass, etc.) -> "Tolls"
   * Restaurants, cafes, fast food, groceries, snacks -> "Food"
   * Car wash, detailing, vacuum -> "Car wash"
   * Insurance, policies, vehicle registration, licenses -> "Insurance"
   * Bank charges, fees -> "Bank fees"
   * Mobile phone, top-ups -> "Phone"
   * Parking meters, garages -> "Parking"
   * Work supplies, accessories -> "Supplies"
   * If it fits none of the above -> "Other"
5. notes: Concise summary of the main items or details (e.g.: "Regular gas 12.4 gal @ $3.29", "Burger and coffee", "Synthetic oil change").
6. confidence: Decimal number from 0.0 to 1.0 indicating your certainty and reading sharpness.

Respond with ONLY a valid JSON object with those exact keys.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    // Timeout de 20s para la llamada a Google
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
    } finally {
      clearTimeout(timer)
    }

    console.log(`[scan-receipt] Gemini respondió en ${Date.now() - start}ms con status ${response.status}`)

    if (!response.ok) {
      const errText = await response.text()
      console.error("[scan-receipt] Gemini API error:", response.status, errText)
      return NextResponse.json(
        { error: `Error del servicio de IA (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const parsed: AnalysisResult = JSON.parse(rawText)

    // Validar y asegurar coincidencia exacta de categoría
    const rawCat = (parsed.category || "").toLowerCase()
    const matchedCat = EXPENSE_CATEGORIES.find((c) => {
      const low = c.toLowerCase()
      return (
        low === rawCat ||
        low.includes(rawCat) ||
        rawCat.includes(low) ||
        (rawCat.includes("gas") && low.includes("gasolina")) ||
        (rawCat.includes("combustible") && low.includes("gasolina")) ||
        (rawCat.includes("comida") && low.includes("alimentación")) ||
        (rawCat.includes("restaurante") && low.includes("alimentación")) ||
        (rawCat.includes("peaje") && low.includes("peajes")) ||
        (rawCat.includes("taller") && low.includes("mantenimiento")) ||
        (rawCat.includes("lavado") && low.includes("lavado"))
      )
    })

    parsed.category = matchedCat || "Varios"

    // Sanear notas: nunca guardar un blob — recortar, colapsar espacios, 200 máx.
    if (typeof parsed.notes === "string") {
      const limpio = parsed.notes.replace(/\s+/g, " ").trim().slice(0, 200)
      parsed.notes = limpio || undefined
    }

    console.log(`[scan-receipt] Éxito en ${Date.now() - start}ms:`, parsed.vendor, parsed.category, parsed.amount)

    return NextResponse.json({
      success: true,
      result: parsed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    console.error(`[scan-receipt] Fallo tras ${Date.now() - start}ms:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


