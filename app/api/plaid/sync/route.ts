import { NextResponse } from "next/server"
import {
  listPlaidItems,
  plaidConfigured,
  plaidFetch,
} from "@/lib/plaid"

export const dynamic = "force-dynamic"

/** Shape expected by cash-flow-register / account-registers. */
type OutTx = {
  date: string
  bank_account: string
  detail: string
  category: string | null
  amount: number
  daily_balance: number | null
  pending: boolean
  transaction_id?: string
  pending_transaction_id?: string | null
}

type OutAccount = {
  name: string
  current_balance: number
  institution: string | null
}

// Full bank snapshot from Plaid (posted + pending). Same envelope as /api/bank/snapshot.
export async function GET() {
  if (!plaidConfigured()) {
    return NextResponse.json(
      { error: "plaid_not_configured", hint: "Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel" },
      { status: 503 },
    )
  }

  const items = await listPlaidItems()
  if (items.length === 0) {
    return NextResponse.json(
      {
        error: "no_plaid_item",
        hint: "Connect a bank with Plaid Link first",
        total_balance: null,
        accounts: [],
        transactions: [],
        as_of: new Date().toISOString(),
      },
      { status: 404 },
    )
  }

  const allTxs: OutTx[] = []
  const allAccounts: OutAccount[] = []
  let total = 0

  for (const item of items) {
    try {
      // Balances
      const bal = await plaidFetch<{ accounts: any[] }>("/accounts/balance/get", {
        access_token: item.access_token,
      })
      for (const a of bal.accounts || []) {
        const name =
          a.official_name || a.name || a.mask
            ? `${a.name || a.official_name || "Account"}${a.mask ? ` · ${a.mask}` : ""}`
            : "Account"
        const current =
          typeof a.balances?.current === "number"
            ? a.balances.current
            : typeof a.balances?.available === "number"
              ? a.balances.available
              : 0
        // Credit: Plaid reports positive liability; we keep sign as-is for cards later.
        allAccounts.push({
          name,
          current_balance: current,
          institution: item.institution_name || a.official_name || null,
        })
        // Checking/savings add; credit cards still count in available/owe logic client-side.
        if (a.type === "depository") total += current
      }

      // The UI expects a complete, current bank snapshot on every refresh.
      // /transactions/sync returns only deltas after the saved cursor, which
      // made the register appear empty/stale because deltas were not persisted.
      // Fetch the full available window instead and let the UI replace its
      // snapshot. Plaid's endpoint paginates with offset.
      const endDate = new Date()
      const startDate = new Date(endDate)
      startDate.setFullYear(startDate.getFullYear() - 2)
      const byId = new Map<string, any>()
      let offset = 0
      let hasMore = true
      let guard = 0
      while (hasMore && guard < 20) {
        guard += 1
        const page = await plaidFetch<{
          transactions: any[]
          total_transactions: number
        }>("/transactions/get", {
          access_token: item.access_token,
          start_date: startDate.toISOString().slice(0, 10),
          end_date: endDate.toISOString().slice(0, 10),
          count: 500,
          offset,
          options: { include_personal_finance_category: true, include_pending: true },
        })
        for (const t of page.transactions || []) {
          if (t?.transaction_id) byId.set(t.transaction_id, t)
        }
        offset += (page.transactions || []).length
        hasMore = offset < Number(page.total_transactions || 0)
      }

      for (const t of byId.values()) {
        // Plaid: positive amount = money out. Claris: expense negative, income positive.
        const plaidAmt = Number(t.amount) || 0
        const amount = -plaidAmt
        const accountName =
          t.account_id && Array.isArray(bal.accounts)
            ? (() => {
                const a = bal.accounts.find((x: any) => x.account_id === t.account_id)
                if (!a) return item.institution_name || "Bank"
                return `${a.name || a.official_name || "Account"}${a.mask ? ` · ${a.mask}` : ""}`
              })()
            : item.institution_name || "Bank"

        const detail =
          t.merchant_name ||
          t.name ||
          t.original_description ||
          "Transaction"

        const cat =
          t.personal_finance_category?.primary ||
          (Array.isArray(t.category) ? t.category[0] : null) ||
          null

        allTxs.push({
          date: String(t.date || t.authorized_date || "").slice(0, 10),
          bank_account: accountName,
          detail: String(detail),
          category: cat ? String(cat) : null,
          amount,
          daily_balance: null,
          pending: Boolean(t.pending),
          transaction_id: t.transaction_id,
          pending_transaction_id: t.pending_transaction_id ?? null,
        })
      }
    } catch (e: any) {
      // One bad item should not kill the whole feed.
      console.error("plaid sync item failed", item.item_id, e?.message)
    }
  }

  allTxs.sort((a, b) => String(b.date).localeCompare(String(a.date)))

  return NextResponse.json(
    {
      total_balance: Math.round(total * 100) / 100,
      accounts: allAccounts,
      transactions: allTxs,
      as_of: new Date().toISOString(),
      source: "plaid",
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
