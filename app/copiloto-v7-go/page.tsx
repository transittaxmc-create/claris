"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, CarFront, Check,
  ChevronRight, Clock3, MapPin, MessageCircle, Plus, Search, Send,
  UserRound, X, Zap
} from "lucide-react"

type Tab = "Today" | "Inbox" | "Trips" | "Clients" | "More"
type Trip = { id: string; pickup: string; dropoff: string; fare: string; client: string; status: string }
type Client = { id: string; name: string; phone: string; note: string }

const seedMessages = [
  { id: "M-101", name: "Jordan Ellis", channel: "WhatsApp Business", time: "2 min", text: "Can you pick me up at JFK at 4:30?", area: "Transport", unread: true },
  { id: "M-102", name: "Taylor Morgan", channel: "SMS", time: "18 min", text: "I sent the documents. Please confirm when received.", area: "Taxes", unread: true },
  { id: "M-103", name: "Dispatch group · shared", channel: "Manual capture", time: "31 min", text: "SUV needed tomorrow, Newark to Brooklyn. $140.", area: "Opportunity", unread: false },
]

const seedClients: Client[] = [
  { id: "ACT-0-100", name: "Jordan Ellis", phone: "(555) 010-0100", note: "Transport · preferred client" },
  { id: "ACT-0-101", name: "Taylor Morgan", phone: "(555) 010-0101", note: "Taxes · documents pending" },
]

const seedTrips: Trip[] = [
  { id: "TR-3408", pickup: "JFK Airport", dropoff: "Midtown Manhattan", fare: "$95", client: "Jordan Ellis", status: "Completed" },
]

export default function CopilotoGoPage() {
  const [tab, setTab] = useState<Tab>("Today")
  const [showTrip, setShowTrip] = useState(false)
  const [pickup, setPickup] = useState("")
  const [dropoff, setDropoff] = useState("")
  const [fare, setFare] = useState("")
  const [client, setClient] = useState("")
  const [trips, setTrips] = useState(seedTrips)
  const [clients, setClients] = useState(seedClients)
  const [messages, setMessages] = useState(seedMessages)
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [approved, setApproved] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [newClient, setNewClient] = useState("")
  const [notice, setNotice] = useState("")

  const currentMessage = messages.find(m => m.id === selectedMessage)
  const filteredClients = useMemo(() => clients.filter(c => (c.name + c.phone).toLowerCase().includes(search.toLowerCase())), [clients, search])

  function saveTrip() {
    if (!pickup.trim() || !dropoff.trim() || !fare.trim()) {
      setNotice("Add pickup, destination and fare to save the trip.")
      return
    }
    setTrips(prev => [{ id: `TR-${Date.now().toString().slice(-5)}`, pickup, dropoff, fare: fare.startsWith("$") ? fare : `$${fare}`, client: client || "New / unlinked client", status: "Draft · local demo" }, ...prev])
    setPickup(""); setDropoff(""); setFare(""); setClient(""); setShowTrip(false); setTab("Trips")
    setNotice("Trip added to this interactive demo. It has not been saved to the CRM database.")
  }

  function addClient() {
    if (!newClient.trim()) return
    setClients(prev => [...prev, { id: `DEMO-${prev.length + 1}`, name: newClient.trim(), phone: "Add phone", note: "New contact · local demo" }])
    setNewClient("")
    setNotice("Contact added to this demo only, not the central CRM.")
  }

  function selectMessage(id: string) {
    setSelectedMessage(id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, unread: false } : m))
    setDraft("Thanks for reaching out. Let me confirm the details and get back to you shortly.")
  }

  function approveDraft() {
    if (!selectedMessage || !draft.trim()) return
    setApproved(prev => [...prev, selectedMessage])
    setNotice("Draft marked approved in this demo. No WhatsApp or SMS was sent.")
  }

  const tabs: { id: Tab; label: string; icon: typeof Zap }[] = [
    { id: "Today", label: "Today", icon: Zap },
    { id: "Inbox", label: "Inbox", icon: MessageCircle },
    { id: "Trips", label: "Trips", icon: CarFront },
    { id: "Clients", label: "Clients", icon: UserRound },
    { id: "More", label: "More", icon: Plus },
  ]

  return (
    <main className="min-h-[100dvh] bg-[#080808] text-white">
      <div className="mx-auto min-h-[100dvh] max-w-[1180px] border-x border-white/10">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#080808]/95 px-4 py-3 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7c943] text-black"><Zap size={21} fill="currentColor"/></div>
            <div><div className="text-lg font-bold tracking-tight">Copiloto <span className="text-[#f7c943]">V7</span></div><div className="text-[9px] font-bold tracking-[.2em] text-white/45">GO MODE · INTERACTIVE PREVIEW</div></div>
          </div>
          <div className="rounded-full border border-amber-300/30 px-3 py-1.5 text-[10px] font-bold tracking-wide text-amber-200">SAMPLE DATA</div>
        </header>

        <div className="grid gap-6 px-4 pb-28 pt-5 sm:px-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)] lg:pb-8">
          <section className="min-w-0">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div><div className="text-[10px] font-bold tracking-[.22em] text-[#f7c943]">ON THE GO</div><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{tab === "Today" ? "Ready when you are." : tab}</h1><p className="mt-1 text-sm text-white/55">{tab === "Today" ? "The next action, without digging through menus." : "Fast operations · clear next steps"}</p></div>
              <div className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 sm:block">Transport · Taxes</div>
            </div>

            {tab === "Today" && <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#171717] p-3"><div className="text-[10px] text-white/45">New messages</div><div className="mt-1 text-2xl font-bold">{messages.filter(m => m.unread).length}</div></div>
                <div className="rounded-2xl bg-[#171717] p-3"><div className="text-[10px] text-white/45">Trips today</div><div className="mt-1 text-2xl font-bold">{trips.length}</div></div>
                <div className="rounded-2xl bg-[#171717] p-3"><div className="text-[10px] text-white/45">To review</div><div className="mt-1 text-2xl font-bold">2</div></div>
              </div>
              <button onClick={() => { setShowTrip(true); setTab("Trips") }} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[#f7c943] p-4 text-left text-black active:scale-[.99]">
                <span className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-black/10"><Plus size={23}/></span><span><span className="block text-base font-extrabold">Quick trip entry</span><span className="block text-xs text-black/65">Pickup · destination · fare</span></span></span><ChevronRight/>
              </button>
              <div className="mt-6 flex items-center justify-between"><h2 className="text-sm font-bold">Needs your attention</h2><button onClick={() => setTab("Inbox")} className="text-xs font-semibold text-[#f7c943]">Open inbox <ChevronRight className="inline" size={13}/></button></div>
              <div className="mt-3 space-y-2">
                {messages.filter(m => m.unread).slice(0,2).map(m => <button key={m.id} onClick={() => { selectMessage(m.id); setTab("Inbox") }} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#121212] p-3 text-left">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5"><MessageCircle size={18} className="text-[#f7c943]"/></span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><b className="truncate text-sm">{m.name}</b><span className="shrink-0 text-[10px] text-white/40">{m.time}</span></span><span className="mt-1 block truncate text-xs text-white/55">{m.text}</span><span className="mt-1 block text-[10px] text-[#f7c943]">{m.area} · {m.channel}</span></span><ChevronRight size={17} className="shrink-0 text-white/35"/>
                </button>)}
              </div>
              <div className="mt-6 flex items-center justify-between"><h2 className="text-sm font-bold">Work opportunities</h2><button onClick={() => setTab("More")} className="text-xs text-[#f7c943]">Review <ChevronRight className="inline" size={13}/></button></div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-[#121212] p-4"><div className="flex items-center justify-between"><div><div className="text-sm font-bold">Newark → Brooklyn</div><div className="mt-1 text-xs text-white/50">Tomorrow · SUV · shared manually</div></div><div className="text-right"><div className="font-bold">$140</div><span className="text-[10px] text-emerald-300">Potential fit</span></div></div><div className="mt-3 flex gap-2"><button onClick={() => setNotice("Opportunity opened for review. No job accepted.")} className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-bold">Review details</button><button onClick={() => setNotice("Interest draft prepared. Human approval is still required; nothing was sent.")} className="flex-1 rounded-xl bg-[#f7c943] py-2.5 text-xs font-bold text-black">Prepare reply</button></div></div>
            </>}

            {tab === "Inbox" && <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-[#121212] p-3 text-xs text-white/55">One queue for WhatsApp, SMS and manually shared requests. Sample messages only.</div>
              {messages.map(m => <button key={m.id} onClick={() => selectMessage(m.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedMessage === m.id ? "border-[#f7c943] bg-[#17150d]" : "border-white/10 bg-[#121212]"}`}><div className="flex justify-between gap-2"><b className="text-sm">{m.name}</b><span className="text-[10px] text-white/40">{m.time}</span></div><p className="mt-2 text-sm text-white/65">{m.text}</p><div className="mt-2 flex gap-2 text-[10px] text-[#f7c943]"><span>{m.area}</span><span>·</span><span>{m.channel}</span></div></button>)}
              {currentMessage && <div className="rounded-2xl border border-[#f7c943]/40 bg-[#17150d] p-4"><div className="text-xs font-bold text-[#f7c943]">Reply draft · {currentMessage.name}</div><textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-[#f7c943]" aria-label="Reply draft"/><button onClick={approveDraft} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f7c943] py-3 text-sm font-extrabold text-black"><Check size={17}/> Approve draft (demo only)</button>{approved.includes(currentMessage.id) && <p className="mt-2 text-xs text-emerald-300">Marked approved in this demo. Not sent.</p>}</div>}
            </div>}

            {tab === "Trips" && <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Trip activity</h2><button onClick={() => setShowTrip(v => !v)} className="flex items-center gap-2 rounded-xl bg-[#f7c943] px-3 py-2.5 text-xs font-extrabold text-black"><Plus size={15}/> New trip</button></div>
              {showTrip && <div className="rounded-2xl border border-[#f7c943]/40 bg-[#15130d] p-4"><div className="mb-3 flex items-center justify-between"><b className="text-sm">Quick entry</b><button onClick={() => setShowTrip(false)} aria-label="Close"><X size={18}/></button></div>
                <label className="mb-1 block text-xs text-white/55">Pickup location</label><div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3"><MapPin size={16} className="text-emerald-300"/><input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Enter or capture pickup" className="w-full bg-transparent py-3 text-sm outline-none"/></div>
                <label className="mb-1 block text-xs text-white/55">Destination</label><div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3"><MapPin size={16} className="text-sky-300"/><input value={dropoff} onChange={e=>setDropoff(e.target.value)} placeholder="Enter destination" className="w-full bg-transparent py-3 text-sm outline-none"/></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs text-white/55">Fare ($)</label><input inputMode="decimal" value={fare} onChange={e=>setFare(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"/></div><div><label className="mb-1 block text-xs text-white/55">Client (optional)</label><input value={client} onChange={e=>setClient(e.target.value)} placeholder="Client name" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"/></div></div>
                <button onClick={saveTrip} className="mt-4 w-full rounded-xl bg-[#f7c943] py-3.5 text-sm font-extrabold text-black">Save trip · demo</button>
              </div>}
              {trips.map(t=><div key={t.id} className="rounded-2xl border border-white/10 bg-[#121212] p-4"><div className="flex items-center justify-between"><b className="text-sm">{t.pickup} → {t.dropoff}</b><span className="font-bold text-[#f7c943]">{t.fare}</span></div><div className="mt-2 flex justify-between text-xs text-white/45"><span>{t.client}</span><span>{t.status}</span></div></div>)}
            </div>}

            {tab === "Clients" && <div className="space-y-3"><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#121212] px-3"><Search size={17} className="text-white/40"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a client quickly" className="w-full bg-transparent py-3 text-sm outline-none"/></div><div className="flex gap-2"><input value={newClient} onChange={e=>setNewClient(e.target.value)} placeholder="New client name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#121212] px-3 py-3 text-sm outline-none"/><button onClick={addClient} className="rounded-xl bg-[#f7c943] px-4 text-sm font-bold text-black">Add</button></div>{filteredClients.map(c=><div key={c.id} className="rounded-2xl border border-white/10 bg-[#121212] p-4"><div className="flex items-center justify-between"><b className="text-sm">{c.name}</b><span className="text-[10px] text-[#f7c943]">{c.id}</span></div><div className="mt-1 text-xs text-white/55">{c.phone} · {c.note}</div></div>)}</div>}

            {tab === "More" && <div className="grid grid-cols-2 gap-3">{[{label:"Transport",detail:"Routes and reservations",icon:CarFront},{label:"Taxes",detail:"Tax client workflow",icon:ArrowDownLeft},{label:"Opportunities",detail:"Review work requests",icon:BriefcaseBusiness},{label:"Documents",detail:"Private file workflows",icon:ArrowUpRight},{label:"Square",detail:"Payment operations",icon:Clock3},{label:"Reports",detail:"Business analysis",icon:ChevronRight}].map(item=>{const Icon=item.icon;return <button key={item.label} onClick={()=>setNotice(`${item.label} workspace remains part of the full desktop preview; this Go prototype focuses on quick field operations.`)} className="rounded-2xl border border-white/10 bg-[#121212] p-4 text-left"><Icon size={20} className="text-[#f7c943]"/><b className="mt-3 block text-sm">{item.label}</b><span className="mt-1 block text-[11px] text-white/45">{item.detail}</span></button>})}</div>}
          </section>

          <aside className="hidden space-y-4 lg:block">
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-5"><div className="text-[10px] font-bold tracking-[.2em] text-[#f7c943]">FIELD WORKFLOW</div><h2 className="mt-2 text-lg font-bold">Capture once. Keep the whole story.</h2><p className="mt-2 text-sm leading-relaxed text-white/55">A message can become a client, a reservation and a follow-up without retyping the same details.</p><div className="mt-5 space-y-3 text-xs">{["Message received","Match or create client","Create trip / opportunity","Approve response","Keep activity in client history"].map((s,i)=><div key={s} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#f7c943] text-black font-bold">{i+1}</span><span className="text-white/75">{s}</span></div>)}</div></div>
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-5"><div className="flex items-center gap-2 text-sm font-bold"><Clock3 size={17} className="text-[#f7c943]"/> Keep it fast</div><p className="mt-2 text-xs leading-relaxed text-white/50">The phone is for the next action. Deep reports, document review, configuration and full client history stay available in the desktop workspace.</p></div>
          </aside>
        </div>

        {notice && <div role="status" className="fixed bottom-[76px] left-4 right-4 z-40 mx-auto max-w-[560px] rounded-xl border border-[#f7c943]/40 bg-[#201c0c] p-3 text-xs text-amber-100 shadow-xl">{notice}<button onClick={()=>setNotice("")} className="ml-2 font-bold text-[#f7c943]">Dismiss</button></div>}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#080808]/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur lg:static lg:mx-7 lg:mb-5 lg:rounded-2xl lg:border lg:px-4">
          <div className="mx-auto flex max-w-[700px] items-center justify-around">
            {tabs.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>{setTab(item.id);setNotice("")}} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-bold ${tab===item.id?"text-[#f7c943]":"text-white/45"}`}><Icon size={20}/>{item.label}{item.id==="Inbox"&&messages.some(m=>m.unread)&&<span className="absolute ml-8 -mt-1 h-2 w-2 rounded-full bg-rose-500"/>}</button>})}
          </div>
        </nav>
        <footer className="hidden px-7 pb-5 text-center text-[10px] text-white/30 lg:block">Interactive prototype · synthetic data · no live database, messages or payments</footer>
      </div>
    </main>
  )
}
