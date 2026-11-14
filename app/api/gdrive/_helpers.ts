import { NextResponse } from "next/server"
import { list } from "@vercel/blob"

// Helpers compartidos entre las rutas de Google Drive.
export const dynamic = "force-dynamic"

const TOKEN_BLOB_NAME = "gdrive-tokens.json"

export interface GDriveTokens {
  access_token: string
  refresh_token: string
  expiry: number
}

/** Lee los tokens almacenados en Vercel Blob. null = no conectado. */
export async function loadTokens(): Promise<GDriveTokens | null> {
  try {
    const { blobs } = await list({ prefix: TOKEN_BLOB_NAME })
    const blob = blobs.find((b) => b.pathname === TOKEN_BLOB_NAME)
    if (!blob) return null
    const res = await fetch(blob.url, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as GDriveTokens
  } catch {
    return null
  }
}

/** Refresca el access_token si está expirado o a punto de expirar. */
export async function freshAccessToken(tokens: GDriveTokens): Promise<string> {
  // Refrescar si expira en menos de 5 min
  if (Date.now() < tokens.expiry - 5 * 60 * 1000) {
    return tokens.access_token
  }
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  return data.access_token
}

/** Obtiene (o crea) la carpeta "Copiloto_Auditoria_Recibos" en Drive. */
export async function ensureDriveFolder(accessToken: string): Promise<string> {
  const folderName = "Copiloto_Auditoria_Recibos"
  // Buscar si ya existe
  const q = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  )
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  )
  if (!searchRes.ok) throw new Error(`Drive search failed: ${searchRes.status}`)
  const { files } = (await searchRes.json()) as { files: { id: string }[] }
  if (files.length > 0) return files[0].id

  // Crear la carpeta
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  })
  if (!createRes.ok) throw new Error(`Drive create folder failed: ${createRes.status}`)
  const folder = (await createRes.json()) as { id: string }
  return folder.id
}
