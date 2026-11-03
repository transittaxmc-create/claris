// Sistema de pago de facturas por partes.
//
// Una factura (Expense con docType "factura") puede pagarse en varios pagos,
// desde distintas cuentas. Cada pago cae en el register de su cuenta; la
// factura lleva la cuenta Total | Pagado | Resta y se cancela sola al
// completarse. Los pagos detectados del banco se PROPONEN (nunca se aplican
// solos, salvo regla aprendida) y Miguel los aprueba con ✓ o los descarta
// con ✕. Todo editable siempre.

import {
  normalizeVendorName,
  newBillPayment,
  money,
  type BillPayment,
  type BillPaymentSource,
  type Expense,
} from "./types"

export type { BillPayment, BillPaymentSource }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

/** ¿Es factura (por pagar)? */
export function isBill(e: Expense): boolean {
  return e.docType === "factura"
}

export function billPayments(e: Expense): BillPayment[] {
  return Array.isArray(e.payments) ? e.payments : []
}

/** Total pagado a la factura. */
export function billPaidTotal(e: Expense): number {
  return r2(billPayments(e).reduce((s, p) => s + (Number(p.amount) || 0), 0))
}

/** Lo que resta payable. */
export function billRemaining(e: Expense): number {
  return r2((Number(e.amount) || 0) - billPaidTotal(e))
}

export type BillStatus = "abierta" | "pagada"

/** La factura se cancela sola cuando lo pagado cubre el total. */
export function billStatus(e: Expense): BillStatus {
  if (!isBill(e)) return "abierta"
  return billRemaining(e) <= 0.009 ? "pagada" : "abierta"
}

export function isBillOpen(e: Expense): boolean {
  return isBill(e) && billStatus(e) === "abierta"
}

export function addBillPayment(
  e: Expense,
  p: Omit<BillPayment, "id" | "createdAt">,
): Expense {
  // Sello de invoice (Miguel, 2026-11-03): TODO pago aplicado a una factura
  // queda guardado con el número de ESA factura. Es el destino con nombre
  // del pago: si mañana se duda de un pago, el número dice a qué factura
  // fue. Se estampa aquí, en el único punto por donde pasan todos los
  // pagos (banco, recibo o manual), para que ninguna vía quede sin sello.
  const payment = newBillPayment({
    ...p,
    invoiceNo: p.invoiceNo ?? (e.invoiceNo?.trim() ? e.invoiceNo.trim() : undefined),
  })
  return { ...e, payments: [...billPayments(e), payment], updatedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Números de invoice (identidad de la factura — Miguel, 2026-11-03)
// ---------------------------------------------------------------------------

/** Normaliza un número de invoice SOLO para comparar: mayúsculas y sin
 *  caracteres que no sean letras/dígitos ("CBL-1263590" = "cbl 1263590").
 *  Lo guardado nunca se reescribe: se guarda tal como viene impreso. */
export function normalizeInvoiceNo(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
}

/** ¿Dos números de invoice son el mismo? (ambos deben existir). */
export function invoiceNoMatches(a: unknown, b: unknown): boolean {
  const na = normalizeInvoiceNo(a)
  return na.length > 0 && na === normalizeInvoiceNo(b)
}

/** La factura (de cualquier estado) que ya lleva este número para este
 *  vendedor — la identidad es vendedor + número. Null si no hay ninguna. */
export function findBillByInvoiceNo(
  expenses: Expense[],
  vendor: unknown,
  invoiceNo: unknown,
  excludeId?: string,
): Expense | null {
  if (!normalizeInvoiceNo(invoiceNo)) return null
  const hit = (expenses || []).find(
    (b) =>
      isBill(b) &&
      b.id !== excludeId &&
      invoiceNoMatches(b.invoiceNo, invoiceNo) &&
      vendorFuzzyMatch(b.vendor, vendor),
  )
  return hit ?? null
}

export function removeBillPayment(e: Expense, paymentId: string): Expense {
  return {
    ...e,
    payments: billPayments(e).filter((p) => p.id !== paymentId),
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Coincidencia de vendedor (difusa)
// ---------------------------------------------------------------------------

/** Palabras genéricas de razón social que el banco NO trae en el detalle
 *  del cargo ("Mercury Financial" en el bill vs "MERCURY CARD FBT
 *  PAYMENT" en el banco): se quitan de los dos lados antes de comparar,
 *  si no la comparación por tokens nunca pasa y el pago nunca se aplica
 *  solo (caso Mercury, 2026-11-01). */
const GENERIC_VENDOR_WORDS = new Set([
  "financial", "finanzas", "bank", "banco", "card", "cards", "tarjeta",
  "services", "service", "servicios", "payments", "payment", "pagos",
  "inc", "llc", "corp", "company", "co", "group", "grupo", "solutions", "usa",
])

/** "CB LIVERY" ≈ "cb livery" ≈ "CB LIVERY 12345". */
export function vendorFuzzyMatch(a: unknown, b: unknown): boolean {
  const na = normalizeVendorName(a)
  const nb = normalizeVendorName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const strip = (toks: string[]) => toks.filter((t) => !GENERIC_VENDOR_WORDS.has(t))
  const rawA = na.split(" ").filter((t) => t.length > 2)
  const rawB = nb.split(" ").filter((t) => t.length > 2)
  const ta = strip(rawA)
  const tb = strip(rawB)
  // Si al quitar lo genérico un lado queda vacío, se compara con los
  // tokens crudos (un vendor que ES solo genérico no debe casar con todo).
  const useA = ta.length > 0 ? ta : rawA
  const useB = tb.length > 0 ? tb : rawB
  if (useA.length === 0 || useB.length === 0) return na.includes(nb) || nb.includes(na)
  const [short, long] = useA.length <= useB.length ? [useA, useB] : [useB, useA]
  return short.every((t) => long.some((u) => u.includes(t) || t.includes(u)))
}

export function daysBetween(a: string, b: string): number {
  const t = (s: string) => new Date(`${String(s).slice(0, 10)}T12:00:00`).getTime()
  const ms = t(a) - t(b)
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 86400000)) : 999
}

// ---------------------------------------------------------------------------
// Detección bancaria
// ---------------------------------------------------------------------------

export type BankTxIn = {
  date: string
  bank_account: string
  detail: string
  amount: number
}

/** Id estable para un cargo bancario (para no sugerirlo dos veces). */
export function bankTxIdOf(tx: BankTxIn): string {
  return [String(tx.date).slice(0, 10), String(tx.bank_account || ""), String(tx.detail || ""), String(tx.amount)].join("|")
}

const DETECT_AMOUNT_TOL = 0.011
const DETECT_DAY_WINDOW = 7
/** El cargo puede ser de a lo sumo 2 días ANTES de la fecha del bill:
 *  un pago de 3+ días antes casi siempre pertenece al ciclo ANTERIOR
 *  (así cayó el pago de $622 del ciclo del 22-oct en el bill del 29-oct,
 *  2026-11-01). Hacia adelante se mantienen los 7 días (rezago del
 *  banco al postear). */
const DETECT_EARLY_DAYS = 2

/** Diferencia en días (b − a) con signo. */
function signedDayDiff(a: string, b: string): number {
  const t = (x: string) => new Date(`${String(x).slice(0, 10)}T12:00:00`).getTime()
  const ms = t(b) - t(a)
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : 999
}

/** ¿El cargo cae en la ventana del bill? (bill − cargo entre −7 y +2) */
function withinDetectWindow(txDate: string, billDate: string): boolean {
  const diff = signedDayDiff(txDate, billDate)
  return diff <= DETECT_EARLY_DAYS && diff >= -DETECT_DAY_WINDOW
}

export type DetectedPayment = {
  /** Id estable del grupo (para descartes). */
  id: string
  billId: string
  billVendor: string
  billRemaining: number
  txs: BankTxIn[]
  total: number
  /** true = los cargos suman el total de la factura (pago dividido). */
  isSplit: boolean
  /** true = UN cargo cubre VARIOS bills (pago grupal): `total` es la parte
   * que le toca a ESTE bill, no el monto completo del cargo. */
  isGroup?: boolean
  /** Id del pago grupal (el mismo para todos los bills que cubre). */
  groupId?: string
  /** La parte del cargo que paga este bill (solo si isGroup). */
  share?: number
}

function txMatchesBill(bill: Expense, tx: BankTxIn, remaining: number): boolean {
  const amt = Number(tx.amount)
  if (!Number.isFinite(amt) || amt >= -0.009) return false // solo salidas
  if (Math.abs(amt) > remaining + DETECT_AMOUNT_TOL) return false
  if (!vendorFuzzyMatch(bill.vendor, tx.detail)) return false
  if (!withinDetectWindow(tx.date, bill.date)) return false
  return true
}

/**
 * Detecta pagos de facturas entre los cargos bancarios.
 * - Agrupa por factura; si varios cargos de distintas cuentas suman el resto
 *   (±$0.01), se propone como UN pago dividido.
 * - Un cargo que encaje en varias facturas abiertas se omite (ambiguo).
 * - Nunca toca nada: devuelve sugerencias para que Miguel apruebe.
 */
export function detectBillPayments(expenses: Expense[], bankTxs: BankTxIn[]): DetectedPayment[] {
  const bills = expenses.filter(isBillOpen)
  if (bills.length === 0 || bankTxs.length === 0) return []
  // Un cargo ya aplicado a CUALQUIER bill (abierto o ya cerrado) nunca
  // se vuelve a proponer: si no, al cerrarse un bill su pago "flota" y
  // se pega al ciclo siguiente (doble conteo).
  const allBills = expenses.filter(isBill)
  const used = new Set<string>()
  for (const b of allBills) for (const p of billPayments(b)) if (p.bankTxId) used.add(p.bankTxId)

  // Fechas de los bills por vendedor (para el límite de ciclo de abajo).
  const groupKeyOf = (b: Expense) => normalizeVendorName(b.vendor)
  const datesByGroup = new Map<string, string[]>()
  for (const b of allBills) {
    const k = groupKeyOf(b)
    if (!k) continue
    const arr = datesByGroup.get(k) ?? []
    arr.push(String(b.date).slice(0, 10))
    datesByGroup.set(k, arr)
  }
  for (const arr of datesByGroup.values()) arr.sort()
  /** Fecha del bill anterior del mismo vendedor (null si es el primero). */
  const prevBillDateOf = (b: Expense): string | null => {
    const arr = datesByGroup.get(groupKeyOf(b)) ?? []
    const bd = String(b.date).slice(0, 10)
    let prev: string | null = null
    for (const d of arr) {
      if (d < bd) prev = d
      else break
    }
    return prev
  }
  /** LÍMITE DE CICLO: un cargo fechado en o antes del bill anterior del
   *  mismo vendedor no puede ser de este bill — es del ciclo anterior. */
  const crossesCycleBoundary = (b: Expense, tx: BankTxIn): boolean => {
    const prev = prevBillDateOf(b)
    return prev !== null && String(tx.date).slice(0, 10) <= prev
  }

  const remainingByBill = new Map(bills.map((b) => [b.id, billRemaining(b)]))

  // cargo -> facturas candidatas
  const matches = new Map<string, { tx: BankTxIn; billId: string }[]>()
  for (const tx of bankTxs) {
    const tid = bankTxIdOf(tx)
    if (used.has(tid)) continue
    const rawCands: { tx: BankTxIn; billId: string }[] = []
    for (const b of bills) {
      if (crossesCycleBoundary(b, tx)) continue
      if (txMatchesBill(b, tx, remainingByBill.get(b.id) ?? 0)) rawCands.push({ tx, billId: b.id })
    }
    // FIFO POR VENDEDOR (orden de Miguel, 2026-11-01): entre los bills
    // del MISMO vendedor, el pago va al abierto más viejo que le quepa
    // — nunca salta a un ciclo nuevo debiéndose el anterior. Si dos
    // bills del mismo vendedor comparten la fecha más vieja, ese grupo
    // es ambiguo y se descarta. Entre vendedores distintos sigue la
    // regla de siempre: 2+ candidatos = ambiguo, no se sugiere.
    const byGroup = new Map<string, { tx: BankTxIn; billId: string }[]>()
    for (const c of rawCands) {
      const bill = bills.find((x) => x.id === c.billId)
      if (!bill) continue
      const k = groupKeyOf(bill)
      const arr = byGroup.get(k) ?? []
      arr.push(c)
      byGroup.set(k, arr)
    }
    const cands: { tx: BankTxIn; billId: string }[] = []
    for (const arr of byGroup.values()) {
      let minDate = "9999-12-31"
      for (const c of arr) {
        const bd = String(bills.find((x) => x.id === c.billId)?.date ?? "").slice(0, 10)
        if (bd && bd < minDate) minDate = bd
      }
      const earliest = arr.filter(
        (c) => String(bills.find((x) => x.id === c.billId)?.date ?? "").slice(0, 10) === minDate,
      )
      if (earliest.length === 1) cands.push(earliest[0])
    }
    // Ambiguo (encaja en 2+ facturas): no se sugiere, Miguel lo anota a mano.
    if (cands.length === 1) matches.set(tid, cands)
  }
  // Sin macheos 1-a-1 NO se sale: abajo corre el macheo grupal
  // (un cargo → varios bills), que es justo el caso sin candidatos aquí.

  // Agrupar por factura
  const byBill = new Map<string, BankTxIn[]>()
  for (const [, cands] of matches) {
    const { tx, billId } = cands[0]
    if (!byBill.has(billId)) byBill.set(billId, [])
    byBill.get(billId)!.push(tx)
  }

  const out: DetectedPayment[] = []
  for (const [billId, txs] of byBill) {
    const bill = bills.find((b) => b.id === billId)
    if (!bill) continue
    const remaining = remainingByBill.get(billId) ?? 0
    const total = r2(txs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0))
    const isSplit = txs.length > 1 && Math.abs(total - remaining) <= 0.011
    if (isSplit) {
      // Un pago dividido: se propone junto.
      out.push({
        id: `split:${billId}:${txs.map(bankTxIdOf).sort().join(";")}`,
        billId,
        billVendor: bill.vendor,
        billRemaining: remaining,
        txs: [...txs].sort((a, b) => String(a.date).localeCompare(String(b.date))),
        total,
        isSplit: true,
      })
    } else {
      for (const tx of txs) {
        out.push({
          id: `single:${billId}:${bankTxIdOf(tx)}`,
          billId,
          billVendor: bill.vendor,
          billRemaining: remaining,
          txs: [tx],
          total: r2(Math.abs(Number(tx.amount) || 0)),
          isSplit: false,
        })
      }
    }
  }
  // ------------------------------------------------------------------
  // Pago GRUPAL (regla de Miguel, 2026-10-29): UN cargo que cubre VARIOS
  // bills abiertos del mismo comercio (ej. un pago de PayPal de $1,085.90
  // = leasing $919 + tolls $161.90 + fee $5). El macheo anterior solo
  // sabía muchos-cargos→un-bill; el caso inverso quedaba sin aplicar y
  // los bills seguían proyectando. Si la suma de 2+ bills la cubre el
  // cargo (exacta o con resto de fee ≤ $10) y hay UNA sola combinación
  // posible, se emite una detección por bill con su parte (share). Si
  // hay dos combinaciones, no se adivina: no se emite nada.
  // ------------------------------------------------------------------
  const claimed = new Set<string>()
  for (const d of out) for (const tx of d.txs) claimed.add(bankTxIdOf(tx))
  // Un bill que ya tiene detección 1-a-1 no entra al macheo grupal: ya
  // está hablado por ese sistema y no se le puede pagar dos veces.
  const proposedBills = new Set(out.map((d) => d.billId))
  const groupBillsUsed = new Set<string>()
  for (const tx of bankTxs) {
    const tid = bankTxIdOf(tx)
    if (used.has(tid) || claimed.has(tid)) continue
    const txAmt = Math.abs(Number(tx.amount) || 0)
    if (!(Number(tx.amount) < 0) || txAmt < 0.01) continue
    let cands = bills
      .filter(
        (b) =>
          !groupBillsUsed.has(b.id) &&
          !proposedBills.has(b.id) &&
          (remainingByBill.get(b.id) ?? 0) <= txAmt + DETECT_AMOUNT_TOL &&
          vendorFuzzyMatch(b.vendor, tx.detail) &&
          !crossesCycleBoundary(b, tx) &&
          withinDetectWindow(tx.date, b.date),
      )
      .sort((a, b) => daysBetween(tx.date, a.date) - daysBetween(tx.date, b.date))
    if (cands.length < 2) continue
    if (cands.length > 12) cands = cands.slice(0, 12)
    let bestSum = -1
    let bestGap = Infinity
    let bestSets = 0
    let bestMask = 0
    const n = cands.length
    for (let mask = 1; mask < 1 << n; mask++) {
      let bits = 0
      let sum = 0
      let gap = 0
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) {
          bits++
          sum += remainingByBill.get(cands[j].id) ?? 0
          gap += daysBetween(tx.date, cands[j].date)
        }
      }
      if (bits < 2) continue
      sum = r2(sum)
      const rest = r2(txAmt - sum)
      if (rest < -DETECT_AMOUNT_TOL || rest > 10 + DETECT_AMOUNT_TOL) continue
      if (sum > bestSum + DETECT_AMOUNT_TOL || (Math.abs(sum - bestSum) <= DETECT_AMOUNT_TOL && gap < bestGap)) {
        bestSum = sum
        bestGap = gap
        bestSets = 1
        bestMask = mask
      } else if (Math.abs(sum - bestSum) <= DETECT_AMOUNT_TOL && gap === bestGap) {
        bestSets++
      }
    }
    if (bestSets !== 1 || bestMask === 0) continue
    const groupId = `group:${tid}`
    for (let j = 0; j < n; j++) {
      if (!(bestMask & (1 << j))) continue
      const bill = cands[j]
      const share = remainingByBill.get(bill.id) ?? 0
      groupBillsUsed.add(bill.id)
      out.push({
        id: `${groupId}:${bill.id}`,
        billId: bill.id,
        billVendor: bill.vendor,
        billRemaining: share,
        txs: [tx],
        total: share,
        isSplit: false,
        isGroup: true,
        groupId,
        share,
      })
    }
    claimed.add(tid)
  }

  // ------------------------------------------------------------------
  // Pago MIXTO del mismo vendedor (regla de Miguel, 2026-11-02):
  // varios bills abiertos del MISMO comercio (ej. CB Livery: carro $924
  // + peajes) cubiertos por VARIOS cargos de distintas cuentas
  // (PayPal + Citibank). El detalle del banco puede ser "PAYPAL" o
  // "CITI" — no exige vendorFuzzyMatch estricto si es un procesador
  // conocido. Si la suma de los cargos cubre la suma de los bills
  // (exacta o con fee ≤ $10) y hay UNA sola combinación clara, se
  // emite una detección por bill con su parte. Si no alcanza, no se
  // cierra nada: solo se proponen parciales claros o nada.
  // ------------------------------------------------------------------
  const PROCESSORS = new Set(["paypal", "venmo", "zelle", "cash app", "square", "stripe"])
  const isProcessor = (detail: string) => {
    const d = String(detail || "").toLowerCase()
    return [...PROCESSORS].some((p) => d.includes(p))
  }
  const vendorGroups = new Map<string, Expense[]>()
  for (const b of bills) {
    if (proposedBills.has(b.id) || groupBillsUsed.has(b.id)) continue
    const k = groupKeyOf(b)
    if (!k) continue
    const arr = vendorGroups.get(k) ?? []
    arr.push(b)
    vendorGroups.set(k, arr)
  }
  for (const [vk, vBills] of vendorGroups) {
    if (vBills.length < 1) continue
    const openForVendor = vBills.filter((b) => (remainingByBill.get(b.id) ?? 0) > 0.009)
    if (openForVendor.length === 0) continue
    // Cargos no usados que caen en la ventana de alguno de estos bills
    const candTxs = bankTxs.filter((tx) => {
      const tid = bankTxIdOf(tx)
      if (used.has(tid) || claimed.has(tid)) return false
      const amt = Math.abs(Number(tx.amount) || 0)
      if (!(Number(tx.amount) < 0) || amt < 0.01) return false
      const matchesWindow = openForVendor.some((b) => withinDetectWindow(tx.date, b.date) && !crossesCycleBoundary(b, tx))
      if (!matchesWindow) return false
      // Acepta si el detalle matchea el vendedor O es un procesador conocido
      return vendorFuzzyMatch(vk, tx.detail) || isProcessor(tx.detail)
    })
    if (candTxs.length === 0) continue
    const totalRemaining = r2(openForVendor.reduce((s, b) => s + (remainingByBill.get(b.id) ?? 0), 0))
    const totalTx = r2(candTxs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0))
    const rest = r2(totalTx - totalRemaining)
    // Solo auto-aplicar si la suma cubre exactamente (o con fee ≤ $10)
    // y hay una sola combinación razonable. Si falta dinero, no se cierra.
    if (rest < -DETECT_AMOUNT_TOL || rest > 10 + DETECT_AMOUNT_TOL) continue
    // Emitir una detección por bill con su remaining completo (share)
    const groupId = `mix:${vk}:${candTxs.map(bankTxIdOf).sort().join(";")}`
    for (const bill of openForVendor) {
      const share = remainingByBill.get(bill.id) ?? 0
      if (share <= 0.009) continue
      groupBillsUsed.add(bill.id)
      out.push({
        id: `${groupId}:${bill.id}`,
        billId: bill.id,
        billVendor: bill.vendor,
        billRemaining: share,
        txs: [...candTxs].sort((a, b) => String(a.date).localeCompare(String(b.date))),
        total: share,
        isSplit: candTxs.length > 1,
        isGroup: true,
        groupId,
        share,
      })
    }
    for (const tx of candTxs) claimed.add(bankTxIdOf(tx))
  }

  return out.sort((a, b) => String(a.txs[0]?.date || "").localeCompare(String(b.txs[0]?.date || "")))
}

// ---------------------------------------------------------------------------
// Recibo escaneado -> ¿es pago de una factura abierta?
// ---------------------------------------------------------------------------

/**
 * Si UN solo recibo encaja en UNA sola factura abierta (vendedor + monto ≤
 * resto), se devuelve para ofrecer "¿Es pago de esta factura?".
 *
 * PRIORIDAD POR NÚMERO (Miguel, 2026-11-03): si el recibo lista los
 * invoices que paga (invoiceRefs, ej. la confirmación del portal del
 * leasing), manda el número, no el monto: la factura abierta cuyo
 * invoiceNo aparece en la lista es la candidata, aunque el monto del
 * recibo cubra varias (pago grupal). Solo si el número no resuelve un
 * único destino se cae al macheo de siempre (vendedor + monto).
 */
export function findBillForReceipt(
  expenses: Expense[],
  receipt: { vendor: string; amount: number; invoiceRefs?: string[] },
): Expense | null {
  const need = Math.abs(Number(receipt.amount) || 0)
  if (need <= 0) return null
  const refs = (receipt.invoiceRefs || []).filter((r) => normalizeInvoiceNo(r))
  if (refs.length > 0) {
    const byNumber = expenses.filter(
      (b) => isBillOpen(b) && b.invoiceNo && refs.some((r) => invoiceNoMatches(b.invoiceNo, r)),
    )
    if (byNumber.length === 1) return byNumber[0]
    if (byNumber.length > 1) {
      // El recibo cubre varias facturas por número: se ofrece la más vieja
      // (FIFO) y el resto queda para registro manual — nunca se adivina
      // un reparto sin que Miguel lo vea.
      const sorted = [...byNumber].sort((a, b) => String(a.date).localeCompare(String(b.date)))
      return sorted[0]
    }
  }
  const cands = expenses.filter(
    (b) =>
      isBillOpen(b) &&
      vendorFuzzyMatch(b.vendor, receipt.vendor) &&
      need <= billRemaining(b) + DETECT_AMOUNT_TOL,
  )
  return cands.length === 1 ? cands[0] : null
}

/** Pregunta a Miguel si el recibo es pago de la factura; devuelve el pago o null. */
export function offerReceiptBillMatch(
  expenses: Expense[],
  receipt: { vendor: string; amount: number; date: string; accountId?: string; id: string; invoiceRefs?: string[] },
): { bill: Expense; payment: Omit<BillPayment, "id" | "createdAt"> } | null {
  const bill = findBillForReceipt(expenses, receipt)
  if (!bill) return null
  const remaining = billRemaining(bill)
  const need = Math.abs(Number(receipt.amount) || 0)
  // Pago grupal por número: el recibo puede cubrir varias facturas; a ESTA
  // se le aplica solo su parte (lo que resta), nunca más de lo que debe.
  const amount = Math.min(need, remaining)
  const byNumber = Boolean(
    bill.invoiceNo &&
      (receipt.invoiceRefs || []).some((r) => invoiceNoMatches(bill.invoiceNo, r)),
  )
  const ok = window.confirm(
    byNumber
      ? `This receipt from ${receipt.vendor} (${money(need)}) lists invoice ${bill.invoiceNo} — apply ${money(amount)} to the bill "${bill.vendor}" (${bill.invoiceNo})?\n\nRemaining on that bill: ${money(remaining)}.`
      : `This receipt from ${receipt.vendor} (${money(need)}) es pago de la factura "${bill.vendor}"?\n\nRestan ${money(remaining)}.`,
  )
  if (!ok) return null
  return {
    bill,
    payment: {
      amount,
      accountId: receipt.accountId,
      date: String(receipt.date).slice(0, 10),
      source: "recibo",
      receiptId: receipt.id,
    },
  }
}

// ---------------------------------------------------------------------------
// Aprendizaje: el asistente aprende de las decisiones de Miguel
// ---------------------------------------------------------------------------

const RULES_KEY = "claris_learned_rules"

export type LearnedRule = {
  /** Vendedor de la factura tal como Miguel la tiene (para re-encontrarla). */
  billVendor: string
  accountId?: string
  /** Veces que Miguel confirmó este mapeo. Con 2+, el 3er caso se auto-clasifica. */
  confirmations: number
}

export function loadLearnedRules(): Record<string, LearnedRule> {
  try {
    const raw = JSON.parse(localStorage.getItem(RULES_KEY) || "{}")
    if (raw && typeof raw === "object") return raw as Record<string, LearnedRule>
  } catch {}
  return {}
}

export function saveLearnedRules(rules: Record<string, LearnedRule>): void {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules))
  } catch {}
}

/** Clave de la regla: vendedor normalizado del cargo/recibo. */
export function ruleKeyFor(vendor: unknown): string {
  return normalizeVendorName(vendor)
}

/** Miguel confirmó: este vendedor paga esta factura. Suma una confirmación. */
export function learnConfirm(vendor: unknown, bill: Expense, accountId?: string): void {
  const key = ruleKeyFor(vendor)
  if (!key) return
  const rules = loadLearnedRules()
  const cur = rules[key]
  rules[key] = {
    billVendor: bill.vendor,
    accountId: accountId || cur?.accountId,
    confirmations: (cur?.confirmations || 0) + 1,
  }
  saveLearnedRules(rules)
}

/** Miguel descartó la sugerencia: la regla se reinicia (no se vuelve a proponer igual). */
export function learnDismiss(vendor: unknown): void {
  const key = ruleKeyFor(vendor)
  if (!key) return
  const rules = loadLearnedRules()
  if (rules[key]) {
    rules[key] = { ...rules[key], confirmations: 0 }
    saveLearnedRules(rules)
  }
}

/**
 * ¿Este vendedor ya tiene 2+ confirmaciones hacia una factura?
 * Si sí, el caso repetitivo se puede clasificar solo (con etiqueta "auto").
 */
export function learnedRuleFor(vendor: unknown): LearnedRule | null {
  const key = ruleKeyFor(vendor)
  if (!key) return null
  const r = loadLearnedRules()[key]
  return r && r.confirmations >= 2 ? r : null
}

/** Busca la factura abierta a la que apunta una regla aprendida. */
export function billForLearnedRule(expenses: Expense[], rule: LearnedRule): Expense | null {
  const cands = expenses.filter((b) => isBillOpen(b) && vendorFuzzyMatch(b.vendor, rule.billVendor))
  return cands.length === 1 ? cands[0] : null
}

// ---------------------------------------------------------------------------
// Proyecciones: la factura proyectada muestra el RESTO, no el total
// ---------------------------------------------------------------------------

const PROJECTION_MATCH_DAYS = 31

/**
 * Escribe en el ledger de proyecciones (claris_cash_flow_entries): la entrada
 * proyectada de la factura pasa a mostrar lo que RESTA; si está pagada, sale
 * de las proyecciones. Se enlaza por vendedor (difuso) y fecha cercana.
 */
export function syncBillToProjections(bill: Expense): void {
  let entries: any[]
  try {
    const raw = JSON.parse(localStorage.getItem("claris_cash_flow_entries") || "[]")
    if (!Array.isArray(raw)) return
    entries = raw
  } catch {
    return
  }
  const remaining = billRemaining(bill)
  let changed = false
  const next: any[] = []
  for (const e of entries) {
    // Un pago solo toca la proyección de SU bill: la entrada propia
    // (claris:gasto:<id del bill>) o la del mismo comercio EN LA MISMA
    // FECHA. Antes una ventana de 31 días dejaba que un pago del ciclo
    // anterior rebajara el bill nuevo (leasing: $919 → $297 con el pago
    // de $622 del ciclo pasado, 2026-10-28).
    if (
      e &&
      e.type === "expense" &&
      e.status === "projected" &&
      (e.id === `claris:gasto:${bill.id}` ||
        (vendorFuzzyMatch(e.description, bill.vendor) &&
          String(e.date || "").slice(0, 10) === String(bill.date || "").slice(0, 10)))
    ) {
      changed = true
      if (remaining <= 0.009) continue // pagada: sale de proyecciones
      const sign = Number(e.amount) < 0 ? -1 : 1
      next.push({ ...e, amount: sign * remaining })
      continue
    }
    next.push(e)
  }
  if (changed) {
    try {
      localStorage.setItem("claris_cash_flow_entries", JSON.stringify(next))
    } catch {}
  }
}
