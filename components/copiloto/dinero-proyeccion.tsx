"use client"

// DINERO · Vista PROYECTADO (estilo Quicken).
// Toda la matemática vive en dinero-forecast.ts (puro y probado); este
// componente solo lee recurrentes / descartes y pinta el resultado.

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, CreditCard, Receipt, Repeat, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry, type ScheduledEntry } from "./types"
import { accountDisplayName, type DueItem, type RegisterAccount } from "./registers-store"
import {
  FREQ_LABEL,
  buildForecast,
  daysToEndOfMonth,
  startingBalance,
  todayKey,
  type ForecastBankTx,
  type ForecastLine,
} from "./dinero-forecast"
import { FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT, FORECAST_DISMISSED_KEY } from "./finance-sync"

type Horizon = "mes" | 30 | 60 | 90
const HORIZONS: { value: Horizon; label: string }[] = [
  { value: "mes", label: "Fin de mes" },
  { value: 30, label: "30 días" },
  { value: 60, label: "60 días" },
  { value: 90, label: "90 días" },
]

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

function fechaCorta(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1] || ""}` : "—"
}

function fechaDia(iso: string, today: string): string {
  if (iso === today) return "Hoy"
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return "—"
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  return `${DIAS[d.getDay()]} ${fechaCorta(iso)}`
}

function readList<T>(key: string): T[] {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(p) ? (p as T[]) : []
  } catch {
    return []
  }
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "\u2212"}${money(Math.abs(n))}`
}

function KindBadge({ line }: { line: ForecastLine }) {
  const base = "inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0.5 text-[9px] font-semibold"
  if (line.kind === "rec")
    return (
      <span className={cn(base, "border-violet-500/30 bg-violet-500/10 text-violet-300")}>
        <Repeat className="size-2.5" /> {line.frequency ? FREQ_LABEL[line.frequency] : "recurrente"}
      </span>
    )
  if (line.kind === "card")
    return (
      <span className={cn(base, "border-purple-500/30 bg-purple-500/10 text-purple-300")}>
        <CreditCard className="size-2.5" /> Tarjeta
      </span>
    )
  if (line.kind === "overdue")
    return (
      <span className={cn(base, "border-amber-500/30 bg-amber-500/10 text-amber-300")}>
        <AlertTriangle className="size-2.5" /> Vencida {line.originalDate ? fechaCorta(line.originalDate) : ""}
      </span>
    )
  const income = line.amount >= 0
  return (
    <span
      className={cn(
        base,
        income ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
      )}
    >
      {income ? <TrendingUp className="size-2.5" /> : <Receipt className="size-2.5" />} {income ? "Ingreso" : "Factura"}
    </span>
  )
}

export function DineroProyeccion(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  entries: CashFlowEntry[]
  bankTxs: ForecastBankTx[]
  bankOk: boolean
  /** Ids de cuentas marcadas como "otros fondos" (suman al balance inicial). */
  otherFunds: string[]
  onEditEntry?: (e: CashFlowEntry) => void
  /** Confirmar "ya pagado": pasa el movimiento del libro a real (fecha del banco). */
  onMarkPaid?: (e: CashFlowEntry, paidDate: string) => void
}) {
  const [horizon, setHorizon] = useState<Horizon>("mes")
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [verDias, setVerDias] = useState(false)

  // Recurrentes y descartes: se releen al montar y cuando el sync trae cambios.
  useEffect(() => {
    const load = () => {
      setSchedules(readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY))
      setDismissed(readList<string>(FORECAST_DISMISSED_KEY).filter((x) => typeof x === "string"))
    }
    load()
    window.addEventListener(FINANCE_SYNCED_EVENT, load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener(FINANCE_SYNCED_EVENT, load)
      window.removeEventListener("storage", load)
    }
  }, [])

  const today = todayKey()
  const horizonDays = horizon === "mes" ? daysToEndOfMonth(today) : horizon

  const inicio = useMemo(
    () => startingBalance(props.registers, props.balances, props.otherFunds),
    [props.registers, props.balances, props.otherFunds],
  )

  const fc = useMemo(
    () =>
      buildForecast({
        startBalance: inicio.value,
        entries: props.entries,
        schedules,
        dues: props.dues,
        balances: props.balances,
        // Sin banco no hay auto-match (nunca se da por pagado algo sin evidencia).
        bankTxs: props.bankOk ? props.bankTxs : [],
        today,
        horizonDays,
        dismissedPaid: dismissed,
      }),
    [inicio.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, horizonDays, dismissed],
  )

  const descartar = (key: string) => {
    const next = dismissed.includes(key) ? dismissed : [...dismissed, key]
    setDismissed(next)
    try {
      localStorage.setItem(FORECAST_DISMISSED_KEY, JSON.stringify(next))
    } catch {}
  }

  const mainName = inicio.mainId
    ? accountDisplayName(props.registers.find((r) => r.id === inicio.mainId)?.name || "").title
    : null
  const diasConMov = fc.days.filter((d) => d.lines.length > 0)

  return (
    <>
      <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300/80">
        🔮 Proyectado · hasta {fechaCorta(fc.endDate)}
      </p>

      {/* Horizonte */}
      <div className="grid grid-cols-4 gap-1">
        {HORIZONS.map((h) => (
          <button
            key={String(h.value)}
            type="button"
            onClick={() => setHorizon(h.value)}
            className={cn(
              "rounded-lg border py-1.5 text-[10px] font-bold",
              horizon === h.value
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                : "border-neutral-800 bg-neutral-900 text-neutral-400",
            )}
          >
            {h.label}
          </button>
        ))}
      </div>


      {/* Fórmula: inicial + ingresos − gastos = proyectado */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3">
        <div className="space-y-1 text-[12px]">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-neutral-300">
              Balance inicial
              <span className="block text-[10px] text-neutral-500">
                {inicio.usedFallback
                  ? "Sin saldo de la cuenta ★ — suma de bancos"
                  : `${mainName || "Cuenta ★"}${inicio.extras.length ? ` + ${inicio.extras.length} fondo(s)` : ""}`}
              </span>
            </span>
            <span className={cn("font-mono font-bold tabular-nums", fc.start < 0 ? "text-rose-400" : "text-white")}>
              {money(fc.start)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-300">+ Ingresos ({fc.incomeCount})</span>
            <span className="font-mono font-bold tabular-nums text-emerald-400">{money(fc.incomeTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-300">− Gastos ({fc.expenseCount})</span>
            <span className="font-mono font-bold tabular-nums text-rose-400">{money(fc.expenseTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-cyan-500/20 pt-1.5">
            <span className="font-bold text-cyan-300">= Balance proyectado</span>
            <span className={cn("font-mono text-lg font-black tabular-nums", fc.end < 0 ? "text-rose-400" : "text-cyan-300")}>
              {money(fc.end)}
            </span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="rounded-lg border border-neutral-800 bg-black/40 px-2 py-1">
            <span className="block text-neutral-500">Punto más bajo</span>
            <span className={cn("font-mono font-bold", fc.lowest.balance < 0 ? "text-rose-400" : "text-neutral-200")}>
              {money(fc.lowest.balance)}
            </span>{" "}
            <span className="text-neutral-500">· {fechaDia(fc.lowest.date, today)}</span>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-black/40 px-2 py-1">
            <span className="block text-neutral-500">Incluye</span>
            <span className="text-neutral-300">
              {fc.recurringCount} recurrente(s) · {fc.cardCount} tarjeta(s)
            </span>
          </div>
        </div>
        {fc.lowest.balance < 0 && (
          <p className="mt-2 flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300">
            <AlertTriangle className="size-3.5 shrink-0" /> El saldo queda en negativo el {fechaDia(fc.lowest.date, today)}.
          </p>
        )}
        {!props.bankOk && (
          <p className="mt-2 text-[10px] text-amber-300/90">
            Banco sin sincronizar: no se detectan pagos ya hechos. Pulsa SYNC.
          </p>
        )}
      </div>


      {/* Ya salieron del banco: no se restan dos veces. El usuario confirma o descarta. */}
      {fc.probablePaid.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
            Probablemente pagado · {fc.probablePaid.length}
          </p>
          <p className="mb-2 text-[10px] text-neutral-400">Encontrado en el banco: ya no se resta. Confirma o descarta.</p>
          <div className="space-y-1.5">
            {fc.probablePaid.map((p) => (
              <div key={p.key} className="rounded-lg border border-neutral-800 bg-black/40 px-2 py-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-neutral-200">{p.entry.description || "Movimiento"}</span>
                  <span className="shrink-0 font-mono font-bold text-neutral-300">{money(Math.abs(Number(p.entry.amount) || 0))}</span>
                </div>
                <p className="truncate text-[10px] text-neutral-500">
                  Banco {fechaCorta(p.tx.date)} · {p.tx.detail} · {money(Math.abs(p.tx.amount))}
                </p>
                <div className="mt-1 flex gap-1.5">
                  {props.onMarkPaid && (
                    <button
                      type="button"
                      onClick={() => props.onMarkPaid?.(p.entry, String(p.tx.date).slice(0, 10))}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200"
                    >
                      <Check className="size-3" /> Sí, pagado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => descartar(p.key)}
                    className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
                  >
                    <X className="size-3" /> No es este
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingresos con fecha pasada que no llegaron: fuera del total. */}
      {fc.overdueIncome.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">
            Ingresos atrasados · {money(fc.overdueIncomeTotal)}
          </p>
          <p className="mb-1.5 text-[10px] text-neutral-400">No llegaron y no se cuentan en el proyectado.</p>
          <div className="space-y-1">
            {fc.overdueIncome.map((ln) => (
              <button
                key={ln.id}
                type="button"
                onClick={() => ln.entry && props.onEditEntry?.(ln.entry)}
                className="flex w-full items-center justify-between gap-2 text-left text-[12px]"
              >
                <span className="min-w-0 truncate text-neutral-300">
                  {ln.label} <span className="text-[10px] text-neutral-500">· {fechaCorta(ln.originalDate || ln.date)}</span>
                </span>
                <span className="shrink-0 font-mono text-amber-300">{money(Math.abs(ln.amount))}</span>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Movimientos proyectados */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            Movimientos · {fc.lines.length}
          </p>
          <button
            type="button"
            onClick={() => setVerDias((v) => !v)}
            className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
          >
            {verDias ? "Lista" : "Día a día"}
          </button>
        </div>
        {fc.lines.length === 0 ? (
          <p className="text-[11px] text-neutral-500">Sin movimientos proyectados en este periodo.</p>
        ) : verDias ? (
          <div className="space-y-2">
            {diasConMov.map((d) => (
              <div key={d.date}>
                <div className="flex items-center justify-between border-b border-neutral-800 pb-0.5 text-[10px] font-bold uppercase text-neutral-500">
                  <span>{fechaDia(d.date, today)}</span>
                  <span className={cn("font-mono", d.balance < 0 ? "text-rose-400" : "text-neutral-300")}>
                    Saldo {money(d.balance)}
                  </span>
                </div>
                {d.lines.map((ln) => (
                  <LineRow key={ln.id} line={ln} today={today} showDate={false} onEdit={props.onEditEntry} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {fc.lines.map((ln) => (
              <LineRow key={ln.id} line={ln} today={today} showDate onEdit={props.onEditEntry} />
            ))}
          </div>
        )}
        {(fc.duplicatesSkipped > 0 || fc.recurringPaidSkipped > 0 || fc.beyondHorizonCount > 0) && (
          <p className="mt-2 border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
            {[
              fc.duplicatesSkipped ? `${fc.duplicatesSkipped} recurrente(s) ya en el libro` : "",
              fc.recurringPaidSkipped ? `${fc.recurringPaidSkipped} ya pagado(s) en el banco` : "",
              fc.beyondHorizonCount ? `${fc.beyondHorizonCount} después del ${fechaCorta(fc.endDate)}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    </>
  )
}

function LineRow(props: { line: ForecastLine; today: string; showDate: boolean; onEdit?: (e: CashFlowEntry) => void }) {
  const { line: ln } = props
  const editable = !!ln.entry && !!props.onEdit
  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => ln.entry && props.onEdit?.(ln.entry)}
      className="flex w-full items-center justify-between gap-2 py-0.5 text-left text-[12px] disabled:cursor-default"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold text-neutral-200">{ln.label}</span>
        <span className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-500">
          {props.showDate && <span>{fechaDia(ln.date, props.today)}</span>}
          <KindBadge line={ln} />
        </span>
      </span>
      <span className={cn("shrink-0 font-mono font-bold tabular-nums", ln.amount >= 0 ? "text-emerald-400" : "text-rose-400")}>
        {signed(ln.amount)}
      </span>
    </button>
  )
}

