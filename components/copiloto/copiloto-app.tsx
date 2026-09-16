"use client"

import { useState } from "react"
import { BottomNav, type Tab } from "./bottom-nav"
import { EntryScreen } from "./entry-screen"
import { RegisterScreen } from "./register-screen"
import { TripEditSheet } from "./trip-edit-sheet"
import { SEED_TRIPS, newTrip, type Trip } from "./types"

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

  return (
    <div className="flex min-h-screen justify-center bg-neutral-950">
      <div className="flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-black text-white">
        <main className="min-h-0 flex-1">
          {tab === "ENTRY" && <EntryScreen onSave={saveNewFromEntry} />}
          {tab === "REGISTER" && (
            <RegisterScreen
              trips={trips}
              onEdit={(t) => setEditing(t)}
              onAdd={() => setEditing(newTrip())}
              onCloseDay={() => setDayClosed(true)}
              dayClosed={dayClosed}
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
