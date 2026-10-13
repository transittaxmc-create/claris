"use client"

import { Home, ClipboardList, Wallet, BarChart3, LayoutGrid, Receipt, Gauge, Sparkles, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

export type Tab =
  | "ENTRY"
  | "REGISTER"
  | "EXPENSES"
  | "DASH"
  | "V1DASH"
  | "FINANCE"
  | "REPORTS"
  | "AI"
  | "DATA"

// CINCO destinos, no ocho.
//
// Medido en un teléfono de 390 px: con ocho pestañas cada una tiene 48 px de
// ancho y una etiqueta legible (11 px) no cabe — se pegaban unas con otras
// ("REGISTEREXPENSES"). Apple recomienda 3-5 pestañas principales. Las otras
// cinco viven en MÁS, a un toque.
const ITEMS: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: "ENTRY", label: "HOY", icon: Home },
  { key: "REGISTER", label: "COBROS", icon: ClipboardList },
  { key: "FINANCE", label: "DINERO", icon: Wallet },
  { key: "REPORTS", label: "REPORTES", icon: BarChart3 },
]

export const TABS_EN_MAS: { key: Tab; label: string; hint: string; icon: typeof Home }[] = [
  { key: "EXPENSES", label: "GASTOS", hint: "Facturas, recibos y categorías", icon: Receipt },
  { key: "DASH", label: "PANEL", hint: "Resumen del día", icon: Gauge },
  { key: "V1DASH", label: "DASHBOARD", hint: "Tablero por hora estilo v1", icon: Gauge },
  { key: "AI", label: "COPILOTO IA", hint: "Preguntas, gastos y conciliación", icon: Sparkles },
  { key: "DATA", label: "DATOS Y COPIA", hint: "Copia de seguridad, sync y reset", icon: Boxes },
]

export function BottomNav({
  active,
  onChange,
  onOpenMore,
}: {
  active: Tab
  onChange: (t: Tab) => void
  onOpenMore: () => void
}) {
  const enMas = TABS_EN_MAS.some((item) => item.key === active)

  return (
    <nav className="flex shrink-0 items-stretch gap-1 border-t border-neutral-800 bg-black px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors",
              isActive ? "text-yellow-400" : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[11px] font-semibold tracking-tight">{label}</span>
          </button>
        )
      })}

      <button
        type="button"
        onClick={onOpenMore}
        aria-current={enMas ? "page" : undefined}
        aria-label="Más secciones"
        className={cn(
          "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors",
          enMas ? "text-yellow-400" : "text-neutral-400 hover:text-neutral-200",
        )}
      >
        <LayoutGrid className="size-6" strokeWidth={enMas ? 2.5 : 2} />
        <span className="text-[11px] font-semibold tracking-tight">MÁS</span>
      </button>
    </nav>
  )
}
