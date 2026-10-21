import { NextResponse } from "next/server"
import { plaidConfigured, plaidFetch } from "@/lib/plaid"

export const dynamic = "force-dynamic"

// Creates a Plaid Link token so the phone can open the bank-connect UI.
export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json(
      { error: "plaid_not_configured", hint: "Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel" },
      { status: 503 },
    )
  }
  try {
    const data = await plaidFetch<{ link_token: string; expiration: string }>("/link/token/create", {
      user: { client_user_id: "claris-dinero" },
      client_name: "Claris DINERO",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    })
    return NextResponse.json({ link_token: data.link_token, expiration: data.expiration })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "link_token_failed" }, { status: 502 })
  }
}
