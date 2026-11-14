import { NextResponse } from "next/server"

// Google OAuth2 — inicia el flujo de autorización.
// El usuario es redirigido a Google para dar permiso a su Drive.
export const dynamic = "force-dynamic"

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // solo archivos que crea esta app
].join(" ")

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "google_no_configurado", hint: "Falta GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI en Vercel." },
      { status: 501 },
    )
  }

  // state = URL de regreso (la página que inició el flujo)
  const returnTo = new URL(request.url).searchParams.get("return") ?? "/"
  const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64url")

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
