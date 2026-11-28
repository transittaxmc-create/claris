/**
 * Carriles de mensajes y clasificación de entrada — puerto de la spec §5
 * del prototipo (classifyInbound / msgViewKey / laneShortLabel), como
 * funciones puras de lib/crm/.
 *
 * Clasificador DETERMINISTA: decide por metadatos de enrutamiento
 * (carril, si es grupo, el grupo registrado), NUNCA por el contenido del
 * mensaje. Grupo registrado manda; grupo desconocido → cuarentena
 * (fn ''); DM 1:1 del WhatsApp personal → impuestos, visible sin ficha
 * automática; SMS y WhatsApp Business son siempre transporte.
 *
 * Uso en esta integración (2026-11-28): la pantalla lo usa para los
 * mensajes que Miguel registra a mano ("+ Log message") y para derivar
 * el carril visible de cada mensaje de la bandeja. La ruta
 * /api/crm/incoming NO se toca en este despliegue (su trigger de dueño
 * exacto quedó verificado por Miguel hoy); llamarla desde ahí es el
 * paso siguiente, con la migración de carriles aplicada.
 */

export type CrmLane = "sms_transport" | "wa_business_transport" | "wa_personal"
export type CrmFn = "transport" | "taxes" | "work_groups" | ""
export type LaneViewKey = "sms" | "wab" | "taxes" | "work" | "quar"

export type CrmGroupLike = {
  groupId: string
  fn: string
  labelledBy?: string
  labelledAt?: string
  subjectSnapshot?: string
}

export const LANE_VIEWS: { key: LaneViewKey; label: string; lane: CrmLane; fn?: CrmFn }[] = [
  { key: "sms", label: "SMS", lane: "sms_transport" },
  { key: "wab", label: "WhatsApp Business", lane: "wa_business_transport" },
  { key: "taxes", label: "Impuestos", lane: "wa_personal", fn: "taxes" },
  { key: "work", label: "Grupos de trabajo", lane: "wa_personal", fn: "work_groups" },
  { key: "quar", label: "Cuarentena", lane: "wa_personal", fn: "" },
]

export type InboundLike = {
  lane?: string
  isGroup?: boolean
  chatId?: string
}

/** La función (fn) de un mensaje entrante del WhatsApp personal.
 *  SMS y WhatsApp Business no pasan por aquí: son 'transport' siempre. */
export function classifyInbound(o: InboundLike, groups: readonly CrmGroupLike[]): CrmFn {
  if (o.lane === "sms_transport" || o.lane === "wa_business_transport") return "transport"
  if (o.isGroup) {
    const g = groups.find((x) => x.groupId === o.chatId)
    return (g?.fn as CrmFn) || ""
  }
  return "taxes"
}

export type LaneMessageLike = {
  lane?: string
  fn?: string
  channel?: string
  direction?: string
}

/** Carril derivado para filas que aún no traen lane (histórico anterior
 *  a los carriles, spec §2.4): WhatsApp → Business; todo lo demás → SMS.
 *  Una fila que YA trae lane conserva su fn tal cual, incluido ''. */
export function deriveLane(m: LaneMessageLike): { lane: CrmLane; fn: CrmFn } {
  if (typeof m.lane === "string" && m.lane !== "") {
    return { lane: m.lane as CrmLane, fn: (typeof m.fn === "string" ? m.fn : "") as CrmFn }
  }
  const lane: CrmLane = m.channel === "WhatsApp" ? "wa_business_transport" : "sms_transport"
  return { lane, fn: "transport" }
}

/** ¿Es un mensaje de conversación? Las filas salientes de campaña
 *  (broadcasts) no viven en las bandejas de conversación. */
export function isConversationMsg(m: LaneMessageLike): boolean {
  return (m.direction || "inbound") !== "outbound"
}

/** La vista (pestaña de carril) a la que pertenece un mensaje. */
export function msgViewKey(m: LaneMessageLike): LaneViewKey | null {
  if (!isConversationMsg(m)) return null
  const { lane, fn } = deriveLane(m)
  if (lane === "sms_transport") return "sms"
  if (lane === "wa_business_transport") return "wab"
  if (fn === "work_groups") return "work"
  if (fn === "") return "quar"
  return "taxes"
}

export function laneShortLabel(m: LaneMessageLike): string {
  const { lane, fn } = deriveLane(m)
  if (lane === "wa_business_transport") return "WhatsApp Business · Transporte"
  if (lane === "wa_personal") {
    return fn === "work_groups"
      ? "WhatsApp personal · Trabajo"
      : fn === ""
        ? "WhatsApp personal · Sin etiquetar"
        : "WhatsApp personal · Impuestos"
  }
  return "SMS · Transporte"
}
