"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Platform } from "./types"
import { platformInitials, platformMeta } from "./platform-meta"

// Logo circular de la plataforma. Si el archivo no existe o falla la carga,
// cae a las iniciales, así el desplegable nunca queda con un hueco vacío.
export function PlatformAvatar({
  platform,
  size = 24,
  className,
}: {
  platform: Platform
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const meta = platformMeta(platform)
  const initials = platformInitials(platform)

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 ring-1 ring-black/20",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {meta.logo && !failed ? (
        <img
          src={meta.logo}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      ) : (
        <span
          className="font-bold leading-none text-black"
          style={{ fontSize: Math.max(8, Math.round(size * 0.42)) }}
        >
          {initials}
        </span>
      )}
    </span>
  )
}

// Distintivo de la plataforma (ACCESS-A-RIDE / VOUCHER). No renderiza nada si
// la plataforma no tiene uno.
export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const meta = platformMeta(platform)
  if (!meta.badge) return null
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none",
        meta.badgeClass ?? "border-neutral-600 text-neutral-400",
        className,
      )}
    >
      {meta.badge}
    </span>
  )
}
