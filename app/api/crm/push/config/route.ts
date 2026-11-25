import { NextResponse } from "next/server"
import { crmPushIsConfigured } from "@/lib/crm-push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const enabled = crmPushIsConfigured()
  return NextResponse.json({
    enabled,
    publicKey: enabled ? process.env.CRM_PUSH_VAPID_PUBLIC_KEY : null,
  }, { headers: { "Cache-Control": "no-store" } })
}
