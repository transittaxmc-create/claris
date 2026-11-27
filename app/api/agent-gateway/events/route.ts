import { proxyAgentGateway } from "@/lib/agent-gateway/proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Event writes are authenticated and persisted by the Supabase Agent Gateway. */
export async function POST(request: Request) {
  return proxyAgentGateway(request)
}
