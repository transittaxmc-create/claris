"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { moneyTextFromNumber, moneyTextToNumber, normalizeMoneyText, toggleMoneySign } from "@/lib/money"

// Campo de dinero reutilizable con soporte de signo negativo (ver lib/money.ts).
//
// El teclado decimal del teléfono no tiene tecla "-", así que el signo se cambia
// con el botón ± del propio campo. Se usa toggleMoneySign en vez de escribir el
// signo a mano para que el comportamiento (incluido el caso de un campo vacío,
// que pasa a "-") esté definido y probado en lib/money.ts.

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

  // Cambia el signo de lo que se está viendo y lo deja como texto en edición,
  // para que el siguiente carácter se escriba a continuación del signo.
  function flipSign() {
    const flipped = toggleMoneySign(display)
    edit(flipped)
    // En móvil el teclado puede haberse cerrado al pulsar el botón: se devuelve
    // el foco al input para poder seguir escribiendo sin volver a tocar el campo.
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
          lg ? "py-3.5 pl-2 pr-4" : "py-2 pl-1.5 pr-2.5",
        )}
      >
        <button
          type="button"
          // No debe robar el foco al input ni disparar el submit de un formulario.
          onMouseDown={(e) => e.preventDefault()}
          onClick={flipSign}
          aria-label={negative ? `Quitar el signo negativo a ${label}` : `Poner ${label} en negativo`}
          aria-pressed={negative}
          title="Cambiar signo (− / +)"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border font-bold transition-colors",
            lg ? "size-9 text-base" : "size-7 text-xs",
            negative
              ? "border-rose-700/70 bg-rose-950/40 text-rose-300"
              : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200",
          )}
        >
          {negative ? "−" : "±"}
        </button>
        <span className={cn("shrink-0 text-neutral-500", lg ? "text-sm" : "text-xs")}>$</span>
        <input
          ref={inputRef}
          // type="text" a propósito: con type="number" el navegador descarta los
          // estados intermedios que el usuario está escribiendo ("-", "12."), así
          // que el botón ± no podría negar un campo vacío. inputMode="decimal"
          // mantiene el teclado numérico en el teléfono.
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
      </div>
    </label>
  )
}
