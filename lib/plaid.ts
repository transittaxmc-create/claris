// Plaid helpers for Claris (DINERO bank feed).
// Credentials live only in Vercel env. Access tokens live in Supabase plaid_items.

export type PlaidEnv = "sandbox" | "development" | "production"

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
}

export function plaidEnv(): PlaidEnv {
  const e = (process.env.PLAID_ENV || "production").toLowerCase()
  if (e === "sandbox" || e === "development" || e === "production") return e
  return "production"
}

export function plaidBaseUrl(): string {
  switch (plaidEnv()) {
    case "sandbox":
      return "https://sandbox.plaid.com"
    case "development":
      return "https://development.plaid.com"
    default:
      return "https://production.plaid.com"
  }
}

export async function plaidFetch<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const client_id = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  if (!client_id || !secret) throw new Error("plaid_not_configured")

  const res = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, secret, ...body }),
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof json?.error_message === "string"
        ? json.error_message
        : typeof json?.error_code === "string"
          ? json.error_code
          : `plaid_http_${res.status}`
    const err = new Error(msg) as Error & { status?: number; body?: unknown }
    err.status = res.status
    err.body = json
    throw err
  }
  return json as T
}

function supa() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !token) return null
  return { url, token }
}

export type PlaidItemRow = {
  item_id: string
  access_token: string
  institution_name: string | null
  accounts: unknown
  cursor: string | null
  updated_at?: string
}

export async function listPlaidItems(): Promise<PlaidItemRow[]> {
  const s = supa()
  if (!s) return []
  const res = await fetch(`${s.url}/rest/v1/plaid_items?select=*&order=updated_at.desc`, {
    headers: { apikey: s.token, Authorization: `Bearer ${s.token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const rows = (await res.json()) as PlaidItemRow[]
  return Array.isArray(rows) ? rows : []
}

export async function upsertPlaidItem(row: {
  item_id: string
  access_token: string
  institution_name?: string | null
  accounts?: unknown
  cursor?: string | null
}): Promise<void> {
  const s = supa()
  if (!s) throw new Error("supabase_not_configured")
  const res = await fetch(`${s.url}/rest/v1/plaid_items`, {
    method: "POST",
    headers: {
      apikey: s.token,
      Authorization: `Bearer ${s.token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      item_id: row.item_id,
      access_token: row.access_token,
      institution_name: row.institution_name ?? null,
      accounts: row.accounts ?? [],
      cursor: row.cursor ?? null,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`plaid_items_upsert_failed:${res.status}:${t.slice(0, 200)}`)
  }
}

export async function updatePlaidCursor(item_id: string, cursor: string | null): Promise<void> {
  const s = supa()
  if (!s) return
  await fetch(`${s.url}/rest/v1/plaid_items?item_id=eq.${encodeURIComponent(item_id)}`, {
    method: "PATCH",
    headers: {
      apikey: s.token,
      Authorization: `Bearer ${s.token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ cursor, updated_at: new Date().toISOString() }),
    cache: "no-store",
  })
}
