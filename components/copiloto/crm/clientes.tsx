"use client"

/**
 * CLIENTES del CRM nuevo — puerto de la vista del prototipo:
 * una ficha por cliente (nunca una por llamada), número de cuenta
 * ACT-0-### SOLO en la ficha y asignado a mano por Miguel con su
 * botón (regla refinada 2026-11-28: aceptar un mensaje crea la ficha
 * SIN número), VALOR DEL CLIENTE calculado de SUS reservas, tarifa
 * preferencial ("preferential rate" — jamás "trato especial"; el
 * motivo es interno y no sale en ningún mensaje) y lugares frecuentes
 * nacidos de su historial.
 */
import { useMemo, useState } from "react"
import type { CrmCtx } from "./ctx"
import { fmtDateTime, frequentPlaces, initials, money, normalizeAccount } from "./helpers"
import { tx } from "./i18n"
import { NavLogos } from "./logos"
import { CrmPhotosBlock } from "./photos-block"
import { CLIENT_SOURCES, CLIENT_STATUSES, emptyClient, type Client, type ClientStatus } from "./types"

export function clientValue(ctx: CrmCtx, clientId: string): { trips: number; value: number } {
  const rs = ctx.reservations.filter((r) => r.clientId === clientId && r.status === "Completed")
  return { trips: rs.length, value: rs.reduce((s, r) => s + (Number(r.fare) || 0) + (Number(r.tolls) || 0), 0) }
}

const LANE_LABEL: Record<string, string> = { transport: "Transport", taxes: "Taxes", both: "Transport + Taxes" }

export function ClientesTab({ ctx }: { ctx: CrmCtx }) {
  const q = ctx.ui.clientQuery.trim().toLowerCase()
  const f = ctx.ui.clientFilter
  const list = ctx.clients
    .filter((c) => f === "All" || c.status === f)
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.accountNumber || "").toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const counts = (s: string) => (s === "All" ? ctx.clients.length : ctx.clients.filter((c) => c.status === s).length)
  const gps = ctx.gps.lat != null && ctx.gps.lng != null ? { lat: ctx.gps.lat, lng: ctx.gps.lng } : null
  void gps
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <div className="searchbar" style={{ flex: 1 }}>
          <input
            placeholder={tx("Search name, phone or account…")}
            value={ctx.ui.clientQuery}
            onChange={(e) => ctx.patchUi({ clientQuery: e.target.value })}
          />
        </div>
        <button type="button" className="btn primary" onClick={() => ctx.patchUi({ clientForm: "new" })}>
          + {tx("NEW")}
        </button>
      </div>
      <div className="fchips">
        {["All", ...CLIENT_STATUSES].map((s) => (
          <button key={s} type="button" className={f === s ? "on" : ""} onClick={() => ctx.patchUi({ clientFilter: s })}>
            {tx(s)} · {counts(s)}
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("No clients match.")}</div>}
      {list.map((c) => {
        const v = clientValue(ctx, c.id)
        return (
          <button key={c.id} type="button" className="row" onClick={() => ctx.patchUi({ clientSel: c.id, retTab: "clients" })}>
            <span className="avatar">{initials(c.name)}</span>
            <span className="row-main">
              <span className="row-t">
                {c.name}
                {c.vip ? " ⭐" : ""}
              </span>
              <span className="row-s">
                {c.accountNumber || tx("No account number")} · {c.phone || "—"}
              </span>
              <span className="row-s">
                {tx("Client value")} {money(v.value)} · {v.trips} {tx("trips")}
              </span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <span className={"stchip st-" + c.status}>{tx(c.status)}</span>
              <span className="chip">{tx(LANE_LABEL[c.laneLabel] || "Transport")}</span>
            </span>
          </button>
        )
      })}
    </>
  )
}

export function ClientDetail({ ctx, id }: { ctx: CrmCtx; id: string }) {
  const c = ctx.clients.find((x) => x.id === id)
  if (!c) {
    return (
      <>
        <button type="button" className="btn" onClick={() => ctx.patchUi({ clientSel: null })}>
          ‹ {tx("Back")}
        </button>
        <div className="mini" style={{ padding: "6px 2px" }}>{tx("This client no longer exists.")}</div>
      </>
    )
  }
  const v = clientValue(ctx, c.id)
  const places = frequentPlaces(ctx.reservations, c.id)
  const res = ctx.reservations
    .filter((r) => r.clientId === c.id)
    .sort((a, b) => (b.serviceDate || "").localeCompare(a.serviceDate || ""))
  const msgs = ctx.messages
    .filter((m) => m.clientId === c.id)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
  const gps = ctx.gps.lat != null && ctx.gps.lng != null ? { lat: ctx.gps.lat, lng: ctx.gps.lng } : null
  const telHref = "tel:" + (c.phone || "").replace(/[^+\d]/g, "")
  const waHref = "https://wa.me/" + (c.phone || "").replace(/\D/g, "")

  return (
    <>
      <button type="button" className="btn" onClick={() => ctx.patchUi({ clientSel: null })}>
        ‹ {tx("Clients")}
      </button>
      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 19 }}>{initials(c.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 20px var(--cond)", letterSpacing: ".02em" }}>
              {c.name}
              {c.vip ? " ⭐" : ""}
            </div>
            <div className="mini">
              {tx("Client value")} <b>{money(v.value)}</b> · {v.trips} {tx("trips")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {c.accountNumber ? (
            <span className="chip">{c.accountNumber}</span>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => ctx.assignAccountNumber(c.id)}>
                {tx("Assign account number")}
              </button>
              <span className="mini" style={{ alignSelf: "center" }}>
                {tx("No account number yet — it is assigned only when you tap the button (a phone number must be on file).")}
              </span>
            </>
          )}
          <span className="chip">{tx(LANE_LABEL[c.laneLabel] || "Transport")}</span>
          {c.vip && <span className="chip">⭐ VIP</span>}
        </div>
        <div className="fld">
          <label>{tx("Status")}</label>
          <select
            value={c.status}
            onChange={(e) => ctx.saveClient({ ...c, status: e.target.value as ClientStatus })}
          >
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>{tx(s)}</option>
            ))}
          </select>
        </div>
        {c.company && <div className="kv"><span>{tx("Company")}</span><b>{c.company}</b></div>}
        {c.phone && (
          <div className="kv">
            <span>{tx("Phone")}</span>
            <b>
              <a href={telHref}>{c.phone}</a>{" "}
              <a href={waHref} target="_blank" rel="noreferrer">· WhatsApp</a>
            </b>
          </div>
        )}
        {c.email && <div className="kv"><span>{tx("Email")}</span><b>{c.email}</b></div>}
        {c.address && (
          <>
            <div className="kv"><span>{tx("Home address")}</span><b>{c.address}</b></div>
            <NavLogos address={c.address} gps={gps} />
          </>
        )}
        {c.source && <div className="kv"><span>{tx("Source")}</span><b>{tx(c.source)}</b></div>}
        {c.nextContact && <div className="kv"><span>{tx("Next contact")}</span><b>{c.nextContact}</b></div>}
        {c.notes && <div className="mini" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{c.notes}</div>}
      </div>

      <div className="card">
        <div className="lab" style={{ marginTop: 0 }}>🎖️ {tx("PREFERENTIAL RATE")}</div>
        {c.specialFare ? (
          <>
            <div style={{ font: "700 17px var(--cond)" }}>{c.specialFare}</div>
            {c.fareReason && <div className="mini" style={{ marginTop: 2 }}>{tx("Internal reason:")} {c.fareReason}</div>}
            <div className="mini" style={{ marginTop: 4 }}>
              {tx("This client's quotes use this rate. The reason never appears in messages to the client.")}
            </div>
          </>
        ) : (
          <div className="mini">{tx("No preferential rate — quotes use the standard formula + market.")}</div>
        )}
      </div>

      {places.length > 0 && (
        <div className="card">
          <div className="lab" style={{ marginTop: 0 }}>{tx("FREQUENT PLACES")}</div>
          <div className="placechips">
            {places.map((p) => (
              <button key={p} type="button" onClick={() => ctx.openReservationForm({ clientId: c.id, prefill: { pickupAddress: p } })}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="lab" style={{ marginTop: 0 }}>{tx("PHOTOS")}</div>
        <CrmPhotosBlock photos={c.photos} kind="clients" recordId={c.id} userId={ctx.ownerId} onChange={(photos) => ctx.saveClient({ ...c, photos })} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn primary" onClick={() => ctx.openReservationForm({ clientId: c.id })}>
          + {tx("NEW RESERVATION")}
        </button>
        <button type="button" className="btn" onClick={() => ctx.patchUi({ clientForm: c.id })}>
          {tx("Edit")}
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (window.confirm(tx("Delete this client file? Their reservations and messages stay, unlinked."))) {
              ctx.removeClient(c.id)
              ctx.patchUi({ clientSel: null })
            }
          }}
        >
          {tx("Delete")}
        </button>
      </div>

      <p className="lab" style={{ margin: "16px 0 6px", fontSize: 13 }}>{tx("RESERVATIONS")}</p>
      {res.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("No reservations yet.")}</div>}
      {res.map((r) => (
        <button key={r.id} type="button" className="row" onClick={() => ctx.openReservation(r.id, "clients")}>
          <span className="row-main">
            <span className="row-t">{r.serviceDate} · {r.pickupTime}</span>
            <span className="row-s">{r.pickupAddress || "—"} → {r.dropoffAddress || "—"}</span>
          </span>
          <span className="chip">{tx(r.status)}</span>
        </button>
      ))}

      <p className="lab" style={{ margin: "16px 0 6px", fontSize: 13 }}>{tx("MESSAGE HISTORY")}</p>
      {msgs.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("No messages yet.")}</div>}
      {msgs.map((m) => (
        <button key={m.id} type="button" className="row" onClick={() => ctx.openMessage(m.id)}>
          <span className="row-main">
            <span className="row-t">{m.direction === "outbound" ? "→ " : ""}{(m.body || "").slice(0, 70) || "—"}</span>
            <span className="row-s">{fmtDateTime(m.createdAt, ctx.lang === "es" ? "es-ES" : "en-US")} · {tx(m.status)}</span>
          </span>
          {m.needsFollowUp && <span className="flagchip">📌</span>}
        </button>
      ))}
    </>
  )
}

/** Formulario de cliente (hoja): sale sin guardar con X/Cancel. */
export function ClientFormSheet({ ctx }: { ctx: CrmCtx }) {
  const editing = ctx.ui.clientForm && ctx.ui.clientForm !== "new" ? ctx.clients.find((c) => c.id === ctx.ui.clientForm) : undefined
  const [draft, setDraft] = useState<Client>(() => (editing ? { ...editing } : emptyClient()))
  const [error, setError] = useState("")
  const set = (p: Partial<Client>) => setDraft((d) => ({ ...d, ...p }))
  const close = () => ctx.patchUi({ clientForm: null })

  function save() {
    if (!draft.name.trim()) {
      setError(tx("The name is required."))
      return
    }
    const acct = normalizeAccount(draft.accountNumber)
    if (acct && ctx.clients.some((c) => c.id !== draft.id && normalizeAccount(c.accountNumber) === acct)) {
      setError(tx("That account number is already used by another client."))
      return
    }
    ctx.saveClient({ ...draft, name: draft.name.trim(), accountNumber: acct })
    close()
    ctx.toast(tx("Client saved."))
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{editing ? tx("Edit client") : tx("New client")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>
        <div className="fld">
          <label>{tx("Name")} *</label>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Phone")}</label>
            <input inputMode="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
          </div>
          <div className="fld">
            <label>{tx("Email")}</label>
            <input type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
          </div>
        </div>
        <div className="fld">
          <label>{tx("Company")}</label>
          <input value={draft.company} onChange={(e) => set({ company: e.target.value })} />
        </div>
        <div className="fld">
          <label>{tx("Home address")}</label>
          <input value={draft.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Status")}</label>
            <select value={draft.status} onChange={(e) => set({ status: e.target.value as ClientStatus })}>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>{tx(s)}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>{tx("Source")}</label>
            <select value={draft.source} onChange={(e) => set({ source: e.target.value })}>
              {CLIENT_SOURCES.map((s) => (
                <option key={s} value={s}>{tx(s)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Group (lane)")}</label>
            <select value={draft.laneLabel} onChange={(e) => set({ laneLabel: e.target.value as Client["laneLabel"] })}>
              <option value="transport">{tx("Transport")}</option>
              <option value="taxes">{tx("Taxes")}</option>
              <option value="both">{tx("Transport + Taxes")}</option>
            </select>
          </div>
          <div className="fld">
            <label>{tx("Account number (optional)")}</label>
            <input value={draft.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="ACT-0-###" />
          </div>
        </div>
        <div className="mini">{tx("Leave it empty: the number is assigned from the client file, with its button, when the client becomes recurring.")}</div>
        <div className="fld">
          <label>🎖️ {tx("Preferential rate (e.g. $90 Manhattan / $55 JFK)")}</label>
          <input value={draft.specialFare} onChange={(e) => set({ specialFare: e.target.value })} />
        </div>
        <div className="fld">
          <label>{tx("Reason (internal — never sent to the client)")}</label>
          <input value={draft.fareReason} onChange={(e) => set({ fareReason: e.target.value })} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Next contact")}</label>
            <input type="date" value={draft.nextContact} onChange={(e) => set({ nextContact: e.target.value })} />
          </div>
          <div className="fld">
            <label>⭐ VIP</label>
            <select value={draft.vip ? "1" : "0"} onChange={(e) => set({ vip: e.target.value === "1" })}>
              <option value="0">{tx("No")}</option>
              <option value="1">{tx("Yes")}</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label>{tx("Notes")}</label>
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        {error && <div className="mini" style={{ color: "var(--red)" }}>{error}</div>}
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={close}>{tx("Cancel")}</button>
          <button type="button" className="btn primary" onClick={save}>{tx("SAVE")}</button>
        </div>
      </div>
    </div>
  )
}

export function useClientName(ctx: CrmCtx) {
  return useMemo(() => {
    const map = new Map(ctx.clients.map((c) => [c.id, c.name]))
    return (id: string) => map.get(id) || "—"
  }, [ctx.clients])
}
