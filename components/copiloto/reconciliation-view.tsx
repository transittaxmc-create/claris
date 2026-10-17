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
  // Diseño MONEY: "CIERRE DEL DÍA · mm-dd" + insignia de pendientes.
  const hoy = (report?.date || new Date().toISOString().slice(0, 10)).slice(5)
  const hora = report?.ranAt
    ? new Date(report.ranAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null

  return (
    <div className="pt-1">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <p className="text-[13px] font-extrabold tracking-[.08em] text-[#2fbf71]">CIERRE DEL DÍA · {hoy}</p>
        {report && report.ok && (
          <span
            className={cn(
              "rounded-lg px-2.5 py-0.5 text-[11px] font-extrabold",
              findings.length > 0 ? "bg-[#f5b84c] text-[#3a2a00]" : "bg-[#2fbf71] text-[#06281a]",
            )}
          >
            {findings.length > 0 ? `${findings.length} por revisar` : "TODO CUADRA"}
          </span>
        )}
      </div>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-[#66687c]">
          {hora ? `Verificado a las ${hora}` : "Sin verificar hoy"} · Tú revisas al final del día
        </p>
        <button
          type="button"
          onClick={props.onRun}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#262633] bg-[#16161f] px-2.5 py-1.5 text-[10px] font-bold text-[#f2f3f7] active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          {loading ? "Verificando…" : "Verificar ahora"}
        </button>
      </div>

      {!report && !loading && (
        <p className="rounded-[14px] border border-[#262633] bg-[#16161f] p-3 text-[11px] text-[#9a9cb0]">
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
          <div className="mb-2 flex items-center justify-between rounded-[14px] border border-[#262633] bg-[#16161f] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#f2f3f7]">
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
                className="rounded-lg bg-[#2fbf71] px-2.5 py-1 text-[10px] font-black text-[#06281a] active:scale-95"
              >
                Aprobar todo
              </button>
            )}
          </div>
          <p className="mb-2 px-1 text-[10px] text-[#66687c]">
            Verificado {report.date} · nada se aplica sin tu aprobación
          </p>

          {findings.length === 0 ? (
            <p className="rounded-[14px] border border-[rgba(47,191,113,.5)] bg-[#16161f] p-3 text-[12px] font-bold text-[#2fbf71]">
              ✅ Todo cuadra. Sin hallazgos hoy.
            </p>
          ) : (
            <div className="space-y-2">
              {report.accounts
                .filter((a) => a.findings.length > 0)
                .map((a) => (
                  <div key={a.accountId} className="rounded-[14px] border border-[#262633] bg-[#111119] p-2.5">
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
                          className="rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-[#f2f3f7]">
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
                              <p className="mt-0.5 text-[11px] text-[#9a9cb0]">{f.detail}</p>
                              <p className="mt-0.5 text-[11px] text-[#9a9cb0]">
                                Propuesta: <span className="font-bold text-[#f2f3f7]">{f.proposedAction.label}</span>
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => props.onApprove(f)}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#2fbf71] py-2.5 text-[13px] font-extrabold text-[#06281a] active:scale-95"
                            >
                              <Check className="size-3.5" /> OK
                            </button>
                            {(f.entryId || f.bankTx) && (
                              <button
                                type="button"
                                onClick={() => props.onEdit(f)}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#262633] bg-[#16161f] py-2.5 text-[13px] font-semibold text-[#f2f3f7] active:scale-95"
                              >
                                <Pencil className="size-3.5" /> Corregir
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => props.onReject(f)}
                              aria-label="Rechazar"
                              className="inline-flex items-center justify-center rounded-xl border border-[#262633] bg-[#16161f] px-3 py-2.5 text-[#9a9cb0] active:scale-95"
                              title="Rechazar (no se propone por 7 días)"
                            >
                              <X className="size-3.5" />
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
