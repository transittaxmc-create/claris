import {redirect} from "next/navigation"
import {CopilotoApp} from "@/components/copiloto/copiloto-app"
import {AuthSignOut} from "@/components/copiloto/auth-signout"
import {createClient} from "@/lib/supabase/server"
export const dynamic="force-dynamic"
export default async function Page(){const supabase=await createClient();const {data,error}=await supabase.auth.getClaims();if(error||!data?.claims)redirect("/login");return <><CopilotoApp/><AuthSignOut/></>}
