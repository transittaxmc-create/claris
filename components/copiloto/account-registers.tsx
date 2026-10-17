"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  Camera,
  Car,
  CreditCard,
  Landmark,
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
} from "./registers-store"
import type { TransferReport } from "./transfer-matcher"
import { ReconciliationSection } from "./reconciliation-view"
import type { ReconReport, ReconFinding } from "./reconciliation-check"
import { DineroProyeccion } from "./dinero-proyeccion"

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
  }
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1">
      <span className={cn(base, originStyle[origin])}>
        {origin === "scan" && <Camera className="size-2.5" />}
        {origin === "bank" && <Building2 className="size-2.5" />}
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

  const tarjetaCuenta = (r: RegisterAccount) => {
    const bal = balances[r.id]
    const isCard = r.kind === "card"
    const d = accountDisplayName(r.name)
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => props.onOpenAccount(r.id)}
        className={cn(
          "rounded-xl border p-2 text-left active:scale-[0.98]",
          r.isMain ? "border-yellow-400/50 bg-yellow-400/[0.06]" : "border-neutral-800 bg-neutral-900/70",
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-black",
              isCard ? "bg-purple-500/15 text-purple-300" : "bg-blue-500/15 text-blue-300",
            )}
          >
            {isCard ? <CreditCard className="size-2" /> : <Landmark className="size-2" />}
            {isCard ? "CARD" : "BANK"}
          </span>
          {r.isMain && <Star className="size-2.5 fill-yellow-400 text-yellow-400" />}
        </div>
        <p className="mt-1 truncate text-[10px] font-bold leading-tight text-white">{d.title}</p>
        <p
          className={cn(
            "mt-0.5 text-base font-black tabular-nums leading-tight",
            bal === null ? "text-neutral-500" : bal < 0 ? "text-rose-400" : "text-emerald-400",
          )}
        >
          {bal === null ? "—" : money(bal)}
        </p>
      </button>
    )
  }

  const seccion = (label: string, list: RegisterAccount[]) =>
    list.length === 0 ? null : (
      <div key={label} className="mt-2">
        <p className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-neutral-600">{label}</p>
        <div className="grid grid-cols-3 gap-1.5">{list.map(tarjetaCuenta)}</div>
      </div>
    )

  const indicadorVista = (
    <div className="flex items-center justify-center gap-2 py-0.5">
      <button
        type="button"
        onClick={() => setVista(0)}
        className={cn(
          "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
          vista === 0 ? "bg-white text-black" : "bg-neutral-800 text-neutral-400",
        )}
      >
        Real
      </button>
      <span className="flex gap-1">
        <span className={cn("size-1.5 rounded-full", vista === 0 ? "bg-white" : "bg-neutral-700")} />
        <span className={cn("size-1.5 rounded-full", vista === 1 ? "bg-cyan-300" : "bg-neutral-700")} />
      </span>
      <button
        type="button"
        onClick={() => setVista(1)}
        className={cn(
          "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
          vista === 1 ? "bg-cyan-300 text-black" : "bg-neutral-800 text-neutral-400",
        )}
      >
        Proyectado
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 overflow-x-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {indicadorVista}
      {vista === 0 && (
        <>
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-2.5">
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Disponible</p>
          <p className={cn("font-mono text-base font-black tabular-nums", available < 0 ? "text-rose-400" : "text-emerald-400")}>
            {money(available)}
          </p>
        </div>
        <div className="border-x border-neutral-800 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Debo</p>
          <p className="font-mono text-base font-black tabular-nums text-rose-400">{money(owe)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Neto</p>
          <p className={cn("font-mono text-base font-black tabular-nums", net < 0 ? "text-rose-400" : "text-white")}>{money(net)}</p>
        </div>
      </div>

      <div>
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Cuentas · {gridRegs.length}</p>
        <p className="mb-1.5 px-1 text-[11px] text-neutral-500">Toca una cuenta → estado con Balance · lo nuevo arriba</p>
        {principal &&
          (() => {
            const bal = balances[principal.id]
            const d = accountDisplayName(principal.name)
            return (
              <button
                type="button"
                onClick={() => props.onOpenAccount(principal.id)}
                className="mb-1 flex w-full items-center justify-between gap-2 rounded-2xl border border-yellow-400/50 bg-yellow-400/[0.06] p-3 text-left active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-yellow-300">
                    <Star className="size-3 fill-yellow-400 text-yellow-400" /> Principal
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-bold text-white">{d.title}</span>
                  <span
                    className={cn(
                      "mt-0.5 block font-mono text-xl font-black tabular-nums",
                      bal === null || bal === undefined ? "text-neutral-500" : bal < 0 ? "text-rose-400" : "text-emerald-400",
                    )}
                  >
                    {bal === null || bal === undefined ? "—" : money(bal)}
                  </span>
                </span>
                <Landmark className="size-6 shrink-0 text-yellow-400/60" />
              </button>
            )
          })()}
        {seccion("Bancos", secBancos)}
        {seccion("Tarjetas", secTarjetas)}
        {seccion("Otras", secOtras)}
        <button
          type="button"
          onClick={props.onAddAccount}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-700 p-2.5 text-neutral-400"
        >
          <Plus className="size-4" />
          <span className="text-[11px] font-bold">Agregar cuenta</span>
        </button>
        {hiddenCount > 0 && (
          <p className="mt-1 px-1 text-[10px] text-neutral-600">{hiddenCount} sin movimiento reciente</p>
        )}
      </div>

      {(pairCount > 0 || looseCount > 0) && (
        <button type="button" onClick={props.onOpenTransfers} className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-left">
          <span className="flex items-center gap-2 text-[12px] font-bold text-neutral-200">
            <ArrowLeftRight className="size-4 text-cyan-300" /> Transferencias
          </span>
          <span className="text-[10px] font-bold text-neutral-400">{pairCount} emparejadas · {looseCount} abiertas</span>
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
            onMarkPaid={props.onMarkPaid}
          />

          {/* Balances reales por cuenta (referencia; el inicial es la cuenta ★ + otros fondos) */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              Balances reales del banco
            </p>
            <div className="space-y-1">
              {ordenadas.map((r) => {
                const bal = balances[r.id]
                const d = accountDisplayName(r.name)
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {r.isMain && <Star className="size-3 shrink-0 fill-yellow-400 text-yellow-400" />}
                      <span className="truncate font-semibold text-neutral-200">{d.title}</span>
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
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={props.onBack} className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-[12px] font-bold text-yellow-300">
          <ArrowLeft className="size-4" /> Cuentas
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-white">
            {d.title}
            {r.isMain ? " ★" : ""}
          </p>
          <p className="truncate text-[10px] text-neutral-500">{r.name} · statement · newest on top</p>
        </div>
      </div>

      <div className="shrink-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          {isCard ? "Debt" : "Current balance"}
          {r.isMain ? " · MAIN" : ""}
        </p>
        <p className={cn("mt-1 text-3xl font-black tabular-nums", (props.balance || 0) < 0 && !isCard ? "text-rose-400" : "text-emerald-400")}>
          {props.balance === null ? "—" : money(props.balance)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={props.onAddBill} className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-200">+ Factura</button>
        <button type="button" onClick={props.onAddPost} className="flex-1 rounded-xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-200">+ Recibo</button>
      </div>

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
              return (
                <button key={line.key} type="button" onClick={() => props.onEditEntry(line.entry!)} className="w-full text-left active:bg-neutral-900/60">
                  {body}
                </button>
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
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={props.onBack} className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-[12px] font-bold text-yellow-300">
          <ArrowLeft className="size-4" /> Cuentas
        </button>
        <p className="text-[14px] font-extrabold text-white">Transferencias</p>
      </div>
      <p className="text-[11px] text-neutral-400">
        {props.report.pairs.length} emparejadas · {props.report.unmatchedOut.length + props.report.unmatchedIn.length} sin emparejar
      </p>
    </div>
  )
}
