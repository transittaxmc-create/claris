import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DOCUMENTS = [
  "docs/copiloto-v7-master/README.md",
  "docs/copiloto-v7-master/FOCUS-AND-EXECUTION-BASELINE.md",
  "docs/copiloto-v7-master/CURRENT-STATE.md",
  "docs/copiloto-v7-master/AGENT-HANDOFF.md",
  "docs/copiloto-v7-master/DECISION-LOG.md",
  "docs/copiloto-v7-master/AGENT-GATEWAY.md",
  "docs/copiloto-v7-master/CONTINUITY-REGISTER.json",
] as const

/** Public read-only: only versioned documents already in this public repository. */
export async function GET() {
  try {
    const documents = await Promise.all(DOCUMENTS.map(async (path) => ({
      path,
      content: await readFile(join(process.cwd(), path), "utf8"),
    })))
    return NextResponse.json({
      ok: true,
      project: "copiloto-v7",
      access: "public-read-only",
      eventStore: "not_configured",
      writeOperations: "disabled",
      documents,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json(
      { ok: false, error: "continuity_source_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
