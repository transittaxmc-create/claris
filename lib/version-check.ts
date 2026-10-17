// Compara la versión de ESTE deployment con la de producción.
//
// Antes solo se comparaba el commit: cualquier diferencia mostraba "Copia
// vieja", también en una preview MÁS NUEVA que producción (falsa alarma).
// Ahora se usa la hora de build: más vieja que producción = copia vieja;
// más nueva = versión de prueba (aviso informativo, no alarma).
// Puro (sin imports) para poder probarlo en Node.

export type VersionInfo = { sha?: string | null; builtAt?: string | null }
export type VersionStatus = "same" | "older" | "newer" | "unknown"

export function compareVersion(own: VersionInfo, prod: VersionInfo): VersionStatus {
  const ownSha = own.sha || ""
  const prodSha = prod.sha || ""
  if (!ownSha || !prodSha) return "unknown"
  if (ownSha === prodSha) return "same"
  const ownAt = Date.parse(own.builtAt || "")
  const prodAt = Date.parse(prod.builtAt || "")
  const ownOk = Number.isFinite(ownAt)
  const prodOk = Number.isFinite(prodAt)
  if (ownOk && prodOk) return ownAt > prodAt ? "newer" : "older"
  // Producción sin hora de build = deploy anterior a esta comprobación, así que
  // un build que sí la tiene es más nuevo.
  if (ownOk && !prodOk) return "newer"
  // Este build no sabe su hora (deploy anterior): se mantiene el aviso clásico.
  return "older"
}
