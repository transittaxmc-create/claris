"use client"

import { useMemo, useRef, useState } from "react"
import { Camera, Loader2, Trash2, CircleCheck, AlertTriangle, CircleAlert, Info, ScanLine, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Trip } from "./types"
import type { TollCharge } from "@/app/api/scan-toll-statement/route"
import { gpsTollsFromTrips, auditTolls, auditReportText, type AuditStatus } from "./toll-audit"

const STORE_KEY = "claris_toll_statement_charges_v1"

function shrink(file: File, maxDim = 1600): Promise<{ image: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const c = document.createElement("canvas")
        c.width = width
        c.height = height
        const ctx = c.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not prepare image"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ image: c.toDataURL("image/jpeg", 0.82), mimeType: "image/jpeg" })
      }
      img.onerror = () => reject(new Error("Could not read image"))
      img.src = String(e.target?.result || "")
    }
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

function loadCharges(): TollCharge[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.amount === "number") : []
  } catch {
    return []
  }
}

const STATUS_META: Record<AuditStatus, { label: string; icon: typeof Info; cls: string }> = {
  matched: { label: "MATCHED", icon: CircleCheck, cls: "text-emerald-400 border-emerald-800 bg-emerald-950/40" },
  duplicate: { label: "DUPLICATE?", icon: CircleAlert, cls: "text-red-400 border-red-800 bg-red-950/40" },
  unmatched_statement: { label: "NO GPS MATCH", icon: AlertTriangle, cls: "text-yellow-400 border-yellow-800 bg-yellow-950/40" },
  unmatched_gps: { label: "NOT ON STATEMENT", icon: Info, cls: "text-sky-400 border-sky-800 bg-sky-950/40" },
}

export function TollAuditScreen({ trips }: { trips: Trip[] }) {
  const [charges, setCharges] = useState<TollCharge[]>(loadCharges)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const gpsTolls = useMemo(() => gpsTollsFromTrips(trips), [trips])
  const audit = useMemo(() => auditTolls(charges, gpsTolls), [charges, gpsTolls])
  const gpsTotal = useMemo(() => gpsTolls.reduce((s, g) => s + (g.amount || 0), 0), [gpsTolls])

  function persist(next: TollCharge[]) {
    setCharges(next)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next))
    } catch {}
  }

  async function scan(file: File) {
    setScanning(true)
    setError(null)
    setOkMsg(null)
    try {
      const { image, mimeType } = await shrink(file)
      const res = await fetch("/api/scan-toll-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not analyze statement")
      const found: TollCharge[] = json.result?.charges || []
      if (found.length === 0) {
        setError("No toll charges found in the image. Try a clearer screenshot.")
        return
      }
      persist([...charges, ...found])
      setOkMsg(`${found.length} charges added from statement.`)
      window.setTimeout(() => setOkMsg(null), 3000)
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function clearStatement() {
    persist([])
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(auditReportText(audit))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy report")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-neutral-800 bg-black px-4 py-3 sm:px-8">
        <h1 className="text-lg font-black text-white">TOLL AUDIT</h1>
        <p className="text-[11px] text-neutral-500">E-ZPass statement vs your GPS toll log — catch duplicates.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-8">
        {/* GPS log (automatic) */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">GPS TOLL LOG · AUTOMATIC</span>
            <span className="font-mono text-sm font-black text-emerald-300">
              {gpsTolls.length} × ${gpsTotal.toFixed(2)}
            </span>
          </div>
          {gpsTolls.length === 0 ? (
            <p className="text-[11px] text-neutral-600">No tolls detected yet. They appear automatically when you drive through one with a trip active.</p>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {gpsTolls.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 flex-1 truncate text-neutral-300">
                    <span className="font-mono text-neutral-500">{g.date.slice(5)} {g.time}</span> · {g.plaza}
                  </span>
                  <span className="shrink-0 font-mono font-bold text-neutral-200">
                    {g.amount != null ? `$${g.amount.toFixed(2)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Scan statement */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide text-neutral-400">E-ZPASS STATEMENT · SCAN</span>
            {charges.length > 0 && (
              <button type="button" onClick={clearStatement} className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                <Trash2 className="size-3.5" /> Clear
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void scan(f)
            }}
          />
          <button
            type="button"
            disabled={scanning}
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50"
          >
            {scanning ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {scanning ? "Reading statement…" : "Scan E-ZPass statement"}
          </button>
          {error && <p className="mt-2 text-[11px] font-semibold text-rose-400">{error}</p>}
          {okMsg && <p className="mt-2 text-[11px] font-semibold text-emerald-400">{okMsg}</p>}
          {charges.length > 0 && (
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
              {charges.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 flex-1 truncate text-neutral-300">
                    <span className="font-mono text-neutral-500">{c.date.slice(5)} {c.time}</span> · {c.plaza}
                  </span>
                  <span className="shrink-0 font-mono font-bold text-neutral-200">${c.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reconciliation */}
        {charges.length > 0 && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <ScanLine className="size-4 text-yellow-400" />
              <span className="text-[11px] font-bold tracking-wide text-neutral-400">RECONCILIATION</span>
              <button
                type="button"
                onClick={copyReport}
                className="ml-auto flex items-center gap-1 rounded-lg border border-neutral-700 bg-black px-2 py-1 text-[10px] font-bold text-neutral-300"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy report"}
              </button>
            </div>
            {audit.merged > 0 && (
              <p className="mb-2 text-[10px] text-neutral-500">{audit.merged} re-scanned charge{audit.merged === 1 ? "" : "s"} merged by reference number (not duplicates).</p>
            )}
            <div className="mb-3 grid grid-cols-4 gap-1.5 text-center">
              {(
                [
                  ["Matched", audit.matched, "text-emerald-400"],
                  ["Duplicate?", audit.duplicates, "text-red-400"],
                  ["No GPS", audit.unmatchedStatement, "text-yellow-400"],
                  ["Not billed", audit.unmatchedGps, "text-sky-400"],
                ] as const
              ).map(([label, n, cls]) => (
                <div key={label} className="rounded-xl border border-neutral-800 bg-black px-1 py-2">
                  <p className={cn("font-mono text-base font-black", cls)}>{n}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mb-2 flex items-center justify-between rounded-xl border border-neutral-800 bg-black px-3 py-2 text-[11px]">
              <span className="text-neutral-500">Statement total</span>
              <span className="font-mono font-black text-white">${audit.statementTotal.toFixed(2)}</span>
            </div>
            <div className="mb-3 flex items-center justify-between rounded-xl border border-neutral-800 bg-black px-3 py-2 text-[11px]">
              <span className="text-neutral-500">GPS log total</span>
              <span className="font-mono font-black text-emerald-300">${audit.gpsTotal.toFixed(2)}</span>
            </div>
            <div className="space-y-1.5">
              {audit.rows.map((r) => {
                const meta = STATUS_META[r.status]
                const Icon = meta.icon
                return (
                  <div key={r.key} className={cn("rounded-xl border px-2.5 py-2", meta.cls)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-bold text-white">
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {r.date.slice(5)} {r.time} · {r.plaza}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[12px] font-black text-white">
                        {r.amount != null ? `$${r.amount.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 pl-5 text-[10px] text-neutral-400">
                      <span className={cn("font-bold", meta.cls.split(" ")[0])}>{meta.label}</span>
                      {r.ref ? <span className="font-mono"> · ref {r.ref}</span> : ""}
                      {r.matchInfo ? ` — ${r.matchInfo}` : ""}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
