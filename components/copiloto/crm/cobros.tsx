"use client"

/**
 * CHARGES del CRM nuevo — puerto de la vista del prototipo:
 * gráfica de los últimos 7 días sumando por paidAt (la fecha en que
 * el dinero ENTRÓ, nunca la del servicio), lo que falta por cobrar
 * agrupado por cliente, y el historial de pagos con su método y
 * recibo. Cobrar abre la misma hoja de cobro de todo el CRM.
 */
import type { CrmCtx } from "./ctx"
import { addDaysKey, money, todayKey } from "./helpers"
import { tx } from "./i18n"
import { chargeTotal } from "./sheets"
import { payLabel } from "./types"

export function CobrosTab({ ctx }: { ctx: CrmCtx }) {
  const today = todayKey()
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i - 6))
  const paid = ctx.reservations.filter((r) => r.paid)
  const sumOn = (key: string) => paid.filter((r) => r.paidAt === key).reduce((s, r) => s + chargeTotal(r), 0)
  const weekTotal = days.reduce((s, k) => s + sumOn(k), 0)
  const maxDay = Math.max(1, ...days.map(sumOn))
  const owed = ctx.reservations
    .filter((r) => r.status === "Completed" && !r.paid)
    .sort((a, b) => (a.serviceDate || "").localeCompare(b.serviceDate || ""))
  const owedTotal = owed.reduce((s, r) => s + chargeTotal(r), 0)
  const byClient = new Map<string, typeof owed>()
  for (const r of owed) {
    const k = r.clientId || ""
    if (!byClient.has(k)) byClient.set(k, [])
    byClient.get(k)!.push(r)
  }
  const history = [...paid].sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || "")).slice(0, 15)
  const clientName = (id: string) => ctx.clients.find((c) => c.id === id)?.name || "—"

  return (
    <>
      <p className="lab" style={{ margin: "2px 0 6px", fontSize: 13 }}>{tx("LAST 7 DAYS — COLLECTED")}</p>
      <div className="card">
        <div className="bars">
          {days.map((k) => (
            <div key={k} className={"bar" + (k === today ? " today" : "")}>
              <b>{sumOn(k) > 0 ? money(sumOn(k)) : ""}</b>
              <i style={{ height: `${Math.max(3, Math.round((sumOn(k) / maxDay) * 72))}px` }} />
              <small>{new Date(k + "T12:00:00").toLocaleDateString(ctx.lang === "es" ? "es-ES" : "en-US", { weekday: "short" })}</small>
            </div>
          ))}
        </div>
        <div className="kv" style={{ marginTop: 8 }}>
          <span>{tx("Collected this week (by payment date)")}</span>
          <b>{money(weekTotal)}</b>
        </div>
      </div>

      <p className="lab" style={{ margin: "16px 0 6px", fontSize: 13 }}>🔴 {tx("OUTSTANDING")} · {money(owedTotal)}</p>
      {owed.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("Nothing outstanding. Every completed trip is paid.")}</div>}
      {[...byClient.entries()].map(([cid, rs]) => (
        <div key={cid || "none"} className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <b style={{ flex: 1 }}>{clientName(cid)}</b>
            <span className="stchip st-discarded">{money(rs.reduce((s, r) => s + chargeTotal(r), 0))}</span>
            <button type="button" className="btn primary" onClick={() => ctx.patchUi({ paySel: rs[0].id })}>
              {tx("CHARGE ALL")}
            </button>
          </div>
          {rs.map((r) => (
            <div key={r.id} className="row" style={{ marginTop: 8 }}>
              <button type="button" className="row-main" style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={() => ctx.openReservation(r.id, "charges")}>
                <span className="row-t">{r.serviceDate} · {r.passengerName || clientName(cid)}</span>
                <span className="row-s">{r.pickupAddress || "—"} → {r.dropoffAddress || "—"}</span>
              </button>
              <button type="button" className="btn" onClick={() => ctx.patchUi({ paySel: r.id })}>
                {money(chargeTotal(r))}
              </button>
            </div>
          ))}
        </div>
      ))}

      <p className="lab" style={{ margin: "16px 0 6px", fontSize: 13 }}>{tx("PAYMENT HISTORY")}</p>
      {history.length === 0 && <div className="mini" style={{ padding: "6px 2px" }}>{tx("No payments recorded yet.")}</div>}
      {history.map((r) => (
        <button key={r.id} type="button" className="row" onClick={() => ctx.openReservation(r.id, "charges")}>
          <span className="row-main">
            <span className="row-t">
              {r.passengerName || clientName(r.clientId)} — {money(chargeTotal(r))}
            </span>
            <span className="row-s">
              {tx("Paid")} {r.paidAt || "—"} · {payLabel(r.paymentMethod)}
              {r.payRef ? ` · ${r.payRef}` : ""}
              {r.receiptChoice ? ` · ${tx("Receipt:")} ${tx(r.receiptChoice)}` : ""}
            </span>
          </span>
          <span className="stchip st-sent">{tx("PAID")}</span>
        </button>
      ))}
    </>
  )
}
