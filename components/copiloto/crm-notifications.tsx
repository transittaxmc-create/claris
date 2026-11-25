"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing, CheckCircle2, Smartphone } from "lucide-react"

type SupportState = "checking" | "ready" | "unsupported" | "error"

export function CRMNotifications() {
  const [support, setSupport] = useState<SupportState>("checking")
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [installed, setInstalled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    )
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setSupport("unsupported")
      setPermission("unsupported")
      return
    }
    setPermission(Notification.permission)
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(() => setSupport("ready"))
      .catch(() => setSupport("error"))
  }, [])

  async function enableAndTest() {
    if (busy) return
    setBusy(true)
    setMessage("")
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        setMessage("This browser does not support web notifications.")
        return
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      let result = Notification.permission
      if (result === "default") result = await Notification.requestPermission()
      setPermission(result)
      if (result !== "granted") {
        setMessage(result === "denied"
          ? "Notifications are blocked in browser settings. Enable them there and try again."
          : "Notification permission was not granted.")
        return
      }
      await registration.showNotification("Copiloto CRM", {
        body: "Notifications are enabled on this device. This is a local test.",
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "copiloto-crm-local-test",
        data: { url: "/" },
      })
      setMessage("Test notification sent to this device.")
    } catch {
      setMessage("Could not activate notifications on this device. Check browser support and installation.")
      setSupport("error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/80 p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded-lg bg-yellow-400/10 p-2 text-yellow-300">
          {permission === "granted" ? <BellRing className="size-4" /> : <Bell className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">Owner notifications</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">
            {support === "checking" ? "Checking notification support…" :
              support === "unsupported" ? "This browser does not support web notifications." :
              support === "error" ? "Could not register the notification service." :
              permission === "granted" ? "Permission granted on this device." :
              permission === "denied" ? "Permission blocked in browser settings." :
              "Enable notifications and send a test to this device."}
          </p>
          {message && <p className="mt-2 text-[11px] text-yellow-200" role="status">{message}</p>}
          {support === "ready" && permission !== "denied" && (
            <button
              type="button"
              onClick={enableAndTest}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-extrabold text-black disabled:opacity-50"
            >
              {busy ? "Please wait…" : permission === "granted" ? "Send test notification" : "Enable notifications"}
            </button>
          )}
          {permission === "denied" && (
            <p className="mt-2 text-[10px] text-neutral-500">Change the site notification permission in your browser/device settings.</p>
          )}
          {installed && (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="size-3" /> Installed as an app</p>
          )}
          {!installed && /iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") && (
            <p className="mt-2 flex items-start gap-1 text-[10px] text-neutral-500"><Smartphone className="mt-0.5 size-3 shrink-0" /> On iPhone: add Copiloto to the Home Screen, open that icon, then enable notifications here.</p>
          )}
        </div>
      </div>
    </div>
  )
}
