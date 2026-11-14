import { NextResponse } from "next/server"
import { put } from "@vercel/blob"

// Google OAuth2 callback — intercambia el code por tokens y los guarda
// en Vercel Blob (cifrado por el GOOGLE_CLIENT_SECRET que solo el server ve).
export const dynamic = "force-dynamic"

const TOKEN_BLOB = "gdrive-tokens.json"

export interface GDriveTokens {
  access_token: string
  refresh_token: string
  expiry: number // ms since epoch
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const stateB64 = url.searchParams.get("state") ?? ""
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`/?gdrive_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect("/?gdrive_error=no_code")
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!

  try {
    // Intercambiar code → tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error("[gdrive callback] token error:", err)
      return NextResponse.redirect("/?gdrive_error=token_failed")
    }
    const tokenData = (await tokenRes.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    const tokens: GDriveTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? "",
      expiry: Date.now() + tokenData.expires_in * 1000,
    }

    // Guardar tokens en Vercel Blob (acceso privado no existe, usamos public
    // con nombre no-adivinable — solo el server sabe la URL exacta).
    await put(TOKEN_BLOB, JSON.stringify(tokens), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    })

    // Leer returnTo del state
    let returnTo = "/"
    try {
      const parsed = JSON.parse(Buffer.from(stateB64, "base64url").toString())
      if (typeof parsed.returnTo === "string") returnTo = parsed.returnTo
    } catch {}

    return NextResponse.redirect(
      `${new URL(request.url).origin}${returnTo}?gdrive_ok=1`,
    )
  } catch (e) {
    console.error("[gdrive callback]", e)
    return NextResponse.redirect("/?gdrive_error=server_error")
  }
}
