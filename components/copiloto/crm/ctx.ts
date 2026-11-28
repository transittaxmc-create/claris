/**
 * Contrato entre la pantalla raíz del CRM (crm-screen.tsx, dueña de
 * los datos, la nube y el GPS) y las vistas (hoy / clientes / reservas /
 * agenda / mensajes / cobros / ajustes / amani / sheets). Las vistas
 * son puras: reciben este contexto y piden cambios; nunca fusionan ni
 * empujan a la nube por su cuenta.
 */
import type { HeaderPlace } from "@/components/copiloto/geo"
import type { CrmLang } from "./i18n"
import type { Client, CRMMessage, CRMReservation, CrmBlock, CrmGroup, Vehicle } from "./types"

export type GpsState = {
  status: "searching" | "ready" | "off"
  lat: number | null
  lng: number | null
  heading: number | null
  accuracy: number | null
}

export type CrmTab = "today" | "clients" | "reservations" | "agenda" | "messages" | "charges"

export interface UiState {
  car: boolean
  carTripId: string
  clientSel: string | null
  clientForm: string | null // 'new' | id de cliente
  clientFilter: string
  clientQuery: string
  resSel: string | null
  resForm: string | null // 'new' | id de reserva
  resFormClientId: string
  resPrefill: Partial<CRMReservation> | null
  resFromMessage: string // mensaje que originó el formulario ("" = ninguno)
  resQuery: string
  msgSel: string | null
  laneView: "sms" | "wab" | "taxes" | "work" | "quar"
  laneSheet: boolean
  intake: boolean
  broadcast: boolean
  paySel: string | null // id de la reserva en cobro
  calView: "month" | "week" | "day"
  calSel: string // clave de fecha enfocada en la agenda
  blockForm: boolean
  blockEditId: string | null
  settings: boolean
  retTab: CrmTab
}

export const initialUi = (): UiState => ({
  car: false,
  carTripId: "",
  clientSel: null,
  clientForm: null,
  clientFilter: "All",
  clientQuery: "",
  resSel: null,
  resForm: null,
  resFormClientId: "",
  resPrefill: null,
  resFromMessage: "",
  resQuery: "",
  msgSel: null,
  laneView: "sms",
  laneSheet: false,
  intake: false,
  broadcast: false,
  paySel: null,
  calView: "month",
  calSel: "",
  blockForm: false,
  blockEditId: null,
  settings: false,
  retTab: "today",
})

export interface CrmCtx {
  /* datos */
  clients: Client[]
  reservations: CRMReservation[]
  messages: CRMMessage[]
  groups: CrmGroup[]
  blocks: CrmBlock[]
  vehicle: Vehicle
  lang: CrmLang
  setLang: (l: CrmLang) => void
  /* nube / sesión */
  signedIn: boolean
  ownerId: string
  cloudBusy: boolean
  cloudError: string
  messagesPending: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshCloud: () => void
  /* gps */
  gps: GpsState
  place: HeaderPlace | null
  /* navegación interna */
  tab: CrmTab
  goTab: (t: CrmTab) => void
  ui: UiState
  patchUi: (p: Partial<UiState>) => void
  toast: (msg: string) => void
  /* clientes */
  saveClient: (c: Client) => void
  removeClient: (id: string) => void
  assignAccountNumber: (clientId: string) => void
  findClient: (id: string) => Client | undefined
  findOrCreateClient: (name: string, phone: string) => Client | null
  /* reservas */
  saveReservation: (r: CRMReservation) => void
  removeReservation: (id: string) => void
  updateReservation: (id: string, patch: Partial<CRMReservation>) => void
  /* mensajes */
  saveMessage: (m: CRMMessage) => void
  removeMessage: (id: string) => void
  approveMessage: (m: CRMMessage, reply: string) => Promise<boolean>
  queueOutgoing: (partial: Partial<CRMMessage>) => CRMMessage
  ignoredMsgIds: Set<string>
  setMsgIgnored: (id: string, ignored: boolean) => void
  /* grupos / bloques / vehículo */
  saveGroups: (g: CrmGroup[]) => void
  saveBlocks: (b: CrmBlock[]) => void
  saveVehicle: (v: Vehicle) => void
  /* aperturas cruzadas */
  openClient: (id: string, from: CrmTab) => void
  openReservation: (id: string, from: CrmTab) => void
  openMessage: (id: string) => void
  openReservationForm: (opts: { id?: string; clientId?: string; prefill?: Partial<CRMReservation> }) => void
}
