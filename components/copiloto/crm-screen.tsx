"use client"

/**
 * CRM — pantalla raíz del diseño nuevo (prototipo de Claude) dentro
 * de Claris producción, sobre el MISMO servidor y los MISMOS datos.
 *
 * Esta raíz es la ÚNICA dueña de los datos: sesión, pull/push a
 * /api/crm/state, GPS y detección de peajes. Las pestañas
 * (components/copiloto/crm/*) son vistas puras que reciben el
 * contexto (ctx.ts). Se reutilizan sin tocar: lib/crm/crm-cloud.ts
 * (mapeos), supabase-browser, parse-message.ts, crm-photos.ts,
 * geo.ts, toll-detect.ts / toll-plazas-2026.ts y el componente de
 * notificaciones de producción (vive en Settings, junto a la nube).
 *
 * ═══ FUSIÓN NUBE↔DISPOSITIVO — LA REGLA QUE NO SE ROMPE ═══
 * El 2026-11-28 Miguel vio sus 12 mensajes, cerró la app, la reabrió
 * y la bandeja estaba vacía: el mecanismo anterior (deletedHere)
 * clasificaba la semilla de la nube como "borrada aquí" cuando la
 * lista local corría vacía en el remonte y EMPUJABA el borrado a la
 * nube. La fusión nueva (lib/crm/merge.ts) hace eso imposible:
 *  (a) un registro de la nube NUNCA desaparece por un remonte con la
 *      lista local vacía o a medio hidratar — sin hidratación o sin
 *      lectura íntegra, la fusión no se aplica y lo local queda
 *      intacto; una nube vacía se trata como sospechosa hasta que
 *      una segunda lectura seguida la confirma;
 *  (b) NINGÚN borrado se empuja a la nube por inferencia de la
 *      fusión — el resultado de mergeCloudList ni siquiera tiene un
 *      campo donde un borrado pudiera viajar. Borrar en la nube
 *      ocurre SOLO desde los botones Delete explícitos (que llenan
 *      pendingDeletes), la vía que Miguel ya confirmó en su teléfono;
 *  (c) la prueba nombrada del ciclo vive en
 *      scripts/_test-crm-merge.mjs:
 *      "remount-with-empty-local-keeps-cloud-messages-and-emits-no-delete".
 *
 * Los campos EXTRA del prototipo (carriles, tarifa, cobro…) viven en
 * los objetos locales y preserveExtras los re-engancha tras cada
 * pull; la migración que les da casa en la nube es aditiva y la pega
 * Miguel (supabase/migrations/20261128143000_crm_lanes_and_payments.sql)
 * — la app funciona sin ella.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { clientToRow, messageToRow, reservationToRow } from "@/lib/crm/crm-cloud"
import { isConversationMsg } from "@/lib/crm/classify-inbound"
import { mergeCloudList, nextSyncedIds, preserveExtras } from "@/lib/crm/merge"
import { crmCloudConfigured, crmSupabaseBrowser } from "@/lib/crm/supabase-browser"
import { loadHeaderPlace, refreshHeaderPlace, type HeaderPlace } from "@/components/copiloto/geo"
import { appendNote, detectNewTolls, formatTollNote } from "@/components/copiloto/toll-detect"
import { AgendaTab, BlockFormSheet } from "./crm/agenda"
import { SettingsSheet } from "./crm/ajustes"
import { AmaniFloat } from "./crm/amani"
import { ClientDetail, ClientFormSheet, ClientesTab } from "./crm/clientes"
import { CobrosTab } from "./crm/cobros"
import type { CrmCtx, CrmTab, GpsState, UiState } from "./crm/ctx"
import { initialUi } from "./crm/ctx"
import { CRM_CSS } from "./crm/crm-styles"
import { digitsOf, nextActNumber, normalizeAccount, parseTimeParts, phoneKey, todayKey } from "./crm/helpers"
import { HoyTab, CarView, locLineText } from "./crm/hoy"
import { getLang, setLang as setLangStore, tx, type CrmLang } from "./crm/i18n"
import { BroadcastSheet, IntakeSheet, LaneSheet, MessageDetailSheet, MensajesTab, totalPending } from "./crm/mensajes"
import { ReservationDetail, ReservationFormSheet, ReservasTab } from "./crm/reservas"
import { PaySheet } from "./crm/sheets"
import {
  CLIENT_EXTRA_FIELDS,
  MESSAGE_EXTRA_FIELDS,
  RESERVATION_EXTRA_FIELDS,
  VEHICLE_DEFAULTS,
  emptyClient,
  emptyMessage,
  normalizeClient,
  normalizeMessage,
  normalizeReservation,
  type CRMMessage,
  type CRMReservation,
  type Client,
  type CrmBlock,
  type CrmGroup,
  type Vehicle,
} from "./crm/types"

const CLIENTS_KEY = "claris_crm_clients_v1"
const RESERVATIONS_KEY = "claris_crm_reservations_v1"
const MESSAGES_KEY = "claris_crm_messages_v1"
const SYNCED_CLIENTS_KEY = "claris_crm_synced_clients_v1"
const SYNCED_RESERVATIONS_KEY = "claris_crm_synced_reservations_v1"
const SYNCED_MESSAGES_KEY = "claris_crm_synced_messages_v1"
const GROUPS_KEY = "claris_crm_groups_v1"
const BLOCKS_KEY = "claris_crm_blocks_v1"
const VEHICLE_KEY = "claris_crm_vehicle_v1"
const MSGLIGHT_KEY = "claris_crm_msglight_v1"

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {}
  return fallback
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}
function readSynced(key: string): Set<string> {
  const arr = readJSON<unknown>(key, [])
  return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [])
}
const genRef = (): string =>
  "Ref-" + Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("")

type CloudStateResponse = {
  ok?: boolean
  clients?: Client[]
  reservations?: CRMReservation[]
  messages?: CRMMessage[]
  messagesPending?: boolean
  error?: string
}

export function CRMScreen({ openMessagesNonce = 0 }: { openMessagesNonce?: number }) {
  const [tab, setTab] = useState<CrmTab>("today")
  const [ui, setUi] = useState<UiState>(() => ({ ...initialUi(), calSel: todayKey() }))
  const [clients, setClients] = useState<Client[]>([])
  const [reservations, setReservations] = useState<CRMReservation[]>([])
  const [messages, setMessages] = useState<CRMMessage[]>([])
  const [groups, setGroups] = useState<CrmGroup[]>([])
  const [blocks, setBlocks] = useState<CrmBlock[]>([])
  const [vehicle, setVehicle] = useState<Vehicle>(VEHICLE_DEFAULTS)
  const [ignoredMsgIds, setIgnoredMsgIds] = useState<Set<string>>(new Set())
  const [lang, setLangState] = useState<CrmLang>(() => getLang())
  const [session, setSession] = useState<Session | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudError, setCloudError] = useState("")
  const [messagesPendingFlag, setMessagesPendingFlag] = useState(false)
  const [gps, setGps] = useState<GpsState>({ status: "searching", lat: null, lng: null, heading: null, accuracy: null })
  const [place, setPlace] = useState<HeaderPlace | null>(() => loadHeaderPlace())
  const [toastState, setToastState] = useState<{ id: number; msg: string } | null>(null)
  const [recHideFor, setRecHideFor] = useState("")

  const hydrated = useRef({ clients: false, reservations: false, messages: false })
  const synced = useRef({ clients: new Set<string>(), reservations: new Set<string>(), messages: new Set<string>() })
  const pendingDeletes = useRef({ clients: new Set<string>(), reservations: new Set<string>(), messages: new Set<string>() })
  const pulledOk = useRef({ clients: false, reservations: false, messages: false })
  const emptyStreak = useRef({ clients: 0, reservations: 0, messages: 0 })
  const pullInFlight = useRef(false)
  const lastPullAt = useRef(0)
  const ownerId = session?.user?.id || ""

  const patchUi = useCallback((p: Partial<UiState>) => setUi((u) => ({ ...u, ...p })), [])
  const toast = useCallback((msg: string) => setToastState({ id: Date.now(), msg }), [])
  useEffect(() => {
    if (!toastState) return
    const t = setTimeout(() => setToastState((s) => (s?.id === toastState.id ? null : s)), 2600)
    return () => clearTimeout(t)
  }, [toastState])

  /* ── Carga local (una vez) ───────────────────────────────────── */
  useEffect(() => {
    const rawClients = readJSON<unknown[]>(CLIENTS_KEY, [])
    if (Array.isArray(rawClients)) setClients(rawClients.map((c) => normalizeClient(c as Client)))
    hydrated.current.clients = true
    const rawRes = readJSON<unknown[]>(RESERVATIONS_KEY, [])
    if (Array.isArray(rawRes)) setReservations(rawRes.map((r) => normalizeReservation(r as CRMReservation)))
    hydrated.current.reservations = true
    const rawMsg = readJSON<unknown[]>(MESSAGES_KEY, [])
    if (Array.isArray(rawMsg)) setMessages(rawMsg.map((m) => normalizeMessage(m as CRMMessage)))
    hydrated.current.messages = true
    synced.current.clients = readSynced(SYNCED_CLIENTS_KEY)
    synced.current.reservations = readSynced(SYNCED_RESERVATIONS_KEY)
    synced.current.messages = readSynced(SYNCED_MESSAGES_KEY)
    setGroups(readJSON<CrmGroup[]>(GROUPS_KEY, []))
    setBlocks(readJSON<CrmBlock[]>(BLOCKS_KEY, []))
    setVehicle({ ...VEHICLE_DEFAULTS, ...readJSON<Partial<Vehicle>>(VEHICLE_KEY, {}) })
    setIgnoredMsgIds(new Set(readJSON<string[]>(MSGLIGHT_KEY, [])))
  }, [])

  /* ── Escritura local (solo tras hidratar) ────────────────────── */
  useEffect(() => { if (hydrated.current.clients) writeJSON(CLIENTS_KEY, clients) }, [clients])
  useEffect(() => { if (hydrated.current.reservations) writeJSON(RESERVATIONS_KEY, reservations) }, [reservations])
  useEffect(() => { if (hydrated.current.messages) writeJSON(MESSAGES_KEY, messages) }, [messages])
  useEffect(() => { writeJSON(GROUPS_KEY, groups) }, [groups])
  useEffect(() => { writeJSON(BLOCKS_KEY, blocks) }, [blocks])
  useEffect(() => { writeJSON(VEHICLE_KEY, vehicle) }, [vehicle])
  useEffect(() => { writeJSON(MSGLIGHT_KEY, [...ignoredMsgIds]) }, [ignoredMsgIds])

  /* ── Sesión ──────────────────────────────────────────────────── */
  useEffect(() => {
    const sb = crmSupabaseBrowser()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => {})
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        // OJO (de producción): los conjuntos sincronizados persistidos
        // NO se limpian al cerrar sesión — son memoria del dispositivo.
        pulledOk.current = { clients: false, reservations: false, messages: false }
        setMessagesPendingFlag(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  /* ── Pull seguro ─────────────────────────────────────────────── */
  const pullFromCloud = useCallback(async () => {
    if (!ownerId || pullInFlight.current) return
    if (Date.now() - lastPullAt.current < 1200) return
    pullInFlight.current = true
    lastPullAt.current = Date.now()
    setCloudBusy(true)
    try {
      const res = await fetch("/api/crm/state", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as CloudStateResponse
      if (!res.ok || !data.ok) throw new Error(data.error || "cloud read failed")

      const applyCollection = <T extends { id: string }>(
        kind: "clients" | "reservations" | "messages",
        cloudRaw: T[] | undefined,
        pullOkFlag: boolean,
        normalize: (x: T) => T,
        setState: (updater: (prev: T[]) => T[]) => void,
        extraFields: readonly string[],
      ) => {
        if (!pullOkFlag || !Array.isArray(cloudRaw)) return
        const cloud = cloudRaw.map(normalize)
        setState((prev) => {
          const honor = emptyStreak.current[kind] >= 1
          const r = mergeCloudList({
            cloud,
            local: prev,
            syncedBefore: synced.current[kind],
            hydrated: hydrated.current[kind],
            pullOk: true,
            honorEmptyCloud: honor,
          })
          if (!r.applied) {
            if (cloud.length === 0 && prev.length > 0) emptyStreak.current[kind] += 1
            return prev
          }
          emptyStreak.current[kind] = 0
          pulledOk.current[kind] = true
          synced.current[kind] = nextSyncedIds(cloud, [])
          writeJSON(kind === "clients" ? SYNCED_CLIENTS_KEY : kind === "reservations" ? SYNCED_RESERVATIONS_KEY : SYNCED_MESSAGES_KEY, [...synced.current[kind]])
          return preserveExtras(r.merged, prev, extraFields)
        })
      }

      applyCollection("clients", data.clients, true, (c) => normalizeClient(c), setClients, CLIENT_EXTRA_FIELDS)
      applyCollection("reservations", data.reservations, true, (r) => normalizeReservation(r), setReservations, RESERVATION_EXTRA_FIELDS)
      const msgOk = !data.messagesPending
      setMessagesPendingFlag(!msgOk)
      if (msgOk) applyCollection("messages", data.messages, true, (m) => normalizeMessage(m), setMessages, MESSAGE_EXTRA_FIELDS)
      setCloudError("")
    } catch {
      setCloudError(tx("Cloud sync problem — your records are safe on this device."))
    } finally {
      pullInFlight.current = false
      setCloudBusy(false)
    }
  }, [ownerId])

  useEffect(() => {
    if (ownerId) void pullFromCloud()
  }, [ownerId, pullFromCloud])

  /* pollInbox (PC-8): con la app al frente se re-lee la bandeja —
     15 s visible / 60 s oculta, más al volver el foco. Los editores
     abiertos guardan su borrador aparte: un pull nunca pisa una
     edición en curso. */
  useEffect(() => {
    if (!ownerId) return
    const tick = () => void pullFromCloud()
    const iv = window.setInterval(tick, document.visibilityState === "visible" ? 15000 : 60000)
    const onVis = () => { if (document.visibilityState === "visible") tick() }
    const onFocus = () => tick()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(iv)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("focus", onFocus)
    }
  }, [ownerId, pullFromCloud])

  /* ── Push (subidas + SOLO borrados explícitos) ───────────────── */
  const pushCollection = useCallback(
    async (kind: "clients" | "reservations" | "messages") => {
      if (!ownerId || !pulledOk.current[kind]) return
      const deletes = [...pendingDeletes.current[kind]]
      const body: Record<string, unknown> = {}
      if (kind === "clients") {
        body.clients = clients.map((c) => clientToRow(c))
        if (deletes.length) body.deletedClientIds = deletes
      } else if (kind === "reservations") {
        body.reservations = reservations.map((r) => reservationToRow(r))
        if (deletes.length) body.deletedReservationIds = deletes
      } else {
        body.messages = messages.map((m) => messageToRow(m))
        if (deletes.length) body.deletedMessageIds = deletes
      }
      try {
        const res = await fetch("/api/crm/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean }
        if (!res.ok || !data.ok) throw new Error("push failed")
        const current = kind === "clients" ? clients : kind === "reservations" ? reservations : messages
        synced.current[kind] = new Set(current.map((x) => x.id))
        writeJSON(kind === "clients" ? SYNCED_CLIENTS_KEY : kind === "reservations" ? SYNCED_RESERVATIONS_KEY : SYNCED_MESSAGES_KEY, [...synced.current[kind]])
        for (const id of deletes) pendingDeletes.current[kind].delete(id)
        setCloudError("")
      } catch {
        setCloudError(tx("Cloud sync problem — your records are safe on this device."))
      }
    },
    [ownerId, clients, reservations, messages],
  )

  useEffect(() => {
    if (!ownerId) return
    const t = setTimeout(() => void pushCollection("clients"), 800)
    return () => clearTimeout(t)
  }, [clients, ownerId, pushCollection])
  useEffect(() => {
    if (!ownerId) return
    const t = setTimeout(() => void pushCollection("reservations"), 800)
    return () => clearTimeout(t)
  }, [reservations, ownerId, pushCollection])
  useEffect(() => {
    if (!ownerId) return
    const t = setTimeout(() => void pushCollection("messages"), 800)
    return () => clearTimeout(t)
  }, [messages, ownerId, pushCollection])

  /* ── GPS en vivo + peajes ────────────────────────────────────── */
  const lastFixAt = useRef(0)
  const lastPlaceFix = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGps((g) => ({ ...g, status: "off" }))
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastFixAt.current = Date.now()
        const { latitude: lat, longitude: lng, heading, accuracy } = pos.coords
        setGps({ status: "ready", lat, lng, heading: heading ?? null, accuracy: accuracy ?? null })
        const lp = lastPlaceFix.current
        if (!lp || Math.hypot(lat - lp.lat, lng - lp.lng) > 0.0015) {
          lastPlaceFix.current = { lat, lng }
          void refreshHeaderPlace().then((p) => { if (p) setPlace(p) }).catch(() => {})
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGps((g) => ({ ...g, status: "off" }))
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    const stale = window.setInterval(() => {
      if (lastFixAt.current && Date.now() - lastFixAt.current > 45000) setGps((g) => (g.status === "ready" ? { ...g, status: "searching" } : g))
    }, 5000)
    return () => {
      navigator.geolocation.clearWatch(watchId)
      window.clearInterval(stale)
    }
  }, [])

  // Detección de peajes: armada con un viaje en etapa de ruta; cada
  // plaza entra UNA vez, en su propia línea de las notas (appendNote
  // de producción) y sumando a los peajes de esa reserva.
  const reservationsRef = useRef(reservations)
  reservationsRef.current = reservations
  useEffect(() => {
    if (gps.status !== "ready" || gps.lat == null || gps.lng == null) return
    const trip = reservationsRef.current.find(
      (r) => (r.stage === "enroute" || r.stage === "arrived" || r.stage === "onboard") && r.status !== "Completed" && r.status !== "Cancelled",
    )
    if (!trip) return
    const hits = detectNewTolls(gps.lat, gps.lng, gps.heading, new Set(trip.tollHits || []), new Date())
    if (!hits.length) return
    let notes = trip.notes || ""
    let tolls = Number(trip.tolls) || 0
    const hitIds = [...(trip.tollHits || [])]
    for (const plaza of hits) {
      const note = formatTollNote(plaza, new Date())
      notes = appendNote(notes, note.text)
      if (note.amount != null) tolls += note.amount
      hitIds.push(plaza.name)
      toast(`🧾 ${plaza.name}${note.amount != null ? " — $" + note.amount.toFixed(2) : ""}`)
    }
    setReservations((prev) => prev.map((r) => (r.id === trip.id ? { ...r, notes, tolls: Math.round(tolls * 100) / 100, tollHits: hitIds, updatedAt: new Date().toISOString() } : r)))
  }, [gps, toast])

  /* ── Notificaciones locales de producción (mismos textos/llaves) ─ */
  const ready = hydrated.current.clients && hydrated.current.messages
  useEffect(() => {
    if (!ready || !clients.length || !("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return
    const now = new Date()
    const today = todayKey(now)
    const due = clients.filter((client) => client.nextContact && client.nextContact <= today && client.status !== "Inactive")
    if (!due.length) return
    const key = "claris_crm_followup_notice_v1"
    try { if (localStorage.getItem(key) === today) return } catch {}
    navigator.serviceWorker.ready
      .then(async (registration) => {
        await registration.showNotification("CRM follow-ups due", {
          body: due.length === 1 ? "You have 1 client follow-up due today or overdue." : `You have ${due.length} client follow-ups due today or overdue.`,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: `crm-followups-${today}`,
          data: { url: "/" },
        })
        try { localStorage.setItem(key, today) } catch {}
      })
      .catch(() => {})
  }, [clients, ready])

  const dueReminders = useMemo(() => {
    const out: { reservation: CRMReservation; kind: "day-before" | "two-hours" }[] = []
    const now = new Date()
    const today = todayKey(now)
    const tomorrow = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    for (const r of reservations) {
      if (r.status !== "Requested" && r.status !== "Confirmed") continue
      if (r.serviceDate === tomorrow) out.push({ reservation: r, kind: "day-before" })
      if (r.serviceDate === today && r.pickupTime) {
        const t = parseTimeParts(r.pickupTime)
        if (t) {
          const pickup = new Date(now.getFullYear(), now.getMonth(), now.getDate(), t.h, t.m)
          const diff = pickup.getTime() - now.getTime()
          if (diff > 0 && diff <= 2 * 3600e3) out.push({ reservation: r, kind: "two-hours" })
        }
      }
    }
    return out
  }, [reservations])

  useEffect(() => {
    if (!ready || !dueReminders.length || !("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return
    const KEY = "claris_crm_reminder_notices_v1"
    let seen: string[] = []
    try { seen = JSON.parse(localStorage.getItem(KEY) || "[]") } catch {}
    const fresh = dueReminders.filter((d) => !seen.includes(`${d.reservation.id}|${d.kind}|${d.reservation.serviceDate}`))
    if (!fresh.length) return
    navigator.serviceWorker.ready
      .then(async (registration) => {
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
      })
      .catch(() => {})
  }, [dueReminders, ready])

  /* ── Mutaciones ──────────────────────────────────────────────── */
  const saveClient = useCallback((c: Client) => {
    setClients((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]))
  }, [])
  const saveReservation = useCallback((r: CRMReservation) => {
    setReservations((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r]))
  }, [])
  const saveMessage = useCallback((m: CRMMessage) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]))
  }, [])
  const updateReservation = useCallback((id: string, patch: Partial<CRMReservation>) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])
  const removeClient = useCallback((id: string) => {
    if (synced.current.clients.has(id)) pendingDeletes.current.clients.add(id)
    setClients((prev) => prev.filter((c) => c.id !== id))
  }, [])
  const removeReservation = useCallback((id: string) => {
    if (synced.current.reservations.has(id)) pendingDeletes.current.reservations.add(id)
    setReservations((prev) => prev.filter((r) => r.id !== id))
  }, [])
  const removeMessage = useCallback((id: string) => {
    if (synced.current.messages.has(id)) pendingDeletes.current.messages.add(id)
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const findOrCreateClient = useCallback(
    (name: string, phone: string): Client | null => {
      const key = phoneKey(phone)
      if (key) {
        const found = clients.find((c) => phoneKey(c.phone) === key)
        if (found) return found
      }
      if (!name.trim() && !key) return null
      // Regla refinada 2026-11-28: la ficha nace SIN número de cuenta;
      // el ACT se asigna solo con el botón de la ficha.
      const c = normalizeClient({ ...emptyClient(), name: name.trim() || phone.trim(), phone: phone.trim(), status: "Lead" })
      saveClient(c)
      return c
    },
    [clients, saveClient],
  )

  const assignAccountNumber = useCallback(
    (clientId: string) => {
      const c = clients.find((x) => x.id === clientId)
      if (!c) return
      if (c.accountNumber) return
      if (!digitsOf(c.phone)) {
        toast(tx("Add the client's phone first — the account number needs a phone on file."))
        return
      }
      const acct = nextActNumber(clients)
      if (clients.some((x) => x.id !== c.id && normalizeAccount(x.accountNumber) === normalizeAccount(acct))) {
        toast(tx("That account number is already used by another client."))
        return
      }
      saveClient({ ...c, accountNumber: acct })
      toast(`${tx("Account number assigned:")} ${acct}`)
    },
    [clients, saveClient, toast],
  )

  const approveMessage = useCallback(
    async (m: CRMMessage, reply: string): Promise<boolean> => {
      const nowIso = new Date().toISOString()
      const approved: CRMMessage = { ...m, draftReply: reply, approvedReply: reply, status: "approved", approvedAt: nowIso, sendState: "", updatedAt: nowIso }
      saveMessage(approved)
      try {
        const res = await fetch("/api/crm/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: m.id }),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean }
        if (!res.ok || !data.ok) throw new Error("queue failed")
        saveMessage({ ...approved, sendState: "queued" })
        toast(tx("Approved — in the outbox. It sends from your phone; SMS does not confirm delivery."))
        return true
      } catch {
        if (!synced.current.messages.has(m.id)) {
          // Mensaje creado en este teléfono y aún no subido: la
          // aprobación queda registrada y entra a la cola al
          // sincronizar (el push lo lleva con su send_state).
          saveMessage({ ...approved, sendState: "queued" })
          toast(tx("Approved — it enters the outbox when the cloud syncs."))
          return true
        }
        toast(tx("Could not queue the send. The approval is saved; try again."))
        return false
      }
    },
    [saveMessage, toast],
  )

  const queueOutgoing = useCallback(
    (partial: Partial<CRMMessage>): CRMMessage => {
      const nowIso = new Date().toISOString()
      const m = normalizeMessage({
        ...emptyMessage(),
        ...partial,
        direction: "outbound",
        status: "approved",
        sendState: "queued",
        approvedAt: nowIso,
        refCode: partial.refCode || genRef(),
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      saveMessage(m)
      return m
    },
    [saveMessage],
  )

  /* ── Cuenta ──────────────────────────────────────────────────── */
  const signIn = useCallback(async (email: string, password: string) => {
    const sb = crmSupabaseBrowser()
    if (!sb) throw new Error("not configured")
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])
  const signOut = useCallback(async () => {
    const sb = crmSupabaseBrowser()
    if (sb) await sb.auth.signOut()
  }, [])

  /* ── Navegación interna ──────────────────────────────────────── */
  const goTab = useCallback((t: CrmTab) => {
    setTab(t)
    setUi((u) => ({ ...u, clientSel: null, resSel: null, msgSel: null }))
  }, [])
  const openClient = useCallback((id: string, from: CrmTab) => patchUi({ clientSel: id, retTab: from }), [patchUi])
  const openReservation = useCallback((id: string, from: CrmTab) => patchUi({ resSel: id, retTab: from }), [patchUi])
  const openMessage = useCallback((id: string) => patchUi({ msgSel: id }), [patchUi])
  const openReservationForm = useCallback(
    (opts: { id?: string; clientId?: string; prefill?: Partial<CRMReservation> }) => {
      patchUi({
        resForm: opts.id || "new",
        resFormClientId: opts.clientId || "",
        resPrefill: opts.prefill || null,
        resFromMessage: "",
      })
    },
    [patchUi],
  )

  // El shell (HOY de Copiloto) pide abrir la bandeja: nonce nuevo =
  // ir a Mensajes y re-leer la nube.
  const nonceRef = useRef(openMessagesNonce)
  useEffect(() => {
    if (openMessagesNonce !== nonceRef.current) {
      nonceRef.current = openMessagesNonce
      goTab("messages")
      void pullFromCloud()
    }
  }, [openMessagesNonce, goTab, pullFromCloud])

  const setLang = useCallback((l: CrmLang) => {
    setLangStore(l)
    setLangState(l)
  }, [])

  const ctx: CrmCtx = {
    clients, reservations, messages, groups, blocks, vehicle,
    lang, setLang,
    signedIn: !!session,
    ownerId,
    cloudBusy, cloudError, messagesPending: messagesPendingFlag,
    signIn, signOut,
    refreshCloud: () => { lastPullAt.current = 0; void pullFromCloud() },
    gps, place,
    tab, goTab, ui, patchUi, toast,
    saveClient, removeClient, assignAccountNumber,
    findClient: (id) => clients.find((c) => c.id === id),
    findOrCreateClient,
    saveReservation, removeReservation, updateReservation,
    saveMessage, removeMessage, approveMessage, queueOutgoing,
    ignoredMsgIds,
    setMsgIgnored: (id, ignored) =>
      setIgnoredMsgIds((prev) => {
        const next = new Set(prev)
        if (ignored) next.add(id)
        else next.delete(id)
        return next
      }),
    saveGroups: setGroups,
    saveBlocks: setBlocks,
    saveVehicle: setVehicle,
    openClient, openReservation, openMessage, openReservationForm,
  }

  /* ── Derivados del encabezado ────────────────────────────────── */
  const pendings = useMemo(
    () => messages.filter((m) => m.status === "pending" && isConversationMsg(m)),
    [messages],
  )
  const pendingCount = useMemo(() => totalPending(ctx), [ctx])
  const anyLate = pendings.some((m) => Date.now() - new Date(m.createdAt).getTime() > 2 * 3600e3)
  const allIgnored = pendings.length > 0 && pendings.every((m) => ignoredMsgIds.has(m.id))
  const dotCls =
    pendings.length === 0 ? "blinkdot st-ok" : anyLate ? "blinkdot st-late" : allIgnored ? "blinkdot st-pend still" : "blinkdot st-pend"
  const activeTrip = useMemo(
    () =>
      reservations.find(
        (r) => (r.stage === "enroute" || r.stage === "arrived" || r.stage === "onboard") && r.status !== "Completed" && r.status !== "Cancelled",
      ),
    [reservations],
  )
  const recording = !!activeTrip && gps.status === "ready" && recHideFor !== activeTrip.id
  const todayLabel = new Date().toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { weekday: "long", month: "long", day: "numeric" })

  const navBtn = (t: CrmTab, label: string, badge?: number) => (
    <button key={t} type="button" aria-current={tab === t} onClick={() => goTab(t)}>
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  )

  return (
    <div className="crmx">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{CRM_CSS}</style>
      <div className="crmx-app">
        {ui.car ? (
          <main>
            <CarView ctx={ctx} />
          </main>
        ) : (
          <>
            <header className="top">
              <div className="brand">
                <span className="logo">C</span>
                <div>
                  <b>Copiloto V7</b>
                  <small>{todayLabel}</small>
                  <span className="hrow">
                    {recording && (
                      <span
                        className="recind"
                        role="button"
                        aria-label={tx("Recording — tap to hide")}
                        title={tx("Recording — tap to hide")}
                        onClick={() => setRecHideFor(activeTrip!.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect x="1" y="5" width="15" height="14" rx="2" />
                        </svg>
                        <span className="recdot" />
                        RECORDING
                      </span>
                    )}
                    <AmaniFloat ctx={ctx} />
                  </span>
                </div>
              </div>
              <div className="top-actions">
                <button type="button" className="msgbtn" aria-label={tx("Messages — go to inbox")} onClick={() => goTab("messages")}>
                  <span className={dotCls} />
                  MESSAGE
                  {pendingCount > 0 && <span className="mb-count">{pendingCount}</span>}
                </button>
                <button type="button" className="dotsbtn" aria-label={tx("Settings")} title={tx("Settings")} onClick={() => patchUi({ settings: true })}>
                  ⋯
                </button>
              </div>
            </header>
            <main>
              {tab === "today" && <HoyTab ctx={ctx} />}
              {tab === "clients" && <ClientesTab ctx={ctx} />}
              {tab === "reservations" && <ReservasTab ctx={ctx} />}
              {tab === "agenda" && <AgendaTab ctx={ctx} />}
              {tab === "messages" && <MensajesTab ctx={ctx} />}
              {tab === "charges" && <CobrosTab ctx={ctx} />}
              {!crmCloudConfigured() && (
                <p className="mini" style={{ marginTop: 10 }}>
                  {tx("CRM cloud: not configured in this build — records stay on this device.")}
                </p>
              )}
              <p className="foot">{locLineText(ctx)}</p>
            </main>
            <nav className="bottom" aria-label={tx("Sections")}>
              {navBtn("today", tx("TODAY"))}
              {navBtn("clients", tx("CLIENTS"))}
              {navBtn("reservations", tx("BOOKINGS"))}
              {navBtn("agenda", tx("AGENDA"))}
              {navBtn("messages", tx("MESSAGES"), pendingCount)}
              {navBtn("charges", tx("CHARGES"))}
            </nav>
          </>
        )}
      </div>

      {/* Hojas — prioridad del prototipo: el cobro va encima de todo */}
      {ui.clientSel && (
        <div className="sheetwrap">
          <div className="sheet">
            <ClientDetail ctx={ctx} id={ui.clientSel} />
          </div>
        </div>
      )}
      {ui.resSel && (
        <div className="sheetwrap">
          <div className="sheet">
            <ReservationDetail ctx={ctx} id={ui.resSel} />
          </div>
        </div>
      )}
      {ui.msgSel && <MessageDetailSheet ctx={ctx} />}
      {ui.laneSheet && <LaneSheet ctx={ctx} go={(v) => { patchUi({ laneView: v }); goTab("messages") }} />}
      {ui.intake && <IntakeSheet ctx={ctx} />}
      {ui.broadcast && <BroadcastSheet ctx={ctx} />}
      {ui.blockForm && <BlockFormSheet ctx={ctx} />}
      {ui.clientForm && <ClientFormSheet ctx={ctx} />}
      {ui.resForm && <ReservationFormSheet ctx={ctx} />}
      {ui.settings && <SettingsSheet ctx={ctx} />}
      {ui.paySel && <PaySheet ctx={ctx} />}
      {toastState && (
        <div className="crmxtoast show" role="status">
          {toastState.msg}
        </div>
      )}
    </div>
  )
}

export default CRMScreen
