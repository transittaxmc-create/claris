"use client"

import { useEffect, useState } from "react"
import { BottomNav, type Tab } from "./bottom-nav"
import { EntryScreen } from "./entry-screen"
import { RegisterScreen } from "./register-screen"
import { TripEditSheet } from "./trip-edit-sheet"
import { SEED_TRIPS, newTrip, type Trip } from "./types"
import { loadTrips, saveTrips, buildExport, importExport } from "./storage"

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
  const [trips, setTrips] = useState<Trip[]>(SEED_TRIPS)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [dayClosed, setDayClosed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load real data from the existing ic_tip_tracker localStorage key on mount.
  useEffect(() => {
    const loaded = loadTrips()
    if (loaded && loaded.length) setTrips(loaded)
    setHydrated(true)
  }, [])

  // Persist back to ic_tip_tracker in the exact export format after any change.
  useEffect(() => {
    if (hydrated) saveTrips(trips)
  }, [trips, hydrated])

  function saveNewFromEntry(t: Trip) {
    setTrips((prev) => [t, ...prev])
    setTab("REGISTER")
  }

  function saveEdit(t: Trip) {
    setTrips((prev) => {
      const exists = prev.some((p) => p.id === t.id)
      return exists ? prev.map((p) => (p.id === t.id ? t : p)) : [t, ...prev]
    })
    setEditing(null)
  }

  function deleteTrip(id: string) {
    setTrips((prev) => prev.filter((p) => p.id !== id))
    setEditing(null)
  }

  function exportJson() {
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
        setTrips(result)
        setTab("REGISTER")
      } else {
        alert("No se pudo leer el archivo. Verifica que sea un export válido de IslandCity Tip Tracker.")
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex min-h-[100dvh] justify-center overflow-hidden bg-neutral-950">
      <div className="flex h-[100dvh] w-full max-w-[920px] flex-col overflow-hidden bg-black text-white">
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
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
            />
          )}
          {tab !== "ENTRY" && tab !== "REGISTER" && <Placeholder label={tab} />}
        </main>

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
