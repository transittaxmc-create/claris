"use client"

// Ajustes de una cuenta (dentro de su registro). Reactiva funciones que la app
// ya tenía conectadas pero sin botón en pantalla:
//   ★ principal · día de pago · saldo manual · otros fondos · borrar cuenta.
// Todo es reversible salvo "Borrar cuenta", que pide confirmación.

import { useEffect, useState } from "react"
import { ChevronDown, Star, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { money } from "./types"
import { accountDisplayName, type RegisterAccount } from "./registers-store"

const inputCls =
  "rounded-lg border bg-[#16161f] px-2.5 py-1.5 font-mono text-[13px] text-[#f2f3f7] outline-none focus:border-[#5b8cff]"
const saveCls =
  "rounded-lg bg-[#5b8cff] px-3 py-1.5 text-[11px] font-extrabold text-white active:scale-95 disabled:opacity-40"

/** Día de pago válido: vacío (quitar) o entero 1–31. */
export function parseDueDay(raw: string): { ok: boolean; value: number | null } {
  const t = raw.trim()
  if (t === "") return { ok: true, value: null }
  const n = Number(t)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? { ok: true, value: n } : { ok: false, value: null }
}

export function AccountSettings(props: {
  account: RegisterAccount
  balance: number | null
  otherFunds: { reg: RegisterAccount; balance: number | null; checked: boolean }[]
  onToggleOtherFund: (id: string) => void
  onSetMain: (id: string) => void
  onSaveDueDay: (id: string, day: number | null) => void
  onSaveManualBalance: (id: string, v: number) => void
  onDeleteManual: (id: string) => void
}) {
  const r = props.account
  const [open, setOpen] = useState(false)
  const [dueDay, setDueDay] = useState(r.dueDay ? String(r.dueDay) : "")
  const [manualBal, setManualBal] = useState(
    r.source === "manual" && props.balance !== null ? String(props.balance) : "",
  )
  const [aviso, setAviso] = useState<string | null>(null)

  // Si cambia de cuenta o el valor guardado, refrescar los campos.
  useEffect(() => {
    setDueDay(r.dueDay ? String(r.dueDay) : "")
  }, [r.id, r.dueDay])
  useEffect(() => {
    setManualBal(r.source === "manual" && props.balance !== null ? String(props.balance) : "")
  }, [r.id, r.source, props.balance])

  const flash = (msg: string) => {
    setAviso(msg)
    window.setTimeout(() => setAviso(null), 1800)
  }

  const due = parseDueDay(dueDay)
  const saldoValido = manualBal.trim() !== "" && Number.isFinite(Number(manualBal))

  return (
    <div className="shrink-0 rounded-[14px] border border-[#262633] bg-[#111119]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#9a9cb0]">Account settings</span>
        <ChevronDown className={cn("size-4 text-[#9a9cb0] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#262633] px-3 pb-3 pt-2.5">
          {aviso && (
            <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-2 py-1 text-[11px] font-semibold text-emerald-300">
              {aviso}
            </p>
          )}

          {/* ★ Principal */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-[#f2f3f7]">Primary account</span>
            {r.isMain ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#f5b84c]">
                <Star className="size-3 fill-[#f5b84c]" /> It's the primary
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  props.onSetMain(r.id)
                  flash("Now the primary account ★")
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#f5b84c]/50 bg-[#f5b84c]/10 px-2.5 py-1 text-[11px] font-bold text-[#f5b84c] active:scale-95"
              >
                <Star className="size-3" /> Make primary
              </button>
            )}
          </div>

          {/* Día de pago */}
          <div>
            <label htmlFor={`due-${r.id}`} className="text-[12px] text-[#f2f3f7]">
              Due day {r.kind === "card" ? "(goes into the projection)" : "(optional)"}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`due-${r.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="1–31"
                className={cn(inputCls, "w-24", due.ok ? "border-[#262633]" : "border-rose-500")}
              />
              <button
                type="button"
                disabled={!due.ok}
                onClick={() => {
                  props.onSaveDueDay(r.id, due.value)
                  flash(due.value ? `Due day: ${due.value}` : "Due day removed")
                }}
                className={saveCls}
              >
                Save
              </button>
            </div>
            {!due.ok && <p className="mt-1 text-[10px] text-rose-300">Enter a day between 1 and 31.</p>}
          </div>

          {/* Saldo manual (solo cuentas manuales: Venmo, Square, efectivo…) */}
          {r.source === "manual" && (
            <div>
              <label htmlFor={`bal-${r.id}`} className="text-[12px] text-[#f2f3f7]">
                {r.kind === "card" ? "Current debt" : "Current balance"} (manual)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={`bal-${r.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={manualBal}
                  onChange={(e) => setManualBal(e.target.value)}
                  placeholder="0.00"
                  className={cn(inputCls, "w-32 border-[#262633]")}
                />
                <button
                  type="button"
                  disabled={!saldoValido}
                  onClick={() => {
                    props.onSaveManualBalance(r.id, Number(manualBal))
                    flash(`Balance saved: ${money(Number(manualBal))}`)
                  }}
                  className={saveCls}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Otros fondos: ahora viven como checkmarks en la lista de MONEY (2026-10-19) */}

          {/* Delete account manual (las del banco no se borran desde aquí; las fijas tampoco) */}
          {r.source === "manual" && !r.pinned && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete the account "${r.name}"? Its ledger entries are not deleted.`)) {
                  props.onDeleteManual(r.id)
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 active:scale-95"
            >
              <Trash2 className="size-3.5" /> Delete account
            </button>
          )}
        </div>
      )}
    </div>
  )
}

