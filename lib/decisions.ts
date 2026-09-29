// Decisiones de dinero, en un solo sitio y sin React (para poder probarlas).
//
// De aquí sale el héroe de FINANCE ("¿PUEDO GASTAR?") y la lista de avisos.
// La regla de la casa: el héroe tiene que ser CONSERVADOR y EXPLICABLE — solo
// cuenta la plata que ya está (el banco), no la que se espera — y los avisos
// nunca pasan de tres: primero lo urgente, después por dinero.

export type SpendableVerdict = "aire" | "ajustado" | "corto"

export type Spendable = {
  amount: number // lo que puedes gastar; negativo = estás corto
  verdict: SpendableVerdict
  // % de los compromisos que cubre el dinero disponible (100 = justo, >100 = sobra)
  coveragePct: number
  // Margen de aire: cuánto queda después de cubrir, en % del banco
  marginPct: number
}

function round2(n: number): number {
  const abs = Math.round(Math.abs(Number(n) || 0) * 100) / 100
  return Number(n) < 0 ? -abs : abs
}

// ¿PUEDO GASTAR? = banco − compromisos − reserva.
// "Compromisos" son los vencimientos que ya conoces (facturas y pagos
// programados). Si el resultado queda por debajo del 10 % del banco, está
// AJUSTADO; si es negativo, estás CORTO.
export function spendable(input: { bank: number; commitments: number; reserve: number }): Spendable {
  const bank = Number(input.bank) || 0
  const commitments = Math.max(0, Number(input.commitments) || 0)
  const reserve = Math.max(0, Number(input.reserve) || 0)
  const amount = round2(bank - commitments - reserve)

  const availableForCommitments = bank - reserve
  const coveragePct =
    commitments <= 0 ? 100 : Math.max(0, Math.round((availableForCommitments / commitments) * 100))
  const marginPct = bank <= 0 ? 0 : Math.round((amount / bank) * 100)

  let verdict: SpendableVerdict = "aire"
  if (amount < 0) verdict = "corto"
  else if (amount < Math.max(50, bank * 0.1)) verdict = "ajustado"

  return { amount, verdict, coveragePct, marginPct }
}

export type PanoramaLikeDay = {
  date: string
  realIncome: number
  expenses: number
  payments: { description: string; amount: number }[]
  balanceAfter: number
  belowZero: boolean
}

export type TightDay = {
  date: string
  balanceAfter: number
  dueAmount: number
  due: string[]
}

// El día más ajustado de la semana: el de balance más bajo. Si empatan, el
// primero (el más cercano). Con eso el aviso dice QUÉ día aprieta y por qué.
export function tightestDay(days: PanoramaLikeDay[]): TightDay | null {
  if (days.length === 0) return null
  let best: TightDay | null = null
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const dueAmount = round2(
      (Number(day.expenses) || 0) + day.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    )
    if (best === null || day.balanceAfter < best.balanceAfter) {
      best = {
        date: day.date,
        balanceAfter: round2(day.balanceAfter),
        dueAmount,
        due: day.payments.map((p) => p.description),
      }
    }
  }
  return best
}

export type AlertTone = "danger" | "warn" | "info"

export type MoneyAlert = {
  id: string
  title: string
  detail: string
  amount: number
  tone: AlertTone
  // 0 = urgente (ya venció o la semana no cierra) · 1 = plata pendiente · 2 = higiene
  tier: 0 | 1 | 2
}

export type AlertInput = {
  overdue: { description: string; amount: number; daysLate: number }[]
  unpaidTollBills: { count: number; amount: number }
  shortfall: number
  tightDay: TightDay | null
  expensesWithoutReceipt: { count: number; amount: number }
  unclassified: { count: number }
}

// Avisos ordenados: primero lo urgente, después por dinero. Máximo `max`.
export function moneyAlerts(input: AlertInput, max = 3): MoneyAlert[] {
  const alerts: MoneyAlert[] = []

  if (input.overdue.length > 0) {
    const total = round2(input.overdue.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))
    const oldest = input.overdue.reduce((worst, p) => (p.daysLate > worst.daysLate ? p : worst), input.overdue[0])
    alerts.push({
      id: "vencidos",
      title: input.overdue.length === 1 ? "1 pago vencido" : `${input.overdue.length} pagos vencidos`,
      detail: `${oldest.description} · hace ${oldest.daysLate} ${oldest.daysLate === 1 ? "día" : "días"}`,
      amount: total,
      tone: "danger",
      tier: 0,
    })
  }

  if (input.shortfall > 0) {
    const dia = input.tightDay ? ` El día más ajustado es el ${input.tightDay.date}.` : ""
    alerts.push({
      id: "semana-corta",
      title: "La semana no cierra con lo que hay",
      detail: `Faltan $${round2(input.shortfall).toFixed(2)} para cubrir todo lo que vence.${dia}`,
      amount: round2(input.shortfall),
      tone: "danger",
      tier: 0,
    })
  }

  if (input.unpaidTollBills.count > 0) {
    alerts.push({
      id: "peajes",
      title:
        input.unpaidTollBills.count === 1
          ? "1 factura de peaje sin pagar"
          : `${input.unpaidTollBills.count} facturas de peaje sin pagar`,
      detail: `$${round2(input.unpaidTollBills.amount).toFixed(2)} pendientes de pago`,
      amount: round2(input.unpaidTollBills.amount),
      tone: "warn",
      tier: 1,
    })
  }

  if (input.expensesWithoutReceipt.count > 0) {
    alerts.push({
      id: "sin-recibo",
      title:
        input.expensesWithoutReceipt.count === 1
          ? "1 gasto sin recibo"
          : `${input.expensesWithoutReceipt.count} gastos sin recibo`,
      detail: `$${round2(input.expensesWithoutReceipt.amount).toFixed(2)} que no puedes deducir sin el recibo`,
      amount: round2(input.expensesWithoutReceipt.amount),
      tone: "info",
      tier: 2,
    })
  }

  if (input.unclassified.count > 0) {
    alerts.push({
      id: "sin-clasificar",
      title:
        input.unclassified.count === 1
          ? "1 gasto sin clasificar"
          : `${input.unclassified.count} gastos sin clasificar`,
      detail: "Sepáralos en negocio o personal para la declaración",
      amount: 0,
      tone: "info",
      tier: 2,
    })
  }

  return alerts
    .sort((a, b) => (a.tier === b.tier ? b.amount - a.amount : a.tier - b.tier))
    .slice(0, Math.max(0, max))
}
