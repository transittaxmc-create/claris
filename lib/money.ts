// Utilidades de texto de los campos de dinero.
// Están fuera del componente (sin JSX) para poder probarlas en Node.
//
// El teclado decimal del teléfono no tiene tecla "-", así que el texto se
// conserva tal como lo escribe el usuario (permite "-", "12.", "") en vez de
// reescribirlo desde el número en cada pulsación: antes, al escribir "-" el
// valor se recalculaba a 0 y el signo desaparecía solo.

export function normalizeMoneyText(text: string): string {
  const negative = text.trim().startsWith("-")
  let digits = text.replace(/,/g, ".").replace(/[^0-9.]/g, "")
  const parts = digits.split(".")
  if (parts.length > 2) digits = `${parts[0]}.${parts.slice(1).join("")}`
  return (negative ? "-" : "") + digits
}

export function moneyTextToNumber(text: string): number {
  const n = Number.parseFloat(text)
  return Number.isFinite(n) ? n : 0
}

export function moneyTextFromNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return ""
  return String(value)
}

// Alterna el signo con un toque (la "tecla de menos" que falta en el teléfono).
export function toggleMoneySign(text: string): string {
  if (text.startsWith("-")) return text.slice(1)
  return text === "" ? "-" : `-${text}`
}

// Punto rodando (Miguel, 2026-11-24): la secuencia de dígitos ES el
// valor en centavos — 4-0-2-5 -> $40.25, sin presionar la tecla del
// punto. "." se ignora; "40.25" pegado -> $40.25; "-" solo se conserva.
export function rollingMoneyFromText(text: string): number {
  const negative = text.trim().startsWith("-")
  const digits = text.replace(/[^0-9]/g, "").slice(-12)
  if (digits === "") return 0
  const cents = Number(digits)
  return (negative ? -1 : 1) * cents / 100
}

export function rollingMoneyText(text: string): string {
  const negative = text.trim().startsWith("-")
  const digits = text.replace(/[^0-9]/g, "").slice(-12)
  if (digits === "") return negative ? "-" : ""
  const cents = Number(digits)
  const s = String(cents).padStart(3, "0")
  return `${negative ? "-" : ""}${s.slice(0, -2)}.${s.slice(-2)}`
}
