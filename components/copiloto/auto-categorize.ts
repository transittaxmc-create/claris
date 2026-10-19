// ============================================================================
// AUTO-CATEGORIZACIÓN DE TRANSACCIONES BANCARIAS — el trabajo de la asistente.
// Miguel supervisa: revisa el reporte y corrige solo lo que esté mal.
// Las correcciones se aprenden (localStorage) y se aplican solas la próxima vez.
// ============================================================================

import { EXPENSE_CATEGORIES, migrateCategory } from "./types"
import { looksLikeTransfer } from "./transfer-matcher"

/** Categoría para el mismo dólar movido entre cuentas: nunca es ingreso. */
export const TRANSFER_CATEGORY = "Internal transfer"

export type BankTxInput = {
  date: string
  detail: string
  amount: number
  bank_account?: string
}

export interface CategorizedTx extends BankTxInput {
  id: string
  vendor: string
  category: string
  classification: "business" | "personal"
  learned: boolean
  /** true si la regla no encontró nada y quedó en "Other / Varios" */
  uncategorized: boolean
}

const LEARNED_KEY = "claris_autocat_learned_v1"

type LearnedMap = Record<string, { category: string; classification: "business" | "personal" }>

function normVendor(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function loadLearned(): LearnedMap {
  try {
    const raw = localStorage.getItem(LEARNED_KEY)
    const p = raw ? JSON.parse(raw) : {}
    if (!p || typeof p !== "object") return {}
    // Migración a inglés (2026-10-18): normalizar categorías viejas al leer.
    for (const k of Object.keys(p)) {
      if (p[k] && typeof p[k].category === "string") p[k].category = migrateCategory(p[k].category)
    }
    return p
  } catch {
    return {}
  }
}

export function saveLearned(map: LearnedMap) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify(map))
  } catch {}
}

/** Guarda una corrección de Miguel: la próxima vez se aplica sola. */
export function learnCorrection(vendor: string, category: string, classification: "business" | "personal") {
  const key = normVendor(vendor)
  if (!key) return
  const m = loadLearned()
  m[key] = { category, classification }
  saveLearned(m)
}

// ---------------------------------------------------------------------------
// Reglas por palabra clave (inglés + español, como vienen los bancos).
// ---------------------------------------------------------------------------

const FUEL = ["shell", "exxon", "mobil", " bp ", "sunoco", "speedway", "wawa", "citgo", "gulf", "gasolina", "combustible", "electrify america", "evgo"]
const TOLLS = ["ezpass", "ez pass", "e-zpass", "zpass", "toll", "peaje", "mta", "port authority"]
const FOOD = ["mcdonald", "burger king", "wendy", "pizza", "restaurant", "restaurante", "food", "comida", "starbucks", "dunkin", "cafe", "taco", "pollo", "subway", "kfc", "domino", "chipotle", "panera", "7 eleven", "bagel", "tim hortons", " deli ", "stop shop"]
const CARWASH = ["car wash", "lavado", "autolavado"]
const INSURANCE = ["insurance", "seguro", "geico", "progressive", "allstate", "state farm", "tlc", "permit", "permiso", "dmv"]
const BANKFEES = ["overdraft", "sobregiro", "service charge", "monthly fee", "monthly service fee", "maintenance fee", "nsf fee", "late fee", "cargo por", "comision", "unload", "non citibank atm"]
const PHONE = ["verizon", "t-mobile", "tmobile", "at&t", "att ", "mint mobile", "metro pcs", "metropcs", "phone", "telefono", "sprint"]
const PARKING = ["parking", "parqueo", "estacionamiento", "park ", "la z park"]
const MAINT = ["autozone", "pep boys", "advance auto", "mechanic", "mecanico", "repair", "reparacion", "tire", "llanta", "oil change", "cambio de aceite", "jiffy", "brake", "freno", "firestone", "midas", "valvoline"]
const SUPPLIES = ["amazon", "walmart", "target", "suppl", "suministro", "home depot", "lowes", "harbor freight"]
const LEASINGW = ["leasing", "car lease"]
const INCOME_WORDS = ["deposit", "deposito", "payroll", "nomina", "uber", "lyft", "empower", "gallant", "aki mobility", "texport", "ctg", "aventus", "via ", "curb", "zelle", "venmo", "cash app", "pago recibido", "transfer in"]

function hits(text: string, words: string[]): boolean {
  const t = ` ${text} `
  return words.some((w) => t.includes(w))
}

// Tax classification por defecto de cada categoría (Miguel la puede corregir).
const CLASS_BY_CATEGORY: Record<string, "business" | "personal"> = {
  "Fuel": "business",
  "Vehicle maintenance": "business",
  "Car leasing": "business",
  "Rent": "business",
  "Tolls": "business",
  "Food": "personal",
  "Car wash": "business",
  "Insurance": "business",
  "Bank fees": "business",
  "Phone": "business",
  "Parking": "business",
  "Supplies": "business",
  "Other": "personal",
  "Income": "business",
}

export const INCOME_CATEGORY = "Income"

function ruleCategory(vendor: string, amount: number): string | null {
  const v = normVendor(vendor)
  if (amount > 0 && hits(v, INCOME_WORDS)) return INCOME_CATEGORY
  if (hits(v, FUEL)) return "Fuel"
  if (hits(v, TOLLS)) return "Tolls"
  if (hits(v, CARWASH)) return "Car wash"
  if (hits(v, INSURANCE)) return "Insurance"
  if (hits(v, BANKFEES)) return "Bank fees"
  if (hits(v, PHONE)) return "Phone"
  if (hits(v, PARKING)) return "Parking"
  if (hits(v, MAINT)) return "Vehicle maintenance"
  if (hits(v, LEASINGW)) return "Car leasing"
  if (hits(v, FOOD)) return "Food"
  if (hits(v, SUPPLIES)) return "Supplies"
  return null
}

function vendorOf(detail: string): string {
  // El banco manda descripciones largas; tomar la parte legible.
  const d = String(detail || "").trim()
  // Quitar números de referencia largos al final.
  return d.replace(/\s{2,}\d{4,}.*$/, "").trim().slice(0, 42) || d.slice(0, 42)
}

export function categorizeOne(tx: BankTxInput, learned: LearnedMap): CategorizedTx {
  const vendor = vendorOf(tx.detail)
  const key = normVendor(vendor)
  const id = `${tx.date}|${key}|${tx.amount}`

  // 1. Lo aprendido de correcciones de Miguel manda.
  const l = learned[key]
  if (l) {
    return { ...tx, id, vendor, category: l.category, classification: l.classification, learned: true, uncategorized: false }
  }
  // 1b. Transfers (regla de Miguel): el mismo dólar movido entre cuentas NO es
  // un ingreso nuevo. Se detecta por el label, antes de cualquier regla de
  // ingreso — "UBER PRO CARD" en otro banco es la llegada de la transferencia,
  // el ingreso real fue el payout en la tarjeta.
  if (looksLikeTransfer(tx.detail || "")) {
    return { ...tx, id, vendor, category: TRANSFER_CATEGORY, classification: "personal", learned: false, uncategorized: false }
  }
  // 2. Reglas por palabra clave.
  const cat = ruleCategory(vendor, tx.amount)
  if (cat) {
    return {
      ...tx, id, vendor, category: cat,
      classification: CLASS_BY_CATEGORY[cat] ?? "personal",
      learned: false, uncategorized: false,
    }
  }
  // 3. Sin regla: ingresos positivos van a Ingresos; lo demás a Other.
  if (tx.amount > 0) {
    return { ...tx, id, vendor, category: INCOME_CATEGORY, classification: "business", learned: false, uncategorized: false }
  }
  return { ...tx, id, vendor, category: "Other", classification: "personal", learned: false, uncategorized: true }
}

export function categorizeAll(txs: BankTxInput[]): CategorizedTx[] {
  const learned = loadLearned()
  return txs.map((t) => categorizeOne(t, learned))
}

/** Agrupa por categoría para el reporte del supervisor. */
export function groupByCategory(txs: CategorizedTx[]): { category: string; items: CategorizedTx[]; total: number }[] {
  const map = new Map<string, CategorizedTx[]>()
  for (const t of txs) {
    const arr = map.get(t.category) ?? []
    arr.push(t)
    map.set(t.category, arr)
  }
  const order = [...EXPENSE_CATEGORIES, INCOME_CATEGORY]
  return [...map.entries()]
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => String(a.date).localeCompare(String(b.date))),
      total: items.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    }))
    .sort((a, b) => {
      const ia = order.indexOf(a.category)
      const ib = order.indexOf(b.category)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
}

export { EXPENSE_CATEGORIES, INCOME_CATEGORY as INCOME_CAT }
