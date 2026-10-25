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
  type: string | null
  account_id?: string
  mask?: string | null
}

function accountKey(a: { account_id?: string; name?: string; mask?: string | null; institution?: string | null }) {
  if (a.account_id) return `id:${a.account_id}`
  const mask = a.mask ? String(a.mask) : ""
  const name = String(a.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const inst = String(a.institution || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return `nm:${inst}|${name}|${mask}`
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

  // Dedupe items: same institution linked more than once (re-Link) would
  // double-count balances. Keep the newest row per institution_name.
  const seenInst = new Set<string>()
  const uniqueItems = []
  for (const item of items) {
    const key = String(item.institution_name || item.item_id).toLowerCase()
    if (seenInst.has(key)) continue
    seenInst.add(key)
    uniqueItems.push(item)
  }

  const acctByKey = new Map<string, OutAccount>()
  const txById = new Map<string, OutTx>()
  const txNoId: OutTx[] = []

  for (const item of uniqueItems) {
    try {
      const bal = await plaidFetch<{ accounts: any[] }>("/accounts/balance/get", {
        access_token: item.access_token,
      })
      for (const a of bal.accounts || []) {
        const mask = a.mask ? String(a.mask) : null
        const name =
          a.official_name || a.name || mask
            ? `${a.name || a.official_name || "Account"}${mask ? ` · ${mask}` : ""}`
            : "Account"
        const current =
          typeof a.balances?.current === "number"
            ? a.balances.current
            : typeof a.balances?.available === "number"
              ? a.balances.available
              : 0
        const key = accountKey({
          account_id: a.account_id,
          name,
          mask,
          institution: item.institution_name,
        })
        // Last write wins (same account from one item only after item dedupe).
        acctByKey.set(key, {
          name,
          current_balance: current,
          institution: item.institution_name || a.official_name || null,
          type: typeof a.type === "string" ? a.type : null,
          account_id: a.account_id,
          mask,
        })
      }

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

        const detail = t.merchant_name || t.name || t.original_description || "Transaction"
        const cat =
          t.personal_finance_category?.primary ||
          (Array.isArray(t.category) ? t.category[0] : null) ||
          null

        const out: OutTx = {
          date: String(t.date || t.authorized_date || "").slice(0, 10),
          bank_account: accountName,
          detail: String(detail),
          category: cat ? String(cat) : null,
          amount,
          daily_balance: null,
          pending: Boolean(t.pending),
          transaction_id: t.transaction_id,
          pending_transaction_id: t.pending_transaction_id ?? null,
        }
        if (t.transaction_id) txById.set(String(t.transaction_id), out)
        else txNoId.push(out)
      }
    } catch (e: any) {
      console.error("plaid sync item failed", item.item_id, e?.message)
    }
  }

  const allAccounts = Array.from(acctByKey.values())
  let total = 0
  for (const a of allAccounts) {
    if (a.type === "depository" || !a.type) total += Number(a.current_balance) || 0
  }

  const allTxs = [...txById.values(), ...txNoId].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  )

  return NextResponse.json(
    {
      total_balance: Math.round(total * 100) / 100,
      accounts: allAccounts,
      transactions: allTxs,
      as_of: new Date().toISOString(),
      source: "plaid",
      items_synced: uniqueItems.length,
      items_skipped_dup: items.length - uniqueItems.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
