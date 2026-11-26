/**
 * Mapeos entre los tipos de la pantalla CRM y las filas de las tablas
 * public.crm_clients / public.crm_reservations del Supabase exclusivo
 * del CRM (migración 20261126024701). Sin lógica de red: solo formas.
 * El user_id NUNCA viaja en estos objetos: lo pone el servidor desde la
 * sesión autenticada.
 */

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
  createdAt: string
  updatedAt: string
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
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  }
}
