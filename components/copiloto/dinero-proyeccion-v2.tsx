"use client"

// DINERO · PROJECTIONS view v2 — English clone of Miguel's design photo.
// Same math as dinero-forecast.ts; presentation only.

import { useMemo } from "react"
import { money, type CashFlowEntry, type ScheduledEntry } from "./types"
import { type DueItem, type RegisterAccount } from "./registers-store"
import {
  buildForecast,
  startingBalance,
  todayKey,
  type ForecastBankTx,
  type ForecastLine,
} from "./
dinero-forecast"
import { FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./
finance-sync"
import { useForecastInputs } from "./
dinero-proyeccion"

function readList<T>(key: string): T[] {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(p) ? (p as T[]) : []
  } catch { return [] }
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
function fmtDate(iso: string): string {
  const m = String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${MONTHS[Number(m[2])-1]} ${Number(m[3])}` : "—"
}
function fmtMoney(n: number): string {
  const v = Math.abs(n)
  const s = v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
  return (n < 0 ? "−$" : n > 0 ? "+$" : "$") + s
}

// Gauge SVG (semicircle red→yellow→green)
function Gauge({ pct }: { pct: number }) {
  const ang = -90 + Math.max(0, Math.min(100, pct)) * 1.8
  const rad = (ang * Math.PI) / 180
  const x2 = 55 + 38 * Math.cos(rad), y2 = 52 + 38 * Math.sin(rad)
  return (
    <svg viewBox="0 0 110 62" style={{width:110,height:62}}>
      <path d="M10,52 A45,45 0 0,1 100,52" fill="none" stroke="#23232f" strokeWidth="11" strokeLincaps="round"/>
      <path d="M10,52 A45,45 0 0,1 40,14" fill="none" stroke="#ff5d6c" strokeWidth="11" strokeLincaps="round"/>
      <path d="M40,14 A45,45 0 0,1 70,14" fill="none" stroke="#f5b84c" strokeWidth="11" strokeLincaps="round"/>
      <path d="M70,14 A45,45 0 0,1 100,52" fill="none" stroke="#34d17b" strokeWidth="11" strokeLincaps="round"/>
      <line x1="55" y1="52" x2={x2} y2={y2} stroke="#fff" strokeWidth="3" strokeLincaps="round"/>
      <circle cx="55" cy="52" r="5" fill="#fff"/>
    </svg>
  )
}

// Projected balance line chart
function BalanceChart({ days, start }: { days: {date:string;balance:number}[]; start: number }) {
  if (!days.length) return null
  const W = 380, H = 150, PL = 44, PB = 22
  const vals = [start, ...days.map(d=>d.balance)]
  const min = Math.min(...vals), max = Math.max(...vals)
  const rng = Math.max(1, max - min)
  const X = (i:number) => PL + (i/(vals.length-1))*(W-PL-8)
  const Y = (v:number) => 8 + (1-(v-min)/rng)*(H-8-PB)
  const pts = vals.map((v,i)=> `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")
  const area = `${PL},${Y(start).toFixed(1)} ${pts} ${X(vals.length-1).toFixed(1)},${H-PB} ${PL},${H-PB}`
  const ticks = [0.25,0.5,0.75].map(f=>{
    const v = min + rng*f
    return { y: Y(v), label: "$"+Math.round(v).toLocaleString() }
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}` } style={{width:"100%",height:"auto",display:"block"}}>
      <defs><linearGradient id="pcf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#34d17b" stopOpacity=".3"/><stop offset="1" stopColor="#34d17b" stopOpacity="0"/>
      </linearGradient></defs>
      {[0,1,2,3].map(i=><line key={i} x1={PL} y1={8+i*(H-PB-8)/3} x2={W-8} y2={8+i*(H-PB-8)/3} stroke="#23232f" strokeWidth="1"/>)}
      {ticks.map((t,i)=><text key={i} x={2} y={t.y+3} fill="#8a8a96" fontSize="9">{t.label}</text>)}
      <polygon points={area} fill="url(#pcf)"/>
      <polyline points={pts} fill="none" stroke="#34d17b" strokeWidth="2.5"/>
      <circle cx={X(0)} cy={Y(start)} r="4.5" fill="#5b8cff"/>
      <circle cx={X(vals.length-1)} cy={Y(vals[vals.length-1])} r="4.5" fill="#34d17b"/>
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
  const horizonDays = 30

  const inicio = useMemo(()=>startingBalance(props.registers, props.balances, props.otherFunds),[
    props.registers,props.balances,props.otherFunds])

  const fc = useMemo(()=>buildForecast({
    startBalance: inicio.value,
    entries: props.entries,
    schedules,
    dues: props.dues,
    balances: props.balances,
    bankTxs: props.bankOk ? props.bankTxs : [],
    today,
    horizonDays,
    dismissedPaid: dismissed,
    overrides,
  }),[inicio.value,props.entries,schedules,props.dues,props.balances,props.bankOk,props.bankTxs,today,horizonDays,dismissed,overrides])

  const net = fc.end - fc.start
  const healthPct = fc.start > 0 ? Math.max(0,Math.min(100,(fc.end/fc.start-1)*100+50)) : 50
  const healthLbl = healthPct >= 70 ? "STRONG" : healthPct >= 40 ? "FAIR" : "WEAK"
  const healthColor = healthPct >= 70 ? "#34d17b" : healthPct >= 40 ? "#f5b84c" : "#ff5d6c"

  // Top upcoming lines for the events list
  const upcoming: ForecastLine[] = useMemo(()=>{
    const ls = [...fc.lines].filter(l=>l.date >= today)
      .sort((a,b)=>a.date<b.date?-1:1).slice(0,12)
    return ls
  },[fc.lines,today])

  // Sources / Uses breakdown (top categories)
  const byCat = useMemo(()=>{
    const inc = new Map<string,number>()
    const exp = new Map<string,number>()
    for (const l of fc.lines) {
      const c = l.category || (l.amount>0?"Income":"Expense")
      if (l.amount > 0) inc.set(c,(inc.get(c)||0)+l.amount)
      else exp.set(c,(exp.get(c)||0)+Math.abs(l.amount))
    }
    const top = (m:Map<string,number>)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
    return { inc: top(inc), exp: top(exp) }
  },[fc.lines])

  const endDateLbl = fmtDate(fc.endDate)
  const todayLbl = fmtDate(today).toUpperCase()

  // Running balance for the unified register table
  let runBal = fc.start
  const rows = upcoming.map(l=>{
    runBal += l.amount
    return { ...l, bal: runBal }
  })

  return (
    <div style={{paddingBottom:24}}>
      {/* ===== PROJECTION SUMMARY (top card) ===== */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px 8px"}}>
        <span style={{fontSize:12,fontWeight:800,letterSpacing:1.5,color:"#9a9aa6"">PROJECTION SUMMARY</span>
        <span style={{fontSize:12,fontWeight:800,letterSpacing:1">HEALTH: <span style={{color:healthColor}}>{healthLbl}</span></span>
      </div>
      <div style={{margin:"0 12px",background:"#14141c",border:"1px solid #23232f",borderRadius:14,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#8a8a96",letterSpacing:.8,marginBottom:4">STARTING BALANCE TODAY ({todayLbl}):</div>
            <div style={{fontSize:24,fontWeight:800,color:"#fff",marginBottom:12}}>${fc.start.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
            <div style={{fontSize:10,color:"#8a8a96",letterSpacing:.8,marginBottom:4">PROJECTED INCOME (30D):</div>
            <div style={{fontSize:20,fontWeight:800,color:"#34d17b",marginBottom:12}}>{fmtMoney(fc.incomeTotal)}</div>
            <div style={{fontSize:10,color:"#8a8a96",letterSpacing:.8,marginBottom:4">PROJECTED EXPENSES (30D):</div>
            <div style={{fontSize:20,fontWeight:800,color:"#ff5d6c"}}>{fmtMoney(-fc.expenseTotal)}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <Gauge pct={healthPct} />
            <div style={{fontSize:11,fontWeight:800,color:healthColor,marginTop:2">HEALTH: {healthLbl}</div>
            <div style={{fontSize:10,color:"#8a8a96",marginTop:10,letterSpacing:.6">FINAL PROJECTED BALANCE<br/>({endDateLbl}):</div>
            <div style={{fontSize:24,fontWeight:800,color:"#fff"}}>${fc.end.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
            <div style={{fontSize:11,color:"#8a8a96",marginTop:6">NET FLOW: <b style={{color:net>=0?"#34d17b":"#ff5d6c"}}>{fmtMoney(net)}</b></div>
          </div>
        </div>
      </div>

      {/* ===== UNIFIED REGISTER ===== */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"18px 16px 8px"}}>
        <span style={{fontSize:16,color:"#9a9aa6"}}>?</span>
        <h2 style={{fontSize:14,fontWeight:800,letterSpacing:1.2,color:"#fff"">UNIFIED REGISTER</h2>
      </div>

      <div style={{margin:"0 12px",background:"#14141c",border:"1px solid #23232f",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"flex",padding:"10px 14px",borderBottom:"1px solid #23232f",fontSize:10,fontWeight:800,letterSpacing:1,color:"#9a9aa6"}}>
          <span style={{width:56">DATE</span>
          <span style={{flex:1">DESCRIPTION</span>
          <span style={{width:78,textAlign:"center"">CATEGORY</span>
          <span style={{width:72,textAlign:"center"">STATUS</span>
          <span style={{width:78,textAlign:"right"">AMOUNT</span>
          <span style={{width:88,textAlign:"right"">RUNNING<br/>BALANCE</span>
        </div>

        <div style={{padding:"8px 14px 4px",fontSize:11,fontWeight:800,letterSpacing:1.2,color:"#8a8a96"">FUTURE TRANSACTIONS / FORECAST</div>

        {rows.length===0 && <div style={{padding:16,color:"#8a8a96",fontSize:13">No upcoming scheduled transactions.</div>}
        {rows.map((l,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"11px 14px",borderBottom:i<rows.length-1?"1px solid #1a1a24":"none",fontSize:12}}>
            <span style={{color:"#9a9a96",fontWeight:700,fontSize:11,width:56}}>{fmtDate(l.date)}</span>
            <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#e8e8ee"}}>
              {l.label||l.description||"—"}
              <small style={{display:"block",color:"#8a8a96",fontSize:10}}>{l.category||""}</small>
            </span>
            <span style={{width:78,textAlign:"center",color:"#5b8cff",fontSize:11,fontWeight:700">Scheduled</span>
            <span style={{width:78,textAlign:"right",fontWeight:800,color:l.amount>=0?"#34d17b":"#ff5d6c"}}>{fmtMoney(l.amount)}</span>
            <span style={{width:88,textAlign:"right",color:"#8a8a96",fontSize:11}}>${l.bal.toLocaleString("en-US",{minimumFractionDigits:2})}<br/><span style={{color:l.amount>=0?"#34d17b":"#ff5d6c",fontSize:10}}>? ${Math.abs(l.amount).toLocaleString("en-US",{minimumFractionDigits:2})}</span></span>
          </div>
        ))}
      </div>

      {/* ===== CHART + BREAKDOWN ===== */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,margin:"14px 12px 0"}}>
        <div style={{background:"#14141c",border:"1px solid #23232f",borderRadius:14,padding:14}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1,color:"#9a9aa6",marginBottom:10">PROJECTED BALANCE</div>
          <BalanceChart days={fc.days.map(d=>({date:d.date,balance:d.balance}))} start={fc.start} />
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#8a8a96",marginTop:6}}>
            <span>{todayLbl}</span><span>NOV 25</span>
          </div>
        </div>
        <div style={{background:"#14141c",border:"1px solid #23232f",borderRadius:14,padding:14}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1,color:"#9a9aa6",marginBottom:10">PROJECTION BREAKDOWN</div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:"#8a8a96",textAlign:"center",marginBottom:6">Sources<br/>of Cash</div>
              {byCat.inc.map(([c,v],i)=>(
                <div key={i} style={{background:"rgba(52,209,123,.16)",border:"1px solid rgba(52,209,123,.4)",borderRadius:6,padding:"7px 4px",marginBottom:6,fontSize:9,fontWeight:800,color:"#34d17b",textAlign:"center",lineHeight:1.3}}>
                  {String(c).toUpperCase().slice(0,14)}<br/>+${Math.round(v).toLocaleString()}
                </div>
              ))}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:"#8a8a96",textAlign:"center",marginBottom:6">Uses<br/>of Cash</div>
              {byCat.exp.map(([c,v],i)=>(
                <div key={i} style={{background:"rgba(255,93,108,.12)",border:"1px solid rgba(255,93,108,.35)",borderRadius:6,padding:"7px 4px",marginBottom:6,fontSize:9,fontWeight:800,color:"#ff5d6c",textAlign:"center",lineHeight:1.3}}>
                  {String(c).toUpperCase().slice(0,14)}<br/>?${Math.round(v).toLocaleString()}
                </div>
              ))}
            </div>
          </div>
          <div style={{textAlign:"center",marginTop:8,fontSize:10,color:"#8a8a96"">NET FLOW: <b style={{color:net>=0?"#34d17b":"#ff5d6c",fontSize:13}}>{fmtMoney(net)}</b></div>
        </div>
      </div>

      {/* ===== FOOTER: current balance ===== */}
      <div style={{margin:"18px 12px 0",padding:"12px 16px",background:"#14141c",border:"1px solid #23232f",borderRadius:14,textAlign:"center",fontSize:13,fontWeight:800,color:"#fff",letterSpacing:.5}}>
        TODAY, {todayLbl} ? CURRENT BALANCE: <span style={{color:"#34d17b"}}>${fc.start.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
      </div>
    </div>
  )
}
