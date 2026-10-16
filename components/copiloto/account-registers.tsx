// ============================================================================
// REGISTERS POR CUENTA — portada (una tarjeta por cuenta) + detalle por cuenta.
// Reglas de Miguel: sin overcrowded, texto legible, sin scroll vertical largo,
// sin secciones expandibles. Una pantalla por nivel.
// ============================================================================

"use client"

import { useState } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Camera,
  Car,
  CheckCircle2,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Star,
  Trash2,
  TrendingUp,
  AlertTriangle,
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
  setDueDay as saveDueDay,
} from "./registers-store"
import type { TransferReport } from "./transfer-matcher"

export interface BankTx {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
}

// Dos etiquetas: ORIGEN (Escaneado / Manual / Banco / Cobros) y TIPO
// (Factura = por pagar, Recibo = ya pagado). El origen no cambia nunca.
function renderBadges(row: CashFlowEntry) {
  const base =
    "inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0.5 text-[10px] font-semibold"
  const origin: CashFlowOrigin = origenDe(row)
  const tipo = tipoDocDe(row)
  const originStyle: Record<CashFlowOrigin, string> = {
    scan: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    manual: "border-neutral-700 bg-neutral-800 text-neutral-400",
    bank: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    trip: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  }
  return (
    <>
      <span className={cn(base, originStyle[origin])}>
        {origin === "scan" && <Camera className="size-2.5" />}
        {origin === "bank" && <Building2 className="size-2.5" />}
        {origin === "trip" && <Car className="size-2.5" />}
        {row.origin === "trip" && row.sourceLabel ? row.sourceLabel : ETIQUETA_ORIGEN[origin]}
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
    </>
  )
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

// ---------------------------------------------------------------------------
// PORTADA — una tarjeta por cuenta (swipe horizontal) + vencimientos
// ---------------------------------------------------------------------------

export function RegistersHome(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  pairCount: number
  looseCount: number
  onOpenAccount: (id: string) => void
  onAddAccount: () => void
  onOpenTransfers: () => void
}) {
  const { registers, balances, dues, pairCount, looseCount } = props
  return (
    <div className="flex flex-col gap-2">
      {/* Tarjetas por cuenta — grid compacto, todo cabe en pantalla sin deslizar */}
      <div>
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          Cuentas · {registers.length}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {registers.map((r) => {
            const bal = balances[r.id]
            const isCard = r.kind === "card"
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => props.onOpenAccount(r.id)}
                className={cn(
                  "rounded-xl border p-2 text-left active:scale-[0.98]",
                  r.isMain
                    ? "border-yellow-400/50 bg-yellow-400/[0.06]"
                    : "border-neutral-800 bg-neutral-900/70",
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
                <p className="mt-1 truncate text-[10px] font-bold leading-tight text-white">{r.name}</p>
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
          })}
          <button
            type="button"
            onClick={props.onAddAccount}
            className="flex min-h-[76px] flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-neutral-700 bg-transparent p-2 text-neutral-400 active:scale-[0.98]"
          >
            <Plus className="size-4" />
            <span className="text-[9px] font-bold">Agregar cuenta</span>
          </button>
        </div>
      </div>

      {/* Vencimientos — follow-up para pagar a tiempo */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          <CalendarClock className="size-3.5 text-amber-300" /> Próximos vencimientos
        </p>
        {dues.length === 0 ? (
          <p className="text-[11px] text-neutral-500">
            Sin fechas de pago configuradas. Agrega el día de pago en cada tarjeta.
          </p>
        ) : (
          <div className="space-y-1.5">
            {dues.slice(0, 5).map((d) => (
              <div key={d.accountId} className="flex items-center justify-between text-[12px]">
                <span className="truncate font-semibold text-neutral-200">{d.accountName}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-neutral-400">{d.nextDate.slice(5)}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-black",
                      d.daysUntil <= 0
                        ? "bg-rose-500/20 text-rose-300"
                        : d.daysUntil <= 5
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-neutral-800 text-neutral-300",
                    )}
                  >
                    {d.daysUntil <= 0 ? "¡HOY!" : `${d.daysUntil}d`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transferencias: reporte de emparejadas + sueltas */}
      <button
        type="button"
        onClick={props.onOpenTransfers}
        className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-left active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 text-[12px] font-bold text-neutral-200">
          <ArrowLeftRight className="size-4 text-cyan-300" /> Transferencias entre cuentas
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">{pairCount} ok</span>
          {looseCount > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{looseCount} sueltas</span>
          )}
        </span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MODAL — agregar cuenta (su register nace automáticamente)
// ---------------------------------------------------------------------------

export function AddAccountModal(props: {
  onClose: () => void
  onSave: (input: { name: string; kind: "bank" | "card"; limit?: number | null; dueDay?: number | null; balance?: number | null }) => void
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"bank" | "card">("bank")
  const [limit, setLimit] = useState("")
  const [dueDay, setDueDay] = useState("")
  const [balance, setBalance] = useState("")

  const canSave = name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={props.onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-white">Agregar cuenta</h3>
        <p className="mb-3 mt-0.5 text-[10px] text-neutral-500">Su register se genera automáticamente.</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">Nombre</label>
            <input
              type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Chase Checking, Amex Gold"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["bank", "card"] as const).map((k) => (
              <button
                key={k} type="button" onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold",
                  kind === k ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300" : "border-neutral-700 bg-neutral-900 text-neutral-300",
                )}
              >
                {k === "bank" ? <Landmark className="size-4" /> : <CreditCard className="size-4" />}
                {k === "bank" ? "Banco" : "Tarjeta"}
              </button>
            ))}
          </div>
          {kind === "card" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Límite</label>
                <input type="number" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="$"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400">Día de pago</label>
                <input type="number" inputMode="numeric" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="15"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400" />
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400">
              {kind === "card" ? "Deuda actual" : "Balance actual"}
            </label>
            <input type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="$0.00"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={props.onClose} className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-xs font-bold text-neutral-300">Cancelar</button>
            <button
              type="button" disabled={!canSave}
              onClick={() => props.onSave({
                name: name.trim(), kind,
                limit: limit ? parseFloat(limit) : null,
                dueDay: dueDay ? Math.min(31, Math.max(1, parseInt(dueDay) || 0)) || null : null,
                balance: balance ? parseFloat(balance) : 0,
              })}
              className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black disabled:opacity-40"
            >
              Crear register
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DETALLE — el register de UNA cuenta
// ---------------------------------------------------------------------------

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
  const [dueDraft, setDueDraft] = useState(r.dueDay ? String(r.dueDay) : "")
  const [balDraft, setBalDraft] = useState(r.manualBalance !== null && r.manualBalance !== undefined ? String(r.manualBalance) : "")

  const projectedBills = props.entries.filter((e) => e.status === "projected" && e.type === "expense")
  const projectedTotal = projectedBills.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const otherFundsSum = props.otherFunds.filter((o) => o.checked).reduce((s, o) => s + (o.balance || 0), 0)
  const baseBal = props.balance || 0
  const projectedClosing = Math.round((baseBal + otherFundsSum - projectedTotal) * 100) / 100

  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 active:scale-95" aria-label="Volver">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-white">{r.name}</p>
          <p className="text-[10px] text-neutral-500">
            {isCard ? "Credit card" : "Bank account"}{r.institution ? ` · ${r.institution}` : ""}{r.isMain ? " · ★ Principal" : ""}
          </p>
        </div>
        {!r.isMain && (
          <button type="button" onClick={() => props.onSetMain(r.id)} className="rounded-lg border border-neutral-700 px-2 py-1.5 text-[10px] font-bold text-neutral-300 active:scale-95" title="Marcar como cuenta principal">
            <span className="inline-flex items-center gap-1"><Star className="size-3" /> Principal</span>
          </button>
        )}
      </div>

      {/* Balance grande */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{isCard ? "Deuda actual" : "Balance"}</p>
        <p className={cn("mt-1 text-3xl font-black tabular-nums", (props.balance || 0) < 0 && !isCard ? "text-rose-400" : "text-emerald-400")}>
          {props.balance === null ? "—" : money(props.balance)}
        </p>
        {isCard && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-black/30 p-2">
              <p className="text-[9px] font-bold text-neutral-500">LÍMITE</p>
              <p className="text-sm font-extrabold text-neutral-200">{r.limit ? money(r.limit) : "—"}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-2">
              <p className="text-[9px] font-bold text-neutral-500">DISPONIBLE</p>
              <p className="text-sm font-extrabold text-cyan-300">{r.limit ? money(Math.max(0, r.limit - (props.balance || 0))) : "—"}</p>
            </div>
          </div>
        )}
        {r.isMain && (
          <div className="mt-2 rounded-xl bg-cyan-950/30 border border-cyan-800/40 p-2">
            <p className="text-[9px] font-bold text-cyan-300/80">CIERRE PROYECTADO</p>
            <p className={cn("text-lg font-black tabular-nums", projectedClosing >= 0 ? "text-cyan-300" : "text-rose-400")}>{money(projectedClosing)}</p>
            <p className="text-[9px] text-neutral-500">balance + otros fondos − bills por pagar</p>
          </div>
        )}
      </div>

      {/* Otros fondos — solo cuenta principal: balances de las demás, sin mezclar movimientos */}
      {r.isMain && props.otherFunds.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Otros fondos (solo suma al proyectado)</p>
          <div className="space-y-1.5">
            {props.otherFunds.map((o) => (
              <button key={o.reg.id} type="button" onClick={() => props.onToggleOtherFund(o.reg.id)} className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-left active:scale-[0.99]">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-neutral-200">
                  <span className={cn("flex size-4 items-center justify-center rounded border", o.checked ? "border-emerald-400 bg-emerald-500/20" : "border-neutral-600")}>
                    {o.checked && <CheckCircle2 className="size-3 text-emerald-300" />}
                  </span>
                  <span className="truncate">{o.reg.name}</span>
                </span>
                <span className="text-[12px] font-bold tabular-nums text-neutral-300">{o.balance === null ? "—" : money(o.balance)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos de ESTA cuenta */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Movimientos</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={props.onAddBill} className="rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-2 py-1.5 text-[10px] font-bold text-cyan-300 active:scale-95">+ Factura</button>
            <button type="button" onClick={props.onAddPost} className="rounded-lg bg-yellow-400 px-2 py-1.5 text-[10px] font-extrabold text-black active:scale-95">+ Recibo</button>
          </div>
        </div>
        {props.bankTxs.length === 0 && props.entries.length === 0 ? (
          <p className="rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-6 text-center text-[12px] text-neutral-500">Sin movimientos en esta cuenta.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-800">
            <table className="w-full table-fixed border-collapse text-left">
              <tbody className="divide-y divide-neutral-800/80">
                {props.bankTxs.map((t, i) => (
                  <tr key={`b-${i}`} className="bg-blue-950/10 text-[12px]">
                    <td className="p-1.5 align-top">
                      <div className="font-bold leading-tight text-neutral-200">{shortDate(t.date)}</div>
                    </td>
                    <td className="overflow-hidden p-1.5 align-top">
                      <div className="truncate font-semibold leading-tight text-neutral-100">{t.detail || "—"}</div>
                      <div className="mt-0.5 text-[10px] text-blue-400/90">Bank · {t.category || ""}</div>
                    </td>
                    <td className="p-1.5 text-right align-top">
                      <div className={cn("text-[13px] font-black tabular-nums", t.amount >= 0 ? "text-emerald-400" : "text-rose-400")}>{money(t.amount)}</div>
                    </td>
                  </tr>
                ))}
                {[...props.entries].reverse().map((row) => {
                  const isActual = row.status === "actual"
                  const signedAmt = row.type === "income" ? row.amount : -row.amount
                  return (
                    <tr key={row.id} className={cn("text-[12px]", isActual ? "bg-neutral-900/30" : "bg-emerald-950/15")}>
                      <td className="p-1.5 align-top">
                        <div className="font-bold leading-tight text-neutral-200">{shortDate(row.date)}</div>
                      </td>
                      <td className="overflow-hidden p-1.5 align-top" onClick={() => props.onEditEntry(row)} role="button">
                        <div className="truncate font-semibold leading-tight text-neutral-100">{row.description || "—"}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">{renderBadges(row)}</div>
                      </td>
                      <td className="p-1.5 text-right align-top">
                        <div className={cn("text-[13px] font-black tabular-nums", signedAmt >= 0 ? "text-emerald-400" : "text-rose-400")}>{money(signedAmt)}</div>
                        <div className="mt-1 flex justify-end gap-1">
                          <button type="button" onClick={() => props.onEditEntry(row)} className="p-1 text-neutral-500" title="Editar"><Pencil className="size-3" /></button>
                          <button type="button" onClick={() => props.onDeleteEntry(row.id)} className="p-1 text-neutral-500" title="Borrar"><Trash2 className="size-3" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ajustes de la cuenta */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Ajustes de cuenta</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-neutral-400">Día de pago</label>
            <div className="mt-1 flex gap-1">
              <input type="number" min={1} max={31} value={dueDraft} onChange={(e) => setDueDraft(e.target.value)}
                placeholder="—" className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-2 text-sm text-white outline-none" />
              <button type="button" onClick={() => { const v = parseInt(dueDraft) || 0; props.onSaveDueDay(r.id, v >= 1 && v <= 31 ? v : null); saveDueDay(r.id, v >= 1 && v <= 31 ? v : null) }}
                className="shrink-0 rounded-lg bg-neutral-800 px-2.5 text-[11px] font-bold text-neutral-200">OK</button>
            </div>
          </div>
          {r.source === "manual" && (
            <div>
              <label className="text-[10px] font-bold text-neutral-400">{isCard ? "Deuda actual" : "Balance"}</label>
              <div className="mt-1 flex gap-1">
                <input type="number" inputMode="decimal" value={balDraft} onChange={(e) => setBalDraft(e.target.value)}
                  placeholder="$0" className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={() => props.onSaveManualBalance(r.id, parseFloat(balDraft) || 0)}
                  className="shrink-0 rounded-lg bg-neutral-800 px-2.5 text-[11px] font-bold text-neutral-200">OK</button>
              </div>
            </div>
          )}
        </div>
        {r.source === "manual" && (
          <button type="button" onClick={() => { if (confirm(`Borrar la cuenta "${r.name}" y su register?`)) props.onDeleteManual(r.id) }}
            className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-rose-400">
            <AlertTriangle className="size-3.5" /> Borrar esta cuenta
          </button>
        )}
        {r.source === "snapshot" && (
          <p className="mt-2 text-[10px] leading-snug text-neutral-600">
            Cuenta del banco (feed). El balance viene del banco; no se edita aquí.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// REPORTE DE TRANSFERENCIAS — emparejadas + sueltas, sin duplicar ingreso
// ---------------------------------------------------------------------------

export function TransfersReport(props: {
  report: TransferReport
  autoReconciled: { billId: string; detail: string; amount: number; date: string }[]
  onBack: () => void
}) {
  const { report, autoReconciled } = props
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 active:scale-95" aria-label="Volver">
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <p className="text-[14px] font-extrabold text-white">Transferencias entre cuentas</p>
          <p className="text-[10px] text-neutral-500">El mismo dólar movido — nunca es ingreso nuevo.</p>
        </div>
      </div>

      {autoReconciled.length > 0 && (
        <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">Auto-conciliados</p>
          <div className="space-y-1">
            {autoReconciled.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 truncate text-neutral-200">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                  <span className="truncate">{a.detail}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums text-neutral-300">{money(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          Emparejadas · {report.pairs.length}
        </p>
        {report.pairs.length === 0 ? (
          <p className="text-[11px] text-neutral-500">No se detectaron transferencias en los movimientos del banco.</p>
        ) : (
          <div className="space-y-2">
            {report.pairs.map((p) => (
              <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-black tabular-nums text-cyan-300">{money(p.amount)}</span>
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">TRANSFER</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-300">
                  <span className="font-bold text-neutral-100">{p.outTx.bank_account}</span>
                  <span className="text-neutral-500"> → </span>
                  <span className="font-bold text-neutral-100">{p.inTx.bank_account}</span>
                </p>
                <p className="text-[10px] text-neutral-500">
                  {p.outDate} → {p.inDate} · {p.originLabel}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(report.unmatchedOut.length > 0 || report.unmatchedIn.length > 0) && (
        <div className="rounded-2xl border border-amber-800/50 bg-amber-950/15 p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300/80">
            Sueltas — revisar · {report.unmatchedOut.length + report.unmatchedIn.length}
          </p>
          <div className="space-y-1">
            {report.unmatchedOut.slice(0, 10).map((t, i) => (
              <div key={`o${i}`} className="flex items-center justify-between text-[11px]">
                <span className="truncate text-neutral-300">Sale · {t.bank_account} · {(t.detail || "").slice(0, 28)}</span>
                <span className="shrink-0 font-bold tabular-nums text-rose-300">{money(Number(t.amount))}</span>
              </div>
            ))}
            {report.unmatchedIn.slice(0, 10).map((t, i) => (
              <div key={`i${i}`} className="flex items-center justify-between text-[11px]">
                <span className="truncate text-neutral-300">Entra · {t.bank_account} · {(t.detail || "").slice(0, 28)}</span>
                <span className="shrink-0 font-bold tabular-nums text-emerald-300">{money(Number(t.amount))}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-neutral-500">Una suelta puede ser un gasto real o un ingreso real — o una transferencia sin su par.</p>
        </div>
      )}
    </div>
  )
}
