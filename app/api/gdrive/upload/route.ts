import { NextResponse } from "next/server"
import { loadTokens, freshAccessToken, ensureDriveFolder } from "../_helpers"

// POST /api/gdrive/upload
// Body: { filename: string; content: string; mimeType?: string }
// Sube (o sobreescribe) un archivo a la carpeta "Copiloto_Auditoria_Recibos"
// en el Google Drive del usuario.
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const tokens = await loadTokens()
  if (!tokens) {
    return NextResponse.json({ error: "gdrive_no_conectado" }, { status: 401 })
  }

  let body: { filename?: unknown; content?: unknown; mimeType?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 })
  }

  const { filename, content, mimeType = "application/json" } = body
  if (typeof filename !== "string" || !filename) {
    return NextResponse.json({ error: "filename_requerido" }, { status: 400 })
  }
  if (typeof content !== "string" || !content) {
    return NextResponse.json({ error: "content_requerido" }, { status: 400 })
  }

  try {
    const accessToken = await freshAccessToken(tokens)
    const folderId = await ensureDriveFolder(accessToken)

    // Ver si ya existe un archivo con ese nombre en la carpeta (para sobreescribir)
    const q = encodeURIComponent(
      `name='${filename}' and '${folderId}' in parents and trashed=false`,
    )
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    )
    const { files } = searchRes.ok
      ? ((await searchRes.json()) as { files: { id: string }[] })
      : { files: [] }

    const fileBytes = Buffer.from(content, "utf-8")
    const boundary = "copiloto_boundary_xK9zQ"
    const metaPart = JSON.stringify(
      files.length > 0
        ? { name: filename } // update: no cambiar carpeta
        : { name: filename, parents: [folderId] }, // create: en la carpeta
    )
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaPart}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n` +
      `--${boundary}--`

    let uploadUrl: string
    let uploadMethod: string
    if (files.length > 0) {
      // PATCH = actualizar existente
      uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`
      uploadMethod = "PATCH"
    } else {
      uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
      uploadMethod = "POST"
    }

    const uploadRes = await fetch(uploadUrl, {
      method: uploadMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(Buffer.byteLength(body, "utf-8")),
      },
      body,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      console.error("[gdrive/upload]", err)
      return NextResponse.json({ error: "drive_upload_fallido" }, { status: 502 })
    }

    const file = (await uploadRes.json()) as { id: string; name: string }
    return NextResponse.json({ ok: true, fileId: file.id, name: file.name })
  } catch (e) {
    console.error("[gdrive/upload]", e)
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}
