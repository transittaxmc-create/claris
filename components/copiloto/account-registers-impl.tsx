"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { cn } from "@/lib/utils"
import { money, EXPENSE_CATEGORIES, type CashFlowEntry } from "./types"
import { fmtFecha, fmtWeekday, catIcon } from "./proyeccion-shared"
import type { RegisterAccount, DueItem } from "./registers-store"
import { accountDisplayName, last4Of, accountIdFor } from "./registers-store"
import type { TransferReport } from "./transfer-matcher"
import type { ReconReport, ReconFinding } from "./reconciliation-check"
import { DineroProyeccion, useForecastInputs } from "./dinero-proyeccion"
import { ProyeccionFoto1 } from "./proyeccion-foto1"
import { ProyeccionFoto2 } from "./proyeccion-foto2"
import { buildForecast, daysToEndOfMonth, startingBalance, todayKey } from "./dinero-forecast"
import { movementCounts, bankBrandOf } from "./bank-brand"
import { MoneyAccountCard, MoneyHeader, MoneySectionTitle, MoneyStrip, MoneyTabs } from "./money-ui"
import { Plus, ArrowLeftRight } from "lucide-react"
import { PlaidConnectButton } from "./plaid-connect"
import { AccountSettings } from "./account-settings"
import {
  clearShotAudit,
  filterExtracted,
  loadShotAudits,
  loadShotTxs,
  reconcileShots,
  saveShotAudit,
  saveShotTxs,
  type ShotAudit,
  type ShotTx,
} from "./screenshot-txs"

export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
  pending?: boolean
  transaction_id?: string
  pending_transaction_id?: string | null
  /** Comentario de origen/destino (auditoría): lo escribe Miguel o la AI al reconciliar. */
  notes?: string
  /** Hora real del movimiento que reporta el banco (Plaid datetime, UTC). */
  ts?: string
}

function PendingBadge({ pending }: { pending?: boolean }) {
  if (!pending) return null
  return (
    <span className="ml-1 inline-block rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-400">
      Pending
    </span>
  )
}

/** Etiqueta de movimiento provisional de screenshot (Plan B). */
function ShotBadge() {
  return (
    <span className="ml-1 inline-block rounded bg-sky-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-sky-300">
      Screenshot
    </span>
  )
}

// Redimensiona la imagen del banco para el OCR (mismo patrón que BankAuditSheet).
async function resizeShotImage(file: File, maxDim = 1400): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("No se pudo preparar la imagen"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.85), mimeType: "image/jpeg" })
      }
      img.onerror = () => reject(new Error("No se pudo leer la imagen"))
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function RegistersHome(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  pairCount: number
  looseCount: number
  entries?: CashFlowEntry[]
  onOpenAccount: (id: string) => void
  onAddAccount: () => void
  onOpenTransfers: () => void
  onEditEntry?: (e: CashFlowEntry) => void
  reconReport?: ReconReport | null
  reconLoading?: boolean
  onRunRecon?: () => void
  onApproveFinding?: (f: ReconFinding) => void
  onRejectFinding?: (f: ReconFinding) => void
  onEditFinding?: (f: ReconFinding) => void
  onApproveAllFindings?: () => void
  bankTxs?: BankTx[]
  bankOk?: boolean
  onSyncBank?: () => void
  otherFunds?: string[]
  onToggleOtherFund?: (id: string) => void
  onMarkPaid?: (e: CashFlowEntry, paidDate: string) => void
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  onAddEntry?: (dateIso: string) => void
  onConfirmWithAdjustment?: (e: CashFlowEntry, paidDate: string, adj: number, reason: string) => void
}) {
  const { registers, balances, dues, pairCount, looseCount } = props
  const [vista, setVista] = useState(0)

  let available = 0
  let owe = 0
  for (const r of registers) {
    const bal = balances[r.id]
    if (bal === null || bal === undefined) continue
    if (r.kind === "card") owe += Math.abs(bal)
    else available += bal
  }
  available = Math.round(available * 100) / 100
  owe = Math.round(owe * 100) / 100
  const net = Math.round((available - owe) * 100) / 100

  const principal = registers.find((r) => r.isMain) || registers[0] || null
  const mainName = (() => {
    if (!principal) return "Account"
    const b = bankBrandOf(principal.name, principal.institution)
    return b.id === "generic" ? accountDisplayName(principal.name).title.replace(/\s*·+\s*\d{4}$/, "") : b.short
  })()

  const movCount = movementCounts(
    registers,
    props.bankOk ? props.bankTxs || [] : [],
    (props.entries || []) as { accountId?: string }[],
    (n) => accountIdFor(n),
  )

  const { schedules, dismissed } = useForecastInputs()
  const proyectadoMes = (() => {
    const today = todayKey()
    const inicio = startingBalance(registers, balances, props.otherFunds || [])
    return buildForecast({
      startBalance: inicio.value,
      entries: props.entries || [],
      schedules,
      dues,
      balances,
      bankTxs: props.bankOk ? props.bankTxs || [] : [],
      today,
      horizonDays: daysToEndOfMonth(today),
      dismissedPaid: dismissed,
    })
  })()

  // Uso por cuenta (para ordenar "las demás" después de las fijas):
  // movimientos de los últimos 30 días + fecha del más reciente.
  const usage = (() => {
    const map: Record<string, { recent: number; latest: string; total: number }> = {}
    for (const r of registers) map[r.id] = { recent: 0, latest: "", total: 0 }
    const corteDate = new Date(`${todayKey()}T12:00:00`)
    corteDate.setDate(corteDate.getDate() - 30)
    const corte = corteDate.toISOString().slice(0, 10)
    const mainId = registers.find((r) => r.isMain)?.id
    for (const t of props.bankOk ? props.bankTxs || [] : []) {
      const m = map[accountIdFor(String(t.bank_account || ""))]
      if (!m) continue
      const d = String(t.date || "").slice(0, 10)
      m.total += 1
      if (d >= corte) m.recent += 1
      if (d > m.latest) m.latest = d
    }
    for (const e of (props.entries || []) as { accountId?: string; date?: string }[]) {
      const id = e?.accountId ? String(e.accountId) : mainId
      const m = id ? map[id] : undefined
      if (!m) continue
      const d = String(e?.date || "").slice(0, 10)
      m.total += 1
      if (d >= corte) m.recent += 1
      if (d > m.latest) m.latest = d
    }
    return map
  })()
  // Orden de Miguel (2026-10-24): Citibank ★ primero, y fijos PayPal,
  // Uber y Lyft en ese orden — son las de uso diario. Las demás van
  // después, ordenadas por uso (últimos 30 días + recencia).
  const fixedRank = (r: RegisterAccount): number => {
    if (r.isMain) return 0
    const n = String(r.name || "").toLowerCase()
    if (n.includes("paypal")) return 1
    if (n.includes("uber")) return 2
    if (n.includes("lyft")) return 3
    return 4
  }
  const ordered = [...registers].sort((a, b) => {
    const ra = fixedRank(a)
    const rb = fixedRank(b)
    if (ra !== rb) return ra - rb
    const ua = usage[a.id] ?? { recent: 0, latest: "", total: 0 }
    const ub = usage[b.id] ?? { recent: 0, latest: "", total: 0 }
    if (ub.recent !== ua.recent) return ub.recent - ua.recent
    if (ua.latest !== ub.latest) return ub.latest.localeCompare(ua.latest)
    if (ub.total !== ua.total) return ub.total - ua.total
    return Math.abs(balances[b.id] ?? 0) - Math.abs(balances[a.id] ?? 0)
  })

  return (
    <div className="flex flex-col gap-3 overflow-x-hidden">
      <MoneyHeader page={vista as 0 | 1 | 2} onPage={setVista} />
      <MoneyTabs page={vista as 0 | 1 | 2} onPage={setVista} registerLabel={`${mainName} Register`} />
      <MoneyStrip
        cells={[
          {
            label: "REAL BANK",
            value:
              principal && balances[principal.id] != null
                ? money(balances[principal.id] as number)
                : money(available),
            tone: "plain",
            active: vista === 0,
            onClick: () => setVista(0),
          },
          {
            label: "PROJECTED MONTH",
            value: money(proyectadoMes.end),
            tone: proyectadoMes.end < 0 ? "neg" : "plain",
            active: vista === 1,
            onClick: () => setVista(1),
          },
        ]}
      />

      {vista === 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#262633] bg-[#111119] px-2 py-1.5 text-center">
            <p className="text-[10px] text-[#9a9cb0]">
              Disponible{" "}
              <span
                className={cn(
                  "font-mono font-bold tabular-nums",
                  available < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]",
                )}
              >
                {money(available)}
              </span>
            </p>
            <p className="border-x border-[#262633] text-[10px] text-[#9a9cb0]">
              Debo <span className="font-mono font-bold tabular-nums text-[#ff5d6c]">{money(owe)}</span>
            </p>
            <p className="text-[10px] text-[#9a9cb0]">
              Net{" "}
              <span
                className={cn(
                  "font-mono font-bold tabular-nums",
                  net < 0 ? "text-[#ff5d6c]" : "text-[#f2f3f7]",
                )}
              >
                {money(net)}
              </span>
            </p>
          </div>

          <div>
            <MoneySectionTitle>ACCOUNTS · {ordered.length}</MoneySectionTitle>
            <div className="grid grid-cols-2 gap-2.5 max-[360px]:grid-cols-1">
              {ordered.map((r) => (
                <MoneyAccountCard
                  key={r.id}
                  name={accountDisplayName(r.name).title}
                  rawName={r.name}
                  institution={r.institution}
                  subtitle={`${last4Of(r.name) || r.mask ? `•••• ${last4Of(r.name) || r.mask}` : r.institution || r.name} · ${r.kind === "card" ? "Credit Card" : "Checking"}`}
                  balance={balances[r.id] ?? null}
                  main={r.isMain}
                  count={movCount[r.id] ?? 0}
                  onClick={() => props.onOpenAccount(r.id)}
                  fundChecked={(props.otherFunds || []).includes(r.id)}
                  onToggleFund={
                    !r.isMain && r.kind === "bank" && (balances[r.id] ?? 0) > 0 && props.onToggleOtherFund
                      ? () => props.onToggleOtherFund?.(r.id)
                      : undefined
                  }
                />
              ))}
            </div>

            <div className="mt-2.5 space-y-2">
              <PlaidConnectButton
                onLinked={() => {
                  props.onSyncBank?.()
                }}
              />
              <button
                type="button"
                onClick={props.onAddAccount}
                className="flex w-full items-center justify-center gap-1 rounded-[14px] border border-dashed border-[#262633] p-3 text-[#9a9cb0]"
              >
                <Plus className="size-4" />
                <span className="text-[13px] font-semibold">Add account (manual)</span>
              </button>
            </div>
          </div>

          {(pairCount > 0 || looseCount > 0) && (
            <button
              type="button"
              onClick={props.onOpenTransfers}
              className="flex items-center justify-between rounded-[14px] border border-[#262633] bg-[#16161f] px-3.5 py-3 text-left active:scale-[.99]"
            >
              <span className="flex items-center gap-2 text-[13px] font-bold text-[#f2f3f7]">
                <ArrowLeftRight className="size-4 text-[#5b8cff]" /> Transferencias
              </span>
              <span className="font-mono text-[10px] font-bold text-[#9a9cb0]">
                {pairCount} matched · {looseCount} abiertas
              </span>
            </button>
          )}
        </>
      )}

      {vista === 1 && (
        <ProyeccionFoto1
          registers={registers}
          balances={balances}
          dues={dues}
          entries={props.entries || []}
          bankTxs={props.bankTxs || []}
          bankOk={props.bankOk === true}
          otherFunds={props.otherFunds || []}
        />
      )}

      {vista === 2 && (
        <ProyeccionFoto2
          registers={registers}
          balances={balances}
          dues={dues}
          entries={props.entries || []}
          bankTxs={props.bankTxs || []}
          bankOk={props.bankOk === true}
          otherFunds={props.otherFunds || []}
        />
      )}
    </div>
  )
}

function saldoColorBank(after: number, ref: number): string {
  if (after < 0) return "#ff5d6c"
  if (after >= ref) return "#2fbf71"
  return "#f5b73f"
}

function topCats(
  ls: { category: string | null; amount: number }[],
  sign: 1 | -1,
): [string, number][] {
  const m = new Map<string, number>()
  for (const l of ls) {
    if (sign === 1 && l.amount <= 0) continue
    if (sign === -1 && l.amount >= 0) continue
    const c = l.category || "Other"
    m.set(c, (m.get(c) || 0) + Math.abs(l.amount))
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
}

const BANK_HDR = "overflow-hidden whitespace-nowrap px-1 pb-1 text-left text-[10px] font-extrabold uppercase tracking-[0.01em] text-neutral-400"

/**
 * Register de UNA cuenta (pedido de Miguel 2026-10-24): arriba un encabezado
 * tipo STATEMENT (balance real + entradas/salidas del mes) y abajo el register
 * con el formato del Registro Unificado — SOLO transacciones reales del banco
 * de esa cuenta (sin proyecciones). Editable en todas las cuentas.
 */
export function RegisterDetail(props: {
  account: RegisterAccount
  balance: number | null
  entries: CashFlowEntry[]
  bankTxs: BankTx[]
  otherFunds?: unknown
  onBack: () => void
  onEditEntry?: (e: CashFlowEntry) => void
  onEditBankTx?: (t: BankTx) => void
  onDeleteEntry?: (id: string) => void
  onAddEntry?: (...args: any[]) => void
  onOpenScanner?: () => void
  onSetDocKind?: (...args: any[]) => void
  onInlineAmount?: (...args: any[]) => void
  onSetMain?: (...args: any[]) => void
  onSaveDueDay?: (...args: any[]) => void
  onSaveManualBalance?: (...args: any[]) => void
  onDeleteManual?: (...args: any[]) => void
  [key: string]: any
}) {
  const reg = props.account
  const { balance, entries, bankTxs } = props
  // Register COMPLETAMENTE editable (Miguel, 2026-10-25): cualquier
  // cuenta del banco se corrige desde aquí, no solo Citibank.
  const useBank = (bankTxs || []).length > 0

  // Pantalla ancha (computadora/monitor): la descripción se ve completa,
  // sin recorte ni tener que apretar (responsive, idea de Miguel 2026-10-24).
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Detalle por TOQUE (Miguel 2026-10-24): en el teléfono el register se
  // congestionaba, así que Categoría y Bank no ocupan columna — tocar la
  // descripción abre un cuadro con TODO el detalle (texto completo,
  // categoría y balance del banco de ese día) y se cierra con otro toque.
  // En pantalla grande se ven las 6 columnas completas, sin tocar nada.
  const [peek, setPeek] = useState<{
    key: string
    text: string
    category: string | null
    notes?: string | null
    bank: number
    date: string
    amount: number
    x: number
    y: number
    tx?: BankTx
    entry?: CashFlowEntry
    shotId?: string
  } | null>(null)

  function togglePeek(
    e: ReactMouseEvent,
    r: { key: string; detail: string; date: string; category: string | null; amount: number; tx?: BankTx; entry?: CashFlowEntry; shotId?: string },
    bankVal: number,
  ) {
    e.stopPropagation()
    if (peek && peek.key === r.key) {
      setPeek(null)
      return
    }
    setPeek({
      key: r.key,
      text: r.detail,
      category: r.category,
      notes: r.tx?.notes || r.entry?.notes || null,
      bank: bankVal,
      date: r.date,
      amount: r.amount,
      x: e.clientX,
      y: e.clientY,
      tx: r.tx,
      entry: r.entry,
      shotId: r.shotId,
    })
  }

  // ===== Plan B: provisionales de screenshot (Miguel, 2026-10-25) =====
  // Mientras Plaid no baja el movimiento real, el screenshot del banco lo
  // mantiene en el register y suma al balance mostrado. Cuando el real
  // llega, el provisional se reemplaza solo (reconcileShots).
  const [shots, setShots] = useState<ShotTx[]>([])
  const [scanBusy, setScanBusy] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    items: { date: string; description: string; amount: number; pending?: boolean; keep: boolean }[]
    balanceSeen: number | null
    last4Seen: string | null
    yaEnPlaid: number
    yaEscaneados: number
  } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [audits, setAudits] = useState<Record<string, ShotAudit>>({})

  useEffect(() => {
    setShots(loadShotTxs())
    setAudits(loadShotAudits())
  }, [])

  // Reemplazo automático: si un real de Plaid ya empareja un provisional
  // de ESTA cuenta, el provisional sale y queda solo el real.
  useEffect(() => {
    if (!useBank || shots.length === 0) return
    const { kept, replaced } = reconcileShots(shots, reg.id, bankTxs || [])
    if (replaced > 0) {
      setShots(kept)
      saveShotTxs(kept)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankTxs, shots])

  const myShots = useMemo(() => shots.filter((s) => s.accountId === reg.id), [shots, reg.id])
  const shotSum = useMemo(() => Math.round(myShots.reduce((s, x) => s + x.amount, 0) * 100) / 100, [myShots])

  const removeShot = (id: string) => {
    const next = shots.filter((s) => s.id !== id)
    setShots(next)
    saveShotTxs(next)
    setPeek(null)
  }

  const handleScanFile = async (file: File) => {
    setScanBusy(true)
    setScanMsg("Leyendo el screenshot…")
    setPreview(null)
    try {
      const { base64, mimeType } = await resizeShotImage(file)
      const res = await fetch("/api/scan-bank-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType, today: todayKey() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setScanMsg(`⚠️ ${json.error || "No se pudo leer el screenshot."}`)
        return
      }
      const extracted = (json.transactions || []) as { date: string; description: string; amount: number; pending?: boolean }[]
      if (extracted.length === 0) {
        setScanMsg("No se vieron movimientos en esa foto.")
        return
      }
      const { fresh, yaEnPlaid, yaEscaneados } = filterExtracted(extracted, bankTxs || [], myShots)
      if (fresh.length === 0) {
        setScanMsg(`Todo lo de la foto ya está en el register (${yaEnPlaid} por Plaid, ${yaEscaneados} escaneados). Nada duplicado.`)
        return
      }
      setPreview({
        items: fresh.map((t) => ({ ...t, keep: true })),
        balanceSeen: typeof json.balance === "number" ? json.balance : null,
        last4Seen: json.accountLast4 || null,
        yaEnPlaid,
        yaEscaneados,
      })
      setScanMsg(null)
    } catch {
      setScanMsg("⚠️ No se pudo leer el screenshot. Intenta con una foto más clara.")
    } finally {
      setScanBusy(false)
    }
  }

  const savePreview = () => {
    if (!preview) return
    const chosen = preview.items.filter((i) => i.keep)
    if (chosen.length === 0) {
      setPreview(null)
      return
    }
    const now = new Date().toISOString()
    const nuevos: ShotTx[] = chosen.map((t, i) => ({
      id: `shot-${Date.now()}-${i}`,
      accountId: reg.id,
      date: t.date,
      detail: t.description,
      amount: Math.round(t.amount * 100) / 100,
      createdAt: now,
    }))
    const next = [...nuevos, ...shots]
    setShots(next)
    saveShotTxs(next)
    // Auditoría del screenshot (protocolo de Miguel): el balance de la
    // foto es el real; se guarda contra el de la app y la DIFERENCIA
    // queda escrita en la nota del register hasta que cuadre al centavo.
    if (preview.balanceSeen != null && typeof balance === "number") {
      const chosenSum = Math.round(chosen.reduce((s, t) => s + t.amount, 0) * 100) / 100
      // balNow YA incluye los provisionales vigentes (balance calculado);
      // el de Plaid solo = balNow − provisionales.
      const efectivo = Math.round((balNow + chosenSum) * 100) / 100
      setAudits(
        saveShotAudit({
          accountId: reg.id,
          date: todayKey(),
          shotBalance: preview.balanceSeen,
          plaidBalance: Math.round((balNow - shotSum) * 100) / 100,
          shotsTotal: Math.round((shotSum + chosenSum) * 100) / 100,
          diff: Math.round((preview.balanceSeen - efectivo) * 100) / 100,
        }),
      )
    }
    setPreview(null)
    setScanMsg(`${nuevos.length} provisionales guardados. Cuando Plaid los baje, se reemplazan solos.`)
  }

  const lines = useMemo(() => {
    const out: {
      key: string
      date: string
      detail: string
      category: string | null
      amount: number
      pending?: boolean
      tx?: BankTx
      entry?: CashFlowEntry
      shotId?: string
    }[] = []
    if (useBank) {
      for (const t of bankTxs || []) {
        out.push({
          key: `bank-${t.transaction_id || t.date + t.detail + t.amount}`,
          date: String(t.date || "").slice(0, 10),
          detail: t.detail || "Bank",
          category: t.category,
          amount: Number(t.amount) || 0,
          pending: Boolean(t.pending),
          tx: t,
        })
      }
      // Provisionales de screenshot (Plan B): se mezclan en el register
      // con su etiqueta; salen solos cuando Plaid baja el real.
      for (const s of myShots) {
        out.push({
          key: `shot-${s.id}`,
          date: s.date,
          detail: s.detail,
          category: "Screenshot",
          amount: s.amount,
          pending: true,
          shotId: s.id,
        })
      }
    } else {
      for (const e of entries || []) {
        const amt = Math.abs(Number(e.amount) || 0)
        out.push({
          key: `entry-${e.id}`,
          date: String(e.date || "").slice(0, 10),
          detail: e.description || e.category || "Entry",
          category: e.category || null,
          amount: e.type === "income" ? amt : -amt,
          entry: e,
        })
      }
    }
    // Orden de la lista: lo más nuevo arriba. Dentro del MISMO día mandan
    // dos reglas (pasadas estables, de menor a mayor peso): (1) la hora real
    // que reporta el banco (Plaid `datetime` → `ts`) y (2) el flujo del
    // dinero: en la vista, las SALIDAS van arriba de las ENTRADAS del día,
    // porque el dinero que entra fondea el que sale (Lyft → PayPal →
    // Citibank). Sin esto, al caminar hacia atrás desde el balance real la
    // app inventaba saldos negativos que el banco nunca tuvo — PayPal jamás
    // estuvo negativa; lo que faltaba era la hora, no un movimiento
    // (auditoría desde el origen, Miguel 2026-10-25).
    out.sort((a, b) => String(b.key).localeCompare(String(a.key)))
    out.sort((a, b) => String(b.tx?.ts || "").localeCompare(String(a.tx?.ts || "")))
    out.sort((a, b) => (a.amount < 0 ? 0 : 1) - (b.amount < 0 ? 0 : 1))
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    return out
  }, [bankTxs, entries, useBank, myShots])

  // Saldo corriendo: se camina hacia atrás desde el balance actual, que
  // YA viene calculado (Plaid + provisionales vigentes de screenshot —
  // ver balances en cash-flow-register). Aquí no se suma nada más: el
  // número es uno solo en toda la app.
  const balNow = typeof balance === "number" ? balance : 0
  let run = balNow
  const rows = lines.map((l) => {
    const after = run
    const before = run - l.amount
    run = before
    return { ...l, after, before }
  })
  const bankByDate = new Map<string, number>()
  for (const r of rows) {
    if (!bankByDate.has(r.date)) bankByDate.set(r.date, r.after)
  }

  const today = todayKey()
  const monthPrefix = today.slice(0, 7)
  const monthLines = lines.filter((l) => l.date.startsWith(monthPrefix))
  const inMonth = monthLines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)
  const outMonth = monthLines.filter((l) => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0)
  const monthLabel = fmtFecha(`${monthPrefix}-01`).split(" ")[0] || ""

  const disp = accountDisplayName(reg.name)
  const myAudit = audits[reg.id]

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={props.onBack} className="self-start text-[12px] font-bold text-[#5b8cff]">
        ← Accounts
      </button>

      {/* ===== Encabezado tipo STATEMENT ===== */}
      <div className="rounded-2xl border border-[#262633] bg-[#111119] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold uppercase tracking-wide text-neutral-100">{disp.title}</p>
            {disp.subtitle && <p className="truncate text-[10px] text-neutral-500">{disp.subtitle}</p>}
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-neutral-500">
              Statement · {monthLabel} {monthPrefix.slice(0, 4)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Balance</p>
            <p
              className={cn(
                "font-mono text-[22px] font-bold tabular-nums",
                (balance ?? 0) < 0 ? "text-[#ff5d6c]" : "text-[#f2f3f7]",
              )}
            >
              {balance == null ? "—" : money(balance)}
            </p>
            {useBank && myShots.length > 0 && balance != null && (
              <p className="mt-0.5 text-[10px] font-semibold text-sky-300">
                Calculado con {myShots.length} provisional{myShots.length === 1 ? "" : "es"} de screenshot
                {myAudit ? ` · Plaid: ${money(myAudit.plaidBalance)}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[#262633] pt-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Entradas</p>
            <p className="font-mono text-[14px] font-semibold tabular-nums text-[#2fbf71]">+{money(inMonth).replace("-", "")}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Salidas</p>
            <p className="font-mono text-[14px] font-semibold tabular-nums text-[#ff5d6c]">-{money(outMonth).replace("-", "")}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase leading-tight tracking-widest text-neutral-500">
              Bank · Actual Balance
            </p>
            <p
              className="font-mono text-[14px] font-semibold tabular-nums"
              style={{
                color: myAudit
                  ? Math.abs(myAudit.diff) <= 0.005
                    ? "#2fbf71"
                    : "#f5b73f"
                  : "#f2f3f7",
              }}
            >
              {myAudit ? money(myAudit.shotBalance) : balance == null ? "—" : money(balance)}
            </p>
            <p className="text-[9px] leading-tight text-neutral-500">
              {myAudit ? `Foto · ${fmtFecha(myAudit.date)}` : "Según Plaid"}
            </p>
          </div>
        </div>
      </div>

      {/* ===== Ajustes de la cuenta (saldo manual editable, etc.) ===== */}
      <AccountSettings
        account={reg}
        balance={balance}
        otherFunds={(props.otherFunds as any) || []}
        onToggleOtherFund={props.onToggleOtherFund ?? (() => {})}
        onSetMain={props.onSetMain ?? (() => {})}
        onSaveDueDay={props.onSaveDueDay ?? (() => {})}
        onSaveManualBalance={props.onSaveManualBalance ?? (() => {})}
        onDeleteManual={props.onDeleteManual ?? (() => {})}
      />

      {/* ===== Plan B: escanear screenshot del banco ===== */}
      {useBank && (
        <div className="rounded-2xl border border-[#262633] bg-[#111119] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-neutral-100">¿Plaid va atrasado?</p>
              <p className="text-[10.5px] leading-snug text-neutral-400">
                Escanea el screenshot de tu banco: los movimientos entran provisionales y el balance se actualiza ya.
                Cuando Plaid los baje, se reemplazan solos, sin duplicados.
              </p>
            </div>
            <button
              type="button"
              disabled={scanBusy}
              onClick={() => fileRef.current?.click()}
              className="shrink-0 rounded-xl bg-sky-600 px-3 py-2 text-[12px] font-extrabold text-white active:scale-95 disabled:opacity-50"
            >
              {scanBusy ? "Leyendo…" : "📷 Escanear"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) void handleScanFile(f)
              }}
            />
          </div>
          {scanMsg && <p className="mt-2 text-[11.5px] leading-snug text-neutral-300">{scanMsg}</p>}
          {myAudit && (
            <div
              className="mt-2 rounded-xl border p-2.5"
              style={{
                borderColor: Math.abs(myAudit.diff) <= 0.005 ? "#14532d" : "#7c2d12",
                background: Math.abs(myAudit.diff) <= 0.005 ? "rgba(47,191,113,.07)" : "rgba(245,183,63,.07)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Nota de auditoría · screenshot {fmtFecha(myAudit.date)}
                </p>
                <button
                  type="button"
                  aria-label="Quitar nota"
                  onClick={() => setAudits(clearShotAudit(reg.id))}
                  className="-mr-1 -mt-1 px-1 text-[13px] leading-none text-neutral-500"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-300">
                Banco (foto): <span className="font-mono font-semibold text-neutral-100">{money(myAudit.shotBalance)}</span>
                {" · "}App (Plaid {money(myAudit.plaidBalance)} + provisionales {money(myAudit.shotsTotal)}):{" "}
                <span className="font-mono font-semibold text-neutral-100">
                  {money(Math.round((myAudit.plaidBalance + myAudit.shotsTotal) * 100) / 100)}
                </span>
              </p>
              {Math.abs(myAudit.diff) <= 0.005 ? (
                <p className="mt-0.5 text-[11.5px] font-bold text-[#2fbf71]">Diferencia: $0.00 — cuadra al centavo ✓</p>
              ) : (
                <p className="mt-0.5 text-[11.5px] font-bold text-[#f5b73f]">
                  Diferencia por explicar: {myAudit.diff < 0 ? "-$" : "$"}
                  {Math.abs(myAudit.diff).toFixed(2)} — es lo que falta por encontrar entre el banco y Plaid.
                </p>
              )}
            </div>
          )}
          {preview && (
            <div className="mt-2 border-t border-[#262633] pt-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                Nuevos en la foto · {preview.items.filter((i) => i.keep).length} de {preview.items.length}
              </p>
              {preview.balanceSeen != null && (
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  La foto dice balance: <span className="font-mono text-neutral-200">{money(preview.balanceSeen)}</span>
                  {balance != null && (
                    <>
                      {" "}· Con estos:{" "}
                      <span className="font-mono text-sky-300">
                        {money(balNow + preview.items.filter((i) => i.keep).reduce((s, i) => s + i.amount, 0))}
                      </span>
                      {(() => {
                        const d =
                          Math.round(
                            (preview.balanceSeen -
                              (balNow + preview.items.filter((i) => i.keep).reduce((s, i) => s + i.amount, 0))) *
                              100,
                          ) / 100
                        return Math.abs(d) <= 0.005 ? (
                          <span className="font-bold text-[#2fbf71]"> · Diferencia: $0.00 ✓</span>
                        ) : (
                          <span className="font-bold text-[#f5b73f]">
                            {" "}· Diferencia: {d < 0 ? "-$" : "$"}
                            {Math.abs(d).toFixed(2)} por explicar
                          </span>
                        )
                      })()}
                    </>
                  )}
                </p>
              )}
              {preview.last4Seen && last4Of(reg.name) && preview.last4Seen !== last4Of(reg.name) && (
                <p className="mt-0.5 text-[11px] font-semibold text-amber-400">
                  Ojo: la foto parece de la cuenta ·{preview.last4Seen} y este register es ·{last4Of(reg.name)}.
                </p>
              )}
              {(preview.yaEnPlaid > 0 || preview.yaEscaneados > 0) && (
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Se saltaron {preview.yaEnPlaid + preview.yaEscaneados} que ya están en el register (no se duplican).
                </p>
              )}
              {preview.items.map((it, idx) => (
                <label key={idx} className="flex cursor-pointer items-center justify-between gap-2 border-t border-[#1a1c24] py-1.5 text-[12px] text-neutral-200">
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={it.keep}
                      onChange={(e) =>
                        setPreview((p) =>
                          p ? { ...p, items: p.items.map((x, i) => (i === idx ? { ...x, keep: e.target.checked } : x)) } : p,
                        )
                      }
                      className="size-4 shrink-0 accent-sky-500"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it.description}</span>
                      <span className="block text-[10px] text-neutral-500">
                        {fmtFecha(it.date)}{it.pending ? " · Pending" : ""}
                      </span>
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-mono tabular-nums", it.amount < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]")}>
                    {it.amount < 0 ? "-" : "+"}${Math.abs(it.amount).toFixed(2)}
                  </span>
                </label>
              ))}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={savePreview}
                  className="flex-1 rounded-lg bg-[#2fbf71] py-2 text-[12px] font-extrabold text-black active:scale-[.99]"
                >
                  Guardar provisionales
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="flex-1 rounded-lg border border-[#262633] py-2 text-[12px] font-bold text-neutral-300 active:scale-[.99]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Register (formato del Registro Unificado) ===== */}
      <div>
        {wide ? (
          <div className="flex px-0.5">
            <span className={BANK_HDR} style={{ width: "14%" }}>Fecha</span>
            <span className={BANK_HDR} style={{ width: "19%" }}>Descripción</span>
            <span className={BANK_HDR} style={{ width: "16%" }}>Categoría</span>
            <span className={BANK_HDR} style={{ width: "13%" }}>Bank</span>
            <span className={BANK_HDR} style={{ width: "17%" }}>Monto</span>
            <span className={BANK_HDR} style={{ width: "21%" }}>Saldo</span>
          </div>
        ) : (
          <div className="flex px-0.5">
            <span className={BANK_HDR} style={{ width: "15%" }}>Fecha</span>
            <span className={BANK_HDR} style={{ width: "33%" }}>Descripción</span>
            <span className={BANK_HDR} style={{ width: "22%" }}>Monto</span>
            <span className={BANK_HDR} style={{ width: "30%" }}>Saldo</span>
          </div>
        )}
        <div
          style={{
            maxHeight: "52vh",
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
          }}
        >
          {rows.slice(0, 200).map((r) => {
            const editable = r.tx ? !!props.onEditBankTx : !!r.entry && !!props.onEditEntry
            const bankVal = bankByDate.get(r.date) ?? r.after
            return (
              <div
                key={r.key}
                onClick={
                  wide && editable
                    ? () => {
                        if (r.tx) props.onEditBankTx?.(r.tx as BankTx)
                        else props.onEditEntry?.(r.entry as CashFlowEntry)
                      }
                    : undefined
                }
                style={wide && editable ? { cursor: "pointer" } : undefined}
                className="flex w-full items-start border-b border-[#1d1d28] px-0.5 py-2 text-left"
              >
                <span style={{ width: wide ? "14%" : "15%" }} className="pr-1">
                  <span className="block whitespace-nowrap text-[12px] font-bold uppercase leading-tight text-neutral-100">{fmtFecha(r.date)}</span>
                  <span className="block text-[9px] leading-tight text-neutral-500">{fmtWeekday(r.date)}</span>
                </span>
                <span
                  style={{ width: wide ? "19%" : "33%" }}
                  className="min-w-0 cursor-pointer overflow-hidden pr-1"
                  onClick={wide && !r.shotId ? undefined : (e) => togglePeek(e, r, bankVal)}
                >
                  <span
                    className="block break-words text-[12px] font-medium leading-tight text-neutral-100"
                    style={
                      wide
                        ? undefined
                        : {
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }
                    }
                  >
                    {r.detail}
                  </span>
                  {r.shotId ? <ShotBadge /> : <PendingBadge pending={r.pending} />}
                </span>
                {wide && (
                  <span style={{ width: "16%" }} className="min-w-0 overflow-hidden pr-1">
                    <span className="flex items-start gap-1">
                      <span className="inline-block w-[19px] shrink-0 text-center text-[13px] leading-tight">{catIcon(r.category, r.detail)}</span>
                      <span className="truncate text-[11px] leading-tight text-neutral-300 md:whitespace-normal md:break-words">{r.category || "—"}</span>
                    </span>
                  </span>
                )}
                {wide && (
                  <span
                    style={{ width: "13%" }}
                    className="whitespace-nowrap pr-1 pt-px font-mono text-[12.5px] font-medium tabular-nums text-neutral-200"
                  >
                    {money(bankVal)}
                  </span>
                )}
                <span
                  style={{ width: wide ? "17%" : "22%" }}
                  className={cn(
                    "whitespace-nowrap pr-1 pt-px font-mono text-[13.5px] font-medium tabular-nums",
                    r.amount < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]",
                  )}
                >
                  {r.amount < 0 ? "-" : "+"}${Math.abs(r.amount).toFixed(2)}
                </span>
                <span style={{ width: wide ? "21%" : "30%" }} className="whitespace-nowrap pt-px text-right font-mono tabular-nums">
                  <span className="block text-[11px] leading-tight text-neutral-500">
                    {r.before < 0 ? "-$" : "$"}{Math.abs(r.before).toFixed(2)}
                  </span>
                  <span
                    className="block text-[13.5px] font-medium leading-tight"
                    style={{ color: saldoColorBank(r.after, balNow) }}
                  >
                    → {r.after < 0 ? "-$" : "$"}{Math.abs(r.after).toFixed(2)}
                  </span>
                </span>
              </div>
            )
          })}
          {rows.length === 0 && (
            <p className="px-1 py-3 text-[12px] text-neutral-500">
              {useBank ? "Sin movimientos del banco todavía." : "No movements yet. Press SYNC."}
            </p>
          )}
        </div>
        {peek && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPeek(null)} />
            <div
              className="fixed z-50 w-[272px] max-w-[calc(100vw-16px)] rounded-xl border border-[#3a3a52] bg-[#1d1d2b] p-3 shadow-2xl"
              style={{
                left: Math.max(8, Math.min(peek.x - 24, (typeof window !== "undefined" ? window.innerWidth : 360) - 288)),
                top:
                  peek.y > (typeof window !== "undefined" ? window.innerHeight : 640) - 260
                    ? Math.max(8, peek.y - 228)
                    : peek.y + 16,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                  {fmtFecha(peek.date)} · {fmtWeekday(peek.date)}
                </p>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setPeek(null)}
                  className="-mr-1 -mt-1 px-1 text-[13px] leading-none text-neutral-400"
                >
                  ✕
                </button>
              </div>
              <p className="mt-0.5 break-words text-[12.5px] font-semibold leading-snug text-neutral-50">{peek.text}</p>
              <div className="mt-2 space-y-1 border-t border-[#2c2c40] pt-2 text-[11.5px]">
                <p className="flex items-center justify-between">
                  <span className="text-neutral-500">Categoría</span>
                  <span className="flex items-center gap-1 font-medium text-neutral-200">
                    <span className="inline-block w-[19px] text-center">{catIcon(peek.category, peek.text)}</span>
                    {peek.category || "—"}
                  </span>
                </p>
                {peek.notes ? (
                  <p className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-neutral-500">Comentario</span>
                    <span className="text-right font-medium text-neutral-200">{peek.notes}</span>
                  </p>
                ) : null}
                <p className="flex items-center justify-between">
                  <span className="text-neutral-500">Bank (ese día)</span>
                  <span className="font-mono font-medium tabular-nums text-neutral-200">{money(peek.bank)}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-neutral-500">Monto</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      peek.amount < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]",
                    )}
                  >
                    {peek.amount < 0 ? "-" : "+"}${Math.abs(peek.amount).toFixed(2)}
                  </span>
                </p>
              </div>
              {((peek.tx && props.onEditBankTx) || (peek.entry && props.onEditEntry)) && (
                <button
                  type="button"
                  onClick={() => {
                    const p = peek
                    setPeek(null)
                    if (p.tx) props.onEditBankTx?.(p.tx as BankTx)
                    else if (p.entry) props.onEditEntry?.(p.entry as CashFlowEntry)
                  }}
                  className="mt-2.5 w-full rounded-lg bg-[#26263a] py-1.5 text-[12px] font-bold text-[#5b8cff]"
                >
                  Editar
                </button>
              )}
              {peek.shotId && (
                <>
                  <p className="mt-2 border-t border-[#2c2c40] pt-2 text-[11px] leading-snug text-sky-300">
                    Provisional de screenshot — se reemplaza solo cuando Plaid baje el movimiento real.
                  </p>
                  <button
                    type="button"
                    onClick={() => removeShot(peek.shotId as string)}
                    className="mt-2 w-full rounded-lg bg-[#3a1d24] py-1.5 text-[12px] font-bold text-[#ff5d6c]"
                  >
                    Quitar provisional
                  </button>
                </>
              )}
            </div>
          </>
        )}
        <div className="mt-1 flex items-center justify-between bg-[#1b1b26] px-2 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Hoy, {fmtFecha(today)} - Saldo actual
          </span>
          <span className="font-mono text-[11px] font-bold tabular-nums text-neutral-100">
            {balance == null ? "—" : money(balance)}
          </span>
        </div>
        {rows.length > 200 && (
          <p className="px-1 pt-1 text-[10px] text-neutral-600">Mostrando los 200 movimientos más recientes de {rows.length}.</p>
        )}
      </div>

      {/* ===== Desglose del mes (transacciones reales) ===== */}
      {monthLines.length > 0 && (
        <div>
          <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            Desglose · {monthLabel}
          </p>
          <div className="rounded-2xl border border-[#262633] bg-[#111119] p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="pb-1 text-[9px] font-bold uppercase tracking-widest text-neutral-500">Entradas por categoría</p>
                {topCats(monthLines, 1).map(([c, v]) => (
                  <div key={c} className="flex items-center justify-between py-0.5">
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-neutral-300">
                      <span className="inline-block w-[19px] shrink-0 text-center">{catIcon(c, "")}</span>
                      <span className="truncate">{c}</span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-[#2fbf71]">+${v.toFixed(2)}</span>
                  </div>
                ))}
                {topCats(monthLines, 1).length === 0 && <p className="text-[11px] text-neutral-600">—</p>}
              </div>
              <div>
                <p className="pb-1 text-[9px] font-bold uppercase tracking-widest text-neutral-500">Salidas por categoría</p>
                {topCats(monthLines, -1).map(([c, v]) => (
                  <div key={c} className="flex items-center justify-between py-0.5">
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-neutral-300">
                      <span className="inline-block w-[19px] shrink-0 text-center">{catIcon(c, "")}</span>
                      <span className="truncate">{c}</span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-[#ff5d6c]">-${v.toFixed(2)}</span>
                  </div>
                ))}
                {topCats(monthLines, -1).length === 0 && <p className="text-[11px] text-neutral-600">—</p>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#262633] pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Flujo neto del mes</span>
              <span
                className={cn(
                  "font-mono text-[14px] font-bold tabular-nums",
                  inMonth - outMonth < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]",
                )}
              >
                {inMonth - outMonth < 0 ? "-$" : "+$"}{Math.abs(inMonth - outMonth).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Edición de una transacción bancaria de Citibank (página formal, mismo
 * diseño que la de Proyecciones). Guarda vía /api/bank/edit-tx en Supabase.
 */
export function BankTxEdit(props: {
  tx: BankTx
  onBack: () => void
  onSaved: () => void
}) {
  const tx = props.tx
  const [tipo, setTipo] = useState<"gasto" | "ingreso">(tx.amount >= 0 ? "ingreso" : "gasto")
  const [desc, setDesc] = useState(tx.detail || "")
  const [cat, setCat] = useState(tx.category || "")
  const [monto, setMonto] = useState(String(Math.abs(tx.amount || 0)))
  const [fecha, setFecha] = useState(String(tx.date || "").slice(0, 10))
  const [confirmDel, setConfirmDel] = useState(false)
  const [nota, setNota] = useState(tx.notes || "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const inputCls =
    "w-full rounded-xl border border-[#2c2c3e] bg-[#17171f] px-3 py-2.5 text-[14px] text-neutral-100 outline-none focus:border-[#5b8cff]"
  const labelCls = "mb-1 block text-[10px] font-bold uppercase tracking-widest text-neutral-500"

  async function guardar() {
    const amt = parseFloat(monto.replace(/[^0-9.]/g, ""))
    if (!desc.trim()) return setErr("Falta la descripción.")
    if (!amt || amt <= 0) return setErr("Falta el monto.")
    if (!fecha) return setErr("Falta la fecha.")
    setSaving(true)
    setErr("")
    try {
      const r = await fetch("/api/bank/edit-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: tx.transaction_id,
          description: desc.trim(),
          category: cat.trim() || (tipo === "ingreso" ? "Income" : "Other"),
          notes: nota.trim(),
          amount: tipo === "ingreso" ? amt : -amt,
          date: fecha,
        }),
      })
      if (!r.ok) throw new Error("save failed")
      props.onSaved()
    } catch {
      setErr("No se pudo guardar. Intenta de nuevo.")
      setSaving(false)
    }
  }

  async function eliminar() {
    if (!confirmDel) return setConfirmDel(true)
    setSaving(true)
    try {
      const r = await fetch("/api/bank/edit-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: tx.transaction_id, delete: true }),
      })
      if (!r.ok) throw new Error("delete failed")
      props.onSaved()
    } catch {
      setErr("No se pudo eliminar. Intenta de nuevo.")
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={props.onBack} className="self-start text-[12px] font-bold text-[#5b8cff]">
        ← Register
      </button>
      <p className="text-[15px] font-extrabold uppercase tracking-wide text-neutral-100">Editar transacción</p>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#2c2c3e] bg-[#17171f] p-1">
        {(["gasto", "ingreso"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={cn(
              "rounded-lg py-2 text-[13px] font-bold",
              tipo === t
                ? t === "gasto"
                  ? "bg-[#ff5d6c] text-white"
                  : "bg-[#2fbf71] text-white"
                : "text-neutral-400",
            )}
          >
            {t === "gasto" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <div>
        <label className={labelCls}>Descripción</label>
        <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Nombre / detalle" />
      </div>

      {tipo === "gasto" && (
        <div>
          <label className={labelCls}>Categoría</label>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-2.5 py-1.5 text-[11px] font-semibold",
                  cat === c
                    ? "border-[#5b8cff] bg-[#5b8cff]/15 text-neutral-50"
                    : "border-[#2c2c3e] bg-[#17171f] text-neutral-400",
                )}
              >
                {catIcon(c, "")} {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {tipo === "ingreso" && (
        <div>
          <label className={labelCls}>Categoría</label>
          <input className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Income" />
        </div>
      )}

      <div>
        <label className={labelCls}>Comentario · origen / destino</label>
        <textarea
          className={inputCls}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Ej.: Origen: Lyft → PayPal · Transferencia PayPal → Citibank"
        />
      </div>

      <div>
        <label className={labelCls}>Monto</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-neutral-500">$</span>
          <input
            className={cn(inputCls, "pl-7 font-mono text-[16px] font-bold tabular-nums")}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Fecha</label>
        <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        {fecha && <p className="mt-1 text-[11px] text-neutral-500">{fmtWeekday(fecha)}</p>}
      </div>

      {err && <p className="text-[12px] font-semibold text-[#ff5d6c]">{err}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={guardar}
        className="mt-1 rounded-xl bg-[#2fbf71] py-3 text-[14px] font-extrabold uppercase tracking-wide text-white disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={eliminar}
        className={cn(
          "rounded-xl border py-2.5 text-[12px] font-bold uppercase tracking-wide disabled:opacity-50",
          confirmDel ? "border-[#ff5d6c] bg-[#ff5d6c] text-white" : "border-[#2c2c3e] text-[#ff5d6c]",
        )}
      >
        {confirmDel ? "¿Seguro? Toca otra vez para eliminar" : "Eliminar"}
      </button>
    </div>
  )
}

export function AddAccountModal(props: {
  onClose: () => void
  onSave: (input: {
    name: string
    kind: "bank" | "card"
    limit?: number | null
    dueDay?: number | null
    balance?: number | null
  }) => void
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"bank" | "card">("bank")
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3">
      <div className="w-full max-w-md rounded-2xl border border-[#262633] bg-[#111119] p-4">
        <p className="mb-3 text-[14px] font-bold text-[#f2f3f7]">Add account</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="mb-2 w-full rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2 text-[13px] text-[#f2f3f7]"
        />
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setKind("bank")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-bold",
              kind === "bank" ? "bg-[#5b8cff] text-white" : "bg-[#262633] text-neutral-400",
            )}
          >
            Bank
          </button>
          <button
            type="button"
            onClick={() => setKind("card")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-bold",
              kind === "card" ? "bg-[#5b8cff] text-white" : "bg-[#262633] text-neutral-400",
            )}
          >
            Card
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="flex-1 rounded-xl border border-[#262633] py-2 text-[13px] font-bold text-neutral-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return
              props.onSave({ name: name.trim(), kind })
              setName("")
            }}
            className="flex-1 rounded-xl bg-[#5b8cff] py-2 text-[13px] font-bold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function TransfersReport(props: {
  report: TransferReport
  onBack: () => void
}) {
  const pairs = props.report?.pairs || []
  const open = (props.report?.unmatchedOut?.length || 0) + (props.report?.unmatchedIn?.length || 0)
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={props.onBack} className="self-start text-[12px] font-bold text-[#5b8cff]">
        ← Back
      </button>
      <p className="text-[14px] font-bold text-[#f2f3f7]">Transferencias</p>
      <p className="text-[12px] text-neutral-400">
        {pairs.length} matched · {open} open
      </p>
      <div className="space-y-1">
        {pairs.slice(0, 50).map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2 text-[12px] text-neutral-200"
          >
            <p className="font-bold">{money(p.amount)}</p>
            <p className="text-[11px] text-neutral-400">{p.originLabel}</p>
            <p className="font-mono text-[10px] text-neutral-500">
              {p.outDate} → {p.inDate}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
