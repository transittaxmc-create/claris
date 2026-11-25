import { createCipheriv, createDecipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign, timingSafeEqual } from "node:crypto"
import { head, put } from "@vercel/blob"

export type CrmPushSubscription = {
  endpoint: string
  expirationTime?: number | null
  keys: { p256dh: string; auth: string }
}

const STORE_PATH = "crm-private/push-subscriptions.enc"

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url")
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url")
}

function configured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.CRM_PUSH_VAPID_PUBLIC_KEY &&
    process.env.CRM_PUSH_VAPID_PRIVATE_KEY &&
    process.env.CRM_PUSH_STORE_SECRET
  )
}

export function crmPushIsConfigured() {
  return configured()
}

export function isValidCrmPushSubscription(value: unknown): value is CrmPushSubscription {
  if (!value || typeof value !== "object") return false
  const sub = value as Partial<CrmPushSubscription>
  return typeof sub.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    sub.endpoint.length <= 2048 &&
    Boolean(sub.keys && typeof sub.keys.p256dh === "string" && typeof sub.keys.auth === "string") &&
    sub.keys!.p256dh.length >= 80 &&
    sub.keys!.auth.length >= 16
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
    const requestHost = forwardedHost || new URL(request.url).host
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    return parsed.host.toLowerCase() === requestHost.toLowerCase() &&
      (parsed.protocol === "https:" || (local && parsed.protocol === "http:"))
  } catch {
    return false
  }
}

function storeKey() {
  const key = fromBase64Url(process.env.CRM_PUSH_STORE_SECRET || "")
  if (key.length !== 32) throw new Error("CRM push store key must be 32 bytes")
  return key
}

function encryptStore(value: CrmPushSubscription[]) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", storeKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")
}

function decryptStore(value: string): CrmPushSubscription[] {
  const bytes = Buffer.from(value, "base64")
  if (bytes.length < 29) throw new Error("CRM push store is invalid")
  const iv = bytes.subarray(0, 12)
  const tag = bytes.subarray(12, 28)
  const decipher = createDecipheriv("aes-256-gcm", storeKey(), iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")
  const parsed = JSON.parse(plain)
  return Array.isArray(parsed) ? parsed.filter(isValidCrmPushSubscription) : []
}

async function readSubscriptions(): Promise<CrmPushSubscription[]> {
  try {
    const info = await head("https://blob.vercel-storage.com/" + STORE_PATH)
    const response = await fetch(info.url, { cache: "no-store" })
    if (!response.ok) throw new Error("Could not read CRM push subscription store")
    return decryptStore(await response.text())
  } catch (error) {
    if (error instanceof Error && /not.?found|404/i.test(error.message)) return []
    throw error
  }
}

async function writeSubscriptions(value: CrmPushSubscription[]) {
  await put(STORE_PATH, encryptStore(value), {
    access: "public",
    contentType: "application/octet-stream",
    allowOverwrite: true,
  })
}

export async function saveCrmPushSubscription(subscription: CrmPushSubscription) {
  if (!configured()) throw new Error("CRM push server is not configured")
  const current = await readSubscriptions()
  const index = current.findIndex((item) => item.endpoint === subscription.endpoint)
  if (index >= 0) current[index] = subscription
  else {
    if (current.length >= 10) throw new Error("The CRM push device limit has been reached")
    current.push(subscription)
  }
  await writeSubscriptions(current)
  return current.length
}

export async function removeCrmPushSubscription(endpoint: string) {
  const current = await readSubscriptions()
  const next = current.filter((item) => item.endpoint !== endpoint)
  await writeSubscriptions(next)
  return current.length - next.length
}

function hkdfExtract(salt: Buffer, input: Buffer) {
  return createHmac("sha256", salt).update(input).digest()
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const blocks: Buffer[] = []
  let previous = Buffer.alloc(0)
  let total = 0
  for (let counter = 1; total < length; counter += 1) {
    previous = createHmac("sha256", prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest()
    blocks.push(previous)
    total += previous.length
  }
  return Buffer.concat(blocks).subarray(0, length)
}

function vapidToken(endpoint: string) {
  const publicKey = process.env.CRM_PUSH_VAPID_PUBLIC_KEY || ""
  const privateScalar = process.env.CRM_PUSH_VAPID_PRIVATE_KEY || ""
  const publicBytes = fromBase64Url(publicKey)
  const privateBytes = fromBase64Url(privateScalar)
  if (publicBytes.length !== 65 || privateBytes.length !== 32) {
    throw new Error("CRM VAPID keys are invalid")
  }
  const endpointUrl = new URL(endpoint)
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = toBase64Url(Buffer.from(JSON.stringify({
    aud: endpointUrl.origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: process.env.CRM_PUSH_SUBJECT || "https://claris-lime.vercel.app",
  })))
  const unsigned = header + "." + claims
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: toBase64Url(publicBytes.subarray(1, 33)),
      y: toBase64Url(publicBytes.subarray(33, 65)),
      d: toBase64Url(privateBytes),
      ext: true,
    },
    format: "jwk",
  })
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" })
  return unsigned + "." + toBase64Url(signature)
}

function encryptPayload(subscription: CrmPushSubscription, payload: unknown) {
  const uaPublicKey = fromBase64Url(subscription.keys.p256dh)
  const authSecret = fromBase64Url(subscription.keys.auth)
  if (uaPublicKey.length !== 65 || authSecret.length < 16) {
    throw new Error("Push subscription encryption keys are invalid")
  }

  const ecdh = createECDH("prime256v1")
  ecdh.generateKeys()
  const asPublicKey = ecdh.getPublicKey()
  const sharedSecret = ecdh.computeSecret(uaPublicKey)
  const prkKey = hkdfExtract(authSecret, sharedSecret)
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\u0000", "utf8"),
    uaPublicKey,
    asPublicKey,
  ])
  const inputKeyMaterial = hkdfExpand(prkKey, keyInfo, 32)

  const salt = randomBytes(16)
  const prk = hkdfExtract(salt, inputKeyMaterial)
  const contentKey = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\u0000", "utf8"), 16)
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\u0000", "utf8"), 12)
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payload), "utf8"), Buffer.from([2])])
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])

  const recordHeader = Buffer.alloc(5)
  recordHeader.writeUInt32BE(4096, 0)
  recordHeader.writeUInt8(asPublicKey.length, 4)
  return Buffer.concat([salt, recordHeader, asPublicKey, ciphertext])
}

export async function sendCrmPush(subscription: CrmPushSubscription, payload: {
  title: string
  body: string
  url?: string
  tag?: string
}) {
  const body = encryptPayload(subscription, payload)
  const token = vapidToken(subscription.endpoint)
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: "vapid t=" + token + ", k=" + (process.env.CRM_PUSH_VAPID_PUBLIC_KEY || ""),
      TTL: "60",
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    },
    body,
    signal: AbortSignal.timeout(12000),
  })
  return { ok: response.ok || response.status === 201 || response.status === 202, status: response.status, stale: response.status === 404 || response.status === 410 }
}

export async function sendCrmPushToAll(payload: {
  title: string
  body: string
  url?: string
  tag?: string
}) {
  const subscriptions = await readSubscriptions()
  const keep: CrmPushSubscription[] = []
  let sent = 0
  let failed = 0
  for (const subscription of subscriptions) {
    try {
      const result = await sendCrmPush(subscription, payload)
      if (result.stale) continue
      keep.push(subscription)
      if (result.ok) sent += 1
      else failed += 1
    } catch {
      keep.push(subscription)
      failed += 1
    }
  }
  if (keep.length !== subscriptions.length) await writeSubscriptions(keep)
  return { registered: subscriptions.length, sent, failed, removedExpired: subscriptions.length - keep.length }
}

export function safeCrmPushPayload(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 80) : ""
  const body = typeof input.body === "string" ? input.body.trim().slice(0, 240) : ""
  const requestedUrl = typeof input.url === "string" ? input.url : "/"
  const url = requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/"
  const tag = typeof input.tag === "string" ? input.tag.trim().slice(0, 80) : undefined
  if (!title || !body) throw new Error("A title and body are required")
  return { title, body, url, ...(tag ? { tag } : {}) }
}

export function isValidPushSendSecret(candidate: string | null) {
  const expected = process.env.CRM_PUSH_SEND_SECRET || ""
  if (!candidate || !expected) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
