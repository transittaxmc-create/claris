import { NextResponse } from "next/server"
import { loadTokens, freshAccessToken, ensureDriveFolder } from "../_helpers"

// GET /api/gdrive/restore?filename=copiloto-respaldo-latest.json
// Descarga el backup más reciente de la carpeta de Drive.
// Si se pasa ?filename=X, descarga ese archivo en particular.
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const tokens = await loadTokens()
  if (!tokens) {
    return NextResponse.json({ error: "gdrive_no_conectado" }, { status: 401 })
  }

  const url = new URL(request.url)
  const targetName = url.searchParams.get("filename") // null = el más reciente

  try {
    const accessToken = await freshAccessToken(tokens)
    const folderId = await ensureDriveFolder(accessToken)

    // Buscar archivos de respaldo en la carpeta, ordenados por fecha desc
    const q = encodeURIComponent(
      `'${folderId}' in parents and name contains 'copiloto-respaldo' and trashed=false`,
    )
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    )
    if (!listRes.ok) {
      return NextResponse.json({ error: "drive_list_fallido" }, { status: 502 })
    }
    const { files } = (await listRes.json()) as {
      files: { id: string; name: string; createdTime: string; size?: string }[]
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "sin_respaldos" }, { status: 404 })
    }

    // Si ?list=1, solo devolver la lista de archivos disponibles
    if (url.searchParams.get("list") === "1") {
      return NextResponse.json({ files })
    }

    // Elegir el archivo
    const target = targetName ? files.find((f) => f.name === targetName) : files[0]
    if (!target) {
      return NextResponse.json({ error: "archivo_no_encontrado" }, { status: 404 })
    }

    // Descargar el contenido del archivo
    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${target.id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    )
    if (!dlRes.ok) {
      return NextResponse.json({ error: "drive_descarga_fallida" }, { status: 502 })
    }

    const content = await dlRes.text()
    return NextResponse.json({ ok: true, filename: target.name, content })
  } catch (e) {
    console.error("[gdrive/restore]", e)
    return NextResponse.json({ error: "error_del_servidor" }, { status: 502 })
  }
}
