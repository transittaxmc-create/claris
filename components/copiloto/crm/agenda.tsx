"use client"

/**
 * AGENDA del CRM nuevo — puerto de la vista del prototipo:
 * mes (42 celdas), semana y día, con las reservas por fecha de
 * servicio y los bloques de tiempo de Miguel. El bloque "Fuera de
 * servicio" (kind 'nodisp') EXIGE motivo escrito — sin motivo no se
 * guarda (regla del prototipo: un hueco sin explicación se lee como
 * error, no como descanso).
 */
import { useState } from "react"
import type { CrmCtx } from "./ctx"
import { addDaysKey, todayKey } from "./helpers"
import { tx } from "./i18n"
import { emptyBlock, type CrmBlock } from "./types"

const BLOCK_KINDS = ["Compañía", "Uber", "Lyft", "Otra plataforma", "Personal", "Fuera de servicio"]
export const kindOf = (b: CrmBlock): string => (b.kind === "nodisp" ? "Fuera de servicio" : b.kind)
const kindLabel = (k: string) => (k === "nodisp" || k === "Fuera de servicio" ? "⛔ OUT OF SERVICE" : k)

function mondayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const dow = (dt.getDay() + 6) % 7 // lunes = 0
  dt.setDate(dt.getDate() - dow)
  return todayKey(dt)
}

export function AgendaTab({ ctx }: { ctx: CrmCtx }) {
  const sel = ctx.ui.calSel || todayKey()
  const view = ctx.ui.calView
  const [y, mo] = sel.split("-").map(Number)
  const monthName = new Date(y, (mo || 1) - 1, 1).toLocaleDateString(ctx.lang === "es" ? "es-ES" : "en-US", { month: "long", year: "numeric" })
  const resOn = (key: string) => ctx.reservations.filter((r) => r.serviceDate === key && r.status !== "Cancelled")
  const blocksOn = (key: string) => ctx.blocks.filter((b) => b.date === key)
  const shift = (n: number) => {
    if (view === "month") {
      const dt = new Date(y, (mo || 1) - 1 + n, 1)
      ctx.patchUi({ calSel: todayKey(dt) })
    } else if (view === "week") ctx.patchUi({ calSel: addDaysKey(sel, 7 * n) })
    else ctx.patchUi({ calSel: addDaysKey(sel, n) })
  }

  const dayPanel = (key: string) => (
    <div key={"panel-" + key}>
      <p className="lab" style={{ margin: "14px 0 6px", fontSize: 13 }}>
        {new Date(key + "T12:00:00").toLocaleDateString(ctx.lang === "es" ? "es-ES" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
      {resOn(key).length === 0 && blocksOn(key).length === 0 && <div className="empty">{tx("Nothing this day.")}</div>}
      {blocksOn(key).map((b) => (
        <button key={b.id} type="button" className={"cal-blockrow" + (b.kind === "nodisp" ? " nodisp" : "")} onClick={() => ctx.patchUi({ blockForm: true, blockEditId: b.id })}>
          <span className={"cal-bar" + (b.kind === "nodisp" ? " nodisp" : "")}>
            {b.start}–{b.end}
          </span>
          <span className="cal-resmain">
            <b>{kindLabel(kindOf(b))}</b>
            {b.note ? <small> · {b.note}</small> : null}
          </span>
        </button>
      ))}
      {resOn(key)
        .sort((a, b) => (a.pickupTime || "").localeCompare(b.pickupTime || ""))
        .map((r) => (
          <button key={r.id} type="button" className="cal-resrow" onClick={() => ctx.openReservation(r.id, "agenda")}>
            <span className="cal-bar">
              {r.pickupTime}
            </span>
            <span className="cal-resmain">
              <b>{r.passengerName || ctx.clients.find((c) => c.id === r.clientId)?.name || "—"}</b>
              <small>
                {" "}
                · {r.pickupAddress || "—"} → {r.dropoffAddress || "—"} · {tx(r.status)}
              </small>
            </span>
          </button>
        ))}
      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => ctx.patchUi({ blockForm: true, blockEditId: null })}>
        + {tx("ADD BLOCK")}
      </button>
    </div>
  )

  return (
    <>
      <div className="calnav">
        <button type="button" className="btn" onClick={() => shift(-1)}>‹</button>
        <div className="caltitle">{monthName}</div>
        <button type="button" className="btn" onClick={() => ctx.patchUi({ calSel: todayKey() })}>
          {tx("Today")}
        </button>
        <button type="button" className="btn" onClick={() => shift(1)}>›</button>
      </div>
      <div className="seg" style={{ marginBottom: 10 }}>
        {(["month", "week", "day"] as const).map((v) => (
          <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => ctx.patchUi({ calView: v })}>
            {tx(v === "month" ? "Month" : v === "week" ? "Week" : "Day")}
          </button>
        ))}
      </div>

      {view === "month" && (
        <>
          <div className="caldow">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{tx(d)}</span>
            ))}
          </div>
          <div className="calgrid">
            {Array.from({ length: 42 }, (_, i) => addDaysKey(mondayOf(`${y}-${String(mo).padStart(2, "0")}-01`), i)).map((key) => {
              const d = new Date(key + "T12:00:00")
              const inMonth = d.getMonth() === (mo || 1) - 1
              const rs = resOn(key)
              const bs = blocksOn(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={"cal-day" + (key === sel ? " sel" : "") + (key === todayKey() ? " today" : "") + (inMonth ? "" : " out")}
                  onClick={() => ctx.patchUi({ calSel: key })}
                >
                  <span className="cal-num">{d.getDate()}</span>
                  <span className="cal-marks">
                    {rs.slice(0, 3).map((r) => (
                      <span key={r.id} className="cal-dot" />
                    ))}
                    {bs.map((b) => (
                      <span key={b.id} className="cal-dot" style={{ background: b.kind === "nodisp" ? "var(--red)" : "var(--muted)" }} />
                    ))}
                  </span>
                  {rs.slice(0, 1).map((r) => (
                    <span key={r.id} className="cal-bar">
                      {r.pickupTime} {(r.passengerName || "").split(" ")[0]}
                    </span>
                  ))}
                  {bs.slice(0, 1).map((b) => (
                    <span key={b.id} className={"cal-bar" + (b.kind === "nodisp" ? " nodisp" : "")}>
                      {b.kind === "nodisp" ? "⛔" : "▦"} {b.start}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
          {dayPanel(sel)}
        </>
      )}

      {view === "week" && (
        <>
          {Array.from({ length: 7 }, (_, i) => addDaysKey(mondayOf(sel), i)).map((key) => (
            <div key={key}>
              <button type="button" className={"cal-weekrow" + (key === sel ? " sel" : "") + (key === todayKey() ? " today" : "")} onClick={() => ctx.patchUi({ calSel: key, calView: "day" })}>
                <span className="cal-wd">
                  <b>{new Date(key + "T12:00:00").toLocaleDateString(ctx.lang === "es" ? "es-ES" : "en-US", { weekday: "long", day: "numeric" })}</b>
                  <small>
                    {resOn(key).length} {tx("reservations")} · {blocksOn(key).length} {tx("blocks")}
                  </small>
                </span>
                <span className="cal-witems">
                  {resOn(key).slice(0, 2).map((r) => (
                    <span key={r.id} className="cal-reschip">
                      {r.pickupTime} {(r.passengerName || "").split(" ")[0]}
                    </span>
                  ))}
                  {blocksOn(key).slice(0, 1).map((b) => (
                    <span key={b.id} className={"cal-blockchip" + (b.kind === "nodisp" ? " nodisp" : "")}>
                      {b.start}
                    </span>
                  ))}
                </span>
              </button>
            </div>
          ))}
          {dayPanel(sel)}
        </>
      )}

      {view === "day" && dayPanel(sel)}
    </>
  )
}

/** Formulario de bloque (hoja): sale sin guardar con X/Cancel. */
export function BlockFormSheet({ ctx }: { ctx: CrmCtx }) {
  const editing = ctx.ui.blockEditId ? ctx.blocks.find((b) => b.id === ctx.ui.blockEditId) : undefined
  const [draft, setDraft] = useState<CrmBlock>(() =>
    editing ? { ...editing } : { ...emptyBlock(), date: ctx.ui.calSel || todayKey() },
  )
  const [error, setError] = useState("")
  const set = (p: Partial<CrmBlock>) => setDraft((d) => ({ ...d, ...p }))
  const close = () => ctx.patchUi({ blockForm: false, blockEditId: null })
  const isNoDisp = draft.kind === "nodisp" || draft.kind === "Fuera de servicio"

  function save() {
    if (!draft.date || !draft.start || !draft.end) {
      setError(tx("Date, start and end are required."))
      return
    }
    if (isNoDisp && !draft.note.trim()) {
      setError(tx("Out of service requires a written reason."))
      return
    }
    const out: CrmBlock = { ...draft, kind: isNoDisp ? "nodisp" : draft.kind }
    const next = editing ? ctx.blocks.map((b) => (b.id === out.id ? out : b)) : [...ctx.blocks, out]
    ctx.saveBlocks(next)
    close()
    ctx.toast(tx("Block saved."))
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{editing ? tx("Edit block") : tx("New block")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>
        <div className="fld">
          <label>{tx("Date")}</label>
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label>{tx("Start")}</label>
            <input type="time" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
          </div>
          <div className="fld">
            <label>{tx("End")}</label>
            <input type="time" value={draft.end} onChange={(e) => set({ end: e.target.value })} />
          </div>
        </div>
        <div className="fld">
          <label>{tx("Kind")}</label>
          <select value={isNoDisp ? "Fuera de servicio" : draft.kind} onChange={(e) => set({ kind: e.target.value })}>
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>{tx(k)}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label>{isNoDisp ? tx("Reason (required)") : tx("Note")}</label>
          <textarea rows={2} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
        {error && <div className="mini" style={{ color: "var(--red)" }}>{error}</div>}
        <div className="sheet-actions">
          {editing && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                ctx.saveBlocks(ctx.blocks.filter((b) => b.id !== editing.id))
                close()
              }}
            >
              {tx("Delete")}
            </button>
          )}
          <button type="button" className="btn" onClick={close}>{tx("Cancel")}</button>
          <button type="button" className="btn primary" onClick={save}>{tx("SAVE")}</button>
        </div>
      </div>
    </div>
  )
}
