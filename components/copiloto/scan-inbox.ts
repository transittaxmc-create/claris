/**
 * Cliente del buzón de fotos del escáner (ver app/api/scan-inbox/route.ts):
 * el atajo de iOS deja el screenshot en el buzón y la app, al abrir o al
 * volver a primer plano, pregunta si hay algo esperando. Recoger la foto
 * la borra del buzón (se entrega una sola vez).
 */

export type ScanInboxItem = { id: string; uploadedAt: string }

export async function checkScanInbox(): Promise<ScanInboxItem[]> {
  try {
    const r = await fetch("/api/scan-inbox", { cache: "no-store" })
    if (!r.ok) return []
    const j = await r.json().catch(() => null)
    const pending = Array.isArray(j?.pending) ? j.pending : []
    return pending
      .filter((x: any) => x && typeof x.id === "string")
      .map((x: any) => ({ id: x.id, uploadedAt: String(x.uploadedAt || "") }))
  } catch {
    return []
  }
}

export async function pickupScanInboxFile(id: string): Promise<File> {
  const r = await fetch(`/api/scan-inbox?id=${encodeURIComponent(id)}`, { cache: "no-store" })
  if (!r.ok) throw new Error("inbox_pickup_failed")
  const blob = await r.blob()
  return new File([blob], "scan-inbox.jpg", { type: blob.type || "image/jpeg" })
}
