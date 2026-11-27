import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DOCS_ROOT = join(process.cwd(), "docs", "copiloto-v7-master")
const DOCUMENTS = [
  "README.md",
  "FOCUS-AND-EXECUTION-BASELINE.md",
  "CURRENT-STATE.md",
  "AGENT-HANDOFF.md",
  "DECISION-LOG.md",
  "AGENT-GATEWAY.md",
  "CONTINUITY-REGISTER.json",
] as const

/** Public read-only: only versioned documents already in this public repository. */
export async function GET() {
  try {
    const documents = await Promise.all(DOCUMENTS.map(async (path) => ({
      path,
      content: await readFile(join(DOCS_ROOT, path), "utf8"),
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
