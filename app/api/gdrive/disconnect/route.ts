import { NextResponse } from "next/server"
import { list, del } from "@vercel/blob"

// DELETE /api/gdrive/disconnect
// Borra los tokens de Google Drive del Vercel Blob.
export const dynamic = "force-dynamic"

const TOKEN_BLOB_NAME = "gdrive-tokens.json"

export async function DELETE() {
  try {
    const { blobs } = await list({ prefix: TOKEN_BLOB_NAME })
    const blob = blobs.find((b) => b.pathname === TOKEN_BLOB_NAME)
    if (blob) await del(blob.url)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}
