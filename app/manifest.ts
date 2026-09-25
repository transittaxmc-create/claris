import type { MetadataRoute } from "next"

// Manifest PWA: permite "Añadir a pantalla de inicio" y que la app abra a
// pantalla completa (sin barra del navegador), que es lo que hacía que se viera
// distinto al abrir el link desde otro sitio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Copiloto v.1 — Registro de viajes y ganancias",
    short_name: "Copiloto",
    description: "Registro de viajes, gastos y ganancias para conductores.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "es",
    icons: [
      { src: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/icon-dark-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  }
}
