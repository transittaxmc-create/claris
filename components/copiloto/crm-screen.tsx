"use client"

import { useEffect, useMemo, useState } from "react"
import { CRMNotifications } from "./crm-notifications"
import { Search, Plus, Users, Phone, Mail, CalendarDays, MessageSquare, MoreHorizontal, X, Save, Trash2, UserRound, Clock3, Filter, MapPin, Plane, ExternalLink, Pencil, ArrowUpRight } from "lucide-react"

type ClientStatus = "Lead" | "Active" | "Follow-up" | "Inactive"
type Client = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  status: ClientStatus
  source: string
  notes: string
  nextContact: string
  createdAt: string
}

const STORE = "claris_crm_clients_v1"
const emptyClient = (): Client => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
  name: "", company: "", phone: "", email: "", status: "Lead", source: "Referral", notes: "", nextContact: "", createdAt: new Date().toISOString(),
})

const inputClass = "w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-[16px] text-white placeholder:text-neutral-500 outline-none focus:border-yellow-400"
const labelClass = "mb-1.5 block text-xs font-semibold text-neutral-400"

export function CRMScreen() {
  const [clients, setClients] = useState<Client[]>([])
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"All" | ClientStatus>("All")
  const [editing, setEditing] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"clients" | "reservations">("clients")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) setClients(parsed)
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(STORE, JSON.stringify(clients)) } catch {}
  }, [clients, ready])

  // Local reminder: existing client follow-up dates only. It runs when CRM is opened
  // and permission has already been granted; it is not a background scheduler.
  useEffect(() => {
    if (!ready || !clients.length || !("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const due = clients.filter((client) => client.nextContact && client.nextContact <= today && client.status !== "Inactive")
    if (!due.length) return
    const key = "claris_crm_followup_notice_v1"
    try {
      if (localStorage.getItem(key) === today) return
    } catch {}
    navigator.serviceWorker.ready.then(async (registration) => {
      await registration.showNotification("CRM follow-ups due", {
        body: due.length === 1 ? "You have 1 client follow-up due today or overdue." : `You have ${due.length} client follow-ups due today or overdue.`,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: `crm-followups-${today}`,
        data: { url: "/" },
      })
      try { localStorage.setItem(key, today) } catch {}
    }).catch(() => {})
  }, [clients, ready])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      const matches = !q || [c.name, c.company, c.phone, c.email].some((v) => v.toLowerCase().includes(q))
      return matches && (filter === "All" || c.status === filter)
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [clients, query, filter])

  const counts = useMemo(() => ({
    all: clients.length,
    leads: clients.filter((c) => c.status === "Lead").length,
    active: clients.filter((c) => c.status === "Active").length,
    follow: clients.filter((c) => c.status === "Follow-up").length,
  }), [clients])

  const current = clients.find((c) => c.id === selected) ?? null

  function saveClient() {
    if (!editing || !editing.name.trim()) return
    setClients((prev) => prev.some((c) => c.id === editing.id)
      ? prev.map((c) => c.id === editing.id ? editing : c)
      : [editing, ...prev])
    setSelected(editing.id)
    setShowForm(false)
    setEditing(null)
  }

  function startNew() {
    setEditing(emptyClient())
    setShowForm(true)
  }

  function startEdit(client: Client) {
    setEditing({ ...client })
    setShowForm(true)
  }

  function removeClient(id: string) {
    if (!window.confirm("Delete this client and their CRM notes?")) return
    setClients((prev) => prev.filter((c) => c.id !== id))
    setSelected(null)
  }

  const statusStyle = (status: ClientStatus) => status === "Active"
    ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
    : status === "Follow-up"
      ? "border-amber-700/60 bg-amber-950/50 text-amber-300"
      : status === "Inactive"
        ? "border-neutral-700 bg-neutral-900 text-neutral-400"
        : "border-sky-800/60 bg-sky-950/50 text-sky-300"

  if (!ready) return <div className="p-6 text-sm text-neutral-500">Loading CRM…</div>

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-28 pt-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">Client relationship management</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">CRM</h1>
          <p className="mt-1 text-sm text-neutral-400">Keep every client, conversation and next step organized.</p>
          <CRMNotifications />
        </div>
        {activeTab === "clients" && <button onClick={startNew} className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-3 py-3 text-sm font-extrabold text-black active:scale-[0.98]">
          <Plus className="size-4" /> Add client
        </button>}
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        <button onClick={() => { setActiveTab("clients"); setSelected(null); setShowForm(false); setEditing(null) }} className={"rounded-lg px-3 py-2.5 text-sm font-bold " + (activeTab === "clients" ? "bg-yellow-400 text-black" : "text-neutral-400")}>Clients</button>
        <button onClick={() => { setActiveTab("reservations"); setSelected(null); setShowForm(false); setEditing(null) }} className={"rounded-lg px-3 py-2.5 text-sm font-bold " + (activeTab === "reservations" ? "bg-yellow-400 text-black" : "text-neutral-400")}>Reservations</button>
      </div>

      {activeTab === "clients" ? (
      <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total clients", value: counts.all, icon: Users },
          { label: "New leads", value: counts.leads, icon: UserRound },
          { label: "Follow-ups", value: counts.follow, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
            <Icon className="mb-2 size-4 text-yellow-400" />
            <p className="text-2xl font-black tabular-nums text-white">{value}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3">
        <Search className="size-4 shrink-0 text-neutral-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email…" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-white outline-none placeholder:text-neutral-500" />
        {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X className="size-4 text-neutral-400" /></button>}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="size-4 shrink-0 text-neutral-500" />
        {(["All", "Lead", "Active", "Follow-up", "Inactive"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={"shrink-0 rounded-full border px-3 py-2 text-xs font-bold " + (filter === s ? "border-yellow-400 bg-yellow-400 text-black" : "border-neutral-700 bg-neutral-900 text-neutral-300")}>
            {s}{s === "All" ? ` · ${counts.all}` : ""}
          </button>
        ))}
      </div>

      {current && !showForm && (
        <div className="rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={"inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusStyle(current.status)}>{current.status}</span>
              <h2 className="mt-2 text-xl font-extrabold text-white">{current.name}</h2>
              {current.company && <p className="text-sm text-neutral-400">{current.company}</p>}
            </div>
            <button onClick={() => setSelected(null)} aria-label="Close details" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {current.phone && <a href={`tel:${current.phone}`} className="flex items-center justify-center gap-2 rounded-xl bg-neutral-800 px-3 py-3 text-sm font-bold text-white"><Phone className="size-4 text-yellow-400" /> Call</a>}
            {current.email && <a href={`mailto:${current.email}`} className="flex items-center justify-center gap-2 rounded-xl bg-neutral-800 px-3 py-3 text-sm font-bold text-white"><Mail className="size-4 text-yellow-400" /> Email</a>}
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {current.phone && <p className="text-neutral-300">{current.phone}</p>}
            {current.email && <p className="break-all text-neutral-300">{current.email}</p>}
            <p className="text-neutral-400">Source: <span className="text-neutral-200">{current.source || "—"}</span></p>
            {current.nextContact && <p className="flex items-center gap-2 text-amber-300"><CalendarDays className="size-4" /> Next contact: {current.nextContact}</p>}
            {current.notes && <div className="rounded-xl bg-neutral-950 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Notes / history</p><p className="whitespace-pre-wrap text-neutral-200">{current.notes}</p></div>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => startEdit(current)} className="flex-1 rounded-xl border border-neutral-700 py-3 text-sm font-bold text-white">Edit client</button>
            <button onClick={() => removeClient(current.id)} className="rounded-xl border border-rose-900/70 px-4 py-3 text-rose-300"><Trash2 className="size-4" /></button>
          </div>
        </div>
      )}

      {showForm && editing && (
        <div className="rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white">{clients.some((c) => c.id === editing.id) ? "Edit client" : "New client"}</h2>
            <button onClick={() => { setShowForm(false); setEditing(null) }} aria-label="Close form" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button>
          </div>
          <div className="space-y-3">
            <div><label className={labelClass}>Full name *</label><input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputClass} placeholder="Client name" /></div>
            <div><label className={labelClass}>Company / business</label><input value={editing.company} onChange={(e) => setEditing({ ...editing, company: e.target.value })} className={inputClass} placeholder="Company (optional)" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={labelClass}>Phone</label><input type="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={inputClass} placeholder="Phone number" /></div>
              <div><label className={labelClass}>Email</label><input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={inputClass} placeholder="Email address" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={labelClass}>Status</label><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ClientStatus })} className={inputClass}>{(["Lead", "Active", "Follow-up", "Inactive"] as const).map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className={labelClass}>How did they find you?</label><select value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} className={inputClass}>{["Referral", "Website", "Social media", "Returning client", "Walk-in", "Other"].map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label className={labelClass}>Next follow-up</label><input type="date" value={editing.nextContact} onChange={(e) => setEditing({ ...editing, nextContact: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Notes / interaction history</label><textarea rows={4} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={inputClass + " resize-y"} placeholder="Last conversation, service requested, preferences, next step…" /></div>
          </div>
          <button disabled={!editing.name.trim()} onClick={saveClient} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"><Save className="size-4" /> Save client</button>
        </div>
      )}

      {!showForm && (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-white">Client list</h2><span className="text-xs text-neutral-500">{visible.length} shown</span></div>
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-700 px-5 py-10 text-center">
              <Users className="mx-auto mb-3 size-8 text-neutral-600" />
              <p className="font-bold text-white">{clients.length ? "No matching clients" : "Your CRM starts here"}</p>
              <p className="mt-1 text-sm text-neutral-500">{clients.length ? "Try another search or filter." : "Add your first client to start tracking conversations and follow-ups."}</p>
              {!clients.length && <button onClick={startNew} className="mt-4 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-extrabold text-black"><Plus className="mr-1 inline size-4" /> Add first client</button>}
            </div>
          ) : visible.map((client) => (
            <button key={client.id} onClick={() => setSelected(client.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors " + (selected === client.id ? "border-yellow-500/50 bg-yellow-400/5" : "border-neutral-800 bg-neutral-900/70")}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-black text-yellow-400">{client.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{client.name}</span>
                <span className="block truncate text-xs text-neutral-400">{client.company || client.phone || client.email || "No contact details yet"}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={"rounded-full border px-2 py-1 text-[10px] font-bold " + statusStyle(client.status)}>{client.status}</span>
                {client.nextContact && <span className="text-[10px] text-neutral-500">{client.nextContact}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-neutral-600">Client records are currently saved on this device. CRM cloud sync is not connected.</p>
      </>
      ) : (
        <CRMReservations clients={clients.map(({ id, name, phone, email }) => ({ id, name, phone, email }))} />
      )}
    </section>
  )
}

type CRMClientOption = { id: string; name: string; phone: string; email: string }
type FlightLookup = {
  reservationId: string
  status: "not_found" | "stale" | "on_ground" | "in_air" | "unknown"
  callsign?: string
  flight?: string
  registration?: string | null
  aircraftType?: string | null
  latitude?: number | null
  longitude?: number | null
  altitudeFeet?: number | null
  groundSpeedKnots?: number | null
  heading?: number | null
  lastPositionSeconds?: number | null
  lastSignalSeconds?: number | null
  checkedAt?: string
}
const CRM_AIRPORTS = [
  { code: "JFK", label: "JFK — John F. Kennedy International, NY" },
  { code: "LGA", label: "LGA — LaGuardia, NY" },
  { code: "EWR", label: "EWR — Newark Liberty, NJ" },
  { code: "ISP", label: "ISP — Long Island MacArthur, NY" },
  { code: "BDL", label: "BDL — Bradley International, CT" },
  { code: "HVN", label: "HVN — Tweed New Haven, CT" },
  { code: "HPN", label: "HPN — Westchester County, NY (nearby)" },
]
type ReservationStatus = "Requested" | "Confirmed" | "Completed" | "Cancelled"
type PickupKind = "standard" | "airport"
type CRMReservation = {
  id: string
  clientId: string
  passengerName: string
  passengerPhone: string
  serviceDate: string
  pickupTime: string
  passengers: number
  status: ReservationStatus
  pickupKind: PickupKind
  pickupAddress: string
  dropoffAddress: string
  airport: string
  airline: string
  flightNumber: string
  flightDate: string
  scheduledArrival: string
  terminal: string
  gate: string
  notes: string
  createdAt: string
  updatedAt: string
}

const RESERVATIONS_STORE = "claris_crm_reservations_v1"
const reservationInput = "w-full min-w-0 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-[16px] text-white outline-none placeholder:text-neutral-500 focus:border-yellow-400"
const reservationLabel = "mb-1.5 block text-xs font-semibold text-neutral-400"
const newReservation = (): CRMReservation => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `res-${Date.now()}`,
  clientId: "", passengerName: "", passengerPhone: "",
  serviceDate: new Date().toLocaleDateString("en-CA"), pickupTime: "",
  passengers: 1, status: "Requested", pickupKind: "standard",
  pickupAddress: "", dropoffAddress: "", airport: "", airline: "",
  flightNumber: "", flightDate: "", scheduledArrival: "", terminal: "",
  gate: "", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})
const appleMapsLink = (address: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
const googleMapsLink = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
const flightAwareLink = (flightNumber: string) => `https://www.flightaware.com/live/flight/${encodeURIComponent(flightNumber.trim().replace(/\s+/g, ""))}`

function AddressNavigation({ label, address }: { label: string; address: string }) {
  if (!address.trim()) return null
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
        <MapPin className="size-4 shrink-0 text-yellow-400" />
      </div>
      <p className="mt-1 break-words text-sm leading-relaxed text-white">{address}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={appleMapsLink(address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-2 text-[11px] font-bold text-neutral-200"><ArrowUpRight className="size-3.5" /> Apple Maps</a>
        <a href={googleMapsLink(address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-2 text-[11px] font-bold text-neutral-200"><ArrowUpRight className="size-3.5" /> Google Maps</a>
      </div>
    </div>
  )
}

function CRMReservations({ clients }: { clients: CRMClientOption[] }) {
  const [reservations, setReservations] = useState<CRMReservation[]>([])
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState<CRMReservation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [flightLookup, setFlightLookup] = useState<FlightLookup | null>(null)
  const [flightLoading, setFlightLoading] = useState(false)
  const [flightError, setFlightError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESERVATIONS_STORE)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) setReservations(parsed)
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(RESERVATIONS_STORE, JSON.stringify(reservations)) } catch {}
  }, [reservations, ready])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return reservations.filter((r) => [r.passengerName, r.passengerPhone, r.pickupAddress, r.dropoffAddress, r.flightNumber, r.airport].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (b.serviceDate + b.pickupTime).localeCompare(a.serviceDate + a.pickupTime))
  }, [reservations, query])
  const current = reservations.find((r) => r.id === selectedId) ?? null

  function beginNew() {
    setEditing(newReservation())
    setShowForm(true)
    setSelectedId(null)
  }
  function beginEdit(r: CRMReservation) {
    setEditing({ ...r })
    setShowForm(true)
  }
  function saveReservation() {
    if (!editing || !editing.passengerName.trim() || !editing.serviceDate || !editing.pickupAddress.trim() || !editing.dropoffAddress.trim()) return
    if (editing.pickupKind === "airport" && (!editing.flightNumber.trim() || !editing.airport.trim() || !editing.flightDate)) return
    const stamp = new Date().toISOString()
    const saved = { ...editing, updatedAt: stamp, passengers: Math.max(1, Number(editing.passengers) || 1) }
    setReservations((prev) => prev.some((r) => r.id === saved.id) ? prev.map((r) => r.id === saved.id ? saved : r) : [saved, ...prev])
    setSelectedId(saved.id)
    setShowForm(false)
    setEditing(null)
  }
  function removeReservation(id: string) {
    if (!window.confirm("Delete this reservation?")) return
    setReservations((prev) => prev.filter((r) => r.id !== id))
    setSelectedId(null)
  }
  async function trackFlight(reservation: CRMReservation) {
    setFlightLoading(true)
    setFlightError(null)
    setFlightLookup(null)
    try {
      const response = await fetch("/api/crm/flights/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airline: reservation.airline, flightNumber: reservation.flightNumber }),
      })
      const data = await response.json()
      if (!response.ok) {
        setFlightError(typeof data.message === "string" ? data.message : "Could not check this flight. Verify the airline and flight number.")
        return
      }
      setFlightLookup({ ...data, reservationId: reservation.id } as FlightLookup)
    } catch {
      setFlightError("Could not reach the live flight service. Try again later.")
    } finally {
      setFlightLoading(false)
    }
  }

  function patch<K extends keyof CRMReservation>(key: K, value: CRMReservation[K]) {
    setEditing((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  if (!ready) return <div className="py-8 text-center text-sm text-neutral-500">Loading reservations…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div><h2 className="text-lg font-extrabold text-white">Reservations</h2><p className="text-xs text-neutral-500">Pickup, drop-off and airport details</p></div>
        <button onClick={beginNew} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-3 py-3 text-sm font-extrabold text-black"><Plus className="size-4" /> Add reservation</button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3">
        <Search className="size-4 text-neutral-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search passenger, address or flight…" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-white outline-none placeholder:text-neutral-500" />
      </div>

      {showForm && editing && (
        <div className="rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-extrabold text-white">{reservations.some((r) => r.id === editing.id) ? "Edit reservation" : "New reservation"}</h3><button onClick={() => { setShowForm(false); setEditing(null) }} aria-label="Close reservation form" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button></div>
          <div className="space-y-3">
            <div><label className={reservationLabel}>Existing client (optional)</label><select value={editing.clientId} onChange={(e) => { const client = clients.find((c) => c.id === e.target.value); setEditing((prev) => prev ? { ...prev, clientId: e.target.value, passengerName: client?.name ?? prev.passengerName, passengerPhone: client?.phone ?? prev.passengerPhone } : prev) }} className={reservationInput}><option value="">Choose a CRM client or enter passenger below</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={reservationLabel}>Passenger name *</label><input value={editing.passengerName} onChange={(e) => patch("passengerName", e.target.value)} className={reservationInput} placeholder="Passenger full name" /></div>
              <div><label className={reservationLabel}>Passenger phone</label><input type="tel" value={editing.passengerPhone} onChange={(e) => patch("passengerPhone", e.target.value)} className={reservationInput} placeholder="Phone number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={reservationLabel}>Service date *</label><input type="date" value={editing.serviceDate} onChange={(e) => patch("serviceDate", e.target.value)} className={reservationInput} /></div>
              <div><label className={reservationLabel}>Pickup time</label><input type="time" value={editing.pickupTime} onChange={(e) => patch("pickupTime", e.target.value)} className={reservationInput} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={reservationLabel}>Passengers</label><input type="number" min="1" max="20" value={editing.passengers} onChange={(e) => patch("passengers", Number(e.target.value))} className={reservationInput} /></div>
              <div><label className={reservationLabel}>Reservation status</label><select value={editing.status} onChange={(e) => patch("status", e.target.value as ReservationStatus)} className={reservationInput}>{(["Requested", "Confirmed", "Completed", "Cancelled"] as const).map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label className={reservationLabel}>Pickup type</label><select value={editing.pickupKind} onChange={(e) => patch("pickupKind", e.target.value as PickupKind)} className={reservationInput}><option value="standard">Regular pickup</option><option value="airport">Airport pickup (flight required)</option></select></div>
            <div><label className={reservationLabel}>Pickup address *</label><input value={editing.pickupAddress} onChange={(e) => patch("pickupAddress", e.target.value)} className={reservationInput} placeholder="Original pickup address" /></div>
            <div><label className={reservationLabel}>Drop-off address *</label><input value={editing.dropoffAddress} onChange={(e) => patch("dropoffAddress", e.target.value)} className={reservationInput} placeholder="Destination address" /></div>

            {editing.pickupKind === "airport" && (
              <div className="space-y-3 rounded-xl border border-sky-900/70 bg-sky-950/20 p-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-sky-200"><Plane className="size-4" /> Airport flight information</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={reservationLabel}>Airport *</label>
                    <select value={CRM_AIRPORTS.some((a) => a.code === editing.airport) ? editing.airport : editing.airport ? "__other__" : ""} onChange={(e) => patch("airport", e.target.value === "__other__" ? "" : e.target.value)} className={reservationInput}>
                      <option value="">Select airport</option>
                      {CRM_AIRPORTS.map((airport) => <option key={airport.code} value={airport.code}>{airport.label}</option>)}
                      <option value="__other__">Other airport / enter manually</option>
                    </select>
                    {!CRM_AIRPORTS.some((a) => a.code === editing.airport) && <input value={editing.airport} onChange={(e) => patch("airport", e.target.value.toUpperCase())} className={reservationInput + " mt-2"} placeholder="Enter airport name or code" />}
                  </div>
                  <div><label className={reservationLabel}>Airline</label><input value={editing.airline} onChange={(e) => patch("airline", e.target.value)} className={reservationInput} placeholder="Airline name" /></div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={reservationLabel}>Flight number *</label><input value={editing.flightNumber} onChange={(e) => patch("flightNumber", e.target.value.toUpperCase())} className={reservationInput} placeholder="AA 123" autoCapitalize="characters" /></div>
                  <div><label className={reservationLabel}>Flight date *</label><input type="date" value={editing.flightDate} onChange={(e) => patch("flightDate", e.target.value)} className={reservationInput} /></div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={reservationLabel}>Scheduled arrival time</label><input type="time" value={editing.scheduledArrival} onChange={(e) => patch("scheduledArrival", e.target.value)} className={reservationInput} /></div>
                  <div><label className={reservationLabel}>Terminal (optional)</label><input value={editing.terminal} onChange={(e) => patch("terminal", e.target.value)} className={reservationInput} placeholder="Terminal" /></div>
                </div>
                <div><label className={reservationLabel}>Gate (optional)</label><input value={editing.gate} onChange={(e) => patch("gate", e.target.value)} className={reservationInput} placeholder="Gate" /></div>
                <p className="text-[11px] leading-relaxed text-sky-100/70">Regular pickups do not ask for flight details. Live tracking is checked only when you tap the button; no automatic polling or paid API is enabled.</p>
              </div>
            )}
            <div><label className={reservationLabel}>Reservation notes</label><textarea rows={3} value={editing.notes} onChange={(e) => patch("notes", e.target.value)} className={reservationInput + " resize-y"} placeholder="Special instructions, luggage, meeting point…" /></div>
          </div>
          <button disabled={!editing.passengerName.trim() || !editing.serviceDate || !editing.pickupAddress.trim() || !editing.dropoffAddress.trim() || (editing.pickupKind === "airport" && (!editing.flightNumber.trim() || !editing.airport.trim() || !editing.flightDate))} onClick={saveReservation} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"><Save className="size-4" /> Save reservation</button>
        </div>
      )}

      {current && !showForm && (
        <div className="space-y-3 rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><span className="rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-yellow-300">{current.status}</span><h3 className="mt-2 text-xl font-extrabold text-white">{current.passengerName}</h3><p className="mt-1 text-xs text-neutral-400">{current.serviceDate}{current.pickupTime ? " · " + current.pickupTime : ""} · {current.passengers} passenger(s)</p>{current.passengerPhone && <a href={`tel:${current.passengerPhone}`} className="mt-1 inline-block text-sm text-neutral-300">{current.passengerPhone}</a>}</div>
            <button onClick={() => setSelectedId(null)} aria-label="Close reservation details" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button>
          </div>
          <AddressNavigation label="Pickup" address={current.pickupAddress} />
          <AddressNavigation label="Drop-off" address={current.dropoffAddress} />
          {current.pickupKind === "airport" && (
            <div className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-sky-200"><Plane className="size-4" /> Airport pickup</div>
              <p className="mt-2 text-sm text-white">{current.airline ? current.airline + " · " : ""}{current.flightNumber}</p>
              <p className="mt-1 text-xs text-neutral-300">{current.airport} · {current.flightDate}{current.scheduledArrival ? " · Arrival " + current.scheduledArrival : ""}</p>
              {(current.terminal || current.gate) && <p className="mt-1 text-xs text-neutral-400">{[current.terminal && "Terminal " + current.terminal, current.gate && "Gate " + current.gate].filter(Boolean).join(" · ")}</p>}
              <button disabled={flightLoading} onClick={() => trackFlight(current)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-200 px-3 py-2.5 text-xs font-extrabold text-sky-950 disabled:opacity-50"><Plane className="size-4" /> {flightLoading ? "Checking live aircraft…" : "Track Flight — Live ADS-B"}</button>
              {flightError && <p role="alert" className="mt-2 rounded-lg border border-rose-900/70 bg-rose-950/30 p-2 text-xs text-rose-200">{flightError}</p>}
              {flightLookup?.reservationId === current.id && (
                <div className="mt-3 rounded-xl border border-sky-800/70 bg-neutral-950/80 p-3">
                  {flightLookup.status === "in_air" && <p className="text-sm font-extrabold text-emerald-300">Aircraft detected in flight</p>}
                  {flightLookup.status === "on_ground" && <p className="text-sm font-extrabold text-amber-300">Aircraft signal detected on the ground</p>}
                  {flightLookup.status === "stale" && <p className="text-sm font-extrabold text-amber-300">Last aircraft position is not recent</p>}
                  {flightLookup.status === "unknown" && <p className="text-sm font-extrabold text-neutral-200">Aircraft detected; live altitude status unavailable</p>}
                  {flightLookup.status === "not_found" && <p className="text-sm font-extrabold text-neutral-200">No live ADS-B signal found for this callsign</p>}
                  {flightLookup.callsign && <p className="mt-1 text-xs text-neutral-300">ICAO callsign: {flightLookup.callsign}</p>}
                  {flightLookup.status !== "not_found" && (
                    <>
                      <p className="mt-1 text-xs text-neutral-300">{[flightLookup.registration, flightLookup.aircraftType].filter(Boolean).join(" · ") || "Aircraft identity not provided"}</p>
                      {flightLookup.latitude != null && flightLookup.longitude != null && <a href={`https://www.google.com/maps?q=${flightLookup.latitude},${flightLookup.longitude}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-300"><MapPin className="size-3.5" /> View last aircraft position</a>}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-300">
                        {flightLookup.altitudeFeet != null && <span>Altitude: {flightLookup.altitudeFeet.toLocaleString()} ft</span>}
                        {flightLookup.groundSpeedKnots != null && <span>Speed: {flightLookup.groundSpeedKnots} kt</span>}
                        {flightLookup.heading != null && <span>Heading: {flightLookup.heading}°</span>}
                        {flightLookup.lastPositionSeconds != null && <span>Position age: {Math.round(flightLookup.lastPositionSeconds)} sec</span>}
                      </div>
                    </>
                  )}
                  {flightLookup.status === "not_found" && <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">This does not mean the flight is cancelled. It may not have departed, may be outside receiver coverage, or the airline/callsign may differ.</p>}
                  {flightLookup.status === "on_ground" && <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">Ground signal is not proof that the aircraft has landed or that passengers can be collected.</p>}
                  <p className="mt-2 text-[10px] text-neutral-500">Source: <a href="https://www.adsb.lol/" target="_blank" rel="noreferrer" className="underline">ADSB.lol</a> · ODbL 1.0 · checked {flightLookup.checkedAt ? new Date(flightLookup.checkedAt).toLocaleTimeString() : "just now"}</p>
                </div>
              )}
              <a href={flightAwareLink(current.flightNumber)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-300"><ExternalLink className="size-3.5" /> Open FlightAware as backup</a>
              <p className="mt-2 text-[10px] leading-relaxed text-sky-100/70">ADSB.lol provides live aircraft transponder positions, not airline schedule confirmation. It cannot confirm delays, cancellations, gate changes or a passenger's readiness. Check the airline/airport for operational decisions.</p>
            </div>
          )}
          {current.notes && <div className="rounded-xl bg-neutral-950 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Notes</p><p className="whitespace-pre-wrap text-sm text-neutral-200">{current.notes}</p></div>}
          <div className="flex gap-2"><button onClick={() => beginEdit(current)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-700 py-3 text-sm font-bold text-white"><Pencil className="size-4" /> Edit reservation</button><button onClick={() => removeReservation(current.id)} className="rounded-xl border border-rose-900/70 px-4 py-3 text-rose-300"><Trash2 className="size-4" /></button></div>
        </div>
      )}

      {!showForm && (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-white">Reservation list</h3><span className="text-xs text-neutral-500">{visible.length} shown</span></div>
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-700 px-5 py-10 text-center"><CalendarDays className="mx-auto mb-3 size-8 text-neutral-600" /><p className="font-bold text-white">{reservations.length ? "No matching reservations" : "No reservations yet"}</p><p className="mt-1 text-sm text-neutral-500">Create a reservation to keep pickup, drop-off and flight details together.</p>{!reservations.length && <button onClick={beginNew} className="mt-4 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-extrabold text-black"><Plus className="mr-1 inline size-4" /> Add reservation</button>}</div>
          ) : visible.map((r) => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selectedId === r.id ? "border-yellow-500/50 bg-yellow-400/5" : "border-neutral-800 bg-neutral-900/70")}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-yellow-400">{r.pickupKind === "airport" ? <Plane className="size-5" /> : <MapPin className="size-5" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{r.passengerName}</span><span className="block truncate text-xs text-neutral-400">{r.serviceDate}{r.pickupTime ? " · " + r.pickupTime : ""} · {r.pickupKind === "airport" ? "Airport · " + r.flightNumber : "Regular pickup"}</span><span className="mt-1 block truncate text-[11px] text-neutral-500">{r.pickupAddress} → {r.dropoffAddress}</span></span>
              <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-1 text-[9px] font-bold text-neutral-300">{r.status}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-neutral-600">Reservations are saved on this device only. Cloud backup/sync is not connected yet.</p>
    </div>
  )
}

