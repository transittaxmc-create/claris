"use client"
import {useState} from "react"
import {LogOut} from "lucide-react"
import {createClient} from "@/lib/supabase/client"
export function AuthSignOut(){const [busy,setBusy]=useState(false);async function signOut(){setBusy(true);const {error}=await createClient().auth.signOut();if(error){setBusy(false);window.alert("Could not sign out. Please try again.");return}window.location.assign("/login")}return <button type="button" onClick={signOut} disabled={busy} aria-label="Sign out" title="Sign out" className="fixed right-3 top-3 z-[90] flex size-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950/95 text-neutral-300 shadow-lg backdrop-blur hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-50"><LogOut className="size-4"/></button>}
