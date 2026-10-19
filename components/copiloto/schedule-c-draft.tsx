"use client"

/**
 * Schedule C (DRAFT) — se llena solo desde el Financial Statement.
 * Formulario oficial IRS 2025 (el 2026 sale a fin de año; las casillas son las mismas).
 * Reglas: investigación en ~/workspace/tax-research/schedule-c-rideshare-2026.md
 * NO es asesoría fiscal — un CPA debe revisar antes de declarar.
 */

export type CarMethod = "mileage" | "actual"

export interface ScheduleCOpts {
  method: CarMethod
  milesH1: number // ene–jun 2026 (tasa $0.725)
  milesH2: number // jul–dic 2026 (tasa $0.76)
  transferFees: number // fees de tarjetas (Uber Pro $442.80 + Branch $118.96 = $561.76)
  licenses: number // TLC, registro, inspección
  legal: number // CPA, abogado
}

export const DEFAULT_SCHEDULE_C_OPTS: ScheduleCOpts = {
  method: "mileage",
  milesH1: 0,
  milesH2: 0,
  transferFees: 0,
  licenses: 0,
  legal: 0,
}

export interface ScheduleCLine {
  line: string
  label: string
  amount: number
  note?: string
  total?: boolean
}

/** Suma por categoría SOLO de gastos clasificados como negocio. */
export function businessByCategory(expenses: { category: string; amount: number; classification?: string }[]) {
  const m = new Map<string, number>()
  for (const e of expenses) {
    if (e.classification !== "business") continue
    const c = String(e.category ?? "")
    m.set(c, (m.get(c) ?? 0) + (Number(e.amount) || 0))
  }
  return m
}

const RATE_H1_2026 = 0.725
const RATE_H2_2026 = 0.76

export function computeScheduleC(
  trips: { gross: number; platformFee: number }[],
  expenses: { category: string; amount: number; classification?: string; date: string }[],
  from: string,
  to: string,
  opts: ScheduleCOpts,
): { lines: ScheduleCLine[]; gross: number; net: number; seTax: number; halfSE: number; qbi: number } {
  const inRange = (d: string) => String(d ?? "").slice(0, 10) >= from && String(d ?? "").slice(0, 10) <= to
  const t = trips.filter(() => true) // trips ya vienen filtrados por rango
  const e = expenses.filter((x) => inRange(x.date))

  let gross = 0
  let platformFees = 0
  for (const x of t) {
    gross += Number((x as { gross: number }).gross) || 0
    platformFees += Number(x.platformFee) || 0
  }
  const cat = businessByCategory(e)
  const c = (k: string) => Math.round((cat.get(k) ?? 0) * 100) / 100
  const r2 = (n: number) => Math.round(n * 100) / 100

  const lines: ScheduleCLine[] = []
  const L = (line: string, label: string, amount: number, note?: string, total?: boolean) =>
    lines.push({ line, label, amount: r2(amount), note, total })

  // Parte I — Ingreso
  L("1", "Gross receipts or sales", gross, "Viajes + propinas + extra, en bruto (sin restar comisiones)")
  L("7", "Gross income", gross, undefined, true)

  // Parte II — Gastos
  L("8", "Advertising", 0)

  if (opts.method === "mileage") {
    const mileage = opts.milesH1 * RATE_H1_2026 + opts.milesH2 * RATE_H2_2026
    const tollsPark = c("Tolls") + c("Parking")
    L(
      "9",
      "Car and truck expenses (standard mileage)",
      mileage + tollsPark,
      `${opts.milesH1.toLocaleString()} mi × $0.725 + ${opts.milesH2.toLocaleString()} mi × $0.76 + tolls/parking`,
    )
  } else {
    const carActual = c("Fuel") + c("Vehicle maintenance") + c("Car wash") + c("Tolls") + c("Parking")
    L("9", "Car and truck expenses (actual)", carActual, "Fuel + mantenimiento + lavado + tolls + parking (porción negocio)")
  }

  L(
    "10",
    "Commissions and fees",
    platformFees + opts.transferFees,
    "Comisiones de plataforma + fees de transferencia de tarjetas",
  )
  L("11", "Contract labor", 0)
  L("13", "Depreciation and section 179", 0, "Solo método actual con carro propio (él alquila)")
  L(
    "15",
    "Insurance (other than health)",
    opts.method === "actual" ? c("Insurance") : 0,
    opts.method === "mileage" ? "Incluido en la tasa por milla" : "Porción negocio del seguro",
  )
  L("16", "Interest", 0)
  L("17", "Legal and professional services", opts.legal, "CPA / abogado — monto manual")
  L("18", "Office expense", 0)
  L(
    "20a",
    "Rent or lease — vehicles",
    opts.method === "actual" ? c("Car leasing") : 0,
    opts.method === "mileage"
      ? "Incluido en la tasa por milla — NO deducir aparte"
      : "Leasing $924/semana (porción negocio)",
  )
  L("20b", "Rent or lease — other", 0)
  L("21", "Repairs and maintenance", 0, "En línea 9 si usa método actual")
  L("22", "Supplies", c("Supplies"))
  L("23", "Taxes and licenses", opts.licenses, "TLC / registro / inspección — monto manual")
  L("24a", "Travel", 0)
  L("24b", "Deductible meals (50%)", 0, "Comida diaria local NO es deducible — solo viajes con pernocta")
  L("25", "Utilities", c("Phone"), "Porción negocio del teléfono")
  L("26", "Wages", 0)
  L("27b", "Other expenses", c("Bank fees") + c("Other"), "Bank fees + otros (negocio)")
  // Nota: "Food" y "Rent" (apartamento $1,500) NO entran — personal.

  const totalExp = lines
    .filter((x) => !x.total && x.line !== "1" && x.line !== "7")
    .reduce((s, x) => s + x.amount, 0)
  L("28", "Total expenses", totalExp, undefined, true)
  const net = gross - totalExp
  L("29/31", "Net profit (or loss)", net, "Línea 7 − línea 28", true)

  // Estimados (informativo)
  const seTaxable = Math.max(0, net * 0.9235)
  const seTax = seTaxable * 0.153
  const halfSE = seTax / 2
  const qbi = Math.max(0, net * 0.2)

  return { lines, gross: r2(gross), net: r2(net), seTax: r2(seTax), halfSE: r2(halfSE), qbi: r2(qbi) }
}

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function ScheduleCDraft({
  trips,
  expenses,
  from,
  to,
  opts,
  onOpts,
}: {
  trips: { gross: number; platformFee: number }[]
  expenses: { category: string; amount: number; classification?: string; date: string }[]
  from: string
  to: string
  opts: ScheduleCOpts
  onOpts: (o: ScheduleCOpts) => void
}) {
  const { lines, net, seTax, halfSE, qbi } = computeScheduleC(trips, expenses, from, to, opts)
  const set = (p: Partial<ScheduleCOpts>) => onOpts({ ...opts, ...p })
  const num = (v: string) => Math.max(0, Number(v) || 0)

  return (
    <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="mb-1 text-[11px] font-bold tracking-wide text-amber-300">SCHEDULE C — DRAFT / BORRADOR</p>
      <p className="mb-2 text-[10px] leading-snug text-neutral-400">
        Profit or Loss From Business (Sole Proprietorship) · IRS 2025 — se llena solo del Financial Statement. Un CPA
        debe revisarlo antes de declarar.
      </p>

      {/* Método de carro */}
      <div className="mb-2 flex gap-1.5">
        {(["mileage", "actual"] as CarMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => set({ method: m })}
            className={`flex-1 rounded-xl border px-2 py-1.5 text-[10px] font-bold ${
              opts.method === m
                ? "border-amber-400/70 bg-amber-400/10 text-amber-300"
                : "border-neutral-700 text-neutral-400"
            }`}
          >
            {m === "mileage" ? "Standard mileage" : "Actual expenses"}
          </button>
        ))}
      </div>
      {opts.method === "mileage" && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-neutral-500">MILLAS NEGOCIO ENE–JUN 2026 ($0.725)</span>
            <input
              type="number"
              min={0}
              value={opts.milesH1 || ""}
              onChange={(e) => set({ milesH1: num(e.target.value) })}
              placeholder="0"
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-neutral-500">MILLAS NEGOCIO JUL–DIC 2026 ($0.76)</span>
            <input
              type="number"
              min={0}
              value={opts.milesH2 || ""}
              onChange={(e) => set({ milesH2: num(e.target.value) })}
              placeholder="0"
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
            />
          </label>
        </div>
      )}
      <div className="mb-2 grid grid-cols-3 gap-2">
        {(
          [
            ["transferFees", "CARD FEES ($)"],
            ["licenses", "TLC / LICENSES ($)"],
            ["legal", "CPA / LEGAL ($)"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-neutral-500">{label}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={opts[k] || ""}
              onChange={(e) => set({ [k]: num(e.target.value) } as Partial<ScheduleCOpts>)}
              placeholder="0"
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
            />
          </label>
        ))}
      </div>

      {/* Líneas */}
      <div className="divide-y divide-neutral-800/60">
        {lines.map((l) => (
          <div key={l.line} className="flex items-start justify-between gap-3 py-1">
            <span className={l.total ? "text-[11px] font-bold text-white" : "text-[11px] text-neutral-400"}>
              <span className="mr-1.5 font-mono text-[10px] text-amber-400/80">{l.line}</span>
              {l.label}
              {l.note && <span className="block pl-8 text-[9px] text-neutral-500">{l.note}</span>}
            </span>
            <span
              className={`shrink-0 font-mono text-[11px] tabular-nums ${l.total ? "font-bold text-white" : "text-neutral-300"}`}
            >
              {money(l.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* Estimados de impuesto */}
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Tax estimate (informativo)</p>
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-neutral-400">Self-employment tax (15.3%)</span>
        <span className="font-mono text-[11px] text-neutral-300">{money(seTax)}</span>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-neutral-400">½ SE deductible</span>
        <span className="font-mono text-[11px] text-neutral-300">{money(halfSE)}</span>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-neutral-400">QBI deduction (20%)</span>
        <span className="font-mono text-[11px] text-neutral-300">{money(qbi)}</span>
      </div>
      <p className="mt-1 text-[9px] leading-snug text-neutral-500">
        Estimados con cifras IRS 2026. Tips: hasta $25,000 deducibles (§224) — confirmar con CPA. Renta del apartamento
        ($1,500) y comida diaria NO entran — personal.
      </p>
    </section>
  )
}
