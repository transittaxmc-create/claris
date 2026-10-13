// Auto-sync de viajes cerrados hacia el Dual Register.
//
// Cuando un viaje se guarda en claris, se envía a
// https://islandcity-register1.vercel.app/api/daily/import
// para que aparezca en el DAILY Entry Register.
//
// Tolerante a fallos: los ids pendientes viven en localStorage; si el envío
// falla, se reintenta en la próxima apertura. Nunca bloquea la UI.
// NO se envía ubicación GPS: solo plataforma, montos y fecha/hora del viaje.

import { grossOf, netOf, tripDateOf, type Trip } from "./types"

const DUAL_IMPORT_URL = "https://islandcity-register1.vercel.app/api/daily/import"
const QUEUE_KEY = "claris_dual_sync_queue"

export type DualTripPayload = {
  tripId: string
  platform: string
  gross: number
  net: number
  tips: number
  toll: number
  extraCash: number
  platformFee: number
  time: string
  date: string // YYYY-MM-DD
  source: "claris"
}

function loadQueue(): string[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

function saveQueue(q: string[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {}
}

function removeFromQueue(id: string): void {
  const q = loadQueue()
  const i = q.indexOf(id)
  if (i >= 0) {
    q.splice(i, 1)
    saveQueue(q)
  }
}

function payloadOf(t: Trip): DualTripPayload {
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
  return {
    tripId: t.id,
    platform: String(t.platform || ""),
    gross: r2(grossOf(t)),
    net: r2(netOf(t)),
    tips: r2(t.tips),
    toll: r2(t.toll),
    extraCash: r2(t.extraCash),
    platformFee: r2(t.platformFee),
    time: t.time || "",
    date: tripDateOf(t),
    source: "claris",
  }
}

async function sendTrip(t: Trip): Promise<boolean> {
  try {
    const res = await fetch(DUAL_IMPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadOf(t)),
    })
    if (res.ok) {
      removeFromQueue(t.id)
      return true
    }
    return false
  } catch {
    return false
  }
}

// Encola un viaje recién guardado y lo envía sin bloquear la UI.
export function queueDualSync(t: Trip): void {
  try {
    const q = loadQueue()
    if (!q.includes(t.id)) {
      q.push(t.id)
      saveQueue(q)
    }
  } catch {}
  void sendTrip(t)
}

// Reintenta los envíos pendientes (llamar al abrir la app).
export function flushDualSyncQueue(getTrip: (id: string) => Trip | undefined): void {
  const q = loadQueue()
  if (q.length === 0) return
  void (async () => {
    for (const id of [...q]) {
      const t = getTrip(id)
      if (!t) {
        removeFromQueue(id)
        continue
      }
      await sendTrip(t)
    }
  })()
}
