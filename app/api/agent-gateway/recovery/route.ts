import { proxyAgentGateway } from "@/lib/agent-gateway/proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Authenticated, dynamic recovery from the persisted Supabase event store. */
export async function GET(request: Request) {
  return proxyAgentGateway(request, "continuity")
}
