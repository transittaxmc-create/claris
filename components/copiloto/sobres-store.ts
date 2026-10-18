// SOBRES — caparazón (Miguel, 2026-10-18).
// Estructura solamente: cada sobre tiene nombre, meta y asignado. Sin conexión
// al banco todavía; la conexión (reparto desde ingresos, verificación contra
// el banco) se hará después. Todo se guarda solo en el teléfono.

export type Sobre = {
  id: string
  nombre: string
  /** Meta del sobre (lo que el bill necesita). 0 = por definir. */
  meta: number
  /** Dinero apartado manualmente por ahora. */
  asignado: number
  createdAt: string
}

const KEY = "claris_sobres_v1"

const DEFAULTS: Omit<Sobre, "id" | "createdAt">[] = [
  { nombre: "Renta", meta: 1500, asignado: 0 },
  { nombre: "Car leasing", meta: 924, asignado: 0 },
  { nombre: "Phone", meta: 0, asignado: 0 },
]

function uid(): string {
  return `sobre-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function seed(): Sobre[] {
  const now = new Date().toISOString()
  return DEFAULTS.map((d) => ({ ...d, id: uid(), createdAt: now }))
}

export function loadSobres(): Sobre[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const s = seed()
      localStorage.setItem(KEY, JSON.stringify(s))
      return s
    }
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : seed()
  } catch {
    return seed()
  }
}

export function saveSobres(sobres: Sobre[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sobres))
  } catch {}
}

/** Crea un sobre nuevo con el mismo diseño que los default. */
export function newSobre(nombre: string, meta: number): Sobre {
  return {
    id: uid(),
    nombre: nombre.trim() || "Envelope",
    meta: Math.max(0, Number(meta) || 0),
    asignado: 0,
    createdAt: new Date().toISOString(),
  }
}

export function resetSobres(): Sobre[] {
  const s = seed()
  saveSobres(s)
  return s
}

export const money = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
