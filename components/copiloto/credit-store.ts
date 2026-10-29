// CREDIT — register of every credit account (Miguel, 2026-10-26).
//
// One place for cards, credit builders and tradeline subscriptions:
// what is owed, the due day, the frequency, a payoff plan (all at once,
// split in N months, or a fixed amount per month) and the schedule of
// payments through the end of the year and until the account is paid
// off. Overdue accounts are flagged with the date the payment was due.
//
// HONESTY RULE (Miguel: never hand-patch a feed value, never invent a
// number): balances and due days that no feed verifies are stored as
// null and shown as "not verified". Seeded accounts come from the
// January–October 2026 bank record and bureau alerts found on
// 2026-10-26; each seed carries its evidence in `note`. When Miguel
// enters the real balance, the schedule becomes an exact payoff plan;
// until then the schedule shows EXPECTED payments estimated from the
// last bank payment, clearly marked as estimates.
//
// Data lives in localStorage as cache and rides the finance cloud blob
// (key is in FINANCE_CLOUD_KEYS) so it is backed up in Supabase like
// the rest of DINERO — never phone-only.

export type CreditFrequency = "monthly" | "weekly" | "biweekly"
export type PlanMode = "full" | "months" | "fixed"
export type AutopayMode = "unknown" | "off" | "minimum" | "full"

export type CreditAccount = {
  id: string
  name: string
  issuer: string
  kind: string
  /** Total owed. null = not verified yet (never invented). */
  balance: number | null
  /** Credit limit. null = unknown. */
  limit: number | null
  /** Due day of month (1–31) for monthly accounts. null = unknown. */
  dueDay: number | null
  frequency: CreditFrequency
  autopay: AutopayMode
  planMode: PlanMode
  /** When planMode = "months": split the balance in this many payments. */
  planMonths: number
  /** When planMode = "fixed": this amount per payment. */
  planFixed: number
  /** When planMode = "fixed" and the creditor set a PROGRAM (e.g. Mercury:
   * $22.86 × 6): exactly this many payments of planFixed, then it stops —
   * whatever balance remains after the program stays owed. null/absent =
   * the fixed amount repeats until the balance is paid off. */
  planPayments?: number | null
  /** Last payment seen (bank record) or recorded by hand. ISO date. */
  lastPaymentDate: string | null
  lastPaymentAmount: number | null
  /** Date the missed payment was due, when the account is late. ISO. */
  overdueSince: string | null
  /** Short flag shown on the card, e.g. "OVER LIMIT". */
  flag: string
  closed: boolean
  /** Evidence / source summary in plain words. */
  note: string
}

export type ScoreEntry = {
  id: string
  date: string // ISO
  bureau: string // TransUnion | Equifax | Experian
  score: number
  source: string // Credit Karma, Experian app, SmartCredit, SoFi Relay…
}

export type CreditDoc = { v: 1; accounts: CreditAccount[]; scores: ScoreEntry[] }

export const CREDIT_KEY = "claris_credit_accounts_v1"

export const money = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export function todayLocal(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function newCreditAccount(name: string): CreditAccount {
  return {
    id: uid("credit"),
    name: name.trim() || "Credit account",
    issuer: "",
    kind: "Credit card",
    balance: null,
    limit: null,
    dueDay: null,
    frequency: "monthly",
    autopay: "unknown",
    planMode: "months",
    planMonths: 3,
    planFixed: 0,
    lastPaymentDate: null,
    lastPaymentAmount: null,
    overdueSince: null,
    flag: "",
    closed: false,
    note: "",
  }
}

export function newScoreEntry(): ScoreEntry {
  return { id: uid("score"), date: todayLocal(), bureau: "TransUnion", score: 0, source: "Credit Karma" }
}

// ---------------------------------------------------------------------------
// Seeds — found 2026-10-26 by searching the bank record from January 2026
// (Plaid: Citibank, PayPal, Square, Uber Pro) plus the bureau alerts of
// October. Balances/due days that nothing verifies stay null on purpose.
// ---------------------------------------------------------------------------

type Seed = Omit<CreditAccount, "id">

const SEEDS: { id: string; acc: Seed }[] = [
  {
    id: "credit-ava",
    acc: {
      name: "AVA FINANCE",
      issuer: "Patriot Bank · Ava Credit Builder Card",
      kind: "Credit builder card",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-10-22",
      lastPaymentAmount: 10.88,
      overdueSince: "2026-10-13",
      flag: "",
      closed: false,
      note: "Late payment reported on TransUnion Oct 13, 2026; credit limit cut Oct 4. Bank payments of $10.88 in May, Jun, Jul and Oct 2026 — none in Aug or Sep. Balance and due day not verified: enter them from the Ava app.",
    },
  },
  {
    id: "credit-beccas",
    acc: {
      name: "BECCAS",
      issuer: "Becca's · Smart Credit Builder",
      kind: "Credit builder subscription",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-07-16",
      lastPaymentAmount: 9,
      overdueSince: "2026-10-14",
      flag: "",
      closed: false,
      note: "$9/mo subscription that reports payments to all three bureaus. Bank payments May 14, Jun 16, Jul 16, 2026 — none since. Late payment reported Oct 14, 2026. Balance not verified.",
    },
  },
  {
    id: "credit-self",
    acc: {
      name: "SELF",
      issuer: "Self Lender Inc · Self Visa",
      kind: "Credit builder + secured Visa",
      balance: null,
      limit: 100,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-05-04",
      lastPaymentAmount: 35,
      overdueSince: "2026-10-24",
      flag: "",
      closed: false,
      note: "Self Visa limit is $100 and utilization was over 50% on Oct 17 (SmartCredit) — keep the reported balance under $30. An unverified note says $158.34 was due Oct 24, 2026: confirm the real balance and due day in the Self app. One bank payment found: $35 to SELF LENDER INC on May 4, 2026. Self charges a late fee at 15 days and reports to the bureaus at 30 days.",
    },
  },
  {
    id: "credit-mercury",
    acc: {
      name: "MERCURY CARD",
      issuer: "First Bank & Trust (FB&T)",
      kind: "Credit card",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-10-06",
      lastPaymentAmount: 100,
      overdueSince: null,
      flag: "OVER LIMIT",
      closed: false,
      note: "Flagged over its limit on Oct 18, 2026 (SmartCredit). Bank payments: $50.29 on Apr 29 and $100 on Oct 3, 2026. Balance, limit and due day not verified: enter them from the Mercury app or statement.",
    },
  },
  {
    id: "credit-arro",
    acc: {
      name: "ARRO",
      issuer: "Cross River Bank · Arro Finance",
      kind: "Credit builder ($2,000 tradeline)",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-10-14",
      lastPaymentAmount: 12,
      overdueSince: null,
      flag: "",
      closed: false,
      note: "Arro Credit Builder is $12/mo and reports a $2,000 tradeline to Experian and Equifax. Bank payments May–Oct 2026 — none in Aug or Sep. Balance not verified.",
    },
  },
  {
    id: "credit-tilt",
    acc: {
      name: "TILT",
      issuer: "WebBank · Tilt (formerly Empower)",
      kind: "Credit card + subscription",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-06-24",
      lastPaymentAmount: 8,
      overdueSince: null,
      flag: "NO PAYMENT SINCE JUN",
      closed: false,
      note: "Tilt subscription is $8/mo; its cards are issued by WebBank and report to all three bureaus. Bank payments in May and Jun 2026 only — none since Jun 24. Check in the Tilt app whether the account is still open.",
    },
  },
  {
    id: "credit-brigit",
    acc: {
      name: "BRIGIT",
      issuer: "Brigit",
      kind: "Cash advance + credit builder",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-06-25",
      lastPaymentAmount: 15.99,
      overdueSince: null,
      flag: "NO PAYMENT SINCE JUN",
      closed: false,
      note: "Subscription payments of $15.99 on May 28 and Jun 25, 2026; only $1 movements since (last one Oct 5). Check whether the plan is still active.",
    },
  },
  {
    id: "credit-cleo",
    acc: {
      name: "CLEO",
      issuer: "WebBank · Cleo AI",
      kind: "Credit builder card",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-07-24",
      lastPaymentAmount: 15,
      overdueSince: null,
      flag: "",
      closed: true,
      note: "Reported CLOSED on the bureau records (Credit Karma, Oct 2026). Subscription payments Jun–Sep 2026. Kept in the register for the record; no schedule is generated.",
    },
  },
  {
    id: "credit-step",
    acc: {
      name: "STEP",
      issuer: "Step · Secured card",
      kind: "Secured card / credit builder",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-07-06",
      lastPaymentAmount: 4.99,
      overdueSince: null,
      flag: "",
      closed: false,
      note: "Bank charges of $1.00 on Jun 30 and $4.99 on Jul 2, 2026. Balance and status not verified.",
    },
  },
  {
    id: "credit-payless",
    acc: {
      name: "PAYLESS RTO FURNITURE",
      issuer: "Payless RTO · Huntington Station",
      kind: "Rent-to-own (obligation)",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "weekly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-10-24",
      lastPaymentAmount: 35,
      overdueSince: null,
      flag: "",
      closed: false,
      note: "Rent-to-own furniture, about $35 per payment all year (Jan–Oct 2026), latest Oct 24, 2026. Not a bureau credit card — listed here because it is a standing obligation. Total remaining not verified.",
    },
  },
  {
    id: "credit-tmobile-eip",
    acc: {
      name: "T-MOBILE EIP",
      issuer: "T-Mobile · Equipment Installment Plan",
      kind: "Device installment",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-07-29",
      lastPaymentAmount: 98.75,
      overdueSince: null,
      flag: "",
      closed: false,
      note: "Two EIP payments via PayPal on Jul 29, 2026 ($51.25 + $47.50). Phone service is now AT&T — confirm whether this equipment plan is still open and what remains.",
    },
  },
  {
    id: "credit-earnin",
    acc: {
      name: "EARNIN",
      issuer: "EarnIn",
      kind: "Paycheck advance (not a bureau tradeline)",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-09-29",
      lastPaymentAmount: null,
      overdueSince: null,
      flag: "",
      closed: false,
      note: "Advances of $50 in Jun and Jul 2026 were repaid ($55.99 and $57.99 with fees). Amounts vary, so no fixed schedule is estimated. Listed for the analysis; advances are not a bureau credit tradeline.",
    },
  },
  {
    id: "credit-american-leasing",
    acc: {
      name: "AMERICAN LEASING",
      issuer: "American Leasing",
      kind: "Auto leasing (ended)",
      balance: null,
      limit: null,
      dueDay: null,
      frequency: "monthly",
      autopay: "unknown",
      planMode: "months",
      planMonths: 3,
      planFixed: 0,
      lastPaymentDate: "2026-01-22",
      lastPaymentAmount: 308,
      overdueSince: null,
      flag: "",
      closed: true,
      note: "Payments only in January 2026 ($332 car payment plus smaller BNPL amounts, last one Jan 22). Nothing since — kept in the register for the record.",
    },
  },
]

function seedDoc(): CreditDoc {
  return { v: 1, accounts: SEEDS.map((s) => ({ id: s.id, ...s.acc })), scores: [] }
}

export function loadCreditDoc(): CreditDoc {
  try {
    const raw = localStorage.getItem(CREDIT_KEY)
    if (!raw) {
      const doc = seedDoc()
      localStorage.setItem(CREDIT_KEY, JSON.stringify(doc))
      return doc
    }
    const p = JSON.parse(raw)
    if (p && Array.isArray(p.accounts)) {
      return { v: 1, accounts: p.accounts, scores: Array.isArray(p.scores) ? p.scores : [] }
    }
    return seedDoc()
  } catch {
    return seedDoc()
  }
}

export function saveCreditDoc(doc: CreditDoc) {
  try {
    localStorage.setItem(CREDIT_KEY, JSON.stringify(doc))
  } catch {}
}

// ---------------------------------------------------------------------------
// Schedule math — dates are local ISO (YYYY-MM-DD), no timezone surprises.
// ---------------------------------------------------------------------------

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map((x) => Number(x) || 0)
  return { y, m: m || 1, d: d || 1 }
}

function toISO(y: number, m: number, d: number): string {
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  const mm = `${dt.getMonth() + 1}`.padStart(2, "0")
  const dd = `${dt.getDate()}`.padStart(2, "0")
  return `${dt.getFullYear()}-${mm}-${dd}`
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso)
  const dt = new Date(y, m - 1, d + days, 12, 0, 0)
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function addMonthsClamped(iso: string, months: number, anchorDay?: number): string {
  const { y, m, d } = parseISO(iso)
  const day = anchorDay ?? d
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return toISO(ny, nm, Math.min(day, daysInMonth(ny, nm)))
}

/** Step a date by the account frequency. */
function stepDate(iso: string, freq: CreditFrequency, anchorDay?: number): string {
  if (freq === "weekly") return addDays(iso, 7)
  if (freq === "biweekly") return addDays(iso, 14)
  return addMonthsClamped(iso, 1, anchorDay)
}

/**
 * First scheduled date for an account: the overdue date when the account
 * is late; otherwise the next occurrence of the due day (or the next
 * step from the last payment) on or after `from`.
 */
export function firstDueDate(acc: CreditAccount, fromISO: string): string | null {
  if (acc.overdueSince) return acc.overdueSince
  if (acc.dueDay && acc.frequency === "monthly") {
    const { y, m } = parseISO(fromISO)
    const thisMonth = toISO(y, m, Math.min(acc.dueDay, daysInMonth(y, m)))
    if (thisMonth >= fromISO) return thisMonth
    return addMonthsClamped(thisMonth, 1, acc.dueDay)
  }
  if (acc.lastPaymentDate) {
    let cur = acc.lastPaymentDate
    for (let i = 0; i < 60 && cur < fromISO; i++) cur = stepDate(cur, acc.frequency, acc.dueDay ?? undefined)
    return cur
  }
  if (acc.dueDay) return null
  return null
}

export type SchedPayment = {
  accountId: string
  accountName: string
  date: string
  amount: number
  /** plan = computed from a verified balance; expected = estimated from the last payment. */
  kind: "plan" | "expected"
  remainingAfter: number | null
  overdue: boolean
}

/** Installment amounts for a verified balance under the chosen plan. */
export function planAmounts(acc: CreditAccount): number[] {
  const bal = acc.balance
  if (bal == null || bal <= 0) return []
  if (acc.planMode === "full") return [r2(bal)]
  if (acc.planMode === "fixed") {
    const f = r2(acc.planFixed)
    if (f <= 0) return [r2(bal)]
    // Programa del acreedor: exactamente N pagos de `f` y se detiene,
    // aunque quede balance (ese resto se sigue debiendo tras el programa).
    const nProg = Math.floor(Number(acc.planPayments) || 0)
    if (nProg >= 1) return Array.from({ length: Math.min(nProg, 120) }, () => f)
    const out: number[] = []
    let rest = r2(bal)
    while (rest > 0.004 && out.length < 120) {
      const amt = r2(Math.min(f, rest))
      out.push(amt)
      rest = r2(rest - amt)
    }
    return out
  }
  const n = Math.max(1, Math.min(60, Math.floor(acc.planMonths) || 1))
  const base = r2(bal / n)
  const out: number[] = []
  let rest = r2(bal)
  for (let i = 0; i < n; i++) {
    const amt = i === n - 1 ? r2(rest) : base
    out.push(amt)
    rest = r2(rest - amt)
  }
  return out
}

export const YEAR_END = "2026-12-31"

/**
 * Payments for one account from `todayISO`: plan payments until the
 * balance is paid off (verified balance), or expected recurring payments
 * through the end of 2026 (unverified balance, estimated from the last
 * bank payment — clearly marked kind="expected").
 */
export function buildAccountSchedule(acc: CreditAccount, todayISO: string): SchedPayment[] {
  if (acc.closed) return []
  const out: SchedPayment[] = []
  const first = firstDueDate(acc, todayISO)
  if (!first) return []

  const amounts = planAmounts(acc)
  if (amounts.length > 0 && acc.balance != null) {
    let rest = r2(acc.balance)
    let date = first
    for (let i = 0; i < amounts.length; i++) {
      rest = r2(rest - amounts[i])
      out.push({
        accountId: acc.id,
        accountName: acc.name,
        date,
        amount: amounts[i],
        kind: "plan",
        remainingAfter: Math.max(0, rest),
        overdue: date < todayISO,
      })
      date = stepDate(date, acc.frequency, acc.dueDay ?? undefined)
    }
    return out
  }

  // Unverified balance: estimate the recurring payment from the last one.
  const est = acc.lastPaymentAmount
  if (est == null || est <= 0) return []
  let date = first
  for (let i = 0; i < 40 && date <= YEAR_END; i++) {
    out.push({
      accountId: acc.id,
      accountName: acc.name,
      date,
      amount: est,
      kind: "expected",
      remainingAfter: null,
      overdue: date < todayISO,
    })
    date = stepDate(date, acc.frequency, acc.dueDay ?? undefined)
  }
  return out
}

export function buildFullSchedule(accounts: CreditAccount[], todayISO: string): SchedPayment[] {
  const all = accounts.flatMap((a) => buildAccountSchedule(a, todayISO))
  return all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.accountName.localeCompare(b.accountName)))
}

/** Days between an ISO date and today (positive = date is in the past). */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISO(fromISO)
  const b = parseISO(toISO)
  const da = new Date(a.y, a.m - 1, a.d, 12).getTime()
  const db = new Date(b.y, b.m - 1, b.d, 12).getTime()
  return Math.round((db - da) / 86400000)
}
