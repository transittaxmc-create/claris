// Registers store — snapshot + manual. Main = máscara ···6393 (Miguel).

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
  /** Últimos 4 de la cuenta cuando el feed los trae (para la tarjeta). */
  mask?: string | null
  /** Cuentas manuales fijas (Venmo, Square Checking): siempre visibles. */
  pinned?: boolean
}

interface SnapshotAccount {
  name?: string
  current_balance?: number
  institution?: string | null
  /** Últimos 4 que el snapshot adjunta por cuenta (nombre + números). */
  mask?: string | null
  /** Tipo Plaid cuando el feed lo trae ("depository" | "credit" | ...). */
  type?: string | null
}

const KEY = "claris_registers_v1"

interface StoredState {
  manual: RegisterAccount[]
  dueDays: Record<string, number>
  mainId: string | null
  hidden: string[]
  /** Autocorrección única de la ★ ya aplicada. */
  starHealed?: boolean
}

function emptyState(): StoredState {
  return { manual: [], dueDays: {}, mainId: null, hidden: [] }
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const p = JSON.parse(raw)
    const manual = Array.isArray(p.manual) ? p.manual : []
    // Limpieza única: sin cuentas manuales duplicadas por nombre (conservar la primera).
    const seen = new Set<string>()
    const deduped = manual.filter((m: any) => {
      const n = normName(m?.name)
      if (!n || seen.has(n)) return false
      seen.add(n)
      return true
    })
    const st: StoredState = {
      manual: deduped,
      dueDays: p.dueDays && typeof p.dueDays === "object" ? p.dueDays : {},
      mainId: typeof p.mainId === "string" ? p.mainId : null,
      hidden: Array.isArray(p.hidden) ? p.hidden : [],
      starHealed: p.starHealed === true,
    }
    if (deduped.length !== manual.length) saveState(st)
    return st
  } catch {
    return emptyState()
  }
}

function saveState(s: StoredState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {}
}

// Accounts manuales fijas de Miguel: siempre existen y siempre visibles.
const SEED_MANUAL: Array<{ id: string; name: string }> = [
  { id: "manual:venmo", name: "Venmo" },
  { id: "manual:square-checking", name: "Square Checking" },
  { id: "manual:uber-pro-card", name: "Uber Pro Card" },
  { id: "manual:lyft", name: "Lyft" },
  // Navy Federal y Varo: desconectados de Plaid desde 2026-10-20, pero
  // Miguel pidió register para TODOS sus bancos (2026-10-24). Existen como
  // cuentas fijas con su register (vacío hasta que se reconecten); si Plaid
  // los vuelve a traer, buildRegisters los deduplica contra el snapshot.
  { id: "manual:navy-federal", name: "Navy Federal" },
  { id: "manual:varo", name: "Varo" },
  // Branch: Miguel creyó haberla vinculado a Plaid, pero NO está entre
  // las instituciones conectadas (verificado 2026-10-24: solo Citibank,
  // PayPal, Square y Uber). Existe como cuenta fija con su register y
  // balance editable (Aventus Ride paga ahí); si se vincula de verdad,
  // buildRegisters la deduplica contra el snapshot.
  { id: "manual:branch", name: "Branch" },
]

function normName(n: string) {
  return String(n || "").trim().toLowerCase()
}

function ensureSeeded(st: StoredState) {
  let changed = false
  for (const s of SEED_MANUAL) {
    const dup = st.manual.find((m) => m.id === s.id || normName(m.name) === normName(s.name))
    if (!dup) {
      st.manual.push({
        id: s.id,
        name: s.name,
        institution: null,
        kind: "bank",
        limit: null,
        dueDay: null,
        isMain: false,
        source: "manual",
        manualBalance: 0,
        pinned: true,
      })
      changed = true
    } else if (!dup.pinned) {
      dup.pinned = true
      changed = true
    }
  }
  if (changed) saveState(st)
}

export function accountIdFor(name: string): string {
  return `snap:${String(name || "cuenta")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`
}

export function last4Of(name: string): string | null {
  const m = String(name || "").match(/(\d{4})\s*$/)
  return m ? m[1] : null
}

/**
 * "Otros fondos" (Miguel, 2026-10-25; ampliado 2026-10-26): para
 * PROYECCIÓN cuentan Citibank (la principal ★, Access ·6393 — es la
 * base y no se lista), PayPal, Uber, Lyft y Branch. Branch y Lyft no
 * se pueden conectar: son editables a mano, y el balance que Miguel
 * ponga entra a la proyección con su switch; si no pone nada ($0),
 * no cuenta nada — no hay nada pendiente. Todas las demás cuentas
 * son individuales, de control, y NUNCA entran a la proyección.
 */
export function esFondoPermitido(r: { name?: string | null }): boolean {
  return /paypal|uber|lyft|branch/i.test(String(r?.name || ""))
}

export function accountDisplayName(name: string): { title: string; subtitle: string | null } {
  const raw = String(name || "").trim()
  const last4 = last4Of(raw)
  let bank = "Account"
  if (/citi/i.test(raw)) bank = "CitiBank"
  else if (/navy/i.test(raw)) bank = "Navy Federal"
  else if (/access/i.test(raw)) bank = "Access"
  else if (/paypal/i.test(raw)) bank = "PayPal"
  else if (/checking/i.test(raw)) bank = "Checking"
  else if (/chase/i.test(raw)) bank = "Chase"
  else if (/amex|american express/i.test(raw)) bank = "Amex"
  else {
    const w = raw.replace(/[…\.]/g, " ").split(/\s+/)[0]
    if (w && w.length > 1) bank = w.slice(0, 14)
  }
  if (last4) return { title: `${bank} ···${last4}`, subtitle: raw }
  return { title: bank === "Account" ? raw.slice(0, 18) || "Account" : bank, subtitle: raw !== bank ? raw : null }
}

function looksLikeCard(name: string, institution: string | null, type?: string | null): boolean {
  const pt = String(type || "").toLowerCase()
  if (pt) {
    if (/credit/.test(pt)) return true
    return false // depository u otro: es cuenta de banco
  }
  // Sin tipo: heurística por nombre. "credit union" es un banco, no una card.
  const t = `${name} ${institution || ""}`.toLowerCase().replace(/credit\s*union/g, " ")
  // Palabras de cuenta bancaria siempre ganan.
  if (/checking|savings|depository/.test(t)) return false
  return /credit|card|card|amex|visa|mastercard|discover|crédito/.test(t)
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
    // PayPal y Uber Pro NUNCA se ocultan: son las cuentas #2 y #3 del
    // orden fijo de Miguel (Citibank, PayPal, Uber, Lyft) y Uber Pro se
    // usa todos los días. Quedaron en la lista de ocultas del teléfono
    // en la limpieza de duplicados de octubre y desaparecieron de MONEY
    // (diagnóstico 2026-10-24).
    if (st.hidden.includes(id) && !/paypal|uber/i.test(name)) continue
    regs.push({
      id,
      name,
      institution: a?.institution ?? null,
      mask: a?.mask ?? null,
      kind: looksLikeCard(name, a?.institution ?? null, a?.type ?? null) ? "card" : "bank",
      limit: null,
      dueDay: st.dueDays[id] ?? null,
      isMain: false,
      source: "snapshot",
      manualBalance: null,
    })
  }
  const snapshotNames = regs.map((r) => normName(r.name))
  for (const m of st.manual) {
    // No duplicar: si el snapshot ya trae la cuenta (ej. Uber Pro Card por Plaid
    // como "Uber Pro Card …9298" o "Checking · 9298"), la manual seed se omite.
    const mn = normName(m.name)
    const isUberSeed = m.id === "manual:uber-pro-card"
    if (snapshotNames.some((sn) => {
      if (sn === mn || sn.includes(mn) || mn.includes(sn)) return true
      // Uber Pro Card: Plaid la trae como "Checking · 9298" (mismo mask)
      if (isUberSeed && /9298/.test(sn)) return true
      return false
    })) continue
    regs.push({ ...m, dueDay: st.dueDays[m.id] ?? m.dueDay ?? null, isMain: false })
  }

  // Principal: CitiBank …6393 (Miguel). Múltiples criterios por si el nombre varía.
  // Si hay varios "Access Account" (…6393 y …3830), se queda con el de mayor balance.
  const accessAccounts = regs.filter((r) => /access account/i.test(String(r.name)))
  const topAccess = accessAccounts.sort((a, b) =>
    Math.abs(balById.get(b.id) ?? 0) - Math.abs(balById.get(a.id) ?? 0)
  )[0]
  const exactCiti = regs.find((r) => String(r.name).includes("6393"))
    || topAccess
    || regs.find((r) => /citi/i.test(String(r.name)))
  let mainId = st.mainId
  // Las cuentas semilla (Venmo, Square Checking, Lyft, Branch…) NUNCA son
  // la Principal: la ★ es de Citibank ·6393. Si un mainId viejo apunta a
  // una semilla, es el residuo del fallback de abajo (ver comentario) —
  // se limpia, no se respeta (Miguel, 2026-10-29: "en algún lado todavía
  // se guarda Venmo como primary… quita eso").
  if (mainId && SEED_MANUAL.some((s) => s.id === mainId)) {
    mainId = null
    st.mainId = null
    saveState(st)
  }
  // CitiBank 6393 es siempre la Principal (Miguel). Se corrige en cada carga:
  // si existe en los datos, la ★ va ahí, sin importar lo que haya guardado.
  if (exactCiti) {
    if (mainId !== exactCiti.id) {
      mainId = exactCiti.id
      st.mainId = mainId
      saveState(st)
    }
  } else if ((snapshotAccounts || []).length > 0 && (!mainId || !regs.some((r) => r.id === mainId))) {
    // Fallback SOLO con datos reales del banco ya cargados. Antes corría
    // también con el snapshot VACÍO (la app recién abierta, antes de que
    // baje el snapshot): los únicos registers eran las semillas manuales
    // y el primero de tipo "bank" es Venmo — quedaba GUARDADO como
    // mainId, Venmo salía PRIMARY al abrir MONEY, y al llegar el snapshot
    // se corregía solo a ·6393. Ese flash es el que veía Miguel
    // (2026-10-29). Sin snapshot: no se asigna ni se guarda ninguna ★;
    // la guardada (·6393) se aplica en cuanto su cuenta aparece.
    mainId = (regs.find((r) => r.kind === "bank" && r.source === "snapshot") || regs.find((r) => r.kind === "bank") || regs[0])?.id ?? null
    if (mainId) {
      st.mainId = mainId
      saveState(st)
    }
  }
  for (const r of regs) r.isMain = r.id === mainId

  return regs.filter((r) => {
    if (r.isMain) return true
    if (r.pinned) return true
    if (r.source === "manual") return Math.abs(Number(r.manualBalance) || 0) >= 0.005
    // Cuentas del banco: se muestran SIEMPRE que el feed las traiga, así
    // tengan $0 — la regla anterior (ocultar si el balance es < $0.005)
    // hizo desaparecer a PayPal, Uber Pro y Square Checking en cuanto
    // llegaron a $0 (2026-10-24). Las "fantasma" sin balance ni datos ya
    // las filtra la ruta del snapshot.
    return true
  })
}

export function accountBalance(
  reg: RegisterAccount,
  snapshotAccounts: SnapshotAccount[],
): number | null {
  if (reg.source === "manual") return reg.manualBalance
  // 1. Match exacto por ID (rápido, para la mayoría de cuentas)
  let found = (snapshotAccounts || []).find((a) => accountIdFor(String(a?.name || "")) === reg.id)
  // 2. Fallback por últimos 4 dígitos (Plaid a veces cambia el nombre, ej: "Access Account …6393")
  if (!found) {
    const want4 = last4Of(reg.name)
    if (want4) {
      found = (snapshotAccounts || []).find((a) => last4Of(String(a?.name || "")) === want4)
    }
  }
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
