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

    const prompt = `Eres un experto contable que analiza tickets, recibos y facturas para conductores y repartidores de Uber, Lyft y transporte.
Analiza detenidamente la imagen del recibo adjunto y extrae con máxima precisión los siguientes campos en formato JSON estricto:

1. vendor: Nombre comercial claro del vendedor, establecimiento o empresa (ej: "Shell", "Chevron", "McDonald's", "AutoZone", "E-ZPass", "Car Wash Express"). Evita razones sociales crípticas si el nombre de marca comercial está visible.
2. date: Fecha del ticket en formato exactamente YYYY-MM-DD. Si solo ves día y mes, asume el año 2026.
3. amount: Total pagado final (gran total después de impuestos y propinas si aplica) como número flotante (ej: 42.75). No incluyas símbolos de moneda ni comas.
4. category: Clasifica OBLIGATORIAMENTE en UNA de estas categorías exactas del sistema:
${EXPENSE_CATEGORIES.map((c) => `   - "${c}"`).join("\n")}
   Reglas de categorización:
   * Gasolineras, estaciones de servicio, diesel, combustible -> "Gasolina / Combustible"
   * Talleres, cambio de aceite, llantas, refacciones, repuestos -> "Mantenimiento / Vehículo"
   * Peajes, autopistas, tags de peaje (E-ZPass, SunPass, etc.) -> "Peajes"
   * Restaurantes, cafeterías, comida rápida, supermercados, snacks -> "Alimentación / Comida"
   * Lavaderos de auto, car wash, aspirado, detallado -> "Lavado de Auto"
   * Seguros, pólizas, ITV, registro vehicular, licencias -> "Seguros / Permisos"
   * Si no encaja en ninguna anterior -> "Varios"
5. notes: Resumen conciso de los ítems o detalles principales (ej: "Gasolina Regular 12.4 gal @ $3.29", "Hamburguesa y café", "Cambio de aceite sintético").
6. confidence: Número decimal de 0.0 a 1.0 indicando tu grado de certeza y nitidez de la lectura.

Responde ÚNICAMENTE un objeto JSON válido con esas claves exactas.`

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


