// Parser tolerante de estados de cuenta bancarios (CSV).
//
// No depende de React ni del navegador: se prueba en Node
// (scripts/_test-bank-csv.mjs). Acepta:
// - Separador coma o punto y coma
// - Con o sin línea de cabecera
// - Monto con símbolo de moneda y comas de miles (se limpian)
// - Fechas ISO (2026-09-26) o locales (26/09/2026, 26-09-26)

export type BankTransaction = {
  date: string
  description: string
  amount: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{8}$/

// Separa una línea CSV respetando comillas dobles, así "UBER TRIP, NYC" o
// "$1,234.50" se tratan como un solo campo. Devuelve los campos sin comillas.
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      fields.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

export function parseBankCsv(text: string): BankTransaction[] | null {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const rows: BankTransaction[] = []
  for (const line of lines) {
    const parts = splitCsvLine(line)
    if (parts.length < 2) continue

    // El monto es el último campo numérico de la línea (ignora moneda y comas).
    let amount = Number.NaN
    let amountIndex = -1
    for (let i = parts.length - 1; i >= 1; i--) {
      const cleaned = parts[i].replace(/[$,€£\u00a0\s]/g, "")
      if (cleaned === "") continue
      const n = Number(cleaned)
      if (Number.isFinite(n)) {
        amount = n
        amountIndex = i
        break
      }
    }
    if (!Number.isFinite(amount) || amountIndex < 1) continue

    const date = parts[0]
    if (!DATE_RE.test(date)) continue

    const description =
      parts
        .slice(1, amountIndex)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim() || "(sin descripción)"

    rows.push({ date, description, amount })
  }
  return rows.length > 0 ? rows : null
}
