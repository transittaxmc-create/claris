import { NextResponse } from "next/server"
import { validateAgentEventInput } from "@/lib/agent-gateway/validation"
import { DisabledAgentGatewayStore } from "@/lib/agent-gateway/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const store = new DisabledAgentGatewayStore()

/** Closed until dedicated agent Auth identities and an approved event store exist. */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const validation = validateAgentEventInput(body)
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
  const result = await store.appendEvent(
    null as never,
    validation.value,
    request.headers.get("x-request-id") || "unassigned"
  )
  return NextResponse.json(result, { status: result.status })
}
