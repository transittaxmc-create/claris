import { NextResponse } from "next/server"
import {
  isSameOriginRequest,
  isValidCrmPushSubscription,
  sendCrmPush,
  getCrmPushSubscription,
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
  let body: { subscription?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!isValidCrmPushSubscription(body.subscription)) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 })
  }
  const registered = await getCrmPushSubscription(userId, body.subscription.endpoint)
  if (!registered) {
    return NextResponse.json({ error: "subscription_not_registered_for_user" }, { status: 404 })
  }
  try {
    const result = await sendCrmPush(registered, {
      title: "Copiloto CRM — prueba push",
      body: "The remote push notification arrived from the server.",
      url: "/",
      tag: "copiloto-crm-push-test",
    })
    if (result.stale) {
      return NextResponse.json({ error: "subscription_expired", status: result.status }, { status: 410 })
    }
    if (!result.ok) {
      return NextResponse.json({ error: "push_provider_rejected", status: result.status }, { status: 502 })
    }
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "push_send_failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
