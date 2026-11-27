"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ClipboardList, FileCheck2, FileText, FolderLock, Plus, ShieldAlert, X } from "lucide-react"

type TaxStatus = "New intake" | "Awaiting documents" | "Ready for preparation" | "In preparation" | "Preparer review" | "Client approval" | "Filed" | "On hold"
type TaxCase = { id: string; client: string; year: string; filing: string; status: TaxStatus; checklist: string[] }

const seed: TaxCase[] = [
  { id: "TAX-26031", client: "Sample taxpayer A", year: "2026", filing: "Individual · 1040", status: "Awaiting documents", checklist: ["Organizer", "Identity verification", "Income documents"] },
  { id: "TAX-26030", client: "Sample taxpayer B", year: "2026", filing: "Individual · 1040", status: "Ready for preparation", checklist: ["Organizer", "Income documents", "Deduction records"] },
  { id: "TAX-26029", client: "Sample taxpayer C", year: "2026", filing: "Self-employed · Schedule C", status: "Preparer review", checklist: ["Income summary", "Expense summary", "Mileage / vehicle records"] },
]

const steps = [
  { title: "Intake & engagement", detail: "Confirm scope, filing year, filing status and engagement approval." },
  { title: "Identity & documents", detail: "Verify identity and collect required source documents securely." },
  { title: "Preparation", detail: "Reconcile income, deductions, credits and supporting schedules." },
  { title: "Preparer review", detail: "Resolve diagnostics, confirm calculations and review source evidence." },
  { title: "Client authorization", detail: "Obtain required client review and explicit filing authorization." },
  { title: "Filing & follow-up", detail: "Transmit through an authorized channel and track acceptance or rejection." },
]

const statusStyle: Record<TaxStatus, string> = {
  "New intake": "bg-blue-50 text-blue-700",
  "Awaiting documents": "bg-amber-50 text-amber-800",
  "Ready for preparation": "bg-cyan-50 text-cyan-800",
  "In preparation": "bg-violet-50 text-violet-700",
  "Preparer review": "bg-indigo-50 text-indigo-700",
  "Client approval": "bg-orange-50 text-orange-800",
  Filed: "bg-emerald-50 text-emerald-700",
  "On hold": "bg-rose-50 text-rose-700",
}

export function TaxWorkspace() {
  const [cases, setCases] = useState(seed)
  const [filter, setFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [client, setClient] = useState("")
  const [filing, setFiling] = useState("Individual · 1040")
  const [year, setYear] = useState("2026")
  const [notice, setNotice] = useState("")

  const counts = useMemo(() => ({
    total: cases.length,
    waiting: cases.filter(c => c.status === "Awaiting documents").length,
    review: cases.filter(c => c.status === "Preparer review").length,
    filed: cases.filter(c => c.status === "Filed").length,
  }), [cases])

  const visible = cases.filter(c =>
    (filter === "All" || c.status === filter) &&
    (c.client + " " + c.id + " " + c.filing).toLowerCase().includes(search.toLowerCase())
  )

  function addCase() {
    if (!client.trim()) return
    setCases(current => [{ id: `TAX-26${String(32 + current.length).padStart(3,"0")}`, client: client.trim(), year, filing, status: "New intake", checklist: [] }, ...current])
    setClient(""); setShowForm(false)
    setNotice("Sample tax file created locally. No taxpayer data was transmitted or saved to a server.")
  }

  function changeStatus(id: string, status: TaxStatus) {
    setCases(current => current.map(item => item.id === id ? { ...item, status } : item))
    setNotice(`${id} status changed in this browser preview only. No filing or client notification occurred.`)
  }

  function toggleChecklist(id: string, item: string) {
    setCases(current => current.map(c => c.id === id ? { ...c, checklist: c.checklist.includes(item) ? c.checklist.filter(x => x !== item) : [...c.checklist, item] } : c))
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-amber-700"><FileText size={14}/> BRAKHA GROUP TAX SERVICES</div><h2 className="mt-2 text-xl font-semibold">Tax preparation workspace</h2><p className="mt-1 text-xs text-slate-500">Tax year 2026 · intake, document readiness and preparer workflow</p></div><button onClick={()=>setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white"><Plus size={15}/> New tax file</button></div>
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] leading-relaxed text-rose-900"><strong>Security warning:</strong> this is not a taxpayer portal. Do not enter SSNs, ITINs, dates of birth, bank details, W-2/1099 images or real tax documents. Records are synthetic and stay in local preview state.</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Tax files",value:counts.total,icon:ClipboardList},{label:"Awaiting documents",value:counts.waiting,icon:FolderLock},{label:"Preparer review",value:counts.review,icon:FileCheck2},{label:"Filed · demo",value:counts.filed,icon:CheckCircle2}].map(x=>{const Icon=x.icon;return <div key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs text-slate-500">{x.label}<Icon size={16}/></div><div className="mt-3 text-2xl font-semibold">{x.value}</div><div className="mt-1 text-[10px] text-slate-400">Illustrative sample count</div></div>})}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.8fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Tax case queue</h3><p className="mt-1 text-xs text-slate-500">Track preparation without exposing taxpayer identifiers</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600">LOCAL DEMO</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_190px]"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sample client or file ID" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-amber-400"/><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option>All</option>{(Object.keys(statusStyle) as TaxStatus[]).map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="mt-4 space-y-3">{visible.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-bold tracking-wide text-slate-400">{item.id} · TAX YEAR {item.year}</div><div className="mt-1 text-sm font-semibold">{item.client}</div><div className="mt-1 text-[10px] text-slate-500">{item.filing}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle[item.status]}`}>{item.status}</span></div><div className="mt-4 border-t border-slate-100 pt-3"><div className="mb-2 text-[10px] font-semibold text-slate-600">Readiness checklist · sample</div><div className="flex flex-wrap gap-2">{["Organizer","Identity verification","Income documents","Deduction records","Mileage / vehicle records"].map(task=><button key={task} onClick={()=>toggleChecklist(item.id,task)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${item.checklist.includes(task)?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-slate-200 bg-white text-slate-500"}`}>{item.checklist.includes(task)?"✓ ":"+ "}{task}</button>)}</div></div><div className="mt-3 flex justify-end"><select aria-label={`Update status for ${item.id}`} value={item.status} onChange={e=>changeStatus(item.id,e.target.value as TaxStatus)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold">{(Object.keys(statusStyle) as TaxStatus[]).map(s=><option key={s}>{s}</option>)}</select></div></article>)}{visible.length===0&&<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400">No sample files match this filter.</div>}</div>
      </section>
      <aside className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Preparation lifecycle</h3><p className="mt-1 text-xs text-slate-500">Required checkpoints before a return is complete</p><ol className="mt-4 space-y-3">{steps.map((step,i)=><li key={step.title} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">{String(i+1).padStart(2,"0")}</span><div><div className="text-xs font-semibold">{step.title}</div><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{step.detail}</p></div></li>)}</ol></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldAlert size={16} className="text-amber-700"/><h3 className="font-semibold">Before real client use</h3></div><ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-600">{["Private document vault with encryption and access logs","Transport / Taxes separation and owner-scoped authorization","MFA, session revocation and account recovery","Verified backup and restore process","Tax document retention and secure deletion policy","Human approval for e-file and every outbound communication","Synthetic cross-user and cross-business security tests"].map(x=><li key={x} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"/>{x}</li>)}</ul></section></aside>
    </div>
    {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-800">{notice}<button onClick={()=>setNotice("")} className="ml-3 font-bold underline">Dismiss</button></div>}
    {showForm&&<div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div><h3 className="font-semibold">New tax file</h3><p className="mt-1 text-[10px] text-slate-500">Synthetic sample only</p></div><button onClick={()=>setShowForm(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100"><X size={17}/></button></div><label className="mt-4 block text-[11px] font-semibold text-slate-600">Sample taxpayer label<input value={client} onChange={e=>setClient(e.target.value)} placeholder="Sample taxpayer D" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[11px] font-semibold text-slate-600">Tax year<select value={year} onChange={e=>setYear(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"><option>2026</option><option>2025</option></select></label><label className="text-[11px] font-semibold text-slate-600">Return type<select value={filing} onChange={e=>setFiling(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"><option>Individual · 1040</option><option>Self-employed · Schedule C</option><option>Amended · 1040-X</option><option>Other · review</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold">Cancel</button><button onClick={addCase} disabled={!client.trim()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Save sample file</button></div></div></div>}
  </div>
}
