// Metadatos de presentación de cada plataforma: logo, distintivo y color.
//
// Los logos son propiedad del cliente y viven en /public/logos (ver
// NOTA_LEEME.txt que acompañaba a los archivos originales).
import type { Platform } from "./types"

export type PlatformMeta = {
  // Ruta del logo en /public. Si falta, el componente cae a las iniciales.
  logo?: string
  // Distintivo que se muestra junto al nombre. "ACCESS-A-RIDE" para los
  // servicios de acceso, "VOUCHER" para los que pagan con vale.
  badge?: string
  // Color del distintivo, para diferenciar de un vistazo.
  badgeClass?: string
  // Si la plataforma paga con vale, el viaje se marca isVoucher solo. Así el
  // distintivo de la lista y el VOUCHER de la tarjeta no pueden contradecirse.
  voucher?: boolean
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  Uber: { logo: "/logos/uber.jpg" },
  Lyft: { logo: "/logos/lyft.jpg" },
  "Eco Ride": {
    logo: "/logos/eco-ride.jpg",
    badge: "ACCESS-A-RIDE",
    badgeClass: "border-sky-400/60 text-sky-400",
  },
  Throo: { logo: "/logos/throo.jpg" },
  "AKI Technology": {
    logo: "/logos/aki-technology.jpg",
    badge: "ACCESS-A-RIDE",
    badgeClass: "border-sky-400/60 text-sky-400",
  },
  "Classic Ryde": {
    logo: "/logos/classic-ryde.jpg",
    badge: "VOUCHER",
    badgeClass: "border-orange-400/60 text-orange-400",
    voucher: true,
  },
  "Aventus Ride": {
    logo: "/logos/aventus-ride.jpg",
    badge: "VOUCHER",
    badgeClass: "border-orange-400/60 text-orange-400",
    voucher: true,
  },
  Cash: {},
  Other: {},
}

// Plataformas que pagan con vale: el viaje se marca isVoucher al elegirlas.
export const VOUCHER_PLATFORMS: Platform[] = (Object.keys(PLATFORM_META) as Platform[]).filter(
  (p) => PLATFORM_META[p].voucher === true,
)

export function isVoucherPlatform(platform: Platform): boolean {
  return PLATFORM_META[platform]?.voucher === true
}

export function platformMeta(platform: Platform): PlatformMeta {
  return PLATFORM_META[platform] ?? {}
}

// Iniciales de respaldo cuando no hay logo o la imagen no carga.
// "Eco Ride" -> "ER", "AKI Technology" -> "AT", "Uber" -> "U".
export function platformInitials(platform: Platform): string {
  const words = platform.split(/[\s-]+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}
