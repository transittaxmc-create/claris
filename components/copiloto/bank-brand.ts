// Marca de banco (diseño MONEY): logo + colores por cuenta.
// Se detecta por nombre e institución que manda el banco (Plaid), así las
// cuentas reales (Citibank, Navy Federal, Varo, PayPal…) salen con su marca.
// Puro: sin React, probado en Node.

export interface BankBrand {
  /** Clave interna (citi, chase, …) o "generic". */
  id: string
  /** Nombre corto para mostrar. */
  short: string
  /** Ruta del logo en /public, o null = usar inicial con degradado. */
  logo: string | null
  /** Color principal y acento de la marca. */
  c: string
  a: string
  /** El SVG ya trae fondo de color: se muestra a sangre. */
  fullTile: boolean
}

type BrandDef = Omit<BankBrand, "id"> & { match: RegExp }

// Orden importa: lo más específico primero.
const BRANDS: Record<string, BrandDef> = {
  citi: { match: /citi|access account/i, short: "Citibank", logo: "/bank-logos/citi.svg", c: "#056DAE", a: "#E31837", fullTile: true },
  chase: { match: /chase/i, short: "Chase", logo: "/bank-logos/chase.svg", c: "#117ACA", a: "#0B4F8A", fullTile: false },
  bofa: { match: /bank of america|bofa/i, short: "BofA", logo: "/bank-logos/bank-of-america.svg", c: "#012169", a: "#E31837", fullTile: false },
  wells: { match: /wells/i, short: "Wells Fargo", logo: "/bank-logos/wells-fargo.svg", c: "#D71E28", a: "#FFCD41", fullTile: false },
  capitalone: { match: /capital\s*one/i, short: "Capital One", logo: "/bank-logos/capital-one.svg", c: "#004977", a: "#D03027", fullTile: true },
  amex: { match: /amex|american express/i, short: "Amex", logo: "/bank-logos/amex.svg", c: "#2E77BC", a: "#1C4F84", fullTile: false },
  discover: { match: /discover/i, short: "Discover", logo: "/bank-logos/discover.svg", c: "#FF6000", a: "#FFA24D", fullTile: false },
  apple: { match: /apple/i, short: "Apple Card", logo: "/bank-logos/apple-card.svg", c: "#A2AAAD", a: "#F5F5F7", fullTile: false },
  mercury: { match: /mercury/i, short: "Mercury", logo: "/bank-logos/mercury.svg", c: "#5266EB", a: "#1E1F2E", fullTile: true },
  paypal: { match: /paypal/i, short: "PayPal", logo: "/bank-logos/paypal.svg", c: "#003087", a: "#009CDE", fullTile: false },
  venmo: { match: /venmo/i, short: "Venmo", logo: "/bank-logos/venmo.svg", c: "#008CFF", a: "#3DB2FF", fullTile: false },
  square: { match: /square/i, short: "Square", logo: "/bank-logos/square.svg", c: "#3E4348", a: "#9AA0A6", fullTile: false },
  tdbank: { match: /\btd\b|td bank/i, short: "TD Bank", logo: "/bank-logos/td-bank.svg", c: "#2DB928", a: "#1A7A17", fullTile: true },
  schwab: { match: /schwab/i, short: "Schwab", logo: "/bank-logos/schwab.svg", c: "#00A0DF", a: "#0067A0", fullTile: true },
  zelle: { match: /zelle/i, short: "Zelle", logo: "/bank-logos/zelle.svg", c: "#6D1ED4", a: "#A66BFF", fullTile: false },
  // Sin logo SVG en el kit: inicial con su color de marca.
  navy: { match: /navy federal/i, short: "Navy Federal", logo: null, c: "#003A70", a: "#F2A900", fullTile: false },
  varo: { match: /varo/i, short: "Varo", logo: null, c: "#1F5EFF", a: "#00C2A8", fullTile: false },
  branch: { match: /branch/i, short: "Branch", logo: null, c: "#0B3C2C", a: "#69C24C", fullTile: false },
  uber: { match: /uber/i, short: "Uber", logo: "/logos/uber.svg", c: "#000000", a: "#5B5B5B", fullTile: true },
  lyft: { match: /lyft/i, short: "Lyft", logo: "/logos/lyft.svg", c: "#FF00BF", a: "#FF6BDB", fullTile: true },
}

const GENERIC: Omit<BankBrand, "short"> = { id: "generic", logo: null, c: "#5b8cff", a: "#7c5cff", fullTile: false }

/** Marca de una cuenta a partir de su nombre e institución. */
export function bankBrandOf(name: string, institution?: string | null): BankBrand {
  // La institución es más confiable que el nombre ("Checking …9298" de Uber Pro Card).
  const sources = [String(institution || ""), String(name || "")]
  for (const src of sources) {
    if (!src.trim()) continue
    for (const [id, def] of Object.entries(BRANDS)) {
      if (def.match.test(src)) {
        const { match: _m, ...rest } = def
        return { id, ...rest }
      }
    }
  }
  const first = String(name || "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/)[0] || "Account"
  return { ...GENERIC, short: first.slice(0, 14) }
}

/**
 * Movimientos por cuenta (para "N mov." en la tarjeta): movimientos del banco
 * de esa cuenta + asientos del libro con su accountId. Los asientos sin cuenta
 * cuentan para la principal (misma regla que el registro por cuenta).
 */
export function movementCounts(
  registers: { id: string; isMain: boolean }[],
  bankTxs: { bank_account?: string }[],
  entries: { accountId?: string }[],
  idFor: (bankAccount: string) => string,
): Record<string, number> {
  const out: Record<string, number> = {}
  const known = new Set(registers.map((r) => r.id))
  const main = registers.find((r) => r.isMain)?.id
  for (const r of registers) out[r.id] = 0
  for (const t of bankTxs || []) {
    const id = idFor(String(t?.bank_account || ""))
    if (known.has(id)) out[id] += 1
  }
  for (const e of entries || []) {
    const id = e?.accountId ? String(e.accountId) : main
    if (id && known.has(id)) out[id] += 1
  }
  return out
}

/** Inicial para el logo de reemplazo. */
export function brandInitial(b: BankBrand, name: string): string {
  return (b.short || name || "?").trim().charAt(0).toUpperCase() || "?"
}
