"use client"

// DATA → ACCOUNTS (diseño de Miguel, 2026-11-13): la lista COMPLETA de
// cuentas vive aquí, cada una con dos controles:
//   1. Switch de ACTIVA — apagada: no aparece en MONEY y cuenta $0 en
//      Proyecciones (ni su balance ni sus pagos proyectados); su register
//      sigue intacto y actualizándose, y se abre tocando la fila.
//      Prendida: aparece en MONEY y cuenta en Proyecciones.
//   2. ★ PRIMARIA — solo una a la vez; es la base de Proyecciones. Marcar
//      otra le quita la ★ a la anterior sola, y la nueva se activa si
//      estaba apagada. La primaria no se puede apagar.
// Cambiar la primaria deja de ser un cambio de código: es este ajuste.

import { useEffect, useMemo, useState } from "react"
import { Landmark, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { money } from "./types"
import {
  accountBalance,
  accountDisplayName,
  accountIdFor,
  buildRegisters,
  last4Of,
  type RegisterAccount,
} from "./registers-store"
import { bankBrandOf } from "./bank-brand"
import { BankLogo } from "./money-ui"
import {
  ACCOUNT_FLAGS_EVENT,
  resolveAccountFlags,
  setAccountActive,
  setPrimaryAccount,
} from "./account-flags"
import { loadShotTxs, pendingShotsSum, SHOTS_CHANGED_EVENT } from "./screenshot-txs"

interface SnapAccount {
  name?: string
  current_balance?: number
  institution?: string | null
  mask?: string | null
  type?: string | null
}

interface SnapTx {
  date?: string
  bank_account?: string
  amount?: number
}

export function AccountsPanel(props: { onOpenAccount?: (id: string) => void }) {
  const [snapAccounts, setSnapAccounts] = useState<SnapAccount[]>([])
  const [snapTxs, setSnapTxs] = useState<SnapTx[]>([])
  const [feedError, setFeedError] = useState(false)
  const [tick, setTick] = useState(0)

  // Mismo feed que usa MONEY: el snapshot del banco.
  useEffect(() => {
    let vivo = true
    fetch(`/api/bank/snapshot?refresh=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bank feed failed"))))
      .then((j) => {
        if (!vivo) return
        setSnapAccounts(Array.isArray(j.accounts) ? j.accounts : [])
        setSnapTxs(Array.isArray(j.transactions) ? j.transactions : [])
      })
      .catch(() => {
        if (vivo) setFeedError(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  // Cambios de banderas (aquí o en otro lado) y de screenshots: recalcular.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener(ACCOUNT_FLAGS_EVENT, bump)
    window.addEventListener(SHOTS_CHANGED_EVENT, bump)
    window.addEventListener("storage", bump)
    return () => {
      window.removeEventListener(ACCOUNT_FLAGS_EVENT, bump)
      window.removeEventListener(SHOTS_CHANGED_EVENT, bump)
      window.removeEventListener("storage", bump)
    }
  }, [])

  const registers = useMemo(
    () => buildRegisters(snapAccounts as any),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapAccounts, tick],
  )

  // El MISMO balance que muestra MONEY: el del feed/manual más los
  // provisionales de screenshot que el feed aún no trae.
  const balances = useMemo(() => {
    const out: Record<string, number | null> = {}
    const allShots = loadShotTxs()
    for (const r of registers) {
      let b = accountBalance(r, snapAccounts as any)
      if (b != null && allShots.length > 0) {
        if (r.source !== "manual") {
          const exact = snapTxs.filter((t) => accountIdFor(String(t.bank_account || "")) === r.id)
          const txs =
            exact.length > 0
              ? exact
              : snapTxs.filter((t) => last4Of(String(t.bank_account || "")) === last4Of(r.name))
          const adj = pendingShotsSum(allShots, r.id, txs as any)
          if (adj) b = Math.round((b + adj) * 100) / 100
        } else {
          const adj = pendingShotsSum(allShots, r.id, [])
          if (adj) b = Math.round((b + adj) * 100) / 100
        }
      }
      out[r.id] = b
    }
    return out
  }, [registers, snapAccounts, snapTxs])

  const flags = useMemo(
    () => resolveAccountFlags(registers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registers, tick],
  )
  const activeSet = new Set(flags.activeIds)

  // Orden del panel: la primaria primero, luego las activas, luego el
  // resto — dentro de cada grupo, alfabético por nombre visible.
  const ordered = [...registers].sort((a, b) => {
    const rank = (r: RegisterAccount) =>
      r.id === flags.primaryId ? 0 : activeSet.has(r.id) ? 1 : 2
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    return accountDisplayName(a.name).title.localeCompare(accountDisplayName(b.name).title)
  })

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 flex items-center gap-2">
        <Landmark className="size-4 text-yellow-400" />
        <h2 className="text-xs font-bold tracking-wide text-neutral-200">ACCOUNTS</h2>
      </div>
      <p className="mb-2 text-[10px] leading-tight text-neutral-500">
        <strong className="text-neutral-300">ON</strong> = the account shows in MONEY and counts in
        Projections. <strong className="text-neutral-300">OFF</strong> = hidden from MONEY and counts
        $0 in Projections — its register keeps updating and you can open it by tapping the row. The{" "}
        <strong className="text-amber-300">★ primary</strong> is the base of Projections; there is
        always exactly one, and the primary can't be turned off.
      </p>

      <div className="space-y-1.5">
        {ordered.map((r) => {
          const isPrimary = r.id === flags.primaryId
          const isActive = activeSet.has(r.id)
          const brand = bankBrandOf(r.name, r.institution)
          const title = accountDisplayName(r.name).title
          const bal = balances[r.id] ?? null
          return (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2 py-1.5",
                isActive ? "border-neutral-700 bg-neutral-950/70" : "border-neutral-800 bg-neutral-950/30",
              )}
            >
              <button
                type="button"
                onClick={() => props.onOpenAccount?.(r.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-70"
                aria-label={`Open register of ${title}`}
              >
                <BankLogo brand={brand} name={title} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate text-[12px] font-bold",
                      isActive ? "text-neutral-100" : "text-neutral-400",
                    )}
                  >
                    {title}
                    {isPrimary ? <span className="text-amber-300"> ★</span> : null}
                  </span>
                  <span className="truncate font-mono text-[10px] text-neutral-500">
                    {last4Of(r.name) || r.mask
                      ? `•••• ${last4Of(r.name) || r.mask}`
                      : r.institution || r.name}{" "}
                    · {r.kind === "card" ? "Credit Card" : "Checking"}
                  </span>
                </span>
              </button>

              <span
                className={cn(
                  "shrink-0 font-mono text-[12px] font-bold tabular-nums",
                  bal === null
                    ? "text-neutral-600"
                    : bal < 0
                      ? "text-[#ff5d6c]"
                      : isActive
                        ? "text-[#2fbf71]"
                        : "text-neutral-500",
                )}
              >
                {bal === null ? "—" : money(bal)}
              </span>

              <button
                type="button"
                role="button"
                aria-pressed={isPrimary}
                aria-label={isPrimary ? `${title} is the primary account` : `Make ${title} the primary account`}
                title={isPrimary ? "Primary account" : "Make primary"}
                onClick={() => {
                  if (!isPrimary) setPrimaryAccount(r.id, registers)
                }}
                className="shrink-0 rounded-lg p-1.5 active:scale-90"
              >
                <Star
                  className={cn(
                    "size-[18px]",
                    isPrimary ? "fill-[#f5b84c] text-[#f5b84c]" : "text-neutral-600",
                  )}
                />
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label={`Show ${title} in MONEY and Projections`}
                title={isPrimary ? "The primary account is always on" : isActive ? "Turn off" : "Turn on"}
                disabled={isPrimary}
                onClick={() => setAccountActive(r.id, !isActive, registers)}
                className={cn(
                  "flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors",
                  isActive ? "bg-[#5b8cff]" : "bg-[#2a2b3a]",
                  isPrimary && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "size-5 rounded-full bg-white shadow transition-transform",
                    isActive ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          )
        })}
        {ordered.length === 0 && (
          <p className="py-2 text-center text-[11px] text-neutral-500">No accounts yet.</p>
        )}
      </div>

      {feedError && (
        <p className="mt-2 text-[10px] font-semibold leading-tight text-amber-300">
          Bank feed unavailable right now — showing the accounts saved on this phone. Switches and ★
          still save and apply when the feed returns.
        </p>
      )}
    </section>
  )
}
