import { NextResponse } from "next/server"
import { plaidConfigured, plaidFetch, upsertPlaidItem } from "@/lib/plaid"

export const dynamic = "force-dynamic"

// public_token from Plaid Link → permanent access_token stored in Supabase.
export async function POST(request: Request) {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "plaid_not_configured" }, { status: 503 })
  }
  let body: { public_token?: string; institution_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 })
  }
  const public_token = typeof body.public_token === "string" ? body.public_token : ""
  if (!public_token) return NextResponse.json({ error: "public_token_required" }, { status: 400 })

  try {
    const exchanged = await plaidFetch<{ access_token: string; item_id: string }>("/item/public_token/exchange", {
      public_token,
    })

    // Pull account names for the registers grid.
    let accounts: unknown[] = []
    try {
      const acc = await plaidFetch<{ accounts: any[] }>("/accounts/get", {
        access_token: exchanged.access_token,
      })
      accounts = Array.isArray(acc.accounts) ? acc.accounts : []
    } catch {
      accounts = []
    }

    await upsertPlaidItem({
      item_id: exchanged.item_id,
      access_token: exchanged.access_token,
      institution_name: body.institution_name || null,
      accounts,
      cursor: null,
    })

    return NextResponse.json({
      ok: true,
      item_id: exchanged.item_id,
      accounts_count: accounts.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "exchange_failed" }, { status: 502 })
  }
}
