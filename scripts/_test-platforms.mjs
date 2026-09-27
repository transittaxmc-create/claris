// Pruebas de la normalización de plataformas. Lo importante aquí es que los
// nombres antiguos NO se pierdan: si un viaje guardado como "EcoRide" cayera a
// "Other", el usuario perdería el desglose por plataforma.
//
// Ejecutar: node scripts/_test-platforms.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "platforms-test-"))

for (const f of ["types.ts", "geo.ts"]) {
  cpSync(join(ROOT, "components", "copiloto", f), join(tmp, f))
}
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "types.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
for (const name of ["geo", "types"]) {
  const js = join(tmp, `${name}.js`)
  writeFileSync(js, readFileSync(js, "utf8").replace(/from "\.\/geo"/g, 'from "./geo.mjs"'))
  renameSync(js, join(tmp, `${name}.mjs`))
}

const { normalizePlatformName, PLATFORMS, LEGACY_PLATFORM_ALIASES } = await import(
  pathToFileURL(join(tmp, "types.mjs")).href
)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

console.log("\n== plataformas nuevas reconocidas ==")
check("Eco Ride", normalizePlatformName("Eco Ride"), "Eco Ride")
check("Throo", normalizePlatformName("Throo"), "Throo")
check("AKI Technology", normalizePlatformName("AKI Technology"), "AKI Technology")
check("Classic Ryde", normalizePlatformName("Classic Ryde"), "Classic Ryde")
check("Aventus Ride", normalizePlatformName("Aventus Ride"), "Aventus Ride")

console.log("\n== NOMBRES ANTIGUOS que no deben perderse (era el bug) ==")
check("EcoRide -> Eco Ride", normalizePlatformName("EcoRide"), "Eco Ride")
check("ecoride (minusculas)", normalizePlatformName("ecoride"), "Eco Ride")
check("ECORIDE (mayusculas)", normalizePlatformName("ECORIDE"), "Eco Ride")
check("Aventus -> Aventus Ride", normalizePlatformName("Aventus"), "Aventus Ride")
check("aki -> AKI Technology", normalizePlatformName("aki"), "AKI Technology")
check("classic -> Classic Ryde", normalizePlatformName("classic"), "Classic Ryde")
check("Aventus Ride con espacios", normalizePlatformName("  Aventus Ride  "), "Aventus Ride")

console.log("\n== formas de escritura alternativas ==")
check("eco ride", normalizePlatformName("eco ride"), "Eco Ride")
check("AKI Tech", normalizePlatformName("AKI Tech"), "AKI Technology")
check("classicryde", normalizePlatformName("classicryde"), "Classic Ryde")

console.log("\n== lo que NO debe cambiar ==")
check("Uber sigue Uber", normalizePlatformName("Uber"), "Uber")
check("Lyft sigue Lyft", normalizePlatformName("Lyft"), "Lyft")
check("Cash sigue Cash", normalizePlatformName("Cash"), "Cash")
check("Other sigue Other", normalizePlatformName("Other"), "Other")

console.log("\n== desconocidos y vacios caen a Other ==")
check("Cadena rara", normalizePlatformName("PlataformaInventada"), "Other")
check("vacio", normalizePlatformName(""), "Other")
check("null", normalizePlatformName(null), "Other")
check("undefined", normalizePlatformName(undefined), "Other")
check("numero", normalizePlatformName(42), "Other")

console.log("\n== integridad de las listas ==")
check("PLATFORMS tiene 9", PLATFORMS.length, 9)
check("PLATFORMS sin duplicados", new Set(PLATFORMS).size, PLATFORMS.length)
check("todas terminan en si mismas", PLATFORMS.every((p) => normalizePlatformName(p) === p), true)
check(
  "cada plataforma tiene un alias o es canonica",
  PLATFORMS.every((p) => Object.values(LEGACY_PLATFORM_ALIASES).includes(p) || p === "Other" || p === "Cash"),
  true,
)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
