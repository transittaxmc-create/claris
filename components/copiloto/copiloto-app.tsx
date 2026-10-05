"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check } from "lucide-react"
import { BottomNav, TABS_EN_MAS, type Tab } from "./bottom-nav"
import { AIScreen } from "./ai-screen"
import { DataScreen } from "./data-screen"
import { DashScreen } from "./dash-screen"
import { EntryScreen } from "./entry-screen"
import { ExpensesScreen } from "./expenses-screen"
import { FinanceScreen } from "./finance-screen"
import { RegisterScreen } from "./register-screen"
import { ReportsScreen } from "./reports-screen"
import { TripEditSheet } from "./trip-edit-sheet"
import { ReceiptScanner } from "./receipt-scanner"
import { guardarMovimiento, movimientoDeGasto } from "./cash-flow-store"
import { applyDifferenceToTrip, applyBankMatchesToTrips, normalizeTripStatus } from "./reconciliation"
import { SEED_TRIPS, newTrip, stampExpense, applyExpenseUpdatesToExpenses, grossOf, netOf, tripDateOf, type Expense, type Trip, type ScheduledEntry } from "./types"
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
  isValidSyncCode,
  mergeTrips,
  MIN_SYNC_CODE_LENGTH,
  syncWithCloud,
  type Tombstones,
} from "@/lib/sync"
import { localDateKey } from "@/lib/dates"

// Alias de producción: contra este se comprueba si el teléfono está abriendo una
// copia vieja (una URL de preview que quedó viva).
const PRODUCCION_URL = "https://claris-lime.vercel.app"

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-bold text-white">{label}</p>
      <p className="text-sm text-neutral-500">Esta sección aún no está en el rediseño.</p>
    </div>
  )
}

export function CopilotoApp() {
  const [tab, setTab] = useState<Tab>("ENTRY")
  // Se empieza vacío y se carga lo guardado: antes se arrancaba con viajes de
  // ejemplo en memoria, y eso es lo que hacía que al cerrar "volvieran los
  // viajes viejos" y se perdieran los nuevos.
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
  // El escáner de recibos: pantalla completa, encima de todo.
  const [scannerOpen, setScannerOpen] = useState(false)
  // Aviso de "copia vieja": si este teléfono abrió una URL de preview antigua,
  // se compara su versión con la de producción y se ofrece el enlace bueno.
  const [mas, setMas] = useState(false)
  const [copiaVieja, setCopiaVieja] = useState<string | null>(null)
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

  // Comprobación de copia vieja: se pregunta a producción por su commit y se
  // compara con el de esta página. Se pide dos veces (ahora y a los 8 s) para no
  // avisar por un despliegue a medias.
  useEffect(() => {
    const propio = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    if (!propio) return
    let vivo = true
    let desajustes = 0
    async function revisar() {
      try {
        const res = await fetch(`${PRODUCCION_URL}/api/version`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { sha?: string; short?: string }
        if (!vivo || !data.sha) return
        if (data.sha !== propio) {
          desajustes += 1
          if (desajustes >= 2) setCopiaVieja(data.short ?? data.sha.slice(0, 7))
        } else {
          desajustes = 0
          setCopiaVieja(null)
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

  // Guardado: escribe siempre en las DOS copias (localStorage + IndexedDB) y
  // avisa si alguna falla, en vez de perder datos en silencio.
  const persist = useCallback((list: Trip[], expenseList: Expense[] = expensesRef.current) => {
    const res = saveTrips(list)
    const resExp = saveExpenses(expenseList)
    const error = !res.ok ? res.error : !resExp.ok ? resExp.error : undefined
    if (error) {
      setSaveState("error")
      setSaveError(error ?? "No se pudo guardar")
      return
    }
    setSaveState("saved")
    setSaveError(null)
    if (savedTimer.current) window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 2000)
    saveTripsToIndexedDB(list).catch(() => {})
    saveExpensesToIndexedDB(expenseList).catch(() => {})
  }, [])

  // Al abrir: localStorage + IndexedDB + borrados pendientes, combinados.
  // IndexedDB se usaba antes sólo para escribir y nunca se leía: de ahí que los
  // viajes nuevos no volvieran a aparecer al reabrir la app.
  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const local = loadTrips() ?? []
      // Migración: los viajes guardados por la versión anterior no tienen hora
      // de modificación. Se sellan ahora para que no los pise una copia más
      // vieja que quedó en IndexedDB (y para poder combinarlos entre teléfonos).
      const at = new Date().toISOString()
      const withStamps = local.some((t) => !t.raw?.savedAt)
        ? local.map((t) => (t.raw?.savedAt ? t : stampTrip(t, at)))
        : local

      let permanent: Trip[] = []
      try {
        permanent = await loadTripsFromIndexedDB()
      } catch {}
      const merged = mergeTrips(withStamps, permanent, loadTombstones())

      // Gastos: mismo procedimiento (localStorage + IndexedDB + borrados).
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

  // Guardado con un retardo muy corto en cada cambio (viajes o gastos).
  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => persist(trips, expenses), 250)
    return () => window.clearTimeout(timer)
  }, [trips, expenses, hydrated, persist])

  // Volcado inmediato al cerrar o esconder la app: garantiza que lo último
  // registrado quede en disco antes de que el teléfono mate la pestaña.
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

  // Cada cambio se sella con su hora para poder combinarlo entre teléfonos.
  function saveNewFromEntry(t: Trip) {
    const stamped = stampTrip(normalizeTripStatus(t))
    setTrips((prev) => [stamped, ...prev])
    setTab("REGISTER")
  }

  function saveEdit(t: Trip) {
    // normalizeTripStatus deja el status en sintonía con los montos de
    // reconciliación: sin esto el disco guardaba "matched" pero la memoria
    // seguía en "pending" y el filtro MATCHED no mostraba nada.
    const stamped = stampTrip(normalizeTripStatus(t))
    setTrips((prev) => {
      const exists = prev.some((p) => p.id === stamped.id)
      return exists ? prev.map((p) => (p.id === stamped.id ? stamped : p)) : [stamped, ...prev]
    })
    setEditing(null)
  }

  // Arregla el descuadre de un viaje ajustando sus earnings para que el neto
  // calculado cuadre con lo que la plataforma pagó de verdad.
  function applyReconciliation(t: Trip) {
    const fixed = normalizeTripStatus(applyDifferenceToTrip(t))
    if (fixed === t) return
    setTrips((prev) => prev.map((p) => (p.id === fixed.id ? stampTrip(fixed) : p)))
  }

  // Conciliación bancaria: la IA devolvió matches {tripId, amount}. Se marcan
  // los viajes con lo que el banco pagó y se normaliza su estado. Devuelve
  // cuántos viajes se actualizaron para la nota del chat.
  function applyBankMatches(matches: { tripId: string; amount: number }[]): number {
    const result = applyBankMatchesToTrips(tripsRef.current, matches)
    if (result.applied === 0) return 0
    tripsRef.current = result.trips
    setTrips(result.trips.map((t) => stampTrip(t)))
    return result.applied
  }

  // Análisis de gastos de la IA: aplica las correcciones de categoría y de
  // clasificación business/personal. Devuelve cuántos gastos se corrigieron.
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
    const valid = entries.filter((entry) => entry && entry.description && Number(entry.amount) > 0)
      .map((entry) => ({ ...entry, id: crypto.randomUUID(), amount: Number(entry.amount), active: true }))
    if (valid.length === 0) return 0
    try {
      const current = JSON.parse(localStorage.getItem("claris_scheduled_entries") || "[]")
      localStorage.setItem("claris_scheduled_entries", JSON.stringify([...valid, ...(Array.isArray(current) ? current : [])]))
    } catch {
      return 0
    }
    setTab("FINANCE")
    return valid.length
  }

  function deleteTrip(id: string) {
    // El borrado queda anotado para que no "reviva" al sincronizar.
    tombstonesRef.current = addTombstone(id)
    setTrips((prev) => prev.filter((p) => p.id !== id))
    setEditing(null)
  }

  // Gastos: alta / edición (siempre con hora de modificación para el sync).
  //
  // Todo gasto entra TAMBIÉN en el libro mayor. Es el embudo por donde pasan
  // todos (manual, escaneado, importado), así que ninguno se queda fuera de la
  // unión. El id es determinista ("claris:gasto:<id>"), así que editar el gasto
  // actualiza su movimiento en vez de crear otro.
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

  // Ingreso escaneado (un recibo de cobro, un comprobante): va al ledger
  // programado con kind "income", que es lo que ya lee FINANCE. No hay una
  // lista de ingresos sueltos aparte de los viajes, así que se usa esa.
  function saveScannedIncome(e: { description: string; category: string; amount: number; date: string; notes?: string }) {
    const entry: ScheduledEntry = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sch-${Date.now()}`,
      kind: "income",
      description: e.description || "Ingreso",
      category: e.category,
      amount: Number(e.amount) || 0,
      startDate: e.date,
      nextDate: e.date,
      frequency: "once",
      active: true,
    }
    try {
      const prev: ScheduledEntry[] = JSON.parse(localStorage.getItem("claris_scheduled_entries") || "[]")
      localStorage.setItem("claris_scheduled_entries", JSON.stringify([entry, ...(Array.isArray(prev) ? prev : [])]))
    } catch {
      try {
        localStorage.setItem("claris_scheduled_entries", JSON.stringify([entry]))
      } catch {}
    }
  }

  // Totales del mes en curso, para la cabecera del escáner.
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

  // Sincronización: baja, combina con lo local y sube el resultado.
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
      )
      if (result.ok && Array.isArray(result.trips)) {
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
        setSyncMessage(`Sincronizado · ${next.length} viajes y ${nextExp.length} gastos`)
      } else if (result.reason === "not_configured") {
        setSyncTone("info")
        setSyncMessage(
          "Falta activar la base de datos de sync en Vercel (Storage → KV). Mientras tanto puedes usar EXPORTAR/IMPORTAR JSON.",
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

  // Al abrir, si ya hay un código guardado, se sincroniza sola.
  useEffect(() => {
    if (!hydrated || !syncCode || autoSynced.current) return
    autoSynced.current = true
    runSync(syncCode, true)
  }, [hydrated, syncCode, runSync])

  function exportJson() {
    // Asegura que el JSON refleje lo que hay en memoria (el guardado es
    // asíncrono con retardo y el export es síncrono).
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
        // Se conserva la hora original de cada viaje para no pisar cambios
        // más nuevos que vengan de otro teléfono.
        const next = result.map((t) => (t.raw?.savedAt ? t : stampTrip(t)))
        tripsRef.current = next
        setTrips(next)
        // Los gastos viajan en la misma clave del export: se releen desde disco.
        const exp = loadExpenses() ?? []
        expensesRef.current = exp
        setExpenses(exp)
        setTab("REGISTER")
      } else {
        alert("No se pudo leer el archivo. Verifica que sea un export válido de IslandCity Tip Tracker.")
      }
    }
    reader.readAsText(file)
  }

  // Los viajes de ejemplo ya no se cargan solos al abrir (era la causa de que
  // aparecieran "transacciones viejas"); se cargan sólo si los pides aquí.
  function loadDemo() {
    const at = new Date().toISOString()
    const demo = SEED_TRIPS.map((t) => stampTrip(t, at))
    tripsRef.current = demo
    setTrips(demo)
    setTab("REGISTER")
  }

  // RESET TOTAL: borra todo de este teléfono y, si hay sync, también en el
  // servidor, dejando los borrados anotados para que no revivan en el otro.
  async function resetAll() {
    const at = new Date().toISOString()
    const tombstones = { ...tombstonesRef.current }
    for (const t of tripsRef.current) tombstones[t.id] = at
    tombstonesRef.current = tombstones
    saveTombstones(tombstones)

    const expenseTombstones = { ...expenseTombstonesRef.current }
    for (const e of expensesRef.current) expenseTombstones[e.id] = at
    expenseTombstonesRef.current = expenseTombstones
    saveExpenseTombstones(expenseTombstones)

    tripsRef.current = []
    setTrips([])
    expensesRef.current = []
    setExpenses([])
    setEditing(null)
    setSyncMessage(null)

    const res = await clearAllData()
    if (!res.ok) {
      setSaveError(res.error ?? "No se pudo borrar todo el almacenamiento")
      setSaveState("error")
    }
    persist([], [])
    refreshInfo()
    if (syncCode) await runSync(syncCode, true)
  }

  // Botón RESET de la pantalla REGISTER: usa el mismo reset completo que DATA
  // (borra también IndexedDB y anota los borrados para que no revivan).
  function resetStorage() {
    const ok = window.confirm(
      "¿Borrar todas las transacciones y el almacenamiento local? Esta acción no se puede deshacer.",
    )
    if (ok) void resetAll()
  }

  function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Copia de seguridad TOTAL: todos los datos (JSON crudo de cada clave) más un
  // índice HTML legible, para no tener que empezar nunca desde cero.
  function exportFullBackup() {
    persist(tripsRef.current, expensesRef.current)
    const stamp = localDateKey(new Date())
    const keys = collectAppKeys(localStorage)
    const input = {
      date: stamp,
      trips: tripsRef.current.map((t) => ({
        date: tripDateOf(t),
        platform: t.platform,
        gross: grossOf(t),
        net: netOf(t),
      })),
      expenses: expensesRef.current.map((e) => ({
        date: e.date,
        vendor: e.vendor,
        category: e.category,
        amount: e.amount,
        classification: e.classification,
      })),
      keys,
    }
    downloadFile(`claris-backup-total-${stamp}.json`, buildBackupBundle(input), "application/json")
    downloadFile(`claris-indice-${stamp}.html`, buildBackupHtml(input), "text/html;charset=utf-8")
  }

  // Reset SOLO de caché y pantallas: borra el historial del chat, las claves
  // temporales de GPS y la semana de finanzas (se recalcula sola). CONSERVA
  // viajes, gastos, ledger programado, categorías y código de sincronización.
  function resetCacheOnly() {
    try {
      localStorage.removeItem("claris_ai_history")
      localStorage.removeItem("CURRENT_PICKUP")
      localStorage.removeItem("CURRENT_DROP_OFF")
      localStorage.removeItem("claris_finance_week_v1")
    } catch {}
    window.location.reload()
  }

  function connectSync(code: string) {
    const clean = code.trim().toLowerCase()
    if (!isValidSyncCode(clean)) {
      setSyncTone("error")
      setSyncMessage(`El código necesita al menos ${MIN_SYNC_CODE_LENGTH} caracteres`)
      return
    }
    setSyncCode(clean)
    saveSyncCode(clean)
    runSync(clean)
  }

  function disconnectSync() {
    setSyncCode(null)
    saveSyncCode(null)
    setSyncTone("info")
    setSyncMessage("Sync desconectado en este teléfono. Tus viajes siguen guardados aquí.")
  }

  return (
    <div className="fixed inset-0 flex h-[100dvh] min-h-0 w-full justify-center overflow-hidden bg-neutral-950 pt-[env(safe-area-inset-top)]">
      <div className="relative flex h-full min-h-0 w-full max-w-[920px] flex-col overflow-hidden bg-black text-white">
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {!hydrated ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">Cargando tus viajes…</div>
          ) : (
            <>
              {tab === "ENTRY" && <EntryScreen onSave={saveNewFromEntry} trips={trips} />}
              {tab === "REGISTER" && (
                <RegisterScreen
                  trips={trips}
                  onEdit={(t) => setEditing(t)}
                  onAdd={() => setEditing(newTrip())}
                  onCloseDay={() => setDayClosed(true)}
                  dayClosed={dayClosed}
                  onExport={exportJson}
                  onImport={importJson}
                  onResetStorage={resetStorage}
                  onApplyReconciliation={applyReconciliation}
                />
              )}
              {tab === "EXPENSES" && (
                <ExpensesScreen
                  expenses={expenses}
                  onSave={saveExpense}
                  onDelete={deleteExpense}
                  onScanReceipt={() => setScannerOpen(true)}
                />
              )}
              {tab === "FINANCE" && (
                <FinanceScreen trips={trips} expenses={expenses} onSave={saveExpense} onDelete={deleteExpense} />
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
                  onResetCache={resetCacheOnly}
                  onConnectSync={connectSync}
                  onSyncNow={() => syncCode && runSync(syncCode)}
                  onDisconnectSync={disconnectSync}
                />
              )}
              {tab === "DASH" && (
                <DashScreen trips={trips} expenses={expenses} />
              )}
              {tab === "REPORTS" && <ReportsScreen trips={trips} expenses={expenses} />}
              {tab !== "ENTRY" &&
                tab !== "REGISTER" &&
                tab !== "EXPENSES" &&
                tab !== "FINANCE" &&
                tab !== "REPORTS" &&
                tab !== "AI" &&
                tab !== "DATA" &&
                tab !== "DASH" && <Placeholder label={tab} />}
            </>
          )}
        </main>

        {/* Copia vieja: este teléfono abrió una URL de preview antigua. Se avisa
            arriba, con el enlace a la versión buena, y se puede cerrar. */}
        {copiaVieja && !avisoCerrado && (
          <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 w-[94%] max-w-[520px] -translate-x-1/2 rounded-2xl border border-amber-500/50 bg-amber-950/95 px-3 py-2.5 shadow-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-amber-200">
                  Estás viendo una copia vieja de la app
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-amber-100/80">
                  Esta dirección quedó apuntando a una versión anterior. La última es {copiaVieja}.
                </p>
                <a
                  href={`${PRODUCCION_URL}/?v=${copiaVieja}`}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-black"
                >
                  ABRIR LA VERSIÓN NUEVA
                </a>
              </div>
              <button
                type="button"
                onClick={() => setAvisoCerrado(true)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-lg border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Aviso de guardado: si el teléfono no deja guardar, se ve en pantalla */}
        {saveError ? (
          <div className="pointer-events-none absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 max-w-[92%] -translate-x-1/2 rounded-xl border border-rose-500/50 bg-rose-950/90 px-3 py-2 text-center text-[11px] font-bold text-rose-200 shadow-lg">
            <span className="flex items-center justify-center gap-1.5">
              <AlertTriangle className="size-3.5" /> NO SE PUDO GUARDAR · {saveError}
            </span>
          </div>
        ) : saveState === "saved" ? (
          <div className="pointer-events-none absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full border border-green-500/40 bg-black/90 px-3 py-1.5 text-[10px] font-bold text-green-400 shadow-lg">
            <span className="flex items-center gap-1.5">
              <Check className="size-3" /> GUARDADO EN EL TELÉFONO
            </span>
          </div>
        ) : null}

        <BottomNav active={tab} onChange={setTab} onOpenMore={() => setMas(true)} />
      </div>

      {/* MÁS: las cuatro secciones que no caben abajo, con nombre completo. */}
      {mas && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => setMas(false)}
          role="presentation"
        >
          <div
            className="w-full rounded-t-3xl border-t border-neutral-800 bg-neutral-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-bold text-white">Más secciones</p>
              <button
                type="button"
                onClick={() => setMas(false)}
                aria-label="Cerrar"
                className="flex size-11 items-center justify-center rounded-xl border border-neutral-800 text-neutral-300"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col">
              {TABS_EN_MAS.map(({ key, label, hint, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key)
                    setMas(false)
                  }}
                  className="flex min-h-[56px] items-center gap-3 border-t border-white/5 px-1 text-left first:border-t-0"
                >
                  <Icon className="size-5 shrink-0 text-yellow-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-white">{label}</span>
                    <span className="block text-[13px] text-neutral-400">{hint}</span>
                  </span>
                  <span className="text-neutral-500">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <TripEditSheet
        trip={editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onDelete={deleteTrip}
      />

      {scannerOpen && (
        <ReceiptScanner
          onClose={() => setScannerOpen(false)}
          onSaveExpense={saveExpense}
          onSaveIncome={saveScannedIncome}
          totales={escanerTotales}
        />
      )}
    </div>
  )
}
