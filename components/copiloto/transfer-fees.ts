// ============================================================================
// FEES DE TRANSFERENCIA — Miguel 2026-10-29: quiere ver cuánto paga por
// mover su dinero entre cuentas, por canal, en el Financial Statement.
// Solo se calcula lo que el banco PRUEBA:
//  - Uber Pro Card → Citibank: el fee viene como cargo propio en la tarjeta
//    ("Fee for unloading to card", el mismo día de cada descarga; $2.99
//    mínimo, ~2% en las grandes). Las reversas del banco restan solas.
//  - PayPal → Citibank (instantáneo): la salida de PayPal a su tarjeta
//    ••••7693 llega NETA a Citibank; el fee es la diferencia entre la
//    salida y la entrada, pareadas 1:1. La entrada de Citibank puede
//    postear de 2 días antes a 3 días después (fechas de banco distintas).
//    Si la entrada llega por el monto completo, fue transferencia estándar
//    y el fee es $0.
// Lyft → PayPal y Square → fuera NO se calculan aquí: el feed del banco no
// identifica esos fees (PayPal no etiqueta qué depósito es de Lyft; Square
// no muestra su fee en el banco). Se muestran como pendientes en el
// reporte — nunca como $0 inventado.
// ============================================================================

export interface FeeBankTx {
  date: string
  amount: number
  detail: string
  bank_account?: string
}

export interface TransferFeesResult {
  /** Fees netos de descarga de la Uber Pro Card en el período. */
  uberUnloadFees: number
  /** Cantidad de descargas (Account unload) en el período. */
  uberUnloads: number
  /** Fees de transferencias instantáneas PayPal → Citibank en el período. */
  paypalInstantFees: number
  /** Cantidad de transferencias PayPal → tarjeta pareadas en el período. */
  paypalInstantCount: number
  /** Total calculado (solo canales que el banco prueba). */
  total: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  dt.setUTCDate(dt.getUTCDate() + days)
  const p = (x: number) => String(x).padStart(2, "0")
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`
}

const inRange = (d: string, from: string, to: string) => d >= from && d <= to

/** La pata de Citibank de una transferencia instantánea de PayPal: el texto
 * del banco trae "DEBIT CARD TRANSFER CREDIT" con marca de PayPal
 * (CABRERA MIGUE / San Jose / PPL). Las de BRANCH son otra cadena. */
function isPaypalLegInCiti(detail: string): boolean {
  const d = String(detail ?? "")
  if (!/debit card transfer credit/i.test(d)) return false
  if (/branch/i.test(d)) return false
  return /cabrera|san jose|ppl/i.test(d)
}

export function computeTransferFees(
  txs: FeeBankTx[],
  from: string,
  to: string,
): TransferFeesResult {
  const rows = (txs || []).filter(
    (t) => t && /^\d{4}-\d{2}-\d{2}/.test(String(t.date ?? "")),
  )
  const day = (t: FeeBankTx) => String(t.date).slice(0, 10)

  // — Uber Pro Card: fees propios de la tarjeta (netos, con sus reversas).
  let uberFees = 0
  let uberUnloads = 0
  for (const t of rows) {
    if (!/uber pro/i.test(t.bank_account || "")) continue
    if (!inRange(day(t), from, to)) continue
    if (/fee/i.test(t.detail)) uberFees += -(Number(t.amount) || 0)
    if (/account unload/i.test(t.detail)) uberUnloads++
  }

  // — PayPal → Citibank: parear salidas a la tarjeta ••••7693 con la
  // entrada neta (o completa) en Citibank, 1:1, en orden de fecha.
  const outs = rows
    .filter(
      (t) =>
        /paypal/i.test(t.bank_account || "") &&
        (Number(t.amount) || 0) < 0 &&
        /transfer to mastercard debit card/i.test(t.detail) &&
        inRange(day(t), from, to),
    )
    .sort((a, b) => day(a).localeCompare(day(b)))
  const ins = rows.filter(
    (t) =>
      /citi|access/i.test(t.bank_account || "") &&
      (Number(t.amount) || 0) > 0 &&
      isPaypalLegInCiti(t.detail),
  )
  const usedIn = new Set<number>()
  let ppFees = 0
  let ppCount = 0
  for (const o of outs) {
    const outAmt = Math.abs(Number(o.amount) || 0)
    const lo = addDaysIso(day(o), -2)
    const hi = addDaysIso(day(o), 3)
    let best = -1
    let bestFee = 0
    // Primero la pata NETA: fee ≈ 1.75% de la salida (al centavo).
    for (let i = 0; i < ins.length; i++) {
      if (usedIn.has(i)) continue
      const t = ins[i]
      if (day(t) < lo || day(t) > hi) continue
      const fee = r2(outAmt - (Number(t.amount) || 0))
      if (fee > 0 && Math.abs(fee - r2(outAmt * 0.0175)) <= 0.02) {
        best = i
        bestFee = fee
        break
      }
    }
    // Si no, la pata COMPLETA: transferencia estándar, fee $0.
    if (best < 0) {
      for (let i = 0; i < ins.length; i++) {
        if (usedIn.has(i)) continue
        const t = ins[i]
        if (day(t) < lo || day(t) > hi) continue
        if (Math.abs((Number(t.amount) || 0) - outAmt) <= 0.011) {
          best = i
          bestFee = 0
          break
        }
      }
    }
    if (best >= 0) {
      usedIn.add(best)
      ppFees += bestFee
      ppCount++
    }
  }

  const uberUnloadFees = r2(uberFees)
  const paypalInstantFees = r2(ppFees)
  return {
    uberUnloadFees,
    uberUnloads,
    paypalInstantFees,
    paypalInstantCount: ppCount,
    total: r2(uberUnloadFees + paypalInstantFees),
  }
}
