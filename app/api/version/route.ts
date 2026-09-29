// Versión que está sirviendo ESTE deployment.
//
// Sirve para que la app pueda avisar cuando el teléfono está abriendo una copia
// vieja (una URL de preview antigua que quedó viva): la app compara su propio
// commit con el que responde producción y, si no coinciden, ofrece el enlace
// bueno. Sin esto ya nos pasó: una preview de v0 seguía mostrando la versión
// anterior y parecía que el trabajo no se había desplegado.

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev"
  const url = process.env.VERCEL_URL || ""
  return NextResponse.json(
    {
      sha,
      short: sha.slice(0, 7),
      env: process.env.VERCEL_ENV || "local",
      deployment: url,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        // La app corre en otro dominio (alias de producción o una preview), así
        // que la comprobación necesita CORS abierto.
        "access-control-allow-origin": "*",
        "cache-control": "no-store, max-age=0",
      },
    },
  )
}
