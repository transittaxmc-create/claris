"use client"

import { useMemo } from "react"
import { type CashFlowEntry } from "./types"
import { type DueItem, type RegisterAccount } from "./registers-store"
import { buildForecast, startingBalance, todayKey, type ForecastBankTx } from "./dinero-forecast"
import { useForecastInputs } from "./dinero-proyeccion"

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const money = (value: number) => `${value < 0 ? "−" : value > 0 ? "+" : ""}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateLabel = (iso: string) => {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}` : "—"
}

function Gauge({ pct }: { pct: number }) {
  const angle = (-90 + Math.max(0, Math.min(100, pct)) * 1.8) * (Math.PI / 180)
  const x = 55 + 38 * Math.cos(angle)
  const y = 52 + 38 * Math.sin(angle)
  return (
    <svg viewBox="0 0 110 62" className="h-[62px] w-[110px]" aria-label="Cash flow health gauge">
      <path d="M10 52 A45 45 0 0 1 100 52" fill="none" stroke="#23232f" strokeWidth="11" strokeLinecap="round" />
      <path d="M10 52 A45 45 0 0 1 40 14" fill="none" stroke="#ff5d6c" strokeWidth="11" />
      <path d="M40 14 A45 45 0 0 1 70 14" fill="none" stroke="#f5b84c" strokeWidth="11" />
      <path d="M70 14 A45 45 0 0 1 100 52" fill="none" stroke="#34d17b" strokeWidth="11" />
      <line x1="55" y1="52" x2={x} y2={y} stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="55" cy="52" r="5" fill="white" />
    </svg>
  )
}

function BalanceChart({ values }: { values: number[] }) {
  const width = 380
  const height = 150
  const left = 44
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const x = (i: number) => left + (i / Math.max(1, values.length - 1)) * (width - left - 8)
  const y = (value: number) => 8 + (1 - (value - min) / range) * 120
  const points = values.map((value, i) => `${x(i)},${y(value)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" aria-label="Projected balance chart">
      <defs><linearGradient id="balance-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d17b" stopOpacity=".35" /><stop offset="1" stopColor="#34d17b" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((line) => <line key={line} x1={left} y1={8 + line * 40} x2={width - 8} y2={8 + line * 40} stroke="#2a2a35" />)}
      <polygon points={`${left},128 ${points} ${x(values.length - 1)},128`} fill="url(#balance-area)" />
      <polyline points={points} fill="none" stroke="#34d17b" strokeWidth="2.5" />
      <circle cx={x(0)} cy={y(values[0])} r="4.5" fill="#5b8cff" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4.5" fill="#34d17b" />
    </svg>
  )
}

export function DineroProyeccionV2(props: {
  registers: RegisterAccount[]
  balances: Record<string, number | null>
  dues: DueItem[]
  entries: CashFlowEntry[]
  bankTxs: ForecastBankTx[]
  bankOk: boolean
  otherFunds: string[]
}) {
  const { schedules, overrides, dismissed } = useForecastInputs()
  const today = todayKey()
  const start = useMemo(() => startingBalance(props.registers, props.balances, props.otherFunds), [props.registers, props.balances, props.otherFunds])
  const forecast = useMemo(() => buildForecast({ startBalance: start.value, entries: props.entries, schedules, dues: props.dues, balances: props.balances, bankTxs: props.bankOk ? props.bankTxs : [], today, horizonDays: 30, dismissedPaid: dismissed, overrides }), [start.value, props.entries, schedules, props.dues, props.balances, props.bankOk, props.bankTxs, today, dismissed, overrides])
  const net = forecast.end - forecast.start
  const health = forecast.start > 0 ? Math.max(0, Math.min(100, (forecast.end / forecast.start - 1) * 100 + 50)) : 50
  const healthColor = health >= 70 ? "#34d17b" : health >= 40 ? "#f5b84c" : "#ff5d6c"
  const healthLabel = health >= 70 ? "STRONG" : health >= 40 ? "FAIR" : "WEAK"
  const upcoming = forecast.lines.filter((line) => line.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  let running = forecast.start
  const rows = upcoming.map((line) => { running += line.amount; return { ...line, running } })
  const balances = [forecast.start, ...forecast.days.map((day) => day.balance)]
  const card = { background: "#14141c", border: "1px solid #23232f", borderRadius: 14 }

  return <div style={{ paddingBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px 8px", color: "#9a9aa6", fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}><span>PROJECTION SUMMARY</span><span>HEALTH: <b style={{ color: healthColor }}>{healthLabel}</b></span></div>
    <div style={{ ...card, margin: "0 12px", padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div><div className="money-label">STARTING BALANCE TODAY ({dateLabel(today)}):</div><strong className="money-amount">${forecast.start.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong><div className="money-label">PROJECTED INCOME (30D):</div><strong className="money-amount positive">{money(forecast.incomeTotal)}</strong><div className="money-label">PROJECTED EXPENSES (30D):</div><strong className="money-amount negative">{money(-forecast.expenseTotal)}</strong></div>
      <div style={{ textAlign: "right" }}><Gauge pct={health} /><b style={{ color: healthColor, fontSize: 11 }}>HEALTH: {healthLabel}</b><div className="money-label">FINAL PROJECTED BALANCE</div><strong className="money-amount">${forecast.end.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong><div className="money-label">NET FLOW: <b style={{ color: net >= 0 ? "#34d17b" : "#ff5d6c" }}>{money(net)}</b></div></div>
    </div>
    <div style={{ padding: "18px 16px 8px", color: "#9a9aa6", fontSize: 14, fontWeight: 800, letterSpacing: 1.1 }}>UNIFIED REGISTER</div>
    <div style={{ ...card, margin: "0 12px", overflow: "hidden" }}><div style={{ padding: "10px 14px", color: "#9a9aa6", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>FUTURE TRANSACTIONS / FORECAST</div>{rows.map((row, i) => <div key={`${row.date}-${i}`} style={{ display: "flex", gap: 8, padding: "11px 14px", borderTop: "1px solid #252531", fontSize: 12 }}><span style={{ width: 54, color: "#9a9aa6" }}>{dateLabel(row.date)}</span><span style={{ flex: 1, color: "#e8e8ee" }}>{row.label || row.description || "—"}<small style={{ display: "block", color: "#8a8a96" }}>{row.category || ""}</small></span><span style={{ color: "#5b8cff" }}>Scheduled</span><b style={{ color: row.amount >= 0 ? "#34d17b" : "#ff5d6c" }}>{money(row.amount)}</b><span style={{ width: 78, textAlign: "right", color: "#ddd" }}>${row.running.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "14px 12px 0" }}><div style={{ ...card, padding: 14 }}><div className="money-label">PROJECTED BALANCE</div><BalanceChart values={balances} /></div><div style={{ ...card, padding: 14 }}><div className="money-label">PROJECTION BREAKDOWN</div><div className="money-breakdown"><span>SOURCES OF CASH<br /><b className="positive">+${Math.round(forecast.incomeTotal).toLocaleString()}</b></span><span>USES OF CASH<br /><b className="negative">−${Math.round(forecast.expenseTotal).toLocaleString()}</b></span></div><div style={{ textAlign: "center", color: "#8a8a96", fontSize: 10 }}>NET FLOW: <b style={{ color: net >= 0 ? "#34d17b" : "#ff5d6c" }}>{money(net)}</b></div></div></div>
    <div style={{ ...card, margin: "18px 12px 0", padding: "12px 16px", textAlign: "center", color: "white", fontWeight: 800 }}>TODAY, {dateLabel(today)} — CURRENT BALANCE: <span className="positive">${forecast.start.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
  </div>
}
