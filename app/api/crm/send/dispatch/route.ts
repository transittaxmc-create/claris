import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Deliberately disabled until a real, authenticated phone/provider bridge is
 * implemented. The previous endpoint accepted a CRM session's arbitrary
 * "sent" status and could make an unsent message appear dispatched.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "phone_dispatch_not_connected",
      message: "No SMS phone bridge or carrier sender is connected. The CRM can queue drafts but cannot mark them sent.",
    },
    { status: 501 }
  )
}
