"use client"

import { useEffect, useMemo, useState } from "react"
import { CRMNotifications } from "./crm-notifications"
import { Search, Plus, Users, Phone, Mail, CalendarDays, MessageSquare, MoreHorizontal, X, Save, Trash2, UserRound, Clock3, Filter } from "lucide-react"

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
        <button onClick={startNew} className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-3 py-3 text-sm font-extrabold text-black active:scale-[0.98]">
          <Plus className="size-4" /> Add client
        </button>
      </header>

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
      <p className="text-center text-[10px] text-neutral-600">CRM data is currently saved on this device. Cloud sync will be enabled after CRM database access is authorized.</p>
    </section>
  )
}
