// ============================================================================
// TRANSFER MATCHING — detectar transferencias entre cuentas.
// Regla contable de Miguel: los transfers JAMÁS inflan ingresos y cada
// transferencia lleva su ORIGEN trazado. Cuando el dinero sale de una cuenta
// y entra a otra (mismo monto, fechas cercanas), es EL MISMO dólar movido:
// la llegada NO es un ingreso nuevo.
// Ejemplo: Uber Pro → CitiBank. Lo de CitiBank no es ingreso; el ingreso
// fue lo de Uber. No duplicar.
// ============================================================================

export interface MatchTx {
  date: string // YYYY-MM-DD
  bank_account: string
  detail: string
  amount: number // crédito − débito (positivo = entra, negativo = sale)
}

export interface TransferPair {
  id: string
  outTx: MatchTx
  inTx: MatchTx
  amount: number // monto positivo
  outDate: string
  inDate: string
  originLabel: string // "viene de {cuenta origen}"
}

export interface TransferReport {
  pairs: TransferPair[]
  /** Salidas sin llegada encontrada */
  unmatchedOut: MatchTx[]
  /** Llegadas sin salida encontrada */
  unmatchedIn: MatchTx[]
}

const AMOUNT_TOL = 0.011
const DAY_WINDOW = 4

function daysBetween(a: string, b: string): number {
  const t = (s: string) => new Date(`${String(s).slice(0, 10)}T12:00:00`).getTime()
  const ms = t(a) - t(b)
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 86400000)) : 999
}

function sameAccount(a: string, b: string): boolean {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase()
}

// Solo movimientos con "pinta de transferencia" se reportan sin pareja.
// Una compra (7-Eleven, gasolina, mercado...) o un ingreso real NO son
// transferencias: reportarlas como "sin pareja" duplica hallazgos en el
// CIERRE DEL DIA con informacion falsa. El emparejamiento (pares) no cambia.
const TRANSFER_DETAIL_RE = /transfer|zelle|p2p|wire|money moved|cashout/i

export function looksLikeTransfer(detail: string): boolean {
  return TRANSFER_DETAIL_RE.test(String(detail || ""))
}

/**
 * Emparea salidas con llegadas entre cuentas DISTINTAS.
 * Cada movimiento se usa una sola vez (greedy por cercanía de fecha).
 */
export function matchTransfers(txs: MatchTx[]): TransferReport {
  const outs = (txs || []).filter((t) => Number(t.amount) < -AMOUNT_TOL)
  const ins = (txs || []).filter((t) => Number(t.amount) > AMOUNT_TOL)
  const usedIn = new Set<number>()
  const pairs: TransferPair[] = []
  const unmatchedOut: MatchTx[] = []

  const inIdx = ins.map((_, i) => i)

  for (const out of outs) {
    const need = Math.abs(Number(out.amount))
    let best = -1
    let bestDays = 999
    for (const i of inIdx) {
      if (usedIn.has(i)) continue
      const cand = ins[i]
      if (sameAccount(cand.bank_account, out.bank_account)) continue
      if (Math.abs(Math.abs(Number(cand.amount)) - need) > AMOUNT_TOL) continue
      const d = daysBetween(cand.date, out.date)
      if (d > DAY_WINDOW) continue
      if (d < bestDays) {
        bestDays = d
        best = i
      }
    }
    if (best >= 0) {
      usedIn.add(best)
      const inTx = ins[best]
      pairs.push({
        id: `tr:${out.date}:${inTx.date}:${need.toFixed(2)}:${String(out.bank_account).slice(0, 12)}`,
        outTx: out,
        inTx,
        amount: Math.round(need * 100) / 100,
        outDate: String(out.date).slice(0, 10),
        inDate: String(inTx.date).slice(0, 10),
        originLabel: `viene de ${out.bank_account || "otra cuenta"}`,
      })
    } else if (looksLikeTransfer(out.detail)) {
      unmatchedOut.push(out)
    }
  }

  const unmatchedIn = ins.filter((_, i) => !usedIn.has(i)).filter((t) => looksLikeTransfer(t.detail))
  pairs.sort((a, b) => b.outDate.localeCompare(a.outDate))
  return { pairs, unmatchedOut, unmatchedIn }
}

/**
 * Ingreso REAL (sin duplicar): suma de entradas excluyendo las llegadas
 * que son transferencias internas. Úsalo en cualquier total de ingresos.
 */
export function realIncomeTotal(txs: MatchTx[], report?: TransferReport): number {
  const r = report || matchTransfers(txs)
  const transferInKeys = new Set(r.pairs.map((p) => p.inTx))
  let total = 0
  for (const t of txs || []) {
    if (Number(t.amount) > AMOUNT_TOL && !transferInKeys.has(t)) total += Number(t.amount)
  }
  return Math.round(total * 100) / 100
}
