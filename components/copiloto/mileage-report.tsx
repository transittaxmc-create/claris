"use client"

import { useMemo, useState } from "react"
import { loadMileageLog, type MileageDay } from "./mileage-log"

/**
 * Reporte de millas para el IRS (Pub 463).
 * Cada día: fecha, millas, y cada viaje con recogida → dejada y plataforma
 * (propósito de negocio). Prueba contemporánea del log de millas.
 */

function fmtTime(ts: number | null): string {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

export function MileageReport() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [odoStart, setOdoStart] = useState("")
  const [odoEnd, setOdoEnd] = useState("")
  const [days] = useState<MileageDay[]>(() => loadMileageLog())

  const yearDays = useMemo(() => days.filter((d) => d.date.startsWith(String(year))), [days, year])
  const totals = useMemo(() => {
    let h1 = 0
    let h2 = 0
    let trips = 0
    for (const d of yearDays) {
      const m = Number(d.date.slice(5, 7))
      if (m >= 1 && m <= 6) h1 += d.miles
      else h2 += d.miles
      trips += d.trips.length
    }
    const r = (n: number) => Math.round(n * 100) / 100
    return { h1: r(h1), h2: r(h2), total: r(h1 + h2), trips, days: yearDays.length }
  }, [yearDays])

  const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-wide text-white">MILEAGE LOG — IRS</p>
          <p className="text-[10px] text-neutral-500">
            {totals.days} días · {totals.trips} viajes · {num(totals.total)} mi en {year}
          </p>
        </div>
        <div className="flex gap-1.5">
          {[year - 1, year].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                y === year ? "border-sky-400/70 bg-sky-400/10 text-sky-300" : "border-neutral-700 text-neutral-400"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen por semestre (tasas IRS 2026 distintas) */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-neutral-950 p-2 text-center">
          <p className="text-[9px] font-bold text-neutral-500">ENE–JUN ($0.725)</p>
          <p className="font-mono text-sm font-bold text-white">{num(totals.h1)}</p>
        </div>
        <div className="rounded-xl bg-neutral-950 p-2 text-center">
          <p className="text-[9px] font-bold text-neutral-500">JUL–DIC ($0.76)</p>
          <p className="font-mono text-sm font-bold text-white">{num(totals.h2)}</p>
        </div>
        <div className="rounded-xl bg-neutral-950 p-2 text-center">
          <p className="text-[9px] font-bold text-neutral-500">DEDUCCIÓN EST.</p>
          <p className="font-mono text-sm font-bold text-emerald-400">
            ${num(totals.h1 * 0.725 + totals.h2 * 0.76)}
          </p>
        </div>
      </div>

      {/* Odómetro */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-neutral-500">ODÓMETRO 1 ENE {year}</span>
          <input
            type="number"
            min={0}
            value={odoStart}
            onChange={(e) => setOdoStart(e.target.value)}
            placeholder="0"
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-neutral-500">ODÓMETRO 31 DIC {year}</span>
          <input
            type="number"
            min={0}
            value={odoEnd}
            onChange={(e) => setOdoEnd(e.target.value)}
            placeholder="0"
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white [color-scheme:dark]"
          />
        </label>
      </div>

      {/* Log por día */}
      <div className="max-h-96 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {yearDays.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-neutral-500">
            Sin registros todavía. Presiona START al empezar el turno — las millas se anotan solas.
          </p>
        ) : (
          [...yearDays].reverse().map((d) => (
            <div key={d.date} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-200">{fmtDate(d.date)}</span>
                <span className="font-mono text-[11px] font-bold text-sky-300">{num(d.miles)} mi</span>
              </div>
              <p className="text-[10px] text-neutral-500">
                {fmtTime(d.clockIn)} → {fmtTime(d.clockOut)}
              </p>
              {d.trips.length > 0 && (
                <div className="mt-1 space-y-0.5 border-t border-neutral-800/60 pt-1">
                  {d.trips.map((t, i) => (
                    <p key={i} className="text-[10px] leading-snug text-neutral-400">
                      <span className="text-neutral-500">{t.time || ""}</span>{" "}
                      <span className="font-semibold text-neutral-300">{t.platform}</span>
                      {t.pickup || t.dropoff ? (
                        <span>
                          {" "}
                          · {t.pickup || "?"} → {t.dropoff || "?"}
                        </span>
                      ) : null}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-[9px] leading-snug text-neutral-500">
        Registro contemporáneo (Pub 463): fecha, millas, destino y propósito de negocio por día. Guárdalo para el IRS.
      </p>
    </section>
  )
}
