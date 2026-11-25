"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing, CheckCircle2, Smartphone } from "lucide-react"

type SupportState = "checking" | "ready" | "unsupported" | "error"

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export function CRMNotifications() {
  const [support, setSupport] = useState<SupportState>("checking")
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [installed, setInstalled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [backendReady, setBackendReady] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    )
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
      setSupport("unsupported")
      setPermission("unsupported")
      return
    }
    setPermission(Notification.permission)
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(async (registration) => {
        setSupport("ready")
        try {
          const configResponse = await fetch("/api/crm/push/config", { cache: "no-store" })
          const config = configResponse.ok ? await configResponse.json() : null
          setBackendReady(Boolean(config?.enabled && config?.publicKey))
          const existing = await registration.pushManager.getSubscription()
          if (existing && config?.enabled) {
            const saved = await fetch("/api/crm/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: existing.toJSON() }),
            })
            setSubscribed(saved.ok)
          }
        } catch {
          setBackendReady(false)
        }
      })
      .catch(() => setSupport("error"))
  }, [])

  async function enableRemotePush() {
    if (busy) return
    setBusy(true)
    setMessage("")
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        setMessage("This browser does not support web push.")
        return
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      let result = Notification.permission
      if (result === "default") result = await Notification.requestPermission()
      setPermission(result)
      if (result !== "granted") {
        setMessage(result === "denied"
          ? "Notifications are blocked in browser/device settings. Enable them there and try again."
          : "Notification permission was not granted.")
        return
      }

      const configResponse = await fetch("/api/crm/push/config", { cache: "no-store" })
      if (!configResponse.ok) throw new Error("Could not contact the push service.")
      const config = await configResponse.json()
      if (!config?.enabled || !config?.publicKey) {
        setBackendReady(false)
        throw new Error("The server push service is not configured yet.")
      }
      setBackendReady(true)

      const readyRegistration = await navigator.serviceWorker.ready
      let subscription = await readyRegistration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(config.publicKey) as BufferSource,
        })
      }

      const saved = await fetch("/api/crm/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!saved.ok) {
        const detail = await saved.json().catch(() => null)
        throw new Error(detail?.error || "Could not save this device subscription.")
      }
      setSubscribed(true)

      const test = await fetch("/api/crm/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!test.ok) {
        const detail = await test.json().catch(() => null)
        throw new Error(detail?.error || "The server could not send the push test.")
      }
      setMessage("Remote push test sent by the server. Check the iPhone notification.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not activate remote push.")
    } finally {
      setBusy(false)
    }
  }

  async function sendRemoteTest() {
    if (busy) return
    setBusy(true)
    setMessage("")
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setSubscribed(false)
        setMessage("This device is not subscribed yet. Activate push first.")
        return
      }
      const response = await fetch("/api/crm/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => null)
        throw new Error(detail?.error || "The remote push test failed.")
      }
      setMessage("Remote push test sent by the server. Check the iPhone notification.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the remote test.")
    } finally {
      setBusy(false)
    }
  }

  async function sendLocalTest() {
    if (busy) return
    setBusy(true)
    setMessage("")
    try {
      if (Notification.permission !== "granted") {
        setMessage("Enable notifications first.")
        return
      }
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification("Copiloto CRM — prueba local", {
        body: "Esta notificación se generó directamente en este dispositivo.",
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "copiloto-crm-local-test",
        requireInteraction: true,
        data: { url: "/" },
      })
      setMessage("Local notification displayed on this device.")
    } catch {
      setMessage("Could not display the local notification.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/80 p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded-lg bg-yellow-400/10 p-2 text-yellow-300">
          {subscribed ? <BellRing className="size-4" /> : <Bell className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">Owner push notifications</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">
            {support === "checking" ? "Checking notification support…" :
              support === "unsupported" ? "This browser does not support web push." :
              support === "error" ? "Could not register the notification service." :
              subscribed ? "This device is registered for remote push notifications." :
              permission === "granted" ? "Permission granted. Register this device for server push." :
              permission === "denied" ? "Permission blocked in browser/device settings." :
              "Enable notifications to register this device for remote push."}
          </p>
          {!backendReady && support === "ready" && (
            <p className="mt-2 text-[10px] text-amber-300">Server push configuration is not available yet.</p>
          )}
          {message && <p className="mt-2 text-[11px] text-yellow-200" role="status">{message}</p>}
          {support === "ready" && permission !== "denied" && !subscribed && (
            <button
              type="button"
              onClick={enableRemotePush}
              disabled={busy || !backendReady}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-extrabold text-black disabled:opacity-50"
            >
              {busy ? "Please wait…" : permission === "granted" ? "Register this device & test push" : "Enable remote push"}
            </button>
          )}
          {subscribed && (
            <button
              type="button"
              onClick={sendRemoteTest}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-extrabold text-black disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Send remote push test"}
            </button>
          )}
          {permission === "granted" && (
            <button
              type="button"
              onClick={sendLocalTest}
              disabled={busy}
              className="ml-2 mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-200 disabled:opacity-50"
            >
              Local test
            </button>
          )}
          {permission === "denied" && (
            <p className="mt-2 text-[10px] text-neutral-500">Change the site notification permission in your browser/device settings.</p>
          )}
          {installed && (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="size-3" /> Installed as an app</p>
          )}
          {!installed && /iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") && (
            <p className="mt-2 flex items-start gap-1 text-[10px] text-neutral-500"><Smartphone className="mt-0.5 size-3 shrink-0" /> On iPhone: add Copiloto to the Home Screen, open that icon, then enable remote push here.</p>
          )}
        </div>
      </div>
    </div>
  )
}
