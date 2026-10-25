// PLAN B (Miguel, 2026-10-25):
//
// Como los bancos: hay un balance REAL (Available Now del screenshot) y un
// balance de Plaid que llega con delay. Mientras no cuadren:
//   - "Balance actual del banco" = siempre el de la FOTO (shotBalance).
//   - Plaid se muestra aparte como pendiente de auditoría.
//   - Los movimientos del screenshot son provisionales hasta que Plaid los
//     traiga; entonces se matchean y desaparecen (sin duplicar).
// Cuando diff = $0.00 al centavo, la nota de pantalla se oculta y el
// episodio queda en historial interno (nunca se borra del todo).

export interface ShotTx {
  id: string
  /** RegisterAccount.id de la cuenta dueña del screenshot. */
  accountId: string
  date: string
  detail: string
  /** Con signo, estilo app: + entra, − sale. */
  amount: number
  createdAt: string
}

export const SHOT_TXS_KEY = "claris_screenshot_txs_v1"
export const SHOT_AUDITS_KEY = "claris_shot_audits_v1"
export const SHOT_AUDIT_HISTORY_KEY = "claris_shot_audit_history_v1"

/**
 * Auditoría activa de una cuenta. Si |diff| > $0.01 se muestra en pantalla.
 * Cuando cuadra, se mueve a historial y desaparece de la UI.
 */
export interface ShotAudit {
  accountId: string
  date: string
  /** Balance de la FOTO = real del banco (Available Now). SOURCE OF TRUTH. */
  shotBalance: number
  /** Balance de Plaid al momento del escaneo / último sync. */
  plaidBalance: number
  /** Suma de provisionales vigentes al guardar. */
  shotsTotal: number
  /** shotBalance − (plaidBalance + shotsTotal). $0 = cuadra al centavo. */
  diff: number
  /** Nota legible para el cuadrito de auditoría. */
  note?: string
  /** true mientras |diff| > 0.01 — se muestra en pantalla. */
  open?: boolean
  resolvedAt?: string
}

export interface ShotAuditHistoryEntry extends ShotAudit {
  closedAt: string
  closeReason: "matched" | "manual" | "rescan"
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export function loadShotAudits(): Record<string, ShotAudit> {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOT_AUDITS_KEY) || "{}")
    return raw && typeof raw === "object" ? (raw as Record<string, ShotAudit>) : {}
  } catch {
    return {}
  }
}

function loadHistory(): ShotAuditHistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOT_AUDIT_HISTORY_KEY) || "[]")
    return Array.isArray(raw) ? (raw as ShotAuditHistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(list: ShotAuditHistoryEntry[]) {
  try {
    // Cap at 200 entries
    const trimmed = list.slice(-200)
    localStorage.setItem(SHOT_AUDIT_HISTORY_KEY, JSON.stringify(trimmed))
  } catch {}
}

export function loadShotAuditHistory(accountId?: string): ShotAuditHistoryEntry[] {
  const all = loadHistory()
  if (!accountId) return all
  return all.filter((h) => h.accountId === accountId)
}

/** Guarda (o actualiza) la auditoría activa. open = |diff| > 0.01. */
export function saveShotAudit(audit: ShotAudit): Record<string, ShotAudit> {
  const diff = r2(audit.diff)
  const open = Math.abs(diff) > 0.01
  const note =
    audit.note ||
    (open
      ? `Bank actual $${audit.shotBalance.toFixed(2)} · Plaid $${audit.plaidBalance.toFixed(2)} · Diff $${diff.toFixed(2)} (pending Plaid / screenshots).`
      : `Cuadrado al centavo: banco $${audit.shotBalance.toFixed(2)}.`) 
  const full: ShotAudit = {
    ...audit,
    diff,
    open,
    note,
    resolvedAt: open ? undefined : new Date().toISOString(),
  }
  const all = loadShotAudits()

  // Si antes estaba abierta y ahora cuadra → historial y quitar de activos visibles.
  const prev = all[audit.accountId]
  if (prev && prev.open !== false && !open) {
    const hist = loadHistory()
    hist.push({
      ...prev,
      ...full,
      open: false,
      closedAt: new Date().toISOString(),
      closeReason: "matched",
    })
    saveHistory(hist)
  }

  if (open) {
    all[audit.accountId] = full
  } else {
    // Cuadrado: no ocupa espacio en pantalla (no queda en activos).
    delete all[audit.accountId]
  }
  try {
    localStorage.setItem(SHOT_AUDITS_KEY, JSON.stringify(all))
  } catch {}
  return all
}

/**
 * Balance que debe mostrar "Balance actual del banco":
 * 1) Si hay auditoría activa o reciente con shotBalance → ese (la foto).
 * 2) Si no, null (el UI usa Plaid).
 */
export function bankActualBalance(accountId: string): number | null {
  const active = loadShotAudits()[accountId]
  if (active && Number.isFinite(active.shotBalance)) return r2(active.shotBalance)
  // Último del historial (por si ya cuadró pero queremos el último real conocido)
  const hist = loadShotAuditHistory(accountId)
  if (hist.length > 0) {
    const last = hist[hist.length - 1]
    if (Number.isFinite(last.shotBalance)) return r2(last.shotBalance)
  }
  return null
}

/** Nota visible solo si la auditoría está abierta (no cuadra). */
export function openAuditNote(accountId: string): ShotAudit | null {
  const a = loadShotAudits()[accountId]
  if (!a || a.open === false) return null
  if (Math.abs(r2(a.diff)) <= 0.01) return null
  return a
}

export function clearShotAudit(
  accountId: string,
  reason: "matched" | "manual" | "rescan" = "manual",
): Record<string, ShotAudit> {
  const all = loadShotAudits()
  const prev = all[accountId]
  if (prev) {
    const hist = loadHistory()
    hist.push({
      ...prev,
      open: false,
      closedAt: new Date().toISOString(),
      closeReason: reason,
    })
    saveHistory(hist)
  }
  delete all[accountId]
  try {
    localStorage.setItem(SHOT_AUDITS_KEY, JSON.stringify(all))
  } catch {}
  return all
}

export function loadShotTxs(): ShotTx[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOT_TXS_KEY) || "[]")
    return Array.isArray(raw) ? (raw as ShotTx[]) : []
  } catch {
    return []
  }
}

export function saveShotTxs(list: ShotTx[]): void {
  try {
    localStorage.setItem(SHOT_TXS_KEY, JSON.stringify(list))
  } catch {}
}

function daysDiff(a: string, b: string): number {
  const da = new Date(`${String(a).slice(0, 10)}T12:00:00`).getTime()
  const db = new Date(`${String(b).slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999
  return Math.abs(Math.round((da - db) / 86400000))
}

export interface BankTxLike {
  date: string
  amount: number
}

function takeMatch(
  pool: { date: string; amount: number; used: boolean }[],
  date: string,
  amount: number,
): boolean {
  let best = -1
  let bestDiff = 99
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]
    if (p.used) continue
    if (Math.abs(r2(p.amount) - r2(amount)) > 0.011) continue
    const d = daysDiff(p.date, date)
    if (d <= 2 && d < bestDiff) {
      best = i
      bestDiff = d
    }
  }
  if (best >= 0) {
    pool[best].used = true
    return true
  }
  return false
}

/**
 * Quita provisionales que ya bajaron por Plaid. Sin duplicados.
 */
export function reconcileShots(
  shots: ShotTx[],
  accountId: string,
  bankTxs: BankTxLike[],
): { kept: ShotTx[]; replaced: number } {
  const pool = (bankTxs || []).map((t) => ({
    date: String(t.date).slice(0, 10),
    amount: Number(t.amount) || 0,
    used: false,
  }))
  let replaced = 0
  const kept = (shots || []).filter((s) => {
    if (s.accountId !== accountId) return true
    if (takeMatch(pool, s.date, s.amount)) {
      replaced++
      return false
    }
    return true
  })
  return { kept, replaced }
}

/**
 * Tras un SYNC de Plaid: recalcula diff con el plaidBalance fresco.
 * Si ya cuadra, cierra la nota (historial) y mantiene shotBalance como
 * último real conocido en history.
 */
export function refreshAuditAfterPlaid(
  accountId: string,
  plaidBalance: number,
  shotsForAccount: ShotTx[],
): ShotAudit | null {
  const active = loadShotAudits()[accountId]
  if (!active) return null
  const shotsTotal = r2(
    shotsForAccount.filter((s) => s.accountId === accountId).reduce((s, t) => s + (Number(t.amount) || 0), 0),
  )
  const diff = r2(active.shotBalance - (r2(plaidBalance) + shotsTotal))
  return saveShotAudit({
    ...active,
    plaidBalance: r2(plaidBalance),
    shotsTotal,
    diff,
    date: new Date().toISOString().slice(0, 10),
  })[accountId] || null
}

export function filterExtracted(
  extracted: { date: string; description: string; amount: number; pending?: boolean }[],
  bankTxs: BankTxLike[],
  existingShots: ShotTx[],
): { fresh: typeof extracted; yaEnPlaid: number; yaEscaneados: number } {
  const poolBank = (bankTxs || []).map((t) => ({
    date: String(t.date).slice(0, 10),
    amount: Number(t.amount) || 0,
    used: false,
  }))
  const poolShots = (existingShots || []).map((s) => ({
    date: s.date,
    amount: s.amount,
    used: false,
  }))
  const fresh: typeof extracted = []
  let yaEnPlaid = 0
  let yaEscaneados = 0
  for (const t of extracted || []) {
    if (takeMatch(poolBank, t.date, t.amount)) {
      yaEnPlaid++
      continue
    }
    if (takeMatch(poolShots, t.date, t.amount)) {
      yaEscaneados++
      continue
    }
    fresh.push(t)
  }
  return { fresh, yaEnPlaid, yaEscaneados }
}
