import {createBrowserClient} from "@supabase/ssr"
export function createClient(){const url=process.env.NEXT_PUBLIC_CRM_SUPABASE_URL,key=process.env.NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error("CRM Supabase environment variables are missing.");return createBrowserClient(url,key)}
