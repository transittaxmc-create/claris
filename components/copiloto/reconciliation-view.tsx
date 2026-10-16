"use client"

// RECONCILIACIÓN — reporte diario por cuenta + puerta de aprobación.
// Regla de Miguel: NADA se aplica hasta que él aprueba cada punto.
// Todo editable, todo rechazable. Nunca falla en silencio.

import { Check, X, Pencil, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { money } from "./types"
import type { ReconReport, ReconFinding } from "./reconciliation-check"

const TYPE_LABEL: Record<ReconFinding["type"], string> = {
  diferencia: "Diferencia",
  "sin-clasificar": "Sin clasificar",
  "pendiente-banco": "Pendiente en banco",
  duplicado: "Duplicado",
  "transfer-sin-pareja": "Transfer sin pareja",
}

export function ReconciliationSection(props: {
  report: ReconReport | null
  loading: boolean
  onRun: () => void
  onApprove: (f: ReconFinding) => void
  onReject: (f: ReconFinding) => void
  onEdit: (f: ReconFinding) => void
  onApproveAll: () => void
}) {
  const { report, loading } = props
  const findings = (report?.accounts || []).flatMap((a) => a.findings)

  return (
    <div className="border-t-2 border-dashed border-neutral-800 pt-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/90">
          ✓ Reconciliación
        </p>
        <button
          type="button"
          onClick={props.onRun}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-[10px] font-bold text-neutral-200 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          {loading ? "Verificando…" : "Verificar ahora"}
        </button>
      </div>

      {!report && !loading && (
        <p className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 text-[11px] text-neutral-500">
          Aún no se verifica hoy. Toca «Verificar ahora».
        </p>
      )}

      {report && !report.ok && (
        <div className="rounded-2xl border-2 border-rose-500/60 bg-rose-950/40 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-rose-300">
            <AlertTriangle className="size-4" /> No se pudo verificar hoy: {report.error || "sin datos del banco"}
          </p>
          <p className="mt-1 text-[11px] text-rose-200/70">
            Revisa la conexión del banco (SYNC) e intenta de nuevo. No se marcó nada como cuadrado.
          </p>
        </div>
      )}

      {report && report.ok && (
        <div>
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-300">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              {report.summary.cuadradas}/{report.summary.total} cuentas cuadradas
              {report.summary.diferenciaTotal > 0.009 && (
                <span className="text-rose-300">· {money(report.summary.diferenciaTotal)} en diferencias</span>
              )}
            </span>
            {findings.length > 0 && (
              <button
                type="button"
                onClick={props.onApproveAll}
                className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-black active:scale-95"
              >
                Aprobar todo
              </button>
            )}
          </div>
          <p className="mb-2 px-1 text-[10px] text-neutral-500">
            Verificado {report.date} · nada se aplica sin tu aprobación
          </p>

          {findings.length === 0 ? (
            <p className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-[12px] font-bold text-emerald-300">
              ✅ Todo cuadra. Sin hallazgos hoy.
            </p>
          ) : (
            <div className="space-y-2">
              {report.accounts
                .filter((a) => a.findings.length > 0)
                .map((a) => (
                  <div key={a.accountId} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-2.5">
                    <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-extrabold text-white">
                      <span
                        className={cn(
                          "inline-block size-2 rounded-full",
                          a.cuadrada ? "bg-emerald-400" : "bg-amber-400",
                        )}
                      />
                      <span className="truncate">{a.accountName}</span>
                      <span className="shrink-0 text-[9px] font-bold uppercase text-neutral-500">
                        {a.kind === "manual" ? "manual" : a.kind === "card" ? "tarjeta" : "banco"}
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {a.findings.map((f) => (
                        <div
                          key={f.key}
                          className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-neutral-100">
                                <span
                                  className={cn(
                                    "mr-1.5 inline-block rounded px-1 py-0.5 text-[8px] font-black uppercase",
                                    f.severity === "warn"
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "bg-neutral-800 text-neutral-400",
                                  )}
                                >
                                  {TYPE_LABEL[f.type]}
                                </span>
                                {f.title}
                              </p>
                              <p className="mt-0.5 text-[10px] text-neutral-400">{f.detail}</p>
                              <p className="mt-0.5 text-[10px] text-neutral-500">
                                Propuesta: <span className="font-bold text-neutral-300">{f.proposedAction.label}</span>
                              </p>
                            </div>
                          </div>
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => props.onApprove(f)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/90 py-1.5 text-[10px] font-black text-black active:scale-95"
                            >
                              <Check className="size-3" /> Aprobar
                            </button>
                            {(f.entryId || f.bankTx) && (
                              <button
                                type="button"
                                onClick={() => props.onEdit(f)}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 py-1.5 text-[10px] font-bold text-neutral-200 active:scale-95"
                              >
                                <Pencil className="size-3" /> Editar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => props.onReject(f)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-[10px] font-bold text-neutral-400 active:scale-95"
                              title="Rechazar (no se propone por 7 días)"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
