import { NextResponse } from "next/server"
import { loadTokens } from "../_helpers"

// GET /api/gdrive/status
// Devuelve si Google Drive está conectado.
export const dynamic = "force-dynamic"

export async function GET() {
  const tokens = await loadTokens()
  if (!tokens) {
    return NextResponse.json({ connected: false })
  }
  return NextResponse.json({ connected: true })
}
