"use client"

/**
 * HOY del CRM nuevo + pantalla CURRENT TRIP (modo en curso).
 * Markup y clases EXACTOS del prototipo aprobado (renderToday /
 * carViewHTML): hero con .state/.who/ol.route/.chips/.locline/.heads,
 * barra de etapas .prog/.proglabels, botón .go, .pair de acciones,
 * .meter con .digits y la cola .queue de próximos. Los recordatorios
 * (mañana y < 2 h) son solo para Miguel — nunca salen al cliente.
 * El flujo de etapas arma la detección de peajes al pasar a EN RUTA
 * (la raíz la alimenta con el GPS en vivo y las tarifas E-ZPass de
 * producción).
 */
import type { CrmCtx } from "./ctx"
import { addDaysKey, fmtClock, money, openRes, parseTimeParts, todayKey } from "./helpers"
import { tx, txText } from "./i18n"
import { NavLogos, PayLogo } from "./logos"
import type { CRMReservation } from "./types"

export function resWhenTs(r: CRMReservation): number {
  const t = parseTimeParts(r.pickupTime)
  const [y, mo, d] = (r.serviceDate || "").split("-").map(Number)
  if (!y) return Number.MAX_SAFE_INTEGER
  return new Date(y, (mo || 1) - 1, d || 1, t ? t.h : 0, t ? t.m : 0).getTime()
}

export const STAGE_FLOW = ["", "enroute", "arrived", "onboard"]
export const STAGE_NAMES: Record<string, string> = { "": "Not started", enroute: "On the way", arrived: "Arrived", onboard: "On board" }
export const stageBtnLabel = (stage: string): string =>
  stage === "" ? "ON THE WAY" : stage === "enroute" ? "ARRIVED" : stage === "arrived" ? "ON BOARD" : "FINISH TRIP"

export function stepsBar(r: CRMReservation) {
  const idx = Math.max(0, STAGE_FLOW.indexOf(r.stage || ""))
  return (
    <>
      <div className="prog" aria-hidden="true">
        {STAGE_FLOW.map((s, i) => (
          <i key={s || "start"} className={i < idx ? "done" : i === idx ? "now" : ""} />
        ))}
      </div>
      <div className="proglabels">
        {STAGE_FLOW.map((s, i) => (
          <small key={s || "start"} className={i < idx ? "done" : i === idx ? "now" : ""}>
            {tx(STAGE_NAMES[s])}
          </small>
        ))}
      </div>
    </>
  )
}

export function gpsChipInner(ctx: CrmCtx) {
  const g = ctx.gps
  const cls = g.status === "ready" ? "gpsdot on" : g.status === "off" ? "gpsdot off" : "gpsdot bad"
  const label = g.status === "ready" ? "GPS READY" : g.status === "off" ? "GPS OFF" : "GPS…"
  return (
    <>
      <span className={cls} /> {tx(label)}
    </>
  )
}

export function locLineText(ctx: CrmCtx): string {
  const p = ctx.place
  if (ctx.gps.status !== "ready") return tx("Waiting for GPS…")
  if (!p) return tx("GPS ready")
  const left = p.neighborhood || p.street || p.city || ""
  return `${p.icon || "📍"} ${left}${p.city && p.street ? ", " + p.city : ""}`.trim()
}

export function HoyTab({ ctx }: { ctx: CrmCtx }) {
  const { reservations, clients } = ctx
  const today = todayKey()
  const tomorrow = addDaysKey(today, 1)
  const current = openRes(reservations)
  const now = Date.now()
  const rems: { r: CRMReservation; when: string }[] = []
  for (const r of reservations) {
    if (r.status === "Completed" || r.status === "Cancelled" || !r.serviceDate) continue
    if (r.serviceDate === tomorrow) rems.push({ r, when: "Tomorrow" })
    else if (r.serviceDate === today && resWhenTs(r) - now > 0 && resWhenTs(r) - now < 2 * 3600e3)
      rems.push({ r, when: "In less than 2 hours" })
  }
  rems.sort((a, b) => resWhenTs(a.r) - resWhenTs(b.r))
  const allToday = reservations.filter((r) => r.serviceDate === today && r.status !== "Cancelled")
  const earned = reservations
    .filter((r) => r.status === "Completed" && r.serviceDate === today)
    .reduce((s, r) => s + (Number(r.fare) || 0) + (Number(r.tolls) || 0), 0)
  const owed = reservations
    .filter((r) => r.status === "Completed" && !r.paid)
    .reduce((s, r) => s + (Number(r.fare) || 0) + (Number(r.tolls) || 0), 0)
  const pastOpen = reservations
    .filter((r) => r.status !== "Completed" && r.status !== "Cancelled" && r.serviceDate && r.serviceDate < today)
    .sort((a, b) => (a.serviceDate || "").localeCompare(b.serviceDate || ""))
  const upcoming = reservations
    .filter((r) => r.status !== "Completed" && r.status !== "Cancelled" && r.serviceDate && resWhenTs(r) >= now - 3 * 3600e3)
    .sort((a, b) => resWhenTs(a) - resWhenTs(b))
    .slice(0, 6)
  const clientOf = (r: CRMReservation) => clients.find((c) => c.id === r.clientId)
  const gps = ctx.gps.lat != null && ctx.gps.lng != null ? { lat: ctx.gps.lat, lng: ctx.gps.lng } : null
  const routeLink = current ? (gps ? `https://www.google.com/maps/dir/?api=1&origin=${gps.lat},${gps.lng}&destination=${encodeURIComponent(current.dropoffAddress || "")}&waypoints=${encodeURIComponent(current.pickupAddress || "")}` : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(current.pickupAddress || "")}&destination=${encodeURIComponent(current.dropoffAddress || "")}`) : ""

  return (
    <>
      {current && (
        <section className="hero" aria-label={tx("Current trip")}>
          <p className="state">
            {tx("Next")} · {current.pickupTime || ""}
          </p>
          <h1 className="who">
            {current.passengerName || clientOf(current)?.name || "—"}
            {clientOf(current)?.vip && (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFC11A" aria-label="VIP">
                <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
              </svg>
            )}
          </h1>
          <ol className="route">
            <li>
              <i>A</i>
              <span>{current.pickupAddress || ""}</span>
            </li>
            {(current.stopAddress || "").trim() && (
              <li>
                <i>•</i>
                <span>{current.stopAddress}</span>
              </li>
            )}
            <li>
              <i>B</i>
              <span>{current.dropoffAddress || ""}</span>
            </li>
          </ol>
          <div className="chips">
            <span className="chip">{gpsChipInner(ctx)}</span>
            <span className="chip">{money(Number(current.fare) || 0)}</span>
            {(Number(current.tolls) || 0) > 0 && <span className="chip">🛣️ {money(current.tolls)}</span>}
            <span className="chip">
              <span style={{ width: 16, height: 16, display: "inline-flex", verticalAlign: "-3px", marginRight: 4 }}>
                <PayLogo method={current.paymentMethod || "Efectivo"} />
              </span>
              {current.paymentMethod || tx("Cash")}
            </span>
          </div>
          <p className="locline">{locLineText(ctx)}</p>
          {current.notes && <p className="heads">{current.notes}</p>}
          {stepsBar(current)}
          <button
            type="button"
            className="go"
            onClick={() => {
              if ((current.stage || "") === "onboard") {
                ctx.patchUi({ paySel: current.id })
                return
              }
              const next = STAGE_FLOW[Math.min(STAGE_FLOW.indexOf(current.stage || "") + 1, STAGE_FLOW.length - 1)]
              const patch: Partial<CRMReservation> = { stage: next, updatedAt: new Date().toISOString() }
              if (next === "enroute") patch.tollHits = []
              ctx.updateReservation(current.id, patch)
              if (next === "enroute") ctx.toast(tx("On the way — toll detection armed (E-ZPass rates)."))
            }}
          >
            {tx(stageBtnLabel(current.stage || ""))}
          </button>
          <div className="pair">
            <a className="sec" href={routeLink} target="_blank" rel="noreferrer">
              {tx("Navigate")}
            </a>
            <a className="sec" href={"tel:" + (clientOf(current)?.phone || current.passengerPhone || "").replace(/[^+\d]/g, "")}>
              {tx("Call")}
            </a>
          </div>
          <button type="button" className="sec" style={{ width: "100%", marginTop: 8, whiteSpace: "nowrap" }} onClick={() => ctx.patchUi({ car: true, carTripId: current.id })}>
            🚗 {tx("CAR MODE — trip screen")}
          </button>
        </section>
      )}

      {rems.length > 0 && (
        <section className="card">
          <h3>{tx("Reminders for you")}</h3>
          {rems.map(({ r, when }) => (
            <p key={r.id} className="kv">
              <b>{r.passengerName || clientOf(r)?.name || "—"}</b> · {txText(when)} · {r.pickupTime} · {r.pickupAddress} → {r.dropoffAddress}
            </p>
          ))}
          <p style={{ fontSize: 11, color: "var(--muted)" }}>{tx("Reminders are only for you — nothing is ever sent to the client.")}</p>
        </section>
      )}

      {pastOpen.length > 0 && (
        <section className="card">
          <h3 style={{ color: "var(--due)" }}>
            {tx("Past reservations still open")} · {pastOpen.length}
          </h3>
          {pastOpen.map((r) => (
            <p key={r.id} className="kv">
              <b>{r.passengerName || clientOf(r)?.name || "—"}</b> · {r.serviceDate} {r.pickupTime || ""} · {tx(r.status)} — {tx("mark it Completed or Cancelled so it is not lost.")}
            </p>
          ))}
        </section>
      )}

      <section className="meter">
        <div>
          <p className="lab">{tx("Earned today")}</p>
          <p className="digits">{money(earned)}</p>
        </div>
        <dl>
          <div>
            <dt>{tx("Trips today")}</dt>
            <dd>{allToday.length}</dd>
          </div>
          <div>
            <dt>{tx("To collect")}</dt>
            <dd>{money(owed)}</dd>
          </div>
        </dl>
      </section>

      <section className="queue">
        <div className="sh">
          <h2>{tx("Upcoming")}</h2>
          <button type="button" className="btn primary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => ctx.openReservationForm({})}>
            + {tx("New reservation")}
          </button>
        </div>
        <div className="list">
          {upcoming.length === 0 && <p className="mini" style={{ padding: "4px 2px" }}>{tx("No upcoming reservations.")}</p>}
          {upcoming.map((r) => (
            <button key={r.id} type="button" className="row" onClick={() => ctx.openReservation(r.id, "today")}>
              <span className="time">
                {r.pickupTime || ""}
                <small>{r.serviceDate}</small>
              </span>
              <span className="rt">
                <b>{r.passengerName || clientOf(r)?.name || "—"}</b>
                <small>
                  {r.pickupAddress || ""} → {r.dropoffAddress || ""}
                </small>
              </span>
              <span className="fare">{money(Number(r.fare) || 0)}</span>
            </button>
          ))}
        </div>
      </section>
      <p className="foot">
        {tx("Messages")} ({ctx.messages.filter((m) => m.status === "pending").length} {tx("pending")}) · {fmtClock(new Date().toISOString())}
      </p>
    </>
  )
}

/** Pantalla CURRENT TRIP: una sola pierna visible, botón de etapa
 *  grande (.cgo), logos de navegación (.navrow) y la ruta completa. */
export function CarView({ ctx }: { ctx: CrmCtx }) {
  const trip =
    ctx.reservations.find((r) => r.id === ctx.ui.carTripId && r.status !== "Completed" && r.status !== "Cancelled") ||
    ctx.reservations.find((r) => (r.stage === "enroute" || r.stage === "arrived" || r.stage === "onboard") && r.status !== "Completed" && r.status !== "Cancelled") ||
    openRes(ctx.reservations)
  const gps = ctx.gps.lat != null && ctx.gps.lng != null ? { lat: ctx.gps.lat, lng: ctx.gps.lng } : null
  if (!trip) {
    return (
      <div className="carview">
        <div className="cartitle">{tx("CURRENT TRIP")}</div>
        <p className="mini" style={{ marginTop: 18 }}>{tx("No active trip.")}</p>
        <button type="button" className="cexit" onClick={() => ctx.patchUi({ car: false })}>
          {tx("EXIT")}
        </button>
      </div>
    )
  }
  const client = ctx.clients.find((c) => c.id === trip.clientId)
  const stage = trip.stage || ""
  const legAddr = stage === "onboard" ? trip.dropoffAddress : trip.pickupAddress
  const total = (Number(trip.fare) || 0) + (Number(trip.tolls) || 0)

  function advance() {
    if (stage === "onboard") {
      ctx.patchUi({ paySel: trip!.id })
      return
    }
    const next = STAGE_FLOW[Math.min(STAGE_FLOW.indexOf(stage) + 1, STAGE_FLOW.length - 1)]
    const patch: Partial<CRMReservation> = { stage: next, updatedAt: new Date().toISOString() }
    if (next === "enroute") patch.tollHits = []
    ctx.updateReservation(trip!.id, patch)
    if (next === "enroute") ctx.toast(tx("On the way — toll detection armed (E-ZPass rates)."))
  }

  return (
    <div className="carview">
      <div className="cartitle">{tx("CURRENT TRIP")}</div>
      <div className="ctime">{trip.pickupTime || ""}</div>
      <div className="cname">{trip.passengerName || client?.name || "—"}</div>
      <div className="croute">
        {trip.pickupAddress || "—"} → {trip.dropoffAddress || "—"}
      </div>
      <div className="cfare">
        {money(total)}
        {(Number(trip.tolls) || 0) > 0 ? ` · 🛣️ ${money(trip.tolls)}` : ""}
      </div>
      {stepsBar(trip)}
      <p className="locline">{locLineText(ctx)}</p>
      <div style={{ maxWidth: 420, margin: "10px auto 0", textAlign: "left" }}>
        <div className="lab">{stage === "onboard" ? tx("DROP-OFF") : tx("PICKUP")}</div>
        <div style={{ fontWeight: 700, fontSize: 17 }}>{legAddr || "—"}</div>
        <NavLogos address={legAddr || ""} gps={gps} />
      </div>
      <button type="button" className="cgo" onClick={advance}>
        {tx(stageBtnLabel(stage))}
      </button>
      <button type="button" className="cexit" onClick={() => ctx.patchUi({ car: false })}>
        {tx("EXIT")}
      </button>
    </div>
  )
}
