// PLAN B (Miguel, 2026-10-25): movimientos PROVISIONALES leídos de un
// screenshot del banco. Plaid no es en vivo (el banco le entrega por
// tandas), así que mientras el real baja, el screenshot mantiene el
// register y el balance al día. En cuanto Plaid trae el movimiento real,
// el provisional se empareja y DESAPARECE — nunca hay duplicados:
//
// - Al escanear: lo que ya está en Plaid (o ya se escaneó) no entra.
// - Al abrir el register / llegar un SYNC: cada provisional que ya tenga
//   su gemelo real (misma cuenta, monto exacto al centavo, fecha ±2 días)
//   se borra solo y queda únicamente el de Plaid.
// - El balance real de Plaid nunca se toca: la vista suma los
//   provisionales APARTE ("Con screenshots: …").

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
/** Avisa a las pantallas que los provisionales cambiaron (recalcular balances). */
export const SHOTS_CHANGED_EVENT = "claris:shots-changed"

/**
 * Auditoría del último screenshot de una cuenta (protocolo de Miguel,
 * 2026-10-25): el balance de la FOTO es el real del banco. Se guarda junto
 * al balance de la app con provisionales del mismo momento y la
 * DIFERENCIA entre ambos. Si la diferencia no es $0.00, queda escrita en
 * el register como nota visible hasta que cuadre al centavo — esa
 * diferencia es exactamente lo que hay que buscar y explicar.
 */
export interface ShotAudit {
  accountId: string
  date: string
  /** Balance que dice el screenshot (el real del banco). */
  shotBalance: number
  /** Balance de Plaid al momento del escaneo. */
  plaidBalance: number
  /** Suma de provisionales vigentes al guardar el escaneo. */
  shotsTotal: number
  /** shotBalance − (plaidBalance + shotsTotal). $0 = cuadra al centavo. */
  diff: number
}

export function loadShotAudits(): Record<string, ShotAudit> {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOT_AUDITS_KEY) || "{}")
    const all = raw && typeof raw === "object" ? (raw as Record<string, ShotAudit>) : {}
    // La nota del bucket combinado NO migra: era de las dos Access juntas
    // y su "diferencia" de −$0.59 quedó RESUELTA y probada al centavo el
    // 2026-10-25 (era el $0.59 de la ·3830). Si migrara, reaparecería como
    // diferencia fantasma en la cuenta individual ·6393. Se retira; el
    // próximo escaneo crea su nota correcta.
    if (all[LEGACY_ACCESS_ID]) {
      delete all[LEGACY_ACCESS_ID]
      try {
        localStorage.setItem(SHOT_AUDITS_KEY, JSON.stringify(all))
      } catch {}
    }
    return all
  } catch {
    return {}
  }
}

export function saveShotAudit(audit: ShotAudit): Record<string, ShotAudit> {
  const all = loadShotAudits()
  all[audit.accountId] = audit
  try {
    localStorage.setItem(SHOT_AUDITS_KEY, JSON.stringify(all))
  } catch {}
  return all
}

export function clearShotAudit(accountId: string): Record<string, ShotAudit> {
  const all = loadShotAudits()
  delete all[accountId]
  try {
    localStorage.setItem(SHOT_AUDITS_KEY, JSON.stringify(all))
  } catch {}
  return all
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// Migración (2026-10-25): cuando las dos Access se separaron, los
// escaneados guardados bajo el id viejo del bucket ("snap:access-account")
// pasaron a la ·6393 — TODOS eran compras de su tarjeta ····7693, que es
// la cuenta ·6393. Se re-etiquetan una sola vez, en silencio.
const LEGACY_ACCESS_ID = "snap:access-account"
const ACCESS_6393_ID = "snap:access-account-6393"

export function loadShotTxs(): ShotTx[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOT_TXS_KEY) || "[]")
    const list = Array.isArray(raw) ? (raw as ShotTx[]) : []
    if (list.some((s) => s.accountId === LEGACY_ACCESS_ID)) {
      const fixed = list.map((s) => (s.accountId === LEGACY_ACCESS_ID ? { ...s, accountId: ACCESS_6393_ID } : s))
      try {
        localStorage.setItem(SHOT_TXS_KEY, JSON.stringify(fixed))
      } catch {}
      return fixed
    }
    return list
  } catch {
    return []
  }
}

export function saveShotTxs(list: ShotTx[]): void {
  try {
    localStorage.setItem(SHOT_TXS_KEY, JSON.stringify(list))
  } catch {}
  try {
    window.dispatchEvent(new Event(SHOTS_CHANGED_EVENT))
  } catch {}
}

/**
 * Provisionales de UNA cuenta que Plaid aún no trae (los que ya tienen su
 * gemelo real quedan fuera). Es la base del balance CALCULADO de Miguel:
 * balance de la cuenta = balance de Plaid + Σ provisionales vigentes.
 * Nada se escribe a lo loco: el número sale de sumar movimientos reales.
 */
export function pendingShotsFor(shots: ShotTx[], accountId: string, bankTxs: BankTxLike[]): ShotTx[] {
  return reconcileShots(shots, accountId, bankTxs).kept.filter((s) => s.accountId === accountId)
}

export function pendingShotsSum(shots: ShotTx[], accountId: string, bankTxs: BankTxLike[]): number {
  return r2(pendingShotsFor(shots, accountId, bankTxs).reduce((s, x) => s + x.amount, 0))
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

/** ¿Este movimiento (del screenshot) ya existe entre los reales? Empareja
 *  uno a uno contra el pool: monto exacto al centavo y fecha a ±2 días. */
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
 * Quita los provisionales que ya bajaron por Plaid. Devuelve la lista
 * limpia y cuántos se reemplazaron. `bankTxs` = reales de ESA cuenta.
 */
export function reconcileShots(
  shots: ShotTx[],
  accountId: string,
  bankTxs: BankTxLike[],
): { kept: ShotTx[]; replaced: number } {
  const pool = (bankTxs || []).map((t) => ({ date: String(t.date).slice(0, 10), amount: Number(t.amount) || 0, used: false }))
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
 * Filtra lo recién escaneado: fuera lo que ya está en Plaid y lo que ya
 * se había escaneado (mismo monto/fecha) — no entra dos veces.
 */
export function filterExtracted(
  extracted: { date: string; description: string; amount: number; pending?: boolean }[],
  bankTxs: BankTxLike[],
  existingShots: ShotTx[],
): { fresh: typeof extracted; yaEnPlaid: number; yaEscaneados: number } {
  const poolBank = (bankTxs || []).map((t) => ({ date: String(t.date).slice(0, 10), amount: Number(t.amount) || 0, used: false }))
  const poolShots = (existingShots || []).map((s) => ({ date: s.date, amount: s.amount, used: false }))
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
