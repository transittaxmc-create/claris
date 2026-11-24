"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, X } from "lucide-react"
import { scanDispatchPhoto, type DispatchScan } from "./dispatch-scan"

/**
 * Botón flotante de cámara del flujo foto → TODAY (Miguel, 2026-11-24):
 * vive en TODAS las pantallas, se ARRASTRA a la esquina que Miguel quiera
 * y recuerda dónde quedó (localStorage). Un toque (sin arrastrar) abre el
 * selector de foto; la lectura llena TODAY y la app salta a esa pantalla.
 * No añade filas ni cambia la geometría de ninguna pantalla.
 */

const POS_KEY = "claris_dispatch_fab_pos"
const SIZE = 56

type Pos = { x: number; y: number }

function clampPos(p: Pos): Pos {
  if (typeof window === "undefined") return p
  const maxX = Math.max(8, window.innerWidth - SIZE - 8)
  const maxY = Math.max(8, window.innerHeight - SIZE - 8)
  return {
    x: Math.min(Math.max(8, p.x), maxX),
    y: Math.min(Math.max(8, p.y), maxY),
  }
}

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 300, y: 500 }
  // Esquina inferior derecha, por encima de la barra de navegación.
  return clampPos({ x: window.innerWidth - SIZE - 16, y: window.innerHeight - SIZE - 120 })
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p?.x === "number" && typeof p?.y === "number") return clampPos(p)
    }
  } catch {}
  return defaultPos()
}

export function DispatchFab({
  onDispatch,
  onClose,
}: {
  /** Devuelve un mensaje de error para mostrar, o null si el llenado va en camino. */
  onDispatch: (scan: DispatchScan) => string | null
  /** Cierre desde el propio botón: desaparece por completo hasta que
   *  Miguel lo vuelva a encender desde la hoja "Más". */
  onClose: () => void
}) {
  const [pos, setPos] = useState<Pos | null>(null)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null)
  const avisoTimer = useRef<number | null>(null)

  useEffect(() => {
    setPos(loadPos())
    const onResize = () => setPos((p) => (p ? clampPos(p) : p))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  function showAviso(texto: string) {
    setAviso(texto)
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(null), 4500)
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (busy || !pos) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 7) return
    d.moved = true
    setPos(clampPos({ x: d.baseX + dx, y: d.baseY + dy }))
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.moved) {
      // Arrastró: se guarda dónde quedó y NO se abre el selector.
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p))
          } catch {}
        }
        return p
      })
      return
    }
    // Toque limpio: elegir la foto del trabajo.
    fileRef.current?.click()
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    try {
      const scan = await scanDispatchPhoto(file)
      const err = onDispatch(scan)
      if (err) showAviso(err)
    } catch (err) {
      showAviso(err instanceof Error ? err.message : "Could not read the photo — try again")
    } finally {
      setBusy(false)
    }
  }

  if (!pos) return null

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />
      {aviso && (
        <div
          className="fixed z-40 max-w-[240px] rounded-xl border border-rose-500/40 bg-neutral-900 px-3 py-2 text-[11px] font-semibold text-rose-300 shadow-xl"
          style={{
            left: Math.max(8, Math.min(pos.x, window.innerWidth - 248)),
            top: Math.max(8, pos.y - 8),
            transform: "translateY(-100%)",
          }}
          role="alert"
        >
          {aviso}
        </div>
      )}
      <div className="fixed z-40" style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}>
        <button
          type="button"
          aria-label="Fill TODAY from a dispatch photo — drag to move"
          title="Photo → TODAY (drag to move)"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          disabled={busy}
          className="flex items-center justify-center rounded-full border border-black/30 bg-yellow-400 text-black shadow-xl shadow-black/40 active:scale-[0.97] disabled:opacity-70"
          style={{ width: SIZE, height: SIZE, touchAction: "none" }}
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </button>
        {/* Cierre desde el propio botón: desaparece por completo. */}
        <button
          type="button"
          aria-label="Hide the photo button"
          title="Hide"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 shadow-md active:scale-95"
        >
          <X className="size-3" />
        </button>
      </div>
    </>
  )
}
