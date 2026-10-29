// Diario de peajes del TURNO (Miguel, 2026-10-29).
//
// La detección GPS dentro de un viaje ya vive en el viaje mismo (toll +
// nota "[Oct 29 · 14:35] Estación - $X.XX"). Pero Miguel pasaba peajes
// ENTRE trabajos — sin viaje activo — y esas pasadas se perdían ("a veces
// no se calcula"). Este diario guarda las pasadas detectadas con el turno
// prendido y SIN viaje activo, para que:
//  - el contador de TODAY (día/semana) cuente TODO lo del día, no solo lo
//    que cayó dentro de un trabajo;
//  - el bill semanal de E-ZPass (viernes) sume también estas pasadas;
//  - TOLL AUDIT las cruce contra el statement como parte del log GPS
//    (label SHIFT) — nada se pierde en silencio.
//
// Sin duplicados: una pasada dentro de un viaje NUNCA entra aquí (la
// registra el viaje), y a nivel turno la misma plaza no se anota dos
// veces dentro de la ventana de enfriamiento (ver copiloto-app).
// Vive en la nube (finance cloud) como el resto del dinero: la clave está
// en FINANCE_CLOUD_KEYS.

export interface ShiftToll {
  id: string
  /** Día local YYYY-MM-DD de la pasada. */
  date: string
  /** Hora local "HH:MM" (24h). */
  time: string
  /** Nombre de la plaza, igual que en toll-plazas-2026. */
  plaza: string
  /** Monto E-ZPass 2026; null = sistema ticket ("check E-ZPass statement"). */
  amount: number | null
}

export const SHIFT_TOLLS_KEY = "claris_shift_tolls_v1"
/** Avisa a las pantallas que el diario cambió (contador de TODAY). */
export const SHIFT_TOLLS_EVENT = "claris:shift-tolls-changed"

export function loadShiftTolls(): ShiftToll[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SHIFT_TOLLS_KEY) || "[]")
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (t): t is ShiftToll =>
        t && typeof t === "object" && typeof t.date === "string" && typeof t.plaza === "string"
    )
  } catch {
    return []
  }
}

export function saveShiftTolls(list: ShiftToll[]): void {
  try {
    localStorage.setItem(SHIFT_TOLLS_KEY, JSON.stringify(list))
  } catch {}
  try {
    window.dispatchEvent(new Event(SHIFT_TOLLS_EVENT))
  } catch {}
}

export function addShiftTolls(entries: ShiftToll[]): void {
  if (entries.length === 0) return
  saveShiftTolls([...loadShiftTolls(), ...entries])
}

/** Suma de montos conocidos (los de monto null cuentan como pasada, no como $). */
export function sumShiftTolls(list: ShiftToll[]): number {
  return Math.round(list.reduce((s, t) => s + (Number(t.amount) || 0), 0) * 100) / 100
}
