import { proxyAgentGateway } from "@/lib/agent-gateway/proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return proxyAgentGateway(request)
}

export async function POST(request: Request) {
  return proxyAgentGateway(request)
}
