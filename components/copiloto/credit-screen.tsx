"use client"

// CREDIT — every credit account in one register (Miguel, 2026-10-26).
//
// Cards, credit builders and tradeline subscriptions with what is
// owed, the due day, the frequency, a payoff plan (all at once, split
// in N months, or a fixed amount per month) and the full schedule of
// payments through the end of the year and until each account is paid
// off. Overdue accounts are flagged in red with the date the payment
// was due. The NEVER-LATE SYSTEM at the top applies the researched
// method: autopay minimum on every account, an alert 3–5 days before
// each due date, the 30-day bureau-reporting line, and utilization
// under 30% (goal under 10%).
//
// Balances no feed verifies are NOT invented: they show "Not verified"
// until Miguel enters the real number, and the schedule marks those
// payments as EXPECTED (estimated from the last bank payment). Data
// saves on every change and syncs to Supabase with the finance blob.

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Bell, Check, CreditCard, Gauge, Plus, ShieldCheck, Trash2, X } from "lucide-react"
import { FINANCE_SYNCED_EVENT } from "./finance-sync"
import {
  YEAR_END,
  buildFullSchedule,
  daysBetween,
  loadCreditDoc,
  money,
  newCreditAccount,
  newScoreEntry,
  r2,
  saveCreditDoc,
  todayLocal,
  type AutopayMode,
  type CreditAccount,
  type CreditDoc,
  type CreditFrequency,
  type PlanMode,
  type SchedPayment,
  type ScoreEntry,
} from "./credit-store"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-base text-white outline-none focus:border-yellow-500/60"
const labelCls = "block text-[9px] font-bold uppercase tracking-wider text-neutral-500"

function StatusPill({ acc, today }: { acc: CreditAccount; today: string }) {
  if (acc.closed)
    return <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-bold text-neutral-400">CLOSED</span>
  if (acc.overdueSince) {
    const days = daysBetween(acc.overdueSince, today)
    return (
      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-300">
        OVERDUE · was due {fmtDate(acc.overdueSince)}{days > 0 ? ` · ${days}d` : ""}
      </span>
    )
  }
  if (acc.flag)
    return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">{acc.flag}</span>
  if (acc.balance == null)
    return <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-300">TO VERIFY</span>
  return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">ACTIVE</span>
}

function AccountCard({
  acc,
  next,
  today,
  onChange,
  onDelete,
}: {
  acc: CreditAccount
  next: SchedPayment | undefined
  today: string
  onChange: (a: CreditAccount) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [balDraft, setBalDraft] = useState(acc.balance == null ? "" : String(acc.balance))
  const [limitDraft, setLimitDraft] = useState(acc.limit == null ? "" : String(acc.limit))
  const [dueDraft, setDueDraft] = useState(acc.dueDay == null ? "" : String(acc.dueDay))
  const [fixedDraft, setFixedDraft] = useState(acc.planFixed ? String(acc.planFixed) : "")
  const [monthsDraft, setMonthsDraft] = useState(String(acc.planMonths || 3))

  useEffect(() => {
    setBalDraft(acc.balance == null ? "" : String(acc.balance))
    setLimitDraft(acc.limit == null ? "" : String(acc.limit))
    setDueDraft(acc.dueDay == null ? "" : String(acc.dueDay))
    setFixedDraft(acc.planFixed ? String(acc.planFixed) : "")
    setMonthsDraft(String(acc.planMonths || 3))
  }, [acc.balance, acc.limit, acc.dueDay, acc.planFixed, acc.planMonths])

  const util = acc.limit && acc.balance != null ? Math.max(0, (acc.balance / acc.limit) * 100) : null
  const utilBad = util != null && util >= 30

  const commitBalance = () => {
    const v = balDraft.trim() === "" ? null : Math.max(0, Number(balDraft) || 0)
    if (v !== acc.balance) onChange({ ...acc, balance: v })
  }
  const commitLimit = () => {
    const v = limitDraft.trim() === "" ? null : Math.max(0, Number(limitDraft) || 0)
    if (v !== acc.limit) onChange({ ...acc, limit: v })
  }
  const commitDue = () => {
    const n = Math.floor(Number(dueDraft) || 0)
    const v = dueDraft.trim() === "" || n < 1 || n > 31 ? null : n
    if (v !== acc.dueDay) onChange({ ...acc, dueDay: v })
  }
  const markPaid = () => {
    const amt = next?.amount ?? acc.lastPaymentAmount ?? 0
    const updated: CreditAccount = {
      ...acc,
      lastPaymentDate: today,
      lastPaymentAmount: amt > 0 ? amt : acc.lastPaymentAmount,
      overdueSince: null,
      flag: acc.flag === "OVER LIMIT" ? acc.flag : "",
    }
    if (acc.balance != null && amt > 0) updated.balance = Math.max(0, r2(acc.balance - amt))
    onChange(updated)
  }

  return (
    <div className={`rounded-2xl border bg-neutral-950 p-3 ${acc.overdueSince && !acc.closed ? "border-rose-500/50" : "border-neutral-800"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
          <CreditCard className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-extrabold text-white">{acc.name}</span>
            <StatusPill acc={acc} today={today} />
          </span>
          <span className="block truncate text-[11px] text-neutral-500">
            {acc.kind}
            {acc.issuer ? ` · ${acc.issuer}` : ""}
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-neutral-400">
            {acc.balance != null ? (
              <>
                Owes <span className="font-bold text-white">{money(acc.balance)}</span>
                {acc.limit ? ` of ${money(acc.limit)} limit` : ""}
                {util != null ? ` · ${util.toFixed(0)}% used` : ""}
              </>
            ) : (
              <span className="text-sky-300">Balance not verified — tap to enter it</span>
            )}
          </span>
          <span className="block text-[11px] leading-snug text-neutral-500">
            {acc.lastPaymentDate ? `Last payment ${money(acc.lastPaymentAmount ?? 0)} · ${fmtDate(acc.lastPaymentDate)}` : "No payment recorded"}
            {next ? ` · Next: ${money(next.amount)} on ${fmtDate(next.date)}${next.kind === "expected" ? " (expected)" : ""}` : ""}
          </span>
          {acc.autopay !== "unknown" && (
            <span className="mt-0.5 inline-block rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-bold text-neutral-300">
              AUTOPAY: {acc.autopay === "off" ? "OFF" : acc.autopay === "minimum" ? "MINIMUM" : "FULL STATEMENT"}
            </span>
          )}
        </span>
      </button>

      {util != null && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className={`h-full rounded-full ${utilBad ? "bg-rose-500" : util >= 10 ? "bg-amber-400" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, util)}%` }}
            />
          </div>
          <p className={`mt-1 text-[10px] ${utilBad ? "text-rose-300" : "text-neutral-500"}`}>
            {utilBad
              ? `Utilization ${util.toFixed(0)}% — over the 30% ceiling. Pay it under ${money(r2((acc.limit ?? 0) * 0.3))} before the statement closes; under ${money(r2((acc.limit ?? 0) * 0.1))} is the ideal zone.`
              : `Utilization ${util.toFixed(0)}% — ceiling 30%, ideal under 10%.`}
          </p>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Balance owed</label>
              <input inputMode="decimal" className={inputCls} placeholder="Not verified" value={balDraft} onChange={(e) => setBalDraft(e.target.value)} onBlur={commitBalance} />
            </div>
            <div>
              <label className={labelCls}>Credit limit</label>
              <input inputMode="decimal" className={inputCls} placeholder="—" value={limitDraft} onChange={(e) => setLimitDraft(e.target.value)} onBlur={commitLimit} />
            </div>
            <div>
              <label className={labelCls}>Due day</label>
              <input inputMode="numeric" className={inputCls} placeholder="1–31" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} onBlur={commitDue} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Frequency</label>
              <select
                className={inputCls}
                value={acc.frequency}
                onChange={(e) => onChange({ ...acc, frequency: e.target.value as CreditFrequency })}
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Autopay</label>
              <select
                className={inputCls}
                value={acc.autopay}
                onChange={(e) => onChange({ ...acc, autopay: e.target.value as AutopayMode })}
              >
                <option value="unknown">Don't know</option>
                <option value="minimum">Minimum</option>
                <option value="full">Full statement</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Payoff plan</label>
              <select
                className={inputCls}
                value={acc.planMode}
                onChange={(e) => onChange({ ...acc, planMode: e.target.value as PlanMode })}
              >
                <option value="full">Pay in full</option>
                <option value="months">Split in months</option>
                <option value="fixed">Fixed $ / payment</option>
              </select>
            </div>
          </div>
          {acc.planMode === "months" && (
            <div>
              <label className={labelCls}>Split into how many months?</label>
              <input
                inputMode="numeric"
                className={inputCls}
                value={monthsDraft}
                onChange={(e) => setMonthsDraft(e.target.value)}
                onBlur={() => {
                  const n = Math.max(1, Math.min(60, Math.floor(Number(monthsDraft) || 1)))
                  if (n !== acc.planMonths) onChange({ ...acc, planMonths: n })
                }}
              />
            </div>
          )}
          {acc.planMode === "fixed" && (
            <div>
              <label className={labelCls}>Fixed amount per payment</label>
              <input
                inputMode="decimal"
                className={inputCls}
                value={fixedDraft}
                onChange={(e) => setFixedDraft(e.target.value)}
                onBlur={() => {
                  const n = Math.max(0, Number(fixedDraft) || 0)
                  if (n !== acc.planFixed) onChange({ ...acc, planFixed: n })
                }}
              />
            </div>
          )}
          {acc.note ? <p className="text-[11px] leading-snug text-neutral-500">{acc.note}</p> : null}
          <div className="flex flex-wrap gap-2">
            {!acc.closed && (
              <button type="button" onClick={markPaid} className="flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-2 text-[11px] font-bold text-emerald-300 active:scale-[0.98]">
                <Check className="size-3.5" /> Paid today
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange({ ...acc, closed: !acc.closed })}
              className="rounded-xl bg-neutral-800 px-3 py-2 text-[11px] font-bold text-neutral-300 active:scale-[0.98]"
            >
              {acc.closed ? "Reopen account" : "Mark closed"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmDelete) onDelete()
                else setConfirmDelete(true)
              }}
              className="flex items-center gap-1 rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-300 active:scale-[0.98]"
            >
              <Trash2 className="size-3.5" /> {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScheduleSection({ title, items, tone }: { title: string; items: SchedPayment[]; tone: "red" | "plain" }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className={`mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wider ${tone === "red" ? "text-rose-400" : "text-neutral-500"}`}>{title}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((p, i) => (
          <div
            key={`${p.accountId}-${p.date}-${i}`}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${p.overdue ? "border-rose-500/40 bg-rose-500/5" : "border-neutral-800 bg-neutral-900/60"}`}
          >
            <span className="w-[86px] shrink-0 text-[11px] font-bold text-neutral-300">{fmtDate(p.date)}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{p.accountName}</span>
            {p.kind === "expected" && <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[8px] font-bold text-sky-300">EXPECTED</span>}
            {p.overdue && <span className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold text-rose-300">OVERDUE</span>}
            <span className="shrink-0 text-[12px] font-extrabold text-white">{money(p.amount)}</span>
            {p.remainingAfter != null && <span className="hidden shrink-0 text-[10px] text-neutral-500 sm:block">→ {money(p.remainingAfter)} left</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CreditScreen() {
  const [doc, setDoc] = useState<CreditDoc | null>(null)
  const [newName, setNewName] = useState("")
  const [scoreDraft, setScoreDraft] = useState<ScoreEntry>(() => newScoreEntry())
  const jsonRef = useRef("")
  const today = todayLocal()

  useEffect(() => {
    const d = loadCreditDoc()
    jsonRef.current = JSON.stringify(d)
    setDoc(d)
    const onSync = () => {
      const fresh = loadCreditDoc()
      const j = JSON.stringify(fresh)
      if (j !== jsonRef.current) {
        jsonRef.current = j
        setDoc(fresh)
      }
    }
    window.addEventListener(FINANCE_SYNCED_EVENT, onSync)
    return () => window.removeEventListener(FINANCE_SYNCED_EVENT, onSync)
  }, [])

  const update = (next: CreditDoc) => {
    jsonRef.current = JSON.stringify(next)
    setDoc(next)
    saveCreditDoc(next)
    window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
  }

  const schedule = useMemo(() => (doc ? buildFullSchedule(doc.accounts, today) : []), [doc, today])

  const nextByAccount = useMemo(() => {
    const map = new Map<string, SchedPayment>()
    for (const p of schedule) {
      if (!map.has(p.accountId)) map.set(p.accountId, p)
    }
    return map
  }, [schedule])

  if (!doc) return <div className="p-4 text-sm text-neutral-500">Loading…</div>

  const accounts = doc.accounts
  const overdueAccounts = accounts.filter((a) => a.overdueSince && !a.closed)
  const verifiedDebt = accounts.filter((a) => !a.closed && a.balance != null).reduce((s, a) => s + (a.balance ?? 0), 0)
  const unverifiedCount = accounts.filter((a) => !a.closed && a.balance == null).length
  const overdueItems = schedule.filter((p) => p.date < today)
  const next7Items = schedule.filter((p) => p.date >= today && daysBetween(today, p.date) <= 7)
  const restYearItems = schedule.filter((p) => p.date > today && daysBetween(today, p.date) > 7 && p.date <= YEAR_END)
  const afterYearItems = schedule.filter((p) => p.date > YEAR_END)
  const noAutopay = accounts.filter((a) => !a.closed && a.autopay === "unknown").length

  const setAccount = (a: CreditAccount) => update({ ...doc, accounts: accounts.map((x) => (x.id === a.id ? a : x)) })
  const delAccount = (id: string) => update({ ...doc, accounts: accounts.filter((x) => x.id !== id) })
  const addAccount = () => {
    const n = newName.trim()
    if (!n) return
    update({ ...doc, accounts: [...accounts, newCreditAccount(n)] })
    setNewName("")
  }
  const addScore = () => {
    if (!scoreDraft.score || scoreDraft.score <= 0) return
    update({ ...doc, scores: [{ ...scoreDraft, id: scoreDraft.id }, ...doc.scores] })
    setScoreDraft(newScoreEntry())
  }
  const delScore = (id: string) => update({ ...doc, scores: doc.scores.filter((s) => s.id !== id) })

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-yellow-400/15 text-yellow-400">
          <CreditCard className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-extrabold leading-tight text-white">CREDIT</h1>
          <p className="text-[11px] text-neutral-500">Every credit account, due date and payoff plan in one place</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Accounts</p>
          <p className="mt-0.5 text-base font-extrabold text-white">{accounts.filter((a) => !a.closed).length}</p>
          <p className="text-[10px] text-neutral-500">{accounts.filter((a) => a.closed).length} closed</p>
        </div>
        <div className={`rounded-2xl border p-3 ${overdueAccounts.length ? "border-rose-500/50 bg-rose-500/5" : "border-neutral-800 bg-neutral-950"}`}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Overdue</p>
          <p className={`mt-0.5 text-base font-extrabold ${overdueAccounts.length ? "text-rose-300" : "text-white"}`}>{overdueAccounts.length}</p>
          <p className="text-[10px] text-neutral-500">{overdueItems.length} payments late</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Verified debt</p>
          <p className="mt-0.5 text-base font-extrabold text-white">{money(verifiedDebt)}</p>
          <p className="text-[10px] text-neutral-500">{unverifiedCount} balances to verify</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-yellow-500/30 bg-yellow-400/5 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-yellow-300">
          <ShieldCheck className="size-4" /> NEVER-LATE SYSTEM
        </p>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-neutral-300">
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            Autopay the minimum on EVERY account — with that floor set, an account can't go past due even if you forget. Full statement balance where you can, to skip interest.
            {noAutopay > 0 ? <span className="font-bold text-amber-300"> {noAutopay} accounts still show autopay unknown.</span> : null}
          </li>
          <li className="flex gap-1.5">
            <Bell className="mt-0.5 size-3.5 shrink-0 text-yellow-400" />
            Check this page 3–5 days before each due date and confirm the payment posted — not on the due date itself.
          </li>
          <li className="flex gap-1.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
            Bureaus only report a late at 30+ days. A fee can hit on day 1, but before day 30 you can still fix it without a mark. A mark stays 7 years.
          </li>
          <li className="flex gap-1.5">
            <Gauge className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
            Keep every card under 30% of its limit — under 10% is the ideal zone — and pay down before the statement closes, because that is the balance that gets reported.
          </li>
        </ul>
      </div>

      <h2 className="mb-2 mt-5 px-0.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Register</h2>
      <div className="flex flex-col gap-2">
        {accounts.map((acc) => (
          <AccountCard key={acc.id} acc={acc} next={nextByAccount.get(acc.id)} today={today} onChange={setAccount} onDelete={() => delAccount(acc.id)} />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className={inputCls} placeholder="Add a credit account…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="button" onClick={addAccount} className="flex shrink-0 items-center gap-1 rounded-lg bg-yellow-400 px-3 text-[12px] font-extrabold text-black active:scale-[0.98]">
          <Plus className="size-4" /> Add
        </button>
      </div>

      <h2 className="mb-2 mt-6 px-0.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Schedule — every payment</h2>
      <div className="space-y-4">
        <ScheduleSection title="Overdue — pay these first" items={overdueItems} tone="red" />
        <ScheduleSection title="Next 7 days" items={next7Items} tone="plain" />
        <ScheduleSection title="Through Dec 31, 2026" items={restYearItems} tone="plain" />
        <ScheduleSection title="2027 — until paid off" items={afterYearItems} tone="plain" />
        {schedule.length === 0 && <p className="text-[11px] text-neutral-500">No payments scheduled yet. Enter a balance or a last payment on an account and its schedule appears here.</p>}
        <p className="text-[10px] leading-snug text-neutral-600">
          EXPECTED = estimated from the last bank payment because the real balance is not verified yet. Enter the balance on the account and the schedule becomes the exact payoff plan.
        </p>
      </div>

      <h2 className="mb-2 mt-6 px-0.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Score log</h2>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={scoreDraft.date} onChange={(e) => setScoreDraft({ ...scoreDraft, date: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Score</label>
            <input inputMode="numeric" className={inputCls} placeholder="e.g. 612" value={scoreDraft.score ? String(scoreDraft.score) : ""} onChange={(e) => setScoreDraft({ ...scoreDraft, score: Math.floor(Number(e.target.value) || 0) })} />
          </div>
          <div>
            <label className={labelCls}>Bureau</label>
            <select className={inputCls} value={scoreDraft.bureau} onChange={(e) => setScoreDraft({ ...scoreDraft, bureau: e.target.value })}>
              <option>TransUnion</option>
              <option>Equifax</option>
              <option>Experian</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Source</label>
            <select className={inputCls} value={scoreDraft.source} onChange={(e) => setScoreDraft({ ...scoreDraft, source: e.target.value })}>
              <option>Credit Karma</option>
              <option>Experian app</option>
              <option>SmartCredit</option>
              <option>SoFi Relay</option>
              <option>myFICO</option>
              <option>Issuer app</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <button type="button" onClick={addScore} className="mt-2 flex items-center gap-1 rounded-xl bg-yellow-400 px-3 py-2 text-[11px] font-extrabold text-black active:scale-[0.98]">
          <Plus className="size-3.5" /> Add score
        </button>
        <div className="mt-3 flex flex-col gap-1.5">
          {doc.scores.length === 0 && <p className="text-[11px] text-neutral-500">No scores logged yet. Free tracking: Credit Karma (TransUnion + Equifax) + Experian app (FICO 8) + AnnualCreditReport.com weekly for the full reports.</p>}
          {doc.scores.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
              <span className="w-[86px] shrink-0 text-[11px] font-bold text-neutral-300">{fmtDate(s.date)}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-300">
                {s.bureau} · {s.source}
              </span>
              <span className="shrink-0 text-sm font-extrabold text-white">{s.score}</span>
              <button type="button" onClick={() => delScore(s.id)} className="shrink-0 text-neutral-500" aria-label="Delete score entry">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
