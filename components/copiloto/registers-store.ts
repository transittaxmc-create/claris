// ============================================================================
// REGISTERS POR CUENTA — un register por cada banco/tarjeta.
// Cada cuenta (banco o tarjeta) tiene su propio libro con su propio balance.
// Los registers se generan automáticamente desde el feed del banco; las
// cuentas manuales (ej. tarjetas) se agregan en la portada y nacen solas.
// ============================================================================

export type AccountKind = "bank" | "card"

export interface RegisterAccount {
  /** id estable derivado del nombre (snapshot) o uuid (manual) */
  id: string
  name: string
  institution: string | null
  kind: AccountKind
  /** Solo tarjetas: límite de crédito */
  limit: number | null
  /** Día del mes de pago (1-31). Solo informativo para vencimientos. */
  dueDay: number | null
  /** La cuenta principal: ahí corren las proyecciones y los pagos */
  isMain: boolean
  source: "snapshot" | "manual"
  /** Solo cuentas manuales: balance/deuda llevado a mano */
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

/** Heurística: ¿parece tarjeta de crédito? */
function looksLikeCard(name: string, institution: string | null): boolean {
  const t = `${name} ${institution || ""}`.toLowerCase()
  return /card|tarjeta|amex|visa|mastercard|discover|credit|crédito/.test(t)
}

/**
 * Construye la lista de registers: snapshot (banco real) + manuales.
 * Llama esto con las cuentas del feed; los manuales persisten en localStorage.
 */
export function buildRegisters(snapshotAccounts: SnapshotAccount[]): RegisterAccount[] {
  const st = loadState()
  const regs: RegisterAccount[] = []

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

  // Cuenta principal: la guardada, o la primera que parezca CitiBank, o la primera.
  let mainId = st.mainId
  if (!mainId || !regs.some((r) => r.id === mainId)) {
    const citi = regs.find((r) => r.kind === "bank" && /citi/i.test(r.name))
    mainId = (citi || regs.find((r) => r.kind === "bank") || regs[0])?.id ?? null
  }
  for (const r of regs) r.isMain = r.id === mainId
  return regs
}

/** Balance real de la cuenta según el snapshot (o manual si es manual). */
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
    limit: input.kind === "card" ? (Number(input.limit) || null) : null,
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
  /** Fecha ISO del próximo vencimiento */
  nextDate: string
  daysUntil: number
}

/** Próximos vencimientos ordenados por cercanía. */
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
