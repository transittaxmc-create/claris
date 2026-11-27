import { NextResponse } from "next/server"
import {
  isSameOriginRequest,
  isValidCrmPushSubscription,
  saveCrmPushSubscription,
  removeCrmPushSubscription,
  isTrustedPushEndpoint,
} from "@/lib/crm-push"
import { getCrmPushUserId } from "@/lib/crm/push-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "same_origin_required" }, { status: 403 })
  }
  const userId = await getCrmPushUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const subscription = (body as { subscription?: unknown } | null)?.subscription
  if (!isValidCrmPushSubscription(subscription)) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 })
  }
  try {
    const count = await saveCrmPushSubscription(subscription, userId)
    return NextResponse.json({ ok: true, registeredDevices: count })
  } catch (error) {
    const message = error instanceof Error ? error.message : "subscription_save_failed"
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "same_origin_required" }, { status: 403 })
  }
  const userId = await getCrmPushUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: { endpoint?: unknown } = {}
  try {
    body = await request.json()
  } catch {}
  if (typeof body.endpoint !== "string" || !isTrustedPushEndpoint(body.endpoint)) {
    return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 })
  }
  try {
    const removed = await removeCrmPushSubscription(body.endpoint, userId)
    return NextResponse.json({ ok: true, removed })
  } catch {
    return NextResponse.json({ error: "subscription_remove_failed" }, { status: 503 })
  }
}
