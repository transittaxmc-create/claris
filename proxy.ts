import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refresco de sesión del Supabase del CRM (Paso 2 del manual: proxy.ts
 * para Next.js 16). SOLO refresca las cookies de sesión del CRM cuando
 * existen; no redirige, no bloquea rutas y no altera el flujo de la app
 * ni del módulo financiero. La protección real de datos la hace RLS en
 * el proyecto del CRM y la ruta /api/crm/state exige sesión (401).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_CRM_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY || ""
  if (!url || !key) return NextResponse.next({ request })

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  // Refresca la sesión si hay cookies de auth; sin sesión no hace nada.
  await supabase.auth.getClaims()
  return response
}

export const config = {
  matcher: [
    // Todo menos assets estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
