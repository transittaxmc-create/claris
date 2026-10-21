import { NextResponse } from "next/server"
import {
  listPlaidItems,
  plaidConfigured,
  plaidFetch,
  updatePlaidCursor,
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

      // Transactions: /transactions/sync includes pending when available.
      let cursor: string | null = item.cursor
      let hasMore = true
      const added: any[] = []
      const modified: any[] = []
      const removed: string[] = []
      let guard = 0
      while (hasMore && guard < 20) {
        guard += 1
        const page = await plaidFetch<{
          added: any[]
          modified: any[]
          removed: { transaction_id: string }[]
          next_cursor: string
          has_more: boolean
        }>("/transactions/sync", {
          access_token: item.access_token,
          cursor: cursor || undefined,
          count: 500,
          options: { include_personal_finance_category: true },
        })
        added.push(...(page.added || []))
        modified.push(...(page.modified || []))
        for (const r of page.removed || []) {
          if (r?.transaction_id) removed.push(r.transaction_id)
        }
        cursor = page.next_cursor
        hasMore = Boolean(page.has_more)
      }
      if (cursor) await updatePlaidCursor(item.item_id, cursor)

      const byId = new Map<string, any>()
      for (const t of [...added, ...modified]) {
        if (t?.transaction_id) byId.set(t.transaction_id, t)
      }
      for (const id of removed) byId.delete(id)

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
