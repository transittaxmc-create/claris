import { createBrowserClient } from "@supabase/ssr"

/**
 * Cliente de navegador del Supabase EXCLUSIVO del CRM (proyecto
 * mimgwleghecseoymgdug, "Copiloto V7 CRM"). Usa solo la URL y la clave
 * PUBLICABLE del CRM: la clave publicable no es un secreto (viaja en el
 * navegador por diseño) y el acceso real lo controla RLS por usuario
 * autenticado (auth.uid() = user_id). NUNCA usar aquí el Supabase
 * financiero ni ninguna service/secret key.
 */
export function crmSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_CRM_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY || ""
  if (!url || !key) return null
  return createBrowserClient(url, key)
}

export function crmCloudConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CRM_SUPABASE_URL && process.env.NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY)
}
