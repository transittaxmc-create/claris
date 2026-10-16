// Registers store — real bank snapshot + manual accounts only.
// Main operating account: CitiBank ending in 93 (projections base).

export type AccountKind = "bank" | "card"

export interface RegisterAccount {
  id: string
  name: string
  institution: string | null
  kind: AccountKind
  limit: number | null
  dueDay: number | null
  isMain: boolean
  source: "snapshot" | "manual"
  manualBalance: number | null
}

interface SnapshotAccount {
  name?: string
  current_balance?: number
  institution?: string | null
}

const KEY = "claris_registers_v1"

interface StoredState {
  manual: RegisterAccount[]
  dueDays: Record<string, number>
  mainId: string | null
  hidden: string[]
}

function emptyState(): StoredState {
  return { manual: [], dueDays: {}, mainId: null, hidden: [] }
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const p = JSON.parse(raw)
    return {
      manual: Array.isArray(p.manual) ? p.manual : [],
      dueDays: p.dueDays && typeof p.dueDays === "object" ? p.dueDays : {},
      mainId: typeof p.mainId === "string" ? p.mainId : null,
      hidden: Array.isArray(p.hidden) ? p.hidden : [],
    }
  } catch {
    return emptyState()
  }
}

function saveState(s: StoredState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {}
}

export function accountIdFor(name: string): string {
  return `snap:${String(name || "cuenta")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`
}

/** Last 4 digits from account name if present (e.g. "...6393" → "6393"). */
export function last4Of(name: string): string | null {
  const m = String(name || "").match(/(\d{4})\s*$/)
  return m ? m[1] : null
}

/** Short label for UI: bank keyword + last4. */
export function accountDisplayName(name: string): { title: string; subtitle: string | null } {
  const raw = String(name || "").trim()
  const last4 = last4Of(raw)
  let bank = "Account"
  if (/citi/i.test(raw)) bank = "CitiBank"
  else if (/access/i.test(raw)) bank = "Access"
  else if (/paypal/i.test(raw)) bank = "PayPal"
  else if (/chase/i.test(raw)) bank = "Chase"
  else if (/amex|american express/i.test(raw)) bank = "Amex"
  else if (/capital one/i.test(raw)) bank = "Capital One"
  else if (/venmo/i.test(raw)) bank = "Venmo"
  else if (/square/i.test(raw)) bank = "Square"
  else {
    const w = raw.replace(/\.{2,}/g, " ").split(/\s+/)[0]
    if (w && w.length > 1) bank = w.slice(0, 14)
  }
  if (last4) return { title: `${bank} ···${last4}`, subtitle: raw }
  return { title: bank === "Account" ? raw.slice(0, 18) || "Account" : bank, subtitle: raw !== bank ? raw : null }
}

function looksLikeCard(name: string, institution: string | null): boolean {
  const t = `${name} ${institution || ""}`.toLowerCase()
  return /card|tarjeta|amex|visa|mastercard|discover|credit|crédito/.test(t)
}

function ensureSeeded(_st: StoredState) {
  /* no auto-seed empty accounts */
}

export function buildRegisters(snapshotAccounts: SnapshotAccount[]): RegisterAccount[] {
  const st = loadState()
  ensureSeeded(st)
  const regs: RegisterAccount[] = []

  const balById = new Map<string, number>()
  for (const a of snapshotAccounts || []) {
    const nm = String(a?.name || "").trim()
    if (!nm) continue
    const v = Number(a?.current_balance)
    balById.set(accountIdFor(nm), Number.isFinite(v) ? v : 0)
  }

  for (const a of snapshotAccounts || []) {
    const name = String(a?.name || "").trim()
    if (!name) continue
    const id = accountIdFor(name)
    if (st.hidden.includes(id)) continue
    regs.push({
      id,
      name,
      institution: a?.institution ?? null,
      kind: looksLikeCard(name, a?.institution ?? null) ? "card" : "bank",
      limit: null,
      dueDay: st.dueDays[id] ?? null,
      isMain: false,
      source: "snapshot",
      manualBalance: null,
    })
  }

  for (const m of st.manual) {
    regs.push({
      ...m,
      dueDay: st.dueDays[m.id] ?? m.dueDay ?? null,
      isMain: false,
    })
  }

  let mainId = st.mainId
  // Prefer CitiBank ending in 93 (e.g. ...6393) as the operating / projection account
  const citi93 =
    regs.find((r) => r.kind === "bank" && /citi/i.test(r.name) && /93\s*$/.test(r.name)) ||
    regs.find((r) => r.kind === "bank" && /citi/i.test(r.name) && /6393/.test(r.name))
  const citiAny =
    regs.find((r) => r.kind === "bank" && /^citibank\b/i.test(r.name)) ||
    regs.find((r) => r.kind === "bank" && /citi/i.test(r.name))
  const preferredMain = citi93 || citiAny

  if (!mainId || !regs.some((r) => r.id === mainId)) {
    mainId = (preferredMain || regs.find((r) => r.kind === "bank") || regs[0])?.id ?? null
    if (mainId) {
      st.mainId = mainId
      saveState(st)
    }
  } else if (preferredMain && mainId !== preferredMain.id) {
    const current = regs.find((r) => r.id === mainId)
    if (!current || !/citi/i.test(current.name)) {
      mainId = preferredMain.id
      st.mainId = mainId
      saveState(st)
    }
  }
  for (const r of regs) r.isMain = r.id === mainId

  // Only real money: main + non-zero. No $0 filler cards.
  return regs.filter((r) => {
    if (r.isMain) return true
    if (r.source === "manual") {
      return Math.abs(Number(r.manualBalance) || 0) >= 0.005
    }
    return Math.abs(balById.get(r.id) ?? 0) >= 0.005
  })
}

export function accountBalance(
  reg: RegisterAccount,
  snapshotAccounts: SnapshotAccount[],
): number | null {
  if (reg.source === "manual") return reg.manualBalance
  const found = (snapshotAccounts || []).find((a) => accountIdFor(String(a?.name || "")) === reg.id)
  const v = Number(found?.current_balance)
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null
}

export function addManualAccount(input: {
  name: string
  kind: AccountKind
  limit?: number | null
  dueDay?: number | null
  balance?: number | null
}): RegisterAccount {
  const st = loadState()
  const reg: RegisterAccount = {
    id: `manual:${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m${Date.now()}`}`,
    name: input.name.trim(),
    institution: null,
    kind: input.kind,
    limit: input.kind === "card" ? Number(input.limit) || null : null,
    dueDay: input.dueDay ?? null,
    isMain: false,
    source: "manual",
    manualBalance: Number.isFinite(Number(input.balance)) ? Math.round(Number(input.balance) * 100) / 100 : 0,
  }
  st.manual.push(reg)
  if (reg.dueDay) st.dueDays[reg.id] = reg.dueDay
  saveState(st)
  return reg
}

export function deleteManualAccount(id: string) {
  const st = loadState()
  st.manual = st.manual.filter((m) => m.id !== id)
  delete st.dueDays[id]
  if (st.mainId === id) st.mainId = null
  saveState(st)
}

export function setManualBalance(id: string, balance: number) {
  const st = loadState()
  const m = st.manual.find((x) => x.id === id)
  if (m) {
    m.manualBalance = Math.round((Number(balance) || 0) * 100) / 100
    saveState(st)
  }
}

export function setDueDay(id: string, dueDay: number | null) {
  const st = loadState()
  if (dueDay && dueDay >= 1 && dueDay <= 31) st.dueDays[id] = dueDay
  else delete st.dueDays[id]
  const m = st.manual.find((x) => x.id === id)
  if (m) m.dueDay = st.dueDays[id] ?? null
  saveState(st)
}

export function setMainAccount(id: string) {
  const st = loadState()
  st.mainId = id
  saveState(st)
}

export function hideSnapshotAccount(id: string) {
  const st = loadState()
  if (!st.hidden.includes(id)) st.hidden.push(id)
  saveState(st)
}

export interface DueItem {
  accountId: string
  accountName: string
  kind: AccountKind
  dueDay: number
  nextDate: string
  daysUntil: number
}

export function upcomingDues(registers: RegisterAccount[], todayIso?: string): DueItem[] {
  const today = todayIso || new Date().toISOString().slice(0, 10)
  const [ty, tm, td] = today.split("-").map(Number)
  const out: DueItem[] = []
  for (const r of registers) {
    if (!r.dueDay) continue
    const dd = Math.min(Math.max(r.dueDay, 1), 28)
    let y = ty
    let m = tm
    if (td >= dd) {
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
    const nextDate = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
    const daysUntil = Math.round(
      (new Date(`${nextDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000,
    )
    out.push({ accountId: r.id, accountName: r.name, kind: r.kind, dueDay: dd, nextDate, daysUntil })
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil)
}
