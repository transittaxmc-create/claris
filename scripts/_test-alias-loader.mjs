// Gancho de resolución para las pruebas _test-*.mjs: traduce el alias `@/`
// (tsconfig paths) a la raíz del repo, para que `node` pueda importar los
// .ts de la app sin compilar. Se instala con module.register() desde
// _test-register-alias.mjs:
//   node --import ./scripts/_test-register-alias.mjs scripts/_test-....mjs
import { existsSync } from "node:fs"

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = new URL("../" + specifier.slice(2), import.meta.url)
    // Node no añade la extensión: probar .ts / .tsx / .js en ese orden.
    for (const ext of ["", ".ts", ".tsx", ".js"]) {
      const candidate = new URL(base.href + ext)
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true }
    }
    return { url: base.href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
