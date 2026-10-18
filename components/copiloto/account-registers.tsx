"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  Camera,
  Car,
  Plus,
  Receipt,
  Star,
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
import { ReconciliationSection } from "./reconciliation-view"
import type { ReconReport, ReconFinding } from "./reconciliation-check"
import { DineroProyeccion, useForecastInputs } from "./dinero-proyeccion"
import { buildForecast, daysToEndOfMonth, startingBalance, todayKey } from "./dinero-forecast"
import { movementCounts } from "./bank-brand"
import { BankLogo, MoneyAccountCard, MoneyHeader, MoneySectionTitle, MoneyStrip, MoneyTabs } from "./money-ui"
import { bankBrandOf } from "./bank-brand"
import { AccountSettings } from "./account-settings"

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
function EntryBadges({ entry }: { entry: CashFlowEntry }) {
  const base =
    "inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0.5 text-[9px] font-semibold"
  const origin: CashFlowOrigin = origenDe(entry)
  const tipo = tipoDocDe(entry)
  const originStyle: Record<CashFlowOrigin, string> = {
    scan: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    manual: "border-neutral-700 bg-neutral-800 text-neutral-400",
    bank: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    trip: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    square: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    transfer: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  }
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1">
      <span className={cn(base, originStyle[origin])}>
        {origin === "scan" && <Camera className="size-2.5" />}
        {origin === "bank" && <Building2 className="size-2.5" />}
        {origin === "transfer" && <ArrowLeftRight className="size-2.5" />}
        {origin === "trip" && <Car className="size-2.5" />}
        {entry.origin === "trip" && entry.sourceLabel ? entry.sourceLabel : ETIQUETA_ORIGEN[origin]}
      </span>
      {tipo === "factura" && (
        <span className={cn(base, "border-cyan-500/30 bg-cyan-500/10 text-cyan-300")}>
          <TrendingUp className="size-2.5" /> {ETIQUETA_TIPO.factura}
        </span>
      )}
      {tipo === "recibo" && (
        <span className={cn(base, "border-purple-500/30 bg-purple-500/10 text-purple-300")}>
          <Receipt className="size-2.5" /> {ETIQUETA_TIPO.recibo}
        </span>
      )}
    </span>
  )
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
  // movimiento en 30 días → se oculta del grid (el balance sigue contando
  // en Disponible/Debo/Neto). Si el banco no cargó, no se oculta nada.
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
  // CIERRE = hallazgos de reconciliación pendientes hoy ("Ex." = excepciones).
  const pendientesCierre = (props.reconReport?.accounts || []).reduce((s, a) => s + a.findings.length, 0)

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
    if (!principal) return "Cuenta"
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
            label: "BANCO REAL",
            value: principal && balances[principal.id] != null ? money(balances[principal.id] as number) : money(available),
            tone: "plain",
            active: vista === 0,
            onClick: () => setVista(0),
          },
          {
            label: "PROYECTADO",
            value: money(proyectadoMes.end),
            tone: proyectadoMes.end < 0 ? "neg" : "plain",
            active: vista === 1,
            onClick: () => setVista(1),
          },
          {
            label: "CIERRE",
            value: `${pendientesCierre} Ex.`,
            tone: pendientesCierre > 0 ? "neg" : "plain",
            onClick: props.onRunRecon,
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
          Neto{" "}
          <span className={cn("font-mono font-bold tabular-nums", net < 0 ? "text-[#ff5d6c]" : "text-[#f2f3f7]")}>
            {money(net)}
          </span>
        </p>
      </div>

      <div>
        <MoneySectionTitle sub="Toca una cuenta → su registro con balance">CUENTAS · {gridRegs.length}</MoneySectionTitle>
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
          <span className="text-[13px] font-semibold">Agregar cuenta</span>
        </button>
        {hiddenCount > 0 && (
          <p className="mt-1 px-1 text-[10px] text-[#66687c]">{hiddenCount} sin movimiento reciente</p>
        )}
      </div>

      {(pairCount > 0 || looseCount > 0) && (
        <button type="button" onClick={props.onOpenTransfers} className="flex items-center justify-between rounded-[14px] border border-[#262633] bg-[#16161f] px-3.5 py-3 text-left active:scale-[.99]">
          <span className="flex items-center gap-2 text-[13px] font-bold text-[#f2f3f7]">
            <ArrowLeftRight className="size-4 text-[#5b8cff]" /> Transferencias
          </span>
          <span className="font-mono text-[10px] font-bold text-[#9a9cb0]">{pairCount} emparejadas · {looseCount} abiertas</span>
        </button>
      )}

      {/* RECONCILIACIÓN — sección separada, solo en vista Real. */}
      <ReconciliationSection
        report={props.reconReport ?? null}
        loading={props.reconLoading ?? false}
        onRun={props.onRunRecon ?? (() => {})}
        onApprove={props.onApproveFinding ?? (() => {})}
        onReject={props.onRejectFinding ?? (() => {})}
        onEdit={props.onEditFinding ?? (() => {})}
        onApproveAll={props.onApproveAllFindings ?? (() => {})}
      />
      {/* Cierre vista Real */}
        </>
      )}
      {/* ============ VISTA PROYECTADO ============ */}
      {vista === 1 && (
        <>
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
                Balances reales del banco
              </p>
              <button
                type="button"
                onClick={() => setVerBalancesTodos(true)}
                className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
                title="Ver todas las cuentas (incluidas con saldo 0)"
              >
                {verTodos ? "Solo activas" : "Ver todas"}
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
        <h3 className="text-sm font-extrabold text-white">Agregar cuenta</h3>
        <input className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la cuenta" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["bank", "card"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-xl border py-2.5 text-xs font-bold", kind === k ? "border-yellow-400/60 text-yellow-300" : "border-neutral-700 text-neutral-300")}>
              {k === "bank" ? "Banco" : "Tarjeta"}
            </button>
          ))}
        </div>
        <input className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white" type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance" />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={props.onClose} className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300">Cancelar</button>
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
              {r.name} · {isCard ? "tarjeta" : "estado"} · lo nuevo arriba
            </p>
          </div>
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#9a9cb0]">
          {isCard ? "Deuda" : "Balance actual"}
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
      </div>

      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={props.onAddBill} className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200">+ Factura</button>
        <button type="button" onClick={props.onAddPost} className="flex-1 rounded-xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200">+ Recibo</button>
      </div>

      {/* Ajustes de la cuenta: principal ★, día de pago, saldo manual, otros fondos, borrar. */}
      <AccountSettings
        account={r}
        balance={props.balance}
        otherFunds={props.otherFunds}
        onToggleOtherFund={props.onToggleOtherFund}
        onSetMain={props.onSetMain}
        onSaveDueDay={props.onSaveDueDay}
        onSaveManualBalance={props.onSaveManualBalance}
        onDeleteManual={props.onDeleteManual}
      />

      {/* Statement: Date | Amount | Balance — ALL accounts */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-neutral-950/80">
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_4.5rem_4.75rem] gap-1 border-b border-neutral-800 bg-neutral-900/90 px-2.5 py-2.5 text-[10px] font-black uppercase tracking-wide">
          <span className="text-neutral-400">Fecha · Detalle</span>
          <span className="text-right text-neutral-400">Monto</span>
          <span className="text-right text-emerald-400">Balance</span>
        </div>
        <div className="max-h-[min(58vh,480px)] min-h-[220px] overflow-y-auto overscroll-contain">
          {statementLines.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-neutral-500">Sin movimientos · Sincroniza el banco</p>
          )}
          {statementLines.map((line) => {
            const body = (
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.75rem] items-start gap-1 border-b border-neutral-900/80 px-2.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-500">{shortDate(line.date)}</p>
                  <p className="truncate text-[12px] font-medium leading-snug text-neutral-100">{line.detail}</p>
                  {line.entry && <EntryBadges entry={line.entry} />}
                </div>
                <p className={cn("text-right font-mono text-[12px] font-bold tabular-nums", line.amount >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {line.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(line.amount)).replace(/^\$/, "")}
                </p>
                <p className="text-right font-mono text-[12px] font-bold tabular-nums text-white">
                  {line.dailyBalance === null ? "—" : money(line.dailyBalance)}
                </p>
              </div>
            )
            if (line.entry) {
              const ent = line.entry
              const esFactura = ent.status === "projected"
              return (
                <div key={line.key} className="border-b border-neutral-900/80">
                  <button type="button" onClick={() => props.onEditEntry(ent)} className="w-full text-left active:bg-neutral-900/60 [&>div]:border-b-0">
                    {body}
                  </button>
                  {/* Acciones del asiento: factura↔recibo y borrar (con confirmación). */}
                  <div className="flex gap-1.5 px-2.5 pb-2">
                    {ent.type === "expense" && (
                      <button
                        type="button"
                        onClick={() => props.onSetDocKind(ent.id, esFactura ? "receipt" : "bill")}
                        className="rounded-md border border-[#262633] bg-[#16161f] px-2 py-0.5 text-[10px] font-bold text-[#9a9cb0] active:scale-95"
                      >
                        {esFactura ? "Marcar pagado (recibo)" : "Pasar a factura"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => props.onDeleteEntry(ent.id)}
                      className="rounded-md border border-rose-900/50 bg-rose-950/30 px-2 py-0.5 text-[10px] font-bold text-rose-300 active:scale-95"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              )
            }
            return <div key={line.key}>{body}</div>
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
        <p className="mt-0.5 text-[11px] text-[#66687c]">Mismo dinero moviéndose entre tus cuentas · no es ingreso</p>
        <p className="mt-1.5 font-mono text-[11px] text-[#9a9cb0]">
          {report.pairs.length} emparejadas · {abiertas.length} sin emparejar
        </p>
      </div>

      <div>
        <MoneySectionTitle>EMPAREJADAS · {report.pairs.length}</MoneySectionTitle>
        {report.pairs.length === 0 ? (
          <p className="rounded-[14px] border border-[#262633] bg-[#16161f] p-3 text-[11px] text-[#9a9cb0]">Ninguna todavía.</p>
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
        <MoneySectionTitle sub="Salidas sin llegada o llegadas sin salida (otra cuenta no conectada o aún en camino)">
          SIN EMPAREJAR · {abiertas.length}
        </MoneySectionTitle>
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
