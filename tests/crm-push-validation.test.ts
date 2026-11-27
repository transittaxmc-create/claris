import assert from "node:assert/strict"
import test from "node:test"
import { isTrustedPushEndpoint, isValidCrmPushSubscription } from "../lib/crm/push-validation.ts"

const validSubscription = (endpoint: string) => ({
  endpoint,
  expirationTime: null,
  keys: {
    p256dh: "A".repeat(87),
    auth: "B".repeat(22),
  },
})

test("accepts trusted browser push provider endpoints", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/example",
    "https://updates.push.services.mozilla.com/wpush/v2/example",
    "https://web.push.apple.com/Qexample",
    "https://notify.windows.com/w/",
    "https://wns.windows.com/w/",
  ]) {
    assert.equal(isTrustedPushEndpoint(endpoint), true, endpoint)
    assert.equal(isValidCrmPushSubscription(validSubscription(endpoint)), true, endpoint)
  }
})

test("rejects arbitrary hosts and local/private targets", () => {
  for (const endpoint of [
    "https://example.com/push",
    "https://localhost/push",
    "https://127.0.0.1/push",
    "https://169.254.169.254/latest/meta-data",
    "https://fcm.googleapis.com.attacker.example/push",
    "https://attackerfcm.googleapis.com/push",
  ]) {
    assert.equal(isTrustedPushEndpoint(endpoint), false, endpoint)
    assert.equal(isValidCrmPushSubscription(validSubscription(endpoint)), false, endpoint)
  }
})

test("rejects insecure, credentialed, and nonstandard-port endpoints", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/push",
    "https://user:pass@fcm.googleapis.com/push",
    "https://fcm.googleapis.com:8443/push",
    "https://fcm.googleapis.com./push",
  ]) {
    assert.equal(isTrustedPushEndpoint(endpoint), false, endpoint)
  }
})

test("rejects malformed subscriptions and invalid key encodings", () => {
  assert.equal(isValidCrmPushSubscription(null), false)
  assert.equal(isValidCrmPushSubscription([]), false)
  assert.equal(isValidCrmPushSubscription({ ...validSubscription("https://fcm.googleapis.com/push"), keys: { p256dh: "!".repeat(90), auth: "B".repeat(22) } }), false)
  assert.equal(isValidCrmPushSubscription({ ...validSubscription("https://fcm.googleapis.com/push"), expirationTime: Number.NaN }), false)
})
