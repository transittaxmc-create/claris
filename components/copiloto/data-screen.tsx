"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Cloud, CloudOff, Database, Download, Eraser, RefreshCw, Save, Target, Upload } from "lucide-react"
import { V1_DAILY_GOAL_KEY } from "./v1-dash/v1-dash-screen"
import { cn } from "@/lib/utils"
import type { StorageInfo } from "./storage"
import { MIN_SYNC_CODE_LENGTH } from "@/lib/sync"
import { compareVersion, type VersionStatus } from "@/lib/version-check"
import type { Trip } from "./types"
import { FINANCE_LEDGER_KEY, FINANCE_SCHEDULES_KEY, FINANCE_SYNCED_EVENT } from "./finance-sync"
import { SCHEDULES_CLEAR_FLAG_KEY } from "./finance-cloud"
import { SCHEDULE_OVERRIDES_KEY } from "./dinero-forecast"
import {
  applyFullBackup,
  backupCounts,
  buildFullBackup,
  downloadFullBackup,
  parseFullBackup,
  type BackupCounts,
  type FullBackup,
} from "./backup"
import { AccountsPanel } from "./accounts-panel"

function Row({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-neutral-400">{label}</span>
      <span className={cn("truncate font-mono text-[11px]", tone)}>{value}</span>
    </div>
  )
}

function fmtBytes(bytes: number): string {
  if (!bytes) return "0 KB"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtTime(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function DataScreen({
  trips,
  info,
  saveError,
  syncCode,
  syncMessage,
  syncTone,
  syncing,
  onRefreshInfo,
  onExport,
  onExportFull,
  onImport,
  onLoadDemo,
  onResetAll,
  onResetCache,
  onConnectSync,
  onSyncNow,
  onDisconnectSync,
  onOpenAccountRegister,
}: {
  trips: Trip[]
  info: StorageInfo | null
  saveError: string | null
  syncCode: string | null
  syncMessage: string | null
  syncTone: "ok" | "error" | "info"
  syncing: boolean
  onRefreshInfo: () => void
  onExport: () => void
  // Descarga TODOS los datos (JSON crudo de cada archivo) + índice HTML legible.
  onExportFull: () => void
  onImport: (file: File) => void
  onLoadDemo: () => void
  onResetAll: () => void
  // Limpia solo caché y pantallas, conservando los datos.
  onResetCache: () => void
  onConnectSync: (code: string) => void
  onSyncNow: () => void
  onDisconnectSync: () => void
  /** Abrir el register de una cuenta desde DATA → ACCOUNTS. */
  onOpenAccountRegister?: (id: string) => void
}) {
  const [codeDraft, setCodeDraft] = useState("")
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmProj, setConfirmProj] = useState(false)
  const [projCounts, setProjCounts] = useState<{ schedules: number; projected: number } | null>(null)

  // Borrado SOLO de proyección (2026-10-24, pedido de Miguel): fuera los
  // recurrentes y los proyectados aún no pagados — los datos que se ven en
  // Proyecciones — para empezar a entrar datos vivos. Se conserva: banco,
  // viajes, asientos reales (pagados) y los cobros reconciliados de
  // EARNINGS (ids claris:cobro:*).
  const contarProyeccion = () => {
    try {
      const sch = JSON.parse(localStorage.getItem(FINANCE_SCHEDULES_KEY) || "[]")
      const led = JSON.parse(localStorage.getItem(FINANCE_LEDGER_KEY) || "[]")
      const projected = (Array.isArray(led) ? led : []).filter(
        (e: any) => e && e.status === "projected" && !String(e.id).startsWith("claris:cobro:"),
      ).length
      setProjCounts({ schedules: Array.isArray(sch) ? sch.length : 0, projected })
    } catch {
      setProjCounts({ schedules: 0, projected: 0 })
    }
    setConfirmProj(true)
  }
  const borrarProyeccion = () => {
    try {
      const led = JSON.parse(localStorage.getItem(FINANCE_LEDGER_KEY) || "[]")
      const kept = (Array.isArray(led) ? led : []).filter(
        (e: any) => !(e && e.status === "projected" && !String(e.id).startsWith("claris:cobro:")),
      )
      localStorage.setItem(FINANCE_LEDGER_KEY, JSON.stringify(kept))
      // Marca de vaciado DELIBERADO (ver finance-cloud): sin ella, el
      // candado anti-vacío no dejaría propagar este borrado a propósito.
      localStorage.setItem(SCHEDULES_CLEAR_FLAG_KEY, String(Date.now()))
      localStorage.setItem(FINANCE_SCHEDULES_KEY, JSON.stringify([]))
      localStorage.setItem(SCHEDULE_OVERRIDES_KEY, JSON.stringify([]))
      window.dispatchEvent(new Event(FINANCE_SYNCED_EVENT))
    } catch {}
    setConfirmProj(false)
    onRefreshInfo()
  }
  const [confirmCache, setConfirmCache] = useState(false)
  // Versión que está sirviendo producción, para comparar con la de este teléfono.
  const [ultimaVersion, setUltimaVersion] = useState<string | null>(null)
  const [estadoVersion, setEstadoVersion] = useState<VersionStatus>("unknown")
  // Goal diaria del DASHBOARD (clon del tablero de v1). Default 45 como en v1.
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    try {
      const n = Number(localStorage.getItem(V1_DAILY_GOAL_KEY))
      if (Number.isFinite(n) && n > 0) return n
    } catch {}
    return 45
  })
  function saveDailyGoal(v: number) {
    setDailyGoal(v)
    try {
      localStorage.setItem(V1_DAILY_GOAL_KEY, String(v))
    } catch {}
  }

  useEffect(() => {
    let vivo = true
    fetch("https://claris-lime.vercel.app/api/version", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { sha?: string; short?: string; builtAt?: string | null } | null) => {
        if (!vivo || !data?.short) return
        setUltimaVersion(data.short)
        setEstadoVersion(
          compareVersion(
            { sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, builtAt: process.env.NEXT_PUBLIC_BUILD_TIME },
            { sha: data.sha, builtAt: data.builtAt },
          ),
        )
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // SUBIR / RESTAURAR (modelo local, Miguel 2026-11-13): los datos viven
  // SOLO en este teléfono. SUBIR descarga el respaldo completo (archivo
  // JSON) para guardarlo en la carpeta de Google Drive; RESTAURAR toma
  // ese archivo en el otro teléfono y lo deja igual que el primero.
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [pendingRestore, setPendingRestore] = useState<{ doc: FullBackup; counts: BackupCounts } | null>(null)
  const [backupNote, setBackupNote] = useState<string | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  // Google Drive estado
  const [gdriveConnected, setGdriveConnected] = useState<boolean | null>(null)
  const [showDriveBackups, setShowDriveBackups] = useState(false)
  const [driveBackupList, setDriveBackupList] = useState<{ id: string; name: string; createdTime: string }[]>([])

  // Checar conexión Google Drive al abrir la pantalla
  useEffect(() => {
    fetch("/api/gdrive/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setGdriveConnected(d.connected))
      .catch(() => setGdriveConnected(false))
  }, [])

  // Detectar ?gdrive_ok=1 en la URL (regreso del OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("gdrive_ok") === "1") {
      setGdriveConnected(true)
      setBackupNote("✅ Google Drive conectado. Ahora puedes subir tu respaldo directamente.")
      // Limpiar el query param
      window.history.replaceState({}, "", window.location.pathname)
    }
    if (params.get("gdrive_error")) {
      setBackupNote(`⚠️ Error conectando Google Drive: ${params.get("gdrive_error")}`)
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const conectarDrive = () => {
    window.location.href = "/api/gdrive/auth?return=/"
  }

  const desconectarDrive = async () => {
    await fetch("/api/gdrive/disconnect", { method: "DELETE" })
    setGdriveConnected(false)
    setBackupNote("Google Drive desconectado.")
  }

  const subirRespaldo = async () => {
    setBackupBusy(true)
    setBackupNote(null)
    try {
      const doc = await buildFullBackup()
      const c = backupCounts(doc)
      const filename = backupFileName(doc)

      if (gdriveConnected) {
        // Subir directo a Google Drive
        setBackupNote("⬆️ Subiendo a Google Drive…")
        const res = await fetch("/api/gdrive/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, content: JSON.stringify(doc) }),
        })
        if (res.ok) {
          setBackupNote(
            `✅ Respaldo subido a Google Drive: ${c.entries} entradas · ${c.expenses} gastos · ${c.trips} viajes. Archivo: ${filename}`,
          )
        } else {
          // Fallback a descarga local si Drive falla
          downloadFullBackup(doc)
          setBackupNote("⚠️ No se pudo subir a Drive. Se descargó el archivo localmente.")
        }
      } else {
        // Sin Drive: descarga local
        downloadFullBackup(doc)
        setBackupNote(
          `Backup descargado: ${c.entries} entradas · ${c.expenses} gastos · ${c.trips} viajes. Guárdalo en tu Google Drive.`,
        )
      }
    } catch {
      setBackupNote("No se pudo crear el respaldo. Intenta de nuevo.")
    } finally {
      setBackupBusy(false)
    }
  }

  const restaurarDesdeDrive = async () => {
    setBackupBusy(true)
    setBackupNote("⬇️ Buscando respaldos en Google Drive…")
    try {
      const res = await fetch("/api/gdrive/restore?list=1", { cache: "no-store" })
      if (!res.ok) {
        setBackupNote("No se encontraron respaldos en Google Drive.")
        setBackupBusy(false)
        return
      }
      const data = (await res.json()) as { files?: { id: string; name: string; createdTime: string }[] }
      if (!data.files || data.files.length === 0) {
        setBackupNote("No hay respaldos en Google Drive todavía. Presiona SUBIR primero.")
        setBackupBusy(false)
        return
      }
      setDriveBackupList(data.files)
      setShowDriveBackups(true)
      setBackupNote(null)
    } catch {
      setBackupNote("Error al conectar con Google Drive.")
    } finally {
      setBackupBusy(false)
    }
  }

  const restaurarArchivosDrive = async (filename: string) => {
    setShowDriveBackups(false)
    setBackupBusy(true)
    setBackupNote(`⬇️ Descargando ${filename} de Google Drive…`)
    try {
      const res = await fetch(`/api/gdrive/restore?filename=${encodeURIComponent(filename)}`, { cache: "no-store" })
      if (!res.ok) {
        setBackupNote("No se pudo descargar el respaldo de Drive.")
        setBackupBusy(false)
        return
      }
      const data = (await res.json()) as { content?: string }
      if (!data.content) {
        setBackupNote("El respaldo en Drive está vacío o dañado.")
        setBackupBusy(false)
        return
      }
      const doc = parseFullBackup(data.content)
      if (!doc) {
        setBackupNote("El archivo en Drive no es un respaldo válido de Copiloto.")
        setBackupBusy(false)
        return
      }
      setBackupNote(null)
      setPendingRestore({ doc, counts: backupCounts(doc) })
    } catch {
      setBackupNote("Error al restaurar desde Drive.")
    } finally {
      setBackupBusy(false)
    }
  }

  const elegirRestaurar = async (file: File) => {
    try {
      const doc = parseFullBackup(await file.text())
      if (!doc) {
        setPendingRestore(null)
        setBackupNote("That file is not a valid Copiloto backup — nothing was changed.")
        return
      }
      setBackupNote(null)
      setPendingRestore({ doc, counts: backupCounts(doc) })
    } catch {
      setPendingRestore(null)
      setBackupNote("Couldn't read that file — nothing was changed.")
    }
  }

  const confirmarRestaurar = async () => {
    if (!pendingRestore) return
    setBackupBusy(true)
    try {
      await applyFullBackup(pendingRestore.doc)
      // Recargar: la app entera vuelve a leer desde el respaldo aplicado.
      window.location.reload()
    } catch {
      setBackupBusy(false)
      setBackupNote("Restore failed — the data on this phone was not replaced.")
    }
  }

  useEffect(() => {
    onRefreshInfo()
  }, [onRefreshInfo])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-sm font-bold tracking-widest text-neutral-400">DATA</h1>
        <button
          type="button"
          onClick={onRefreshInfo}
          className="flex items-center gap-1 rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] font-bold text-neutral-300 hover:text-white"
        >
          <RefreshCw className="size-3" /> ACTUALIZAR
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {saveError && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-rose-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
            <div className="text-[11px] leading-tight">
              <p className="font-bold text-rose-300">Couldn't save on the phone</p>
              <p className="mt-0.5 break-words">{saveError}</p>
            </div>
          </div>
        )}

        {/* Estado del almacenamiento */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Database className="size-4 text-yellow-400" />
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">SAVED ON THIS PHONE</h2>
          </div>
          <Row label="TRIPS IN MEMORY" value={String(trips.length)} />
          <Row label="EXPENSES IN MEMORY" value={String(info?.expenses ?? 0)} tone="text-rose-300" />
          <Row label="LAST RECORDING" value={fmtTime(info?.lastSavedAt ?? null)} />
          <Row
            label="LOCALSTORAGE"
            value={info ? (info.localStorageOk ? "OK" : "BLOQUEADO") : "…"}
            tone={info?.localStorageOk ? "text-green-400" : "text-rose-400"}
          />
          <Row
            label="INDEXEDDB (COPIA)"
            value={info ? (info.indexedDbOk ? `${info.indexedDbCount} records` : "NOT AVAILABLE") : "…"}
            tone={info?.indexedDbOk ? "text-green-400" : "text-rose-400"}
          />
          <Row label="SPACE USED" value={info ? `${fmtBytes(info.bytes)} · ${info.keys} keys` : "…"} />
          <Row label="PENDING DELETIONS" value={String(info?.tombstones ?? 0)} tone="text-neutral-400" />
          {/* Versión: sirve para saber si este teléfono abrió la última copia. */}
          <Row
            label="APP VERSION"
            value={
              process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
                ? `${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}${
                    estadoVersion === "older"
                      ? ` (newer: ${ultimaVersion})`
                      : estadoVersion === "newer"
                        ? ` · test (prod ${ultimaVersion})`
                        : " · per day"
                  }`
                : "local"
            }
            tone={
              estadoVersion === "older"
                ? "text-amber-300"
                : estadoVersion === "newer"
                  ? "text-cyan-300"
                  : "text-green-400"
            }
          />
          <p className="mt-2 text-[10px] leading-tight text-neutral-500">
            Each trip is saved in two places (localStorage + IndexedDB) and backed up. If the phone wipes
            el navegador, IndexedDB devuelve los trips al abrir la app.
          </p>
        </section>

        {/* Cuentas: switches de activa y ★ primaria (Miguel, 2026-11-13) */}
        <AccountsPanel onOpenAccount={onOpenAccountRegister} />

        {/* Metas del tablero */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Target className="size-4 text-yellow-400" />
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">BOARD GOALS</h2>
          </div>
          <p className="text-[10px] leading-tight text-neutral-500">
            Used by the DASHBOARD tab (the v1-cloned hourly board). The hourly goal is also adjusted with
            el deslizador del propio tablero.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="meta-diaria" className="text-[11px] font-bold text-neutral-300">
              Goal diaria $
            </label>
            <input
              id="meta-diaria"
              type="number"
              min={1}
              step={1}
              value={dailyGoal}
              onChange={(e) => {
                const v = Math.floor(Number(e.target.value))
                if (Number.isFinite(v) && v > 0) saveDailyGoal(v)
              }}
              className="w-24 rounded-lg border border-neutral-700 bg-black px-2 py-1 text-right text-sm font-bold text-yellow-300 outline-none focus:border-yellow-500"
            />
          </div>
        </section>

        {/* Copia de seguridad */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Save className="size-4 text-sky-400" />
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">BACKUP</h2>
          </div>

          {/* SUBIR / RESTAURAR — Google Drive directo (1 clic). */}
          <div className="mb-2 rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-wide text-emerald-300">PHONE TRANSFER · GOOGLE DRIVE</p>
              {/* Estado de conexión */}
              {gdriveConnected === true && (
                <button
                  type="button"
                  onClick={desconectarDrive}
                  className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-400 hover:text-rose-400"
                >
                  ✓ Drive · desconectar
                </button>
              )}
              {gdriveConnected === false && (
                <button
                  type="button"
                  onClick={conectarDrive}
                  className="rounded-full border border-sky-700 bg-sky-950/50 px-2 py-0.5 text-[10px] font-bold text-sky-300 hover:bg-sky-900/60"
                >
                  Conectar Drive →
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] leading-tight text-neutral-400">
              {gdriveConnected
                ? "Drive conectado. Presiona SUBIR para guardar directo en tu Drive — sin descargar nada. En el otro teléfono, RESTAURAR baja el último respaldo automático."
                : "Conecta Google Drive para subir y restaurar con 1 clic. Sin Drive, el botón descarga el archivo localmente."}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={subirRespaldo}
                disabled={backupBusy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 py-2.5 text-[11px] font-extrabold text-black disabled:opacity-60"
              >
                <Upload className="size-3.5" />
                {backupBusy ? "SUBIENDO…" : gdriveConnected ? "SUBIR A DRIVE" : "SUBIR RESPALDO"}
              </button>
              <button
                type="button"
                onClick={gdriveConnected ? restaurarDesdeDrive : () => restoreInputRef.current?.click()}
                disabled={backupBusy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-600/60 py-2.5 text-[11px] font-extrabold text-emerald-300 disabled:opacity-60"
              >
                <Download className="size-3.5" />
                {backupBusy ? "BUSCANDO…" : gdriveConnected ? "RESTAURAR DRIVE" : "RESTAURAR"}
              </button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void elegirRestaurar(file)
                  e.target.value = ""
                }}
              />
            </div>

            {/* Lista de respaldos en Drive para elegir */}
            {showDriveBackups && driveBackupList.length > 0 && (
              <div className="mt-2 rounded-xl border border-sky-800/60 bg-sky-950/20 p-2">
                <p className="mb-1.5 text-[10px] font-bold text-sky-300">RESPALDOS EN GOOGLE DRIVE</p>
                <div className="space-y-1">
                  {driveBackupList.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => void restaurarArchivosDrive(f.name)}
                      className="flex w-full items-center justify-between rounded-lg border border-sky-700/40 bg-sky-900/20 px-2.5 py-1.5 text-left hover:bg-sky-900/40"
                    >
                      <span className="text-[10px] font-bold text-sky-200">{f.name}</span>
                      <span className="text-[10px] text-neutral-400">{fmtTime(f.createdTime)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowDriveBackups(false)}
                  className="mt-2 w-full rounded-lg border border-neutral-700 py-1 text-[10px] font-bold text-neutral-400"
                >
                  CANCELAR
                </button>
              </div>
            )}

            {backupNote && (
              <p className="mt-2 text-[10px] font-semibold leading-tight text-neutral-300">{backupNote}</p>
            )}
            {pendingRestore && (
              <div className="mt-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2.5">
                <p className="text-[11px] font-bold text-amber-200">
                  Backup from {fmtTime(pendingRestore.doc.exportedAt)}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-neutral-300">
                  {pendingRestore.counts.entries} entradas · {pendingRestore.counts.expenses} gastos ·{" "}
                  {pendingRestore.counts.trips} viajes. Restaurar{" "}
                  <strong className="text-amber-200">REEMPLAZA todo en este teléfono</strong> con el respaldo.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmarRestaurar}
                    disabled={backupBusy}
                    className="flex-1 rounded-xl bg-amber-500 py-2.5 text-[11px] font-extrabold text-black disabled:opacity-60 active:scale-[0.99]"
                  >
                    {backupBusy ? "RESTAURANDO…" : "SÍ, RESTAURAR"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRestore(null)}
                    disabled={backupBusy}
                    className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-[11px] font-bold text-neutral-300"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExport}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 text-[11px] font-bold text-neutral-200 hover:border-neutral-500"
            >
              <Download className="size-3.5" /> EXPORTAR JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 text-[11px] font-bold text-neutral-200 hover:border-neutral-500"
            >
              <Upload className="size-3.5" /> IMPORTAR JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onImport(file)
                e.target.value = ""
              }}
            />
          </div>

          {/* Backup TOTAL: todos los archivos + índice HTML legible */}
          <button
            type="button"
            onClick={onExportFull}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/30 py-2.5 text-[11px] font-bold text-sky-300 hover:bg-sky-900/40"
          >
            <Download className="size-3.5" /> DOWNLOAD ALL (FULL BACKUP)
          </button>
          <p className="mt-1.5 text-[10px] leading-tight text-neutral-500">
            Descarga <strong className="text-neutral-300">all JSON files</strong> of the app
            (trips, expenses, finances, ledger, categories, settings) plus a{" "}
            <strong className="text-neutral-300">readable HTML index</strong> with totals and tables. With
            that you never have to start from scratch.
          </p>
          {trips.length === 0 && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="mt-2 w-full rounded-xl border border-neutral-800 py-2 text-[11px] font-bold text-neutral-400 hover:text-neutral-200"
            >
              LOAD SAMPLE TRIPS
            </button>
          )}
        </section>

        {/* Sincronización entre teléfonos */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            {syncCode ? <Cloud className="size-4 text-green-400" /> : <CloudOff className="size-4 text-neutral-500" />}
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">SYNC WITH ANOTHER PHONE</h2>
          </div>
          <p className="mb-2 text-[10px] leading-tight text-neutral-500">
            Enter the same private code on both phones. Trips are encrypted here before leaving and nobody else
            (not even the server) can read them. Without the code there is no sync.
          </p>

          {syncCode ? (
            <div className="space-y-2">
              <Row label="CODE" value={`•••• ${syncCode.slice(-4)}`} tone="text-green-400" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={syncing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 py-2.5 text-[11px] font-extrabold text-black disabled:opacity-60"
                >
                  <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
                  {syncing ? "SYNCING…" : "SINCRONIZAR AHORA"}
                </button>
                <button
                  type="button"
                  onClick={onDisconnectSync}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-3 py-2.5 text-[11px] font-bold text-neutral-300 hover:text-white"
                >
                  <CloudOff className="size-3.5" /> DESCONECTAR
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                placeholder={`Private code (min. ${MIN_SYNC_CODE_LENGTH} characters)`}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => onConnectSync(codeDraft)}
                disabled={syncing || codeDraft.trim().length < MIN_SYNC_CODE_LENGTH}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 py-2.5 text-[11px] font-extrabold text-black disabled:opacity-40"
              >
                <Cloud className={cn("size-3.5", syncing && "animate-spin")} />
                {syncing ? "CONECTANDO…" : "CONECTAR Y SINCRONIZAR"}
              </button>
            </div>
          )}

          {syncMessage && (
            <p
              className={cn(
                "mt-2 text-[10px] font-semibold leading-tight",
                syncTone === "ok" ? "text-green-400" : syncTone === "error" ? "text-rose-400" : "text-neutral-400",
              )}
            >
              {syncMessage}
            </p>
          )}
        </section>

        {/* Reset total */}
        <section className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Eraser className="size-4 text-rose-400" />
            <h2 className="text-xs font-bold tracking-wide text-rose-300">RESET</h2>
          </div>

          {/* Opción 1: limpiar solo caché y pantallas (conserva los datos) */}
          <p className="mb-2 text-[10px] leading-tight text-neutral-400">
            <strong className="text-neutral-300">Cache & screens only:</strong> clears the history of
            chat de IA, las ubicaciones GPS temporales y la week de finanzas (se recalcula sola).
            <strong className="text-emerald-300"> Keeps trips, expenses, ledger and code.</strong>
          </p>
          {confirmCache ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmCache(false)
                  onResetCache()
                }}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-[11px] font-extrabold text-black active:scale-[0.99]"
              >
                YES, CLEAR CACHE
              </button>
              <button
                type="button"
                onClick={() => setConfirmCache(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-[11px] font-bold text-neutral-300"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCache(true)}
              className="w-full rounded-xl border border-amber-500/50 bg-amber-500/10 py-2.5 text-[11px] font-extrabold text-amber-300 active:scale-[0.99]"
            >
              CLEAR CACHE & SCREENS ONLY
            </button>
          )}

          {/* Opción 1.5: solo los datos de proyección */}
          <p className="mb-2 mt-3 border-t border-neutral-800 pt-2 text-[10px] leading-tight text-neutral-400">
            <strong className="text-sky-300">Projection data only:</strong> deletes the recurring
            entries and the not-yet-paid projected entries you see in Projections, so you can
            start fresh entering your own live data. Keeps bank data, trips, paid entries and
            reconciled earnings.
          </p>
          {confirmProj ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={borrarProyeccion}
                className="flex-1 rounded-xl bg-sky-600 py-2.5 text-[11px] font-extrabold text-white active:scale-[0.99]"
              >
                YES, DELETE {projCounts ? `${projCounts.schedules + projCounts.projected} PROJECTION ITEMS` : "PROJECTIONS"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmProj(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-[11px] font-bold text-neutral-300"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={contarProyeccion}
              className="w-full rounded-xl border border-sky-500/50 bg-sky-500/10 py-2.5 text-[11px] font-extrabold text-sky-300 active:scale-[0.99]"
            >
              DELETE PROJECTION DATA ONLY
            </button>
          )}

          {/* Opción 2: reset desde cero (todo) */}
          <p className="mb-2 mt-3 border-t border-rose-900/40 pt-2 text-[10px] leading-tight text-neutral-400">
            <strong className="text-rose-300">From zero (ALL):</strong> deletes all trips from this
            phone: memory, localStorage, backup copy, temporary GPS and IndexedDB. The sync code is kept
            so you can download your data again.
          </p>
          {confirmReset ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false)
                  onResetAll()
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[11px] font-extrabold text-white active:scale-[0.99]"
              >
                YES, DELETE ALL
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-[11px] font-bold text-neutral-300"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full rounded-xl border border-rose-500/50 bg-rose-500/10 py-2.5 text-[11px] font-extrabold text-rose-300 active:scale-[0.99]"
            >
              RESET EVERYTHING FROM SCRATCH (ALL)
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
