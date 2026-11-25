const SW_VERSION = "copiloto-pwa-v1"

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a new CRM update." }
  }
  const title = payload.title || "Copiloto CRM"
  const options = {
    body: payload.body || "You have a new update.",
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/?tab=CRM", ...(payload.data || {}) }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/?tab=CRM", self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus()
        if ("navigate" in client) await client.navigate(target)
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
