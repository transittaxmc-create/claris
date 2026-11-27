import { crmSupabaseServer } from "@/lib/crm/supabase-server"

export async function getCrmPushUserId(): Promise<string | null> {
  try {
    const supabase = await crmSupabaseServer()
    if (!supabase) return null
    const { data, error } = await supabase.auth.getClaims()
    const userId = (data?.claims as { sub?: string } | undefined)?.sub
    return !error && typeof userId === "string" && userId.length > 0 ? userId : null
  } catch {
    return null
  }
}
