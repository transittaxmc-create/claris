// RECIBOS ADJUNTOS AL STATEMENT (Miguel, 2026-10-25; construido 2026-10-29):
// la foto de cada recibo escaneado se GUARDA (antes se botaba tras leer los
// datos) y queda adjunta a su transacción del banco, con un 🧾 en la fila
// del register. Propósito: auditoría — imprimir el statement con o sin los
// recibos adjuntos.
//
// Piezas:
// - La IMAGEN vive en Supabase (app_state, una fila por recibo:
//   id='receipt-img:<id>') vía /api/receipt-image. Ni el teléfono ni el
//   documento de finanzas cargan fotos: aquí solo vive el ÍNDICE (datos
//   chicos), que sí viaja en la nube con las demás claves de finanzas.
// - ANTI-DUPLICADO (regla de Miguel, 2026-10-29): si un recibo escaneado ya
//   está guardado — misma huella (vendedor+fecha+monto) o la misma foto —
//   se identifica y se ANULA: no se guarda dos veces.
// - MACHEO uno a uno: recibo ↔ UNA transacción del banco (monto exacto al
//   centavo, fecha ±3 días, misma cuenta si el recibo trae cuenta; el
//   parecido del nombre desempata). Una transacción no carga dos recibos
//   ni un recibo se parte entre dos transacciones.

import { FINANCE_SYNCED_EVENT } from "./finance-sync"

export interface ReceiptMeta {
  id: string
  /** Gasto (ic_expenses) del que nació el recibo, si aplica. */
  expenseId?: string
  vendor: string
  /** YYYY-MM-DD */
  date: string
  /** Siempre positivo (es un gasto pagado). */
  amount: number
  category?: string
  /** RegisterAccount.id de la cuenta que pagó (snap:… / manual:…). */
  accountId?: string
  /** Fila en app_state: receipt-img:<imageId>. */
  imageId: string
  /** SHA-256 de la foto (hex) — caza la misma foto re-subida. */
  imgHash?: string
  /** Huella de datos: vendedor normalizado | fecha | monto. */
  fingerprint: string
  /** transaction_id (bankRef) de la transacción del banco adjunta. */
  bankTxId?: string
  createdAt: string
}

export const RECEIPTS_KEY = "claris_receipts_v1"
export const RECEIPTS_CHANGED_EVENT = "claris:receipts-changed"

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export function normalizeVendor(v: string): string {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function receiptFingerprint(vendor: string, date: string, amount: number): string {
  return `${normalizeVendor(vendor)}|${String(date || "").slice(0, 10)}|${r2(amount).toFixed(2)}`
}

/** SHA-256 (hex) de un data URL de imagen; "" si no se pudo calcular. */
export async function hashImage(dataUrl: string): Promise<string> {
  try {
    if (!dataUrl || typeof crypto === "undefined" || !crypto.subtle) return ""
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  } catch {
    return ""
  }
}

export function loadReceipts(): ReceiptMeta[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]")
    return Array.isArray(raw) ? (raw as ReceiptMeta[]) : []
  } catch {
    return []
  }
}

export function saveReceipts(list: ReceiptMeta[]): void {
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(list))
  } catch {}
  try {
    window.dispatchEvent(new Event(RECEIPTS_CHANGED_EVENT))
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  } catch {}
}

/**
 * ¿Este recibo ya está guardado? Primero por la foto exacta (imgHash) y
 * después por la huella de datos. Devuelve el guardado o null.
 */
export function findReceiptDuplicate(
  list: ReceiptMeta[],
  cand: { vendor: string; date: string; amount: number; imgHash?: string },
): ReceiptMeta | null {
  if (cand.imgHash) {
    const byImg = list.find((r) => r.imgHash && r.imgHash === cand.imgHash)
    if (byImg) return byImg
  }
  const fp = receiptFingerprint(cand.vendor, cand.date, cand.amount)
  return list.find((r) => r.fingerprint === fp) || null
}

/** Sube la foto a la nube. true si quedó guardada. */
export async function uploadReceiptImage(id: string, dataUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 30000)
    const r = await fetch("/api/receipt-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, image: dataUrl }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))
    return r.ok
  } catch {
    return false
  }
}

/**
 * Archiva un recibo recién escaneado: anti-duplicado primero; si pasa,
 * sube la foto y guarda el índice. Nunca lanza: el gasto en sí ya se
 * guardó por su propio camino; esto es el adjunto de auditoría.
 */
export async function archiveReceipt(input: {
  expenseId?: string
  vendor: string
  date: string
  amount: number
  category?: string
  accountId?: string
  image: string
  imgHash?: string
}): Promise<{ ok: boolean; duplicate?: ReceiptMeta; id?: string }> {
  const existing = loadReceipts()
  const dup = findReceiptDuplicate(existing, input)
  if (dup) return { ok: false, duplicate: dup }
  const id = `rcpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const uploaded = await uploadReceiptImage(id, input.image)
  if (!uploaded) return { ok: false }
  const meta: ReceiptMeta = {
    id,
    expenseId: input.expenseId,
    vendor: input.vendor,
    date: String(input.date || "").slice(0, 10),
    amount: r2(Math.abs(input.amount)),
    category: input.category,
    accountId: input.accountId,
    imageId: id,
    imgHash: input.imgHash || undefined,
    fingerprint: receiptFingerprint(input.vendor, input.date, input.amount),
    createdAt: new Date().toISOString(),
  }
  saveReceipts([...existing, meta])
  return { ok: true, id }
}

function daysDiff(a: string, b: string): number {
  const da = new Date(`${String(a).slice(0, 10)}T12:00:00`).getTime()
  const db = new Date(`${String(b).slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999
  return Math.abs(Math.round((da - db) / 86400000))
}

/** Parecido de nombre: algún token del vendedor aparece en el detalle del
 *  banco o al revés. Solo desempata; el macheo manda por monto+fecha. */
function vendorScore(vendor: string, detail: string): number {
  const v = normalizeVendor(vendor)
  const d = normalizeVendor(detail)
  if (!v || !d) return 0
  if (d.includes(v) || v.includes(d)) return 2
  const tokens = v.split(" ").filter((t) => t.length >= 3)
  return tokens.some((t) => d.includes(t)) ? 1 : 0
}

export interface MatchableTx {
  transaction_id?: string | null
  date: string
  amount: number
  detail: string
}

/**
 * Adjunta recibos sin machear a transacciones del banco de UNA cuenta
 * (las que recibe son solo de esa cuenta). Uno a uno: las transacciones
 * ya reclamadas por otro recibo no se reusan. Devuelve la lista nueva y
 * cuántos se adjuntaron en esta pasada. No muta la entrada.
 */
export function matchReceiptsForAccount(
  receipts: ReceiptMeta[],
  accountId: string,
  bankTxs: MatchableTx[],
): { list: ReceiptMeta[]; attached: number } {
  const claimed = new Set(receipts.map((r) => r.bankTxId).filter(Boolean) as string[])
  const txs = (bankTxs || []).filter((t) => t.transaction_id)
  let attached = 0
  const list = receipts.map((r) => {
    if (r.bankTxId) return r
    if (r.accountId && r.accountId !== accountId) return r
    let best: MatchableTx | null = null
    let bestScore = -1
    let bestDays = 99
    for (const t of txs) {
      if (claimed.has(t.transaction_id as string)) continue
      if (Math.abs(r2(Math.abs(t.amount)) - r2(r.amount)) > 0.011) continue
      const d = daysDiff(t.date, r.date)
      if (d > 3) continue
      const score = vendorScore(r.vendor, t.detail) * 10 + (3 - d)
      if (score > bestScore || (score === bestScore && d < bestDays)) {
        best = t
        bestScore = score
        bestDays = d
      }
    }
    if (best?.transaction_id) {
      claimed.add(best.transaction_id)
      attached++
      return { ...r, bankTxId: best.transaction_id }
    }
    return r
  })
  return { list, attached }
}
