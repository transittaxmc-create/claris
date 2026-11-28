"use client"

/**
 * SETTINGS del CRM nuevo (la tuerquita ⋯) — SOLO lo que Miguel mandó
 * (2026-11-28 11:04 EST): Vehicle & driver + Payment info + Language
 * + SAVE. Ni el modo carro ni enlaces de cuenta viven aquí. Abajo,
 * separado, el panel de la nube del CRM de producción (entrar/salir)
 * porque la cuenta es la puerta de los datos en este teléfono.
 * Todo formulario sale sin guardar con X/Cancel.
 */
import { useRef, useState } from "react"
import { fileToDownscaledDataUrl } from "@/lib/crm/crm-photos"
import { CRMNotifications } from "../crm-notifications"
import { CrmCloudPanel } from "./cloud-panel"
import type { CrmCtx } from "./ctx"
import { tx } from "./i18n"
import { VEHICLE_COLORS, VEHICLE_MAKES, VEHICLE_MODELS, vehiclePhotoSrc, type Vehicle } from "./types"

export function SettingsSheet({ ctx }: { ctx: CrmCtx }) {
  const [draft, setDraft] = useState<Vehicle>({ ...ctx.vehicle })
  const [modelOther, setModelOther] = useState("")
  const fileRef = useRef<HTMLInputElement | null>(null)
  const set = (p: Partial<Vehicle>) => setDraft((d) => ({ ...d, ...p }))
  const close = () => ctx.patchUi({ settings: false })
  const models = draft.make ? VEHICLE_MODELS[draft.make] || ["Other"] : []
  const photoSrc = vehiclePhotoSrc(draft)
  const photoLabel = draft.photo
    ? tx("Your photo")
    : photoSrc
      ? tx("Press photo · 2025 Toyota Grand Highlander")
      : tx("No photo for this vehicle yet — upload yours below.")

  function save() {
    const out = { ...draft }
    if (out.model === "Other" && modelOther.trim()) out.model = modelOther.trim()
    ctx.saveVehicle(out)
    close()
    ctx.toast(tx("Settings saved."))
  }

  return (
    <div className="sheetwrap">
      <div className="sheet">
        <div className="sheet-h">
          <b>{tx("Settings")}</b>
          <button type="button" className="x" aria-label={tx("Close")} onClick={close}>✕</button>
        </div>

        <div className="lab" style={{ marginTop: 0 }}>🚗 {tx("VEHICLE & DRIVER")}</div>
        <div className="fld">
          <label>{tx("Driver")}</label>
          <input value={draft.driver} onChange={(e) => set({ driver: e.target.value })} />
        </div>
        <div className="grid3">
          <div className="fld">
            <label>{tx("Make")}</label>
            <select
              value={draft.make}
              onChange={(e) => set({ make: e.target.value, model: "" })}
            >
              <option value="">{tx("Select…")}</option>
              {VEHICLE_MAKES.map((mk) => (
                <option key={mk} value={mk}>{mk}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>{tx("Model")}</label>
            <select value={draft.model} onChange={(e) => set({ model: e.target.value })}>
              <option value="">{tx("Select…")}</option>
              {models.map((md) => (
                <option key={md} value={md}>{md}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>{tx("Year")}</label>
            <input inputMode="numeric" value={draft.year} onChange={(e) => set({ year: e.target.value })} placeholder="2025" />
          </div>
        </div>
        {draft.model === "Other" && (
          <div className="fld">
            <label>{tx("Model — write it")}</label>
            <input value={modelOther} onChange={(e) => setModelOther(e.target.value)} placeholder="E.g.: Grand Highlander" />
          </div>
        )}
        <div className="grid2">
          <div className="fld">
            <label>{tx("Color")}</label>
            <select value={draft.color} onChange={(e) => set({ color: e.target.value })}>
              <option value="">{tx("Select…")}</option>
              {VEHICLE_COLORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>{tx("Plate")}</label>
            <input value={draft.plate} onChange={(e) => set({ plate: e.target.value })} />
          </div>
        </div>
        <div className="fld">
          <label>{tx("Vehicle photo")}</label>
          {photoSrc && (
            <div className="vphoto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc} alt={tx("Vehicle photo")} />
              <div className="vnote">{photoLabel}</div>
            </div>
          )}
          {!photoSrc && <div className="mini" style={{ marginTop: 4 }}>{photoLabel}</div>}
          <div className="mini">{tx("Upload your own photo, or keep the press photo for the 2025 Toyota Grand Highlander.")}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              {tx("Upload photo")}
            </button>
            {draft.photo && (
              <button type="button" className="btn" onClick={() => set({ photo: "" })}>
                {tx("Remove photo")}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void fileToDownscaledDataUrl(f).then((url) => set({ photo: url })).catch(() => ctx.toast(tx("That photo could not be read.")))
            }}
          />
        </div>

        <div className="lab">💳 {tx("PAYMENT INFO")}</div>
        <div className="mini">{tx("What you save here is what the payment popups show and send. The preloaded data is a fictitious demo — replace it with yours.")}</div>
        {(
          [
            ["Zelle", "zelle", "zellePhone"],
            ["Venmo", "venmo", "venmoPhone"],
            ["Cash App", "cashapp", "cashappPhone"],
          ] as const
        ).map(([label, idKey, telKey]) => (
          <div key={label} className="grid2">
            <div className="fld">
              <label>{label}</label>
              <input value={draft[idKey]} onChange={(e) => set({ [idKey]: e.target.value } as Partial<Vehicle>)} />
            </div>
            <div className="fld">
              <label>{tx("Linked phone")}</label>
              <input inputMode="tel" value={draft[telKey]} onChange={(e) => set({ [telKey]: e.target.value } as Partial<Vehicle>)} />
            </div>
          </div>
        ))}

        <div className="lab">🌐 {tx("LANGUAGE")}</div>
        <div className="seg">
          <button type="button" className={ctx.lang === "en" ? "on" : ""} onClick={() => ctx.setLang("en")}>
            English
          </button>
          <button type="button" className={ctx.lang === "es" ? "on" : ""} onClick={() => ctx.setLang("es")}>
            Español
          </button>
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={close}>{tx("Cancel")}</button>
          <button type="button" className="btn primary" onClick={save}>{tx("SAVE")}</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <CrmCloudPanel ctx={ctx} />
        </div>
        <div style={{ marginTop: 12 }}>
          <CRMNotifications />
        </div>
      </div>
    </div>
  )
}
