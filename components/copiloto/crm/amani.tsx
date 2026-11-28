"use client"

/**
 * Chat de Amani dentro del CRM (diseño de Claude): el botón vive en
 * el encabezado, junto a la camarita (RECORDING), con el conteo de
 * mensajes de Miguel sin responder (.am-count); el panel (.amanipanel)
 * trae selector de agente (Amani / Claude / ChatGPT / Gemini /
 * DeepSeek), pestañas Chat / Seguimiento, la lista de pendientes y
 * el espejo de actividad del equipo.
 *
 * Honestidad del prototipo, conservada: las burbujas semilla están
 * marcadas EXAMPLE (.am-ex), no hay ningún indicador falso de "en
 * línea", y los mensajes se guardan SOLO en este teléfono
 * (claris_crm_amani_chat_v1) — enviar cierra el panel y sube el
 * contador del botón hasta que el panel se abre de nuevo. La puerta
 * "Asistente contable (Gemini)" (.am-door) apunta a More → Copiloto
 * AI: esa pantalla de producción no se toca ni se absorbe.
 */
import { useEffect, useRef, useState } from "react"
import type { CrmCtx } from "./ctx"
import { tx } from "./i18n"

const CHAT_KEY = "claris_crm_amani_chat_v1"
const AGENT_KEY = "claris_crm_amani_agent_v1"
const AGENTS = ["Amani", "Claude", "ChatGPT", "Gemini", "DeepSeek"]

type ChatMsg = { from: "miguel" | "agent"; agent?: string; text: string; at: string; example?: boolean }

const SEED: ChatMsg[] = [
  {
    from: "agent",
    agent: "Amani",
    text: "Hi Miguel — example of how I report here: your test messages are filed in the SMS lane, ready for your review. Nothing is sent to a client without your approval.",
    at: "",
    example: true,
  },
  {
    from: "miguel",
    text: "And the messages that disappeared when I reopened the app?",
    at: "",
    example: true,
  },
  {
    from: "agent",
    agent: "Amani",
    text: "Found and fixed in this build: a remount could classify cloud messages as 'deleted here' and push the delete. The new merge never deletes by inference — only your Delete button deletes, and a named test proves the cycle.",
    at: "",
    example: true,
  },
]

const PENDING: { t: string; p: string }[] = [
  {
    t: "Mr. Shah — Sunday return",
    p: "Sun Nov 29, 9:34 PM, JFK Terminal 8 → Massapequa ($55 cash): the confirmation is prepared, NOT sent. It only leaves with your approval.",
  },
  {
    t: "WhatsApp Business",
    p: "The ZapClaw send test is still pending — that lane stays off until a real end-to-end proof.",
  },
  {
    t: "Square",
    p: "The real connection is done with you present — you sign in once and type the Terminal pairing code. Until then the payment popup marks the connection point.",
  },
  {
    t: "Meta / Facebook security",
    p: "Change your password from your phone, log out of all devices and turn on two-step verification — the unrecognized login is still open.",
  },
  {
    t: "Bank sync (Plaid)",
    p: "Paused until Dec 6 — the balances on screen are from Nov 18, nothing is lost.",
  },
]

const ACTIVITY: { who: string; text: string; example?: boolean }[] = [
  {
    who: "Amani",
    text: "The new CRM design was moved into Claris on the same server and the same data — built and verified locally first; it counts as done only when you confirm it on your phone.",
  },
  {
    who: "Dixie (DeepSeek)",
    text: "Logic review of the inbox: the remount defect is documented with its exact mechanism; the new merge was required to pass the named remount test before shipping.",
    example: true,
  },
]

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) return arr as ChatMsg[]
    }
  } catch {}
  return SEED
}

export function AmaniFloat({ ctx }: { ctx: CrmCtx }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"chat" | "seg">("chat")
  const [agent, setAgent] = useState(() => {
    try { return localStorage.getItem(AGENT_KEY) || "Amani" } catch { return "Amani" }
  })
  const [msgs, setMsgs] = useState<ChatMsg[]>(loadChat)
  const [unread, setUnread] = useState(0)
  const [text, setText] = useState("")
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs)) } catch {}
  }, [msgs])
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [open, msgs, tab])

  function send() {
    const t = text.trim()
    if (!t) return
    setMsgs((m) => [...m, { from: "miguel", text: t, at: new Date().toISOString() }])
    setText("")
    setOpen(false)
    setUnread((n) => n + 1)
    ctx.toast(tx("Saved here — Amani picks it up from this phone's mirror."))
  }

  return (
    <>
      <button
        type="button"
        className="amanibtn"
        aria-label={tx("Chat with Amani")}
        title={tx("Chat with Amani")}
        onClick={() => {
          setOpen((o) => !o)
          setUnread(0)
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {unread > 0 && <span className="am-count">{unread}</span>}
      </button>
      {open && <div className="amaniback" onClick={() => setOpen(false)} />}
      {open && (
        <div className="amanipanel" role="dialog" aria-label={tx("Chat with Amani")}>
          <div className="am-head">
            <div>
              <div className="am-title">{tx("Chat with Amani")}</div>
              <div className="am-sub">{tx("Amani answers here · messages save on this phone only")}</div>
            </div>
            <button type="button" className="am-x" aria-label={tx("Close")} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="am-agentrow">
            <span className="am-alab">{tx("Talk with")}</span>
            {AGENTS.map((a) => (
              <button
                key={a}
                type="button"
                className="am-achip"
                aria-pressed={agent === a}
                onClick={() => {
                  setAgent(a)
                  try { localStorage.setItem(AGENT_KEY, a) } catch {}
                }}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="am-tabs">
            <button type="button" className="am-tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
              {tx("Chat")}
            </button>
            <button type="button" className="am-tab" aria-selected={tab === "seg"} onClick={() => setTab("seg")}>
              {tx("Follow-up")}
            </button>
          </div>
          {tab === "chat" ? (
            <>
              <div className="am-body" ref={bodyRef}>
                {msgs.map((m, i) => (
                  <div key={i} className={"am-msg " + (m.from === "miguel" ? "me" : "am")}>
                    <div className="am-bub">
                      {m.from === "agent" && m.agent && <div className="am-meta">{m.agent}</div>}
                      {m.text}
                      {m.example && <span className="am-ex">{tx("EXAMPLE")}</span>}
                    </div>
                  </div>
                ))}
                <p className="am-note">{tx("Saved only on this phone. For the accounting assistant, use More → Copiloto AI.")}</p>
              </div>
              <div className="am-composer">
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder={tx("Write to") + " " + agent + "…"}
                />
                <button type="button" className="am-send" onClick={send}>
                  {tx("Send")}
                </button>
              </div>
              <button
                type="button"
                className="am-door"
                onClick={() => ctx.toast(tx("The accounting assistant (Gemini) lives in More → Copiloto AI — that screen is unchanged."))}
              >
                🧮 {tx("Accounting assistant (Gemini)")} <small>{tx("opens in More → Copiloto AI")}</small>
              </button>
            </>
          ) : (
            <div className="am-body">
              <div className="am-shead">{tx("PENDING — IN ORDER")}</div>
              {PENDING.map((p, i) => (
                <div key={i} className="am-item">
                  <b>{p.t}</b>
                  <p>{tx(p.p)}</p>
                </div>
              ))}
              <div className="am-shead2">{tx("TEAM ACTIVITY")}</div>
              {ACTIVITY.map((a, i) => (
                <div key={i} className="am-act">
                  <span className="am-actdot" />
                  <span className="am-acttxt">
                    <b>{a.who}:</b> {tx(a.text)}
                    {a.example && <span className="am-ex">{tx("EXAMPLE")}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
