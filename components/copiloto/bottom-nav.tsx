"use client"

import {
  Home,
  ClipboardList,
  FileText,
  Receipt,
  Gauge,
  Wallet,
  BarChart3,
  Sparkles,
  Boxes,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type Tab =
  | "ENTRY"
  | "REGISTER"
  | "LEDGER"
  | "EXPENSES"
  | "DASH"
  | "FINANCE"
  | "REPORTS"
  | "AI"
  | "DATA"

const ITEMS: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: "ENTRY", label: "ENTRY", icon: Home },
  { key: "REGISTER", label: "REGISTER", icon: ClipboardList },
  { key: "LEDGER", label: "LEDGER", icon: FileText },
  { key: "EXPENSES", label: "EXPENSES", icon: Receipt },
  { key: "DASH", label: "DASH", icon: Gauge },
  { key: "FINANCE", label: "FINANCE", icon: Wallet },
  { key: "REPORTS", label: "REPORTS", icon: BarChart3 },
  { key: "AI", label: "AI", icon: Sparkles },
  { key: "DATA", label: "DATA", icon: Boxes },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (t: Tab) => void
}) {
  return (
    <nav className="flex items-stretch gap-0.5 overflow-x-auto border-t border-neutral-800 bg-black px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "flex min-w-[52px] flex-1 flex-col items-center gap-1 rounded-lg py-1 transition-colors",
              isActive ? "text-yellow-400" : "text-neutral-500 hover:text-neutral-300",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[9px] font-semibold tracking-wide">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
