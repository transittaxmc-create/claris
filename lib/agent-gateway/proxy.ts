import { NextResponse } from "next/server"

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

/** Forwards only authenticated machine-agent requests to the CRM Supabase Edge Function. */
export async function proxyAgentGateway(request: Request, forcedOperation?: string) {
  const endpoint = process.env.CRM_AGENT_GATEWAY_URL
  if (!endpoint) return json({ ok: false, error: "agent_gateway_upstream_not_configured" }, 503)

  const key = request.headers.get("x-agent-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") ?? ""
  if (!key || key.length < 40 || key.length > 200) {
    return json({ ok: false, error: "agent_authentication_required" }, 401)
  }

  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > 32_768) return json({ ok: false, error: "request_too_large" }, 413)

  const target = new URL(endpoint)
  const incoming = new URL(request.url)
  const operation = forcedOperation ?? incoming.searchParams.get("op")
  if (operation) target.searchParams.set("op", operation)

  const headers = new Headers({
    "x-agent-key": key,
    "cache-control": "no-store",
  })
  const requestId = request.headers.get("x-request-id")
  if (requestId) headers.set("x-request-id", requestId)
  if (request.method !== "GET") headers.set("content-type", "application/json")

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    ...(request.method === "GET" ? {} : { body: await request.text() }),
    cache: "no-store",
    redirect: "manual",
  })
  const responseHeaders = new Headers()
  responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json")
  responseHeaders.set("cache-control", "no-store")
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  })
}
