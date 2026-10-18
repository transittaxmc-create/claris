// ============================================================================
// AI · CLASIFICACIÓN DIARIA — el trabajo de la asistente digital (Copiloto AI).
// Cada día, al abrir DINERO, la AI toma los movimientos del banco que aún no
// tienen apunte (los "sin clasificar" del chequeo de reconciliación) y crea el
// apunte YA CATEGORIZADO (reglas + lo aprendido de las correcciones de Miguel).
// Miguel no hace clics en CIERRE: revisa el reporte por categoría en REPORTES
// y solo corrige lo que esté mal. Las correcciones se aprenden para siempre.
// ============================================================================
import type { CashFlowEntry } from "./types"
import type { ReconFinding } from "./reconciliation-check"
import { LEDGER_KEY } from "./cash-flow-store"
import { categorizeOne, loadLearned, type CategorizedTx } from "./auto-categorize"
import { looksLikeTransfer } from "./transfer-matcher"

/** localStorage: fecha (yyyy-mm-dd) de la última clasificación diaria. */
export const AI_CLASS_LAST_KEY = "claris_ai_class_last_v1"
export const AI_SOURCE_LABEL = "AI diaria"
export const AI_TRANSFER_CATEGORY = "Internal transfer"

/** Id estable del apunte AI para un movimiento bancario: "ai:<date>|<vendor>|<amount>". */
export function aiApunteId(date: string, detail: string, amount: number): string {
  return `ai:${categorizeOne(
    { date: String(date).slice(0, 10), detail: String(detail || ""), amount: Number(amount) || 0 },
    loadLearned(),
  ).id}`
}

/**
 * Toma los hallazgos "sin clasificar" del chequeo de reconciliación y crea
 * los apuntes YA categorizados. Puro: no toca localStorage (lo hace el caller).
 */
export function aiApuntesForFindings(findings: ReconFinding[]): CashFlowEntry[] {
  const learned = loadLearned()
  const sin: ReconFinding[] = (findings || []).filter((f) => f && f.type === "sin-clasificar" && f.bankTx)
  const now = Date.now()
  const out: CashFlowEntry[] = []
  sin.forEach((f, i) => {
    const t = f.bankTx!
    const amt = Number(t.amount) || 0
    if (Math.abs(amt) < 0.01) return
    const cat: CategorizedTx = categorizeOne(
      { date: String(t.date).slice(0, 10), detail: String(t.detail || ""), amount: amt },
      learned,
    )
    const esTransfer = looksLikeTransfer(String(t.detail || ""))
    const id = aiApunteId(t.date, t.detail, amt)
    out.push({
      id,
      date: String(t.date).slice(0, 10),
      description: String(t.detail || "Bank movement"),
      amount: Math.abs(amt),
      type: amt < 0 ? "expense" : "income",
      status: "actual",
      source: "bank",
      origin: esTransfer ? "transfer" : "bank",
      sourceLabel: esTransfer ? "Internal transfer" : AI_SOURCE_LABEL,
      category: esTransfer ? AI_TRANSFER_CATEGORY : cat.category,
      classification: esTransfer ? undefined : cat.classification,
      notes: "",
      accountId: f.accountId,
      createdAt: new Date(now + i).toISOString(),
    } as CashFlowEntry)
  })
  return out
}

/**
 * Corrección desde el REPORTES: actualiza el apunte AI en el libro y
 * avisa a la app (evento de sync) para que DINERO refresque. Devuelve
 * true si encontró y parcheó el apunte.
 */
export function patchAIApunte(
  apunteId: string,
  patch: { category?: string; classification?: "business" | "personal" },
): boolean {
  if (!apunteId) return false
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return false
    let found = false
    const next = arr.map((e: CashFlowEntry) => {
      if (!e || e.id !== apunteId) return e
      found = true
      return { ...e, ...patch, isManuallyEdited: true } as CashFlowEntry
    })
    if (!found) return false
    localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
    try {
      window.dispatchEvent(new Event("storage"))
    } catch {}
    return true
  } catch {
    return false
  }
}