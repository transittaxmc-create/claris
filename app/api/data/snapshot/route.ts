// app/api/data/snapshot/route.ts
// Contraparte de lectura del sync automático entre teléfonos
// (transporte NUEVO, 2026-11-26): devuelve el documento sincronizable
// guardado por POST /api/data/publish en Supabase — tabla PROPIA
// public.finance_sync_doc del proyecto del CRM (mimgwleghecseoymgdug),
// separada de las tablas del CRM. Ver el comentario completo en
// publish/route.ts: el proyecto financiero está congelado (402) y el
// Blob de Vercel suspendido; por orden de Miguel no se espera a Vercel.
//
// Protegido con la misma llave (header x-data-key contra DATA_SYNC_KEY
// o BANK_PUBLISH_KEY) Y con la sesión de Miguel (RLS por dueño, sin
// service key). Sin documento todavía → 200 { doc: null } (primer
// contacto: el teléfono adopta/subirá según la mezcla del cliente).
// Sin llave del servidor o sin proyecto → 503: el cliente lo trata
// como "sync no configurado" y NO toca ningún dato local. Si el
// almacenamiento falla (p. ej. la tabla aún no existe) → 502: el
// cliente lo trata como fallo de lectura y NO escribe nada.
import { NextResponse } from "next/server"
import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TABLE = "finance_sync_doc"

export async function GET(req: Request) {
  const expected = process.env.DATA_SYNC_KEY || process.env.BANK_PUBLISH_KEY || ""
  if (!expected) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const key = req.headers.get("x-data-key") || ""
  if (key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = await crmSupabaseServer()
  if (!supabase) {
    return NextResponse.json({ error: "data_sync_not_configured" }, { status: 503 })
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("doc")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: "storage_unavailable" }, { status: 502 })
  }
  if (!data?.doc) {
    return NextResponse.json({ doc: null }, { headers: { "Cache-Control": "no-store" } })
  }
  const doc = data.doc as any
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || !Array.isArray(doc.entries)) {
    return NextResponse.json({ doc: null }, { headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json(doc, { headers: { "Cache-Control": "no-store" } })
}
