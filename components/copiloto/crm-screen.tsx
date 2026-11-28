"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CRMNotifications } from "./crm-notifications"
import { crmSupabaseBrowser, crmCloudConfigured } from "@/lib/crm/supabase-browser"
import { nextAccountNumber, type CrmPhoto } from "@/lib/crm/crm-cloud"
import { parseMessageForReservation } from "@/lib/crm/parse-message"
import { verifyAddress } from "@/lib/crm/geocode"
import { getLocalPhotoDataUrl, saveLocalPhotoDataUrl, deleteLocalPhoto, fileToDownscaledDataUrl, uploadPhotoToCloud, signedPhotoUrl, deleteCloudPhoto } from "@/lib/crm/crm-photos"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { Search, Plus, Users, Phone, Mail, CalendarDays, MessageSquare, MoreHorizontal, X, Save, Trash2, UserRound, Clock3, Filter, MapPin, Plane, ExternalLink, Pencil, ArrowUpRight, Camera, BellRing, Inbox, CheckCheck, Hash, History, Undo2, Flag } from "lucide-react"

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
  accountNumber: string
  photos: CrmPhoto[]
  createdAt: string
}

const STORE = "claris_crm_clients_v1"
const SYNCED_CLIENTS_KEY = "claris_crm_synced_clients_v1"
const SYNCED_RESERVATIONS_KEY = "claris_crm_synced_reservations_v1"
const SYNCED_MESSAGES_KEY = "claris_crm_synced_messages_v1"

/** Ids que ESTE dispositivo ya confirmó en la nube, por tipo de récord,
 *  persistidos entre sesiones. Es la memoria que distingue "récord nuevo
 *  de este teléfono" de "récord borrado en otro lado": sin ella la sync
 *  era una unión y todo lo borrado resucitaba. */
function readSyncedIds(key: string): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]")
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [])
  } catch { return new Set() }
}
function writeSyncedIds(key: string, ids: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...ids])) } catch {}
}
const emptyClient = (): Client => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
  name: "", company: "", phone: "", email: "", status: "Lead", source: "Referral", notes: "", nextContact: "", accountNumber: "", photos: [], createdAt: new Date().toISOString(),
})

/** Normaliza un cliente venga de donde venga (local viejo, nube pre/post
 *  migración): campos nuevos con valores por defecto, sin romper nada. */
function normalizeClient(raw: Partial<Client> & { id: string }): Client {
  return {
    ...emptyClient(),
    ...raw,
    accountNumber: typeof raw.accountNumber === "string" ? raw.accountNumber : "",
    photos: Array.isArray(raw.photos) ? raw.photos : [],
  }
}

type PhotoCloud = { sb: SupabaseClient; userId: string } | null

/**
 * Bloque de fotos de un récord (cliente o reserva): las fotos que manda el
 * cliente de su recogida o de su vuelo. Se guardan en el dispositivo y, con
 * sesión, suben al bucket privado del CRM; los metadatos viajan en el
 * récord (columna photos). Sin sesión funciona local, como todo el CRM.
 */
function CrmPhotosBlock({ photos, onChange, kind, recordId, cloud }: { photos: CrmPhoto[]; onChange: (next: CrmPhoto[]) => void; kind: "clients" | "reservations"; recordId: string; cloud: PhotoCloud }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadTried = useRef<Set<string>>(new Set())

  // Resolver URLs: primero la copia local; si no hay y la foto está en la
  // nube, URL firmada temporal.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const p of photos) {
        const local = getLocalPhotoDataUrl(p.id)
        if (local) { next[p.id] = local; continue }
        if (p.path && cloud) {
          const signed = await signedPhotoUrl(cloud.sb, p.path)
          if (signed) next[p.id] = signed
        }
      }
      if (!cancelled) setUrls(next)
    })()
    return () => { cancelled = true }
  }, [photos, cloud])

  // Fotos que quedaron solo-locales (sin sesión al añadirlas) suben solas
  // en cuanto hay sesión: la foto viaja con el récord.
  useEffect(() => {
    if (!cloud) return
    for (const p of photos) {
      if (p.path || uploadTried.current.has(p.id)) continue
      const local = getLocalPhotoDataUrl(p.id)
      if (!local) continue
      uploadTried.current.add(p.id)
      uploadPhotoToCloud(cloud.sb, cloud.userId, kind, recordId, p.id, local).then((path) => {
        if (path) onChange(photos.map((x) => (x.id === p.id ? { ...x, path } : x)))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, cloud, kind, recordId])

  async function addPhoto(file: File) {
    setBusy(true)
    try {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `photo-${Date.now()}`
      const dataUrl = await fileToDownscaledDataUrl(file)
      saveLocalPhotoDataUrl(id, dataUrl)
      let path = ""
      if (cloud) path = (await uploadPhotoToCloud(cloud.sb, cloud.userId, kind, recordId, id, dataUrl)) || ""
      onChange([...photos, { id, path, caption: "", createdAt: new Date().toISOString() }])
    } catch {}
    setBusy(false)
  }

  function removePhoto(photo: CrmPhoto) {
    if (!window.confirm("Remove this photo from the record?")) return
    deleteLocalPhoto(photo.id)
    if (cloud && photo.path) void deleteCloudPhoto(cloud.sb, photo.path)
    onChange(photos.filter((p) => p.id !== photo.id))
  }

  return (
    <div className="rounded-xl bg-neutral-950 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Client photos · pickup / flight</p>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-2 text-[11px] font-bold text-neutral-200 disabled:opacity-40"><Camera className="size-3.5" /> {busy ? "Adding…" : "Add photo"}</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPhoto(f) }} />
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-neutral-500">No photos yet. Save here the photo the client sends of their pickup or their flight ticket — it stays with this record.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-neutral-800">
              {urls[p.id] ? (
                <a href={urls[p.id]} target="_blank" rel="noreferrer"><img src={urls[p.id]} alt={p.caption || "Client photo"} className="aspect-square w-full object-cover" /></a>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-neutral-900 text-[10px] text-neutral-500">Photo{p.path ? " in cloud" : " on device"}</div>
              )}
              <button onClick={() => removePhoto(p)} aria-label="Remove photo" className="absolute right-1 top-1 rounded-md bg-black/70 p-1.5 text-rose-300"><Trash2 className="size-3.5" /></button>
              {!p.path && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Device only</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputClass = "w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-[16px] text-white placeholder:text-neutral-500 outline-none focus:border-yellow-400"
const labelClass = "mb-1.5 block text-xs font-semibold text-neutral-400"

/**
 * Panel de cuenta del CRM cloud (Paso 2 — Auth del manual). La sesión es
 * SOLO del CRM (su Supabase exclusivo); no cambia nada del resto de la
 * app ni del módulo financiero. Sin sesión, el CRM sigue funcionando en
 * local como siempre.
 */
function CrmCloudPanel({ session, status }: { session: Session | null; status: "off" | "loading" | "synced" | "error" }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  if (!crmCloudConfigured()) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <p className="text-xs font-bold text-neutral-300">CRM CLOUD</p>
        <p className="mt-1 text-xs text-neutral-500">Cloud sync is not configured in this build. Records stay on this device.</p>
      </div>
    )
  }

  const sb = () => crmSupabaseBrowser()

  const signIn = async () => {
    const client = sb()
    if (!client || busy) return
    setBusy(true); setMessage("")
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    setMessage(error ? "Could not sign in. Check the email and password." : "")
  }
  const signUp = async () => {
    const client = sb()
    if (!client || busy) return
    setBusy(true); setMessage("")
    const { data, error } = await client.auth.signUp({ email: email.trim(), password })
    setBusy(false)
    if (error) setMessage("Could not create the account. Try a stronger password or sign in if it already exists.")
    else if (!data.session) setMessage("Account created. Confirm it from the email we sent you, then sign in.")
    else setMessage("")
  }
  const reset = async () => {
    const client = sb()
    if (!client || busy || !email.trim()) { setMessage("Type your email first, then tap Forgot password."); return }
    setBusy(true); setMessage("")
    const { error } = await client.auth.resetPasswordForEmail(email.trim())
    setBusy(false)
    setMessage(error ? "Could not send the reset email." : "Password reset email sent. Follow its link, then sign in here.")
  }
  const signOut = async () => {
    const client = sb()
    if (!client || busy) return
    setBusy(true)
    await client.auth.signOut()
    setBusy(false)
  }

  if (session) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-neutral-300">CRM CLOUD · {session.user.email || "Signed in"}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {status === "synced" ? "Synced. Clients and reservations also live in the CRM cloud, separate from finance." : status === "loading" ? "Syncing…" : status === "error" ? "Sync problem — your records are safe on this device." : "Connected."}
          </p>
        </div>
        <button onClick={signOut} disabled={busy} className="shrink-0 rounded-xl border border-neutral-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Sign out</button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
      <p className="text-xs font-bold text-neutral-300">CRM CLOUD</p>
      <p className="mt-1 text-[11px] text-neutral-500">Sign in to sync clients and reservations across your phones. They live in the CRM's own cloud, separate from finance.</p>
      <div className="mt-2 space-y-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={inputClass} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className={inputClass} />
      </div>
      {message && <p className="mt-2 text-[11px] font-bold text-yellow-300">{message}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={signIn} disabled={busy || !email.trim() || !password} className="flex-1 rounded-xl bg-yellow-400 py-3 text-sm font-extrabold text-black disabled:opacity-40">Sign in</button>
        <button onClick={signUp} disabled={busy || !email.trim() || !password} className="flex-1 rounded-xl border border-neutral-700 py-3 text-sm font-bold text-white disabled:opacity-40">Create account</button>
      </div>
      <button onClick={reset} disabled={busy} className="mt-2 text-[11px] font-bold text-neutral-400 underline disabled:opacity-40">Forgot password</button>
    </div>
  )
}

export function CRMScreen({ openMessagesNonce = 0 }: { openMessagesNonce?: number }) {
  const [clients, setClients] = useState<Client[]>([])
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"All" | ClientStatus>("All")
  const [editing, setEditing] = useState<Client | null>(null)
  const [accountError, setAccountError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"clients" | "reservations" | "messages">("clients")

  // El bombillito MESSAGE de TODAY (Miguel, 2026-11-26) abre el CRM
  // directo en la bandeja de mensajes: cada toque sube el nonce.
  useEffect(() => {
    if (openMessagesNonce > 0) setActiveTab("messages")
  }, [openMessagesNonce])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE)
      const parsed = raw ? JSON.parse(raw) : []
      // Una cuenta por cliente: todo récord sin número recibe el suyo al
      // cargar (orden de creación), y jamás se crea un segundo récord para
      // el mismo cliente — las reservas nuevas se suman a su historial.
      if (Array.isArray(parsed)) setClients(parsed.map((c) => normalizeClient(c as Client)))
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(STORE, JSON.stringify(clients)) } catch {}
  }, [clients, ready])

  // ---- CRM cloud: sesión y sincronización con el Supabase exclusivo del CRM ----
  const [session, setSession] = useState<Session | null>(null)
  const [cloudStatus, setCloudStatus] = useState<"off" | "loading" | "synced" | "error">("off")
  const [cloudSeedReservations, setCloudSeedReservations] = useState<CRMReservation[] | null>(null)
  const [cloudSeedNonce, setCloudSeedNonce] = useState(0)
  const [cloudSeedMessages, setCloudSeedMessages] = useState<CRMMessage[] | null>(null)
  const [cloudSeedMessagesNonce, setCloudSeedMessagesNonce] = useState(0)
  const [messagesCloudPending, setMessagesCloudPending] = useState(false)
  // Vistas de solo lectura para el aviso de hoy, los recordatorios y el
  // historial del cliente: las reservas/mensajes los posee cada pestaña y
  // los reporta hacia arriba cuando cambian.
  const [reservationsPeek, setReservationsPeek] = useState<CRMReservation[]>([])
  const [messagesPeek, setMessagesPeek] = useState<CRMMessage[]>([])
  const [reservationPrefill, setReservationPrefill] = useState<Partial<CRMReservation> | null>(null)
  const [reservationPrefillNonce, setReservationPrefillNonce] = useState(0)
  const pendingMessageLink = useRef<string | null>(null)
  const cloudClientIds = useRef<Set<string>>(new Set())
  const cloudSynced = useRef(false)
  const applyingCloud = useRef(false)

  useEffect(() => {
    const sb = crmSupabaseBrowser()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        cloudSynced.current = false
        cloudClientIds.current = new Set()
        // OJO: el conjunto sincronizado persistido NO se limpia al cerrar
        // sesión — es memoria del dispositivo, no de la sesión. El evento
        // inicial de auth llega con sesión nula al abrir la pantalla
        // (antes de entrar), y limpiarlo ahí borraría la memoria de
        // borrados justo cuando hace falta (verificado en harness).
        setCloudSeedReservations(null)
        setCloudSeedMessages(null)
        setMessagesCloudPending(false)
        setCloudStatus("off")
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const cloudPost = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/crm/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    if (!r.ok) throw new Error("crm_sync_failed")
    return r.json()
  }, [])

  // Carga inicial con sesión: la nube manda en los ids que tenga; lo local
  // NUNCA sincronizado se SUBE (migración idempotente con los mismos ids).
  // Lo ya sincronizado que la nube ya no tiene se cae de la copia local y
  // NO se vuelve a subir: fue borrado en otro lado y el borrado manda.
  useEffect(() => {
    if (!session || !ready || cloudSynced.current) return
    cloudSynced.current = true
    setCloudStatus("loading")
    ;(async () => {
      try {
        const r = await fetch("/api/crm/state", { cache: "no-store" })
        if (!r.ok) throw new Error("crm_read_failed")
        const data = await r.json()
        const cloudClients = ((data.clients || []) as unknown as Client[]).map((c) => normalizeClient(c))
        const cloudIds = new Set(cloudClients.map((c) => c.id))
        const localIds = new Set(clients.map((c) => c.id))
        const syncedBefore = readSyncedIds(SYNCED_CLIENTS_KEY)
        // Borrado en ESTE teléfono: sincronizado antes, ya no está local y
        // la nube aún lo tiene → sale de la fusión y se borra en la nube.
        const deletedHere = [...syncedBefore].filter((id) => !localIds.has(id) && cloudIds.has(id))
        // Borrado en otro lado: sincronizado antes, sigue local, la nube ya
        // no lo tiene → se cae de la copia local y NO se vuelve a subir.
        // Solo sube lo que NUNCA se sincronizó (migración inicial).
        const localOnly = clients.filter((c) => !cloudIds.has(c.id) && !syncedBefore.has(c.id))
        const keptCloud = cloudClients.filter((c) => !deletedHere.includes(c.id))
        const merged = [...keptCloud, ...localOnly].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        applyingCloud.current = true
        setClients(merged)
        if (localOnly.length || deletedHere.length) {
          const res = await cloudPost({ upsertClients: localOnly, deleteClientIds: deletedHere })
          if (typeof res?.counts?.clients === "number" && res.counts.clients < merged.length) throw new Error("crm_count_mismatch")
        }
        cloudClientIds.current = new Set(merged.map((c) => c.id))
        writeSyncedIds(SYNCED_CLIENTS_KEY, cloudClientIds.current)
        setCloudSeedReservations((data.reservations || []) as unknown as CRMReservation[])
        setCloudSeedNonce((n) => n + 1)
        setCloudSeedMessages((data.messages || []) as unknown as CRMMessage[])
        setCloudSeedMessagesNonce((n) => n + 1)
        setMessagesCloudPending(!!data.messagesPending)
        setCloudStatus("synced")
      } catch {
        setCloudStatus("error")
      } finally {
        applyingCloud.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ready])

  // Escritura continua de clientes: cada cambio local se refleja en la nube
  // (upsert del conjunto + borrados desde la última sync confirmada).
  useEffect(() => {
    if (!ready || !session || cloudStatus !== "synced" || applyingCloud.current) return
    const t = setTimeout(async () => {
      const currentIds = new Set(clients.map((c) => c.id))
      const deleted = [...cloudClientIds.current].filter((id) => !currentIds.has(id))
      try {
        await cloudPost({ upsertClients: clients, deleteClientIds: deleted })
        cloudClientIds.current = currentIds
        writeSyncedIds(SYNCED_CLIENTS_KEY, currentIds)
      } catch {
        setCloudStatus("error")
      }
    }, 800)
    return () => clearTimeout(t)
  }, [clients, ready, session, cloudStatus, cloudPost])

  const pushReservationsToCloud = useCallback(
    async (items: CRMReservation[], deletedIds: string[]): Promise<boolean> => {
      if (!session) return false
      try {
        await cloudPost({ upsertReservations: items, deleteReservationIds: deletedIds })
        return true
      } catch {
        setCloudStatus("error")
        return false
      }
    },
    [session, cloudPost],
  )

  const pushMessagesToCloud = useCallback(
    async (items: CRMMessage[], deletedIds: string[]): Promise<boolean> => {
      if (!session) return false
      try {
        const res = await cloudPost({ upsertMessages: items, deleteMessageIds: deletedIds })
        // La tabla de mensajes llega con la migración 20261126120000: si el
        // proyecto aún no la tiene, la bandeja sigue local y se avisa ahí,
        // sin marcar error en el resto de la sync (fase 1 intacta).
        setMessagesCloudPending(!!res?.messagesPending)
        return true
      } catch {
        setCloudStatus("error")
        return false
      }
    },
    [session, cloudPost],
  )

  // Vistas iniciales desde el dispositivo (la nube las pisa al conectar):
  // alimentan el aviso de hoy y el historial sin abrir cada pestaña.
  useEffect(() => {
    try {
      const rawR = localStorage.getItem("claris_crm_reservations_v1")
      const parsedR = rawR ? JSON.parse(rawR) : []
      if (Array.isArray(parsedR)) setReservationsPeek(parsedR as CRMReservation[])
      const rawM = localStorage.getItem("claris_crm_messages_v1")
      const parsedM = rawM ? JSON.parse(rawM) : []
      if (Array.isArray(parsedM)) setMessagesPeek(parsedM as CRMMessage[])
    } catch {}
  }, [])

  const photoCloud: PhotoCloud = useMemo(() => {
    if (!session) return null
    const sb = crmSupabaseBrowser()
    return sb ? { sb, userId: session.user.id } : null
  }, [session])

  /** EL MOMENTO DE ACEPTAR (regla de Miguel, 2026-11-26): crear la ficha
   *  de una persona nueva desde su mensaje en la bandeja ES aceptarla —
   *  ahí nace su número de cuenta ACT-0-###, antes de que exista reserva.
   *  Hasta ese momento la persona no tiene número. Un cliente por
   *  teléfono: si ya existe, se devuelve el existente tal como está —
   *  nunca un segundo archivo y jamás se reescribe su número. */
  const findOrCreateClient = useCallback((name: string, phone: string): Client => {
    const digits = (phone || "").replace(/\D/g, "")
    const existing = clients.find((c) => digits && c.phone.replace(/\D/g, "") === digits)
    if (existing) return existing
    const created: Client = {
      ...emptyClient(),
      name: name.trim() || "New client",
      phone: phone || "",
      status: "Active",
      source: "Other",
      accountNumber: nextAccountNumber(clients),
    }
    setClients((prev) => [created, ...prev])
    return created
  }, [clients])

  /** Cuando una reserva nacida de un mensaje se guarda, el mensaje queda
   *  enlazado a esa entrada (su historial crece en el mismo archivo). */
  const handleReservationSaved = useCallback((r: CRMReservation) => {
    setReservationsPeek((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev]))
    const messageId = pendingMessageLink.current
    if (messageId) {
      pendingMessageLink.current = null
      setMessagesPeek((prev) => prev.map((m) => (m.id === messageId ? { ...m, reservationId: r.id, clientId: m.clientId || r.clientId } : m)))
      // La pestaña de mensajes posee su almacén: el enlace también se
      // persiste en su clave local para que no se pierda al recargar.
      try {
        const raw = localStorage.getItem("claris_crm_messages_v1")
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) {
          localStorage.setItem("claris_crm_messages_v1", JSON.stringify(parsed.map((m: CRMMessage) => (m.id === messageId ? { ...m, reservationId: r.id, clientId: m.clientId || r.clientId } : m))))
        }
      } catch {}
    }
  }, [])

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
      const matches = !q || [c.name, c.company, c.phone, c.email, c.accountNumber].some((v) => v.toLowerCase().includes(q))
      return matches && (filter === "All" || c.status === filter)
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [clients, query, filter])

  // ---- Fase 5: reservas de hoy, vencidas sin completar y recordatorios ----
  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), [])
  const openReservations = useMemo(
    () => reservationsPeek.filter((r) => r.status === "Requested" || r.status === "Confirmed"),
    [reservationsPeek],
  )
  const todayReservations = useMemo(
    () => openReservations.filter((r) => r.serviceDate === todayStr).sort((a, b) => (a.pickupTime || "").localeCompare(b.pickupTime || "")),
    [openReservations, todayStr],
  )
  const overdueReservations = useMemo(
    () => openReservations.filter((r) => r.serviceDate < todayStr).sort((a, b) => (b.serviceDate + b.pickupTime).localeCompare(a.serviceDate + a.pickupTime)),
    [openReservations, todayStr],
  )
  const dueReminders = useMemo(() => {
    const out: { reservation: CRMReservation; kind: "day-before" | "two-hours"; label: string }[] = []
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toLocaleDateString("en-CA")
    for (const r of openReservations) {
      if (r.serviceDate === tomorrow) {
        out.push({ reservation: r, kind: "day-before", label: `Tomorrow · ${r.pickupTime || "time TBD"}` })
      }
      if (r.serviceDate === todayStr && r.pickupTime) {
        const [h, m] = r.pickupTime.split(":").map((x) => parseInt(x, 10) || 0)
        const pickup = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
        const diffMs = pickup.getTime() - now.getTime()
        if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
          out.push({ reservation: r, kind: "two-hours", label: `In under 2 hours · ${r.pickupTime}` })
        }
      }
    }
    return out
  }, [openReservations, todayStr])

  // Aviso local de recordatorios al abrir el CRM (mismo patrón que el de
  // follow-ups: una vez por recordatorio; no es un programador en segundo
  // plano — el push remoto sigue bloqueado por el almacén en Blob, §manual).
  useEffect(() => {
    if (!ready || !dueReminders.length || !("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return
    const KEY = "claris_crm_reminder_notices_v1"
    let seen: string[] = []
    try { seen = JSON.parse(localStorage.getItem(KEY) || "[]") } catch {}
    const fresh = dueReminders.filter((d) => !seen.includes(`${d.reservation.id}|${d.kind}|${d.reservation.serviceDate}`))
    if (!fresh.length) return
    navigator.serviceWorker.ready.then(async (registration) => {
      for (const d of fresh.slice(0, 3)) {
        await registration.showNotification(d.kind === "day-before" ? "CRM reminder — pickup tomorrow" : "CRM reminder — pickup in under 2 hours", {
          body: `${d.reservation.passengerName} · ${d.reservation.serviceDate}${d.reservation.pickupTime ? " " + d.reservation.pickupTime : ""} · ${d.reservation.pickupAddress} → ${d.reservation.dropoffAddress}`,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: `crm-reminder-${d.reservation.id}-${d.kind}`,
          data: { url: "/" },
        })
      }
      try { localStorage.setItem(KEY, JSON.stringify([...seen, ...fresh.map((d) => `${d.reservation.id}|${d.kind}|${d.reservation.serviceDate}`)])) } catch {}
    }).catch(() => {})
  }, [dueReminders, ready])

  const pendingMessagesCount = useMemo(() => messagesPeek.filter((m) => m.status === "pending").length, [messagesPeek])

  const counts = useMemo(() => ({
    all: clients.length,
    leads: clients.filter((c) => c.status === "Lead").length,
    active: clients.filter((c) => c.status === "Active").length,
    follow: clients.filter((c) => c.status === "Follow-up").length,
  }), [clients])

  const current = clients.find((c) => c.id === selected) ?? null

  function saveClient() {
    if (!editing || !editing.name.trim()) return
    const isNew = !clients.some((c) => c.id === editing.id)
    const typed = editing.accountNumber.trim()
    // Guarda anti-duplicados: un número que ya usa OTRO cliente no se
    // guarda — se avisa en el formulario y la ficha queda abierta.
    if (typed) {
      const clash = clients.find((c) => c.id !== editing.id && (c.accountNumber || "").trim().toLowerCase() === typed.toLowerCase())
      if (clash) {
        setAccountError(`Account ${typed} is already used by ${clash.name}. Pick a different number — one account per client.`)
        return
      }
    }
    // Ficha NUEVA creada a mano → recibe el siguiente ACT-0-### al
    // guardarla (misma regla que al aceptar un mensaje), salvo que
    // Miguel haya escrito su propio número. Ficha existente → se guarda
    // tal como quedó el campo editable: su número no se toca solo.
    const withAccount = !typed && isNew
      ? { ...editing, accountNumber: nextAccountNumber(clients) }
      : { ...editing, accountNumber: typed }
    setClients((prev) => prev.some((c) => c.id === withAccount.id)
      ? prev.map((c) => c.id === withAccount.id ? withAccount : c)
      : [withAccount, ...prev])
    setAccountError("")
    setSelected(withAccount.id)
    setShowForm(false)
    setEditing(null)
  }

  function startNew() {
    setAccountError("")
    setEditing(emptyClient())
    setShowForm(true)
  }

  function startEdit(client: Client) {
    setAccountError("")
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

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        <button onClick={() => { setActiveTab("clients"); setSelected(null); setShowForm(false); setEditing(null) }} className={"rounded-lg px-3 py-2.5 text-sm font-bold " + (activeTab === "clients" ? "bg-yellow-400 text-black" : "text-neutral-400")}>Clients</button>
        <button onClick={() => { setActiveTab("reservations"); setSelected(null); setShowForm(false); setEditing(null) }} className={"rounded-lg px-3 py-2.5 text-sm font-bold " + (activeTab === "reservations" ? "bg-yellow-400 text-black" : "text-neutral-400")}>Reservations</button>
        <button onClick={() => { setActiveTab("messages"); setSelected(null); setShowForm(false); setEditing(null) }} className={"relative rounded-lg px-3 py-2.5 text-sm font-bold " + (activeTab === "messages" ? "bg-yellow-400 text-black" : "text-neutral-400")}>
          Messages
          {pendingMessagesCount > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{pendingMessagesCount}</span>}
        </button>
      </div>

      <CrmCloudPanel session={session} status={cloudStatus} />

      {(todayReservations.length > 0 || overdueReservations.length > 0 || dueReminders.length > 0) && (
        <div className="space-y-2 rounded-2xl border border-yellow-500/30 bg-neutral-900 p-3">
          {todayReservations.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-yellow-300"><CalendarDays className="size-4" /> Reservations today · {todayReservations.length}</p>
              <div className="mt-2 space-y-1.5">
                {todayReservations.map((r) => (
                  <button key={r.id} onClick={() => { setActiveTab("reservations"); setSelected(null); setShowForm(false); setEditing(null) }} className="block w-full rounded-xl bg-neutral-950 px-3 py-2 text-left">
                    <span className="block text-sm font-bold text-white">{r.pickupTime || "Time TBD"} · {r.passengerName}</span>
                    <span className="block truncate text-xs text-neutral-400">{r.pickupAddress} → {r.dropoffAddress}{r.pickupKind === "airport" ? ` · ${r.flightNumber}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {dueReminders.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300"><BellRing className="size-4" /> Reminders for you</p>
              <div className="mt-2 space-y-1.5">
                {dueReminders.map((d) => (
                  <p key={d.reservation.id + d.kind} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs text-neutral-200"><span className="font-bold text-white">{d.reservation.passengerName}</span> · {d.label} · {d.reservation.pickupAddress} → {d.reservation.dropoffAddress}</p>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-neutral-500">Reminders are only for you — nothing is ever sent to the client. They appear here when you open the CRM; remote push reminders are still pending (see How It Works).</p>
            </div>
          )}
          {overdueReservations.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-300"><Clock3 className="size-4" /> Past reservations still open · {overdueReservations.length}</p>
              <div className="mt-2 space-y-1.5">
                {overdueReservations.map((r) => (
                  <p key={r.id} className="rounded-xl border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs text-rose-100"><span className="font-bold">{r.passengerName}</span> · {r.serviceDate}{r.pickupTime ? " " + r.pickupTime : ""} · {r.status} — mark it Completed or Cancelled so it is never lost or forgotten.</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          {/* Control REAL de estatus en la ficha (orden de Miguel, 2026-11-26):
              lo de arriba de la lista solo filtra; aquí el estatus se CAMBIA
              y el cambio se guarda y sube a la nube como todo el CRM. */}
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="crm-profile-status" className="shrink-0 text-xs font-semibold text-neutral-400">Status</label>
            <select id="crm-profile-status" value={current.status} onChange={(e) => setClients((prev) => prev.map((c) => (c.id === current.id ? { ...c, status: e.target.value as ClientStatus } : c)))} className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-yellow-400">
              {(["Lead", "Active", "Follow-up", "Inactive"] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {current.phone && <p className="text-neutral-300">{current.phone}</p>}
            {current.email && <p className="break-all text-neutral-300">{current.email}</p>}
            <p className="flex items-center gap-2 text-neutral-400"><Hash className="size-4 text-yellow-400" /> Account: <span className="font-bold text-neutral-100">{current.accountNumber || "No account number yet"}</span></p>
            <p className="text-neutral-400">Source: <span className="text-neutral-200">{current.source || "—"}</span></p>
            {current.nextContact && <p className="flex items-center gap-2 text-amber-300"><CalendarDays className="size-4" /> Next contact: {current.nextContact}</p>}
            {current.notes && <div className="rounded-xl bg-neutral-950 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Notes / history</p><p className="whitespace-pre-wrap text-neutral-200">{current.notes}</p></div>}
          </div>
          {(() => {
            const history = reservationsPeek.filter((r) => r.clientId === current.id).sort((a, b) => (b.serviceDate + b.pickupTime).localeCompare(a.serviceDate + a.pickupTime))
            const clientMessages = messagesPeek.filter((m) => m.clientId === current.id)
            const followUps = clientMessages.filter((m) => m.needsFollowUp).length
            const upcoming = history.filter((r) => r.serviceDate >= todayStr && r.status !== "Cancelled").length
            return (
              <div className="mt-4 rounded-xl bg-neutral-950 p-3">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500"><History className="size-3.5" /> History · {history.length} reservation{history.length === 1 ? "" : "s"} · {upcoming} upcoming · {clientMessages.length} message{clientMessages.length === 1 ? "" : "s"}{followUps > 0 ? ` · ${followUps} follow-up${followUps === 1 ? "" : "s"}` : ""}</p>
                {history.length === 0 ? (
                  <p className="text-xs text-neutral-500">No reservations yet for this client. New reservations linked to this account appear here — one account per client, always the same file.</p>
                ) : (
                  <div className="space-y-1.5">
                    {history.slice(0, 8).map((r) => (
                      <p key={r.id} className="rounded-lg bg-neutral-900 px-2.5 py-2 text-xs text-neutral-300"><span className="font-bold text-white">{r.serviceDate}{r.pickupTime ? " · " + r.pickupTime : ""}</span> · {r.status} · {r.pickupAddress} → {r.dropoffAddress}{r.pickupKind === "airport" ? ` · ${r.airline ? r.airline + " " : ""}${r.flightNumber}` : ""}</p>
                    ))}
                    {history.length > 8 && <p className="text-[11px] text-neutral-500">…and {history.length - 8} more in Reservations.</p>}
                  </div>
                )}
              </div>
            )
          })()}
          <div className="mt-4">
            <CrmPhotosBlock photos={current.photos} kind="clients" recordId={current.id} cloud={photoCloud} onChange={(next) => setClients((prev) => prev.map((c) => (c.id === current.id ? { ...c, photos: next } : c)))} />
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
            <button onClick={() => { setShowForm(false); setEditing(null); setAccountError("") }} aria-label="Close form" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button>
          </div>
          <div className="space-y-3">
            <div><label className={labelClass}>Account number</label><input value={editing.accountNumber} onChange={(e) => { setEditing({ ...editing, accountNumber: e.target.value }); setAccountError("") }} className={inputClass + " font-bold text-yellow-300"} placeholder={clients.some((c) => c.id === editing.id) ? "No account number yet" : nextAccountNumber(clients)} /><p className="mt-1 text-xs font-semibold text-neutral-500">{clients.some((c) => c.id === editing.id) ? "One account per client. You can correct the number here — it lives only in this profile, never in a message to the client." : `On save this client gets ${nextAccountNumber(clients)} — or type your own number instead. One account per client; it lives only in this profile, never in a message to the client.`}</p>{accountError && <p className="mt-1 text-xs font-bold text-rose-300">{accountError}</p>}</div>
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
                {client.accountNumber && <span className="text-[10px] font-bold text-yellow-400/80">{client.accountNumber}</span>}
                {client.nextContact && <span className="text-[10px] text-neutral-500">{client.nextContact}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-neutral-600">{session ? (cloudStatus === "synced" ? "Client records are synced with the CRM cloud and also kept on this device." : cloudStatus === "error" ? "CRM cloud sync hit a problem — records are safe on this device." : "Connecting to the CRM cloud…") : "Client records are currently saved on this device. Sign in above to sync them with the CRM cloud."}</p>
      </>
      ) : activeTab === "reservations" ? (
        <CRMReservations clients={clients.map(({ id, name, phone, email, accountNumber }) => ({ id, name, phone, email, accountNumber }))} cloudSeed={cloudSeedReservations} cloudSeedNonce={cloudSeedNonce} onCloudSync={session ? pushReservationsToCloud : null} onReservationsChanged={setReservationsPeek} onReservationSaved={handleReservationSaved} prefill={reservationPrefill} prefillNonce={reservationPrefillNonce} photoCloud={photoCloud} />
      ) : (
        <CRMMessages
          clients={clients}
          reservations={reservationsPeek}
          cloudSeed={cloudSeedMessages}
          cloudSeedNonce={cloudSeedMessagesNonce}
          onCloudSync={session ? pushMessagesToCloud : null}
          cloudPending={messagesCloudPending}
          onMessagesChanged={setMessagesPeek}
          findOrCreateClient={findOrCreateClient}
          onCreateReservation={(message: CRMMessage) => {
            pendingMessageLink.current = message.id
            // Auto-llenado (Miguel, 2026-11-26): el formulario se puebla
            // con lo que el mensaje trae — recogida, destino, fecha,
            // hora, pasajeros y vuelo si aplica. Él verifica y corrige.
            const parsed = parseMessageForReservation(message.body || "")
            setReservationPrefill({
              clientId: message.clientId || "",
              passengerName: message.fromName || "",
              passengerPhone: message.fromPhone || "",
              ...(parsed as Partial<CRMReservation>),
              notes: message.body || "",
            })
            setReservationPrefillNonce((n) => n + 1)
            setActiveTab("reservations")
          }}
        />
      )}
    </section>
  )
}

type CRMClientOption = { id: string; name: string; phone: string; email: string; accountNumber?: string }
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
  stopAddress: string
  dropoffAddress: string
  airport: string
  airline: string
  flightNumber: string
  flightDate: string
  scheduledArrival: string
  terminal: string
  gate: string
  notes: string
  photos: CrmPhoto[]
  createdAt: string
  updatedAt: string
}

function normalizeReservation(raw: Partial<CRMReservation> & { id: string }): CRMReservation {
  return { ...newReservation(), ...raw, photos: Array.isArray(raw.photos) ? raw.photos : [] }
}

const RESERVATIONS_STORE = "claris_crm_reservations_v1"
const reservationInput = "w-full min-w-0 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-[16px] text-white outline-none placeholder:text-neutral-500 focus:border-yellow-400"
const reservationLabel = "mb-1.5 block text-xs font-semibold text-neutral-400"
const newReservation = (): CRMReservation => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `res-${Date.now()}`,
  clientId: "", passengerName: "", passengerPhone: "",
  serviceDate: new Date().toLocaleDateString("en-CA"), pickupTime: "",
  passengers: 1, status: "Requested", pickupKind: "standard",
  pickupAddress: "", stopAddress: "", dropoffAddress: "", airport: "", airline: "",
  flightNumber: "", flightDate: "", scheduledArrival: "", terminal: "",
  gate: "", notes: "", photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})
const appleMapsLink = (address: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
const googleMapsLink = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
/** Ruta completa de la reserva: recogida → destino, y con parada
 *  registrada, recogida → parada → destino (Google Maps acepta el
 *  punto intermedio como waypoint; sin parada es A → B directo). */
const googleRouteLink = (r: CRMReservation) => {
  const base = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(r.pickupAddress)}&destination=${encodeURIComponent(r.dropoffAddress)}`
  return r.stopAddress?.trim() ? `${base}&waypoints=${encodeURIComponent(r.stopAddress)}` : base
}
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

function CRMReservations({ clients, cloudSeed, cloudSeedNonce, onCloudSync, onReservationsChanged, onReservationSaved, prefill, prefillNonce, photoCloud }: { clients: CRMClientOption[]; cloudSeed: CRMReservation[] | null; cloudSeedNonce: number; onCloudSync: ((items: CRMReservation[], deletedIds: string[]) => Promise<boolean>) | null; onReservationsChanged?: (items: CRMReservation[]) => void; onReservationSaved?: (r: CRMReservation) => void; prefill?: Partial<CRMReservation> | null; prefillNonce?: number; photoCloud?: PhotoCloud }) {
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
      if (Array.isArray(parsed)) setReservations(parsed.map((r) => normalizeReservation(r as CRMReservation)))
    } catch {}
    setReady(true)
  }, [])

  // Reporta la lista al padre (aviso de hoy, recordatorios, historial).
  useEffect(() => {
    if (ready) onReservationsChanged?.(reservations)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, ready])

  // Prefill desde la bandeja de mensajes: abre el formulario ya llenado
  // con el pasajero del mensaje; al guardar, el padre enlaza el mensaje.
  const prefillApplied = useRef(0)
  useEffect(() => {
    if (!prefill || !prefillNonce || prefillApplied.current === prefillNonce) return
    prefillApplied.current = prefillNonce
    setEditing({ ...newReservation(), ...prefill })
    setShowForm(true)
    setSelectedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, prefillNonce])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(RESERVATIONS_STORE, JSON.stringify(reservations)) } catch {}
  }, [reservations, ready])

  // ---- CRM cloud (reservas): merge de la semilla y escritura continua ----
  const seedAppliedNonce = useRef(0)
  const lastSyncedIds = useRef<Set<string>>(new Set())
  const [seedMerged, setSeedMerged] = useState(false)

  useEffect(() => {
    if (!cloudSeed || !ready || seedAppliedNonce.current === cloudSeedNonce) return
    seedAppliedNonce.current = cloudSeedNonce
    const cloudIds = new Set(cloudSeed.map((r) => r.id))
    const localIds = new Set(reservations.map((r) => r.id))
    const syncedBefore = readSyncedIds(SYNCED_RESERVATIONS_KEY)
    const deletedHere = [...syncedBefore].filter((id) => !localIds.has(id) && cloudIds.has(id))
    const localOnly = reservations.filter((r) => !cloudIds.has(r.id) && !syncedBefore.has(r.id))
    const merged = [...cloudSeed.filter((r) => !deletedHere.includes(r.id)), ...localOnly]
    setReservations(merged)
    lastSyncedIds.current = new Set(cloudIds)
    writeSyncedIds(SYNCED_RESERVATIONS_KEY, cloudIds)
    setSeedMerged(true)
    if ((localOnly.length || deletedHere.length) && onCloudSync) {
      void onCloudSync(merged, deletedHere).then((ok) => {
        if (!ok) return
        lastSyncedIds.current = new Set(merged.map((r) => r.id))
        writeSyncedIds(SYNCED_RESERVATIONS_KEY, lastSyncedIds.current)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudSeed, cloudSeedNonce, ready])

  useEffect(() => {
    if (!ready || !seedMerged || !onCloudSync) return
    const t = setTimeout(async () => {
      const currentIds = new Set(reservations.map((r) => r.id))
      const deleted = [...lastSyncedIds.current].filter((id) => !currentIds.has(id))
      const ok = await onCloudSync(reservations, deleted)
      if (!ok) return
      lastSyncedIds.current = currentIds
      writeSyncedIds(SYNCED_RESERVATIONS_KEY, currentIds)
    }, 800)
    return () => clearTimeout(t)
  }, [reservations, ready, seedMerged, onCloudSync])

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
    if (!editing || !editing.passengerName.trim() || !editing.serviceDate || !editing.pickupTime || !editing.pickupAddress.trim() || !editing.dropoffAddress.trim()) return
    if (editing.pickupKind === "airport" && (!editing.flightNumber.trim() || !editing.airport.trim() || !editing.flightDate)) return
    const stamp = new Date().toISOString()
    const saved = { ...editing, updatedAt: stamp, passengers: Math.max(1, Number(editing.passengers) || 1) }
    setReservations((prev) => prev.some((r) => r.id === saved.id) ? prev.map((r) => r.id === saved.id ? saved : r) : [saved, ...prev])
    setSelectedId(saved.id)
    setShowForm(false)
    setEditing(null)
    onReservationSaved?.(saved)
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

  // ---- Paquete del formulario (Miguel, 2026-11-26): indicadores de
  // requeridos, verificación de direcciones y parada opcional ----
  type AddrField = "pickupAddress" | "dropoffAddress" | "stopAddress"
  type AddrCheck = { state: "idle" | "checking" | "ok" | "warn"; message: string }
  const [addrChecks, setAddrChecks] = useState<Partial<Record<AddrField, AddrCheck>>>({})
  const addrCheckedFor = useRef<Partial<Record<AddrField, string>>>({})

  const checkAddress = useCallback(async (field: AddrField, value: string) => {
    const v = (value || "").trim()
    if (v.length < 6) {
      addrCheckedFor.current[field] = ""
      setAddrChecks((p) => ({ ...p, [field]: { state: "idle", message: "" } }))
      return
    }
    if (addrCheckedFor.current[field] === v) return
    addrCheckedFor.current[field] = v
    setAddrChecks((p) => ({ ...p, [field]: { state: "checking", message: "" } }))
    const res = await verifyAddress(v)
    if (addrCheckedFor.current[field] !== v) return // el texto cambió mientras se comprobaba
    if (!res) {
      // No se pudo comprobar (red/servicio): no se marca nada.
      setAddrChecks((p) => ({ ...p, [field]: { state: "idle", message: "" } }))
      return
    }
    if (res.state === "ok") {
      setAddrChecks((p) => ({ ...p, [field]: { state: "ok", message: res.foundCity ? `Address verified — ${res.foundCity}` : "Address verified" } }))
    } else {
      setAddrChecks((p) => ({ ...p, [field]: { state: "warn", message: res.reason } }))
    }
  }, [])

  // Al abrir el formulario (también auto-llenado desde un mensaje) y al
  // escribir, las direcciones se verifican solas, con una pausa breve
  // para no llamar al mapa por cada tecla. La verificación marca; NO
  // bloquea guardar si Miguel decide seguir.
  const editingPickup = editing?.pickupAddress
  const editingDropoff = editing?.dropoffAddress
  const editingStop = editing?.stopAddress
  useEffect(() => {
    if (!showForm) return
    const t = setTimeout(() => {
      void checkAddress("pickupAddress", editingPickup || "")
      void checkAddress("dropoffAddress", editingDropoff || "")
      void checkAddress("stopAddress", editingStop || "")
    }, 900)
    return () => clearTimeout(t)
  }, [showForm, editingPickup, editingDropoff, editingStop, checkAddress])

  /** Lenguaje visual de los campos: requerido vacío = borde ámbar
   *  discreto; requerido lleno = verde suave; dirección verificada =
   *  verde; dirección que no combina = rojo suave. Sin tocar el resto
   *  del diseño negro mate. */
  const fieldClass = (opts: { required?: boolean; filled: boolean; check?: AddrCheck }) => {
    let border = "border-neutral-700"
    if (opts.check?.state === "warn") border = "border-rose-500/80"
    else if (opts.check?.state === "ok") border = "border-emerald-500/70"
    else if (opts.required && !opts.filled) border = "border-amber-500/70"
    else if (opts.required && opts.filled) border = "border-emerald-600/60"
    return reservationInput.replace("border-neutral-700", border)
  }
  const addrStatusLine = (check?: AddrCheck) => {
    if (!check || check.state === "idle") return null
    if (check.state === "checking") return <p className="mt-1.5 text-[11px] font-semibold text-neutral-500">Checking the address on the map…</p>
    if (check.state === "ok") return <p className="mt-1.5 text-[11px] font-semibold text-emerald-400">{check.message}</p>
    return <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-rose-300">{check.message} You can still save if you decide to go with it.</p>
  }

  // Todos los requeridos, de una vez: el botón de guardar solo se
  // activa cuando la lista queda vacía — nada de descubrir un campo
  // faltante por intento (la hora fue el caso real de Miguel).
  const missingFields: string[] = []
  if (editing) {
    if (!editing.passengerName.trim()) missingFields.push("Passenger name")
    if (!editing.serviceDate) missingFields.push("Service date")
    if (!editing.pickupTime) missingFields.push("Pickup time")
    if (!editing.pickupAddress.trim()) missingFields.push("Pickup address")
    if (!editing.dropoffAddress.trim()) missingFields.push("Drop-off address")
    if (editing.pickupKind === "airport") {
      if (!editing.airport.trim()) missingFields.push("Airport")
      if (!editing.flightNumber.trim()) missingFields.push("Flight number")
      if (!editing.flightDate) missingFields.push("Flight date")
    }
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
            <div><label className={reservationLabel}>Existing client (optional)</label><select value={editing.clientId} onChange={(e) => { const client = clients.find((c) => c.id === e.target.value); setEditing((prev) => prev ? { ...prev, clientId: e.target.value, passengerName: client?.name ?? prev.passengerName, passengerPhone: client?.phone ?? prev.passengerPhone } : prev) }} className={reservationInput}><option value="">Choose a CRM client or enter passenger below</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.accountNumber ? ` · ${client.accountNumber}` : ""}</option>)}</select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={reservationLabel}>Passenger name *</label><input value={editing.passengerName} onChange={(e) => patch("passengerName", e.target.value)} className={fieldClass({ required: true, filled: !!editing.passengerName.trim() })} placeholder="Passenger full name" /></div>
              <div><label className={reservationLabel}>Passenger phone</label><input type="tel" value={editing.passengerPhone} onChange={(e) => patch("passengerPhone", e.target.value)} className={reservationInput} placeholder="Phone number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={reservationLabel}>Service date *</label><input type="date" value={editing.serviceDate} onChange={(e) => patch("serviceDate", e.target.value)} className={fieldClass({ required: true, filled: !!editing.serviceDate })} /></div>
              <div><label className={reservationLabel}>Pickup time *</label><input type="time" value={editing.pickupTime} onChange={(e) => patch("pickupTime", e.target.value)} className={fieldClass({ required: true, filled: !!editing.pickupTime })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={reservationLabel}>Passengers</label><input type="number" min="1" max="20" value={editing.passengers} onChange={(e) => patch("passengers", Number(e.target.value))} className={reservationInput} /></div>
              <div><label className={reservationLabel}>Reservation status</label><select value={editing.status} onChange={(e) => patch("status", e.target.value as ReservationStatus)} className={reservationInput}>{(["Requested", "Confirmed", "Completed", "Cancelled"] as const).map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label className={reservationLabel}>Pickup type</label><select value={editing.pickupKind} onChange={(e) => patch("pickupKind", e.target.value as PickupKind)} className={reservationInput}><option value="standard">Regular pickup</option><option value="airport">Airport pickup (flight required)</option></select></div>
            <div><label className={reservationLabel}>Pickup address *</label><input value={editing.pickupAddress} onChange={(e) => patch("pickupAddress", e.target.value)} className={fieldClass({ required: true, filled: !!editing.pickupAddress.trim(), check: addrChecks.pickupAddress })} placeholder="Original pickup address" />{addrStatusLine(addrChecks.pickupAddress)}</div>
            <div><label className={reservationLabel}>Stop on the way (optional)</label><input value={editing.stopAddress} onChange={(e) => patch("stopAddress", e.target.value)} className={fieldClass({ filled: !!editing.stopAddress.trim(), check: addrChecks.stopAddress })} placeholder="Only if the client asked for a stop — it joins the GPS route" />{addrStatusLine(addrChecks.stopAddress)}</div>
            <div><label className={reservationLabel}>Drop-off address *</label><input value={editing.dropoffAddress} onChange={(e) => patch("dropoffAddress", e.target.value)} className={fieldClass({ required: true, filled: !!editing.dropoffAddress.trim(), check: addrChecks.dropoffAddress })} placeholder="Destination address" />{addrStatusLine(addrChecks.dropoffAddress)}</div>

            {editing.pickupKind === "airport" && (
              <div className="space-y-3 rounded-xl border border-sky-900/70 bg-sky-950/20 p-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-sky-200"><Plane className="size-4" /> Airport flight information</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={reservationLabel}>Airport *</label>
                    <select value={CRM_AIRPORTS.some((a) => a.code === editing.airport) ? editing.airport : editing.airport ? "__other__" : ""} onChange={(e) => patch("airport", e.target.value === "__other__" ? "" : e.target.value)} className={fieldClass({ required: true, filled: !!editing.airport.trim() })}>
                      <option value="">Select airport</option>
                      {CRM_AIRPORTS.map((airport) => <option key={airport.code} value={airport.code}>{airport.label}</option>)}
                      <option value="__other__">Other airport / enter manually</option>
                    </select>
                    {!CRM_AIRPORTS.some((a) => a.code === editing.airport) && <input value={editing.airport} onChange={(e) => patch("airport", e.target.value.toUpperCase())} className={fieldClass({ required: true, filled: !!editing.airport.trim() }) + " mt-2"} placeholder="Enter airport name or code" />}
                  </div>
                  <div><label className={reservationLabel}>Airline</label><input value={editing.airline} onChange={(e) => patch("airline", e.target.value)} className={reservationInput} placeholder="Airline name" /></div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={reservationLabel}>Flight number *</label><input value={editing.flightNumber} onChange={(e) => patch("flightNumber", e.target.value.toUpperCase())} className={fieldClass({ required: true, filled: !!editing.flightNumber.trim() })} placeholder="AA 123" autoCapitalize="characters" /></div>
                  <div><label className={reservationLabel}>Flight date *</label><input type="date" value={editing.flightDate} onChange={(e) => patch("flightDate", e.target.value)} className={fieldClass({ required: true, filled: !!editing.flightDate })} /></div>
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
          {missingFields.length > 0 && <p className="mt-4 text-[11px] font-semibold leading-relaxed text-amber-300">Still missing: {missingFields.join(" · ")} — Save activates when every required field is filled.</p>}
          <button disabled={missingFields.length > 0} onClick={saveReservation} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"><Save className="size-4" /> Save reservation</button>
        </div>
      )}

      {current && !showForm && (
        <div className="space-y-3 rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><span className="rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-yellow-300">{current.status}</span><h3 className="mt-2 text-xl font-extrabold text-white">{current.passengerName}</h3><p className="mt-1 text-xs text-neutral-400">{current.serviceDate}{current.pickupTime ? " · " + current.pickupTime : ""} · {current.passengers} passenger(s)</p>{current.passengerPhone && <a href={`tel:${current.passengerPhone}`} className="mt-1 inline-block text-sm text-neutral-300">{current.passengerPhone}</a>}</div>
            <button onClick={() => setSelectedId(null)} aria-label="Close reservation details" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button>
          </div>
          <AddressNavigation label="Pickup" address={current.pickupAddress} />
          {current.stopAddress?.trim() && <AddressNavigation label="Stop" address={current.stopAddress} />}
          <AddressNavigation label="Drop-off" address={current.dropoffAddress} />
          {current.pickupAddress.trim() && current.dropoffAddress.trim() && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Full route</p>
                <MapPin className="size-4 shrink-0 text-yellow-400" />
              </div>
              <p className="mt-1 break-words text-sm leading-relaxed text-white">{current.pickupAddress}{current.stopAddress?.trim() ? ` → ${current.stopAddress}` : ""} → {current.dropoffAddress}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={googleRouteLink(current)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-2 text-[11px] font-bold text-neutral-200"><ArrowUpRight className="size-3.5" /> {current.stopAddress?.trim() ? "Route · pickup → stop → drop-off" : "Route · pickup → drop-off"}</a>
              </div>
            </div>
          )}
          {current.pickupKind === "airport" && (
            <div className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-sky-200"><Plane className="size-4" /> Airport pickup</div>
              <button disabled={flightLoading} onClick={() => trackFlight(current)} aria-label={`Track flight ${current.flightNumber} live`} className="mt-2 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-sky-800/70 bg-sky-950/40 px-2.5 py-1.5 text-left disabled:opacity-50"><Plane className="size-4 shrink-0 text-sky-300" /><span className="text-sm font-bold text-white">{current.airline ? current.airline + " · " : ""}{current.flightNumber}</span><span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">{flightLoading ? "Checking…" : "Tap for live status"}</span></button>
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
          <CrmPhotosBlock photos={current.photos} kind="reservations" recordId={current.id} cloud={photoCloud ?? null} onChange={(next) => setReservations((prev) => prev.map((r) => (r.id === current.id ? { ...r, photos: next, updatedAt: new Date().toISOString() } : r)))} />
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
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{r.passengerName}</span><span className="block truncate text-xs text-neutral-400">{r.serviceDate}{r.pickupTime ? " · " + r.pickupTime : ""} · {r.pickupKind === "airport" ? "Airport · " + r.flightNumber : "Regular pickup"}</span><span className="mt-1 block truncate text-[11px] text-neutral-500">{r.pickupAddress}{r.stopAddress?.trim() ? ` → ${r.stopAddress}` : ""} → {r.dropoffAddress}</span></span>
              <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-1 text-[9px] font-bold text-neutral-300">{r.status}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-neutral-600">{cloudSeed ? "Reservations are synced with the CRM cloud and also kept on this device." : "Reservations are saved on this device only. Sign in above to sync them with the CRM cloud."}</p>
    </div>
  )
}


type MessageStatus = "pending" | "approved" | "sent" | "discarded"
type CRMMessage = {
  id: string
  clientId: string
  reservationId: string
  channel: string
  fromName: string
  fromPhone: string
  body: string
  draftReply: string
  status: MessageStatus
  approvedAt: string
  sentAt: string
  needsFollowUp: boolean
  /** Cola de salida SMS (2026-11-26): estado real del despacho —
   *  "" (nunca entró a la cola) | queued (aprobado, en cola, SIN enviar)
   *  | sending (despachando desde el teléfono) | sent (despacho
   *  confirmado) | failed (no salió, con motivo). El SMS por esta vía
   *  NO confirma entrega al teléfono del cliente: no existe estado
   *  "delivered" porque sería inventarlo. */
  sendState: string
  sendError: string
  sendVia: string
  dispatchedAt: string
  createdAt: string
  updatedAt: string
}

const MESSAGES_STORE = "claris_crm_messages_v1"
const newMessage = (): CRMMessage => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `msg-${Date.now()}`,
  clientId: "", reservationId: "", channel: "SMS", fromName: "", fromPhone: "",
  body: "", draftReply: "", status: "pending", approvedAt: "", sentAt: "", needsFollowUp: false,
  sendState: "", sendError: "", sendVia: "", dispatchedAt: "",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})

/** Mensajes guardados antes de la cola de salida (2026-11-26) no traen
 *  los campos de despacho: valen "sin cola" y la UI lo dice tal cual. */
function normalizeMessage(raw: CRMMessage): CRMMessage {
  return {
    ...raw,
    needsFollowUp: !!raw.needsFollowUp,
    sendState: typeof raw.sendState === "string" ? raw.sendState : "",
    sendError: typeof raw.sendError === "string" ? raw.sendError : "",
    sendVia: typeof raw.sendVia === "string" ? raw.sendVia : "",
    dispatchedAt: typeof raw.dispatchedAt === "string" ? raw.dispatchedAt : "",
  }
}

/**
 * CRM message tray. A customer message and editable reply draft are
 * stored here. The owner can approve and queue a reply in the CRM cloud.
 * IMPORTANT: /api/crm/send only validates and queues the draft; it does
 * not transmit SMS. No Amani phone bridge, Twilio sender, or carrier
 * callback is implemented. A queued reply is never sent or delivered.
 * The dispatch callback is disabled until a real authenticated sender
 * exists, so the interface must not claim a phone dispatch occurred.
 */
function CRMMessages({ clients, reservations, cloudSeed, cloudSeedNonce, onCloudSync, cloudPending, onMessagesChanged, findOrCreateClient, onCreateReservation }: {
  clients: Client[]
  reservations: CRMReservation[]
  cloudSeed: CRMMessage[] | null
  cloudSeedNonce: number
  onCloudSync: ((items: CRMMessage[], deletedIds: string[]) => Promise<boolean>) | null
  cloudPending: boolean
  onMessagesChanged?: (items: CRMMessage[]) => void
  findOrCreateClient: (name: string, phone: string) => Client
  onCreateReservation: (message: CRMMessage) => void
}) {
  const [messages, setMessages] = useState<CRMMessage[]>([])
  const [ready, setReady] = useState(false)
  const [intake, setIntake] = useState<CRMMessage | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftEdit, setDraftEdit] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MESSAGES_STORE)
      const parsed = raw ? JSON.parse(raw) : []
      // needsFollowUp nació con el deploy de los tres botones (2026-11-26)
      // y los campos de entrega con el de envío real (mismo día): los
      // mensajes viejos no los traen y se normalizan con valores honestos.
      if (Array.isArray(parsed)) setMessages((parsed as CRMMessage[]).map(normalizeMessage))
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(MESSAGES_STORE, JSON.stringify(messages)) } catch {}
    onMessagesChanged?.(messages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ready])

  // ---- CRM cloud (mensajes): mismo patrón que reservas ----
  const seedAppliedNonce = useRef(0)
  const lastSyncedIds = useRef<Set<string>>(new Set())
  const [seedMerged, setSeedMerged] = useState(false)

  useEffect(() => {
    if (!cloudSeed || !ready || seedAppliedNonce.current === cloudSeedNonce) return
    // Guarda de degradación: si la tabla de mensajes no respondió, la
    // bandeja queda local como hoy y la nube vacía NO se interpreta como
    // "todo borrado".
    if (cloudPending) return
    seedAppliedNonce.current = cloudSeedNonce
    const cloudIds = new Set(cloudSeed.map((m) => m.id))
    const localIds = new Set(messages.map((m) => m.id))
    const syncedBefore = readSyncedIds(SYNCED_MESSAGES_KEY)
    const deletedHere = [...syncedBefore].filter((id) => !localIds.has(id) && cloudIds.has(id))
    const localOnly = messages.filter((m) => !cloudIds.has(m.id) && !syncedBefore.has(m.id))
    const merged = [...cloudSeed.filter((m) => !deletedHere.includes(m.id)).map(normalizeMessage), ...localOnly]
    setMessages(merged)
    lastSyncedIds.current = new Set(cloudIds)
    writeSyncedIds(SYNCED_MESSAGES_KEY, cloudIds)
    setSeedMerged(true)
    if ((localOnly.length || deletedHere.length) && onCloudSync) {
      void onCloudSync(merged, deletedHere).then((ok) => {
        if (!ok) return
        lastSyncedIds.current = new Set(merged.map((m) => m.id))
        writeSyncedIds(SYNCED_MESSAGES_KEY, lastSyncedIds.current)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudSeed, cloudSeedNonce, ready])

  useEffect(() => {
    if (!ready || !seedMerged || !onCloudSync) return
    const t = setTimeout(async () => {
      const currentIds = new Set(messages.map((m) => m.id))
      const deleted = [...lastSyncedIds.current].filter((id) => !currentIds.has(id))
      const ok = await onCloudSync(messages, deleted)
      if (!ok) return
      lastSyncedIds.current = currentIds
      writeSyncedIds(SYNCED_MESSAGES_KEY, currentIds)
    }, 800)
    return () => clearTimeout(t)
  }, [messages, ready, seedMerged, onCloudSync])

  const ordered = useMemo(() => {
    const rank: Record<MessageStatus, number> = { pending: 0, approved: 1, sent: 2, discarded: 3 }
    return [...messages].sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt))
  }, [messages])
  const pendingCount = messages.filter((m) => m.status === "pending").length
  const current = messages.find((m) => m.id === selectedId) ?? null

  useEffect(() => {
    if (current) setDraftEdit(current.draftReply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function removeMessage(id: string) {
    if (!window.confirm("Delete this message permanently? It is removed from this device and from the CRM cloud — it does not stay in the tray history.")) return
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setSelectedId(null)
  }

  function patchMessage(id: string, patch: Partial<CRMMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)))
  }

  function saveIntake() {
    if (!intake || !intake.body.trim()) return
    // Enlace automático por teléfono: si el número ya es de un cliente, el
    // mensaje cae en SU archivo (nunca un segundo récord).
    const digits = intake.fromPhone.replace(/\D/g, "")
    const match = digits ? clients.find((c) => c.phone.replace(/\D/g, "") === digits) : undefined
    const saved = { ...intake, clientId: intake.clientId || match?.id || "" }
    setMessages((prev) => [saved, ...prev])
    setIntake(null)
    setSelectedId(saved.id)
  }

  const [sendingId, setSendingId] = useState<string | null>(null)

  function friendlySendError(code: string): string {
    if (code === "unauthorized") return "Sign in to the CRM first — the outbox needs your CRM session. Nothing was queued."
    if (code === "invalid_phone") return "This message has no valid phone number to send to. Nothing was queued."
    if (code === "message_not_in_cloud") return "This message is not in the CRM cloud yet — the outbox works from the cloud, so give the sync a moment and try again. Nothing was queued."
    if (code === "queue_unavailable" || code === "crm_cloud_not_configured") return "The CRM cloud did not answer. Nothing was queued — try again."
    return "The message could not be put in the outbox. Nothing was sent — try again."
  }

  /** Saves an approved reply in the CRM cloud outbox. This is not an SMS
   *  transmission. No phone bridge or carrier integration is connected. */
  async function queueReply(m: CRMMessage) {
    if (sendingId) return
    patchMessage(m.id, { draftReply: m.draftReply })
    setSendingId(m.id)
    try {
      const res = await fetch("/api/crm/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: m.id, to: m.fromPhone, text: m.draftReply, approve: true }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; queued?: boolean; error?: string } | null
      if (res.ok && data?.ok && data.queued) {
        patchMessage(m.id, { status: "approved", sendState: "queued", sendError: "" })
      } else {
        patchMessage(m.id, { status: "approved", sendError: friendlySendError(String(data?.error || "")) })
      }
    } catch {
      patchMessage(m.id, { status: "approved", sendError: "Could not reach the outbox service. Nothing was queued — try again." })
    } finally {
      setSendingId(null)
    }
  }

  function approveAndQueue(m: CRMMessage) {
    const text = draftEdit.trim()
    if (!text) return
    const approved: CRMMessage = { ...m, draftReply: text, status: "approved", approvedAt: new Date().toISOString(), sendError: "" }
    patchMessage(m.id, { draftReply: text, status: "approved", approvedAt: approved.approvedAt, sendError: "" })
    void queueReply(approved)
  }

  /** Reenviar (orden de Miguel, 2026-11-26): el cliente dice "no lo
   *  recibí" — el mensaje ya enviado vuelve a pendiente con SU MISMO
   *  borrador, listo para aprobar y entrar a la cola otra vez. El
   *  rastro del despacho anterior se limpia: el nuevo envío tendrá su
   *  propio estado y su propia hora de despacho. */
  function resendMessage(m: CRMMessage) {
    patchMessage(m.id, { status: "pending", approvedAt: "", sentAt: "", draftReply: m.draftReply, sendState: "", sendError: "", sendVia: "", dispatchedAt: "" })
  }

  const statusChip = (s: MessageStatus) => s === "pending"
    ? "border-rose-700/60 bg-rose-950/50 text-rose-300"
    : s === "approved"
      ? "border-amber-700/60 bg-amber-950/50 text-amber-300"
      : s === "sent"
        ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
        : "border-neutral-700 bg-neutral-900 text-neutral-400"

  /** Honest status labels: the CRM can approve and queue, but no SMS
   *  provider or phone dispatcher is connected, so transmission is
   *  never claimed as verified. */
  const deliveryChip = (m: CRMMessage): { label: string; cls: string } | null => {
    if (m.status === "sent") {
      return { label: "SENT STATUS RECORDED — NOT VERIFIED", cls: "border-neutral-700 bg-neutral-900 text-neutral-300" }
    }
    if (m.status === "approved") {
      switch (m.sendState) {
        case "queued": return { label: "APPROVED — NOT SENT", cls: "border-amber-700/60 bg-amber-950/50 text-amber-300" }
        case "sending": return { label: "DISPATCH STATUS — UNVERIFIED", cls: "border-amber-700/60 bg-amber-950/50 text-amber-300" }
        case "failed": return { label: "QUEUE FAILED — NOT SENT", cls: "border-rose-700/60 bg-rose-950/50 text-rose-300" }
        default: return null
      }
    }
    return null
  }

  if (!ready) return <div className="py-8 text-center text-sm text-neutral-500">Loading messages…</div>

  const linkedClient = current?.clientId ? clients.find((c) => c.id === current.clientId) ?? null : null
  const linkedReservation = current?.reservationId ? reservations.find((r) => r.id === current.reservationId) ?? null : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-white"><Inbox className="size-5 text-yellow-400" /> Message tray</h2>
          <p className="text-xs text-neutral-500">{pendingCount} pending · nothing is sent without your approval</p>
        </div>
        <button onClick={() => setIntake(newMessage())} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-3 py-3 text-sm font-extrabold text-black"><Plus className="size-4" /> Log message</button>
      </div>

      {intake && (
        <div className="rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-extrabold text-white">Incoming client message</h3><button onClick={() => setIntake(null)} aria-label="Close message form" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button></div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={reservationLabel}>From (client name)</label><input value={intake.fromName} onChange={(e) => setIntake({ ...intake, fromName: e.target.value })} className={reservationInput} placeholder="Client name" /></div>
              <div><label className={reservationLabel}>Phone</label><input type="tel" value={intake.fromPhone} onChange={(e) => setIntake({ ...intake, fromPhone: e.target.value })} className={reservationInput} placeholder="Phone number" /></div>
            </div>
            <div><label className={reservationLabel}>Channel</label><select value={intake.channel} onChange={(e) => setIntake({ ...intake, channel: e.target.value })} className={reservationInput}><option>SMS</option><option>WhatsApp</option><option>Other</option></select></div>
            <div><label className={reservationLabel}>Message received *</label><textarea rows={3} value={intake.body} onChange={(e) => setIntake({ ...intake, body: e.target.value })} className={reservationInput + " resize-y"} placeholder="Paste the client's message exactly as it arrived…" /></div>
            <div><label className={reservationLabel}>Draft reply (editable — Miguel approves before anything goes out)</label><textarea rows={3} value={intake.draftReply} onChange={(e) => setIntake({ ...intake, draftReply: e.target.value })} className={reservationInput + " resize-y"} placeholder="Proposed reply…" /></div>
          </div>
          <button disabled={!intake.body.trim()} onClick={saveIntake} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"><Save className="size-4" /> Save to tray</button>
        </div>
      )}

      {current && !intake && (
        <div className="space-y-3 rounded-2xl border border-yellow-500/30 bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusChip(current.status)}>{current.status.toUpperCase()}</span>
                {(() => { const chip = deliveryChip(current); return chip ? <span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold " + chip.cls}>{chip.label}</span> : null })()}
                {current.needsFollowUp && <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/60 bg-amber-950/50 px-2.5 py-1 text-[10px] font-bold text-amber-300"><Flag className="size-3" /> FOLLOW-UP</span>}
              </span>
              <h3 className="mt-2 text-xl font-extrabold text-white">{current.fromName || "Unknown sender"}</h3>
              <p className="mt-1 text-xs text-neutral-400">{current.channel} · {current.fromPhone || "no phone"} · {new Date(current.createdAt).toLocaleString()}</p>
            </div>
            <button onClick={() => setSelectedId(null)} aria-label="Minimize — the pending message stays in the tray" className="rounded-lg p-2 text-neutral-400"><X className="size-4" /></button>
          </div>
          <div className="rounded-xl bg-neutral-950 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Client wrote</p>
            <p className="whitespace-pre-wrap text-sm text-neutral-100">{current.body}</p>
          </div>
          <div>
            <label className={reservationLabel}>Reply draft — editable</label>
            <textarea rows={3} value={draftEdit} onChange={(e) => setDraftEdit(e.target.value)} className={reservationInput + " resize-y"} placeholder="Write the reply Miguel will approve…" />
            {draftEdit !== current.draftReply && <button onClick={() => patchMessage(current.id, { draftReply: draftEdit })} className="mt-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-white">Save draft edits</button>}
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Client file</p>
            {linkedClient ? (
              <p className="mt-1 text-sm text-neutral-200">{linkedClient.name} · <span className="font-bold text-yellow-300">{linkedClient.accountNumber || "no account yet"}</span>{linkedClient.phone ? ` · ${linkedClient.phone}` : ""}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => { const c = findOrCreateClient(current.fromName, current.fromPhone); patchMessage(current.id, { clientId: c.id }) }} className="rounded-lg bg-neutral-800 px-3 py-2.5 text-xs font-bold text-white">Create / find client record</button>
                <select value="" onChange={(e) => { if (e.target.value) patchMessage(current.id, { clientId: e.target.value }) }} className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-xs text-white">
                  <option value="">…or link an existing client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.accountNumber ? ` · ${c.accountNumber}` : ""}</option>)}
                </select>
              </div>
            )}
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Reservation entry</p>
            {linkedReservation ? (
              <p className="mt-1 text-sm text-neutral-200">{linkedReservation.serviceDate}{linkedReservation.pickupTime ? " · " + linkedReservation.pickupTime : ""} · {linkedReservation.pickupAddress} → {linkedReservation.dropoffAddress}{linkedReservation.pickupKind === "airport" ? ` · ${linkedReservation.flightNumber}` : ""}</p>
            ) : (
              <button onClick={() => onCreateReservation(current)} className="mt-2 rounded-lg bg-neutral-800 px-3 py-2.5 text-xs font-bold text-white">Create reservation from this message</button>
            )}
          </div>

          {current.status === "approved" && (
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3">
              <p className="text-xs leading-relaxed text-amber-100">
                Approved by you{current.approvedAt ? ` · ${new Date(current.approvedAt).toLocaleString()}` : ""}.
                {current.sendState === "queued" && " This reply is approved and saved in the CRM outbox. It has NOT been sent. No SMS provider or phone bridge is connected yet."}
                {current.sendState === "sending" && " A dispatch status was recorded, but actual SMS transmission is not verified."}
                {current.sendState === "failed" && " The reply could not be saved in the outbox. Nothing was sent — try again."}
                {current.sendState !== "queued" && current.sendState !== "sending" && current.sendState !== "failed" && (sendingId === current.id ? " Saving to the CRM outbox…" : " Approve and queue this reply in the CRM. This does NOT send an SMS.")}
              </p>
              {current.sendError && <p className="mt-2 rounded-lg border border-rose-800/60 bg-rose-950/40 p-2 text-xs leading-relaxed text-rose-200">{current.sendError}</p>}
            </div>
          )}
          {current.status === "sent" && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-xs text-emerald-100"><>The CRM contains a sent status{current.sentAt ? ` · ${new Date(current.sentAt).toLocaleString()}` : ""}, but actual SMS transmission has NOT been verified. No sender is connected.</></p>
                <button onClick={() => resendMessage(current)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-extrabold text-black"><Undo2 className="size-3.5" /> Reenviar</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {current.status === "pending" && <button onClick={() => approveAndQueue(current)} disabled={!draftEdit.trim() || sendingId === current.id} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-extrabold text-black disabled:opacity-40"><CheckCheck className="size-4" /> {sendingId === current.id ? "Queuing…" : "Approve & Queue — NOT SENT"}</button>}
            {current.status === "approved" && current.sendState !== "queued" && current.sendState !== "sending" && <button onClick={() => void queueReply({ ...current, draftReply: draftEdit.trim() || current.draftReply })} disabled={sendingId === current.id || !(draftEdit.trim() || current.draftReply)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-black disabled:opacity-40">{sendingId === current.id ? "Queuing…" : "Queue again — NOT SENT"}</button>}
            {current.status === "sent" && <button onClick={() => patchMessage(current.id, { needsFollowUp: !current.needsFollowUp })} className={"inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold " + (current.needsFollowUp ? "border-amber-500/60 bg-amber-950/40 text-amber-200" : "border-neutral-700 text-neutral-200")}><Flag className="size-4" /> {current.needsFollowUp ? "Following up — tap to clear" : "Mark follow-up"}</button>}
            {(current.status === "pending" || current.status === "approved") && <button onClick={() => { if (window.confirm("Discard this message? It stays in the tray history as discarded.")) { patchMessage(current.id, { status: "discarded" }); setSelectedId(null) } }} className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-bold text-neutral-300">Discard</button>}
            <button onClick={() => setSelectedId(null)} className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-bold text-white">Minimize</button>
            <button onClick={() => removeMessage(current.id)} className="inline-flex items-center gap-2 rounded-xl border border-rose-900/70 px-4 py-3 text-sm font-bold text-rose-300"><Trash2 className="size-4" /> Delete</button>
          </div>
          <p className="text-[11px] text-neutral-500">Minimize keeps the message pending — the counter on the Messages tab stays until you approve, queue or discard it. Approve &amp; Queue saves the approved draft in the CRM cloud; it does NOT send an SMS because no carrier provider or phone bridge is connected. A recorded sent status is not proof of transmission or delivery. Delete removes the message from the CRM cloud — Discard only closes it and keeps it in history. Reenviar returns a message to pending with the same draft; it still requires a future real sender before any SMS can go out.</p>
        </div>
      )}

      {!intake && (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-white">Tray</h3><span className="text-xs text-neutral-500">{messages.length} shown</span></div>
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-700 px-5 py-10 text-center"><MessageSquare className="mx-auto mb-3 size-8 text-neutral-600" /><p className="font-bold text-white">No messages in the tray</p><p className="mt-1 text-sm text-neutral-500">When a client writes, the message and its draft reply land here for your approval — even if you cannot look at it for hours, it is never lost.</p></div>
          ) : ordered.map((m) => (
            <button key={m.id} onClick={() => setSelectedId(m.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selectedId === m.id ? "border-yellow-500/50 bg-yellow-400/5" : "border-neutral-800 bg-neutral-900/70")}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-yellow-400"><MessageSquare className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{m.fromName || m.fromPhone || "Unknown sender"}</span>
                <span className="block truncate text-xs text-neutral-400">{m.body}</span>
                <span className="mt-0.5 block text-[10px] text-neutral-500">{m.channel} · {new Date(m.createdAt).toLocaleString()}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={"rounded-full border px-2 py-1 text-[9px] font-bold " + statusChip(m.status)}>{m.status.toUpperCase()}</span>
                {(() => { const chip = deliveryChip(m); return chip ? <span className={"rounded-full border px-2 py-1 text-[9px] font-bold " + chip.cls}>{chip.label}</span> : null })()}
                {m.needsFollowUp && <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/60 bg-amber-950/50 px-2 py-1 text-[9px] font-bold text-amber-300"><Flag className="size-3" /> FOLLOW-UP</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-neutral-600">{cloudPending ? "Message tray is saved on this device until the CRM cloud update (migration) is applied to the CRM project." : onCloudSync ? "Messages are synced with the CRM cloud and also kept on this device." : "Messages are saved on this device only. Sign in above to sync them with the CRM cloud."}</p>
    </div>
  )
}
