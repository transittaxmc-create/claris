import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Cliente de servidor del Supabase EXCLUSIVO del CRM. La sesión del
 * usuario viaja en cookies (@supabase/ssr); no hay service key del CRM:
 * todas las lecturas/escrituras pasan por RLS con el usuario autenticado.
 * El proyecto financiero y sus claves no se tocan aquí.
 */
export async function crmSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_CRM_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY || ""
  if (!url || !key) return null
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el refresco de sesión lo
          // hace proxy.ts; aquí se puede ignorar sin riesgo.
        }
      },
    },
  })
}
