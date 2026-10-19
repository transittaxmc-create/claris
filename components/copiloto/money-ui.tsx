"use client"

// Piezas visuales del diseño MONEY (logo de banco, tarjeta de cuenta, franja
// de 3 cifras, cabecera). Solo presentación: los datos vienen de claris.

import { useState, type CSSProperties, type ReactNode } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { money } from "./types"
import { bankBrandOf, brandInitial, type BankBrand } from "./bank-brand"

export const MONEY_FONT_MONO = "font-mono tabular-nums"

/** Variables CSS de marca para una tarjeta. */
export function brandStyle(b: BankBrand): CSSProperties {
  return { ["--brand" as string]: b.c, ["--brand-2" as string]: b.a } as CSSProperties
}

export function BankLogo(props: { brand: BankBrand; name: string; size?: "sm" | "lg" }) {
  const [broken, setBroken] = useState(false)
  const { brand } = props
  const big = props.size === "lg"
  const showImg = !!brand.logo && !broken
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,.08),0_2px_8px_rgba(0,0,0,.35)]",
        big ? "size-[42px] rounded-[11px]" : "size-[34px] rounded-[9px]",
        showImg ? "bg-white" : "",
      )}
      style={showImg ? undefined : { background: `linear-gradient(135deg, ${brand.c}, ${brand.a})` }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logo as string}
          alt={brand.short}
          className={cn("object-contain", brand.fullTile ? "size-full" : "size-[72%]")}
          onError={() => setBroken(true)}
        />
      ) : (
        <b className="text-[15px] font-extrabold text-white">{brandInitial(brand, props.name)}</b>
      )}
    </span>
  )
}

/** Tarjeta de cuenta MONEY: degradado + franja con el color del banco. */
export function MoneyAccountCard(props: {
  name: string
  /** Nombre completo de la cuenta (para detectar la marca: "Square Checking"). */
  rawName?: string
  institution?: string | null
  subtitle: string
  balance: number | null
  main?: boolean
  count?: number
  onClick: () => void
  /** Checkmark "otros fondos": suma el balance al opening de proyecciones. */
  fundChecked?: boolean
  onToggleFund?: () => void
}) {
  const brand = bankBrandOf(props.rawName || props.name, props.institution)
  const main = !!props.main
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.name}
      style={brandStyle(brand)}
      className={cn(
        "money-card relative flex w-full flex-col overflow-hidden rounded-[14px] text-left transition-transform active:scale-[.985]",
        main ? "money-card-main min-h-[118px] gap-2.5 px-4 py-3.5" : "min-h-[96px] gap-2.5 p-3",
      )}
    >
      {main && (
        <span className="flex items-center gap-1 text-[11px] font-extrabold tracking-[.08em] text-[#f5b84c]">
          <Star className="size-3 fill-[#f5b84c] text-[#f5b84c]" /> PRINCIPAL
        </span>
      )}
      {typeof props.count === "number" && (
        <span className={cn("absolute right-3 top-2.5 text-[10px] font-bold text-[#66687c]", MONEY_FONT_MONO)}>
          {props.count} mov.
        </span>
      )}
      {props.onToggleFund && (
        <span
          role="switch"
          aria-checked={!!props.fundChecked}
          aria-label="Include in projections"
          onClick={(e) => {
            e.stopPropagation()
            props.onToggleFund?.()
          }}
          className={cn(
            "absolute left-2.5 top-2.5 flex h-5 w-9 items-center rounded-full px-0.5 transition-colors",
            props.fundChecked ? "bg-[#5b8cff]" : "bg-[#2a2b3a]",
          )}
        >
          <span
            className={cn(
              "size-4 rounded-full bg-white shadow transition-transform",
              props.fundChecked ? "translate-x-4" : "translate-x-0",
            )}
          />
        </span>
      )}
      {/* pr: deja sitio al contador "N mov." de la esquina */}
      <span className={cn("flex min-w-0 items-center gap-2.5", typeof props.count === "number" && !main && "pr-11")}>
        <BankLogo brand={brand} name={props.name} size={main ? "lg" : "sm"} />
        <span className="flex min-w-0 flex-col">
          <span className={cn("truncate font-extrabold text-[#f2f3f7]", main ? "text-base" : "text-sm")}>
            {main ? props.name : brand.id === "generic" ? props.name : brand.short}
          </span>
          <span className={cn("truncate text-[10px] text-[#66687c]", MONEY_FONT_MONO)}>{props.subtitle}</span>
        </span>
      </span>
      <span
        className={cn(
          "font-extrabold",
          MONEY_FONT_MONO,
          main ? "text-[26px]" : "text-[17px]",
          props.balance === null ? "text-[#66687c]" : props.balance < 0 ? "text-[#ff5d6c]" : "text-[#2fbf71]",
        )}
      >
        {props.balance === null ? "—" : money(props.balance)}
      </span>
    </button>
  )
}

/** Franja de 3 cifras (BANCO REAL · PROYECTADO · CIERRE). */
export function MoneyStrip(props: {
  cells: { label: string; value: string; tone?: "pos" | "neg" | "plain"; active?: boolean; onClick?: () => void }[]
}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#262633] bg-[#16161f]">
      {props.cells.map((c, i) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          disabled={!c.onClick}
          className={cn(
            "flex flex-col items-center gap-0.5 px-1 py-2.5 text-center disabled:cursor-default",
            i < props.cells.length - 1 && "border-r border-[#262633]",
            c.active && "bg-[rgba(91,140,255,.12)]",
          )}
        >
          <span className="text-[9px] font-extrabold tracking-[.06em] text-[#9a9cb0]">{c.label}</span>
          <span
            className={cn(
              "text-[13px] font-extrabold",
              MONEY_FONT_MONO,
              c.tone === "neg" ? "text-[#ff5d6c]" : c.tone === "pos" ? "text-[#2fbf71]" : "text-[#f2f3f7]",
            )}
          >
            {c.value}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Cabecera MONEY: logo $ + título + puntos de página. */
export function MoneyHeader(props: { page: 0 | 1; onPage: (p: 0 | 1) => void; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-1">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#2f7bff] to-[#1f5eff] shadow-[0_6px_18px_rgba(47,123,255,.35)]">
          <span className="text-xl font-black leading-none text-white">$</span>
        </span>
        <h1 className="text-xl font-extrabold tracking-[.18em] text-[#f2f3f7]">MONEY</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5" aria-hidden>
          {[0, 1].map((p) => (
            <button
              key={p}
              type="button"
              tabIndex={-1}
              onClick={() => props.onPage(p as 0 | 1)}
              className={cn(
                "h-2 rounded-full transition-all",
                props.page === p ? "w-6 bg-gradient-to-r from-[#5b8cff] to-[#7c5cff]" : "w-2 bg-[#262633]",
              )}
            />
          ))}
        </span>
        {props.right}
      </div>
    </div>
  )
}

/** Pestañas Register / Projections con subrayado. */
export function MoneyTabs(props: { page: 0 | 1; onPage: (p: 0 | 1) => void; registerLabel: string }) {
  const tab = (p: 0 | 1, label: string, icon: ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={props.page === p}
      onClick={() => props.onPage(p)}
      className={cn(
        "relative flex min-w-0 items-center gap-1.5 px-1 pb-2.5 pt-1 text-[15px] font-semibold transition-colors",
        props.page === p ? "text-[#f2f3f7]" : "text-[#9a9cb0]",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      {props.page === p && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-[#5b8cff] to-[#7c5cff]" />
      )}
    </button>
  )
  return (
    <div role="tablist" className="flex gap-6 border-b border-[#262633] px-1">
      {tab(
        0,
        props.registerLabel,
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="9" y1="10" x2="9" y2="20" />
        </svg>,
      )}
      {tab(
        1,
        "Projections",
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />
        </svg>,
      )}
    </div>
  )
}

export function MoneySectionTitle(props: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-1.5 mt-2.5">
      <p className="text-xs font-extrabold tracking-[.08em] text-[#9a9cb0]">{props.children}</p>
      {props.sub && <p className="mt-0.5 text-xs text-[#66687c]">{props.sub}</p>}
    </div>
  )
}
