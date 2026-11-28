/**
 * Logos de pago y de navegación del CRM nuevo (SVG en línea, como el
 * prototipo): las baldosas de método son SOLO símbolo — sin texto,
 * porque los nombres se leen en su propia línea (fila METHOD + botones
 * SEND BY TEXT / COPY). Los de navegación (Google Maps, Waze, Apple
 * Maps) son las marcas reales de cada app.
 */
import type { LatLng } from "./helpers"
import { navAppleLink, navGoogleLink, navWazeLink } from "./helpers"
import { tx } from "./i18n"

export function PayLogo({ method }: { method: string }) {
  if (method === "Zelle")
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
        <rect width="48" height="48" rx="11" fill="#6D1ED4" />
        <text x="24" y="34" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="26" fill="#fff">Z</text>
      </svg>
    )
  if (method === "Venmo")
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
        <rect width="48" height="48" rx="11" fill="#008CFF" />
        <text x="24" y="35" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="27" fill="#fff">V</text>
      </svg>
    )
  if (method === "Cash App")
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
        <rect width="48" height="48" rx="11" fill="#00D632" />
        <text x="24" y="35" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="27" fill="#fff">$</text>
      </svg>
    )
  if (method === "Square")
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
        <rect width="48" height="48" rx="11" fill="#fff" stroke="#D8DEE8" />
        <rect x="12" y="12" width="24" height="24" rx="6" fill="none" stroke="#0D1B2E" strokeWidth="4.4" />
        <rect x="20.5" y="20.5" width="7" height="7" rx="1.6" fill="#0D1B2E" />
      </svg>
    )
  if (method === "Cuenta")
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
        <rect width="48" height="48" rx="11" fill="#E9EEF6" />
        <path d="M24 11 L38 19 H10 Z" fill="#0D1B2E" />
        <rect x="13" y="22" width="4" height="9" fill="#0D1B2E" />
        <rect x="22" y="22" width="4" height="9" fill="#0D1B2E" />
        <rect x="31" y="22" width="4" height="9" fill="#0D1B2E" />
        <rect x="10" y="34" width="28" height="3" fill="#0D1B2E" />
      </svg>
    )
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="48" height="48" rx="11" fill="#E9F7EF" />
      <rect x="8" y="14" width="32" height="20" rx="3" fill="none" stroke="#1E9E57" strokeWidth="2.6" />
      <circle cx="24" cy="24" r="5" fill="none" stroke="#1E9E57" strokeWidth="2.4" />
      <circle cx="13.5" cy="24" r="1.8" fill="#1E9E57" />
      <circle cx="34.5" cy="24" r="1.8" fill="#1E9E57" />
    </svg>
  )
}

/** Fila de logos de navegación (~56×44, solo el logo) bajo cada
 *  dirección navegable: abre la app elegida hacia esa dirección. */
export function NavLogos({ address, gps }: { address: string; gps: LatLng | null }) {
  const a = (address || "").trim()
  if (!a) return null
  const lbl = tx("Open in")
  return (
    <div className="navrow" role="group" aria-label={`${lbl} ${a}`}>
      <a className="navbtn" href={navGoogleLink(a, gps)} target="_blank" rel="noreferrer" title="Google Maps" aria-label={`Google Maps: ${a}`}>
        <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <path d="M24 4C16.8 4 11 9.7 11 16.7 11 26.5 24 44 24 44s13-17.5 13-27.3C37 9.7 31.2 4 24 4z" fill="#EA4335" />
          <circle cx="24" cy="17" r="6.4" fill="#fff" />
          <circle cx="24" cy="17" r="3.4" fill="#4285F4" />
        </svg>
      </a>
      <a className="navbtn" href={navWazeLink(a, gps)} target="_blank" rel="noreferrer" title="Waze" aria-label={`Waze: ${a}`}>
        <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <circle cx="23" cy="21" r="14" fill="#33CCFF" />
          <circle cx="18.6" cy="18.6" r="2.4" fill="#0D1B2E" />
          <circle cx="27.4" cy="18.6" r="2.4" fill="#0D1B2E" />
          <path d="M18.5 25.4c1.6 1.7 3.4 2.5 5.4 2.5 1.8 0 3.4-.7 4.9-2" fill="none" stroke="#0D1B2E" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="15" cy="36.5" r="3.6" fill="#33CCFF" />
          <circle cx="31" cy="36.5" r="3.6" fill="#33CCFF" />
        </svg>
      </a>
      <a className="navbtn" href={navAppleLink(a, gps)} target="_blank" rel="noreferrer" title="Apple Maps" aria-label={`Apple Maps: ${a}`}>
        <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
          <rect x="5" y="7" width="38" height="34" rx="7" fill="#F2F4F7" stroke="#D8DEE8" />
          <path d="M16 7v34M32 7v34" stroke="#C9D4E4" strokeWidth="2" />
          <path d="M5 20c8-3 12 2 19 0s11-2 19 1M5 33c7-2 12 2 19 0 6-1.8 12-1.8 19 .4" stroke="#BFE3C6" strokeWidth="3" fill="none" />
          <path d="M24 13l7 14.5-7-3.6-7 3.6z" fill="#0A84FF" />
        </svg>
      </a>
    </div>
  )
}
