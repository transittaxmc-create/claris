"use client"

import { Home, ClipboardList, Wallet, BarChart3, LayoutGrid, Receipt, Gauge, Sparkles, Boxes, BookOpen } from "lucide-react"
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
  | "SOBRES"
  | "HELP"

const ITEMS: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: "ENTRY", label: "TODAY", icon: Home },
  { key: "REGISTER", label: "EARNINGS", icon: ClipboardList },
  { key: "FINANCE", label: "MONEY", icon: Wallet },
  { key: "REPORTS", label: "REPORTS", icon: BarChart3 },
]

export const TABS_EN_MAS: { key: Tab; label: string; hint: string; icon: typeof Home }[] = [
  { key: "EXPENSES", label: "EXPENSES", hint: "Bills, receipts and categories", icon: Receipt },
  { key: "DASH", label: "SUMMARY", hint: "Day summary", icon: Gauge },
  { key: "V1DASH", label: "DASHBOARD", hint: "v1-style hourly board", icon: Gauge },
  { key: "AI", label: "COPILOT AI", hint: "Questions, expenses and reconciliation", icon: Sparkles },
  { key: "DATA", label: "DATA & BACKUP", hint: "Backup, sync and reset", icon: Boxes },
  { key: "SOBRES", label: "ENVELOPES", hint: "Set aside money per bill before it's due", icon: Wallet },
  { key: "HELP", label: "HOW IT WORKS", hint: "Guide, dual register, reconciliation, Bill/Receipt", icon: BookOpen },
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
        aria-label="More sections"
        className={cn(
          "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors",
          enMas ? "text-yellow-400" : "text-neutral-400 hover:text-neutral-200",
        )}
      >
        <LayoutGrid className="size-6" strokeWidth={enMas ? 2.5 : 2} />
        <span className="text-[11px] font-semibold tracking-tight">MORE</span>
      </button>
    </nav>
  )
}
