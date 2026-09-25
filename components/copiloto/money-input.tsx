"use client"

import { useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { moneyTextFromNumber, moneyTextToNumber, normalizeMoneyText, toggleMoneySign } from "@/lib/money"

// Campo de dinero reutilizable con soporte de signo negativo (ver lib/money.ts).

export function MoneyInput({
  label,
  color,
  value,
  onChange,
  size = "lg",
  placeholder = "0.00",
}: {
  label: string
  color?: string
  value: number
  onChange: (n: number) => void
  size?: "lg" | "sm"
  placeholder?: string
}) {
  // null = no se está editando -> se muestra el valor numérico real.
  const [text, setText] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const display = text ?? moneyTextFromNumber(value)
  const negative = display.trim().startsWith("-")
  const lg = size === "lg"

  function edit(next: string) {
    const clean = normalizeMoneyText(next)
    setText(clean)
    onChange(moneyTextToNumber(clean))
  }

  function toggleSign() {
    edit(toggleMoneySign(display))
    inputRef.current?.focus()
  }

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={cn("font-bold tracking-wide", lg ? "text-[11px]" : "text-[10px]", color ?? "text-neutral-400")}>
        {label}
      </span>
      <div
        className={cn(
          "flex min-h-[4.5rem] items-center gap-1 rounded-xl border bg-neutral-950 focus-within:border-neutral-500",
          negative ? "border-rose-800/70" : "border-neutral-800",
          lg ? "px-4 py-3.5" : "px-2.5 py-2",
        )}
      >
        <span className={cn("text-neutral-500", lg ? "text-sm" : "text-xs")}>$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={display}
          onFocus={() => setText(moneyTextFromNumber(value))}
          onBlur={() => {
            const clean = normalizeMoneyText(display)
            setText(null)
            onChange(moneyTextToNumber(clean))
          }}
          onChange={(e) => edit(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full min-w-0 bg-transparent font-semibold outline-none placeholder:text-neutral-600",
            negative ? "text-rose-300" : "text-white",
            lg ? "text-xl" : "text-sm",
          )}
        />
        <button
          type="button"
          onClick={toggleSign}
          aria-label={negative ? `Quitar el signo menos a ${label}` : `Poner el signo menos a ${label}`}
          aria-pressed={negative}
          title="Cambiar signo (+ / −)"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border font-bold transition-colors",
            lg ? "size-7 text-base" : "size-6 text-sm",
            negative
              ? "border-rose-500/60 bg-rose-500/15 text-rose-300"
              : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white",
          )}
        >
          {negative ? <Plus className={lg ? "size-4" : "size-3.5"} /> : <Minus className={lg ? "size-4" : "size-3.5"} />}
        </button>
      </div>
    </label>
  )
}
