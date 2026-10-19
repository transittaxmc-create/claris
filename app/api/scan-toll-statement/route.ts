import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export interface TollCharge {
  date: string // YYYY-MM-DD
  time: string // HH:MM (24h), "" if not shown
  plaza: string // toll plaza / bridge / tunnel name as printed
  amount: number
  ref?: string // E-ZPass transaction/reference number, "" if not shown
}

interface StatementResult {
  charges: TollCharge[]
  statementTotal?: number
  periodStart?: string
  periodEnd?: string
  confidence?: number
}

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "AI API not configured (GEMINI_API_KEY missing)" }, { status: 503 })
    }

    const { image, mimeType } = await req.json()
    if (!image) {
      return NextResponse.json({ error: "Missing base64 image" }, { status: 400 })
    }

    const cleanBase64 = String(image).replace(/^data:[^;]+;base64,/, "")
    const resolvedMime = mimeType || "image/jpeg"

    const prompt = `You are an expert at reading E-ZPass toll statements for a rideshare driver.
Analyze the attached E-ZPass statement screenshot and extract EVERY individual toll transaction (each crossing) with maximum precision in strict JSON format.

For each toll charge extract:
1. date: the transaction/posting date in exactly YYYY-MM-DD format. If you only see day and month, assume year 2026.
2. time: the time of the crossing in HH:MM 24-hour format if shown, otherwise "".
3. plaza: the toll plaza / bridge / tunnel name exactly as printed (e.g. "Queens Midtown Tunnel", "RFK Bridge", "GWB", "Lincoln Tunnel", "NJTPK Exit 14"). Keep the original wording.
4. amount: the toll amount charged as a float (e.g. 7.46). No currency symbols.
5. ref: the transaction or reference number printed for this charge (e.g. "1234567890"). If none is shown, use "".

Also extract if visible:
- statementTotal: the total amount of the statement/bill as a float.
- periodStart / periodEnd: the billing period in YYYY-MM-DD format.
- confidence: decimal 0.0-1.0 for your reading certainty.

IMPORTANT:
- Extract every row, even if the same plaza appears multiple times (each crossing is a separate charge — do NOT deduplicate).
- Skip non-toll rows (payments, credits, fees, replenishments) — only actual toll crossings.
- If the image is not an E-ZPass/toll statement, return {"charges": [], "confidence": 0}.

Respond with ONLY a valid JSON object with keys: charges (array), statementTotal, periodStart, periodEnd, confidence.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: resolvedMime, data: cleanBase64 } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error("[scan-toll-statement] Gemini API error:", response.status, errText.slice(0, 200))
      return NextResponse.json({ error: `AI service error (${response.status})` }, { status: 502 })
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"charges":[]}'
    const parsed = JSON.parse(rawText) as StatementResult

    // Sanitize charges
    const charges: TollCharge[] = Array.isArray(parsed.charges)
      ? parsed.charges
          .filter((c) => c && typeof c.amount === "number" && c.amount > 0 && typeof c.plaza === "string")
          .map((c) => ({
            date: String(c.date || "").slice(0, 10),
            time: String(c.time || "").slice(0, 5),
            plaza: String(c.plaza).replace(/\s+/g, " ").trim().slice(0, 80),
            amount: Math.round(Number(c.amount) * 100) / 100,
            ref: String(c.ref || "").replace(/\s+/g, "").slice(0, 40) || undefined,
          }))
      : []

    console.log(`[scan-toll-statement] ${charges.length} charges in ${Date.now() - start}ms`)

    return NextResponse.json({
      success: true,
      result: {
        charges,
        statementTotal: typeof parsed.statementTotal === "number" ? parsed.statementTotal : undefined,
        periodStart: parsed.periodStart ? String(parsed.periodStart).slice(0, 10) : undefined,
        periodEnd: parsed.periodEnd ? String(parsed.periodEnd).slice(0, 10) : undefined,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      },
    })
  } catch (err) {
    console.error("[scan-toll-statement] error:", err)
    return NextResponse.json({ error: "Could not analyze statement" }, { status: 500 })
  }
}
