"use client"

import { useMemo, useState } from "react"
import { CarFront, Clock3, MapPin, Plus, Route, ShieldCheck, Wallet, X } from "lucide-react"

type TripStatus = "Requested" | "Confirmed" | "In progress" | "Completed" | "Needs review"
type Trip = { id: string; client: string; route: string; pickup: string; vehicle: string; time: string; fare: number; tolls: number; expenses: number; status: TripStatus }

const initialTrips: Trip[] = [
  { id: "TR-3408", client: "Sample client A", route: "JFK → Midtown Manhattan", pickup: "JFK Terminal 4", vehicle: "Luxury SUV", time: "Today · 8:30 AM", fare: 95, tolls: 12.50, expenses: 8, status: "Completed" },
  { id: "TR-3407", client: "Sample client B", route: "Long Island City → LGA", pickup: "Queens Plaza", vehicle: "SUV", time: "Today · 7:10 AM", fare: 68, tolls: 0, expenses: 5, status: "Completed" },
  { id: "TR-3406", client: "Sample client C", route: "Manhattan → Newark Airport", pickup: "Midtown West", vehicle: "Luxury SUV", time: "Today · 4:45 PM", fare: 145, tolls: 18, expenses: 10, status: "Confirmed" },
]

const statusStyles: Record<TripStatus, string> = {
  Requested: "bg-blue-50 text-blue-700",
  Confirmed: "bg-amber-50 text-amber-800",
  "In progress": "bg-violet-50 text-violet-700",
  Completed: "bg-emerald-50 text-emerald-700",
  "Needs review": "bg-rose-50 text-rose-700",
}

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" })

export function TransportWorkspace() {
  const [trips, setTrips] = useState(initialTrips)
  const [statusFilter, setStatusFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [route, setRoute] = useState("")
  const [client, setClient] = useState("")
  const [pickup, setPickup] = useState("")
  const [vehicle, setVehicle] = useState("Luxury SUV")
  const [time, setTime] = useState("")
  const [fare, setFare] = useState("")
  const [tolls, setTolls] = useState("0")
  const [expenses, setExpenses] = useState("0")
  const [notice, setNotice] = useState("")

  const totals = useMemo(() => trips.reduce((acc, trip) => {
    acc.fare += trip.fare
    acc.cost += trip.tolls + trip.expenses
    return acc
  }, { fare: 0, cost: 0 }), [trips])

  const visibleTrips = trips.filter(trip =>
    (statusFilter === "All" || trip.status === statusFilter) &&
    (trip.route + " " + trip.client + " " + trip.id).toLowerCase().includes(search.toLowerCase())
  )

  function addTrip() {
    if (!route.trim() || !client.trim() || !fare || Number(fare) < 0) return
    const next: Trip = {
      id: `TR-${3409 + trips.length}`, client: client.trim(), route: route.trim(),
      pickup: pickup.trim() || "Not specified", vehicle, time: time || "Time pending",
      fare: Number(fare), tolls: Number(tolls) || 0, expenses: Number(expenses) || 0, status: "Requested",
    }
    setTrips(current => [next, ...current])
    setShowForm(false); setRoute(""); setClient(""); setPickup(""); setTime(""); setFare(""); setTolls("0"); setExpenses("0")
    setNotice("Sample trip added locally. No client or driver was contacted.")
  }

  function changeStatus(id: string, status: TripStatus) {
    setTrips(current => current.map(trip => trip.id === id ? { ...trip, status } : trip))
    setNotice(`${id} updated in this preview only. No dispatch or notification was sent.`)
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-amber-700"><CarFront size={14}/> ISLAND CITY TRANSIT</div><h2 className="mt-2 text-xl font-semibold">Transport operations</h2><p className="mt-1 text-xs text-slate-500">Trip intake, dispatch status and trip economics · demonstration workspace</p></div>
      <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white"><Plus size={15}/> New trip request</button>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900"><strong>Preview only:</strong> records are held in this browser session. No live CRM, dispatch, GPS, toll provider, driver, customer, payment or messaging connection is active. Use synthetic information only.</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:"Trip records",value:String(trips.length),note:"Sample requests and trips",icon:Route},{label:"Recorded fares",value:money(totals.fare),note:"Illustrative gross amounts",icon:Wallet},{label:"Tolls + expenses",value:money(totals.cost),note:"Manually entered sample costs",icon:MapPin},{label:"Estimated net",value:money(totals.fare-totals.cost),note:"Before other fees and taxes",icon:ShieldCheck}].map(item=>{const Icon=item.icon;return <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs text-slate-500"><span>{item.label}</span><Icon size={16}/></div><div className="mt-3 text-2xl font-semibold tracking-tight">{item.value}</div><div className="mt-1 text-[10px] text-slate-400">{item.note}</div></div>})}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,.7fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Trip board</h3><p className="mt-1 text-xs text-slate-500">Track requests through completion</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600">LOCAL DEMO</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px]"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trip, client or ID" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-amber-400"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option>All</option>{(["Requested","Confirmed","In progress","Completed","Needs review"] as TripStatus[]).map(status=><option key={status}>{status}</option>)}</select></div>
        <div className="mt-4 space-y-3">{visibleTrips.map(trip=><article key={trip.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-bold tracking-wide text-slate-400">{trip.id} · {trip.client}</div><div className="mt-1 text-sm font-semibold">{trip.route}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 size={12}/>{trip.time}</span><span className="inline-flex items-center gap-1"><MapPin size={12}/>{trip.pickup}</span><span>{trip.vehicle}</span></div></div><div className="text-right"><div className="text-sm font-semibold">{money(trip.fare)}</div><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[trip.status]}`}>{trip.status}</span></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="text-[10px] text-slate-500">Tolls {money(trip.tolls)} · Other expenses {money(trip.expenses)} · Est. net <strong className="text-slate-800">{money(trip.fare-trip.tolls-trip.expenses)}</strong></div><select aria-label={`Update status for ${trip.id}`} value={trip.status} onChange={e=>changeStatus(trip.id,e.target.value as TripStatus)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold"><option>Requested</option><option>Confirmed</option><option>In progress</option><option>Completed</option><option>Needs review</option></select></div></article>)}{visibleTrips.length===0&&<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400">No trips match this filter.</div>}</div>
      </section>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Operating workflow</h3><p className="mt-1 text-xs text-slate-500">Target sequence for the live module</p><ol className="mt-4 space-y-3">{[{n:"01",title:"Receive request",desc:"Capture client, route, date, pickup and service requirements."},{n:"02",title:"Validate availability",desc:"Check vehicle fit, driver availability and schedule conflicts."},{n:"03",title:"Confirm manually",desc:"Human approval before confirming a reservation or dispatch."},{n:"04",title:"Track the trip",desc:"Record status, actual mileage, tolls, expenses and exceptions."},{n:"05",title:"Close and reconcile",desc:"Compare quoted and actual amounts; preserve an audit trail."}].map(step=><li key={step.n} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">{step.n}</span><div><div className="text-xs font-semibold">{step.title}</div><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{step.desc}</p></div></li>)}</ol></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">Required live integrations</h3><div className="mt-3 space-y-2 text-[11px]">{["CRM reservations and client records","Driver / vehicle availability","Maps and route distance","Toll capture and manual corrections","Approved customer notifications","Trip closeout and financial reconciliation"].map(item=><div key={item} className="flex items-start gap-2 text-slate-600"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"/>{item}</div>)}</div><div className="mt-4 rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600">These are implementation requirements, not active connections. Each integration needs its own authorization, access controls and test evidence.</div></section>
      </aside>
    </div>
    {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-800">{notice}<button onClick={()=>setNotice("")} className="ml-3 font-bold underline">Dismiss</button></div>}
    {showForm&&<div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"><div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">New trip request</h3><p className="mt-1 text-[10px] text-slate-500">Synthetic data · saved only in this preview session</p></div><button onClick={()=>setShowForm(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100"><X size={17}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">Route<input value={route} onChange={e=>setRoute(e.target.value)} placeholder="Pickup → destination" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Sample client<input value={client} onChange={e=>setClient(e.target.value)} placeholder="Sample client name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Pickup location<input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Pickup address or terminal" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Vehicle type<select value={vehicle} onChange={e=>setVehicle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"><option>Luxury SUV</option><option>SUV</option><option>Sedan</option><option>Van</option><option>Wheelchair accessible</option><option>Other / review</option></select></label><label className="text-[11px] font-semibold text-slate-600">Requested date / time<input value={time} onChange={e=>setTime(e.target.value)} placeholder="Date and local time" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Quoted fare ($)<input type="number" min="0" value={fare} onChange={e=>setFare(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Estimated tolls ($)<input type="number" min="0" value={tolls} onChange={e=>setTolls(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label><label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">Other estimated expenses ($)<input type="number" min="0" value={expenses} onChange={e=>setExpenses(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal"/></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold">Cancel</button><button onClick={addTrip} disabled={!route.trim()||!client.trim()||!fare||Number(fare)<0} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Save sample request</button></div></div></div>}
  </div>
}
