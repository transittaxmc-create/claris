"use client"

// DINERO · Vista PROYECTADO (estilo Quicken).
// Toda la matemática vive en dinero-forecast.ts (puro y probado); este
// componente solo lee recurrentes / descartes y pinta el resultado.

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, CreditCard, Pencil, Receipt, Repeat, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { money, type CashFlowEntry, type ScheduledEntry } from "./types"
import { accountDisplayName, type DueItem, type RegisterAccount } from "./registers-store"
import {
  FREQ_LABEL,
  buildForecast,
  daysToEndOfMonth,
  r2,
  startingBalance,
  todayKey,
  type ForecastBankTx,
  type ForecastLine,
  type Forecast,
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

/**
 * Recurrentes + descartes de "probablemente pagado", releídos al montar y
 * cuando el sync o otra pestaña los cambian. Compartido por la franja MONEY y
 * la vista Projections para que ambas muestren el mismo número.
 */
export function useForecastInputs(): {
  schedules: ScheduledEntry[]
  dismissed: string[]
  setDismissed: (next: string[]) => void
} {
  const [schedules, setSchedules] = useState<ScheduledEntry[]>([])
  const [dismissed, setDismissedState] = useState<string[]>([])
  useEffect(() => {
    const load = () => {
      setSchedules(readList<ScheduledEntry>(FINANCE_SCHEDULES_KEY))
      setDismissedState(readList<string>(FORECAST_DISMISSED_KEY).filter((x) => typeof x === "string"))
    }
    load()
    window.addEventListener(FINANCE_SYNCED_EVENT, load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener(FINANCE_SYNCED_EVENT, load)
      window.removeEventListener("storage", load)
    }
  }, [])
  const setDismissed = (next: string[]) => {
    setDismissedState(next)
    try {
      localStorage.setItem(FORECAST_DISMISSED_KEY, JSON.stringify(next))
    } catch {}
  }
  return { schedules, dismissed, setDismissed }
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
  /** Edición inline desde el registro proyectado: monto / fecha / descripción. */
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  /** Día vacío en el registro → alta de asiento con esa fecha preseleccionada. */
  onAddEntry?: (dateIso: string) => void
  /** Confirmar "ya pagado": pasa el movimiento del libro a real (fecha del banco). */
  onMarkPaid?: (e: CashFlowEntry, paidDate: string) => void
}) {
  // 90 días FIJOS: todo el register de proyecciones se recorre con scroll
  // dentro de su caja (se eliminaron el título 🔮 y el selector de horizonte).
  const [horizon] = useState<Horizon>(90)
  const [verDias, setVerDias] = useState(false)
  // Recurrentes y descartes: se releen al montar y cuando el sync trae cambios.
  const { schedules, dismissed, setDismissed } = useForecastInputs()

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
    setDismissed(dismissed.includes(key) ? dismissed : [...dismissed, key])
  }

  const mainName = inicio.mainId
    ? accountDisplayName(props.registers.find((r) => r.id === inicio.mainId)?.name || "").title
    : null
  return (
    <>
      {/* Registro de proyecciones a 90 días — sin título ni selector de
          horizonte: el register completo se navega con scroll en su caja. */}


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


      {/* Registro proyectado — columnas estilo Register, un día por fila, scroll hasta 90 días. */}
      <ProjectionRegister
        fc={fc}
        today={today}
        onEditEntry={props.onEditEntry}
        onPatchEntry={props.onPatchEntry}
        onAddEntry={props.onAddEntry}
        verDias={verDias}
        setVerDias={setVerDias}
      />
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


// ---------------------------------------------------------------------------
// Registro proyectado — FECHA · DESCRIPCIÓN · MONTO · SALDO ACUM. · BAL. PROYECTADO
// Una fila por día consecutivo (hoy → horizonte, hasta 90/91 filas) dentro de una
// caja con scroll. Saldo acumulado = asientos del libro; saldo proyectado = todo el
// horizonte (recurrentes, tarjetas, vencidos). La diferencia muestra dónde el dinero
// se pone débil; el saldo proyectado en rojo marca el quiebre.
// ---------------------------------------------------------------------------

type ProjRow = { line: ForecastLine | null; amount: number; balAcum: number; balProy: number }

function ProjectionRegister(props: {
  fc: Forecast
  today: string
  onEditEntry?: (e: CashFlowEntry) => void
  onPatchEntry?: (id: string, patch: Partial<CashFlowEntry>) => void
  onAddEntry?: (dateIso: string) => void
  verDias: boolean
  setVerDias: (v: boolean) => void
}) {
  const { fc, today, verDias } = props

  const rows = useMemo(() => {
    let acum = r2(fc.start)
    let proy = r2(fc.start)
    const out: ProjRow[] = []
    for (const d of fc.days) {
      for (const ln of d.lines) {
        proy = r2(proy + ln.amount)
        if (ln.kind === "proj" || ln.kind === "overdue") acum = r2(acum + ln.amount)
        out.push({ line: ln, amount: ln.amount, balAcum: acum, balProy: proy })
      }
      if (d.lines.length === 0) out.push({ line: null, amount: 0, balAcum: acum, balProy: proy })
    }
    return out
  }, [fc])

  const totalDias = fc.days.length
  const negDays = useMemo(() => fc.days.filter((d) => d.balance < 0).length, [fc])
  // Registro por FECHA | DESCRIPCIÓN | MONTO | SALDO ACUM. | BAL. PROYECTADO
  const cols = "grid grid-cols-[3.75rem_minmax(0,1fr)_4.75rem_5rem_5rem] gap-1"

  function descripcionDe(ln: ForecastLine): string {
    const d = String((ln.entry && (ln.entry.description || (ln.entry as any).detail)) || ln.label || "—")
    return d.slice(0, 28)
  }

  // AI FOLLOW · PAGAR A TIEMPO: facturas por pagar del horizonte + veredicto
  // de solvencia en su fecha (¿alcanza el balance ese día?).
  const porPagar = useMemo(
    () => fc.lines.filter((ln) => ln.amount < 0).sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [fc],
  )
  const balPorDia = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of fc.days) m.set(d.date, d.balance)
    return m
  }, [fc])
  const primeraDebil = useMemo(() => fc.days.find((d) => d.balance < 0) || null, [fc])

  function veredictoPago(ln: ForecastLine): { ok: boolean | null; falta: number } {
    const bal = balPorDia.get(String(ln.date).slice(0, 10))
    if (bal === undefined) return { ok: null, falta: 0 }
    return { ok: bal >= 0, falta: bal < 0 ? r2(-bal) : 0 }
  }

  const aiPagarATiempo = (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
      <p className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-amber-300">
        <span>AI · Pagar a tiempo</span>
        <span className="font-mono text-[9px] font-bold text-neutral-400">{porPagar.length} por pagar</span>
      </p>
      {porPagar.length === 0 && (
        <p className="text-[11px] text-neutral-400">Sin facturas pendientes en el horizonte. ✓</p>
      )}
      {porPagar.length > 0 && (
        <div className="space-y-1">
          {porPagar.map((ln) => {
            const v = veredictoPago(ln)
            const vencida = ln.kind === "overdue"
            return (
              <div key={ln.id} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-950/60 px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="w-14 shrink-0 font-mono text-[10px] font-semibold text-neutral-400">
                    {vencida ? "VENCIDA" : fechaCorta(String(ln.date).slice(0, 10))}
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-semibold text-neutral-100">{descripcionDe(ln)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-rose-300">{signed(-Math.abs(ln.amount))}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                      vencida
                        ? "bg-amber-400/15 text-amber-300"
                        : v.ok === true
                          ? "bg-emerald-400/15 text-emerald-300"
                          : v.ok === false
                            ? "bg-rose-400/15 text-rose-300"
                            : "bg-neutral-700/40 text-neutral-300",
                    )}
                  >
                    {vencida ? "PAGAR HOY" : v.ok === true ? "ALCANZA ✓" : v.ok === false ? `FALTAN ${money(v.falta)}` : "—"}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
      {primeraDebil && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-300">
          <AlertTriangle className="size-3 shrink-0" />
          Primera debilidad: {fechaCorta(primeraDebil.date)} · el balance cae a {money(primeraDebil.balance)}
        </p>
      )}
    </div>
  )

  // Vista lista (la de siempre) como alternativa al registro.
  if (verDias) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            Movimientos · {fc.lines.length}
          </p>
          <button
            type="button"
            onClick={() => props.setVerDias(false)}
            className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
          >
            Registro
          </button>
        </div>

        {aiPagarATiempo}
        {fc.lines.length === 0 ? (
          <p className="text-[11px] text-neutral-500">Sin movimientos proyectados en este periodo.</p>
        ) : (
          <div className="space-y-1">
            {fc.lines.map((ln) => (
              <LineRow key={ln.id} line={ln} today={today} showDate onEdit={props.onEditEntry} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Registro por defecto: días consecutivos con scroll.
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          Registro proyectado · {totalDias} días
        </p>
        <button
          type="button"
          onClick={() => props.setVerDias(true)}
          className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-300"
        >
          Lista
        </button>
      </div>

      {aiPagarATiempo}

      <div className={cn(cols, "border-b border-neutral-800 pb-1 text-[9px] font-black uppercase tracking-wide")}>
        <span className="text-neutral-400">Fecha</span>
        <span className="text-neutral-400">Descripción</span>
        <span className="text-right text-neutral-400">Monto</span>
        <span className="text-right text-neutral-400">Saldo acum.</span>
        <span className="text-right text-cyan-300">Bal. proyectado</span>
      </div>

      <div className="max-h-[min(58vh,480px)] min-h-[220px] overflow-y-auto overscroll-contain">
        {rows.length === 0 && (
          <p className="px-2 py-8 text-center text-[12px] text-neutral-500">Sin días en el horizonte.</p>
        )}
        {rows.map((r, i) => {
          const ln = r.line
          const fecha = ln ? ln.date : fc.days[i]?.date || today
          const editable = !!ln?.entry && !!props.onEditEntry && !!props.onPatchEntry
          const rojo = r.balProy < 0
          const primeroDelDia = i === 0 || rows[i - 1].line?.date !== fecha

          const cells = (
            <>
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold",
                  fecha === today ? "text-cyan-300" : "text-neutral-400",
                )}
              >
                {fecha === today ? "Hoy" : primeroDelDia ? fechaCorta(fecha) : ""}
              </span>
              <span className="flex min-w-0 items-center gap-1">
                <span
                  className={cn(
                    "truncate text-[12px] font-semibold",
                    ln ? (rojo ? "text-rose-200" : "text-neutral-100") : "text-neutral-600",
                  )}
                >
                  {ln ? descripcionDe(ln) : "sin movimiento"}
                </span>
                {ln && <KindBadge line={ln} />}
              </span>
              {ln ? (
                editable ? (
                  <AmountCell line={ln} entry={ln.entry!} patch={props.onPatchEntry!} />
                ) : (
                  <span
                    className={cn(
                      "text-right font-mono text-[12px] font-bold tabular-nums",
                      ln.amount >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {signed(ln.amount)}
                  </span>
                )
              ) : (
                <span className="text-right text-neutral-700">—</span>
              )}
              <span
                className={cn(
                  "text-right font-mono text-[12px] font-bold tabular-nums",
                  r.balAcum < 0 ? "text-rose-400" : "text-neutral-200",
                )}
              >
                {money(r.balAcum)}
              </span>
              <span
                className={cn(
                  "text-right font-mono text-[12px] font-bold tabular-nums",
                  rojo ? "bg-rose-500/10 text-rose-400" : "text-cyan-200",
                )}
              >
                {money(r.balProy)}
              </span>
            </>
          )

          // Día con asiento → clic abre el editor completo. Día vacío → alta con esa fecha.
          if (ln) {
            return (
              <div key={ln.id} className={cn(cols, "items-center border-b border-neutral-900/80 py-1.5", rojo && "bg-rose-500/5")}>
                {props.onEditEntry && ln.entry ? (
                  <button
                    type="button"
                    onClick={() => props.onEditEntry?.(ln.entry!)}
                    className="flex w-full items-center gap-1 text-left active:bg-neutral-900/60"
                  >
                    {cells}
                  </button>
                ) : (
                  cells
                )}
              </div>
            )
          }
          return (
            <button
              key={`d:${fecha}`}
              type="button"
              onClick={() => props.onAddEntry?.(fecha)}
              className={cn(
                cols,
                "w-full items-center border-b border-neutral-900/80 py-1.5 text-left active:bg-neutral-900/60",
              )}
            >
              {cells}
            </button>
          )
        })}
      </div>

      <p className="mt-1.5 flex items-center justify-between gap-2 border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
        <span>
          {totalDias} días seguidos ·{" "}
          {negDays > 0 ? <span className="font-bold text-rose-400">{negDays} en rojo</span> : "sin quiebres"}
        </span>
      </p>
    </div>
  )
}

/** Monto editable inline en el registro: Enter/blur guarda el cambio en el libro. */
function AmountCell(props: {
  line: ForecastLine
  entry: CashFlowEntry
  patch: (id: string, p: Partial<CashFlowEntry>) => void
}) {
  const { entry } = props
  const income = entry.type === "income"
  const signo = income ? 1 : -1
  const guardar = (raw: string) => {
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return
    const norm = r2(Math.abs(n) * signo)
    if (norm === r2(Number(entry.amount) || 0)) return
    props.patch(entry.id, { amount: norm, isManuallyEdited: true })
  }
  return (
    <span className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <span className={cn("font-mono text-[11px] font-bold", income ? "text-emerald-500" : "text-rose-500")}>
        {income ? "+" : "\u2212"}
      </span>
      <input
        key={`${entry.id}:${entry.amount}`}
        type="number"
        step="0.01"
        inputMode="decimal"
        defaultValue={String(Math.abs(Number(entry.amount) || 0) || "")}
        onBlur={(e) => guardar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Monto de ${entry.description || props.line.label}`}
        className={cn(
          "w-[3.5rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-[12px] font-bold tabular-nums outline-none",
          "focus:border-neutral-600 focus:bg-neutral-900",
          income ? "text-emerald-400" : "text-rose-400",
        )}
      />
    </span>
  )
}

/** Nota al pie: lo que el motor dejó fuera del horizonte. */
function FootNotes({ fc }: { fc: Forecast }) {
  if (fc.duplicatesSkipped <= 0 && fc.recurringPaidSkipped <= 0 && fc.beyondHorizonCount <= 0) return null
  return (
    <p className="mt-2 border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
      {[
        fc.duplicatesSkipped ? `${fc.duplicatesSkipped} recurrente(s) ya en el libro` : "",
        fc.recurringPaidSkipped ? `${fc.recurringPaidSkipped} ya pagado(s) en el banco` : "",
        fc.beyondHorizonCount ? `${fc.beyondHorizonCount} después del ${fechaCorta(fc.endDate)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  )
}

