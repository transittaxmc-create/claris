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
  onExportFull,
  onImport,
  onLoadDemo,
  onResetAll,
  onResetCache,
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
}) {
  const [codeDraft, setCodeDraft] = useState("")
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmCache, setConfirmCache] = useState(false)
  // Versión que está sirviendo producción, para comparar con la de este teléfono.
  const [ultimaVersion, setUltimaVersion] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch("https://claris-lime.vercel.app/api/version", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { short?: string } | null) => {
        if (vivo && data?.short) setUltimaVersion(data.short)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onRefreshInfo()
  }, [onRefreshInfo])

  return (
    <div className="screen-frame">
      <div className="shrink-0 flex items-center justify-between px-4 pt-3 sm:px-8">
        <h1 className="text-base font-extrabold tracking-tight text-white">Datos</h1>
        <button
          type="button"
          onClick={onRefreshInfo}
          className="flex items-center gap-1 rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] font-bold text-neutral-300 hover:text-white"
        >
          <RefreshCw className="size-3" /> ACTUALIZAR
        </button>
      </div>

      <div className="screen-scroll space-y-3 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-8">
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
          <Row label="GASTOS EN MEMORIA" value={String(info?.expenses ?? 0)} tone="text-rose-300" />
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
          {/* Versión: sirve para saber si este teléfono abrió la última copia. */}
          <Row
            label="VERSIÓN DE LA APP"
            value={
              process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
                ? `${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}${ultimaVersion && ultimaVersion !== process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7) ? ` (hay ${ultimaVersion})` : " · al día"}`
                : "local"
            }
            tone={
              ultimaVersion && ultimaVersion !== (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7)
                ? "text-amber-300"
                : "text-green-400"
            }
          />
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

          {/* Backup TOTAL: todos los archivos + índice HTML legible */}
          <button
            type="button"
            onClick={onExportFull}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/30 py-2.5 text-[11px] font-bold text-sky-300 hover:bg-sky-900/40"
          >
            <Download className="size-3.5" /> DESCARGAR TODO (BACKUP TOTAL)
          </button>
          <p className="mt-1.5 text-[10px] leading-tight text-neutral-500">
            Descarga <strong className="text-neutral-300">todos los archivos JSON</strong> de la app
            (viajes, gastos, finanzas, ledger, categorías, ajustes) más un{" "}
            <strong className="text-neutral-300">índice HTML legible</strong> con totales y tablas. Con
            eso nunca hay que empezar desde cero.
          </p>
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

        {/* Sincronización privada entre dispositivos */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            {syncCode ? <Cloud className="size-4 text-green-400" /> : <CloudOff className="size-4 text-neutral-500" />}
            <h2 className="text-xs font-bold tracking-wide text-neutral-200">SINCRONIZAR TUS DISPOSITIVOS</h2>
          </div>
          <p className="mb-2 text-[10px] leading-tight text-neutral-500">
            Usa el mismo código privado en tu teléfono y laptop. Tus datos se cifran en cada dispositivo antes de
            sincronizarse; solo tú puedes descifrarlos. Sin código no hay sincronización.
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
            <h2 className="text-xs font-bold tracking-wide text-rose-300">RESET</h2>
          </div>

          {/* Opción 1: limpiar solo caché y pantallas (conserva los datos) */}
          <p className="mb-2 text-[10px] leading-tight text-neutral-400">
            <strong className="text-neutral-300">Solo caché y pantallas:</strong> borra el historial del
            chat de IA, las ubicaciones GPS temporales y la semana de finanzas (se recalcula sola).
            <strong className="text-emerald-300"> Conserva viajes, gastos, ledger y código.</strong>
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
                SÍ, LIMPIAR CACHÉ
              </button>
              <button
                type="button"
                onClick={() => setConfirmCache(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-[11px] font-bold text-neutral-300"
              >
                CANCELAR
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCache(true)}
              className="w-full rounded-xl border border-amber-500/50 bg-amber-500/10 py-2.5 text-[11px] font-extrabold text-amber-300 active:scale-[0.99]"
            >
              LIMPIAR SOLO CACHÉ Y PANTALLAS
            </button>
          )}

          {/* Opción 2: reset desde cero (todo) */}
          <p className="mb-2 mt-3 border-t border-rose-900/40 pt-2 text-[10px] leading-tight text-neutral-400">
            <strong className="text-rose-300">Desde cero (ALL):</strong> borra todos los viajes de este
            teléfono: memoria, localStorage, copia de seguridad, GPS temporal e IndexedDB. Se conserva el
            código de sync para poder volver a bajar tus datos.
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
              RESETEAR TODO DESDE CERO (ALL)
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
