"use client"

import { useMemo, useState } from "react"
import { Inter } from "next/font/google"
import {
  Activity, Archive, ArrowDownLeft, ArrowUpRight, Bell, BriefcaseBusiness,
  Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleAlert, Clock3, FileText, Filter, Inbox, LockKeyhole, MessageCircle,
  MessageSquare, MoreHorizontal, Paperclip, Plus, Search, Send, ShieldCheck,
  Smartphone, UserRound, Users, Wallet, X
} from "lucide-react"

const inter = Inter({ subsets: ["latin"], display: "swap" })

type Area = "Transport" | "Taxes"
type Channel = "SMS" | "WhatsApp"
type MessageStatus = "Received" | "Draft" | "Awaiting approval" | "Approved · not sent" | "Queued · simulated" | "Delivered · sample receipt"
type SampleMessage = {
  id: string; client: string; clientId: string; channel: Channel; area: Area
  time: string; preview: string; body: string; status: MessageStatus; unread?: boolean
}

const seedMessages: SampleMessage[] = [
  { id:"SMS-2048", client:"Jordan Ellis", clientId:"CL-1024", channel:"SMS", area:"Transport", time:"9:42 AM", preview:"Can you confirm the airport pickup?", body:"Hi, can you confirm the airport pickup for tomorrow at 4:30 PM? I will have two suitcases.", status:"Awaiting approval", unread:true },
  { id:"SMS-2047", client:"Taylor Morgan", clientId:"CL-1023", channel:"SMS", area:"Taxes", time:"9:18 AM", preview:"I uploaded the documents.", body:"I uploaded the documents for my 2025 tax return. Please let me know if anything else is needed.", status:"Received", unread:true },
  { id:"WA-3012", client:"Casey Rivera", clientId:"CL-1022", channel:"WhatsApp", area:"Taxes", time:"8:56 AM", preview:"Can I schedule a review?", body:"Good morning. Can I schedule a review of my tax organizer this week?", status:"Draft" },
  { id:"WA-3011", client:"Morgan Reed", clientId:"CL-1025", channel:"WhatsApp", area:"Transport", time:"Yesterday", preview:"Thank you for the ride.", body:"Thank you for the ride yesterday. Everything was excellent.", status:"Delivered · sample receipt" },
]

const clients = [
  { id:"CL-1024", name:"Jordan Ellis", area:"Transport" as Area, status:"Active", phone:"(555) 010-0100", email:"jordan.sample@example.test", detail:"Executive SUV · Preferred client", last:"SMS · 9:42 AM" },
  { id:"CL-1023", name:"Taylor Morgan", area:"Taxes" as Area, status:"Awaiting documents", phone:"(555) 010-0101", email:"taylor.sample@example.test", detail:"2025 individual return", last:"SMS · 9:18 AM" },
  { id:"CL-1022", name:"Casey Rivera", area:"Taxes" as Area, status:"In review", phone:"(555) 010-0102", email:"casey.sample@example.test", detail:"2025 individual return", last:"WhatsApp · 8:56 AM" },
  { id:"CL-1025", name:"Morgan Reed", area:"Transport" as Area, status:"Active", phone:"(555) 010-0103", email:"morgan.sample@example.test", detail:"Airport transfer · Repeat client", last:"WhatsApp · Yesterday" },
]

const badgeTone: Record<string,string> = {
  "Transport":"text-[#08B9ED] border-[#08B9ED]/30 bg-[#08B9ED]/10",
  "Taxes":"text-[#FFB900] border-[#FFB900]/30 bg-[#FFB900]/10",
  "Received":"text-[#08B9ED] border-[#08B9ED]/25 bg-[#08B9ED]/10",
  "Draft":"text-white/60 border-white/15 bg-white/5",
  "Awaiting approval":"text-[#FFB900] border-[#FFB900]/30 bg-[#FFB900]/10",
  "Approved · not sent":"text-[#00C76A] border-[#00C76A]/30 bg-[#00C76A]/10",
  "Queued · simulated":"text-[#08B9ED] border-[#08B9ED]/30 bg-[#08B9ED]/10",
  "Delivered · sample receipt":"text-[#00C76A] border-[#00C76A]/30 bg-[#00C76A]/10",
}

function Pill({ children, tone }: {children: React.ReactNode; tone?: string}) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone || "border-white/10 bg-white/5 text-white/65"}`}>{children}</span>
}
function Panel({ children, className="" }: {children: React.ReactNode; className?: string}) {
  return <section className={`rounded-2xl border border-white/[0.08] bg-[#191919] ${className}`}>{children}</section>
}
function SectionTitle({eyebrow,title,detail}:{eyebrow:string;title:string;detail:string}) {
  return <div className="mb-5"><div className="text-[10px] font-bold tracking-[.2em] text-[#FFB900]">{eyebrow}</div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-white/45">{detail}</p></div>
}

export function CRMDesignWorkspace() {
  const [screen,setScreen] = useState("Overview")
  const [channel,setChannel] = useState<Channel>("SMS")
  const [area,setArea] = useState<"All" | Area>("All")
  const [selected,setSelected] = useState("SMS-2048")
  const [messages,setMessages] = useState(seedMessages)
  const [drafts,setDrafts] = useState<Record<string,string>>({
    "SMS-2048":"Hi Jordan, your airport pickup request is received. I’m checking the schedule and will confirm the details shortly.",
    "SMS-2047":"Thank you, Taylor. We received your documents. We’ll review them and let you know if anything else is needed.",
    "WA-3012":"Hello Casey, absolutely. We can arrange a review this week. Which day works best for you?",
    "WA-3011":"Thank you, Morgan. We appreciate your feedback and look forward to helping again."
  })
  const [search,setSearch] = useState("")
  const [notice,setNotice] = useState("Preview only · Synthetic records · No provider connected")
  const [mobileMenu,setMobileMenu] = useState(false)
  const [clientSelected,setClientSelected] = useState("CL-1024")

  const visibleMessages = useMemo(()=>messages.filter(m=>m.channel===channel && (area==="All" || m.area===area) && (m.client+m.preview+m.id).toLowerCase().includes(search.toLowerCase())),[messages,channel,area,search])
  const current = messages.find(m=>m.id===selected && m.channel===channel) || visibleMessages[0]
  const client = clients.find(c=>c.id===clientSelected) || clients[0]
  const history = messages.filter(m=>m.clientId===clientSelected)

  function updateMessage(id:string,patch:Partial<SampleMessage>) {
    setMessages(prev=>prev.map(m=>m.id===id?{...m,...patch}:m))
  }
  function approve() {
    if(!current || !(drafts[current.id]||"").trim()) return
    updateMessage(current.id,{status:"Approved · not sent"})
    setNotice("Draft approved in this prototype. It was NOT sent to SMS or WhatsApp.")
  }
  function simulateQueue() {
    if(!current || current.status!=="Approved · not sent") return
    updateMessage(current.id,{status:"Queued · simulated"})
    setNotice("Simulated queue state only. No provider request or external message was made.")
  }

  const nav = [
    {name:"Overview",icon:Activity,group:"WORKSPACE"},
    {name:"Clients",icon:Users,group:"CRM"},
    {name:"Transport",icon:Building2,group:"BUSINESS"},
    {name:"Taxes",icon:FileText,group:"BUSINESS"},
    {name:"Documents",icon:Archive,group:"CRM"},
    {name:"Communications",icon:MessageSquare,group:"CRM"},
  ]
  const activeClient = clients.find(c=>c.id===clientSelected) || clients[0]

  return <main className={`min-h-screen bg-[#050505] font-sans text-white ${inter.className}`}>
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className={`${mobileMenu?"fixed inset-y-0 left-0 z-50 flex":"hidden"} w-[250px] shrink-0 flex-col border-r border-white/[0.08] bg-[#080808] lg:sticky lg:top-0 lg:flex lg:h-screen`}>
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-5">
          <img src="/logos/island-city.jpg" alt="Island City Transit original logo" className="h-10 w-10 rounded-lg object-contain bg-white p-0.5"/>
          <div><div className="text-base font-bold tracking-tight">Copiloto <span className="text-[#FFB900]">V7</span></div><div className="text-[9px] tracking-[.18em] text-white/40">BUSINESS OPERATIONS</div></div>
          <button className="ml-auto rounded-lg p-2 text-white/50 lg:hidden" onClick={()=>setMobileMenu(false)} aria-label="Close navigation"><X size={18}/></button>
        </div>
        <div className="px-4 py-4"><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#191919] px-3 py-2.5"><Search size={14} className="text-white/35"/><input aria-label="Search workspaces" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search workspace" className="min-w-0 w-full bg-transparent text-xs outline-none placeholder:text-white/30"/></div></div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">{["WORKSPACE","CRM","BUSINESS"].map(group=><div key={group}><div className="px-3 pb-2 text-[9px] font-bold tracking-[.2em] text-white/30">{group}</div><div className="space-y-1">{nav.filter(n=>n.group===group).map(n=>{const Icon=n.icon;return <button key={n.name} onClick={()=>{setScreen(n.name);setMobileMenu(false)}} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${screen===n.name?"bg-[#FFB900] font-bold text-black":"text-white/65 hover:bg-white/[0.06] hover:text-white"}`}><Icon size={17}/>{n.name}{n.name==="Communications"&&<span className="ml-auto rounded-full bg-[#E64B55]/15 px-2 py-0.5 text-[10px] font-bold text-[#E64B55]">4</span>}</button>})}</div></div>)}</nav>
        <div className="border-t border-white/[0.08] p-4"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#00C76A]"/><span className="text-[11px] text-white/65">Private workspace · demo</span></div><div className="mt-3 flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-white/10 text-xs font-bold">MC</div><div><div className="text-xs font-semibold">Workspace owner</div><div className="text-[10px] text-white/35">Administrator preview</div></div></div></div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-white/[0.08] bg-[#050505]/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-white/60 lg:hidden" onClick={()=>setMobileMenu(true)} aria-label="Open navigation"><ChevronRight size={18}/></button><div><div className="text-xs text-white/40">Copiloto / {screen}</div><div className="text-sm font-semibold">{screen==="Overview"?"Business overview":screen+" workspace"}</div></div></div>
          <div className="flex items-center gap-2"><Pill tone="border-[#FFB900]/30 bg-[#FFB900]/10 text-[#FFB900]">DESIGN PREVIEW · SYNTHETIC DATA</Pill><button aria-label="Notifications" className="relative rounded-xl border border-white/10 p-2.5 text-white/60"><Bell size={16}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#FFB900]"/></button></div>
        </header>

        <div className="mx-auto max-w-[1320px] px-4 py-6 pb-16 sm:px-7 sm:py-8">
          {screen==="Overview" && <>
            <SectionTitle eyebrow="COPILOTO · OPERATIONS" title="Your business, in one place." detail="A unified view of Transport and Taxes, with clear separation of records and communications."/>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[{label:"Active clients",value:"24",note:"Synthetic workspace count",icon:Users,color:"text-[#08B9ED]"},{label:"Transport activity",value:"18",note:"Sample trips this week",icon:Building2,color:"text-[#FFB900]"},{label:"Tax files in progress",value:"12",note:"Synthetic cases",icon:FileText,color:"text-[#08B9ED]"},{label:"Messages for review",value:"4",note:"Across separate channel inboxes",icon:Inbox,color:"text-[#E64B55]"}].map(m=>{const Icon=m.icon;return <Panel key={m.label} className="p-4"><div className="flex items-center justify-between text-xs text-white/45">{m.label}<Icon size={17} className={m.color}/></div><div className="mt-3 text-3xl font-semibold tracking-tight">{m.value}</div><div className="mt-1 text-[10px] text-white/35">{m.note}</div></Panel>})}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
              <Panel className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Business areas</h2><p className="mt-1 text-xs text-white/40">Access and information stay separated by business unit.</p></div><LockKeyhole size={18} className="text-[#00C76A]"/></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={()=>setScreen("Transport")} className="rounded-xl border border-[#08B9ED]/25 bg-[#08B9ED]/[0.06] p-4 text-left"><div className="flex items-center gap-2 text-[#08B9ED]"><Building2 size={18}/><span className="text-xs font-bold uppercase tracking-wide">Island City Transit</span></div><div className="mt-3 text-lg font-semibold text-white">Transport</div><div className="mt-1 text-xs text-white/45">Clients, reservations, trips and service history.</div><div className="mt-4 text-xs font-semibold text-[#08B9ED]">Open workspace <ChevronRight size={13} className="inline"/></div></button><button onClick={()=>setScreen("Taxes")} className="rounded-xl border border-[#FFB900]/25 bg-[#FFB900]/[0.05] p-4 text-left"><div className="flex items-center gap-2 text-[#FFB900]"><FileText size={18}/><span className="text-xs font-bold uppercase tracking-wide">Brakha Group Tax Services</span></div><div className="mt-3 text-lg font-semibold text-white">Taxes</div><div className="mt-1 text-xs text-white/45">Tax clients, annual cases, documents and review.</div><div className="mt-4 text-xs font-semibold text-[#FFB900]">Open workspace <ChevronRight size={13} className="inline"/></div></button></div></Panel>
              <Panel className="p-5"><h2 className="font-semibold">Communication channels</h2><p className="mt-1 text-xs text-white/40">Independent inboxes. No shared message stream.</p><div className="mt-4 space-y-3">{(["SMS","WhatsApp"] as Channel[]).map(ch=><button key={ch} onClick={()=>{setScreen("Communications");setChannel(ch)}} className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-3 text-left hover:bg-white/[0.04]"><div className={`grid size-10 place-items-center rounded-xl ${ch==="SMS"?"bg-[#08B9ED]/10 text-[#08B9ED]":"bg-[#00C76A]/10 text-[#00C76A]"}`}>{ch==="SMS"?<Smartphone size={18}/>:<MessageCircle size={18}/>}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{ch}</div><div className="text-[10px] text-white/40">{messages.filter(m=>m.channel===ch).length} synthetic conversations · separate inbox</div></div><ChevronRight size={16} className="text-white/35"/></button>)}</div></Panel>
            </div>
          </>}

          {screen==="Communications" && <>
            <SectionTitle eyebrow="COMMUNICATIONS CENTER" title="Separate channel workspaces." detail="Review incoming messages, edit drafts and approve manually. No message is transmitted in this design preview."/>
            <div className="mb-4 grid grid-cols-2 gap-3">
              {(["SMS","WhatsApp"] as Channel[]).map(ch=><button key={ch} onClick={()=>{setChannel(ch);setSelected(ch==="SMS"?"SMS-2048":"WA-3012")}} className={`flex min-h-[76px] items-center gap-3 rounded-2xl border p-4 text-left ${channel===ch?"border-[#FFB900]/50 bg-[#FFB900]/[0.07]":"border-white/10 bg-[#191919]"}`}><div className={`grid size-10 place-items-center rounded-xl ${ch==="SMS"?"bg-[#08B9ED]/10 text-[#08B9ED]":"bg-[#00C76A]/10 text-[#00C76A]"}`}>{ch==="SMS"?<Smartphone/>:<MessageCircle/>}</div><div><div className="text-sm font-bold">{ch} inbox</div><div className="text-[10px] text-white/40">{messages.filter(m=>m.channel===ch).length} sample conversations</div></div>{channel===ch&&<CheckCircle2 className="ml-auto text-[#FFB900]" size={18}/>}</button>)}
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{(["All","Transport","Taxes"] as const).map(a=><button key={a} onClick={()=>setArea(a)} className={`rounded-full border px-3 py-2 text-[11px] font-semibold ${area===a?"border-[#FFB900] bg-[#FFB900] text-black":"border-white/10 text-white/55"}`}>{a}</button>)}</div><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#191919] px-3 py-2"><Search size={14} className="text-white/35"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${channel} inbox`} className="w-40 bg-transparent text-xs outline-none placeholder:text-white/30"/></div></div>
            <div className="grid min-h-[590px] gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
              <Panel className="overflow-hidden"><div className="border-b border-white/[0.08] p-4"><div className="flex items-center justify-between"><div className="text-sm font-semibold">{channel} · Inbox</div><Pill>{visibleMessages.length} shown</Pill></div><div className="mt-1 text-[10px] text-white/35">Only {channel} messages appear here.</div></div><div className="divide-y divide-white/[0.06]">{visibleMessages.map(m=><button key={m.id} onClick={()=>setSelected(m.id)} className={`w-full p-4 text-left ${current?.id===m.id?"bg-white/[0.06]":"hover:bg-white/[0.03]"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{m.client}</span><span className="shrink-0 text-[9px] text-white/35">{m.time}</span></div><div className="mt-1 flex items-center gap-2"><Pill tone={badgeTone[m.area]}>{m.area}</Pill>{m.unread&&<span className="size-1.5 rounded-full bg-[#08B9ED]"/>}</div><div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/45">{m.preview}</div><div className="mt-3"><Pill tone={badgeTone[m.status]}>{m.status}</Pill></div></button>)}{visibleMessages.length===0&&<div className="p-8 text-center text-xs text-white/35">No messages in this {channel} inbox for the selected filter.</div>}</div></Panel>
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_270px]">
                <Panel className="flex min-w-0 flex-col p-4 sm:p-5">
                  {current?<><div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-4"><div><div className="text-[10px] font-bold tracking-wide text-white/35">{current.id} · {current.time}</div><h2 className="mt-1 text-lg font-semibold">{current.client}</h2><div className="mt-2 flex flex-wrap gap-2"><Pill tone={badgeTone[current.channel==="SMS"?"Received":"Draft"]}>{current.channel}</Pill><Pill tone={badgeTone[current.area]}>{current.area}</Pill><Pill tone={badgeTone[current.status]}>{current.status}</Pill></div></div><button onClick={()=>setClientSelected(current.clientId)} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-semibold text-white/70">Open client record <ChevronRight size={13} className="inline"/></button></div>
                    <div className="flex-1 py-5"><div className="max-w-[680px] rounded-2xl rounded-tl-sm border border-white/10 bg-[#101010] p-4"><div className="mb-2 flex items-center gap-2 text-[10px] text-white/35"><ArrowDownLeft size={13}/> Incoming · {current.channel}</div><p className="text-sm leading-relaxed text-white/85">{current.body}</p></div><div className="mt-3 text-right text-[9px] text-white/30">Synthetic inbound message · not from a real customer</div></div>
                    <div className="border-t border-white/[0.08] pt-4"><div className="mb-2 flex items-center justify-between"><label htmlFor="message-draft" className="text-xs font-semibold">Editable reply draft</label><Pill tone="border-[#FFB900]/30 text-[#FFB900]">Human review required</Pill></div><textarea id="message-draft" value={drafts[current.id]||""} onChange={e=>setDrafts(p=>({...p,[current.id]:e.target.value}))} rows={4} className="w-full resize-y rounded-xl border border-white/10 bg-[#101010] p-3 text-sm leading-relaxed text-white outline-none focus:border-[#FFB900]/60"/><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-white/35">Approval does not send. Provider integration is disabled.</span><div className="flex gap-2"><button onClick={()=>setDrafts(p=>({...p,[current.id]:""}))} className="rounded-xl border border-white/10 px-3 py-2.5 text-[11px] font-semibold text-white/65">Clear draft</button><button onClick={approve} disabled={!drafts[current.id]?.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#FFB900] px-4 py-2.5 text-[11px] font-bold text-black disabled:opacity-40"><Check size={14}/> Approve draft</button></div></div>{current.status==="Approved · not sent"&&<button onClick={simulateQueue} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#08B9ED]/30 px-3 py-2 text-[11px] font-semibold text-[#08B9ED]"><Clock3 size={13}/> Simulate queued state (no send)</button>}</div>
                  </>:<div className="grid flex-1 place-items-center text-sm text-white/35">Choose a message from this inbox.</div>}
                </Panel>
                <Panel className="p-4"><div className="flex items-center gap-2"><UserRound size={16} className="text-[#08B9ED]"/><h3 className="text-sm font-semibold">Client context</h3></div>{current&&<><div className="mt-4 text-sm font-semibold">{current.client}</div><div className="mt-1 text-[10px] text-white/35">{current.clientId}</div><div className="mt-3 space-y-2 text-[11px] text-white/60"><div>{clients.find(c=>c.id===current.clientId)?.phone}</div><div>{current.area} account</div></div><div className="mt-4 border-t border-white/[0.08] pt-4"><div className="mb-2 text-[10px] font-bold tracking-wide text-white/35">RECENT CLIENT ACTIVITY</div>{messages.filter(m=>m.clientId===current.clientId).map(m=><div key={m.id} className="mb-2 rounded-lg bg-white/[0.04] p-2"><div className="flex justify-between text-[9px] text-white/35"><span>{m.channel}</span><span>{m.time}</span></div><div className="mt-1 text-[10px] text-white/70">{m.preview}</div><div className="mt-1 text-[9px] text-white/40">{m.status}</div></div>)}</div></>}</Panel>
              </div>
            </div>
          </>}

          {screen==="Clients" && <>
            <SectionTitle eyebrow="CLIENT RELATIONSHIP MANAGEMENT" title="Client records." detail="A single client identity with business-area separation and a complete communication timeline."/>
            <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-4"><div className="text-sm font-semibold">Client directory <span className="ml-2 text-xs font-normal text-white/35">Synthetic records</span></div><div className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2"><Search size={14} className="text-white/35"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients" className="w-40 bg-transparent text-xs outline-none"/></div></div><div className="grid lg:grid-cols-[minmax(0,1fr)_340px]"><div className="divide-y divide-white/[0.06]">{clients.filter(c=>(c.name+c.id+c.area).toLowerCase().includes(search.toLowerCase())).map(c=><button key={c.id} onClick={()=>setClientSelected(c.id)} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-white/[0.03] ${clientSelected===c.id?"bg-white/[0.05]":""}`}><div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">{c.name.split(" ").map(s=>s[0]).join("")}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{c.name}</div><div className="mt-1 text-[10px] text-white/40">{c.id} · {c.detail}</div></div><Pill tone={badgeTone[c.area]}>{c.area}</Pill><ChevronRight size={15} className="text-white/30"/></button>)}</div><div className="border-t border-white/[0.08] p-4 lg:border-l lg:border-t-0"><div className="flex items-center gap-2"><UserRound size={16} className="text-[#08B9ED]"/><h3 className="font-semibold">Client profile</h3></div><div className="mt-4 text-lg font-semibold">{activeClient.name}</div><div className="mt-1 text-[10px] text-white/35">{activeClient.id}</div><div className="mt-4 space-y-2 text-xs text-white/65"><div>{activeClient.phone}</div><div>{activeClient.email}</div><Pill tone={badgeTone[activeClient.area]}>{activeClient.area}</Pill></div><div className="mt-5 border-t border-white/[0.08] pt-4"><div className="mb-3 text-[10px] font-bold tracking-wide text-white/35">COMMUNICATION HISTORY</div>{history.length?history.map(m=><div key={m.id} className="mb-3 rounded-xl border border-white/[0.07] bg-[#101010] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-bold">{m.channel} · {m.area}</span><span className="text-[9px] text-white/35">{m.time}</span></div><div className="mt-2 text-xs text-white/70">{m.preview}</div><div className="mt-2"><Pill tone={badgeTone[m.status]}>{m.status}</Pill></div></div>):<div className="text-xs text-white/35">No sample communication history.</div>}</div></div></div></Panel>
          </>}

          {screen==="Transport" && <><SectionTitle eyebrow="ISLAND CITY TRANSIT" title="Transport workspace." detail="Reservations, trips, client coordination and operational follow-up. Design only."/><div className="grid gap-3 md:grid-cols-3">{[{t:"Reservations",v:"08",d:"Sample requests"},{t:"Upcoming pickups",v:"03",d:"Illustrative schedule"},{t:"Needs confirmation",v:"02",d:"Human review queue"}].map(x=><Panel key={x.t} className="p-5"><div className="text-xs text-white/40">{x.t}</div><div className="mt-2 text-3xl font-semibold">{x.v}</div><div className="mt-1 text-[10px] text-white/35">{x.d}</div></Panel>)}</div><Panel className="mt-4 p-5"><h2 className="font-semibold">Transport client activity</h2><div className="mt-4 space-y-3">{clients.filter(c=>c.area==="Transport").map(c=><div key={c.id} className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3"><div><div className="text-sm font-semibold">{c.name}</div><div className="text-[10px] text-white/40">{c.detail}</div></div><Pill tone={badgeTone.Transport}>Transport</Pill></div>)}</div></Panel></>}

          {screen==="Taxes" && <><SectionTitle eyebrow="BRAKHA GROUP TAX SERVICES" title="Taxes workspace." detail="Tax-client workflow, document readiness and review. Separate from Transport access and records."/><div className="grid gap-3 md:grid-cols-3">{[{t:"Open tax cases",v:"12",d:"Synthetic case count"},{t:"Awaiting documents",v:"04",d:"Illustrative checklist"},{t:"Ready for review",v:"03",d:"Human review required"}].map(x=><Panel key={x.t} className="p-5"><div className="text-xs text-white/40">{x.t}</div><div className="mt-2 text-3xl font-semibold">{x.v}</div><div className="mt-1 text-[10px] text-white/35">{x.d}</div></Panel>)}</div><Panel className="mt-4 p-5"><h2 className="font-semibold">Tax client activity</h2><div className="mt-4 space-y-3">{clients.filter(c=>c.area==="Taxes").map(c=><div key={c.id} className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3"><div><div className="text-sm font-semibold">{c.name}</div><div className="text-[10px] text-white/40">{c.detail}</div></div><Pill tone={badgeTone.Taxes}>Taxes</Pill></div>)}</div></Panel></>}

          {screen==="Documents" && <><SectionTitle eyebrow="PRIVATE DOCUMENT WORKSPACE" title="Documents & records." detail="Design for secure document intake, review, classification and client-linked retrieval. No real files in preview."/><div className="grid gap-3 md:grid-cols-3">{[{t:"Awaiting classification",v:"03"},{t:"Needs human review",v:"02"},{t:"Filed in sample records",v:"18"}].map(x=><Panel key={x.t} className="p-5"><div className="text-xs text-white/40">{x.t}</div><div className="mt-2 text-3xl font-semibold">{x.v}</div></Panel>)}</div><Panel className="mt-4 p-5"><div className="flex items-center gap-2"><LockKeyhole className="text-[#00C76A]" size={17}/><h2 className="font-semibold">Document handling sequence</h2></div><div className="mt-4 grid gap-3 md:grid-cols-4">{["Receive in private intake","Scan / extract to temporary workspace","Human verifies classification and owner","Store approved original in client vault"].map((s,i)=><div key={s} className="rounded-xl border border-white/[0.08] bg-[#101010] p-3"><div className="text-[10px] font-bold text-[#FFB900]">STEP 0{i+1}</div><div className="mt-2 text-xs font-medium">{s}</div></div>)}</div></Panel></>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4 text-[10px] text-white/30"><span>Copiloto V7 · Design System V1.0 · Inter</span><span>Illustrative UI only · no live data or external actions</span></div>
        </div>
      </section>
    </div>
    <div role="status" className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100%-24px)] items-center gap-2 rounded-xl border border-[#FFB900]/25 bg-[#191919] px-3 py-2 text-[10px] text-white/65 shadow-xl"><CircleAlert size={14} className="shrink-0 text-[#FFB900]"/>{notice}</div>
  </main>
}
