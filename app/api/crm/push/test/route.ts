import { NextResponse } from "next/server"
import {
  isSameOriginRequest,
  isValidCrmPushSubscription,
  sendCrmPush,
} from "@/lib/crm-push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "same_origin_required" }, { status: 403 })
  }
  let body: { subscription?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!isValidCrmPushSubscription(body.subscription)) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 })
  }
  try {
    const result = await sendCrmPush(body.subscription, {
      title: "Copiloto CRM — prueba push",
      body: "La notificación push remota llegó desde el servidor.",
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
