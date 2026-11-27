import { NextResponse } from "next/server"
import { EXPENSE_CATEGORIES } from "@/components/copiloto/types"

export const runtime = "nodejs"
export const maxDuration = 60

interface AnalysisResult {
  vendor: string
  date: string
  amount: number
  category: string
  notes?: string
  confidence?: number
  // Campos extra cuando el documento es un STATEMENT de bill (PDF):
  isBill?: boolean
  dueDate?: string
  amountDue?: number
  pastDue?: number
  totalDue?: number
  // Número de invoice que la compañía emisora le asigna a ESTE documento
  // (ej. "CBL-1263590"). Identifica la factura, no la cuenta. (Miguel,
  // 2026-11-03: cada factura del carro se trackea por su número y cada pago
  // lleva la referencia a ese número.)
  invoiceNo?: string
  // Números de invoice que un RECIBO/CONFIRMACION DE PAGO dice estar pagando
  // (ej. el portal lista CBL-1267227, CBL-1267226). Vacío si no lista ninguno.
  invoiceRefs?: string[]
  // Campos extra cuando la foto es una PANTALLA DE DESPACHO de un trabajo
  // (kind:"trip", flujo foto → TODAY, Miguel 2026-11-24): la pantalla de la
  // base (Classic Ryde / Limosys y similares) con el viaje ya asignado.
  isTrip?: boolean
  company?: string
  time?: string
  passenger?: string
  pickup?: string
  dropoff?: string
  voucherNo?: string
  confNo?: string
  refId?: string
  fop?: string
  pax?: number
  lug?: number
  classType?: string
  dispatchPhone?: string
}

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[scan-receipt] GEMINI_API_KEY no configurada")
      return NextResponse.json(
        { error: "AI API not configured (GEMINI_API_KEY missing)" },
        { status: 503 },
      )
    }

    const { image, mimeType, kind } = await req.json()
    if (!image) {
      return NextResponse.json({ error: "Missing base64 image" }, { status: 400 })
    }

    const cleanBase64 = image.replace(/^data:[^;]+;base64,/, "")
    const resolvedMime = mimeType || "image/jpeg"

    console.log(`[scan-receipt] Recibida imagen: ${resolvedMime}, base64 len: ${cleanBase64.length}`)

    // Un PDF (o kind:"bill") es un STATEMENT de bill, no un recibo: se extrae
    // el monto que vence y su fecha, separados de lo atrasado.
    const esBill = resolvedMime === "application/pdf" || kind === "bill"
    // kind:"trip" = foto de la pantalla de despacho de un trabajo (flujo
    // foto → TODAY): no es un recibo ni un bill, es el viaje ya asignado.
    const esTrip = kind === "trip"

    const prompt = esTrip
      ? `You are an expert dispatcher assistant. The attached image is a screenshot or photo of a TRIP DISPATCH screen from a car-service base app (for example Classic Ryde / Limosys-style driver screens). It shows ONE trip already assigned to the driver. Extract the following fields with maximum precision in strict JSON format:

1. company: The company / base name shown on the screen (e.g.: "Classic Ryde"). Copy it exactly as printed.
2. date: The trip date in exactly YYYY-MM-DD format. The screen shows it like "Tue 11/24/26 - 9:00 AM": convert to the full date (2026-11-24). Two-digit years are 20xx.
3. time: The trip pickup time in 24-hour "HH:MM" format (e.g.: "09:00"). Use the scheduled trip Time, NOT the ETA.
4. amount: The trip charge — the value on the "Charges" line — as a float (e.g.: 62.00). No currency symbols or commas. If there is no charge visible, return 0.
5. passenger: The passenger name exactly as printed (e.g.: "Benjamin, Reign").
6. pickup: The FULL pickup address exactly as printed, on ONE line, keeping street, cross streets in parentheses and city (e.g.: "88-55 199th St (State Hwy 25 / 89th Ave) Hollis, QU").
7. dropoff: The FULL drop-off address exactly as printed, on ONE line, same rule.
8. voucherNo: The Voucher number exactly as printed (e.g.: "1919809030-A"). If there is no voucher line, return null.
9. confNo: The confirmation number (the "Conf#" value, digits only as printed, e.g.: "2460096"). If none, return null.
10. refId: The "RefId" value exactly as printed (e.g.: "1919809030-414812132"). If none, return null.
11. fop: The "FOP" text exactly as printed (e.g.: "CH 1 MEDICAL ANSWERING SERVICES"). If none, return null.
12. pax: Number of passengers from "Pax/Lug" (the number BEFORE the slash) as an integer. If not shown, return null.
13. lug: Number of luggage pieces from "Pax/Lug" (the number AFTER the slash) as an integer. If not shown, return null.
14. classType: The "Class" value exactly as printed (e.g.: "SD"). If none, return null.
15. dispatchPhone: The dispatch phone number exactly as printed. If none, return null.
16. confidence: Decimal number from 0.0 to 1.0 indicating your certainty.

Respond with ONLY a valid JSON object with these exact keys: company, date, time, amount, passenger, pickup, dropoff, voucherNo, confNo, refId, fop, pax, lug, classType, dispatchPhone, confidence.`
      : esBill
      ? `You are an expert accountant. The attached document is a BILL STATEMENT (for example a phone, utility, insurance or service bill) for a small transportation business. Extract the following fields with maximum precision in strict JSON format:

1. vendor: The company issuing the bill (e.g.: "AT&T", "Verizon", "E-ZPass", "Geico"). Use the commercial brand name.
2. dueDate: The due date of the CURRENT amount due, in exactly YYYY-MM-DD format. This is the date printed next to "Amount due" / "Total due by" / "Please pay by". If the statement lists a past-due amount "due immediately" AND a separate amount with a future due date, dueDate is that FUTURE due date.
3. amountDue: The amount due ON dueDate (the new/current charges for this cycle), as a float, NO currency symbols or commas. CRITICAL: if the statement separates a PAST DUE amount (due immediately, from previous cycles) from the amount due on dueDate, amountDue EXCLUDES the past-due part. Example: "Past due $212.82 due immediately" + "$349.19 due Nov 15" -> amountDue = 349.19, dueDate = the Nov 15 date. If there is only one total amount due with one due date, amountDue = that total.
4. pastDue: The amount shown as past due / previous balance due immediately, as a float. 0 if none.
5. totalDue: The grand total needed to bring the account fully current (pastDue + amountDue when both exist), as a float. If only one amount exists, totalDue = amountDue.
6. date: The statement issue date, YYYY-MM-DD.
7. category: Classify MANDATORILY into ONE of these exact system categories:
${EXPENSE_CATEGORIES.map((c) => `   - "${c}"`).join("\n")}
   Classification rules:
   * Phone / mobile / internet bills -> "Phone"
   * Tolls (E-ZPass, SunPass) -> "Tolls"
   * Insurance bills -> "Insurance"
   * Fuel -> "Fuel"
   * If it fits none of the above -> "Other"
8. notes: One short line: service/account reference using ONLY the last 4 digits if an account number is visible (e.g.: "Account ·7878, 4 lines"), plus the billing cycle if shown. NEVER include a full account number.
9. invoiceNo: The invoice number the issuing company printed on THIS bill (e.g.: "Invoice CBL-1263590", "Invoice # INV-2041", "Bill number 88312"). Copy it EXACTLY as printed, with its letters/prefix. This identifies this specific bill — it is NOT an account number and NOT a payment/transaction id. If the statement covers several invoices and prints several numbers, use the FIRST/main one. If no invoice number is printed, return null.
10. confidence: Decimal number from 0.0 to 1.0 indicating your certainty.

10. paymentProgram: If the document shows an installment / payment program / payment plan with a fixed recurring amount and a start and/or end date (or a fixed number of payments), extract it as an object with these keys, otherwise null:
    - fixedAmount: the fixed payment amount (float)
    - startDate: program start date YYYY-MM-DD
    - endDate: program end date YYYY-MM-DD (or null)
    - count: number of payments if shown (integer or null)
    - frequency: "monthly" | "biweekly" | "weekly" | "once" (best guess)
    Example: a $22.86 fixed payment from 2026-10-29 to 2027-04-29, monthly, from Citibank.

Respond with ONLY a valid JSON object with these exact keys: vendor, dueDate, amountDue, pastDue, totalDue, date, category, notes, invoiceNo, confidence, paymentProgram.`
      : `You are an expert accountant who analyzes tickets, receipts and invoices for Uber, Lyft and transportation drivers.
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
6. invoiceNo: If this document IS an invoice/bill (a charge pending payment, e.g. a car-leasing invoice), the invoice number the company printed on it (e.g.: "CBL-1263590"), copied EXACTLY as printed with its letters/prefix. It identifies this specific bill — it is NOT an account number. If the document is a plain paid receipt with no invoice number, return null.
7. invoiceRefs: If this document is a PAYMENT confirmation/receipt that LISTS the invoices it pays (e.g. a leasing portal receipt listing "CBL-1267227, CBL-1267226, CBL-1268312"), return ALL those invoice numbers as an array of strings, copied exactly. Otherwise return an empty array.
8. confidence: Decimal number from 0.0 to 1.0 indicating your certainty and reading sharpness.

Respond with ONLY a valid JSON object with those exact keys: vendor, date, amount, category, notes, invoiceNo, invoiceRefs, confidence.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`

    // Llamada a Google con REINTENTOS (Miguel, 2026-10-29: el escáner le
    // daba "mucho error" — eran caídas de conexión y timeouts pasajeros sin
    // ningún reintento). Hasta 3 intentos ante: error de red/timeout o
    // respuesta 5xx. Un 4xx real no se reintenta.
    const geminiBody = JSON.stringify({
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
    })

    let response: Response | null = null
    let lastErr: unknown = null
    for (let intento = 1; intento <= 3; intento++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: geminiBody,
        })
        lastErr = null
      } catch (e) {
        lastErr = e
        response = null
      } finally {
        clearTimeout(timer)
      }
      if (response && response.status < 500) break
      if (Date.now() - start > 45000) break
      console.log(`[scan-receipt] Intento ${intento} falló (${response ? response.status : String(lastErr)}); reintentando…`)
    }

    if (!response) {
      const aborted = lastErr instanceof Error && lastErr.name === "AbortError"
      console.error("[scan-receipt] Gemini no respondió tras los reintentos:", lastErr)
      return NextResponse.json(
        {
          error: aborted
            ? "The reading took too long — please try again"
            : "The connection to the reading service dropped — please try again",
        },
        { status: 504 },
      )
    }

    console.log(`[scan-receipt] Gemini respondió en ${Date.now() - start}ms con status ${response.status}`)

    if (!response.ok) {
      const errText = await response.text()
      console.error("[scan-receipt] Gemini API error:", response.status, errText)
      return NextResponse.json(
        { error: `AI service error (${response.status})` },
        { status: 502 },
      )
    }

    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    const parsed: AnalysisResult = JSON.parse(rawText)

    // Pantalla de despacho (kind:"trip"): se sanean los campos del viaje y
    // se devuelve tal cual; no hay categoría de gasto que validar.
    if (esTrip) {
      const cleanText = (v: unknown, max = 300): string | undefined => {
        if (typeof v !== "string") return undefined
        const s = v.replace(/\s+/g, " ").trim().slice(0, max)
        return s && s.toLowerCase() !== "null" ? s : undefined
      }
      const cleanInt = (v: unknown): number | undefined => {
        const n = Math.floor(Number(v))
        return Number.isFinite(n) && n >= 0 && n <= 99 ? n : undefined
      }
      const tripResult: AnalysisResult = {
        vendor: "",
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date || "")) ? String(parsed.date) : "",
        amount: Number.isFinite(Number(parsed.amount)) && Number(parsed.amount) > 0 ? Number(parsed.amount) : 0,
        category: "Other",
        isTrip: true,
        company: cleanText(parsed.company, 80),
        time: /^\d{1,2}:\d{2}$/.test(String(parsed.time || "")) ? String(parsed.time) : undefined,
        passenger: cleanText(parsed.passenger, 120),
        pickup: cleanText(parsed.pickup),
        dropoff: cleanText(parsed.dropoff),
        voucherNo: cleanText(parsed.voucherNo, 40),
        confNo: cleanText(parsed.confNo, 40),
        refId: cleanText(parsed.refId, 60),
        fop: cleanText(parsed.fop, 160),
        pax: cleanInt(parsed.pax),
        lug: cleanInt(parsed.lug),
        classType: cleanText(parsed.classType, 20),
        dispatchPhone: cleanText(parsed.dispatchPhone, 30),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      }
      console.log(`[scan-receipt] Despacho leído en ${Date.now() - start}ms:`, tripResult.company, tripResult.amount, tripResult.voucherNo)
      return NextResponse.json({ success: true, result: tripResult })
    }

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

    parsed.category = matchedCat || "Other"

    // Sanear notas: nunca guardar un blob — recortar, colapsar espacios, 200 máx.
    if (typeof parsed.notes === "string") {
      const limpio = parsed.notes.replace(/\s+/g, " ").trim().slice(0, 200)
      parsed.notes = limpio || undefined
    }

    // Sanear el número de invoice y las referencias: texto corto, sin
    // espacios internos raros; nada de blobs. Se guarda tal como la compañía
    // lo imprime (la comparación normaliza en bill-payments.ts).
    const cleanInvoiceNo = (v: unknown): string | undefined => {
      if (typeof v !== "string") return undefined
      const s = v.replace(/\s+/g, " ").trim().slice(0, 40)
      return s && s.toLowerCase() !== "null" ? s : undefined
    }
    parsed.invoiceNo = cleanInvoiceNo(parsed.invoiceNo)
    if (Array.isArray(parsed.invoiceRefs)) {
      const refs = parsed.invoiceRefs
        .map((r) => cleanInvoiceNo(r))
        .filter((r): r is string => Boolean(r))
      parsed.invoiceRefs = refs.length ? [...new Set(refs)].slice(0, 12) : undefined
    } else {
      parsed.invoiceRefs = undefined
    }

    // Statement de bill: el "amount/date" principal es lo que vence y cuándo.
    if (esBill) {
      parsed.isBill = true
      const due = Number(parsed.amountDue)
      if (Number.isFinite(due) && due > 0) parsed.amount = due
      if (parsed.dueDate) parsed.date = parsed.dueDate
      parsed.pastDue = Number(parsed.pastDue) || 0
      parsed.totalDue = Number(parsed.totalDue) || parsed.amount
    }

    console.log(`[scan-receipt] Éxito en ${Date.now() - start}ms:`, parsed.vendor, parsed.category, parsed.amount)

    return NextResponse.json({
      success: true,
      result: parsed,
    })
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === "AbortError"
    const message = aborted
      ? "The reading took too long — please try again"
      : err instanceof Error
        ? err.message
        : "Error desconocido"
    console.error(`[scan-receipt] Fallo tras ${Date.now() - start}ms:`, message)
    return NextResponse.json({ error: message }, { status: aborted ? 504 : 500 })
  }
}


