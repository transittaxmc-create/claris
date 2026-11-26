/**
 * Mapeos entre los tipos de la pantalla CRM y las filas de las tablas
 * public.crm_clients / public.crm_reservations del Supabase exclusivo
 * del CRM (migración 20261126024701). Sin lógica de red: solo formas.
 * El user_id NUNCA viaja en estos objetos: lo pone el servidor desde la
 * sesión autenticada.
 */

/**
 * Foto adjunta a un cliente o a una reserva (la que manda el cliente de su
 * recogida o de su vuelo). Los metadatos viajan con el récord; los bytes
 * viven en el bucket privado `crm-client-photos` del Supabase del CRM
 * (path = "<user_id>/<clients|reservations>/<record_id>/<id>.jpg") y en la
 * caché local del dispositivo. path = "" → la foto aún solo existe local.
 */
export type CrmPhoto = {
  id: string
  path: string
  caption: string
  createdAt: string
}

export type CrmClientRow = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  status: string
  source: string
  notes: string
  next_contact: string | null
  account_number?: string
  photos?: CrmPhoto[]
  created_at: string
  updated_at?: string
}

export type CrmReservationRow = {
  id: string
  client_id: string | null
  passenger_name: string
  passenger_phone: string
  service_date: string
  pickup_time: string
  passengers: number
  status: string
  pickup_kind: string
  pickup_address: string
  dropoff_address: string
  airport: string
  airline: string
  flight_number: string
  flight_date: string | null
  scheduled_arrival: string
  terminal: string
  gate: string
  notes: string
  photos?: CrmPhoto[]
  created_at: string
  updated_at: string
}

export type CrmClientLike = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  status: string
  source: string
  notes: string
  nextContact: string
  accountNumber: string
  photos: CrmPhoto[]
  createdAt: string
}

export type CrmReservationLike = {
  id: string
  clientId: string
  passengerName: string
  passengerPhone: string
  serviceDate: string
  pickupTime: string
  passengers: number
  status: string
  pickupKind: string
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
  photos: CrmPhoto[]
  createdAt: string
  updatedAt: string
}

/**
 * Número de cuenta del cliente: UNA cuenta por cliente y por dueño.
 * Formato: ICT-0001, ICT-0002, … secuencial. Se asigna al crear el récord
 * y nunca cambia; un cliente existente jamás recibe un segundo número.
 */
export const ACCOUNT_PREFIX = "ICT"

export function formatAccountNumber(n: number): string {
  return `${ACCOUNT_PREFIX}-${String(Math.max(1, Math.floor(n) || 1)).padStart(4, "0")}`
}

export function nextAccountNumber(existing: Array<{ accountNumber?: string }>): string {
  let max = 0
  for (const c of existing) {
    const m = /^ICT-(\d+)$/.exec((c.accountNumber || "").trim())
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0)
  }
  return formatAccountNumber(max + 1)
}

/** Devuelve la lista con número asignado a todo cliente que no tenga uno
 *  (en orden de creación, sin tocar los que ya tienen). No muta la entrada. */
export function ensureAccountNumbers<T extends { accountNumber?: string; createdAt: string }>(clients: T[]): T[] {
  const used = new Set(clients.map((c) => (c.accountNumber || "").trim()).filter(Boolean))
  let next = 1
  const bump = () => {
    while (used.has(formatAccountNumber(next))) next++
    const value = formatAccountNumber(next)
    used.add(value)
    next++
    return value
  }
  const sorted = [...clients].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const assigned = new Map<string, string>()
  for (const c of sorted) {
    if (!(c.accountNumber || "").trim()) assigned.set((c as unknown as { id: string }).id, bump())
  }
  if (!assigned.size) return clients
  return clients.map((c) => {
    const id = (c as unknown as { id: string }).id
    return assigned.has(id) ? { ...c, accountNumber: assigned.get(id) } : c
  })
}

function cleanPhotos(value: unknown): CrmPhoto[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((p): p is CrmPhoto => !!p && typeof p === "object" && typeof (p as CrmPhoto).id === "string")
    .map((p) => ({ id: p.id, path: typeof p.path === "string" ? p.path : "", caption: typeof p.caption === "string" ? p.caption : "", createdAt: typeof p.createdAt === "string" ? p.createdAt : "" }))
}

export function clientToRow(c: CrmClientLike): CrmClientRow {
  return {
    id: c.id,
    name: c.name,
    company: c.company || "",
    phone: c.phone || "",
    email: c.email || "",
    status: c.status,
    source: c.source || "Referral",
    notes: c.notes || "",
    next_contact: c.nextContact ? c.nextContact : null,
    account_number: c.accountNumber || "",
    photos: cleanPhotos(c.photos),
    created_at: c.createdAt || new Date().toISOString(),
  }
}

export function rowToClient(r: CrmClientRow): CrmClientLike {
  return {
    id: r.id,
    name: r.name || "",
    company: r.company || "",
    phone: r.phone || "",
    email: r.email || "",
    status: r.status || "Lead",
    source: r.source || "Referral",
    notes: r.notes || "",
    nextContact: r.next_contact || "",
    // Filas anteriores a la migración 20261126120000 no traen estas claves:
    accountNumber: r.account_number || "",
    photos: cleanPhotos(r.photos),
    createdAt: r.created_at || new Date().toISOString(),
  }
}

export function reservationToRow(r: CrmReservationLike): CrmReservationRow {
  return {
    id: r.id,
    client_id: r.clientId ? r.clientId : null,
    passenger_name: r.passengerName || "",
    passenger_phone: r.passengerPhone || "",
    service_date: r.serviceDate || new Date().toLocaleDateString("en-CA"),
    pickup_time: r.pickupTime || "",
    passengers: r.passengers || 1,
    status: r.status,
    pickup_kind: r.pickupKind,
    pickup_address: r.pickupAddress || "",
    dropoff_address: r.dropoffAddress || "",
    airport: r.airport || "",
    airline: r.airline || "",
    flight_number: r.flightNumber || "",
    flight_date: r.flightDate ? r.flightDate : null,
    scheduled_arrival: r.scheduledArrival || "",
    terminal: r.terminal || "",
    gate: r.gate || "",
    notes: r.notes || "",
    photos: cleanPhotos(r.photos),
    created_at: r.createdAt || new Date().toISOString(),
    updated_at: r.updatedAt || new Date().toISOString(),
  }
}

export function rowToReservation(r: CrmReservationRow): CrmReservationLike {
  return {
    id: r.id,
    clientId: r.client_id || "",
    passengerName: r.passenger_name || "",
    passengerPhone: r.passenger_phone || "",
    serviceDate: r.service_date || "",
    pickupTime: r.pickup_time || "",
    passengers: r.passengers || 1,
    status: r.status || "Requested",
    pickupKind: r.pickup_kind || "standard",
    pickupAddress: r.pickup_address || "",
    dropoffAddress: r.dropoff_address || "",
    airport: r.airport || "",
    airline: r.airline || "",
    flightNumber: r.flight_number || "",
    flightDate: r.flight_date || "",
    scheduledArrival: r.scheduled_arrival || "",
    terminal: r.terminal || "",
    gate: r.gate || "",
    notes: r.notes || "",
    photos: cleanPhotos(r.photos),
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  }
}

/**
 * Bandeja de mensajes "Approve & Send" (tabla public.crm_messages).
 * La app NO envía mensajes a clientes: guarda el texto entrante, el
 * borrador editable y el estado de aprobación de Miguel. "approved" =
 * Miguel aprobó el texto; "sent" = alguien registró que el envío real ya
 * ocurrió por el canal aprobado fuera de la app.
 */
export type CrmMessageRow = {
  id: string
  client_id: string | null
  reservation_id: string | null
  channel: string
  from_name: string
  from_phone: string
  body: string
  draft_reply: string
  status: string
  approved_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type CrmMessageLike = {
  id: string
  clientId: string
  reservationId: string
  channel: string
  fromName: string
  fromPhone: string
  body: string
  draftReply: string
  status: string
  approvedAt: string
  sentAt: string
  createdAt: string
  updatedAt: string
}

export function messageToRow(m: CrmMessageLike): CrmMessageRow {
  return {
    id: m.id,
    client_id: m.clientId ? m.clientId : null,
    reservation_id: m.reservationId ? m.reservationId : null,
    channel: m.channel || "SMS",
    from_name: m.fromName || "",
    from_phone: m.fromPhone || "",
    body: m.body || "",
    draft_reply: m.draftReply || "",
    status: m.status || "pending",
    approved_at: m.approvedAt ? m.approvedAt : null,
    sent_at: m.sentAt ? m.sentAt : null,
    created_at: m.createdAt || new Date().toISOString(),
    updated_at: m.updatedAt || new Date().toISOString(),
  }
}

export function rowToMessage(r: CrmMessageRow): CrmMessageLike {
  return {
    id: r.id,
    clientId: r.client_id || "",
    reservationId: r.reservation_id || "",
    channel: r.channel || "SMS",
    fromName: r.from_name || "",
    fromPhone: r.from_phone || "",
    body: r.body || "",
    draftReply: r.draft_reply || "",
    status: r.status || "pending",
    approvedAt: r.approved_at || "",
    sentAt: r.sent_at || "",
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  }
}
