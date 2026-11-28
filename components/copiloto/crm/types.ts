/**
 * Tipos del CRM nuevo (diseño del prototipo dentro de Claris).
 *
 * La base de cada tipo es EXACTAMENTE la forma de producción
 * (lib/crm/crm-cloud.ts: CrmClientLike / CrmReservationLike /
 * CrmMessageLike) — las claves localStorage claris_crm_* guardan la
 * misma forma y entry-screen.tsx (HOY) sigue leyendo
 * claris_crm_messages_v1 como siempre.
 *
 * Los campos marcados EXTRA son los del prototipo (spec §2.3): viven
 * solo en el dispositivo por ahora — las tablas de la nube no los
 * tienen y los mapeos de crm-cloud.ts no los transportan. La fusión
 * segura (lib/crm/merge.ts → preserveExtras) los re-engancha tras cada
 * pull para que no se pierdan. La migración que les da casa en la nube
 * va en supabase/migrations/20261128143000_crm_lanes_and_payments.sql
 * (la pega Miguel en el SQL Editor; la app funciona sin ella).
 */
import type { CrmPhoto } from "@/lib/crm/crm-cloud"
import { deriveLane } from "@/lib/crm/classify-inbound"

export type { CrmPhoto }

export type ClientStatus = "Lead" | "Active" | "Follow-up" | "Inactive"

export type Client = {
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
  // EXTRA (prototipo, solo dispositivo)
  address: string
  specialFare: string
  fareReason: string
  vip: boolean
  laneLabel: "transport" | "taxes" | "both"
}

export const CLIENT_EXTRA_FIELDS = ["address", "specialFare", "fareReason", "vip", "laneLabel"] as const

export type ReservationStatus = "Requested" | "Confirmed" | "Completed" | "Cancelled"
export type PickupKind = "standard" | "airport"

export type CRMReservation = {
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
  // EXTRA (prototipo, solo dispositivo)
  stage: string // '' → enroute → arrived → onboard (flujo de viaje)
  tolls: number
  tollHits: string[]
  fare: number
  waitMinutes: string
  paymentMethod: string
  paid: boolean
  paidAt: string // fecha de COBRO (clave de fecha) — la usa la gráfica de 7 días de CHARGES
  payRef: string
  payVia: string
  receiptChoice: string
  cashTendered: number
  cashChange: number
}

export const RESERVATION_EXTRA_FIELDS = [
  "stage", "tolls", "tollHits", "fare", "waitMinutes", "paymentMethod",
  "paid", "paidAt", "payRef", "payVia", "receiptChoice", "cashTendered", "cashChange",
] as const

export type MessageStatus = "pending" | "approved" | "sent" | "discarded"

export type CRMMessage = {
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
  sendState: string
  sendError: string
  sendVia: string
  dispatchedAt: string
  createdAt: string
  updatedAt: string
  // EXTRA (prototipo / spec §2.3, solo dispositivo)
  lane: string
  fn: string
  direction: string
  extId: string
  extSource: string
  chatId: string
  chatName: string
  refCode: string
  approvedReply: string
  deliveredAt: string
  readAt: string
  campaignRef: string
}

export const MESSAGE_EXTRA_FIELDS = [
  "lane", "fn", "direction", "extId", "extSource", "chatId", "chatName",
  "refCode", "approvedReply", "deliveredAt", "readAt", "campaignRef",
] as const

export type CrmGroup = {
  groupId: string
  fn: string
  labelledBy: string
  labelledAt: string
  subjectSnapshot: string
}

export type CrmBlock = {
  id: string
  date: string
  start: string
  end: string
  kind: string // 'Compañía' | 'Uber' | 'Lyft' | 'Otra plataforma' | 'Personal' | 'nodisp' (Fuera de servicio)
  note: string
}

export const emptyBlock = (): CrmBlock => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
  date: "",
  start: "09:00",
  end: "17:00",
  kind: "Personal",
  note: "",
})

export type Vehicle = {
  driver: string
  vehicle: string
  make: string
  model: string
  year: string
  color: string
  photo: string
  plate: string
  zelle: string
  zellePhone: string
  venmo: string
  venmoPhone: string
  cashapp: string
  cashappPhone: string
}

/** Datos de cobro precargados = DEMO claramente ficticios (dominio
 *  .example y rango telefónico reservado 555-0100): Miguel pone los
 *  suyos en Settings → Payment info y quedan guardados. La placa sí es
 *  la suya (T147936C, la que él fijó). */
export const VEHICLE_DEFAULTS: Vehicle = {
  driver: "Miguel",
  vehicle: "",
  make: "",
  model: "",
  year: "",
  color: "",
  photo: "",
  plate: "T147936C",
  zelle: "demo@islandcity.example",
  zellePhone: "(555) 010-1234",
  venmo: "@IslandCityDemo",
  venmoPhone: "(555) 010-1234",
  cashapp: "$IslandCityDemo",
  cashappPhone: "(555) 010-1234",
}

/** Marcas/modelos/colores del formulario del vehículo — las listas
 *  EXACTAS del prototipo aprobado (menús desplegables; "Other" en
 *  Model abre el campo de escritura libre). */
export const VEHICLE_MODELS: Record<string, string[]> = {
  Toyota: ["Grand Highlander", "Highlander", "RAV4", "Camry", "Corolla", "Sienna", "Sequoia", "Land Cruiser", "Tacoma", "Tundra", "Other"],
  BMW: ["X3", "X5", "X7", "3 Series", "5 Series", "7 Series", "Other"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "GLS", "Other"],
  Ford: ["Explorer", "Expedition", "Escape", "Edge", "F-150", "Other"],
  Chevrolet: ["Tahoe", "Suburban", "Equinox", "Traverse", "Silverado", "Other"],
  Honda: ["Pilot", "CR-V", "Odyssey", "Accord", "Other"],
  Nissan: ["Armada", "Pathfinder", "Rogue", "Altima", "Other"],
  Jeep: ["Grand Cherokee", "Wagoneer", "Wrangler", "Compass", "Other"],
  Ram: ["1500", "2500", "ProMaster", "Other"],
  Tesla: ["Model 3", "Model Y", "Model X", "Model S", "Other"],
  Other: ["Other"],
}
export const VEHICLE_MAKES = Object.keys(VEHICLE_MODELS)
export const VEHICLE_COLORS = ["Black", "White", "Silver", "Gray", "Cement", "Red", "Blue", "Dark Blue", "Green", "Brown", "Beige", "Gold", "Other"]

/** Foto visible del vehículo: la suya si subió una; si no, la foto de
 *  prensa SOLO cuando el vehículo guardado es el Toyota Grand
 *  Highlander 2025 (regla del prototipo). En Claris la foto de prensa
 *  vive como asset (public/vehicle-grand-highlander.svg — el patrón
 *  del repo para imágenes vía el conector de GitHub). */
export function vehiclePhotoSrc(v: Vehicle): string {
  if (v.photo) return v.photo
  if (v.make === "Toyota" && v.model === "Grand Highlander" && String(v.year) === "2025") return "/vehicle-grand-highlander.svg"
  return ""
}

export const CLIENT_SOURCES = ["Referral", "Website", "Social media", "Returning client", "Walk-in", "Other"]
export const CLIENT_STATUSES: ClientStatus[] = ["Lead", "Active", "Follow-up", "Inactive"]
export const RES_STATUSES: ReservationStatus[] = ["Requested", "Confirmed", "Completed", "Cancelled"]

/** Lista ÚNICA de métodos de pago en ESTE orden FINAL (Miguel,
 *  2026-11-28 — Cuenta va de último): formulario de reserva, pantalla
 *  de cobro e historial/CHARGES leen TODOS de aquí. */
export const PAYMENT_METHODS = ["Efectivo", "Zelle", "Venmo", "Cash App", "Square", "Cuenta"]
const PAY_LABEL_EN: Record<string, string> = {
  Efectivo: "Cash", Zelle: "Zelle", Venmo: "Venmo", "Cash App": "Cash App", Square: "Square", Cuenta: "On account",
}
export const payLabel = (p: string) => PAY_LABEL_EN[p] || p

export const CRM_AIRPORTS = [
  { code: "JFK", label: "JFK — John F. Kennedy International, NY" },
  { code: "LGA", label: "LGA — LaGuardia, NY" },
  { code: "EWR", label: "EWR — Newark Liberty, NJ" },
  { code: "ISP", label: "ISP — Long Island MacArthur, NY" },
  { code: "BDL", label: "BDL — Bradley International, CT" },
  { code: "HVN", label: "HVN — Tweed New Haven, CT" },
  { code: "HPN", label: "HPN — Westchester County, NY (nearby)" },
]

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)

export const emptyClient = (): Client => ({
  id: uid(), name: "", company: "", phone: "", email: "", status: "Lead", source: "Referral",
  notes: "", nextContact: "", accountNumber: "", photos: [], createdAt: new Date().toISOString(),
  address: "", specialFare: "", fareReason: "", vip: false, laneLabel: "transport",
})

export function normalizeClient(raw: Partial<Client> & { id: string }): Client {
  return {
    ...emptyClient(),
    ...raw,
    accountNumber: typeof raw.accountNumber === "string" ? raw.accountNumber : "",
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    address: typeof raw.address === "string" ? raw.address : "",
    specialFare: typeof raw.specialFare === "string" ? raw.specialFare : "",
    fareReason: typeof raw.fareReason === "string" ? raw.fareReason : "",
    vip: !!raw.vip,
    laneLabel: raw.laneLabel === "taxes" || raw.laneLabel === "both" ? raw.laneLabel : "transport",
  }
}

export const emptyReservation = (): CRMReservation => ({
  id: uid(), clientId: "", passengerName: "", passengerPhone: "",
  serviceDate: "", pickupTime: "", passengers: 1, status: "Requested", pickupKind: "standard",
  pickupAddress: "", stopAddress: "", dropoffAddress: "", airport: "", airline: "",
  flightNumber: "", flightDate: "", scheduledArrival: "", terminal: "", gate: "",
  notes: "", photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  stage: "", tolls: 0, tollHits: [], fare: 0, waitMinutes: "", paymentMethod: "", paid: false,
  paidAt: "", payRef: "", payVia: "", receiptChoice: "", cashTendered: 0, cashChange: 0,
})

export function normalizeReservation(raw: Partial<CRMReservation> & { id: string }): CRMReservation {
  return {
    ...emptyReservation(),
    ...raw,
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    tollHits: Array.isArray(raw.tollHits) ? raw.tollHits : [],
    passengers: Math.max(1, Number(raw.passengers) || 1),
  }
}

export const emptyMessage = (): CRMMessage => ({
  id: uid(), clientId: "", reservationId: "", channel: "SMS", fromName: "", fromPhone: "",
  body: "", draftReply: "", status: "pending", approvedAt: "", sentAt: "", needsFollowUp: false,
  sendState: "", sendError: "", sendVia: "", dispatchedAt: "",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  lane: "sms_transport", fn: "transport", direction: "inbound", extId: "", extSource: "",
  chatId: "", chatName: "", refCode: "", approvedReply: "", deliveredAt: "", readAt: "", campaignRef: "",
})

export function normalizeMessage(raw: Partial<CRMMessage> & { id: string }): CRMMessage {
  const base: CRMMessage = {
    ...emptyMessage(),
    ...raw,
    needsFollowUp: !!raw.needsFollowUp,
    sendState: typeof raw.sendState === "string" ? raw.sendState : "",
    sendError: typeof raw.sendError === "string" ? raw.sendError : "",
    sendVia: typeof raw.sendVia === "string" ? raw.sendVia : "",
    dispatchedAt: typeof raw.dispatchedAt === "string" ? raw.dispatchedAt : "",
    direction: typeof raw.direction === "string" && raw.direction ? raw.direction : "inbound",
  }
  // Fila anterior a los carriles: se deriva UNA vez (spec §2.4). Una
  // fila que YA trae lane conserva su fn tal cual, incluido ''.
  if (typeof raw.lane !== "string" || raw.lane === "") {
    const d = deriveLane(base)
    base.lane = d.lane
    base.fn = d.fn
  }
  return base
}
