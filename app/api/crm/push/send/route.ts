import { NextResponse } from "next/server"
import {
  isValidPushSendSecret,
  safeCrmPushPayload,
  sendCrmPushToAll,
} from "@/lib/crm-push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")
  const candidate = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null
  if (!isValidPushSendSecret(candidate)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  try {
    const payload = safeCrmPushPayload(body)
    const result = await sendCrmPushToAll(payload)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "push_send_failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
