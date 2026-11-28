"use client"

/**
 * Panel de la nube del CRM — la MISMA lógica de producción (entrar con
 * la cuenta del CRM, refrescar, salir), con el traje visual del
 * prototipo. Vive dentro de la hoja de Settings del CRM nuevo como su
 * propia sección, separado de Vehicle / Payment info / Language.
 */
import { useState } from "react"
import type { CrmCtx } from "./ctx"
import { tx } from "./i18n"

export function CrmCloudPanel({ ctx }: { ctx: CrmCtx }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [localError, setLocalError] = useState("")

  return (
    <div className="card">
      <div className="lab" style={{ marginTop: 0 }}>{tx("CRM CLOUD")}</div>
      {ctx.signedIn ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="gpsdot on" />
            <b>{tx("Synced")}</b>
          </div>
          <div className="mini" style={{ marginTop: 4 }}>
            {tx("Your clients, reservations and messages are in your CRM cloud.")}
          </div>
          {ctx.messagesPending && (
            <div className="mini" style={{ color: "var(--red)", marginTop: 4 }}>
              {tx("Messages could not load from the cloud yet. The rest of the CRM is fine; messages will appear once the cloud answers.")}
            </div>
          )}
          {ctx.cloudError && <div className="mini" style={{ color: "var(--red)", marginTop: 4 }}>{ctx.cloudError}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn" disabled={ctx.cloudBusy} onClick={() => ctx.refreshCloud()}>
              {ctx.cloudBusy ? tx("Refreshing…") : tx("Refresh from cloud")}
            </button>
            <button type="button" className="btn" disabled={ctx.cloudBusy} onClick={() => void ctx.signOut()}>
              {tx("Sign out")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mini">{tx("Sign in with your CRM account to see your clients, reservations and messages on this phone.")}</div>
          <div className="fld">
            <label>{tx("Email")}</label>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="fld">
            <label>{tx("Password")}</label>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {(localError || ctx.cloudError) && (
            <div className="mini" style={{ color: "var(--red)" }}>{localError || ctx.cloudError}</div>
          )}
          <button
            type="button"
            className="btn primary"
            style={{ width: "100%", marginTop: 10 }}
            disabled={ctx.cloudBusy}
            onClick={() => {
              setLocalError("")
              void ctx.signIn(email.trim(), password).catch(() => setLocalError(tx("Could not sign in. Check the email and password.")))
            }}
          >
            {ctx.cloudBusy ? tx("Signing in…") : tx("Sign in to the CRM cloud")}
          </button>
        </>
      )}
    </div>
  )
}
