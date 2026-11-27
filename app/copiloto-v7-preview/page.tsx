"use client"

import { useMemo, useState } from "react"
import { TransportWorkspace } from "@/components/copiloto-v7-preview/transport-workspace"
import { TaxWorkspace } from "@/components/copiloto-v7-preview/tax-workspace"
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BriefcaseBusiness, CarFront,
  CheckCircle2, ChevronRight, CircleDollarSign, Clock3, FileText, FolderLock,
  LayoutDashboard, Menu, MessageSquareText, Plus, Search, ShieldCheck,
  Users, Wallet, X
} from "lucide-react"

type Section = "Overview" | "Transport" | "Taxes" | "Work Opportunities" | "Communications" | "Clients" | "Documents"

const navigation: { label: Section; icon: typeof LayoutDashboard; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Transport", icon: CarFront, group: "BUSINESS" },
  { label: "Taxes", icon: FileText, group: "BUSINESS" },
  { label: "Work Opportunities", icon: BriefcaseBusiness, group: "BUSINESS" },
  { label: "Communications", icon: MessageSquareText, group: "MANAGEMENT" },
  { label: "Clients", icon: Users, group: "MANAGEMENT" },
  { label: "Documents", icon: FolderLock, group: "MANAGEMENT" },
]

const opportunities = [
  { id: "WO-2048", route: "JFK → Manhattan", detail: "Executive SUV · Today, 3:30 PM", price: "$185", status: "Good fit", tone: "green" },
  { id: "WO-2047", route: "Newark → Brooklyn", detail: "SUV · Today, 5:15 PM", price: "$140", status: "Review", tone: "amber" },
  { id: "WO-2046", route: "LGA → Long Island", detail: "Vehicle requirements missing", price: "—", status: "Needs details", tone: "slate" },
]

const messages = [
  { initials: "IC", name: "Island City Transit", text: "New reservation request received", time: "9:42 AM", type: "Transport" },
  { initials: "BG", name: "Brakha Group Tax Services", text: "Client uploaded tax documents", time: "9:18 AM", type: "Taxes" },
  { initials: "WO", name: "Work Opportunities", text: "2 opportunities need your review", time: "8:56 AM", type: "Work" },
]

function Metric({ label, value, note, icon: Icon, positive }: { label: string; value: string; note: string; icon: typeof Activity; positive?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><span className="rounded-xl bg-slate-50 p-2 text-slate-600"><Icon size={18}/></span></div>
    <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
    <div className={`mt-2 flex items-center gap-1 text-xs ${positive ? "text-emerald-700" : "text-slate-500"}`}>{positive && <ArrowUpRight size={14}/>}{note}</div>
  </div>
}

export default function CopilotoV7Preview() {
  const [active, setActive] = useState<Section>("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [approved, setApproved] = useState<string[]>([])
  const [showNew, setShowNew] = useState(false)
  const [clientRows, setClientRows] = useState([
    { id: "CL-1024", name: "Jordan Ellis", area: "Transport", status: "Active", detail: "Executive SUV · Preferred client" },
    { id: "CL-1023", name: "Taylor Morgan", area: "Taxes", status: "Awaiting documents", detail: "2025 individual return" },
    { id: "CL-1022", name: "Casey Rivera", area: "Taxes", status: "In review", detail: "2025 individual return" },
  ])
  const [tripRows, setTripRows] = useState([
    { id: "TR-3408", route: "JFK → Midtown Manhattan", when: "Today · 8:30 AM", amount: "$95.00", status: "Completed" },
    { id: "TR-3407", route: "Long Island City → LGA", when: "Today · 7:10 AM", amount: "$68.00", status: "Completed" },
  ])
  const [messageRows, setMessageRows] = useState(messages.map((m,i)=>({...m,id:`MSG-${i+1}`,status:"Unread"})))
  const [selectedMessageId, setSelectedMessageId] = useState("MSG-1")
  const [messageDrafts, setMessageDrafts] = useState<Record<string,string>>({})
  const [documentRows, setDocumentRows] = useState([
    { id:"DOC-081", name:"Identity document · sample", owner:"Taylor Morgan", area:"Taxes", status:"Needs review" },
    { id:"DOC-080", name:"Trip authorization · sample", owner:"Jordan Ellis", area:"Transport", status:"Reviewed" },
    { id:"DOC-079", name:"Tax organizer · sample", owner:"Casey Rivera", area:"Taxes", status:"Received" },
  ])
  const [clientName, setClientName] = useState("")
  const [clientArea, setClientArea] = useState("Transport")
  const [tripRoute, setTripRoute] = useState("")
  const [tripAmount, setTripAmount] = useState("")
  const [moduleSearch, setModuleSearch] = useState("")
  const filteredNav = useMemo(() => navigation.filter(item => item.label.toLowerCase().includes(query.toLowerCase())), [query])

  const title = active === "Overview" ? "Good morning" : active
  const subtitle = active === "Overview" ? "Here’s what’s happening across your businesses today." : `Your ${active.toLowerCase()} workspace. Review activity and manage your next steps.`

  function sidebar() {
    return <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-slate-950"><span className="text-lg font-black">C</span></div>
        <div><div className="text-lg font-semibold tracking-tight text-white">Copiloto</div><div className="text-[10px] font-semibold tracking-[.22em] text-slate-400">BUSINESS OS · V7</div></div>
      </div>
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5"><Search size={15} className="text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a workspace..." className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"/></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {["WORKSPACE","BUSINESS","MANAGEMENT"].map(group => <div key={group}><div className="px-3 pb-2 text-[10px] font-bold tracking-[.18em] text-slate-500">{group}</div><div className="space-y-1">{filteredNav.filter(item=>item.group===group).map(item=>{const Icon=item.icon;return <button key={item.label} onClick={()=>{setActive(item.label);setMobileOpen(false)}} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active===item.label?"bg-amber-400 font-semibold text-slate-950":"text-slate-300 hover:bg-slate-800 hover:text-white"}`}><Icon size={17}/>{item.label}{item.label==="Work Opportunities"&&<span className="ml-auto rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">2</span>}</button>})}</div></div>)}
      </nav>
      <div className="m-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck size={15} className="text-emerald-400"/>Private workspace</div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">Your business areas are separated. Access and document controls are part of the build.</p></div>
      <div className="border-t border-slate-800 px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-xs font-bold text-white">MC</div><div><div className="text-xs font-semibold text-white">Workspace owner</div><div className="text-[10px] text-slate-500">Administrator</div></div></div></div>
    </div>
  }

  return <main className="flex h-[100dvh] min-h-[650px] bg-[#f5f6f8] text-slate-900">
    <aside className="hidden w-[258px] shrink-0 bg-[#101b2b] lg:block">{sidebar()}</aside>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" onClick={()=>setMobileOpen(false)} className="absolute inset-0 bg-black/50"/><aside className="relative h-full w-[290px] bg-[#101b2b]">{sidebar()}</aside></div>}
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
        <div className="flex items-center gap-3"><button onClick={()=>setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20}/></button><div><div className="text-sm font-semibold text-slate-900">Copiloto <span className="font-normal text-slate-400">/ {active}</span></div><div className="hidden text-[11px] text-slate-500 sm:block">Island City Transit · Brakha Group Tax Services</div></div></div>
        <div className="flex items-center gap-3"><span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold tracking-wide text-amber-800 sm:inline-flex">PREVIEW · SAMPLE DATA</span><button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500"/></button><div className="hidden h-8 w-8 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white sm:grid">MC</div></div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-amber-700">FRIDAY · NOVEMBER 27, 2026</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}{active==="Overview"&&<span className="text-amber-500">.</span>}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button onClick={()=>setShowNew(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700"><Plus size={15}/> Create new</button></div>

          {active==="Overview" ? <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Transport revenue" value="$2,840" note="Across 18 completed trips" icon={CarFront} positive/>
              <Metric label="Tax clients in progress" value="24" note="6 awaiting documents" icon={Users}/>
              <Metric label="Opportunities to review" value="2" note="1 strong match · 1 needs review" icon={BriefcaseBusiness}/>
              <Metric label="Open communications" value="8" note="Across your business channels" icon={MessageSquareText}/>
            </div>
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Business overview</h2><p className="mt-1 text-xs text-slate-500">Activity snapshot · sample figures</p></div><button onClick={()=>setActive("Transport")} className="text-xs font-semibold text-amber-700">View transport <ChevronRight size={13} className="inline"/></button></div><div className="mt-7 grid grid-cols-2 gap-5"><div><div className="text-xs text-slate-500">Transport · this week</div><div className="mt-2 text-2xl font-semibold">$4,620</div><div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700"><ArrowUpRight size={13}/> 8.4% vs last week</div></div><div><div className="text-xs text-slate-500">Taxes · active files</div><div className="mt-2 text-2xl font-semibold">24</div><div className="mt-2 text-[11px] text-slate-500">7 ready for review</div></div></div><div className="mt-7 flex h-36 items-end gap-2 border-b border-slate-100 pb-2">{[42,58,48,72,62,88,68,96,74,83,64,100,79,91].map((h,i)=><div key={i} className="flex-1 rounded-t-md bg-amber-400/80 transition hover:bg-amber-500" style={{height:`${h}%`}}/>)}</div><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>Nov 14</span><span>Nov 20</span><span>Nov 27</span></div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Priority inbox</h2><p className="mt-1 text-xs text-slate-500">Latest activity that may need you</p></div><button onClick={()=>setActive("Communications")} className="text-xs font-semibold text-amber-700">Open inbox <ChevronRight size={13} className="inline"/></button></div><div className="mt-5 space-y-4">{messages.map(m=><div key={m.name} className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-[10px] font-bold text-slate-600">{m.initials}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div className="truncate text-xs font-semibold">{m.name}</div><div className="shrink-0 text-[10px] text-slate-400">{m.time}</div></div><p className="mt-1 text-xs text-slate-500">{m.text}</p><span className="mt-1 inline-block text-[10px] font-medium text-amber-700">{m.type}</span></div></div>)}</div></div>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Work opportunities</h2><p className="mt-1 text-xs text-slate-500">Ranked for your review · no automatic replies</p></div><button onClick={()=>setActive("Work Opportunities")} className="text-xs font-semibold text-amber-700">See all <ChevronRight size={13} className="inline"/></button></div><div className="mt-4 space-y-3">{opportunities.slice(0,2).map(o=><div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><div className="text-xs font-semibold">{o.route}</div><div className="mt-1 text-[11px] text-slate-500">{o.detail}</div></div><div className="text-right"><div className="text-sm font-semibold">{o.price}</div><span className={`text-[10px] font-semibold ${o.tone==="green"?"text-emerald-700":"text-amber-700"}`}>{o.status}</span></div></div>)}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Quick access</h2><p className="mt-1 text-xs text-slate-500">Jump into the work you do most</p><div className="mt-4 grid grid-cols-2 gap-3">{[{label:"New trip",icon:CarFront,go:"Transport" as Section},{label:"Client files",icon:Users,go:"Clients" as Section},{label:"Review messages",icon:MessageSquareText,go:"Communications" as Section},{label:"Secure documents",icon:FolderLock,go:"Documents" as Section}].map(x=>{const Icon=x.icon;return <button key={x.label} onClick={()=>setActive(x.go)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/40"><Icon size={17} className="text-slate-500"/><span className="text-xs font-semibold">{x.label}</span></button>})}</div></div>
            </div>
          </> : active==="Work Opportunities" ? <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Opportunity review queue</h2><p className="mt-1 text-xs text-slate-500">Green and yellow items are surfaced. Red items stay out of your working inbox.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">Human approval required</span></div><div className="space-y-3">{opportunities.map(o=><div key={o.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-bold tracking-wider text-slate-400">{o.id}</div><div className="mt-1 font-semibold">{o.route}</div><div className="mt-1 text-xs text-slate-500">{o.detail}</div></div><div className="text-right"><div className="text-lg font-semibold">{o.price}</div><span className={`text-[10px] font-bold ${o.tone==="green"?"text-emerald-700":o.tone==="amber"?"text-amber-700":"text-slate-500"}`}>{o.status}</span></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="text-[11px] text-slate-500">Suggested response: YES · not sent</span><button onClick={()=>setApproved(prev=>prev.includes(o.id)?prev.filter(x=>x!==o.id):[...prev,o.id])} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${approved.includes(o.id)?"bg-emerald-100 text-emerald-800":"bg-slate-900 text-white"}`}>{approved.includes(o.id)?"Marked for follow-up":"Mark for follow-up"}</button></div></div>)}</div></div> : active==="Transport" ? <TransportWorkspace/> : active==="Taxes" ? <TaxWorkspace/> : active==="Communications" ? <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] text-slate-500">Unread messages</div><div className="mt-2 text-2xl font-semibold">{messageRows.filter(m=>m.status==="Unread").length}</div><div className="mt-1 text-[10px] text-slate-400">Sample inbox only</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] text-slate-500">Awaiting your review</div><div className="mt-2 text-2xl font-semibold">{messageRows.filter(m=>m.status!=="Read").length}</div><div className="mt-1 text-[10px] text-slate-400">Human review required</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] text-slate-500">Outbound messages sent</div><div className="mt-2 text-2xl font-semibold">0</div><div className="mt-1 text-[10px] text-slate-400">Sending is disabled in preview</div></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Unified communications center</h2><p className="mt-1 text-xs text-slate-500">One review workspace for Transport, Taxes and Work Opportunities.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-800">SAMPLE DATA · NO LIVE CONNECTIONS</span></div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px]"><input value={moduleSearch} onChange={e=>setModuleSearch(e.target.value)} placeholder="Search sender, content or area..." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-amber-400"/><select onChange={e=>setModuleSearch(e.target.value==="All"?"":e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option value="All">All business areas</option><option value="Transport">Transport</option><option value="Taxes">Taxes</option><option value="Work">Work Opportunities</option></select></div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.9fr)]">
                <div className="space-y-2">{messageRows.filter(m=>(m.name+" "+m.text+" "+m.type).toLowerCase().includes(moduleSearch.toLowerCase())).map(m=><button key={m.id} onClick={()=>{setSelectedMessageId(m.id);setMessageRows(prev=>prev.map(x=>x.id===m.id?{...x,status:"Read"}:x))}} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/40"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold">{m.initials}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold">{m.name}</span><span className="text-[10px] text-slate-400">{m.time}</span></div><p className="mt-1 text-xs text-slate-600">{m.text}</p><div className="mt-2 flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px]">{m.type}</span><span className={`rounded-full px-2 py-1 text-[10px] ${m.status==="Unread"?"bg-blue-50 text-blue-700":"bg-slate-100 text-slate-500"}`}>{m.status}</span></div></div></div></button>)}
                {messageRows.filter(m=>(m.name+" "+m.text+" "+m.type).toLowerCase().includes(moduleSearch.toLowerCase())).length===0&&<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400">No messages match this search.</div>}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div className="text-xs font-semibold">Message review</div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-500">HUMAN CONTROL</span></div>{(()=>{const selected=messageRows.find(x=>x.id===selectedMessageId);return selected?<><div className="mt-4 rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><div className="text-[11px] font-semibold">{selected.name}</div><span className="text-[9px] text-slate-400">{selected.time}</span></div><div className="mt-2 text-[10px] text-amber-700">{selected.type} · {selected.status}</div><p className="mt-2 text-xs leading-relaxed text-slate-700">{selected.text}</p></div><label className="mt-4 block text-[10px] font-semibold text-slate-600">Reply draft · preview only</label><textarea value={messageDrafts[selected.id]||""} onChange={e=>setMessageDrafts(prev=>({...prev,[selected.id]:e.target.value}))} placeholder="Prepare a response for human review..." className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs outline-none focus:border-amber-400"/><div className="mt-2 flex flex-wrap gap-2"><button onClick={()=>setMessageRows(prev=>prev.map(x=>x.id===selected.id?{...x,status:"Draft saved · local"}:x))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-semibold">Save draft</button><button disabled={!messageDrafts[selected.id]?.trim()} onClick={()=>setMessageRows(prev=>prev.map(x=>x.id===selected.id?{...x,status:"Approved · NOT SENT"}:x))} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Approve draft · demo</button></div><p className="mt-3 text-[10px] leading-relaxed text-amber-800">Approval changes only this sample record. It does not send, queue or contact anyone.</p></>:<div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-500">Select an inbox item to review it.</div>})()}<div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500"><p><strong className="text-slate-700">Workflow:</strong> received → classified → human review → draft → explicit approval.</p><p><strong className="text-slate-700">Safety:</strong> no automatic replies, no automatic acceptance of opportunities and no message delivery from this preview.</p><p><strong className="text-slate-700">Future connectors:</strong> WhatsApp Business, SMS and email require separate authorization and testing.</p></div></div>
              </div>
            </div>
          </div> : active==="Clients" ? <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold">Client directory</h2><p className="mt-1 text-xs text-slate-500">Local sample records · not connected to CRM database</p></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_150px_auto]"><input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Sample client name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-amber-400"/><select value={clientArea} onChange={e=>setClientArea(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option>Transport</option><option>Taxes</option></select><button onClick={()=>{if(!clientName.trim())return;setClientRows(prev=>[{id:`CL-${1025+prev.length-3}`,name:clientName,area:clientArea,status:"New sample",detail:"Added in this preview session"},...prev]);setClientName("")}} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white">Add sample</button></div><div className="mt-5 overflow-hidden rounded-xl border border-slate-100">{clientRows.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0"><div><div className="text-xs font-semibold">{c.name}</div><div className="mt-1 text-[11px] text-slate-500">{c.id} · {c.detail}</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px]">{c.area}</span><span className="text-[10px] font-semibold text-amber-700">{c.status}</span></div></div>)}</div></div> : <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold">Document register</h2><p className="mt-1 text-xs text-slate-500">Metadata-only examples · no file uploads or real documents</p></div><div className="mt-4 space-y-3">{documentRows.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><FolderLock size={17}/></div><div><div className="text-xs font-semibold">{d.name}</div><div className="mt-1 text-[10px] text-slate-500">{d.id} · {d.owner} · {d.area}</div></div></div><div className="flex items-center gap-2"><span className="text-[10px] font-medium text-slate-500">{d.status}</span>{d.status!=="Reviewed"&&<button onClick={()=>setDocumentRows(prev=>prev.map(x=>x.id===d.id?{...x,status:"Reviewed"}:x))} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold">Mark reviewed</button>}</div></div>)}</div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">Real document storage will require private object storage, access policies, audit logging, retention rules and verified recovery before any customer use.</div></div>}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400"><span>Copiloto V7 · Build preview · Sample data only</span><span>Not connected to live customer systems</span></div>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">{[{label:"Home",section:"Overview" as Section,icon:LayoutDashboard},{label:"Transport",section:"Transport" as Section,icon:CarFront},{label:"Taxes",section:"Taxes" as Section,icon:FileText},{label:"Opportunities",section:"Work Opportunities" as Section,icon:BriefcaseBusiness},{label:"Inbox",section:"Communications" as Section,icon:MessageSquareText}].map(x=>{const Icon=x.icon;return <button key={x.label} onClick={()=>setActive(x.section)} className={`flex flex-col items-center gap-1 py-1 text-[9px] font-semibold ${active===x.section?"text-amber-700":"text-slate-400"}`}><Icon size={18}/>{x.label}</button>})}</nav>
    </section>
    {showNew&&<div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-semibold">Create new</h3><button onClick={()=>setShowNew(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={17}/></button></div><p className="mt-2 text-xs text-slate-500">Choose a workspace to continue.</p><div className="mt-4 space-y-2">{navigation.slice(1).map(n=><button key={n.label} onClick={()=>{setActive(n.label);setShowNew(false)}} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-xs font-semibold hover:border-amber-300">{n.label}<ChevronRight size={15}/></button>)}</div></div></div>}
  </main>
}
