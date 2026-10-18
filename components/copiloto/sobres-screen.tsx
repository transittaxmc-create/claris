"use client"

// SOBRES — caparazón (Miguel, 2026-10-18). Página en MÁS.
// Estructura solamente: ver sobres, crear más, editar nombre/meta,
// apartar manualmente. Sin conexión al banco todavía.

import { useEffect, useState } from "react"
import { Plus, Pencil, Check, X, RotateCcw, Wallet } from "lucide-react"
import {
  loadSobres,
  saveSobres,
  newSobre,
  resetSobres,
  money,
  type Sobre,
} from "./sobres-store"

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

function SobreCard(props: {
  sobre: Sobre
  onChange: (s: Sobre) => void
  onDelete: () => void
}) {
  const { sobre, onChange, onDelete } = props
  const [editName, setEditName] = useState(false)
  const [nameDraft, setNameDraft] = useState(sobre.nombre)
  const [metaDraft, setMetaDraft] = useState(String(sobre.meta || ""))
  const [addDraft, setAddDraft] = useState("")

  const restante = r2(sobre.meta - sobre.asignado)
  const pct = sobre.meta > 0 ? Math.min(100, Math.max(0, (sobre.asignado / sobre.meta) * 100)) : 0
  const completo = sobre.meta > 0 && sobre.asignado >= sobre.meta - 0.009

  const commitName = () => {
    const n = nameDraft.trim()
    if (n) onChange({ ...sobre, nombre: n })
    else setNameDraft(sobre.nombre)
    setEditName(false)
  }
  const commitMeta = () => {
    onChange({ ...sobre, meta: Math.max(0, Number(metaDraft) || 0) })
  }
  const apartar = () => {
    const v = Number(addDraft)
    if (!Number.isFinite(v) || v <= 0) return
    onChange({ ...sobre, asignado: r2(sobre.asignado + v) })
    setAddDraft("")
  }
  const quitar = () => {
    const v = Number(addDraft)
    if (!Number.isFinite(v) || v <= 0) return
    onChange({ ...sobre, asignado: r2(Math.max(0, sobre.asignado - v)) })
    setAddDraft("")
  }

  return (
    <div className="rounded-[14px] border border-[#262633] bg-[#111119] p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <Wallet className="size-4" />
        </span>
        {editName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && commitName()}
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm font-bold text-white"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(sobre.nombre)
              setEditName(true)
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="truncate text-sm font-extrabold text-white">{sobre.nombre}</span>
            <Pencil className="size-3 shrink-0 text-neutral-600" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Borrar sobre ${sobre.nombre}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-neutral-600 active:scale-95"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Meta</p>
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm font-bold text-white">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={metaDraft}
              onChange={(e) => setMetaDraft(e.target.value)}
              onBlur={commitMeta}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="0.00"
              className="w-24 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-sm font-bold text-white"
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Apartado</p>
          <p className="font-mono text-sm font-extrabold text-emerald-400">{money(sobre.asignado)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Falta</p>
          <p className={`font-mono text-sm font-extrabold ${restante <= 0 && sobre.meta > 0 ? "text-neutral-500" : "text-amber-300"}`}>
            {sobre.meta > 0 ? money(Math.max(0, restante)) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full ${completo ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          value={addDraft}
          onChange={(e) => setAddDraft(e.target.value)}
          placeholder="Monto"
          className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-xs text-white placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={apartar}
          className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-extrabold text-black active:scale-95"
        >
          <Plus className="size-3.5" /> Apartar
        </button>
        <button
          type="button"
          onClick={quitar}
          className="rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs font-bold text-neutral-300 active:scale-95"
        >
          Quitar
        </button>
      </div>

      {completo && (
        <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-400">
          <Check className="size-3" /> Listo para pagar
        </p>
      )}
    </div>
  )
}

export function SobresScreen() {
  const [sobres, setSobres] = useState<Sobre[]>([])
  const [nombre, setNombre] = useState("")
  const [meta, setMeta] = useState("")

  useEffect(() => {
    setSobres(loadSobres())
  }, [])

  const update = (next: Sobre[]) => {
    setSobres(next)
    saveSobres(next)
  }

  const crear = () => {
    const n = nombre.trim()
    if (!n) return
    update([...sobres, newSobre(n, Number(meta) || 0)])
    setNombre("")
    setMeta("")
  }

  const totalMeta = r2(sobres.reduce((s, x) => s + (Number(x.meta) || 0), 0))
  const totalAsignado = r2(sobres.reduce((s, x) => s + (Number(x.asignado) || 0), 0))

  return (
    <div
      className="flex h-full flex-col bg-[#0a0a0f]"
      style={{
        backgroundImage:
          "radial-gradient(1200px 600px at 50% -10%, rgba(91,140,255,.10), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,92,255,.08), transparent 55%)",
      }}
    >
      <div className="flex-1 space-y-2.5 overflow-y-auto px-2 py-2">
        <div className="px-1 pt-1">
          <p className="text-[15px] font-extrabold text-white">SOBRES</p>
          <p className="text-[11px] leading-snug text-[#9a9cb0]">
            Aparta dinero por bill antes de que venza. Caparazón — sin conexión al banco todavía.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[14px] border border-[#262633] bg-[#111119] p-2.5 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Metas</p>
            <p className="font-mono text-sm font-extrabold text-white">{money(totalMeta)}</p>
          </div>
          <div className="rounded-[14px] border border-[#262633] bg-[#111119] p-2.5 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Apartado</p>
            <p className="font-mono text-sm font-extrabold text-emerald-400">{money(totalAsignado)}</p>
          </div>
          <div className="rounded-[14px] border border-[#262633] bg-[#111119] p-2.5 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Por apartar</p>
            <p className="font-mono text-sm font-extrabold text-amber-300">{money(Math.max(0, r2(totalMeta - totalAsignado)))}</p>
          </div>
        </div>

        {sobres.map((s) => (
          <SobreCard
            key={s.id}
            sobre={s}
            onChange={(next) => update(sobres.map((x) => (x.id === s.id ? next : x)))}
            onDelete={() => update(sobres.filter((x) => x.id !== s.id))}
          />
        ))}

        <div className="rounded-[14px] border border-dashed border-[#33333f] bg-[#111119]/60 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Nuevo sobre</p>
          <div className="flex gap-1.5">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre (ej. Seguro)"
              className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            <input
              type="number"
              inputMode="decimal"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Meta"
              className="w-24 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 font-mono text-sm text-white placeholder:text-neutral-600"
            />
            <button
              type="button"
              onClick={crear}
              aria-label="Crear sobre"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-black active:scale-95"
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => update(resetSobres())}
          className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold text-neutral-600 active:scale-95"
        >
          <RotateCcw className="size-3" /> Restablecer los 3 sobres
        </button>
      </div>
    </div>
  )
}
