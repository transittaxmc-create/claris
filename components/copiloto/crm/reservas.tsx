"use client"

/**
 * RESERVAS del CRM nuevo — puerto de la vista del prototipo con las
 * mejoras del formulario pedidas por Miguel (2026-11-26, en vivo):
 * indicador de campo requerido (punto rojo → verde al llenarse) y
 * SAVE apagado hasta completar; auto-llenado desde el mensaje para
 * solo verificar; dirección verificable (calle + número + ciudad
 * juntos; si no combina, cambia de color) con botón GPS al lado que
 * la enlaza a la ubicación real (geo.ts de producción); parada
 * opcional verificada igual; bloque de aeropuerto SOLO en recogidas
 * de aeropuerto, con el número de vuelo tocable para ver su estado.
 *
 * Precio: panel de tarifa con la fórmula TLC + tabla de rutas +
 * bandas del estudio del 2026-11-28 (lib/crm/fare.ts); si el cliente
 * tiene tarifa preferencial que calza con la ruta, manda ella. El
 * precio se toca y se ajusta (−10/−15/−20 % o cifra escrita).
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { CURRENT_DROPOFF_KEY, CURRENT_PICKUP_KEY, captureLocation } from "@/components/copiloto/geo"
import { calcPrice, routeEst, specialFareMatch, specialFareProp, type FareForm } from "@/lib/crm/fare"
import type { CrmCtx } from "./ctx"
import { appleMapsLink, flightAwareLink, fmtDateTime, googleMapsLink, googleRouteLink, money, todayKey } from "./helpers"
import { STAGE_FLOW, stageBtnLabel, stepsBar } from "./hoy"
import { tx } from "./i18n"
import { NavLogos } from "./logos"
import { CrmPhotosBlock } from "./photos-block"
import { PriceEditPopup, chargeTotal } from "./sheets"
import { CRM_AIRPORTS, PAYMENT_METHODS, RES_STATUSES, emptyReservation, payLabel, type CRMReservation, type ReservationStatus } from "./types"

const resTitle = (ctx: CrmCtx, r: CRMReservation) => r.passengerName || ctx.clients.find((c) => c.id === r.clientId)?.name || "—"

export function ReservasTab({ ctx }: { ctx: CrmCtx }) {
  const q = ctx.ui.resQuery.trim().toLowerCase()
  const today = todayKey()
  const match = (r: CRMReservation) =>
    !q ||
    resTitle(ctx, r).toLowerCase().includes(q) ||
    (r.pickupAddress || "").toLowerCase().includes(q) ||
    (r.dropoffAddress || "").toLowerCase().includes(q)
  const upcoming = ctx.reservations
    .filter((r) => r.status !== "Completed" && r.status !== "Cancelled" && (r.serviceDate || "") >= today && match(r))
    .sort((a, b) => (a.serviceDate + a.pickupTime).localeCompare(b.serviceDate + b.pickupTime))
  const past = ctx.reservations
    .filter((r) => !(r.status !== "Completed" && r.status !== "Cancelled" && (r.serviceDate || "") >= today) && match(r))
    .sort((a, b) => (b.serviceDate + b.pickupTime).localeCompare(a.serviceDate + a.pickupTime))
  const row = (r: CRMReservation) => (
    <button key={r.id} type="button" className="row" onClick={() => ctx.openReservation(r.id, "reservations")}>
      <span className="row-main">
        <span className="row-t">
          {r.serviceDate} · {r.pickupTime} — {resTitle(ctx, r)}
        </span>
        <span className="row-s">
          {r.pickupAddress || "—"} → {r.dropoffAddress || "—"}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <span className="chip">{tx(r.status)}</span>
        {r.status === "Completed" && !r.paid && <span className="stchip st-discarded">{tx("OWES")} {money(chargeTotal(r))}</span>}
        {(Number(r.fare) || 0) > 0 && <span className="row-s">{money(Number(r.fare) || 0)}</span>}
      </span>
    </button>
  )
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="search"
          style={{ flex: 1 }}
          placeholder={tx("Search passenger or address…")}
          value={ctx.ui.resQuery}
          onChange={(e) => ctx.patchUi({ resQuery: e.target.value })}
        />
        <button type="button" className="btn primary" onClick={() => ctx.openReservationForm({})}>
          + {tx("NEW")}
        </button>
      </div>
      <div className="sec-t">{tx("UPCOMING")}</div>
      {upcoming.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("No upcoming reservations.")}</div>}
      {upcoming.map(row)}
      <div className="sec-t">{tx("PAST & COMPLETED")}</div>
      {past.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("Nothing here yet.")}</div>}
      {past.map(row)}
    </>
  )
}

type FlightData = {
  ok?: boolean
  found?: boolean
  status?: string
  progressPercent?: number | null
  departure?: { airport?: string; scheduled?: string; estimated?: string; actual?: string; terminal?: string; gate?: string }
  arrival?: { airport?: string; scheduled?: string; estimated?: string; actual?: string; terminal?: string; gate?: string }
  source?: string
}

export function ReservationDetail({ ctx, id }: { ctx: CrmCtx; id: string }) {
  const r = ctx.reservations.find((x) => x.id === id)
  const [flightBusy, setFlightBusy] = useState(false)
  const [flight, setFlight] = useState<FlightData | null>(null)
  const [flightError, setFlightError] = useState("")
  if (!r) {
    return (
      <>
        <button type="button" className="btn" onClick={() => ctx.patchUi({ resSel: null })}>
          ‹ {tx("Back")}
        </button>
        <div className="mini" style={{ padding: "6px 2px" }}>{tx("This reservation no longer exists.")}</div>
      </>
    )
  }
  const client = ctx.clients.find((c) => c.id === r.clientId)
  const gps = ctx.gps.lat != null && ctx.gps.lng != null ? { lat: ctx.gps.lat, lng: ctx.gps.lng } : null
  const total = chargeTotal(r)
  const closed = r.status === "Completed" || r.status === "Cancelled"

  async function trackFlight() {
    if (!r!.flightNumber.trim()) return
    setFlightBusy(true)
    setFlightError("")
    try {
      const res = await fetch("/api/crm/flights/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flightNumber: r!.flightNumber, flightDate: r!.flightDate || r!.serviceDate }),
      })
      const data = (await res.json().catch(() => ({}))) as FlightData & { error?: string }
      if (!res.ok) throw new Error(data.error || "track failed")
      setFlight(data)
      if (!data.found) setFlightError(tx("No live data for this flight yet — try the FlightAware link."))
    } catch {
      setFlightError(tx("Live tracking is not available right now — try the FlightAware link."))
    } finally {
      setFlightBusy(false)
    }
  }

  function advanceStage() {
    if (r!.stage === "onboard") {
      ctx.patchUi({ paySel: r!.id })
      return
    }
    const next = STAGE_FLOW[Math.min(STAGE_FLOW.indexOf(r!.stage || "") + 1, STAGE_FLOW.length - 1)]
    const patch: Partial<CRMReservation> = { stage: next, updatedAt: new Date().toISOString() }
    if (next === "enroute") patch.tollHits = []
    ctx.updateReservation(r!.id, patch)
    if (next === "enroute") ctx.toast(tx("On the way — toll detection armed (E-ZPass rates)."))
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => ctx.patchUi({ resSel: null })}>
        ‹ {tx("Back")}
      </button>
      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ font: "700 20px var(--cond)" }}>{resTitle(ctx, r)}</div>
        <div className="mini">
          {r.serviceDate} · {r.pickupTime} · {r.passengers} {tx("passengers")}
          {client ? ` · ${client.name}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span className="chip">{tx(r.status)}</span>
          {r.paid ? <span className="stchip st-sent">{tx("PAID")} · {payLabel(r.paymentMethod)}</span> : r.status === "Completed" ? <span className="stchip st-discarded">{tx("OWES")} {money(total)}</span> : null}
          {r.receiptChoice && <span className="chip">{tx("Receipt:")} {tx(r.receiptChoice)}</span>}
        </div>
        {!closed && (
          <>
            {stepsBar(r)}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="btn" onClick={advanceStage}>
                {tx(stageBtnLabel(r.stage || ""))}
              </button>
              <button type="button" className="btn" onClick={() => ctx.patchUi({ car: true, carTripId: r.id })}>
                🚗 {tx("CAR MODE")}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="kv"><span>{tx("Pickup")}</span><b>{r.pickupAddress || "—"}</b></div>
        <NavLogos address={r.pickupAddress || ""} gps={gps} />
        {r.stopAddress && (
          <>
            <div className="kv"><span>{tx("Stop")}</span><b>{r.stopAddress}</b></div>
            <NavLogos address={r.stopAddress} gps={gps} />
          </>
        )}
        <div className="kv"><span>{tx("Drop-off")}</span><b>{r.dropoffAddress || "—"}</b></div>
        <NavLogos address={r.dropoffAddress || ""} gps={gps} />
        <a className="btn" style={{ marginTop: 8, display: "inline-block" }} href={googleRouteLink(r, gps)} target="_blank" rel="noreferrer">
          🗺️ {tx("FULL ROUTE")}
        </a>
        {r.pickupKind === "airport" && (
          <>
            <div className="lab">✈️ {tx("AIRPORT PICKUP")}</div>
            <div className="kv"><span>{tx("Airport")}</span><b>{r.airport || "—"}</b></div>
            <div className="kv"><span>{tx("Airline")}</span><b>{r.airline || "—"}</b></div>
            <div className="kv">
              <span>{tx("Flight")}</span>
              <b>
                {r.flightNumber ? (
                  <button type="button" style={{ background: "none", border: "none", padding: 0, color: "var(--blue)", font: "inherit", cursor: "pointer", textDecoration: "underline" }} onClick={() => void trackFlight()}>
                    {r.flightNumber}
                  </button>
                ) : "—"}
              </b>
            </div>
            <div className="kv"><span>{tx("Scheduled arrival")}</span><b>{r.scheduledArrival || "—"}</b></div>
            <div className="kv"><span>{tx("Terminal / Gate")}</span><b>{[r.terminal, r.gate].filter(Boolean).join(" / ") || "—"}</b></div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn primary" disabled={flightBusy || !r.flightNumber} onClick={() => void trackFlight()}>
                {flightBusy ? tx("Checking…") : tx("TRACK FLIGHT LIVE")}
              </button>
              {r.flightNumber && (
                <a className="btn" href={flightAwareLink(r.flightNumber)} target="_blank" rel="noreferrer">
                  FlightAware ↗
                </a>
              )}
            </div>
            {flightError && <div className="mini" style={{ color: "var(--red)", marginTop: 6 }}>{flightError}</div>}
            {flight?.found && (
              <div style={{ marginTop: 8 }}>
                <div className="kv"><span>{tx("Status")}</span><b>{flight.status || "—"}{flight.progressPercent != null ? ` · ${flight.progressPercent}%` : ""}</b></div>
                <div className="kv"><span>{tx("Departs")}</span><b>{flight.departure?.airport || ""} {fmtDateTime(flight.departure?.estimated || flight.departure?.scheduled || "", "en-US")}</b></div>
                <div className="kv"><span>{tx("Arrives")}</span><b>{flight.arrival?.airport || ""} {fmtDateTime(flight.arrival?.estimated || flight.arrival?.scheduled || "", "en-US")}</b></div>
                <div className="kv"><span>{tx("Terminal / Gate (live)")}</span><b>{[flight.arrival?.terminal, flight.arrival?.gate].filter(Boolean).join(" / ") || "—"}</b></div>
              </div>
            )}
          </>
        )}
        {r.notes && <div className="mini" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{r.notes}</div>}
      </div>

      <div className="card">
        <div className="lab" style={{ marginTop: 0 }}>{tx("FARE & PAYMENT")}</div>
        <div className="kv"><span>{tx("Fare")}</span><b>{money(Number(r.fare) || 0)}</b></div>
        <div className="kv"><span>{tx("Tolls")}</span><b>{money(Number(r.tolls) || 0)}</b></div>
        <div className="kv"><span>{tx("Total")}</span><b>{money(total)}</b></div>
        <div className="kv"><span>{tx("Method")}</span><b>{r.paymentMethod ? payLabel(r.paymentMethod) : "—"}</b></div>
        {r.paid && <div className="kv"><span>{tx("Paid on")}</span><b>{r.paidAt || "—"}{r.payRef ? ` · ${r.payRef}` : ""}</b></div>}
        {r.paymentMethod === "Efectivo" && r.paid && (Number(r.cashTendered) || 0) > 0 && (
          <div className="kv"><span>{tx("Cash / change")}</span><b>{money(r.cashTendered)} / {money(r.cashChange)}</b></div>
        )}
        {!r.paid && (
          <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={() => ctx.patchUi({ paySel: r.id })}>
            {tx("CHARGE")} {money(total)}
          </button>
        )}
      </div>

      <div className="card">
        <div className="lab" style={{ marginTop: 0 }}>{tx("PHOTOS")}</div>
        <CrmPhotosBlock photos={r.photos} kind="reservations" recordId={r.id} userId={ctx.ownerId} onChange={(photos) => ctx.updateReservation(r.id, { photos })} />
      </div>

      <div className="fld">
        <label>{tx("Status")}</label>
        <select value={r.status} onChange={(e) => ctx.updateReservation(r.id, { status: e.target.value as ReservationStatus, updatedAt: new Date().toISOString() })}>
          {RES_STATUSES.map((s) => (
            <option key={s} value={s}>{tx(s)}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn" onClick={() => ctx.openReservationForm({ id: r.id })}>
          {tx("Edit")}
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (window.confirm(tx("Delete this reservation?"))) {
              ctx.removeReservation(r.id)
              ctx.patchUi({ resSel: null })
            }
          }}
        >
          {tx("Delete")}
        </button>
      </div>
      <div className="mini" style={{ marginTop: 8 }}>
        {tx("Maps:")} <a href={googleMapsLink(r.dropoffAddress || "")} target="_blank" rel="noreferrer">Google</a> ·{" "}
        <a href={appleMapsLink(r.dropoffAddress || "")} target="_blank" rel="noreferrer">Apple</a>
      </div>
    </>
  )
}

/* ── Formulario ──────────────────────────────────────────────────── */

const addrOk = (a: string): boolean => {
  const s = (a || "").trim()
  return s.length >= 8 && /\d/.test(s) && /,/.test(s)
}
export function ReservationFormSheet({ ctx }: { ctx: CrmCtx }) {
  const editing = ctx.ui.resForm && ctx.ui.resForm !== "new" ? ctx.reservations.find((r) => r.id === ctx.ui.resForm) : undefined
  const [draft, setDraft] = useState<CRMReservation>(() => {
    if (editing) return { ...editing }
    const base = { ...emptyReservation(), clientId: ctx.ui.resFormClientId || "", ...(ctx.ui.resPrefill || {}) }
    return base
  })
  const [addrFocus, setAddrFocus] = useState<"pickupAddress" | "stopAddress" | "dropoffAddress">("pickupAddress")
  const [priceEdit, setPriceEdit] = useState(false)
  const [gpsNote, setGpsNote] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const fareTouched = useRef(false)
  const set = (p: Partial<CRMReservation>) => setDraft((d) => ({ ...d, ...p }))
  const close = () => ctx.patchUi({ resForm: null, resPrefill: null, resFromMessage: "" })

  const client = ctx.clients.find((c) => c.id === draft.clientId)
  const fareForm: FareForm = {
    pickupKind: draft.pickupKind,
    airport: draft.airport,
    pickupAddress: draft.pickupAddress,
    dropoffAddress: draft.dropoffAddress,
    stopAddress: draft.stopAddress,
    serviceDate: draft.serviceDate,
    pickupTime: draft.pickupTime,
    waitMinutes: draft.waitMinutes,
  }
  const calc = useMemo(
    () => (draft.pickupAddress.trim() && draft.dropoffAddress.trim() ? calcPrice(fareForm) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.pickupAddress, draft.dropoffAddress, draft.pickupKind, draft.airport, draft.stopAddress, draft.serviceDate, draft.pickupTime, draft.waitMinutes],
  )
  const est = calc ? routeEst(calc.za, calc.zb) : null
  const special = calc ? specialFareMatch(client, calc.za, calc.zb) : null
  const prop = calc && !special ? specialFareProp(client, fareForm, calc) : null
  const suggested = special ? special.price : prop ? prop.prop : calc?.total || 0

  useEffect(() => {
    if (!fareTouched.current && suggested > 0) setDraft((d) => (d.fare === suggested ? d : { ...d, fare: suggested }))
  }, [suggested])

  const requiredOk = !!(draft.clientId && draft.serviceDate && draft.pickupTime && draft.pickupAddress.trim() && draft.dropoffAddress.trim())

  async function gpsFor(field: "pickupAddress" | "dropoffAddress") {
    try {
      const p = await captureLocation()
      try { localStorage.setItem(field === "pickupAddress" ? CURRENT_PICKUP_KEY : CURRENT_DROPOFF_KEY, JSON.stringify(p)) } catch {}
      setGpsNote((n) => ({ ...n, [field]: `📍 ${p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`} (±${Math.round(p.accuracy)} m)` }))
      ctx.toast(tx("Location linked."))
    } catch {
      ctx.toast(tx("GPS is not available right now."))
    }
  }

  function fillPlace(addr: string) {
    set({ [addrFocus]: addr } as Partial<CRMReservation>)
  }

  function save() {
    if (!requiredOk) {
      setError(tx("Complete the required fields (green dot) before saving."))
      return
    }
    const out: CRMReservation = { ...draft, updatedAt: new Date().toISOString() }
    ctx.saveReservation(out)
    if (ctx.ui.resFromMessage) {
      const m = ctx.messages.find((x) => x.id === ctx.ui.resFromMessage)
      if (m) ctx.saveMessage({ ...m, reservationId: out.id, updatedAt: new Date().toISOString() })
    }
    close()
    ctx.toast(tx("Reservation saved."))
  }

  const addrField = (
    field: "pickupAddress" | "stopAddress" | "dropoffAddress",
    label: string,
    required: boolean,
    withGps: boolean,
  ) => {
    const val = draft[field]
    const ok = addrOk(val)
    const linked = !!gpsNote[field]
    return (
      <div className="fld">
        <label>{label}</label>
        <div className={"addrwrap" + (linked ? " hasgps" : "")}>
          <input
            className={(val.trim() ? (ok ? "addr-ok" : "addr-warn") : required ? "req-empty" : "") || undefined}
            value={val}
            onFocus={() => setAddrFocus(field)}
            onChange={(e) => set({ [field]: e.target.value } as Partial<CRMReservation>)}
            placeholder={tx("Street + number + city")}
          />
          {withGps && (
            <button type="button" className={"gpsbtn" + (linked ? " on" : "")} onClick={() => void gpsFor(field as "pickupAddress" | "dropoffAddress")}>
              <span className="gpsdot" /> GPS
            </button>
          )}
        </div>
        {val.trim() && !ok && <div className="addr-msg">{tx("Check the address: street + number + city together — if it does not combine, ask the client.")}</div>}
        {gpsNote[field] && <div className="addr-msg ok">{gpsNote[field]}</div>}
      </div>
    )
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{editing ? tx("Edit reservation") : tx("New reservation")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>

        <div className="fld">
          <label>{tx("Client")}</label>
          <select
            className={draft.clientId ? "req-filled" : "req-empty"}
            value={draft.clientId}
            onChange={(e) => {
              const c = ctx.clients.find((x) => x.id === e.target.value)
              set({
                clientId: e.target.value,
                passengerName: draft.passengerName || c?.name || "",
                passengerPhone: draft.passengerPhone || c?.phone || "",
              })
            }}
          >
            <option value="">{tx("Choose a client…")}</option>
            {ctx.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.accountNumber ? ` · ${c.accountNumber}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Passenger")}</label>
            <input value={draft.passengerName} onChange={(e) => set({ passengerName: e.target.value })} />
          </div>
          <div className="fld">
            <label>{tx("Passenger phone")}</label>
            <input inputMode="tel" value={draft.passengerPhone} onChange={(e) => set({ passengerPhone: e.target.value })} />
          </div>
        </div>
        <div className="grid3">
          <div className="fld">
            <label>{tx("Date")}</label>
            <input type="date" className={draft.serviceDate ? "req-filled" : "req-empty"} value={draft.serviceDate} onChange={(e) => set({ serviceDate: e.target.value })} />
          </div>
          <div className="fld">
            <label>{tx("Time")}</label>
            <input className={draft.pickupTime ? "req-filled" : "req-empty"} value={draft.pickupTime} onChange={(e) => set({ pickupTime: e.target.value })} placeholder="10:00 AM" />
          </div>
          <div className="fld">
            <label>{tx("Passengers")}</label>
            <input inputMode="numeric" type="number" min={1} value={draft.passengers} onChange={(e) => set({ passengers: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
        </div>

        {addrField("pickupAddress", tx("Pickup address"), true, true)}
        {addrField("stopAddress", tx("Stop on the way (optional)"), false, false)}
        {addrField("dropoffAddress", tx("Drop-off address"), true, true)}

        <div className="lab">{tx("FREQUENT PLACES — tap to fill the selected address")}</div>
        <div className="placechips">
          {["Penn Station, New York, NY", "JFK Airport, Queens, NY", "LaGuardia Airport, Queens, NY"].map((p) => (
            <button key={p} type="button"  onClick={() => fillPlace(p)}>
              <i />
              {p.split(",")[0]}
            </button>
          ))}
          {client && (
            <>
              {Array.from(new Set(ctx.reservations.filter((r) => r.clientId === client.id).flatMap((r) => [r.pickupAddress, r.dropoffAddress]).filter(Boolean)))
                .slice(0, 5)
                .map((p) => (
                  <button key={p} type="button"  onClick={() => fillPlace(p)}>
                    <i />
                    {p}
                  </button>
                ))}
            </>
          )}
        </div>

        <div className="fld">
          <label>{tx("Pickup type")}</label>
          <select value={draft.pickupKind} onChange={(e) => set({ pickupKind: e.target.value as CRMReservation["pickupKind"] })}>
            <option value="standard">{tx("Standard")}</option>
            <option value="airport">{tx("Airport pickup")}</option>
          </select>
        </div>
        {draft.pickupKind === "airport" && (
          <div className="airportbox">
            <div className="fld">
              <label>{tx("Airport")}</label>
              <select value={draft.airport} onChange={(e) => set({ airport: e.target.value })}>
                <option value="">{tx("Choose…")}</option>
                {CRM_AIRPORTS.map((a) => (
                  <option key={a.code} value={a.code}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="grid2">
              <div className="fld">
                <label>{tx("Airline")}</label>
                <input value={draft.airline} onChange={(e) => set({ airline: e.target.value })} />
              </div>
              <div className="fld">
                <label>{tx("Flight number")}</label>
                <input value={draft.flightNumber} onChange={(e) => set({ flightNumber: e.target.value })} placeholder="AA 1668" />
              </div>
            </div>
            <div className="grid3">
              <div className="fld">
                <label>{tx("Flight date")}</label>
                <input type="date" value={draft.flightDate} onChange={(e) => set({ flightDate: e.target.value })} />
              </div>
              <div className="fld">
                <label>{tx("Scheduled arrival")}</label>
                <input value={draft.scheduledArrival} onChange={(e) => set({ scheduledArrival: e.target.value })} placeholder="9:34 PM" />
              </div>
              <div className="fld">
                <label>{tx("Terminal / Gate")}</label>
                <input value={draft.terminal} onChange={(e) => set({ terminal: e.target.value })} placeholder="T8" />
              </div>
            </div>
          </div>
        )}

        {(draft.pickupAddress.trim() || draft.dropoffAddress.trim()) && (
          <div className="pricepanel">
            {special && calc ? (
              <>
                <div className="pp-head">🎖️ {tx("PREFERENTIAL RATE — THIS CLIENT")}</div>
                <button type="button" className="pp-price" onClick={() => setPriceEdit(true)}>
                  {money(draft.fare)} ✎
                </button>
                <div className="pp-note">
                  {tx("Their rate covers this route:")} {special.seg}
                </div>
                <div className="pp-note">{tx("Standard formula for this route:")} {money(calc.total)}</div>
              </>
            ) : calc && est ? (
              <>
                <div className="pp-head">{tx("SUGGESTED PRICE")} · {tx(calc.band.name)}</div>
                <button type="button" className="pp-price" onClick={() => setPriceEdit(true)}>
                  {money(draft.fare)} ✎
                </button>
                {prop && (
                  <div className="pp-note">
                    🎖️ {tx("Proportional from their")} {prop.anchorLabel} {tx("rate")} ({money(prop.anchorPrice)}): {money(prop.prop)}
                  </div>
                )}
                <div className="pp-note">
                  {tx("Formula:")} {est[0]} mi × $1.283 + {est[1]} mi × $1.757 + {est[2]} min × $0.681 + {est[3]} min × $0.725
                </div>
                <div className="pp-row">
                  <span>{tx("Base (with band)")} </span>
                  <b>{money(calc.adj)}</b>
                </div>
                <div className="pp-row">
                  <span>{tx("Tolls (E-ZPass)")}</span>
                  <b>{money(calc.tolls)}</b>
                </div>
                {(calc.airportFee > 0 || calc.congestion > 0 || calc.stopFee > 0 || calc.waitFee > 0) && (
                  <div className="pp-row">
                    <span>
                      {calc.airportFee > 0 ? tx("Airport fee") + " " + money(calc.airportFee) : ""}
                      {calc.congestion > 0 ? " · " + tx("Congestion") + " " + money(calc.congestion) : ""}
                      {calc.stopFee > 0 ? " · " + tx("Stop") + " " + money(calc.stopFee) : ""}
                      {calc.waitFee > 0 ? " · " + tx("Waiting") + " " + money(calc.waitFee) : ""}
                    </span>
                    <b>{money(calc.airportFee + calc.congestion + calc.stopFee + calc.waitFee)}</b>
                  </div>
                )}
                <div className="pp-note">
                  {tx("Route estimate:")} {calc.mi} mi · {calc.mins} min{calc.minApplied ? " · " + tx("local minimum applied") : ""}
                </div>
              </>
            ) : (
              <div className="pp-note">{tx("Write the pickup and drop-off to compute the price (zone table of the 2026-11-28 study).")}</div>
            )}
          </div>
        )}

        <div className="grid3">
          <div className="fld">
            <label>{tx("Price ($)")}</label>
            <input
              inputMode="decimal"
              value={draft.fare || ""}
              onChange={(e) => {
                fareTouched.current = true
                set({ fare: parseFloat(e.target.value) || 0 })
              }}
            />
          </div>
          <div className="fld">
            <label>{tx("Wait (min)")}</label>
            <input inputMode="numeric" value={draft.waitMinutes} onChange={(e) => set({ waitMinutes: e.target.value })} />
          </div>
          <div className="fld">
            <label>{tx("Status")}</label>
            <select value={draft.status} onChange={(e) => set({ status: e.target.value as ReservationStatus })}>
              {RES_STATUSES.map((s) => (
                <option key={s} value={s}>{tx(s)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Payment method")}</label>
            <select value={draft.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>{payLabel(p)}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>{tx("Paid")}</label>
            <select
              value={draft.paid ? "1" : "0"}
              onChange={(e) => set({ paid: e.target.value === "1", paidAt: e.target.value === "1" && !draft.paidAt ? todayKey() : draft.paidAt })}
            >
              <option value="0">{tx("No")}</option>
              <option value="1">{tx("Yes")}</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label>{tx("Notes")}</label>
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        <div className="fld">
          <label>{tx("PHOTOS")}</label>
          <CrmPhotosBlock photos={draft.photos} kind="reservations" recordId={draft.id} userId={ctx.ownerId} onChange={(photos) => set({ photos })} />
        </div>
        {error && <div className="mini" style={{ color: "var(--red)" }}>{error}</div>}
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={close}>{tx("Cancel")}</button>
          <button type="button" className="btn primary" disabled={!requiredOk} onClick={save}>
            {tx("SAVE")}
          </button>
        </div>
      </div>
      {priceEdit && (
        <PriceEditPopup
          value={Number(draft.fare) || suggested}
          onClose={() => setPriceEdit(false)}
          onApply={(n) => {
            fareTouched.current = true
            set({ fare: n })
          }}
        />
      )}
    </div>
  )
}
