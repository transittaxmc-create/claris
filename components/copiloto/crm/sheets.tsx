"use client"

/**
 * Hoja de COBRO del CRM nuevo (fondo navy, .sheet.pay) + popups de
 * método + elección de recibo + editor de precio. Markup del
 * prototipo aprobado (renderPaySheet y sus popups): monto en .digits,
 * métodos en .seg.wrap con SOLO el símbolo, popup de apps estilo
 * .zpop/.zcard con la spec de Gemini (2026-11-28) — logo, "Send
 * payment to", QR con borde dorado (Zelle = solo el ID; Venmo/Cash
 * App = enlace con monto), SEND BY TEXT enseña el texto exacto antes
 * de encolarlo y COPY PAYMENT INFO.
 *
 * Square [PC-SQ1/2/3]: el cobro real abre la app de Square con Miguel
 * conectado (él entra una sola vez y teclea el código del Terminal);
 * el token vive solo en el servidor. Hasta ese paso — que se hace con
 * Miguel presente — el popup marca el PUNTO DE CONEXIÓN y simula el
 * regreso aprobado; ningún cargo real sale de aquí todavía.
 *
 * Estado PAGADO (flujo de Miguel, 2026-11-28 10:15 EST): al pasar el
 * pago, la hoja muestra PAGADO con la referencia y la pregunta del
 * recibo (impreso / texto / email / ninguno), guardada como
 * receiptChoice. Nada se envía sin aprobación: SEND BY TEXT y el
 * recibo por texto crean mensajes en la cola aprobada (outbox).
 */
import { useMemo, useState } from "react"
import { qrSvgPath } from "@/lib/crm/qr"
import type { CrmCtx } from "./ctx"
import { money, payIdOf, payInfoText, payPhoneOf, payQrPayload, paySendText, roundMoney, todayKey, zelleSendText } from "./helpers"
import { tx } from "./i18n"
import { PayLogo } from "./logos"
import { PAYMENT_METHODS, payLabel, type CRMReservation } from "./types"

export function QrSvg({ text, size = 180 }: { text: string; size?: number }) {
  const qr = useMemo(() => qrSvgPath(text), [text])
  if (!qr) return <div className="mini">{tx("The payment link is too long for a QR — use SEND BY TEXT or COPY.")}</div>
  return (
    <svg width={size} height={size} viewBox={`0 0 ${qr.total} ${qr.total}`} role="img" aria-label="QR" style={{ background: "#fff", borderRadius: 8 }}>
      <rect width={qr.total} height={qr.total} fill="#fff" />
      <path d={qr.d} fill="#0D1B2E" />
    </svg>
  )
}

/** Editor de precio: el precio calculado se toca y se ajusta
 *  (−10/−15/−20 % o cifra escrita) — decisión de Miguel tras el
 *  estudio de mercado: él elige el precio final. */
export function PriceEditPopup({
  value,
  onApply,
  onClose,
}: {
  value: number
  onApply: (n: number) => void
  onClose: () => void
}) {
  const [text, setText] = useState(String(value || ""))
  const cur = parseFloat(text) || 0
  return (
    <div className="sheetwrap" style={{ zIndex: 90 }}>
      <div className="sheet">
        <div className="sheet-h">
          <b>{tx("Adjust price")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={onClose}>✕</button>
        </div>
        <div className="fld">
          <label>{tx("Price ($)")}</label>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="fchips">
          {[-10, -15, -20].map((p) => (
            <button key={p} type="button" onClick={() => setText(String(roundMoney((value || 0) * (1 + p / 100))))}>
              {p}% {tx("off")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn primary"
          style={{ marginTop: 6, height: 48, borderRadius: 8, width: "100%" }}
          onClick={() => {
            if (cur > 0) onApply(roundMoney(cur))
            onClose()
          }}
        >
          {tx("APPLY PRICE")}
        </button>
        <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={onClose}>
          {tx("Cancel")}
        </button>
      </div>
    </div>
  )
}

function waitFeeOf(r: CRMReservation): number {
  const wait = Number(r.waitMinutes) || 0
  const grace = r.pickupKind === "airport" ? 30 : 15
  return Math.max(0, wait - grace) * 1
}
export const chargeTotal = (r: CRMReservation): number =>
  roundMoney((Number(r.fare) || 0) + (Number(r.tolls) || 0) + waitFeeOf(r))

const RECEIPT_LABEL: Record<string, string> = {
  print: "Printed on your Square Terminal",
  text: "Sent by text to the client",
  email: "Sent by email to the client",
  none: "No receipt",
}

export function PaySheet({ ctx }: { ctx: CrmCtx }) {
  const r = ctx.reservations.find((x) => x.id === ctx.ui.paySel)
  const [method, setMethod] = useState("")
  const [popup, setPopup] = useState<null | "square" | "cash" | "app">(null)
  const [done, setDone] = useState(false)
  const [priceEdit, setPriceEdit] = useState(false)
  const [tendered, setTendered] = useState("")
  const [textPreview, setTextPreview] = useState("")
  if (!r) return null
  const client = ctx.clients.find((c) => c.id === r.clientId)
  const total = chargeTotal(r)
  const firstName = (r.passengerName || client?.name || "there").split(" ")[0]
  const close = () => ctx.patchUi({ paySel: null })
  const receiptChoice = r.receiptChoice || ""

  function markPaid(patch: Partial<CRMReservation>) {
    ctx.updateReservation(r!.id, {
      ...patch,
      paid: true,
      paidAt: todayKey(),
      status: "Completed",
      updatedAt: new Date().toISOString(),
    })
    setPopup(null)
    setDone(true)
  }

  function charge() {
    if (!method) {
      ctx.toast(tx("Choose a payment method first."))
      return
    }
    if (method === "Square") setPopup("square")
    else if (method === "Efectivo") setPopup("cash")
    else if (method === "Cuenta") {
      ctx.updateReservation(r!.id, { paymentMethod: "Cuenta", status: "Completed", updatedAt: new Date().toISOString() })
      ctx.toast(tx("Left on account — it stays in CHARGES as owed."))
      close()
    } else setPopup("app")
  }

  function sendPayText() {
    const text = method === "Zelle" ? zelleSendText(ctx.vehicle, total, firstName) : paySendText(ctx.vehicle, method, total, firstName)
    if (!textPreview) {
      setTextPreview(text)
      return
    }
    ctx.queueOutgoing({
      clientId: r!.clientId,
      reservationId: r!.id,
      channel: "SMS",
      lane: "sms_transport",
      fn: "transport",
      fromName: "Island City Transit",
      fromPhone: "",
      body: text,
      draftReply: "",
    })
    setTextPreview("")
    ctx.toast(tx("Payment text queued in Messages — it sends only through the approved outbox."))
  }

  function receipt(choice: string) {
    ctx.updateReservation(r!.id, { receiptChoice: choice })
    if (choice === "print") window.print()
    if (choice === "text") {
      ctx.queueOutgoing({
        clientId: r!.clientId,
        reservationId: r!.id,
        channel: "SMS",
        lane: "sms_transport",
        fn: "transport",
        fromName: "Island City Transit",
        fromPhone: "",
        body:
          "Island City Transit — payment receipt: " + money(total) + " received by " + payLabel(r!.paymentMethod || method) +
          " for your trip on " + r!.serviceDate + ". Thank you! — Miguel",
        draftReply: "",
      })
    }
    if (choice === "email" && client?.email) {
      window.location.href =
        "mailto:" + client.email + "?subject=" + encodeURIComponent("Island City Transit — payment receipt") +
        "&body=" + encodeURIComponent("Payment receipt: " + money(total) + " received by " + payLabel(r!.paymentMethod || method) + " for your trip on " + r!.serviceDate + ". Thank you! — Miguel")
    }
  }

  const appId = payIdOf(ctx.vehicle, method)
  const appPhone = payPhoneOf(ctx.vehicle, method)
  const cashT = parseFloat(tendered) || 0
  const cashChange = roundMoney(cashT - total)

  return (
    <div className="sheetwrap">
      <div className="sheet pay">
        {!done ? (
          <>
            <div className="sheet-h">
              <b>{tx("CHARGE")}</b>
              <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
            </div>
            <p className="digits" style={{ textAlign: "center", cursor: "pointer" }} title={tx("Tap to adjust the price")} onClick={() => setPriceEdit(true)}>
              {money(total)} ✎
            </p>
            <p className="kv" style={{ textAlign: "center" }}>
              <b>{r.passengerName || client?.name || "—"}</b> · {r.serviceDate}
            </p>
            <p className="kv" style={{ textAlign: "center" }}>
              {r.pickupAddress || "—"} → {r.dropoffAddress || "—"}
            </p>
            <p className="kv">
              <span>{tx("Fare")}</span>
              <b>{money(Number(r.fare) || 0)}</b>
            </p>
            <p className="kv">
              <span>{tx("Tolls")}</span>
              <b>{money(Number(r.tolls) || 0)}</b>
            </p>
            <p className="kv">
              <span>{tx("Waiting")}</span>
              <b>{money(waitFeeOf(r))}</b>
            </p>
            <p className="lab" style={{ marginTop: 12 }}>{tx("METHOD")}</p>
            <div className="seg wrap">
              {PAYMENT_METHODS.map((p) => (
                <button key={p} type="button" className={method === p ? "on" : ""} onClick={() => setMethod(p)} aria-label={payLabel(p)}>
                  <span style={{ width: 30, height: 30, display: "inline-block" }}>
                    <PayLogo method={p} />
                  </span>
                </button>
              ))}
            </div>
            <p className="lab" style={{ textAlign: "center" }}>{method ? payLabel(method) : tx("Choose a method")}</p>
            <button type="button" className="btn green" style={{ padding: 18, fontSize: 17, marginTop: 14, width: "100%" }} onClick={charge}>
              ✓ {tx("CHARGE")} {money(total)}
            </button>
            <button type="button" className="btn" style={{ padding: 14, fontSize: 15, marginTop: 8, width: "100%" }} onClick={close}>
              {tx("CHARGE LATER")}
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 4px 4px" }}>
            <p className="lab" style={{ fontSize: 13 }}>{tx("TRIP FINISHED")}</p>
            <p style={{ font: "700 26px var(--display)", margin: "10px 0 0" }}>{r.passengerName || client?.name || "—"}</p>
            <p style={{ color: "var(--muted)", fontWeight: 600, margin: "4px 0 0" }}>
              {r.pickupAddress || ""} → {r.dropoffAddress || ""}
            </p>
            <p className="digits" style={{ marginTop: 12 }}>
              {tx("PAID")} {money(total)}
            </p>
            <p className="kv" style={{ justifyContent: "center", gap: 8 }}>
              <span>{payLabel(r.paymentMethod || method)}</span>
              {r.payRef ? <b>{r.payRef}</b> : null}
            </p>
            {!receiptChoice ? (
              <>
                <p className="lab" style={{ marginTop: 14 }}>{tx("RECEIPT?")}</p>
                <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => receipt("print")}>
                  🖨️ {tx("Print receipt on the terminal")}
                </button>
                <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => receipt("text")}>
                  💬 {tx("Send receipt by text")}
                </button>
                <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => receipt("email")}>
                  ✉️ {tx("Send receipt by email")}
                </button>
                <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => receipt("none")}>
                  {tx("No receipt")}
                </button>
              </>
            ) : (
              <>
                <p className="mini" style={{ marginTop: 10 }}>{tx(RECEIPT_LABEL[receiptChoice] || "")}</p>
                <button type="button" className="btn green" style={{ padding: 18, fontSize: 17, marginTop: 14, width: "100%" }} onClick={close}>
                  {tx("CLOSE")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {priceEdit && (
        <PriceEditPopup
          value={Number(r.fare) || 0}
          onClose={() => setPriceEdit(false)}
          onApply={(n) => ctx.updateReservation(r.id, { fare: n, updatedAt: new Date().toISOString() })}
        />
      )}

      {popup === "square" && (
        <div className="sheetwrap" style={{ zIndex: 80 }}>
          <div className="sheet pay">
            <div className="sheet-h">
              <b>Square</b>
              <button type="button" className="x" aria-label={tx("Close")} onClick={() => setPopup(null)}>✕</button>
            </div>
            <div style={{ width: 64, height: 64, margin: "6px auto" }}>
              <PayLogo method="Square" />
            </div>
            <p className="digits" style={{ textAlign: "center" }}>{money(total)}</p>
            <div className="notebox">
              {tx("Connection point (PC-SQ): the real charge opens Square signed in as Miguel — he signs in once and types the Terminal pairing code, with him present. Until that step, this popup simulates the approved return; no real charge leaves from here.")}
            </div>
            <button
              type="button"
              className="btn green"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => markPaid({ paymentMethod: "Square", payVia: "Square Terminal", payRef: "SQ-SIM-" + Date.now().toString(36).toUpperCase() })}
            >
              ✓ {tx("Simulate approved payment in Square")}
            </button>
            <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => setPopup(null)}>
              {tx("Back")}
            </button>
          </div>
        </div>
      )}

      {popup === "cash" && (
        <div className="sheetwrap" style={{ zIndex: 80 }}>
          <div className="sheet pay">
            <div className="sheet-h">
              <b>{tx("Cash")}</b>
              <button type="button" className="x" aria-label={tx("Close")} onClick={() => setPopup(null)}>✕</button>
            </div>
            <p className="digits" style={{ textAlign: "center" }}>{money(total)}</p>
            <div className="fld">
              <label>{tx("Cash received ($)")}</label>
              <input inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={total.toFixed(2)} />
            </div>
            <p className="mini">
              {cashT > 0
                ? cashChange >= 0
                  ? tx("Change:") + " " + money(cashChange)
                  : tx("Still missing:") + " " + money(-cashChange)
                : tx("Leave it empty if the client paid the exact amount.")}
            </p>
            <button
              type="button"
              className="btn green"
              style={{ height: 48, borderRadius: 8, width: "100%" }}
              disabled={cashT > 0 && cashChange < 0}
              onClick={() => markPaid({ paymentMethod: "Efectivo", cashTendered: cashT || total, cashChange: cashT > 0 ? Math.max(0, cashChange) : 0 })}
            >
              {tx("CONFIRM CASH")}
            </button>
            <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => setPopup(null)}>
              {tx("Cancel")}
            </button>
          </div>
        </div>
      )}

      {popup === "app" && (
        <div className="zpop">
          <div className="zcard">
            <div className="sheet-h">
              <b>{payLabel(method)}</b>
              <button type="button" className="x" aria-label={tx("Close")} onClick={() => setPopup(null)}>✕</button>
            </div>
            <div style={{ width: 64, height: 64, margin: "6px auto" }}>
              <PayLogo method={method} />
            </div>
            <p className="lab" style={{ textAlign: "center" }}>{tx("Send payment to")}</p>
            <p className="zbig">{appId || "—"}</p>
            {appPhone && <p className="mini" style={{ textAlign: "center" }}>{tx("Phone linked to the account:")} {appPhone}</p>}
            <p className="digits" style={{ textAlign: "center", fontSize: 26 }}>{money(total)}</p>
            {method === "Zelle" && (
              <div className="notebox">{tx("Zelle does not allow pre-filling the amount — the client enters it in their bank app.")}</div>
            )}
            <div className="qrbox">
              <QrSvg text={payQrPayload(ctx.vehicle, method, total, "Island City Transit")} />
            </div>
            {textPreview ? (
              <>
                <p className="lab">{tx("This exact text will be queued:")}</p>
                <div className="notebox">{textPreview}</div>
                <button type="button" className="btn primary" style={{ marginTop: 12, height: 48, borderRadius: 8, width: "100%" }} onClick={sendPayText}>
                  {tx("QUEUE THIS TEXT")}
                </button>
                <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => setTextPreview("")}>
                  {tx("Back")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 12, height: 48, borderRadius: 8, background: "var(--ink)", color: "#fff", font: "700 14px var(--display)", letterSpacing: ".06em", width: "100%" }}
                  onClick={sendPayText}
                >
                  {tx("SEND BY TEXT")}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 8, height: 48, borderRadius: 8, background: "var(--bg)", border: "1px solid rgba(13,27,46,.2)", color: "var(--ink)", font: "700 14px var(--display)", letterSpacing: ".06em", width: "100%" }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(payInfoText(ctx.vehicle, method, total)).catch(() => {})
                    ctx.toast(tx("Payment info copied."))
                  }}
                >
                  {tx("COPY PAYMENT INFO")}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 8, width: "100%" }}
                  onClick={() => markPaid({ paymentMethod: method, payVia: payLabel(method) + " (manual confirm)" })}
                >
                  {tx("MARK AS PAID")}
                </button>
                <button type="button" className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => setPopup(null)}>
                  {tx("Close")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
