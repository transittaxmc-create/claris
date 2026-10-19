"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check } from "lucide-react"
import { BottomNav, TABS_EN_MAS, type Tab } from "./bottom-nav"
import { AIScreen } from "./ai-screen"
import { DataScreen } from "./data-screen"
import { HowItWorksScreen } from "./how-it-works-screen"
import { DashScreen } from "./dash-screen"
import { V1DashScreen } from "./v1-dash/v1-dash-screen"
import { EntryScreen } from "./entry-screen"
import { ExpensesScreen } from "./expenses-screen"
import { FinanceScreen } from "./finance-screen"
import { RegisterScreen } from "./register-screen"
import { ReportsScreen } from "./reports-screen"
import { SobresScreen } from "./sobres-screen"
import { TollAuditScreen } from "./toll-audit-screen"
import { TripEditSheet } from "./trip-edit-sheet"
import { ReceiptScanner } from "./receipt-scanner"
import { useShift } from "./shift"
import { guardarMovimiento, movimientoDeGasto } from "./cash-flow-store"
import { applyDifferenceToTrip, applyBankMatchesToTrips, normalizeTripStatus } from "./reconciliation"
import { recordTrip } from "./mileage-log"
import { SEED_TRIPS, newTrip, stampExpense, applyExpenseUpdatesToExpenses, grossOf, netOf, tripDateOf, money, type Expense, type ExpenseDocType, type Trip, type ScheduledEntry } from "./types"
import {
  addBillPayment,
  billRemaining,
  learnConfirm,
  offerReceiptBillMatch,
  ruleKeyFor,
  syncBillToProjections,
} from "./bill-payments"
import { buildBackupBundle, buildBackupHtml, collectAppKeys } from "@/lib/backup"
import {
  addExpenseTombstone,
  addTombstone,
  buildExport,
  clearAllData,
  importExport,
  loadExpenseTombstones,
  loadExpenses,
  loadExpensesFromIndexedDB,
  loadSyncCode,
  loadTombstones,
  loadTrips,
  loadTripsFromIndexedDB,
  saveExpenseTombstones,
  saveExpenses,
  saveExpensesToIndexedDB,
  saveSyncCode,
  saveTombstones,
  saveTrips,
  saveTripsToIndexedDB,
  stampTrip,
  storageInfo,
  type StorageInfo,
} from "./storage"
import {
  deleteCloudDoc,
  isValidSyncCode,
  mergeTrips,
  MIN_SYNC_CODE_LENGTH,
  syncWithCloud,
  type Tombstones,
} from "@/lib/sync"
import { localDateKey } from "@/lib/dates"
import { compareVersion } from "@/lib/version-check"
import { applyMergedFinance, collectLocalFinance, financeCounts } from "./finance-sync"
import { queueDualSync, flushDualSyncQueue } from "./dual-sync"

const PRODUCCION_URL = "https://claris-lime.vercel.app"

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-bold text-white">{label}</p>
      <p className="text-sm text-neutral-500">This section isn't in the redesign yet.</p>
    </div>
  )
}

export function CopilotoApp() {
  const [tab, setTab] = useState<Tab>("ENTRY")
  const shift = useShift()
  const [trips, setTrips] = useState<Trip[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [editing, setEditing] = useState<Trip | null>(null)
  const [dayClosed, setDayClosed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [syncCode, setSyncCode] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncTone, setSyncTone] = useState<"ok" | "error" | "info">("info")
  const [syncing, setSyncing] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  /** Document type preseleccionado al abrir el escáner desde un register. */
  const [scannerHint, setScannerHint] = useState<ExpenseDocType | "">("")
  const [mas, setMas] = useState(false)
  const [copiaVieja, setCopiaVieja] = useState<string | null>(null)
  // Sha de producción cuando ESTA copia es una versión de prueba más nueva.
  const [versionPrueba, setVersionPrueba] = useState<string | null>(null)
  const [avisoCerrado, setAvisoCerrado] = useState(false)

  const tripsRef = useRef<Trip[]>([])
  const expensesRef = useRef<Expense[]>([])
  const tombstonesRef = useRef<Tombstones>({})
  const expenseTombstonesRef = useRef<Tombstones>({})
  const savedTimer = useRef<number | null>(null)
  const autoSynced = useRef(false)

  useEffect(() => {
    tripsRef.current = trips
  }, [trips])

  useEffect(() => {
    const propio = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    if (!propio) return
    let vivo = true
    let desajustes = 0
    async function revisar() {
      try {
        const res = await fetch(`${PRODUCCION_URL}/api/version`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { sha?: string; short?: string; builtAt?: string | null }
        if (!vivo || !data.sha) return
        const estado = compareVersion(
          { sha: propio, builtAt: process.env.NEXT_PUBLIC_BUILD_TIME },
          { sha: data.sha, builtAt: data.builtAt },
        )
        if (estado === "older") {
          desajustes += 1
          if (desajustes >= 2) setCopiaVieja(data.short ?? data.sha.slice(0, 7))
          setVersionPrueba(null)
        } else if (estado === "newer") {
          // Preview más nueva que producción: aviso informativo, no "copia vieja".
          desajustes = 0
          setCopiaVieja(null)
          setVersionPrueba(data.short ?? data.sha.slice(0, 7))
        } else {
          desajustes = 0
          setCopiaVieja(null)
          setVersionPrueba(null)
        }
      } catch {}
    }
    revisar()
    const id = window.setTimeout(revisar, 8000)
    return () => {
      vivo = false
      window.clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    expensesRef.current = expenses
  }, [expenses])

  const persist = useCallback((list: Trip[], expenseList: Expense[] = expensesRef.current) => {
    const res = saveTrips(list)
    const resExp = saveExpenses(expenseList)
    const error = !res.ok ? res.error : !resExp.ok ? resExp.error : undefined
    if (error) {
      setSaveState("error")
      setSaveError(error ?? "Couldn't save")
      return
    }
    setSaveState("saved")
    setSaveError(null)
    if (savedTimer.current) window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 2000)
    saveTripsToIndexedDB(list).catch(() => {})
    saveExpensesToIndexedDB(expenseList).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const local = loadTrips() ?? []
      const at = new Date().toISOString()
      const withStamps = local.some((t) => !t.raw?.savedAt)
        ? local.map((t) => (t.raw?.savedAt ? t : stampTrip(t, at)))
        : local
      let permanent: Trip[] = []
      try {
        permanent = await loadTripsFromIndexedDB()
      } catch {}
      const merged = mergeTrips(withStamps, permanent, loadTombstones())
      const localExp = loadExpenses() ?? []
      let permanentExp: Expense[] = []
      try {
        permanentExp = await loadExpensesFromIndexedDB()
      } catch {}
      const mergedExp = mergeTrips(localExp, permanentExp, loadExpenseTombstones())
      if (cancelled) return
      tombstonesRef.current = merged.deleted
      saveTombstones(merged.deleted)
      expenseTombstonesRef.current = mergedExp.deleted
      saveExpenseTombstones(mergedExp.deleted)
      setTrips(merged.trips)
      tripsRef.current = merged.trips
      setExpenses(mergedExp.trips as Expense[])
      expensesRef.current = mergedExp.trips as Expense[]
      setSyncCode(loadSyncCode())
      setHydrated(true)
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    flushDualSyncQueue((id) => tripsRef.current.find((t) => t.id === id))
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => persist(trips, expenses), 250)
    return () => window.clearTimeout(timer)
  }, [trips, expenses, hydrated, persist])

  useEffect(() => {
    if (!hydrated) return
    const flush = () => persist(tripsRef.current, expensesRef.current)
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [hydrated, persist])

  function saveNewFromEntry(t: Trip) {
    const stamped = stampTrip(normalizeTripStatus(t))
    setTrips((prev) => [stamped, ...prev])
    setTab("REGISTER")
    queueDualSync(stamped)
    // Registro de millas IRS: recogida → dejada con su plataforma
    try {
      recordTrip(
        { pickup: stamped.pickup, dropoff: stamped.dropoff, platform: String(stamped.platform ?? ""), time: stamped.time },
        tripDateOf(stamped),
      )
    } catch {}
  }

  function saveEdit(t: Trip) {
    const stamped = stampTrip(normalizeTripStatus(t))
    setTrips((prev) => {
      const exists = prev.some((p) => p.id === stamped.id)
      return exists ? prev.map((p) => (p.id === stamped.id ? stamped : p)) : [stamped, ...prev]
    })
    setEditing(null)
    queueDualSync(stamped)
  }

  function applyReconciliation(t: Trip) {
    const fixed = normalizeTripStatus(applyDifferenceToTrip(t))
    if (fixed === t) return
    setTrips((prev) => prev.map((p) => (p.id === fixed.id ? stampTrip(fixed) : p)))
  }

  function applyBankMatches(matches: { tripId: string; amount: number }[]): number {
    const result = applyBankMatchesToTrips(tripsRef.current, matches)
    if (result.applied === 0) return 0
    tripsRef.current = result.trips
    setTrips(result.trips.map((t) => stampTrip(t)))
    return result.applied
  }

  function applyExpenseUpdates(
    updates: { expenseId: string; category?: string; classification?: "business" | "personal" }[],
  ): number {
    const result = applyExpenseUpdatesToExpenses(expensesRef.current, updates)
    if (result.applied === 0) return 0
    expensesRef.current = result.expenses
    setExpenses(result.expenses.map((e) => stampExpense(e)))
    return result.applied
  }

  function applySchedules(entries: ScheduledEntry[]): number {
    const valid = entries
      .filter((entry) => entry && entry.description && Number(entry.amount) > 0)
      .map((entry) => ({ ...entry, id: crypto.randomUUID(), amount: Number(entry.amount), active: true }))
    if (valid.length === 0) return 0
    try {
      const current = JSON.parse(localStorage.getItem("claris_scheduled_entries") || "[]")
      localStorage.setItem(
        "claris_scheduled_entries",
        JSON.stringify([...valid, ...(Array.isArray(current) ? current : [])]),
      )
    } catch {
      return 0
    }
    setTab("FINANCE")
    return valid.length
  }

  function deleteTrip(id: string) {
    tombstonesRef.current = addTombstone(id)
    setTrips((prev) => prev.filter((p) => p.id !== id))
    setEditing(null)
  }

  function saveExpense(e: Expense) {
    const stamped = stampExpense(e)
    setExpenses((prev) => {
      const exists = prev.some((p) => p.id === stamped.id)
      return exists ? prev.map((p) => (p.id === stamped.id ? stamped : p)) : [stamped, ...prev]
    })
    guardarMovimiento(movimientoDeGasto(stamped))
  }

  function deleteExpense(id: string) {
    expenseTombstonesRef.current = addExpenseTombstone(id)
    setExpenses((prev) => prev.filter((p) => p.id !== id))
  }

  function saveScannedIncome(e: {
    description: string
    category: string
    amount: number
    date: string
    notes?: string
  }) {
    const entry: ScheduledEntry = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sch-${Date.now()}`,
      kind: "income",
      description: e.description || "Income",
      category: e.category,
      amount: Number(e.amount) || 0,
      startDate: e.date,
      nextDate: e.date,
      frequency: "once",
      active: true,
    }
    try {
      const prev: ScheduledEntry[] = JSON.parse(localStorage.getItem("claris_scheduled_entries") || "[]")
      localStorage.setItem(
        "claris_scheduled_entries",
        JSON.stringify([entry, ...(Array.isArray(prev) ? prev : [])]),
      )
    } catch {
      try {
        localStorage.setItem("claris_scheduled_entries", JSON.stringify([entry]))
      } catch {}
    }
  }

  const escanerTotales = useMemo(() => {
    const mes = localDateKey(new Date()).slice(0, 7)
    const ingresos = trips
      .filter((t) => tripDateOf(t).slice(0, 7) === mes)
      .reduce((s, t) => s + netOf(t), 0)
    const gastos = expenses
      .filter((e) => String(e.date || "").slice(0, 7) === mes)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    let presupuesto = 0
    try {
      const guardado = Number(localStorage.getItem("claris_monthly_budget"))
      if (Number.isFinite(guardado) && guardado > 0) presupuesto = guardado
    } catch {}
    return {
      ingresos: Math.round(ingresos * 100) / 100,
      gastos: Math.round(gastos * 100) / 100,
      presupuesto,
    }
  }, [trips, expenses])

  const refreshInfo = useCallback(() => {
    storageInfo(tripsRef.current.length, expensesRef.current.length)
      .then(setInfo)
      .catch(() => {})
  }, [])

  const runSync = useCallback(
    async (code: string, silent = false) => {
      setSyncing(true)
      if (!silent) setSyncMessage(null)
      const result = await syncWithCloud<Trip>(
        code,
        tripsRef.current,
        tombstonesRef.current,
        expensesRef.current,
        expenseTombstonesRef.current,
        // DINERO (libro, recurrentes, cuentas) en el mismo documento cifrado.
        collectLocalFinance(),
      )
      if (result.ok && Array.isArray(result.trips)) {
        applyMergedFinance(result.finance)
        const fin = financeCounts(result.finance)
        const next = result.trips as Trip[]
        const nextExp = (result.expenses ?? []) as Expense[]
        tombstonesRef.current = (result.deleted as Tombstones) ?? {}
        saveTombstones(tombstonesRef.current)
        expenseTombstonesRef.current = (result.deletedExpenses as Tombstones) ?? {}
        saveExpenseTombstones(expenseTombstonesRef.current)
        tripsRef.current = next
        setTrips(next)
        expensesRef.current = nextExp
        setExpenses(nextExp)
        persist(next, nextExp)
        setSyncTone("ok")
        setSyncMessage(
          result.financeSkipped
            ? `Synced · ${next.length} trips and ${nextExp.length} expenses. MONEY was not uploaded: the document exceeds the server limit.`
            : `Synced · ${next.length} trips, ${nextExp.length} expenses, ${fin.ledger} movements and ${fin.schedules} recurring`,
        )
      } else if (result.reason === "not_configured") {
        setSyncTone("info")
        setSyncMessage(
          "The sync database still needs activating in Vercel (Storage → KV). Meanwhile you can use EXPORT/IMPORT JSON.",
        )
      } else {
        setSyncTone("error")
        setSyncMessage(`No se pudo sincronizar: ${result.message}`)
      }
      setSyncing(false)
      refreshInfo()
    },
    [persist, refreshInfo],
  )

  useEffect(() => {
    if (!hydrated || !syncCode || autoSynced.current) return
    autoSynced.current = true
    runSync(syncCode, true)
  }, [hydrated, syncCode, runSync])

  function exportJson() {
    persist(tripsRef.current, expensesRef.current)
    const json = buildExport(trips)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const stamp = localDateKey(new Date())
    a.href = url
    a.download = `islandcity-tip-tracker-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const result = importExport(String(reader.result))
      if (result) {
        const next = result.map((t) => (t.raw?.savedAt ? t : stampTrip(t)))
        tripsRef.current = next
        setTrips(next)
        const exp = loadExpenses() ?? []
        expensesRef.current = exp
        setExpenses(exp)
        setTab("REGISTER")
      } else {
        alert("Couldn't read the file. Make sure it's a valid export.")
      }
    }
    reader.readAsText(file)
  }

  function exportFullBackup() {
    persist(tripsRef.current, expensesRef.current)
    const keys = collectAppKeys()
    const bundle = buildBackupBundle(keys)
    const html = buildBackupHtml(bundle)
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `claris-backup-${localDateKey(new Date())}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadDemo() {
    const demo = SEED_TRIPS.length ? SEED_TRIPS : []
    if (demo.length === 0) {
      alert("No demo data in this build.")
      return
    }
    const stamped = demo.map((t) => stampTrip(t))
    tripsRef.current = stamped
    setTrips(stamped)
    setTab("REGISTER")
  }

  async function resetAll() {
    // RESET TOTAL: primero se borra el documento CIFRADO de la nube (Supabase
    // sync_docs) con el código de sync activo — así al probar la sync (y el
    // feed de Plaid) todo arranca con datos frescos, sin historia vieja.
    const code = loadSyncCode()
    if (code) await deleteCloudDoc(code)
    clearAllData()
    tripsRef.current = []
    expensesRef.current = []
    setTrips([])
    setExpenses([])
    tombstonesRef.current = {}
    expenseTombstonesRef.current = {}
    setSyncCode(null)
    saveSyncCode(null)
    setSaveState("idle")
    setSaveError(null)
    refreshInfo()
  }

  function resetCache() {
    try {
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
    } catch {}
    window.location.reload()
  }

  function connectSync(code: string) {
    if (!isValidSyncCode(code)) {
      setSyncTone("error")
      setSyncMessage(`Código inválido (mín. ${MIN_SYNC_CODE_LENGTH} characters).`)
      return
    }
    saveSyncCode(code)
    setSyncCode(code)
    runSync(code)
  }

  function disconnectSync() {
    saveSyncCode(null)
    setSyncCode(null)
    setSyncMessage("Sync desconectado")
    setSyncTone("info")
  }

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-neutral-500">
        Cargando…
      </div>
    )
  }

  return (
    <div
      className="flex h-[100dvh] flex-col bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {copiaVieja && !avisoCerrado && (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-950/80 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1">
            Copia vieja detectada. Abre{" "}
            <a href={PRODUCCION_URL} className="font-bold underline">
              claris-lime.vercel.app
            </a>{" "}
            (prod {copiaVieja}).
          </span>
          <button type="button" onClick={() => setAvisoCerrado(true)} className="text-amber-400">
            ✕
          </button>
        </div>
      )}
      {versionPrueba && !avisoCerrado && (
        <div className="flex items-center gap-2 border-b border-cyan-500/40 bg-cyan-950/70 px-3 py-1.5 text-[11px] text-cyan-200">
          <span className="flex-1">
            Test build {(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7)} · newer than
            producción ({versionPrueba}).
          </span>
          <button type="button" onClick={() => setAvisoCerrado(true)} className="text-cyan-400">
            ✕
          </button>
        </div>
      )}
      {saveState === "saved" && (
        <div className="flex items-center gap-1.5 border-b border-emerald-800/50 bg-emerald-950/40 px-3 py-1 text-[10px] text-emerald-300">
          <Check className="size-3" /> Guardado
        </div>
      )}
      {saveState === "error" && (
        <div className="border-b border-rose-800/50 bg-rose-950/40 px-3 py-1 text-[10px] text-rose-300">
          Error saving: {saveError}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden">
        <div className={tab === "AI" ? "h-full min-h-0 overflow-hidden" : "h-full overflow-y-auto"}>
          {tab === "ENTRY" && <EntryScreen onSave={saveNewFromEntry} trips={trips} shift={shift} />}
          {tab === "REGISTER" && (
            <RegisterScreen
              trips={trips}
              onEdit={setEditing}
              onAdd={() => setEditing(newTrip())}
              onCloseDay={() => setDayClosed(true)}
              dayClosed={dayClosed}
              onExport={exportJson}
              onImport={importJson}
              onResetStorage={resetAll}
              onApplyReconciliation={applyReconciliation}
            />
          )}
          {tab === "EXPENSES" && (
            <ExpensesScreen
              expenses={expenses}
              onSave={saveExpense}
              onDelete={deleteExpense}
              onScanReceipt={() => {
              setScannerHint("")
              setScannerOpen(true)
            }}
            />
          )}
          {tab === "FINANCE" && (
            <FinanceScreen
              trips={trips}
              expenses={expenses}
              onSave={saveExpense}
              onOpenScanner={(t) => {
                setScannerHint(((t === "factura" ? "factura" : t === "recibo" ? "recibo" : "") as ExpenseDocType | ""))
                setScannerOpen(true)
              }}
            />
          )}
          {tab === "AI" && (
            <AIScreen
              trips={trips}
              expenses={expenses}
              onApplyBankMatches={applyBankMatches}
              onApplyExpenseUpdates={applyExpenseUpdates}
              onApplySchedules={applySchedules}
            />
          )}
          {tab === "DATA" && (
            <DataScreen
              trips={trips}
              info={info}
              saveError={saveError}
              syncCode={syncCode}
              syncMessage={syncMessage}
              syncTone={syncTone}
              syncing={syncing}
              onRefreshInfo={refreshInfo}
              onExport={exportJson}
              onExportFull={exportFullBackup}
              onImport={importJson}
              onLoadDemo={loadDemo}
              onResetAll={resetAll}
              onResetCache={resetCache}
              onConnectSync={connectSync}
              onSyncNow={() => syncCode && runSync(syncCode)}
              onDisconnectSync={disconnectSync}
            />
          )}
          {tab === "DASH" && <DashScreen trips={trips} expenses={expenses} shift={shift} />}
          {tab === "V1DASH" && (
            <V1DashScreen trips={trips} expenses={expenses} shift={shift} onGoData={() => setTab("DATA")} />
          )}
          {tab === "REPORTS" && <ReportsScreen trips={trips} expenses={expenses} />}
          {tab === "SOBRES" && <SobresScreen />}
          {tab === "TOLLAUDIT" && <TollAuditScreen trips={trips} />}
          {tab === "HELP" && <HowItWorksScreen />}
          {tab !== "ENTRY" &&
            tab !== "REGISTER" &&
            tab !== "EXPENSES" &&
            tab !== "FINANCE" &&
            tab !== "REPORTS" &&
            tab !== "AI" &&
            tab !== "DATA" &&
            tab !== "DASH" &&
            tab !== "V1DASH" &&
            tab !== "HELP" && <Placeholder label={tab} />}
        </div>
      </main>

      {editing && (
        <TripEditSheet trip={editing} onSave={saveEdit} onDelete={deleteTrip} onClose={() => setEditing(null)} />
      )}

      {scannerOpen && (
        <ReceiptScanner
          initialDocTipo={scannerHint}
          onClose={() => setScannerOpen(false)}
          onSaveExpense={(e) => {
            saveExpense(e)
            // ¿Este recibo escaneado es pago de una factura abierta? Se ofrece
            // una sola vez; si Miguel acepta, el pago se amarra a la factura.
            if (e.docType === "recibo") {
              const hit = offerReceiptBillMatch(expensesRef.current, {
                vendor: e.vendor,
                amount: e.amount,
                date: e.date,
                accountId: e.accountId,
                id: e.id,
              })
              if (hit) {
                const withPay = addBillPayment(hit.bill, hit.payment)
                saveExpense(withPay)
                syncBillToProjections(withPay)
                learnConfirm(ruleKeyFor(e.vendor), hit.bill, e.accountId)
              }
            }
          }}
          onSaveIncome={saveScannedIncome}
          totales={escanerTotales}
        />
      )}

      {mas && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70 backdrop-blur-sm" onClick={() => setMas(false)}>
          <div
            className="max-h-[78vh] overflow-y-auto rounded-t-3xl border border-neutral-800 bg-neutral-950 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-700" />
            <div className="px-4 pb-1">
              <p className="text-[15px] font-extrabold text-white">More</p>
              <p className="text-[11px] text-neutral-500">Tools, data and system guide</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 px-4">
              <button
                type="button"
                onClick={() => {
                  setTab("REPORTS")
                  setMas(false)
                }}
                className="flex flex-col items-start gap-1 rounded-2xl border border-yellow-500/30 bg-yellow-400/10 px-3 py-3 text-left active:scale-[0.98]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-yellow-400">PDF</span>
                <span className="text-[13px] font-extrabold text-white">Statement</span>
                <span className="text-[10px] leading-snug text-neutral-400">Financial report · Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("HELP")
                  setMas(false)
                }}
                className="flex flex-col items-start gap-1 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-left active:scale-[0.98]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Guide</span>
                <span className="text-[13px] font-extrabold text-white">How it works</span>
                <span className="text-[10px] leading-snug text-neutral-400">Dual register · Reconcile · Bill/Receipt</span>
              </button>
            </div>
            <div className="mt-4 space-y-4 px-4">
              {(
                [
                  { title: "Operations", keys: ["EXPENSES", "DASH", "V1DASH", "SOBRES", "TOLLAUDIT"] as const },
                  { title: "Inteligencia y datos", keys: ["AI", "DATA"] as const },
                  { title: "Ayuda", keys: ["HELP"] as const },
                ] as const
              ).map((group) => {
                const items = TABS_EN_MAS.filter((t) => (group.keys as readonly string[]).includes(t.key))
                if (items.length === 0) return null
                return (
                  <div key={group.title}>
                    <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{group.title}</p>
                    <div className="flex flex-col gap-1.5">
                      {items.map(({ key, label, hint, icon: Icon }) => {
                        const isActive = tab === key
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setTab(key)
                              setMas(false)
                            }}
                            className={
                              "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors " +
                              (isActive ? "border-yellow-500/40 bg-yellow-400/10" : "border-neutral-800 bg-neutral-900/60")
                            }
                          >
                            <span
                              className={
                                "flex size-10 shrink-0 items-center justify-center rounded-xl " +
                                (isActive ? "bg-yellow-400/20 text-yellow-400" : "bg-neutral-800 text-neutral-300")
                              }
                            >
                              <Icon className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-white">{label}</span>
                              <span className="block text-[11px] leading-snug text-neutral-500">{hint}</span>
                            </span>
                            {isActive && (
                              <span className="shrink-0 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[9px] font-bold text-yellow-400">HERE</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 px-4">
              <button type="button" onClick={() => setMas(false)} className="w-full rounded-2xl border border-neutral-700 py-3 text-xs font-bold text-neutral-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active={tab} onChange={setTab} onOpenMore={() => setMas(true)} />
    </div>
  )
}
