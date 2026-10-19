"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Camera,
  Check,
  Pencil,
  Plus,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry, type CashFlowOrigin } from "./types"
import {
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  origenDe,
  tipoDocDe,
} from "./cash-flow-store"
import {
  type RegisterAccount,
  type DueItem,
  accountDisplayName,
  accountIdFor,
  last4Of,
} from "./registers-store"
import type { TransferReport } from "./transfer-matcher"
import type { ReconReport, ReconFinding } from "./reconciliation-check"
import { DineroProyeccion, useForecastInputs } from "./dinero-proyeccion"
import { buildForecast, daysToEndOfMonth, startingBalance, todayKey } from "./dinero-forecast"
import { movementCounts } from "./bank-brand"
import { BankLogo, MoneyAccountCard, MoneyHeader, MoneySectionTitle, MoneyStrip, MoneyTabs } from "./money-ui"
import { bankBrandOf } from "./bank-brand"

export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
}

function shortDate(iso: string): string {
  if (!iso || iso.length < 10) return "—"
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso.slice(5)
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" })
  } catch {
    return iso.slice(5)
  }
}

// Dos etiquetas por movimiento: ORIGEN (Escaneado / Manual / Banco / Cobros /
// Square) y TIPO (Factura = por pagar, Recibo = ya pagado).
// Un solo indicador sutil por movimiento (sin iconos): tipo de documento
// (Factura/Recibo) o, si no aplica, el origen cuando no es manual.
function EntryTag({ entry }: { entry: CashFlowEntry }) {
  const tipo = tipoDocDe(entry)
  const origin: CashFlowOrigin = origenDe(entry)
  let label: string | null = null
  let cls = "text-neutral-500"
  if (tipo === "factura") {
    label = ETIQUETA_TIPO.factura
    cls = "text-cyan-500/80"
  } else if (tipo === "recibo") {
    label = ETIQUETA_TIPO.recibo
    cls = "text-purple-400/80"
  } else if (origin !== "manual") {
    label = entry.origin === "trip" && entry.sourceLabel ? entry.sourceLabel : ETIQUETA_ORIGEN[origin]
  }
  if (!label) return null
  return <span className={cn("mt-0.5 block truncate text-[9px] font-medium", cls)}>{label}</span>
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
  /** Cuentas marcadas como "otros fondos" (suman al balance inicial del proyectado). */
  otherFunds?: string[]
  /** "Probablemente pagado" confirmado: el movimiento pasa a real. */
  onMarkPaid?: (e: CashFlowEntry, paidDate: string) => void
  /** Edición inline en el registro proyectado (monto/fecha/descripción). */
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  /** Día vacío del registro proyectado → alta de asiento con esa fecha. */
  onAddEntry?: (dateIso: string) => void
}) {
  const { registers, balances, dues, pairCount, looseCount } = props
  // Vista: 0 = Real (Reyes + balances DAILY), 1 = Proyectado. Swipe izq/der.
  const [vista, setVista] = useState(0)
  // Al abrir Proyectado, sincronizar el banco primero para que el balance
  // real esté fresco (la fórmula lo exige).
  useEffect(() => {
    if (vista === 1) props.onSyncBank?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista])
  // Swipe detection
  const touchX = useRef<number | null>(null)
  const [verTodos, setVerBalancesTodos] = useState(false)
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 48) return
    if (dx < 0 && vista === 0) setVista(1)
    else if (dx > 0 && vista === 1) setVista(0)
  }
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

  // Dashboard: principal primero, luego por movimiento reciente. Sin
  // movimiento en 30 days → se oculta del grid (el balance sigue contando
  // en Disponible/Debo/Net). Si el banco no cargó, no se oculta nada.
  const INACT_MS = 30 * 86400000
  const inactCutoff = Date.now() - INACT_MS
  const lastMove = new Map<string, number>()
  const bumpMove = (id: string, iso: unknown) => {
    const d = String(iso || "").slice(0, 10)
    if (!d || !id) return
    const ts = new Date(`${d}T12:00:00`).getTime()
    if (!Number.isFinite(ts)) return
    const prev = lastMove.get(id)
    if (prev === undefined || ts > prev) lastMove.set(id, ts)
  }
  if (props.bankOk) {
    for (const t of props.bankTxs || []) bumpMove(accountIdFor(String(t.bank_account || "")), t.date)
    for (const e of props.entries || [])
      bumpMove(String((e as CashFlowEntry & { accountId?: string }).accountId || ""), (e as CashFlowEntry).date)
  }
  const ocultas = (r: RegisterAccount) =>
    props.bankOk === true && !r.isMain && !r.pinned && (lastMove.get(r.id) ?? 0) < inactCutoff
  const gridRegs = registers.filter((r) => !ocultas(r))
  const hiddenCount = registers.length - gridRegs.length

  // TODAS las cuentas (sin filtro de inactivas) para la lista de balances reales.
  // Incluye cuentas con balance 0 o null/undefined para que el usuario las vea.
  const todasLasCuentas = [...registers].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1
    if (b.isMain && !a.isMain) return 1
    return a.name.localeCompare(b.name)
  })
  // Cuentas visibles de la cuadricula, ordenadas: main primero, luego por movimiento reciente.
  const ordenadas = [...gridRegs].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1
    if (b.isMain && !a.isMain) return 1
    const ta = lastMove.get(a.id) ?? 0
    const tb = lastMove.get(b.id) ?? 0
    if (tb !== ta) return tb - ta
    return a.name.localeCompare(b.name)
  })
  const principal = ordenadas.find((r) => r.isMain) || null
  const resto = ordenadas.filter((r) => r !== principal)
  const secBancos = resto.filter((r) => r.kind === "bank" && r.source === "snapshot")
  const secTarjetas = resto.filter((r) => r.kind === "card")
  const secOtras = resto.filter((r) => r.source === "manual" && r.kind !== "card")

  // Movimientos por cuenta ("N mov." en cada tarjeta, como en MONEY).
  const movCount = movementCounts(
    registers,
    props.bankOk ? props.bankTxs || [] : [],
    (props.entries || []) as { accountId?: string }[],
    (n) => accountIdFor(n),
  )

  // PROYECTADO de la franja = mismo motor y mismas reglas que la página
  // Projections (cuenta ★ + otros fondos, recurrentes, tarjetas, pagado en banco).
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
  // CIERRE DEL DÍA ya no vive en el home: la AI clasifica sola a diario
  // (AI · Clasificación diaria) y la revisión/corrección está en REPORTES.

  const subtituloCuenta = (r: RegisterAccount) => {
    const last4 = last4Of(r.name)
    const tipo = r.kind === "card" ? "Credit Card" : r.source === "manual" ? "Manual" : "Checking"
    return `${last4 ? `•••• ${last4}` : r.institution || r.name} · ${tipo}`
  }

  const tarjetaCuenta = (r: RegisterAccount) => (
    <MoneyAccountCard
      key={r.id}
      name={accountDisplayName(r.name).title}
      rawName={r.name}
      institution={r.institution}
      subtitle={subtituloCuenta(r)}
      balance={balances[r.id] ?? null}
      main={r.isMain}
      count={movCount[r.id] ?? 0}
      onClick={() => props.onOpenAccount(r.id)}
    />
  )

  const seccion = (label: string, list: RegisterAccount[]) =>
    list.length === 0 ? null : (
      <div key={label}>
        <MoneySectionTitle>{label.toUpperCase()}</MoneySectionTitle>
        <div className="grid grid-cols-2 gap-2.5 max-[360px]:grid-cols-1">{list.map(tarjetaCuenta)}</div>
      </div>
    )

  // Pestaña "Citibank Register" (como MONEY): nombre corto de la marca de la ★.
  const mainName = (() => {
    if (!principal) return "Account"
    const b = bankBrandOf(principal.name, principal.institution)
    return b.id === "generic" ? accountDisplayName(principal.name).title.replace(/\s*·+\s*\d{4}$/, "") : b.short
  })()

  return (
    <div className="flex flex-col gap-3 overflow-x-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <MoneyHeader page={vista as 0 | 1} onPage={setVista} />
      <MoneyTabs page={vista as 0 | 1} onPage={setVista} registerLabel={`${mainName} Register`} />
      <MoneyStrip
        cells={[
          {
            label: "REAL BANK",
            value: principal && balances[principal.id] != null ? money(balances[principal.id] as number) : money(available),
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
      {/* Salud: disponible · debo · neto (todas las cuentas) */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#262633] bg-[#111119] px-2 py-1.5 text-center">
        <p className="text-[10px] text-[#9a9cb0]">
          Disponible{" "}
          <span className={cn("font-mono font-bold tabular-nums", available < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]")}>
            {money(available)}
          </span>
        </p>
        <p className="border-x border-[#262633] text-[10px] text-[#9a9cb0]">
          Debo <span className="font-mono font-bold tabular-nums text-[#ff5d6c]">{money(owe)}</span>
        </p>
        <p className="text-[10px] text-[#9a9cb0]">
          Net{" "}
          <span className={cn("font-mono font-bold tabular-nums", net < 0 ? "text-[#ff5d6c]" : "text-[#f2f3f7]")}>
            {money(net)}
          </span>
        </p>
      </div>

      <div>
        <MoneySectionTitle>ACCOUNTS · {gridRegs.length}</MoneySectionTitle>
        {principal && tarjetaCuenta(principal)}
        {seccion("Bancos", secBancos)}
        {seccion("Tarjetas", secTarjetas)}
        {seccion("Otras", secOtras)}
        <button
          type="button"
          onClick={props.onAddAccount}
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-[14px] border border-dashed border-[#262633] p-3 text-[#9a9cb0]"
        >
          <Plus className="size-4" />
          <span className="text-[13px] font-semibold">Add account</span>
        </button>
        {hiddenCount > 0 && (
          <p className="mt-1 px-1 text-[10px] text-[#66687c]">{hiddenCount} no recent activity</p>
        )}
      </div>

      {(pairCount > 0 || looseCount > 0) && (
        <button type="button" onClick={props.onOpenTransfers} className="flex items-center justify-between rounded-[14px] border border-[#262633] bg-[#16161f] px-3.5 py-3 text-left active:scale-[.99]">
          <span className="flex items-center gap-2 text-[13px] font-bold text-[#f2f3f7]">
            <ArrowLeftRight className="size-4 text-[#5b8cff]" /> Transferencias
          </span>
          <span className="font-mono text-[10px] font-bold text-[#9a9cb0]">{pairCount} matched · {looseCount} abiertas</span>
        </button>
      )}

      {/* CIERRE DEL DAY removido del home: la AI clasifica sola a daily.
          Revisión y correction por categoría en REPORTS (AI · Clasificación diaria). */}
        </>
      )}
      {/* ============ VISTA PROJECTED ============ */}
      {vista === 1 && (
        <>
          {/* PendingDeposits vive en el menú ••• del register (no invasivo). */}
          <DineroProyeccion
            registers={registers}
            balances={balances}
            dues={dues}
            entries={props.entries || []}
            bankTxs={props.bankTxs || []}
            bankOk={props.bankOk === true}
            otherFunds={props.otherFunds || []}
            onEditEntry={props.onEditEntry}
            onPatchEntry={props.onPatchEntry}
            onAddEntry={props.onAddEntry}
            onMarkPaid={props.onMarkPaid}
          />

          {/* Balances reales por cuenta (referencia; el inicial es la cuenta ★ + otros fondos) */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                Real bank balances
              </p>
              <button
                type="button"
                onClick={() => setVerBalancesTodos(true)}
                className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
                title="See all accounts (including $0 balance)"
              >
                {verTodos ? "Active only" : "See all"}
              </button>
            </div>
            <div className="space-y-1">
              {todasLasCuentas.map((r) => {
                const bal = balances[r.id]
                const brand = bankBrandOf(r.name, r.institution)
                const mostrarse =
                  verTodos ||
                  bal !== null &&
                  bal !== undefined &&
                  (bal !== 0 || r.isMain || r.pinned || r.source !== "snapshot")
                if (!mostrarse) return null
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {r.isMain && <Star className="size-3 shrink-0 fill-yellow-400 text-yellow-400" />}
                      <span className="truncate font-semibold text-neutral-200">{brand.short}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono font-bold tabular-nums",
                        bal === null || bal === undefined
                          ? "text-neutral-500"
                          : bal < 0
                            ? "text-rose-400"
                            : "text-emerald-400",
                      )}
                    >
                      {bal === null || bal === undefined ? "—" : money(bal)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

    </div>
  )
}

export function AddAccountModal(props: {
  onClose: () => void
  onSave: (input: { name: string; kind: "bank" | "card"; limit?: number | null; dueDay?: number | null; balance?: number | null }) => void
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"bank" | "card">("bank")
  const [balance, setBalance] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={props.onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-white">Add account</h3>
        <input className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["bank", "card"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-xl border py-2.5 text-xs font-bold", kind === k ? "border-yellow-400/60 text-yellow-300" : "border-neutral-700 text-neutral-300")}>
              {k === "bank" ? "Bank" : "Card"}
            </button>
          ))}
        </div>
        <input className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white" type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance" />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={props.onClose} className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300">Cancel</button>
          <button type="button" disabled={!name.trim()} onClick={() => props.onSave({ name: name.trim(), kind, balance: balance ? parseFloat(balance) : 0 })} className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black disabled:opacity-40">Crear</button>
        </div>
      </div>
    </div>
  )
}

export function RegisterDetail(props: {
  account: RegisterAccount
  balance: number | null
  bankTxs: BankTx[]
  entries: CashFlowEntry[]
  otherFunds: { reg: RegisterAccount; balance: number | null; checked: boolean }[]
  onToggleOtherFund: (id: string) => void
  onBack: () => void
  onAddBill: () => void
  onAddPost: () => void
  /** Ajuste de balance COMO ENTRADA del register (propósito: balancear). */
  onAddAdjust: () => void
  /** Escanear factura/recibo: abre el escáner AI con el tipo de documento. */
  onScanDoc: (docTipo: string) => void
  onEditEntry: (e: CashFlowEntry) => void
  onDeleteEntry: (id: string) => void
  onSetDocKind: (id: string, kind: "bill" | "receipt") => void
  onInlineAmount: (id: string, raw: string) => void
  onSetMain: (id: string) => void
  onSaveDueDay: (id: string, day: number | null) => void
  onSaveManualBalance: (id: string, v: number) => void
  onDeleteManual: (id: string) => void
}) {
  const { account: r } = props
  const isCard = r.kind === "card"
  const d = accountDisplayName(r.name)
  const brand = bankBrandOf(r.name, r.institution)
  // ¿Cómo registrar? Escanear (la AI lee, categoriza, clasifica y registra a
  // donde va) o Manual. Hoja de acción al tocar + Bill / + Receipt.
  const [docChoice, setDocChoice] = useState<null | "bill" | "receipt">(null)
  // Fila expandida (muestra Edit/Delete) y monto en edición inline.
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null)
  // AI TRACKING de due dates: próxima factura por pagar y ¿alcanza el balance?
  const proximaFactura = (() => {
    const bills = (props.entries || []).filter(
      (e) => e.status === "projected" && e.type === "expense" && Math.abs(Number(e.amount) || 0) > 0,
    )
    if (bills.length === 0) return null
    const hoy = new Date().toISOString().slice(0, 10)
    return bills.filter((e) => String(e.date || "") >= hoy).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]
  })()
  const alcanza =
    proximaFactura != null && props.balance != null && (props.balance || 0) >= Math.abs(Number(proximaFactura.amount) || 0)

  type Line = {
    key: string
    date: string
    detail: string
    amount: number
    dailyBalance: number | null
    kind: "bank" | "entry"
    entry?: CashFlowEntry
  }

  const statementLines: Line[] = (() => {
    const lines: Line[] = []
    for (const t of props.bankTxs) {
      lines.push({
        key: `bank:${t.date}:${t.detail}:${t.amount}:${t.daily_balance}`,
        date: String(t.date || "").slice(0, 10),
        detail: t.detail || "Bank",
        amount: Number(t.amount) || 0,
        dailyBalance:
          t.daily_balance !== null && t.daily_balance !== undefined && Number.isFinite(Number(t.daily_balance))
            ? Number(t.daily_balance)
            : null,
        kind: "bank",
      })
    }
    for (const e of props.entries) {
      const amt = Math.abs(Number(e.amount) || 0)
      lines.push({
        key: `entry:${e.id}`,
        date: String(e.date || "").slice(0, 10),
        detail: e.description || e.category || "Entry",
        amount: e.type === "income" ? amt : -amt,
        dailyBalance: null,
        kind: "entry",
        entry: e,
      })
    }

    // Always newest → oldest
    lines.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date)
      if (cmp !== 0) return cmp
      return Math.abs(b.amount) - Math.abs(a.amount)
    })

    // ALWAYS fill Balance: use bank daily_balance or walk from current balance
    if (props.balance !== null && Number.isFinite(props.balance)) {
      let run = Number(props.balance)
      for (const line of lines) {
        if (line.dailyBalance !== null && Number.isFinite(line.dailyBalance)) {
          run = line.dailyBalance
        } else {
          line.dailyBalance = Math.round(run * 100) / 100
          run = run - line.amount
        }
      }
    } else {
      // No account balance: still show bank daily_balance when present; else chain from first known
      let run: number | null = null
      for (const line of lines) {
        if (line.dailyBalance !== null && Number.isFinite(line.dailyBalance)) {
          run = line.dailyBalance
        } else if (run !== null) {
          line.dailyBalance = Math.round(run * 100) / 100
          run = run - line.amount
        }
      }
    }
    return lines
  })()

  return (
    <div className="flex min-h-0 flex-col gap-3 px-1">
      {/* Cabecera de banco (diseño MONEY): color de marca arriba, logo, saldo grande */}
      <div
        className="shrink-0 rounded-[14px] border border-[#262633] bg-[#111119] p-3"
        style={{ borderTop: `3px solid ${brand.c}` }}
      >
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-[#262633] bg-[#16161f] px-3 py-1.5 text-[12px] font-bold text-[#9a9cb0] active:scale-95"
        >
          <ArrowLeft className="size-4" /> Bancos
        </button>
        <div className="mt-2.5 flex items-center gap-2.5">
          <BankLogo brand={brand} name={r.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold text-[#f2f3f7]">
              {d.title}
              {r.isMain ? " ★" : ""}
            </p>
            <p className="truncate font-mono text-[11px] text-[#66687c]">
              {r.name} · {isCard ? "card" : "status"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#9a9cb0]">
          {isCard ? "Debt" : "Current balance"}
          {r.isMain ? " · PRINCIPAL" : ""}
        </p>
        <p
          className={cn(
            "font-mono text-[26px] font-extrabold tabular-nums",
            props.balance === null ? "text-[#66687c]" : (props.balance || 0) < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]",
          )}
        >
          {props.balance === null ? "—" : money(props.balance)}
        </p>
        {/* AI TRACKing de due dates: próxima factura por pagar + ¿alcanza el balance? */}
        {proximaFactura && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#262633] bg-[#16161f] px-2.5 py-1.5">
            <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9a9cb0]">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
              <span className="truncate">
                Next bill · {shortDate(proximaFactura.date)} · {proximaFactura.description || "—"}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-extrabold",
                alcanza ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300",
              )}
            >
              {money(Math.abs(Number(proximaFactura.amount) || 0))} · {alcanza ? "ALCANZA ✓" : "NO ALCANZA ✗"}
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => setDocChoice("bill")} className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200">+ Bill</button>
        <button type="button" onClick={() => setDocChoice("receipt")} className="flex-1 rounded-xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200">+ Receipt</button>
        <button type="button" onClick={props.onAddAdjust} className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-200">+ Ajuste</button>
      </div>

      {/* El ajuste de balance YA NO es una pantalla aparte: se registra como una
          entrada más del register (botón + Ajuste) con propósito de balancear. */}

      {/* ¿Cómo registrar la factura/recibo? Escanear (la AI lee, categoriza,
          clasifica y registra a donde va) o Manual. */}
      {docChoice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setDocChoice(null)}>
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-neutral-700 bg-neutral-950 p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-extrabold text-white">How will you record it?</p>
            <button
              type="button"
              onClick={() => {
                props.onScanDoc(docChoice === "bill" ? "factura" : "recibo")
                setDocChoice(null)
              }}
              className="mb-2 flex w-full items-center gap-2.5 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-3.5 text-left active:scale-[0.99]"
            >
              <Camera className="size-5 shrink-0 text-cyan-300" />
              <span className="min-w-0 flex-1 text-sm font-extrabold text-cyan-100">Escanear</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (docChoice === "bill") props.onAddBill()
                else props.onAddPost()
                setDocChoice(null)
              }}
              className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-neutral-700 bg-neutral-900 px-3.5 py-3.5 text-left active:scale-[0.99]"
            >
              <Pencil className="size-5 shrink-0 text-neutral-300" />
              <span className="min-w-0 flex-1 text-sm font-extrabold text-neutral-100">Manual</span>
            </button>
            <button
              type="button"
              onClick={() => setDocChoice(null)}
              className="w-full rounded-2xl border border-neutral-700 py-3 text-xs font-bold text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Statement: Date | Detail | Amount | Balance — alineado, monto editable */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-neutral-950/80">
        <div className="grid shrink-0 grid-cols-[3.25rem_minmax(0,1fr)_4.75rem_4.75rem] gap-1 border-b border-neutral-800 bg-neutral-900/90 px-2.5 py-2 text-[10px] font-black uppercase tracking-wide">
          <span className="text-neutral-400">Date</span>
          <span className="text-neutral-400">Detail</span>
          <span className="text-right text-neutral-400">Amount</span>
          <span className="text-right text-emerald-400">Balance</span>
        </div>
        <div className="max-h-[min(58vh,480px)] min-h-[220px] overflow-y-auto overscroll-contain">
          {statementLines.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-neutral-500">No activity</p>
          )}
          {statementLines.map((line) => {
            const ent = line.entry
            const income = line.amount >= 0
            const esFactura = ent ? ent.status === "projected" : false
            const expanded = ent != null && expandedKey === line.key
            const editingAmt = ent != null && editingAmountId === ent.id
            const toggleExpand = () => setExpandedKey((k) => (k === line.key ? null : line.key))
            return (
              <div key={line.key} className="border-b border-neutral-900/80 px-2.5 py-2">
                <div
                  role={ent ? "button" : undefined}
                  tabIndex={ent ? 0 : undefined}
                  onClick={ent ? toggleExpand : undefined}
                  onKeyDown={
                    ent
                      ? (ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault()
                            toggleExpand()
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "grid grid-cols-[3.25rem_minmax(0,1fr)_4.75rem_4.75rem] items-center gap-1",
                    ent && "cursor-pointer",
                  )}
                >
                  <p className="font-mono text-[10px] font-semibold leading-tight text-neutral-500">{shortDate(line.date)}</p>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium leading-snug text-neutral-100">{line.detail}</p>
                    {ent && <EntryTag entry={ent} />}
                  </div>
                  {ent ? (
                    editingAmt ? (
                      <span className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <span className={cn("font-mono text-[11px] font-bold", income ? "text-emerald-500" : "text-rose-500")}>
                          {income ? "+" : "−"}
                        </span>
                        <input
                          key={`${ent.id}:${ent.amount}`}
                          autoFocus
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          defaultValue={String(Math.abs(Number(ent.amount) || 0))}
                          onBlur={(ev) => {
                            props.onInlineAmount(ent.id, ev.target.value)
                            setEditingAmountId(null)
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") (ev.target as HTMLInputElement).blur()
                            if (ev.key === "Escape") setEditingAmountId(null)
                          }}
                          aria-label={`Amount of ${ent.description || "entry"} (editable)`}
                          className={cn(
                            "w-[3.9rem] rounded border border-neutral-600 bg-neutral-900 px-0.5 py-0.5 text-right font-mono text-[11px] font-bold tabular-nums outline-none",
                            income ? "text-emerald-400" : "text-rose-400",
                          )}
                        />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingAmountId(ent.id)
                        }}
                        title="Tap to edit amount"
                        className={cn(
                          "text-right font-mono text-[12px] font-bold tabular-nums",
                          income ? "text-emerald-400" : "text-rose-400",
                        )}
                      >
                        {income ? "+" : "−"}
                        {money(Math.abs(Number(ent.amount) || 0)).replace(/^\$/, "")}
                      </button>
                    )
                  ) : (
                    <p
                      className={cn(
                        "text-right font-mono text-[12px] font-bold tabular-nums",
                        income ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {income ? "+" : "−"}
                      {money(Math.abs(line.amount)).replace(/^\$/, "")}
                    </p>
                  )}
                  <p className="text-right font-mono text-[12px] font-bold tabular-nums text-white">
                    {line.dailyBalance === null ? "—" : money(line.dailyBalance)}
                  </p>
                </div>
                {expanded && ent && (
                  <div className="mt-1 flex items-center gap-1.5 pl-[3.25rem]">
                    <button
                      type="button"
                      onClick={() => props.onEditEntry(ent)}
                      title="Edit entry"
                      className="flex items-center gap-1 rounded-md border border-[#262633] bg-[#16161f] px-1.5 py-0.5 text-[9px] font-bold text-[#9a9cb0] active:scale-95"
                    >
                      <Pencil className="size-2.5" /> Edit
                    </button>
                    {ent.type === "expense" && (
                      <button
                        type="button"
                        onClick={() => props.onSetDocKind(ent.id, esFactura ? "receipt" : "bill")}
                        title={esFactura ? "Marcar pagado (recibo)" : "Convert to bill (due date in projections)"}
                        className={cn(
                          "flex items-center gap-1 rounded-md border px-1 py-0.5 text-[8px] font-bold active:scale-95",
                          esFactura
                            ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                            : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                        )}
                      >
                        {esFactura ? <Check className="size-2.5" /> : <TrendingUp className="size-2.5" />}
                        {esFactura ? "Receipt" : "Bill"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => props.onDeleteEntry(ent.id)}
                      title="Delete entry"
                      className="flex items-center gap-1 rounded-md border border-rose-900/50 bg-rose-950/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 active:scale-95"
                    >
                      <Trash2 className="size-2.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TransfersReport(props: { report: TransferReport; onBack: () => void }) {
  const { report } = props
  const abiertas = [
    ...report.unmatchedOut.map((t) => ({ t, dir: "sale" as const })),
    ...report.unmatchedIn.map((t) => ({ t, dir: "entra" as const })),
  ].sort((a, b) => String(b.t.date).localeCompare(String(a.t.date)))
  const fila = "flex items-center justify-between gap-2 border-b border-[#1f1f2a] py-2 last:border-b-0"
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="rounded-[14px] border border-[#262633] bg-[#111119] p-3" style={{ borderTop: "3px solid #5b8cff" }}>
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-[#262633] bg-[#16161f] px-3 py-1.5 text-[12px] font-bold text-[#9a9cb0] active:scale-95"
        >
          <ArrowLeft className="size-4" /> Bancos
        </button>
        <p className="mt-2.5 flex items-center gap-2 text-[15px] font-extrabold text-[#f2f3f7]">
          <ArrowLeftRight className="size-4 text-[#5b8cff]" /> Transferencias
        </p>
        <p className="mt-0.5 text-[11px] text-[#66687c]">
          {report.pairs.length} matched · {abiertas.length} unmatched
        </p>
      </div>

      <div>
        <MoneySectionTitle>EMPAREJADAS · {report.pairs.length}</MoneySectionTitle>
        {report.pairs.length === 0 ? (
          <p className="rounded-[14px] border border-[#262633] bg-[#16161f] p-3 text-[11px] text-[#9a9cb0]">None yet.</p>
        ) : (
          <div className="rounded-[14px] border border-[#262633] bg-[#16161f] px-3">
            {report.pairs.map((p) => (
              <div key={p.id} className={fila}>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[#f2f3f7]">
                    {accountDisplayName(p.outTx.bank_account).title} → {accountDisplayName(p.inTx.bank_account).title}
                  </span>
                  <span className="block font-mono text-[10px] text-[#66687c]">
                    {shortDate(p.outDate)} → {shortDate(p.inDate)}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[12px] font-bold text-[#f2f3f7]">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <MoneySectionTitle>UNMATCHED · {abiertas.length}</MoneySectionTitle>
        {abiertas.length === 0 ? (
          <p className="rounded-[14px] border border-[rgba(47,191,113,.5)] bg-[#16161f] p-3 text-[11px] font-bold text-[#2fbf71]">
            Todo emparejado.
          </p>
        ) : (
          <div className="rounded-[14px] border border-[#262633] bg-[#16161f] px-3">
            {abiertas.map(({ t, dir }, i) => (
              <div key={`${dir}-${t.date}-${t.bank_account}-${t.amount}-${i}`} className={fila}>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[#f2f3f7]">{t.detail || "Transferencia"}</span>
                  <span className="block truncate font-mono text-[10px] text-[#66687c]">
                    {shortDate(t.date)} · {accountDisplayName(t.bank_account).title} · {dir === "sale" ? "sale" : "entra"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[12px] font-bold",
                    dir === "sale" ? "text-[#ff5d6c]" : "text-[#2fbf71]",
                  )}
                >
                  {dir === "sale" ? "−" : "+"}
                  {money(Math.abs(Number(t.amount) || 0))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
