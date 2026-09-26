"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check } from "lucide-react"
import { BottomNav, type Tab } from "./bottom-nav"
import { AIScreen } from "./ai-screen"
import { DataScreen } from "./data-screen"
import { EntryScreen } from "./entry-screen"
import { ExpensesScreen } from "./expenses-screen"
import { FinanceScreen } from "./finance-screen"
import { RegisterScreen } from "./register-screen"
import { TripEditSheet } from "./trip-edit-sheet"
import { SEED_TRIPS, newTrip, stampExpense, type Expense, type Trip } from "./types"
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
    const stamped = stampTrip(t)
    setTrips((prev) => [stamped, ...prev])
    setTab("REGISTER")
  }

  function saveEdit(t: Trip) {
    const stamped = stampTrip(t)
    setTrips((prev) => {
      const exists = prev.some((p) => p.id === stamped.id)
      return exists ? prev.map((p) => (p.id === stamped.id ? stamped : p)) : [stamped, ...prev]
    })
    setEditing(null)
  }

  function deleteTrip(id: string) {
    // El borrado queda anotado para que no "reviva" al sincronizar.
    tombstonesRef.current = addTombstone(id)
    setTrips((prev) => prev.filter((p) => p.id !== id))
    setEditing(null)
  }

  // Gastos: alta / edición (siempre con hora de modificación para el sync).
  function saveExpense(e: Expense) {
    const stamped = stampExpense(e)
    setExpenses((prev) => {
      const exists = prev.some((p) => p.id === stamped.id)
      return exists ? prev.map((p) => (p.id === stamped.id ? stamped : p)) : [stamped, ...prev]
    })
  }

  function deleteExpense(id: string) {
    expenseTombstonesRef.current = addExpenseTombstone(id)
    setExpenses((prev) => prev.filter((p) => p.id !== id))
  }

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
    const stamp = new Date().toISOString().slice(0, 10)
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
              {tab === "ENTRY" && <EntryScreen onSave={saveNewFromEntry} />}
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
                />
              )}
              {tab === "EXPENSES" && (
                <ExpensesScreen expenses={expenses} onSave={saveExpense} onDelete={deleteExpense} />
              )}
              {tab === "FINANCE" && (
                <FinanceScreen expenses={expenses} onSave={saveExpense} onDelete={deleteExpense} />
              )}
              {tab === "AI" && <AIScreen trips={trips} expenses={expenses} />}
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
                  onImport={importJson}
                  onLoadDemo={loadDemo}
                  onResetAll={resetAll}
                  onConnectSync={connectSync}
                  onSyncNow={() => syncCode && runSync(syncCode)}
                  onDisconnectSync={disconnectSync}
                />
              )}
              {tab !== "ENTRY" &&
                tab !== "REGISTER" &&
                tab !== "EXPENSES" &&
                tab !== "AI" &&
                tab !== "DATA" &&
                tab !== "FINANCE" && <Placeholder label={tab} />}
            </>
          )}
        </main>

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

        <BottomNav active={tab} onChange={setTab} />
      </div>

      <TripEditSheet
        trip={editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onDelete={deleteTrip}
      />
    </div>
  )
}
