"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Cloud, CloudOff, Database, Download, Eraser, RefreshCw, Save, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StorageInfo } from "./storage"
import { MIN_SYNC_CODE_LENGTH } from "@/lib/sync"
import type { Trip } from "./types"

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
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
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
  onImport,
  onLoadDemo,
  onResetAll,
  onConnectSync,
  onSyncNow,
  onDisconnectSync,
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
  onImport: (file: File) => void
  onLoadDemo: () => void
  onResetAll: () => void
  onConnectSync: (code: string) => void
  onSyncNow: () => void
  onDisconnectSync: () => void
}) {
  const [codeDraft, setCodeDraft] = useState("")
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
              <p className="font-bold text-rose-300">No se pudo guardar en el teléfono</p>
              <p className="mt-0.5 break-words">{saveError}</p>
            </div>
          </div>
        )}

        {/* Estado del almacenamiento */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Database className="size-4 text-yellow-400" />
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">GUARDADO EN ESTE TELÉFONO</h2>
          </div>
          <Row label="VIAJES EN MEMORIA" value={String(trips.length)} />
          <Row label="ÚLTIMA GRABACIÓN" value={fmtTime(info?.lastSavedAt ?? null)} />
          <Row
            label="LOCALSTORAGE"
            value={info ? (info.localStorageOk ? "OK" : "BLOQUEADO") : "…"}
            tone={info?.localStorageOk ? "text-green-400" : "text-rose-400"}
          />
          <Row
            label="INDEXEDDB (COPIA)"
            value={info ? (info.indexedDbOk ? `${info.indexedDbCount} registros` : "NO DISPONIBLE") : "…"}
            tone={info?.indexedDbOk ? "text-green-400" : "text-rose-400"}
          />
          <Row label="ESPACIO USADO" value={info ? `${fmtBytes(info.bytes)} · ${info.keys} claves` : "…"} />
          <Row label="BORRADOS PENDIENTES" value={String(info?.tombstones ?? 0)} tone="text-neutral-400" />
          <p className="mt-2 text-[10px] leading-tight text-neutral-500">
            Cada viaje se guarda en dos sitios (localStorage + IndexedDB) y con copia de seguridad. Si el teléfono borra
            el navegador, IndexedDB devuelve los viajes al abrir la app.
          </p>
        </section>

        {/* Copia de seguridad */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Save className="size-4 text-sky-400" />
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">COPIA DE SEGURIDAD</h2>
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
          {trips.length === 0 && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="mt-2 w-full rounded-xl border border-neutral-800 py-2 text-[11px] font-bold text-neutral-400 hover:text-neutral-200"
            >
              CARGAR VIAJES DE EJEMPLO
            </button>
          )}
        </section>

        {/* Sincronización entre teléfonos */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            {syncCode ? <Cloud className="size-4 text-green-400" /> : <CloudOff className="size-4 text-neutral-500" />}
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">SINCRONIZAR CON OTRO TELÉFONO</h2>
          </div>
          <p className="mb-2 text-[10px] leading-tight text-neutral-500">
            Escribe el mismo código privado en tus dos teléfonos. Los viajes se cifran aquí antes de salir y nadie más
            (ni el servidor) puede leerlos. Sin código no hay sincronización.
          </p>

          {syncCode ? (
            <div className="space-y-2">
              <Row label="CÓDIGO" value={`•••• ${syncCode.slice(-4)}`} tone="text-green-400" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={syncing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 py-2.5 text-[11px] font-extrabold text-black disabled:opacity-60"
                >
                  <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
                  {syncing ? "SINCRONIZANDO…" : "SINCRONIZAR AHORA"}
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
                placeholder={`Código privado (mín. ${MIN_SYNC_CODE_LENGTH} caracteres)`}
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
            <h2 className="text-xs font-bold tracking-wide text-rose-300">RESET TOTAL</h2>
          </div>
          <p className="mb-2 text-[10px] leading-tight text-neutral-400">
            Borra todos los viajes de este teléfono: memoria, localStorage, copia de seguridad, GPS temporal e
            IndexedDB. Se conserva el código de sync para poder volver a bajar tus datos.
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
                SÍ, BORRAR TODO
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-[11px] font-bold text-neutral-300"
              >
                CANCELAR
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full rounded-xl border border-rose-500/50 bg-rose-500/10 py-2.5 text-[11px] font-extrabold text-rose-300 active:scale-[0.99]"
            >
              RESETEAR TODO Y EL STORAGE
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
