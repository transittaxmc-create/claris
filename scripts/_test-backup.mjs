// Pruebas del generador de copia de seguridad total (JSON + índice HTML).
// Ejecutar: node scripts/_test-backup.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, renameSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "backup-test-"))

cpSync(join(ROOT, "lib", "backup.ts"), join(tmp, "backup.ts"))
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "backup.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
renameSync(join(tmp, "backup.js"), join(tmp, "backup.mjs"))

const { collectAppKeys, isAppKey, buildBackupHtml, buildBackupBundle } = await import(
  pathToFileURL(join(tmp, "backup.mjs")).href
)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

console.log("\n== FILTRO DE CLAVES (solo las de la app) ==")
check("ic_ es de la app", isAppKey("ic_tip_tracker"), true)
check("claris_ es de la app", isAppKey("claris_ai_history"), true)
check("CURRENT_ es de la app", isAppKey("CURRENT_PICKUP"), true)
check("basura de terceros no", isAppKey("amplitude_id"), false)
check("otra clave cualquiera no", isAppKey("foo"), false)

// localStorage simulado
const store = {
  "ic_tip_tracker": '{"entries":[]}',
  "ic_expenses": '{"entries":[]}',
  "claris_finance_week_v1": '{"startingBalance":500}',
  "amplitude_id": "basura",
  "some-extension-key": "basura",
}
const ls = {
  get length() { return Object.keys(store).length },
  key(i) { return Object.keys(store)[i] ?? null },
  getItem(k) { return store[k] ?? null },
}
const keys = collectAppKeys(ls)
check("recoge las 3 de la app", Object.keys(keys).length, 3)
check("incluye ic_tip_tracker", "ic_tip_tracker" in keys, true)
check("excluye amplitude", "amplitude_id" in keys, false)
check("excluye extension", "some-extension-key" in keys, false)

console.log("\n== JSON COMPLETO ==")
const input = {
  date: "2026-09-27",
  trips: [
    { date: "2026-09-27", platform: "Uber", gross: 85.66, net: 85.66 },
    { date: "2026-09-27", platform: "Lyft", gross: 40, net: 37 },
  ],
  expenses: [
    { date: "2026-09-27", vendor: "Shell", category: "Gasolina / Combustible", amount: 42.75, classification: "business" },
    { date: "2026-09-26", vendor: "Cine", category: "Varios", amount: 20, classification: "personal" },
  ],
  keys,
}
const bundle = JSON.parse(buildBackupBundle(input))
check("tipo full-backup", bundle.kind, "full-backup")
check("version 3", bundle.version, 3)
check("cuenta viajes", bundle.counts.trips, 2)
check("cuenta gastos", bundle.counts.expenses, 2)
check("incluye las claves crudas", Object.keys(bundle.keys).length, 3)
check("conserva el contenido", bundle.keys["ic_tip_tracker"], '{"entries":[]}')

console.log("\n== INDICE HTML ==")
const html = buildBackupHtml(input)
check("es un documento html", html.startsWith("<!DOCTYPE html>"), true)
check("titulo con la fecha", html.includes("2026-09-27"), true)
check("cuenta de viajes", html.includes(">2<"), true)
check("bruto sumado", html.includes("$125.66"), true)
check("gastos sumados", html.includes("$62.75"), true)
check("business 42.75", html.includes("$42.75"), true)
check("personal 20.00", html.includes("$20.00"), true)
check("muestra el vendedor", html.includes("Shell"), true)
check("muestra la plataforma", html.includes("Uber"), true)
check("explica como restaurar", html.includes("IMPORTAR JSON"), true)
check("lista las claves", html.includes("ic_tip_tracker"), true)
check("clasificacion business visible", html.includes("💼 Business"), true)
check("clasificacion personal visible", html.includes("🏠 Personal"), true)

console.log("\n== ESCAPADO (no romper el HTML) ==")
const htmlXss = buildBackupHtml({
  date: "2026-09-27",
  trips: [],
  expenses: [{ date: "2026-09-27", vendor: "<script>alert(1)</script>", category: "Varios", amount: 5 }],
  keys: {},
})
check("escapa el script", htmlXss.includes("<script>alert(1)</script>"), false)
check("lo muestra escapado", htmlXss.includes("&lt;script&gt;"), true)

console.log("\n== SIN DATOS ==")
const vacio = buildBackupHtml({ date: "2026-09-27", trips: [], expenses: [], keys: {} })
check("avisa que no hay viajes", vacio.includes("Sin viajes registrados"), true)
check("avisa que no hay gastos", vacio.includes("Sin gastos registrados"), true)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
