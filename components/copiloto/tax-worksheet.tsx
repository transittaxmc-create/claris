"use client"

import { useState } from "react"

const FORMS = [
  { name: "Schedule C 2026", url: "https://www.irs.gov/pub/irs-pdf/f1040sc.pdf" },
  { name: "Schedule SE 2026", url: "https://www.irs.gov/pub/irs-pdf/f1040sse.pdf" },
  { name: "Form 1040", url: "https://www.irs.gov/pub/irs-pdf/f1040.pdf" },
  { name: "Form 8995 QBI", url: "https://www.irs.gov/pub/irs-pdf/f8995.pdf" },
]

export function TaxWorksheet({
  gross,
  fees,
  expenses,
  net,
}: {
  gross: number
  fees: number
  expenses: number
  net: number
}) {
  const [edit, setEdit] = useState({ gross, fees, expenses })
  const seTax = Math.round(net * 0.153 * 100) / 100
  const qbi = Math.round(net * 0.2 * 100) / 100

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Tax Worksheet 2026</h3>
        <span className="text-[9px] text-neutral-500">Editable · auto-filled</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FORMS.map((f) => (
          <a key={f.name} href={f.url} target="_blank" rel="noreferrer" className="rounded border border-yellow-400/40 px-2 py-1 text-[10px] text-yellow-400">
            {f.name}
          </a>
        ))}
      </div>
      <div className="space-y-2 text-[12px]">
        <Row label="Gross receipts (Sch C line 1)" value={edit.gross} onChange={(n) => setEdit({ ...edit, gross: n })} />
        <Row label="Platform fees (line 10)" value={edit.fees} onChange={(n) => setEdit({ ...edit, fees: n })} />
        <Row label="Other business expenses" value={edit.expenses} onChange={(n) => setEdit({ ...edit, expenses: n })} />
        <div className="flex justify-between border-t border-neutral-800 pt-2 font-bold text-white">
          <span>Net profit</span>
          <span>${net.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-neutral-300">
          <span>SE tax (15.3%)</span>
          <span>${seTax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-neutral-300">
          <span>QBI deduction (20%)</span>
          <span>${qbi.toFixed(2)}</span>
        </div>
      </div>
      <p className="mt-2 text-[9px] text-neutral-500">Tap a number to correct. Official PDFs open in a new tab. CPA review required.</p>
    </section>
  )
}

function Row({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-neutral-400">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        defaultValue={value.toFixed(2)}
        onBlur={(e) => {
          const n = parseFloat(e.target.value.replace(/[^0-9.-]/g, ""))
          if (Number.isFinite(n)) onChange(n)
        }}
        className="w-24 rounded border border-neutral-700 bg-black px-2 py-1 text-right font-mono text-white outline-none"
      />
    </label>
  )
}
