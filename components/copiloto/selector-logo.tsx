"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Platform } from "./types"
import { platformInitials, platformMeta } from "./platform-meta"

// Tratamiento por plataforma del SelectorLogo (ver el comentario del
// estándar dentro del componente): cómo se acomoda cada arte en la
// caja para que se vea limpio, centrado y fundido — nunca calcomanía.
type LogoTreatment = {
  fit?: "cover" | "contain"
  position?: string
  scale?: string
  // Color sólido del propio arte con el que se pinta la caja, para que
  // el fondo del logo y el de la caja sean UNO solo (caso AKI).
  boxBg?: string
}
const LOGO_TREATMENTS: Partial<Record<Platform, LogoTreatment>> = {
  "Aventus Ride": { fit: "cover", position: "object-[50%_50%]", scale: "scale-[1.05]" },
  "Eco Ride": { fit: "cover", position: "object-[50%_58%]" },
  "AKI Technology": { boxBg: "#666666" },
  "CO-OP Drive": { scale: "scale-[1.12]" },
  Jurny: { scale: "scale-[1.25]" },
  Curb: { scale: "scale-[1.25]" },
  "Spark Driver": { scale: "scale-[1.15]" },
  Dasher: { scale: "scale-[1.12]" },
  "Classic Ryde": { scale: "scale-[1.06]" },
}

// Logo del SELECTOR de plataformas (TODAY y Edit trip).
// Miguel (2026-11-22): el logo grande pero COMPLETO y bien centrado —
// con el círculo de PlatformAvatar las marcas anchas (Uber, Lyft) se
// veían cortadas en las esquinas y las cuadradas con fill se recortaban
// para llenar. Aquí la caja es rectangular y ancha, con fondo blanco y
// el arte en object-contain: entra entero, centrado horizontal y
// vertical, sin tocar los bordes. PlatformAvatar NO se toca: sigue
// igual en las demás pantallas.
export function SelectorLogo({
  platform,
  width,
  height,
}: {
  platform: Platform
  width: number
  height: number
}) {
  const [failed, setFailed] = useState(false)
  const meta = platformMeta(platform)
  const initials = platformInitials(platform)
  // ESTÁNDAR DE LOGOS (Miguel, 2026-11-22, por llamada): como Uber,
  // Lyft y Throo — "claro, clean": el logo centrado, el nombre legible
  // y el fondo del propio arte FUNDIDO con la caja; nunca "una
  // calcomanía en el medio de nowhere" (un cuadrado flotando sobre el
  // blanco con dos colores separados). Tratamiento por plataforma,
  // medido sobre el arte real (auditoría 2026-11-22):
  // - Aventus Ride: arte cuadrado verde (1000×1000); su contenido
  //   (círculo+monograma+nombre+tagline) va del 23.3 al 76.6% del alto
  //   y del 16.7 al 83.2% del ancho — centro exacto 50%/50%. Cover con
  //   la ventana centrada en ese 50% (antes 70% + scale 1.12: el bloque
  //   quedaba corrido hacia arriba y el círculo se cortaba) y scale
  //   1.05: entra TODO el contenido, centrado, y el verde llena la
  //   caja. El nombre (57.1–62.4% del alto, 17–83.2% del ancho) se lee
  //   completo a ~39px de ancho en la caja de 56.
  // - Eco Ride: wordmark blanco 234×179 con el contenido corrido
  //   (30.2–73.7% del alto, centro 52%). Cover con la ventana puesta
  //   en ese centro (object 58%): el nombre queda centrado y grande
  //   (~51px de ancho) y el blanco del arte funde con la caja.
  // - AKI Technology: SU ejemplo de la "calcomanía": cuadrado gris
  //   512×512 (fondo uniforme #666666, letras centradas 15.8–83.2% ×
  //   18.8–80.9%) flotando sobre la caja blanca. La caja toma el gris
  //   EXACTO del arte (boxBg) y el arte va en contain centrado: las
  //   letras entran completas y el gris llena la caja borde a borde.
  // - CO-OP Drive: como quedó aprobado y subido (contain, scale 1.12,
  //   sin padding): el símbolo blanco (8.3–93.2% del alto) entra
  //   completo y el violeta llena de arriba a abajo. Sin cambios.
  // - Jurny y Curb: fotos del ícono redondeado (violeta / verde) con
  //   el nombre en blanco centrado (Jurny 39.7–67.6%, Curb 38–62%
  //   del alto). Sin padding y scale 1.25: la ventana central
  //   (10–90%) recorta las esquinas de la foto, el color del ícono
  //   llena de arriba a abajo y el nombre crece y queda centrado.
  // - Spark Driver: foto del ícono azul; su símbolo blanco va del
  //   17 al 82.5% del alto. Miguel: "así o un poquito más" — scale
  //   1.15 sin padding: el símbolo crece de ~17 a ~23px, completo.
  // - Dasher: foto del ícono blanco con la bolsa roja (11.2–80.6%
  //   del alto); el blanco funde con la caja. Scale 1.12 sin padding
  //   para que la bolsa se note más, completa.
  // - Classic Ryde: Miguel: "está bien" — toque ligero: sin padding
  //   y scale 1.06 para que el monograma C+R se note un poco más,
  //   completo y centrado como ya estaba.
  // - Uber, Lyft (vectores) y Throo (wordmark sobre negro que ya
  //   llena el ancho): el patrón de referencia; sin cambios.
  // Colores originales en todos; ninguna letra se corta.
  const t = LOGO_TREATMENTS[platform]

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-black/20",
        t?.boxBg ? "" : "bg-white/95",
        t ? "p-0" : "p-[2px]"
      )}
      style={{ width, height, ...(t?.boxBg ? { backgroundColor: t.boxBg } : {}) }}
      aria-hidden="true"
    >
      {meta.logo && !failed ? (
        <img
          src={meta.logo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full",
            t?.fit === "cover" ? "object-cover" : "object-contain",
            t?.position,
            t?.scale
          )}
        />
      ) : (
        <span
          className="font-bold leading-none text-black"
          style={{ fontSize: Math.max(8, Math.round(height * 0.42)) }}
        >
          {initials}
        </span>
      )}
    </span>
  )
}
