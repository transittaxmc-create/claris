"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Check, Circle, Upload, FileText, AlertCircle, X, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { milesByHalfYear } from "./mileage-log"
import { computeScheduleC, DEFAULT_SCHEDULE_C_OPTS, type ScheduleCOpts } from "./schedule-c-draft"
import type { Expense, Trip } from "./types"
import { grossOf, tripDateOf } from "./types"

const STORAGE_KEY = "claris_tax_2026_docs"
const FILES_KEY = "claris_tax_2026_files"

interface DocItem {
  id: string
  label: string
  note: string
  required: boolean
  auto?: boolean
}

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  addedAt: string
  docId?: string
  dataUrl?: string
}

const DOC_ITEMS: DocItem[] = [
  { id: "1099-k", label: "1099-K (platforms)", note: "Uber, Lyft, etc. if threshold met", required: true },
  { id: "1099-nec", label: "1099-NEC (referrals/bonuses)", note: "If any platform paid $2,000+", required: false },
  { id: "annual-summary", label: "Annual earnings summary", note: "From each platform dashboard", required: true },
  { id: "mileage", label: "Mileage log (contemporaneous)", note: "Auto from app GPS + trips", required: true, auto: true },
  { id: "bank-statements", label: "Bank & card statements", note: "All business accounts for the year", required: true },
  { id: "receipts", label: "Business expense receipts", note: "Classified as business in Expenses", required: true, auto: true },
  { id: "phone", label: "Phone bill (business %)", note: "For Line 25 Utilities", required: false },
  { id: "licenses", label: "TLC / licenses / permits", note: "For Line 23", required: false },
  { id: "prior-return", label: "Prior year tax return", note: "Helpful for carryovers", required: false },
]

function loadDocs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDocs(d: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch {}
}

function loadFiles(): UploadedFile[] {
  try {
    const raw = localStorage.getItem(FILES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFiles(files: UploadedFile[]) {
  try {
    // Keep only metadata + dataUrl for small files to avoid quota issues
    const trimmed = files.slice(-30).map((f) => ({
      ...f,
      dataUrl: f.dataUrl && f.dataUrl.length > 500_000 ? undefined : f.dataUrl,
    }))
    localStorage.setItem(FILES_KEY, JSON.stringify(trimmed))
  } catch {}
}

export function Tax2026Screen({
  trips,
  expenses,
}: {
  trips: Trip[]
  expenses: Expense[]
}) {
  const year = 2026
  const [docs, setDocs] = useState<Record<string, boolean>>({})
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scOpts] = useState<ScheduleCOpts>(() => {
    try {
      const { h1, h2 } = milesByHalfYear(year)
      return { ...DEFAULT_SCHEDULE_C_OPTS, milesH1: h1, milesH2: h2 }
    } catch {
      return DEFAULT_SCHEDULE_C_OPTS
    }
  })

  useEffect(() => {
    setDocs(loadDocs())
    setFiles(loadFiles())
  }, [])

  const autoStatus = useMemo(() => {
    const { h1, h2 } = milesByHalfYear(year)
    const hasMileage = h1 + h2 > 0
    const businessExp = expenses.filter((e) => e.classification === "business" && String(e.date || "").startsWith(String(year)))
    const hasReceipts = businessExp.length > 0
    return {
      mileage: hasMileage,
      receipts: hasReceipts,
      trips: trips.some((t) => tripDateOf(t).startsWith(String(year))),
    }
  }, [trips, expenses])

  const completed = useMemo(() => {
    return DOC_ITEMS.filter((item) => {
      if (item.id === "mileage") return autoStatus.mileage || docs[item.id]
      if (item.id === "receipts") return autoStatus.receipts || docs[item.id]
      return !!docs[item.id]
    }).length
  }, [docs, autoStatus])

  const percent = Math.round((completed / DOC_ITEMS.length) * 100)

  function toggle(id: string) {
    const next = { ...docs, [id]: !docs[id] }
    setDocs(next)
    saveDocs(next)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    setUploading(true)
    const newFiles: UploadedFile[] = []
    let processed = 0
    const total = selected.length

    Array.from(selected).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : undefined
        newFiles.push({
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          addedAt: new Date().toISOString(),
          dataUrl: file.size < 400_000 ? dataUrl : undefined,
        })
        processed++
        if (processed === total) {
          const next = [...newFiles, ...files].slice(0, 30)
          setFiles(next)
          saveFiles(next)
          setUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }
      }
      reader.onerror = () => {
        processed++
        if (processed === total) {
          setUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function removeFile(id: string) {
    const next = files.filter((f) => f.id !== id)
    setFiles(next)
    saveFiles(next)
  }

  function downloadFile(f: UploadedFile) {
    if (!f.dataUrl) {
      alert("File too large to store locally. Re-upload or keep a copy elsewhere.")
      return
    }
    const a = document.createElement("a")
    a.href = f.dataUrl
    a.download = f.name
    a.click()
  }

  const sc = useMemo(() => {
    const yearTrips = trips
      .filter((t) => tripDateOf(t).startsWith(String(year)))
      .map((t) => ({ gross: grossOf(t), platformFee: Number(t.platformFee) || 0 }))
    const yearExp = expenses.filter((e) => String(e.date || "").startsWith(String(year)))
    return computeScheduleC(yearTrips, yearExp, `${year}-01-01`, `${year}-12-31`, scOpts)
  }, [trips, expenses, scOpts])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-sm font-bold tracking-widest text-neutral-400">TAX 2026 PREP</h1>
        <span className="rounded-full border border-amber-400/50 px-2.5 py-1 text-[11px] font-bold text-amber-300">
          {percent}% ready
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Progress */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wide text-white">YEAR-END CHECKLIST</p>
            <span className="text-[10px] text-neutral-400">{completed}/{DOC_ITEMS.length} items</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-[9px] text-neutral-500">
            Auto-detected from app data where possible. Mark the rest when you upload or confirm.
          </p>
        </section>

        {/* Checklist */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-400">
            <FileText className="size-3.5 text-amber-300" /> DOCUMENTS NEEDED
          </p>
          <div className="space-y-1.5">
            {DOC_ITEMS.map((item) => {
              const done =
                item.id === "mileage"
                  ? autoStatus.mileage || docs[item.id]
                  : item.id === "receipts"
                    ? autoStatus.receipts || docs[item.id]
                    : !!docs[item.id]
              const auto = item.auto && (item.id === "mileage" ? autoStatus.mileage : item.id === "receipts" ? autoStatus.receipts : false)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !auto && toggle(item.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left",
                    done ? "border-emerald-500/40 bg-emerald-500/5" : "border-neutral-700 bg-neutral-950/50",
                  )}
                >
                  {done ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-neutral-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[11px] font-bold", done ? "text-emerald-300" : "text-white")}>{item.label}</p>
                    <p className="text-[9px] text-neutral-500">{item.note}</p>
                    {auto && <p className="text-[9px] text-sky-400">Auto-detected from app</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Direct 1099 upload */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-amber-300">
            <Upload className="size-3.5" /> UPLOAD 1099s & FORMS
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2.5 text-[11px] font-bold text-amber-300 active:scale-[0.98]"
          >
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Choose 1099 / form files"}
          </button>
          <p className="mb-2 text-[9px] text-neutral-500">
            PDF, images, or spreadsheets. Stored on this device (small files only). Mark the matching checklist item above after upload.
          </p>
          {files.length === 0 ? (
            <p className="text-[10px] text-neutral-600">No files uploaded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950/60 px-2.5 py-1.5">
                  <FileText className="size-3.5 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium text-white">{f.name}</p>
                    <p className="text-[9px] text-neutral-500">
                      {(f.size / 1024).toFixed(0)} KB · {new Date(f.addedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {f.dataUrl && (
                    <button type="button" onClick={() => downloadFile(f)} className="p-1 text-sky-400">
                      <Download className="size-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => removeFile(f.id)} className="p-1 text-rose-400">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Schedule C line status */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-1 text-[11px] font-bold tracking-wide text-amber-300">SCHEDULE C LINE STATUS (2026)</p>
          <p className="mb-2 text-[9px] text-neutral-500">
            Net profit so far: ${sc.net.toLocaleString("en-US", { minimumFractionDigits: 2 })} · SE tax est. ${sc.seTax.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="space-y-1">
            {sc.lines
              .filter((l) => l.amount !== 0 || ["1", "7", "9", "10", "28", "29/31"].includes(l.line))
              .map((l) => (
                <div key={l.line} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-neutral-400">
                    <span className="mr-1 font-mono text-amber-400/80">{l.line}</span>
                    {l.label}
                  </span>
                  <span className={cn("font-mono", l.total ? "font-bold text-white" : "text-neutral-300")}>
                    ${Math.abs(l.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
          </div>
          <p className="mt-2 text-[9px] text-neutral-500">
            Full draft lives in REPORTS. A CPA must review before filing. Tips deduction (§224) and QBI available — confirm eligibility.
          </p>
        </section>

        {/* Money-saving tips */}
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
            <AlertCircle className="size-3.5" /> WAYS TO SAVE
          </p>
          <ul className="space-y-1 text-[10px] text-neutral-400">
            <li>• Maximize business miles (standard rate 72.5¢ / 76¢) — biggest deduction for drivers.</li>
            <li>• Classify every expense as business when it qualifies (phone %, supplies, tolls).</li>
            <li>• Track tips carefully for the new tip deduction (up to $25k).</li>
            <li>• Make estimated payments to avoid penalties.</li>
            <li>• Keep contemporaneous mileage log (app already does this).</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
