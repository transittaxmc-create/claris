/**
 * Flujo foto → TODAY (Miguel, 2026-11-24): la foto de la pantalla de
 * despacho de un trabajo (Classic Ryde / Limosys y similares) se lee con el
 * MISMO endpoint del escáner de recibos (/api/scan-receipt, kind:"trip") y
 * el resultado llena el borrador de TODAY. Nada se guarda solo: Miguel
 * revisa el formulario llenado y toca el SAVE de siempre.
 */
import { normalizePlatformName, type Trip } from "./types"
import { isVoucherPlatform } from "./platform-meta"
import { appendNote } from "./toll-detect"

export type DispatchScan = {
  company?: string
  date?: string
  time?: string
  amount: number
  passenger?: string
  pickup?: string
  dropoff?: string
  voucherNo?: string
  confNo?: string
  refId?: string
  fop?: string
  pax?: number
  lug?: number
  classType?: string
  dispatchPhone?: string
  confidence?: number
}

/** Reduce la foto igual que el escáner de recibos (máx. 1600px, JPEG 0.82). */
function reducir(file: File, maxDim = 1600): Promise<{ image: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const c = document.createElement("canvas")
        c.width = width
        c.height = height
        const ctx = c.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not prepare image"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ image: c.toDataURL("image/jpeg", 0.82), mimeType: "image/jpeg" })
      }
      img.onerror = () => reject(new Error("Could not read photo"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Could not open file"))
    reader.readAsDataURL(file)
  })
}

/** Lee la foto de despacho con la IA (mismo endpoint y reintento que el escáner). */
export async function scanDispatchPhoto(file: File): Promise<DispatchScan> {
  const { image, mimeType } = await reducir(file)
  let lastError = "Could not analyze document"
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType, kind: "trip" }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && json.result) {
        const r = json.result
        return {
          company: r.company || undefined,
          date: r.date || undefined,
          time: r.time || undefined,
          amount: Number(r.amount) || 0,
          passenger: r.passenger || undefined,
          pickup: r.pickup || undefined,
          dropoff: r.dropoff || undefined,
          voucherNo: r.voucherNo || undefined,
          confNo: r.confNo || undefined,
          refId: r.refId || undefined,
          fop: r.fop || undefined,
          pax: typeof r.pax === "number" ? r.pax : undefined,
          lug: typeof r.lug === "number" ? r.lug : undefined,
          classType: r.classType || undefined,
          dispatchPhone: r.dispatchPhone || undefined,
          confidence: typeof r.confidence === "number" ? r.confidence : undefined,
        }
      }
      lastError = json?.error || lastError
      if (res.status >= 400 && res.status < 500) break // error real: no reintentar
    } catch {
      // caída de conexión: se reintenta una vez, como en el escáner
    }
  }
  throw new Error(lastError)
}

/** Línea de notas con el detalle del despacho (pasajero, conf, voucher, FOP…). */
export function buildDispatchNotes(scan: DispatchScan): string {
  const parts: string[] = []
  if (scan.passenger) parts.push(`Passenger: ${scan.passenger}`)
  if (scan.confNo) parts.push(`Conf# ${scan.confNo}`)
  if (scan.voucherNo) parts.push(`Voucher ${scan.voucherNo}`)
  if (scan.refId) parts.push(`RefId ${scan.refId}`)
  if (scan.fop) parts.push(`FOP: ${scan.fop}`)
  if (scan.classType) parts.push(`Class ${scan.classType}`)
  if (scan.pax != null || scan.lug != null) parts.push(`Pax/Lug ${scan.pax ?? "?"}${"/"}${scan.lug ?? "?"}`)
  if (scan.dispatchPhone) parts.push(`Dispatch ${scan.dispatchPhone}`)
  return parts.join(" · ")
}

/**
 * Aplica la lectura al borrador de TODAY. Solo pisa los campos que la foto
 * trae; lo demás del borrador (peajes GPS, notas previas) queda intacto.
 * La fecha/hora del trabajo viaja en raw.datetime (hora local ingenua),
 * que es de donde tripDateOf saca el día del viaje al guardar.
 */
export function applyDispatchToTrip(scan: DispatchScan, base: Trip): Trip {
  const next: Trip = { ...base }
  if (scan.company) {
    const platform = normalizePlatformName(scan.company)
    next.platform = platform
    // Una plataforma de vale marca el viaje VOUCHER sola (regla de siempre).
    next.isVoucher = isVoucherPlatform(platform)
  }
  if (scan.amount > 0) next.earnings = Math.round(scan.amount * 100) / 100
  if (scan.pickup) next.pickup = scan.pickup
  if (scan.dropoff) next.dropoff = scan.dropoff
  if (scan.time) next.time = scan.time
  // El número de voucher es la identidad del trabajo: va en REF / INVOICE.
  if (scan.voucherNo) next.ref = scan.voucherNo
  const notesLine = buildDispatchNotes(scan)
  if (notesLine) {
    const t = next as Trip & { notes?: string }
    t.notes = appendNote(t.notes, notesLine)
  }
  // El detalle completo también queda en raw.dispatchNotes: el campo
  // `notes` del viaje es de sesión (el serializador actual no lo
  // persiste), pero raw sí viaja en el registro guardado — así el
  // detalle y el anti-duplicado por Conf#/RefId sobreviven a recargar.
  const raw: Record<string, unknown> = { ...(base.raw ?? {}) }
  if (notesLine) raw.dispatchNotes = notesLine
  if (scan.date) {
    const hhmm = scan.time && /^\d{1,2}:\d{2}$/.test(scan.time) ? scan.time : "00:00"
    raw.datetime = `${scan.date}T${hhmm}:00`
  }
  next.raw = raw
  return next
}

/**
 * Anti-duplicado del flujo: si el voucher o el Conf# de la foto ya están en
 * un viaje guardado, se devuelve ese viaje y NO se llena nada (el mismo
 * trabajo no entra dos veces).
 */
export function findDispatchDuplicate(trips: Trip[], scan: DispatchScan): Trip | null {
  const keys = [scan.voucherNo, scan.confNo].filter((k): k is string => Boolean(k))
  if (!keys.length) return null
  for (const t of trips) {
    const notes = (t as Trip & { notes?: string }).notes || ""
    const rawText = (() => {
      try {
        return JSON.stringify(t.raw ?? {})
      } catch {
        return ""
      }
    })()
    for (const k of keys) {
      if (t.ref === k || notes.includes(k) || rawText.includes(k)) return t
    }
  }
  return null
}
