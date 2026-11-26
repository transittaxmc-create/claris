/**
 * Fotos de clientes del CRM (las que manda el cliente de su recogida o de
 * su vuelo). Dos capas, igual que el resto del CRM:
 *  - Local (siempre): los bytes viven como data URL en localStorage
 *    (`claris_crm_photos_v1`, mapa photoId → dataUrl), reducidos a máx.
 *    1024 px JPEG para no reventar la cuota del navegador.
 *  - Nube (con sesión): los bytes suben al bucket PRIVADO
 *    `crm-client-photos` del Supabase exclusivo del CRM, bajo la carpeta
 *    del dueño: "<user_id>/<clients|reservations>/<record_id>/<id>.jpg".
 *    Se ven con URL firmada temporal; el bucket no es público y las
 *    políticas de Storage solo dejan tocar la carpeta propia.
 * Los metadatos ({ id, path, caption, createdAt }) viajan en el récord
 * (columna jsonb `photos`); path = "" significa "aún solo en este aparato".
 */
import type { SupabaseClient } from "@supabase/supabase-js"

export const CRM_PHOTO_BUCKET = "crm-client-photos"
const LOCAL_PHOTO_STORE = "claris_crm_photos_v1"

type LocalPhotoMap = Record<string, string>

function readLocalMap(): LocalPhotoMap {
  try {
    const raw = localStorage.getItem(LOCAL_PHOTO_STORE)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? (parsed as LocalPhotoMap) : {}
  } catch {
    return {}
  }
}

function writeLocalMap(map: LocalPhotoMap) {
  try {
    localStorage.setItem(LOCAL_PHOTO_STORE, JSON.stringify(map))
  } catch {
    // Cuota llena: la foto queda sin caché local; la nube (si hay sesión)
    // sigue siendo la copia buena. No se rompe la pantalla por esto.
  }
}

export function getLocalPhotoDataUrl(photoId: string): string {
  return readLocalMap()[photoId] || ""
}

export function saveLocalPhotoDataUrl(photoId: string, dataUrl: string) {
  const map = readLocalMap()
  map[photoId] = dataUrl
  writeLocalMap(map)
}

export function deleteLocalPhoto(photoId: string) {
  const map = readLocalMap()
  if (photoId in map) {
    delete map[photoId]
    writeLocalMap(map)
  }
}

/** Reduce una imagen elegida por el usuario a data URL JPEG (máx. 1024 px). */
export async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxSide = 1024
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas_unavailable")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.72)
}

export function photoCloudPath(userId: string, kind: "clients" | "reservations", recordId: string, photoId: string): string {
  return `${userId}/${kind}/${recordId}/${photoId}.jpg`
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** Sube los bytes al bucket privado. Devuelve el path o null si falla. */
export async function uploadPhotoToCloud(
  sb: SupabaseClient,
  userId: string,
  kind: "clients" | "reservations",
  recordId: string,
  photoId: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const path = photoCloudPath(userId, kind, recordId, photoId)
    const blob = await dataUrlToBlob(dataUrl)
    const { error } = await sb.storage.from(CRM_PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true })
    if (error) return null
    return path
  } catch {
    return null
  }
}

/** URL firmada temporal para ver una foto de la nube. */
export async function signedPhotoUrl(sb: SupabaseClient, path: string): Promise<string> {
  if (!path) return ""
  try {
    const { data, error } = await sb.storage.from(CRM_PHOTO_BUCKET).createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) return ""
    return data.signedUrl
  } catch {
    return ""
  }
}

/** Borra el objeto de la nube (los metadatos los quita quien llama). */
export async function deleteCloudPhoto(sb: SupabaseClient, path: string): Promise<void> {
  if (!path) return
  try {
    await sb.storage.from(CRM_PHOTO_BUCKET).remove([path])
  } catch {}
}
