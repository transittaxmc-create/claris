export type CrmPushSubscription = {
  endpoint: string
  expirationTime?: number | null
  keys: { p256dh: string; auth: string }
}

const TRUSTED_PUSH_DOMAINS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
  "wns.windows.com",
] as const

export function isTrustedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      url.hostname.endsWith(".")
    ) return false

    const host = url.hostname.toLowerCase()
    return TRUSTED_PUSH_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain))
  } catch {
    return false
  }
}

export function isValidCrmPushSubscription(value: unknown): value is CrmPushSubscription {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const sub = value as Partial<CrmPushSubscription>
  const keys = sub.keys
  const base64Url = /^[A-Za-z0-9_-]+$/

  return typeof sub.endpoint === "string" &&
    sub.endpoint.length <= 2048 &&
    isTrustedPushEndpoint(sub.endpoint) &&
    (sub.expirationTime === undefined || sub.expirationTime === null ||
      (typeof sub.expirationTime === "number" && Number.isFinite(sub.expirationTime) && sub.expirationTime >= 0)) &&
    Boolean(keys && typeof keys.p256dh === "string" && typeof keys.auth === "string") &&
    keys!.p256dh.length >= 80 && keys!.p256dh.length <= 128 &&
    keys!.auth.length >= 16 && keys!.auth.length <= 128 &&
    base64Url.test(keys!.p256dh) &&
    base64Url.test(keys!.auth)
}
