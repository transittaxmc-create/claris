// Account switches (Miguel, 2026-11-13): en DATA → ACCOUNTS vive la lista
// COMPLETA de cuentas, cada una con (1) su switch de ACTIVA — apagada no
// aparece en MONEY y cuenta $0 en Proyecciones, aunque Plaid la siga
// sincronizando y su register se siga actualizando — y (2) el control de
// PRIMARIA (★): solo una a la vez, es la base de Proyecciones, y cambiarla
// es un ajuste del usuario, no un cambio de código.
//
// El estado vive en localStorage bajo una clave `claris_` para que viaje
// en el respaldo SUBIR/RESTAURAR (backup.ts exporta todas las claves
// claris_/ic_) y el otro teléfono quede igual.

export const ACCOUNT_FLAGS_KEY = "claris_account_flags_v1"
export const ACCOUNT_FLAGS_EVENT = "claris:account-flags"
export const OPEN_ACCOUNT_KEY = "claris_open_account_v1"

export interface AccountFlags {
  primaryId: string | null
  activeIds: string[]
}

interface StoredFlags extends AccountFlags {
  /** Cuentas que ya existían cuando se guardó: una cuenta NUEVA (no está
   *  aquí) entra apagada por default, pero listada en Settings. */
  seenIds: string[]
}

/** Forma mínima que necesitan las banderas (buildRegisters pasa la suya). */
export interface FlagAccount {
  id: string
  name?: string | null
}

function loadStored(): StoredFlags | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_FLAGS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== "object") return null
    const strs = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : []
    return {
      primaryId: typeof p.primaryId === "string" ? p.primaryId : null,
      activeIds: strs(p.activeIds),
      seenIds: strs(p.seenIds),
    }
  } catch {
    return null
  }
}

export function saveAccountFlags(f: StoredFlags) {
  try {
    localStorage.setItem(ACCOUNT_FLAGS_KEY, JSON.stringify(f))
  } catch {}
  // Diferido: resolver banderas puede correr durante un render (useMemo de
  // buildRegisters) y un setState sincrónico desde ahí rompería React.
  try {
    window.setTimeout(() => {
      try {
        window.dispatchEvent(new Event(ACCOUNT_FLAGS_EVENT))
      } catch {}
    }, 0)
  } catch {}
}

/** Primaria por default: la Citibank ·2144 de Miguel (orden 2026-11-13). */
export function defaultPrimaryId(accounts: FlagAccount[]): string | null {
  const seed = accounts.find((a) => a.id === "manual:citi-2144")
  if (seed) return seed.id
  const byDigits = accounts.find((a) => String(a.name || "").includes("2144"))
  return byDigits ? byDigits.id : null
}

/** Activas por default (primer arranque): la primaria + PayPal, Uber Pro
 *  y Lyft — las de uso diario de Miguel. Todo lo demás entra apagado. */
export function defaultActiveIds(accounts: FlagAccount[], primaryId: string | null): string[] {
  const out = new Set<string>()
  if (primaryId) out.add(primaryId)
  for (const re of [/paypal/i, /uber/i, /lyft/i]) {
    const m = accounts.find((a) => re.test(String(a.name || "")))
    if (m) out.add(m.id)
  }
  return [...out]
}

/**
 * Resuelve las banderas contra la lista de cuentas dada y persiste las
 * fusiones (defaults del primer arranque, primaria siempre activa, cuentas
 * nuevas marcadas como vistas). NUNCA quita activas guardadas por no
 * aparecer en la lista: algunas pantallas construyen listas parciales
 * (nombres del feed) y no deben pisar el ajuste del usuario.
 */
export function resolveAccountFlags(accounts: FlagAccount[]): AccountFlags {
  const stored = loadStored()
  if (!accounts || accounts.length === 0) {
    return stored
      ? { primaryId: stored.primaryId, activeIds: stored.activeIds }
      : { primaryId: null, activeIds: [] }
  }
  const ids = accounts.map((a) => a.id)
  if (!stored) {
    const primaryId = defaultPrimaryId(accounts)
    const activeIds = defaultActiveIds(accounts, primaryId)
    saveAccountFlags({ primaryId, activeIds, seenIds: ids })
    return { primaryId, activeIds }
  }
  let { primaryId, activeIds, seenIds } = stored
  let changed = false
  if (!primaryId) {
    const d = defaultPrimaryId(accounts)
    if (d) {
      primaryId = d
      changed = true
    }
  }
  if (seenIds.length === 0) {
    // El registro nació de una escritura cruda (ej. "Make primary" antes de
    // la primera resolución): se siembran las activas por default sin pisar
    // lo que ya se haya elegido.
    for (const id of defaultActiveIds(accounts, primaryId)) {
      if (!activeIds.includes(id)) {
        activeIds = [...activeIds, id]
        changed = true
      }
    }
  }
  // La primaria siempre está activa.
  if (primaryId && !activeIds.includes(primaryId)) {
    activeIds = [...activeIds, primaryId]
    changed = true
  }
  const newSeen = ids.filter((id) => !seenIds.includes(id))
  if (newSeen.length > 0) {
    seenIds = [...seenIds, ...newSeen]
    changed = true
  }
  if (changed) saveAccountFlags({ primaryId, activeIds, seenIds })
  return { primaryId, activeIds }
}

/** Prende/apaga una cuenta. La primaria NO se puede apagar: primero hay
 *  que hacer primaria a otra. */
export function setAccountActive(id: string, on: boolean, accounts: FlagAccount[]): AccountFlags {
  const f = resolveAccountFlags(accounts)
  if (!on && f.primaryId === id) return f
  const activeIds = on
    ? f.activeIds.includes(id)
      ? f.activeIds
      : [...f.activeIds, id]
    : f.activeIds.filter((x) => x !== id)
  const stored = loadStored()
  saveAccountFlags({
    primaryId: f.primaryId,
    activeIds,
    seenIds: stored?.seenIds ?? accounts.map((a) => a.id),
  })
  return { primaryId: f.primaryId, activeIds }
}

/** Mueve la ★: exactamente una primaria; la nueva se activa si estaba
 *  apagada, y la anterior la pierde sola. */
export function setPrimaryAccount(id: string, accounts: FlagAccount[]): AccountFlags {
  const f = resolveAccountFlags(accounts)
  const activeIds = f.activeIds.includes(id) ? f.activeIds : [...f.activeIds, id]
  const stored = loadStored()
  saveAccountFlags({
    primaryId: id,
    activeIds,
    seenIds: stored?.seenIds ?? accounts.map((a) => a.id),
  })
  return { primaryId: id, activeIds }
}

/** Escritura cruda de la primaria, sin lista de cuentas a mano
 *  (registers-store.setMainAccount). La resolución posterior siembra las
 *  activas por default porque seenIds queda vacío. */
export function setPrimaryAccountRaw(id: string) {
  const stored = loadStored() ?? { primaryId: null, activeIds: [] as string[], seenIds: [] as string[] }
  const activeIds = stored.activeIds.includes(id) ? stored.activeIds : [...stored.activeIds, id]
  saveAccountFlags({ ...stored, primaryId: id, activeIds })
}

/** Si se borra la cuenta primaria, la ★ vuelve al default en la próxima
 *  resolución (Citibank ·2144). */
export function clearPrimaryIf(id: string) {
  const stored = loadStored()
  if (stored && stored.primaryId === id) saveAccountFlags({ ...stored, primaryId: null })
}

// ---------------------------------------------------------------------------
// Abrir el register de una cuenta desde otra pantalla (DATA → MONEY):
// la app guarda el pedido y CashFlowRegister lo consume al montar.
// ---------------------------------------------------------------------------

export function requestOpenAccount(id: string) {
  try {
    localStorage.setItem(OPEN_ACCOUNT_KEY, id)
  } catch {}
}

export function peekOpenAccount(): string | null {
  try {
    return localStorage.getItem(OPEN_ACCOUNT_KEY)
  } catch {
    return null
  }
}

export function clearOpenAccount() {
  try {
    localStorage.removeItem(OPEN_ACCOUNT_KEY)
  } catch {}
}
