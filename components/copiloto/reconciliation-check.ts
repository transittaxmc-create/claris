// ============================================================================
// CHEQUEO DIARIO DE RECONCILIACIÓN — por cuenta, en orden.
// Reglas de Miguel: automático, nunca falla en silencio, todo editable,
// reporte primero → él aprueba → recién se aplica. Nada se modifica solo.
// ============================================================================

import { normalizeVendorName } from "./types"
import { accountIdFor } from "./registers-store"
import { looksLikeTransfer, type TransferReport } from "./transfer-matcher"

export const AMOUNT_TOL = 0.011
const DAY_WINDOW = 4
const DUP_DAY_WINDOW = 2
const DISMISS_DAYS = 7

export const RECON_DECISIONS_KEY = "claris_recon_decisions_v1"
export const RECON_LAST_AUTO_KEY = "claris_recon_last_auto_v1"

export interface ReconBankTx {
  date: string
  bank_account: string
  detail: string
  amount: number
  daily_balance: number | null
}

export interface ReconEntry {
  id: string
  date: string
  description: string
  amount: number
  type: "income" | "expense"
  status: "actual" | "projected"
  accountId?: string
}

export interface ReconRegister {
  id: string
  name: string
  kind: "bank" | "card"
  source: "snapshot" | "manual"
  isMain: boolean
}

export type ReconFindingType =
  | "diferencia"
  | "sin-clasificar"
  | "pendiente-banco"
  | "duplicado"
  | "transfer-sin-pareja"

export type ReconActionKind = "revisar" | "crear-apunte" | "eliminar-duplicado"

export interface ReconProposedAction {
  kind: ReconActionKind
  label: string
  /** entryId a eliminar cuando kind === "eliminar-duplicado" */
  entryId?: string
}

export interface ReconFinding {
  key: string
  accountId: string
  accountName: string
  type: ReconFindingType
  title: string
  detail: string
  severity: "info" | "warn"
  entryId?: string
  bankTx?: { date: string; detail: string; amount: number }
  proposedAction: ReconProposedAction
}

export interface ReconAccountResult {
  accountId: string
  accountName: string
  kind: "bank" | "card" | "manual"
  bankBalance: number | null
  findings: ReconFinding[]
  cuadrada: boolean
}

export interface ReconReport {
  ranAt: string
  date: string
  ok: boolean
  error?: string
  accounts: ReconAccountResult[]
  summary: { total: number; cuadradas: number; conHallazgos: number; diferenciaTotal: number }
}

export type ReconDecisions = Record<string, { d: "a" | "r"; at: number }>

export function loadDecisions(): ReconDecisions {
  try {
    const raw = localStorage.getItem(RECON_DECISIONS_KEY)
    const p = raw ? JSON.parse(raw) : {}
    return p && typeof p === "object" ? p : {}
  } catch {
    return {}
  }
}

export function saveDecision(key: string, d: "a" | "r") {
  try {
    const cur = loadDecisions()
    cur[key] = { d, at: Date.now() }
    // Poda: no guardar más de 500 decisiones.
    const keys = Object.keys(cur)
    if (keys.length > 500) {
      keys
        .sort((a, b) => (cur[a]?.at || 0) - (cur[b]?.at || 0))
        .slice(0, keys.length - 500)
        .forEach((k) => delete cur[k])
    }
    localStorage.setItem(RECON_DECISIONS_KEY, JSON.stringify(cur))
  } catch {}
}

function isDismissed(key: string, decisions: ReconDecisions): boolean {
  const d = decisions[key]
  if (!d) return false
  return Date.now() - d.at < DISMISS_DAYS * 86400000
}

function daysBetween(a: string, b: string): number {
  const t = (s: string) => new Date(`${String(s).slice(0, 10)}T12:00:00`).getTime()
  const ms = t(a) - t(b)
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 86400000)) : 999
}

function cents(n: unknown): number {
  return Math.round((Number(n) || 0) * 100)
}

function txKey(t: { date: string; detail: string; amount: number }): string {
  return `${String(t.date).slice(0, 10)}|${normalizeVendorName(t.detail)}|${cents(Math.abs(t.amount))}`
}

function fmt(n: number): string {
  const v = Number(n) || 0
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function shortDate(iso: string): string {
  const s = String(iso || "")
  return s.length >= 10 ? s.slice(5, 10) : "—"
}

export function runReconciliationCheck(input: {
  registers: ReconRegister[]
  balances: Record<string, number | null>
  entries: ReconEntry[]
  bankTxs: ReconBankTx[]
  transfers: TransferReport
  bankOk: boolean
  decisions?: ReconDecisions
}): ReconReport {
  const today = new Date().toISOString().slice(0, 10)
  const decisions = input.decisions || {}
  const regs = [...(input.registers || [])].sort((a, b) => {
    const ord = (r: ReconRegister) => (r.source === "manual" ? 2 : r.kind === "bank" ? 0 : 1)
    return ord(a) - ord(b)
  })

  if (!input.bankOk || regs.length === 0) {
    return {
      ranAt: new Date().toISOString(),
      date: today,
      ok: false,
      error: "sin datos del banco",
      accounts: [],
      summary: { total: 0, cuadradas: 0, conHallazgos: 0, diferenciaTotal: 0 },
    }
  }

  // Emparejar banco ↔ apuntes una sola vez (greedy por cercanía de fecha).
  type Pair = { txIdx: number; entryId: string }
  const pairs: Pair[] = []
  const usedTx = new Set<number>()
  const usedEntry = new Set<string>()
  const actualEntries = (input.entries || []).filter((e) => e.status === "actual")
  const txs = input.bankTxs || []

  const entriesFor = (regId: string, isMain: boolean) =>
    actualEntries.filter((e) => (e.accountId ? e.accountId === regId : isMain))
  const txsFor = (regId: string) => txs.filter((t) => accountIdFor(String(t.bank_account || "")) === regId)

  const accounts: ReconAccountResult[] = []
  let diferenciaTotal = 0

  for (const reg of regs) {
    const findings: ReconFinding[] = []
    const push = (f: ReconFinding) => {
      if (!isDismissed(f.key, decisions)) findings.push(f)
    }
    const acctEntries = entriesFor(reg.id, reg.isMain)
    const acctTxs = txsFor(reg.id)
    const kind: ReconAccountResult["kind"] = reg.source === "manual" ? "manual" : reg.kind
    const bankBal = input.balances[reg.id] ?? null

    // 1) Diferencia: balance del banco vs último daily_balance del statement.
    if (reg.source === "snapshot") {
      const withBal = acctTxs
        .filter((t) => t.daily_balance !== null && t.daily_balance !== undefined && Number.isFinite(Number(t.daily_balance)))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      if (withBal.length > 0 && bankBal !== null && Number.isFinite(bankBal)) {
        const latest = Number(withBal[0].daily_balance)
        const diff = Math.round((bankBal - latest) * 100) / 100
        if (Math.abs(diff) > 0.01) {
          diferenciaTotal = Math.round((diferenciaTotal + Math.abs(diff)) * 100) / 100
          push({
            key: `bd:${reg.id}:${today}`,
            accountId: reg.id,
            accountName: reg.name,
            type: "diferencia",
            title: "Diferencia de balance",
            detail: `Banco ${fmt(bankBal)} · statement ${fmt(latest)} (${shortDate(withBal[0].date)}) · dif. ${fmt(diff)}`,
            severity: "warn",
            proposedAction: { kind: "revisar", label: "Revisar" },
          })
        }
      }
      // Nota: cuenta SIN movimientos del banco (tipico en ahorros) ya no genera
      // hallazgo: no hay nada que cuadrar hoy. Si el feed falla por completo,
      // bankOk=false y el reporte entero avisa "sin datos del banco"; no hace
      // falta ruido de revision cuenta por cuenta.
    }

    // Emparejar txs ↔ entries de esta cuenta (para 2 y 3).
    const localPairs: Pair[] = []
    const localUsedTx = new Set<number>()
    const localUsedEntry = new Set<string>()
    const txIdxAll = acctTxs.map((t) => txs.indexOf(t)).filter((i) => i >= 0)
    for (const e of acctEntries) {
      const need = Math.abs(Number(e.amount) || 0)
      if (need < 0.005) continue
      let best = -1
      let bestDays = 999
      for (const i of txIdxAll) {
        if (usedTx.has(i) || localUsedTx.has(i)) continue
        const t = txs[i]
        if (Math.abs(Math.abs(Number(t.amount)) - need) > AMOUNT_TOL) continue
        const d = daysBetween(String(t.date), String(e.date))
        if (d > DAY_WINDOW) continue
        if (d < bestDays) {
          bestDays = d
          best = i
        }
      }
      if (best >= 0) {
        localUsedTx.add(best)
        localUsedEntry.add(e.id)
        localPairs.push({ txIdx: best, entryId: e.id })
      }
    }
    for (const p of localPairs) {
      pairs.push(p)
      usedTx.add(p.txIdx)
      usedEntry.add(p.entryId)
    }

    // 2) Banco sin clasificar: movimientos sin apunte.
    for (const i of txIdxAll) {
      if (localUsedTx.has(i)) continue
      const t = txs[i]
      const amt = Number(t.amount) || 0
      if (Math.abs(amt) < AMOUNT_TOL) continue
      const isIn = amt > 0
      const esTransfer = looksLikeTransfer(String(t.detail || ""))
      push({
        key: `sc:${reg.id}:${txKey(t)}`,
        accountId: reg.id,
        accountName: reg.name,
        type: "sin-clasificar",
        title: esTransfer
          ? `Transfer interna${isIn ? " (llegada)" : " (salida)"}: ${t.detail || "Banco"}`
          : `Sin clasificar${isIn ? " (ingreso)" : ""}: ${t.detail || "Banco"}`,
        detail: `${fmt(amt)} · ${shortDate(t.date)}`,
        severity: "warn",
        bankTx: { date: String(t.date).slice(0, 10), detail: t.detail || "Banco", amount: amt },
        proposedAction: { kind: "crear-apunte", label: esTransfer ? "Crear apunte transfer" : "Crear apunte" },
      })
    }

    // 3) Apuntes pendientes en banco.
    for (const e of acctEntries) {
      if (localUsedEntry.has(e.id)) continue
      const amt = Number(e.amount) || 0
      if (Math.abs(amt) < 0.005) continue
      push({
        key: `pb:${e.id}`,
        accountId: reg.id,
        accountName: reg.name,
        type: "pendiente-banco",
        title: `Pendiente en banco: ${e.description || "Apunte"}`,
        detail: `${fmt(e.type === "income" ? Math.abs(amt) : -Math.abs(amt))} · ${shortDate(e.date)}`,
        severity: "info",
        entryId: e.id,
        proposedAction: { kind: "revisar", label: "Marcar revisado" },
      })
    }

    // 4) Posibles duplicados entre apuntes (misma cuenta).
    const seenDup = new Set<string>()
    const sorted = [...acctEntries].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]
        const b = sorted[j]
        if (seenDup.has(a.id) || seenDup.has(b.id)) continue
        if (Math.abs(Math.abs(Number(a.amount)) - Math.abs(Number(b.amount))) > 0.01) continue
        if (daysBetween(String(a.date), String(b.date)) > DUP_DAY_WINDOW) continue
        const na = normalizeVendorName(a.description)
        const nb = normalizeVendorName(b.description)
        if (!na || !nb || na !== nb) continue
        seenDup.add(a.id)
        seenDup.add(b.id)
        const newer = String(b.date) >= String(a.date) ? b : a
        push({
          key: `dup:${[a.id, b.id].sort().join(":")}`,
          accountId: reg.id,
          accountName: reg.name,
          type: "duplicado",
          title: "Posible duplicado",
          detail: `${a.description || "Apunte"} · ${fmt(Math.abs(Number(a.amount)))} · ${shortDate(a.date)} y ${shortDate(b.date)}`,
          severity: "warn",
          entryId: newer.id,
          proposedAction: { kind: "eliminar-duplicado", label: "Eliminar el más reciente", entryId: newer.id },
        })
      }
    }

    // 5) Transfers sin pareja en esta cuenta.
    // Un movimiento ya reportado como "Sin clasificar" no se duplica aqui:
    // se resuelve con Crear apunte, no pidiendo revision dos veces.
    const yaReportados = new Set(
      findings
        .filter((f) => f.type === "sin-clasificar" && f.bankTx)
        .map((f) => txKey({ date: f.bankTx!.date, detail: f.bankTx!.detail, amount: f.bankTx!.amount })),
    )
    const unmatched = [...input.transfers.unmatchedOut, ...input.transfers.unmatchedIn]
    for (const t of unmatched) {
      if (accountIdFor(String(t.bank_account || "")) !== reg.id) continue
      const amt = Number(t.amount) || 0
      if (yaReportados.has(txKey({ date: String(t.date), detail: String(t.detail), amount: amt }))) continue
      push({
        key: `ts:${reg.id}:${txKey({ date: String(t.date), detail: String(t.detail), amount: amt })}`,
        accountId: reg.id,
        accountName: reg.name,
        type: "transfer-sin-pareja",
        title: `Transfer sin pareja${amt < 0 ? " (salida)" : " (llegada)"}`,
        detail: `${fmt(amt)} · ${shortDate(t.date)} · ${t.detail || ""}`,
        severity: "info",
        proposedAction: { kind: "revisar", label: "Revisar" },
      })
    }

    const cuadrada = !findings.some((f) => f.severity === "warn")
    accounts.push({ accountId: reg.id, accountName: reg.name, kind, bankBalance: bankBal, findings, cuadrada })
  }

  const summary = {
    total: accounts.length,
    cuadradas: accounts.filter((a) => a.cuadrada).length,
    conHallazgos: accounts.filter((a) => a.findings.length > 0).length,
    diferenciaTotal,
  }

  return { ranAt: new Date().toISOString(), date: today, ok: true, accounts, summary }
}
