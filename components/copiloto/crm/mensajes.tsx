"use client"

/**
 * MENSAJES del CRM nuevo — puerto de la bandeja del prototipo
 * (spec §5): barra de carriles SMS 40% / WhatsApp Business 40% /
 * ⋯ 20% (Impuestos, Grupos de trabajo, Cuarentena — con punto
 * amarillo si un carril escondido tiene pendientes), chip de entrega
 * en su PROPIA línea y siempre honesto (SMS: SENT FROM YOUR PHONE —
 * DELIVERY NOT CONFIRMED; DELIVERED/READ solo con acuse real del
 * canal), borrador editable que al editarse DES-aprueba, y nada sale
 * sin la aprobación de Miguel (la aprobación encola en el outbox;
 * el despacho real lo hace Amani desde su teléfono).
 *
 * La fusión nube↔local NO vive aquí: la raíz es la única dueña y su
 * regla es que ningún mensaje desaparece por un remonte — borrar
 * solo ocurre con el botón Delete de esta vista, explícito.
 */
import { useEffect, useMemo, useState } from "react"
import { isConversationMsg, laneShortLabel, msgViewKey, type LaneViewKey } from "@/lib/crm/classify-inbound"
import { parseMessageForReservation } from "@/lib/crm/parse-message"
import type { CrmCtx } from "./ctx"
import { fmtClock, fmtDateTime, phoneKey } from "./helpers"
import { tx } from "./i18n"
import { emptyMessage, type CRMMessage } from "./types"

export function deliveryChip(m: CRMMessage): { text: string; cls: string } | null {
  // Etiquetas y clases del prototipo (stchip): SMS solo pinta
  // DELIVERED con el reporte real de la operadora (deliveredAt);
  // WhatsApp Business pinta READ/DELIVERED solo con acuses reales de
  // la API; el WhatsApp personal nunca pinta delivered en el CRM.
  if (m.sendState === "failed") return { text: "SEND FAILED", cls: "st-discarded" }
  if (m.status === "sent") {
    if (m.lane === "wa_business_transport") {
      if (m.readAt) return { text: "READ", cls: "st-sent" }
      if (m.deliveredAt) return { text: "DELIVERED", cls: "st-sent" }
      return { text: "SENT VIA WHATSAPP — DELIVERY NOT CONFIRMED YET", cls: "st-approved" }
    }
    if (m.lane === "sms_transport" && m.deliveredAt) return { text: "DELIVERED — CARRIER REPORT", cls: "st-sent" }
    return { text: "SENT FROM YOUR PHONE — DELIVERY NOT CONFIRMED", cls: "st-sent" }
  }
  if (m.status === "approved") {
    if (m.sendState === "sending") return { text: "SENDING FROM YOUR PHONE…", cls: "st-approved" }
    return { text: "IN OUTBOX — NOT SENT YET", cls: "st-approved" }
  }
  return null
}

export function pendingByView(ctx: CrmCtx): Record<LaneViewKey, number> {
  const out: Record<LaneViewKey, number> = { sms: 0, wab: 0, taxes: 0, work: 0, quar: 0 }
  for (const m of ctx.messages) {
    if (m.status !== "pending" || !isConversationMsg(m)) continue
    const k = msgViewKey(m)
    if (k) out[k]++
  }
  return out
}
export const totalPending = (ctx: CrmCtx): number =>
  Object.values(pendingByView(ctx)).reduce((s, n) => s + n, 0)

export function MensajesTab({ ctx }: { ctx: CrmCtx }) {
  const view = ctx.ui.laneView
  const setView = (v: LaneViewKey) => ctx.patchUi({ laneView: v })
  const counts = useMemo(() => pendingByView(ctx), [ctx])
  const hiddenPending = counts.taxes + counts.work + counts.quar > 0
  const list = ctx.messages
    .filter((m) => isConversationMsg(m) && msgViewKey(m) === view)
    .sort((a, b) => {
      const pa = a.status === "pending" ? 0 : 1
      const pb = b.status === "pending" ? 0 : 1
      if (pa !== pb) return pa - pb
      return pa === 0 ? (a.createdAt || "").localeCompare(b.createdAt || "") : (b.createdAt || "").localeCompare(a.createdAt || "")
    })
  const clientName = (m: CRMMessage) =>
    ctx.clients.find((c) => c.id === m.clientId)?.name || m.fromName || m.chatName || "—"

  const laneBtn = (key: LaneViewKey, label: string) => (
    <button key={key} type="button" className={"laneseg" + (view === key ? " on" : "")} onClick={() => setView(key)}>
      {label}
      {counts[key] > 0 && <span className="lanecount new">{counts[key]}</span>}
    </button>
  )

  return (
    <>
      <div className="lanepills">
        {laneBtn("sms", "SMS")}
        {laneBtn("wab", "WhatsApp Business")}
        <button type="button" className="lanemore" onClick={() => ctx.patchUi({ laneSheet: true })} aria-label={tx("More lanes")}>
          ⋯{hiddenPending && <span className="lanedot" />}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button type="button" className="btn" onClick={() => ctx.patchUi({ intake: true })}>
          + {tx("LOG MESSAGE")}
        </button>
        {view === "taxes" && (
          <button type="button" className="btn" onClick={() => ctx.patchUi({ broadcast: true })}>
            📣 {tx("BROADCAST")}
          </button>
        )}
        <span className="mini" style={{ alignSelf: "center" }}>
          {tx(laneShortLabel({ lane: view === "sms" ? "sms_transport" : view === "wab" ? "wa_business_transport" : "wa_personal", fn: view === "taxes" ? "taxes" : view === "work" ? "work_groups" : view === "quar" ? "" : "transport" }))}
        </span>
      </div>
      {list.length === 0 && <div className="empty">{tx("No messages in this lane.")}</div>}
      {list.map((m) => {
        const chip = deliveryChip(m)
        return (
          <div key={m.id}>
            <button type="button" className="row msgrow" onClick={() => ctx.openMessage(m.id)}>
              <span className="rt">
                <b>
                  {m.direction === "outbound" ? "→ " : ""}
                  {clientName(m)}
                </b>
                <small>{(m.body || "").slice(0, 90) || "—"}</small>
              </span>
              <span className="time">
                {fmtClock(m.createdAt)}
                {m.refCode ? <small>{m.refCode}</small> : null}
              </span>
              <span className="msgst">
                <span className={"stchip st-" + m.status}>{tx(m.status.toUpperCase())}</span>
              </span>
              {m.needsFollowUp && (
                <span className="flagrow">
                  <span className="flagchip">⚑ {tx("FOLLOW-UP")}</span>
                </span>
              )}
              {chip && (
                <span className="dlvrow">
                  <span className={"stchip " + chip.cls + " dlvchip"}>{tx(chip.text)}</span>
                </span>
              )}
            </button>
            {view === "quar" && m.chatId && (
              <div style={{ display: "flex", gap: 6, padding: "0 2px 10px" }}>
                <button type="button" className="btn" onClick={() => labelGroup(ctx, m, "taxes")}>
                  → {tx("TAXES")}
                </button>
                <button type="button" className="btn" onClick={() => labelGroup(ctx, m, "work_groups")}>
                  → {tx("WORK GROUPS")}
                </button>
              </div>
            )}
          </div>
        )
      })}
      {ctx.messagesPending && (
        <div className="mini" style={{ color: "var(--red)", marginTop: 8 }}>
          {tx("Messages could not load from the cloud yet — the rest of the CRM is fine.")}
        </div>
      )}
    </>
  )
}

function labelGroup(ctx: CrmCtx, m: CRMMessage, fn: "taxes" | "work_groups") {
  const groups = [...ctx.groups]
  if (m.chatId && !groups.some((g) => g.groupId === m.chatId)) {
    groups.push({ groupId: m.chatId, fn, labelledBy: "miguel", labelledAt: new Date().toISOString(), subjectSnapshot: m.chatName || m.fromName || "" })
    ctx.saveGroups(groups)
  }
  ctx.saveMessage({ ...m, fn, updatedAt: new Date().toISOString() })
  ctx.toast(tx("Group labeled. From now on it lands in its lane on its own."))
}

/** Hoja ⋯: los carriles que no caben en la barra. */
export function LaneSheet({ ctx, go }: { ctx: CrmCtx; go: (v: LaneViewKey) => void }) {
  const counts = pendingByView(ctx)
  const item = (key: LaneViewKey, label: string, desc: string) => (
    <button
      type="button"
      className="row"
      onClick={() => {
        go(key)
        ctx.patchUi({ laneSheet: false })
      }}
    >
      <span className="row-main">
        <span className="row-t">{label}</span>
        <span className="row-s">{desc}</span>
      </span>
      {counts[key] > 0 && <span className="lanecount new">{counts[key]}</span>}
    </button>
  )
  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{tx("More lanes")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={() => ctx.patchUi({ laneSheet: false })}>✕</button>
        </div>
        {item("taxes", "💰 " + tx("Taxes"), tx("Tax clients from the second WhatsApp — never mixed with transport."))}
        {item("work", "👥 " + tx("Work groups"), tx("Job-offer groups, labeled by you."))}
        {item("quar", "❔ " + tx("Quarantine"), tx("Unknown groups — label each one once and it files itself from then on."))}
      </div>
    </div>
  )
}

/** Detalle de mensaje (hoja fija con acciones pegajosas). */
export function MessageDetailSheet({ ctx }: { ctx: CrmCtx }) {
  const m = ctx.messages.find((x) => x.id === ctx.ui.msgSel)
  const [draft, setDraft] = useState("")
  useEffect(() => {
    setDraft(m?.draftReply || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.ui.msgSel])
  if (!m) return null
  const client = ctx.clients.find((c) => c.id === m.clientId)
  const chip = deliveryChip(m)
  const thread = ctx.messages
    .filter(
      (x) =>
        x.id !== m.id &&
        isConversationMsg(x) &&
        ((m.clientId && x.clientId === m.clientId) || (m.fromPhone && x.fromPhone && phoneKey(x.fromPhone) === phoneKey(m.fromPhone))) &&
        x.lane === m.lane,
    )
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
    .slice(-8)
  const close = () => ctx.patchUi({ msgSel: null })
  const draftDirty = draft !== (m.draftReply || "")

  function createReservation() {
    const parsed = parseMessageForReservation(m!.body || "", new Date())
    const c = client || ctx.findOrCreateClient(m!.fromName, m!.fromPhone)
    ctx.openReservationForm({
      clientId: c?.id || m!.clientId,
      prefill: {
        passengerName: m!.fromName || c?.name || "",
        passengerPhone: m!.fromPhone || c?.phone || "",
        ...(parsed as Partial<import("./types").CRMReservation>),
      },
    })
    ctx.patchUi({ resFromMessage: m!.id })
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{client?.name || m.fromName || m.chatName || tx("Message")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="chip">{tx(laneShortLabel(m))}</span>
          {m.refCode && <span className="chip">{m.refCode}</span>}
          {m.needsFollowUp && <span className="flagchip">⚑ {tx("FOLLOW-UP")}</span>}
          <span className="mini" style={{ alignSelf: "center" }}>{fmtDateTime(m.createdAt, ctx.lang === "es" ? "es-ES" : "en-US")}</span>
        </div>

        <div>
          {thread.map((x) => (
            <div key={x.id} className={"am-msg" + (x.direction === "outbound" ? " me" : " am")}>
              <div className="am-bub">
                {x.body}
                <div className="mini">{fmtClock(x.createdAt)}</div>
              </div>
            </div>
          ))}
          <div className={"am-msg" + (m.direction === "outbound" ? " me" : " am")}>
            <div className="am-bub">
              {m.body}
              <div className="mini">{fmtClock(m.createdAt)}</div>
            </div>
          </div>
        </div>
        {chip && (
          <div>
            <span className={"stchip " + chip.cls}>{tx(chip.text)}</span>
            {m.sendError && <div className="mini" style={{ color: "var(--red)" }}>{m.sendError}</div>}
          </div>
        )}

        {m.direction !== "outbound" && (
          <>
            <div className="fld">
            <label>{tx("SUGGESTED REPLY — edit it right on the text")}</label>
            <textarea
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={tx("Write the reply…")}
            />
            </div>
            {m.status === "approved" && draftDirty && (
              <div className="mini" style={{ color: "#B97A0F" }}>
                {tx("You edited the approved text: approving again queues the NEW text.")}
              </div>
            )}
          </>
        )}

        <div className="msg-actions">
          {!client && m.direction !== "outbound" && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const c = ctx.findOrCreateClient(m.fromName, m.fromPhone)
                if (c) {
                  ctx.saveMessage({ ...m, clientId: c.id, updatedAt: new Date().toISOString() })
                  ctx.toast(tx("Client file created — with NO account number. You assign it from the file when the client becomes recurring."))
                }
              }}
            >
              {tx("Create client file")}
            </button>
          )}
          {client && (
            <button type="button" className="btn" onClick={() => ctx.openClient(client.id, "messages")}>
              {tx("Open client")}
            </button>
          )}
          {m.direction !== "outbound" && (
            <button type="button" className="btn" onClick={createReservation}>
              {tx("Create reservation")}
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => ctx.saveMessage({ ...m, needsFollowUp: !m.needsFollowUp, updatedAt: new Date().toISOString() })}
          >
            📌 {m.needsFollowUp ? tx("Unmark follow-up") : tx("Mark follow-up")}
          </button>
          {m.fn === "" && m.chatId && (
            <>
              <button type="button" className="btn" onClick={() => labelGroup(ctx, m, "taxes")}>→ {tx("TAXES")}</button>
              <button type="button" className="btn" onClick={() => labelGroup(ctx, m, "work_groups")}>→ {tx("WORK")}</button>
            </>
          )}
        </div>

        <div className="sheet-actions sticky">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (window.confirm(tx("Delete this message here AND in the cloud? This is the only way messages are deleted."))) {
                ctx.removeMessage(m.id)
                close()
              }
            }}
          >
            {tx("Delete")}
          </button>
          {m.direction !== "outbound" && m.status === "pending" && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                ctx.saveMessage({ ...m, status: "discarded", updatedAt: new Date().toISOString() })
                ctx.setMsgIgnored(m.id, true)
                close()
              }}
            >
              {tx("Ignore")}
            </button>
          )}
          {m.direction !== "outbound" &&
            (m.status === "approved" && !draftDirty ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  ctx.saveMessage({ ...m, status: "pending", sendState: "", approvedReply: "", updatedAt: new Date().toISOString() })
                }}
              >
                {tx("RETURN TO PENDING")}
              </button>
            ) : m.status !== "sent" ? (
              <button
                type="button"
                className="btn primary"
                disabled={!draft.trim()}
                onClick={() => {
                  void ctx.approveMessage(m, draft.trim())
                }}
              >
                {tx("APPROVE & QUEUE")}
              </button>
            ) : null)}
        </div>
      </div>
    </div>
  )
}

/** Registro manual de un mensaje (intake): SMS/WhatsApp que Miguel
 *  anota a mano, incluida la llamada perdida con su seguimiento. */
export function IntakeSheet({ ctx }: { ctx: CrmCtx }) {
  const [lane, setLane] = useState("sms_transport")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [body, setBody] = useState("")
  const [missed, setMissed] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupFn, setGroupFn] = useState("")
  const close = () => ctx.patchUi({ intake: false })

  function save() {
    const isGroup = lane === "wa_personal" && groupName.trim().length > 0
    const chatId = isGroup ? "manual-" + groupName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""
    let groups = ctx.groups
    if (isGroup && groupFn && !groups.some((g) => g.groupId === chatId)) {
      groups = [...groups, { groupId: chatId, fn: groupFn, labelledBy: "miguel", labelledAt: new Date().toISOString(), subjectSnapshot: groupName.trim() }]
      ctx.saveGroups(groups)
    }
    const c = phone.trim() || name.trim() ? ctx.findOrCreateClient(name, phone) : null
    const fn = lane === "sms_transport" || lane === "wa_business_transport" ? "transport" : isGroup ? groupFn : "taxes"
    const msg: CRMMessage = {
      ...emptyMessage(),
      clientId: c?.id || "",
      channel: lane === "sms_transport" ? "SMS" : "WhatsApp",
      lane,
      fn,
      fromName: name.trim(),
      fromPhone: phone.trim(),
      body: body.trim() || (missed ? tx("Missed call") : ""),
      chatId,
      chatName: isGroup ? groupName.trim() : "",
      needsFollowUp: missed,
      draftReply: missed
        ? "Hello " + (name.trim().split(" ")[0] || "") + ", this is Miguel from Island City Transit. I received your call and I will call you back shortly. Thank you!"
        : "",
    }
    ctx.saveMessage(msg)
    close()
    ctx.toast(tx("Message logged in its lane."))
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{tx("Log message")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>
        <div className="fld">
          <label>{tx("Lane")}</label>
          <select value={lane} onChange={(e) => setLane(e.target.value)}>
            <option value="sms_transport">SMS</option>
            <option value="wa_business_transport">WhatsApp Business</option>
            <option value="wa_personal">{tx("Personal WhatsApp (taxes / groups)")}</option>
          </select>
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld">
            <label>{tx("Phone")}</label>
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        {lane === "wa_personal" && (
          <div className="grid2">
            <div className="fld">
              <label>{tx("Group name (if it is a group)")}</label>
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="E.g.: NYC Jobs — drivers" />
            </div>
            <div className="fld">
              <label>{tx("Group function")}</label>
              <select value={groupFn} onChange={(e) => setGroupFn(e.target.value)}>
                <option value="">{tx("Decide later (quarantine)")}</option>
                <option value="taxes">{tx("Taxes")}</option>
                <option value="work_groups">{tx("Work groups")}</option>
              </select>
            </div>
          </div>
        )}
        <div className="fld">
          <label>{tx("Message")}</label>
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={missed} onChange={(e) => setMissed(e.target.checked)} />
          {tx("It was a missed call — draft the call-back follow-up")}
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={close}>{tx("Cancel")}</button>
          <button type="button" className="btn primary" onClick={save}>{tx("SAVE")}</button>
        </div>
      </div>
    </div>
  )
}

/** Broadcast de impuestos: UNA aprobación de Miguel = una fila
 *  saliente encolada por cliente del grupo (con su campaignRef);
 *  nunca se mezcla con transporte. */
export function BroadcastSheet({ ctx }: { ctx: CrmCtx }) {
  const [audience, setAudience] = useState<"taxes" | "both">("taxes")
  const [text, setText] = useState("")
  const targets = ctx.clients.filter((c) => c.laneLabel === "taxes" || (audience === "both" && c.laneLabel === "both"))
  const close = () => ctx.patchUi({ broadcast: false })

  function send() {
    if (!text.trim() || targets.length === 0) return
    if (!window.confirm(tx("Queue this message for") + " " + targets.length + " " + tx("tax clients? Each one enters the outbox as its own approved message."))) return
    const ref = "camp-" + Date.now().toString(36)
    for (const c of targets) {
      ctx.queueOutgoing({
        clientId: c.id,
        channel: "WhatsApp",
        lane: "wa_personal",
        fn: "taxes",
        campaignRef: ref,
        fromName: "Island City Transit",
        fromPhone: c.phone,
        body: text.trim(),
        draftReply: "",
      })
    }
    close()
    ctx.toast(tx("Broadcast queued:") + " " + targets.length)
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>📣 {tx("Taxes broadcast")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>
        <div className="fld">
          <label>{tx("Audience")}</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as "taxes" | "both")}>
            <option value="taxes">{tx("Taxes only")}</option>
            <option value="both">{tx("Taxes + clients in both groups")}</option>
          </select>
        </div>
        <div className="fld">
          <label>{tx("Message")}</label>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={tx("E.g.: Tax season is open — book your appointment…")} />
        </div>
        <div className="mini">
          {targets.length} {tx("clients will receive it, each as their own queued message. Nothing sends without the outbox.")}
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={close}>{tx("Cancel")}</button>
          <button type="button" className="btn primary" disabled={!text.trim() || targets.length === 0} onClick={send}>
            {tx("QUEUE BROADCAST")}
          </button>
        </div>
      </div>
    </div>
  )
}
