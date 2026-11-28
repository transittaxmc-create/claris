"use client"

/**
 * Fotos de cliente/reserva — la MISMA lógica de producción
 * (lib/crm/crm-photos.ts: copia local inmediata en este dispositivo +
 * subida al bucket privado con URL firmada al abrir), con el traje
 * visual del prototipo. Las fotos NUNCA viven en localStorage como
 * datos: solo la copia local del dispositivo y la nube.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  deleteCloudPhoto,
  deleteLocalPhoto,
  fileToDownscaledDataUrl,
  getLocalPhotoDataUrl,
  saveLocalPhotoDataUrl,
  signedPhotoUrl,
  uploadPhotoToCloud,
} from "@/lib/crm/crm-photos"
import { crmSupabaseBrowser } from "@/lib/crm/supabase-browser"
import type { CrmPhoto } from "@/lib/crm/crm-cloud"
import { tx } from "./i18n"

export function CrmPhotosBlock({
  photos,
  kind,
  recordId,
  userId,
  onChange,
}: {
  photos: CrmPhoto[]
  kind: "clients" | "reservations"
  recordId: string
  userId: string
  onChange: (photos: CrmPhoto[]) => void
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const fileRef = useRef<HTMLInputElement | null>(null)
  const photosKey = photos.map((p) => p.id + ":" + (p.path ? "c" : "l")).join(",")

  const resolveUrls = useCallback(async () => {
    const sb = crmSupabaseBrowser()
    const next: Record<string, string> = {}
    for (const photo of photos) {
      const local = getLocalPhotoDataUrl(photo.id)
      if (local) next[photo.id] = local
      if (photo.path && sb && userId) {
        const signed = await signedPhotoUrl(sb, photo.path)
        if (signed) next[photo.id] = signed
      }
    }
    setUrls(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey, userId])

  useEffect(() => {
    void resolveUrls()
  }, [resolveUrls])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setNote("")
    const sb = crmSupabaseBrowser()
    const added: CrmPhoto[] = []
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToDownscaledDataUrl(file)
        const photo: CrmPhoto = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
          path: "",
          caption: file.name || "photo.jpg",
          createdAt: new Date().toISOString(),
        }
        saveLocalPhotoDataUrl(photo.id, dataUrl)
        if (sb && userId) {
          const path = await uploadPhotoToCloud(sb, userId, kind, recordId, photo.id, dataUrl)
          if (path) photo.path = path
        }
        added.push(photo)
      } catch {
        setNote(tx("A photo could not be added."))
      }
    }
    setBusy(false)
    if (added.length > 0) onChange([...photos, ...added])
  }

  async function handleRemove(photo: CrmPhoto) {
    deleteLocalPhoto(photo.id)
    const sb = crmSupabaseBrowser()
    if (photo.path && sb) await deleteCloudPhoto(sb, photo.path)
    onChange(photos.filter((p) => p.id !== photo.id))
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ position: "relative", width: 76, height: 76 }}>
            {urls[photo.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[photo.id]} alt={photo.caption} style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 76, height: 76, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🖼️</div>
            )}
            <button
              type="button"
              aria-label={tx("Remove photo")}
              onClick={() => void handleRemove(photo)}
              style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, background: "var(--red, #E64B55)", color: "#fff", border: "none", fontSize: 13, lineHeight: 1, cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          style={{ width: 76, height: 76, borderStyle: "dashed", fontSize: 22 }}
        >
          {busy ? "…" : "+"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void handleFiles(e.target.files); e.target.value = "" }} />
      <div className="mini" style={{ marginTop: 6 }}>
        {tx("Saved on this device right away; they upload to your cloud when you are signed in.")}
      </div>
      {note && <div className="mini" style={{ color: "var(--red, #E64B55)" }}>{note}</div>}
    </div>
  )
}
