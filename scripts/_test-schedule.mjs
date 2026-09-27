// Pruebas de los helpers de pagos programados (vencimiento + frecuencia).
// Ejecutar: node scripts/_test-schedule.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "schedule-test-"))

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

const { nextOccurrenceDate, daysUntil, scheduledEntryFromExpense } = await import(
  pathToFileURL(join(tmp, "types.mjs")).href
)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

console.log("\n== PROXIMA OCURRENCIA ==")
check("diaria +1", nextOccurrenceDate("2026-09-26", "daily"), "2026-09-27")
check("semanal +7", nextOccurrenceDate("2026-09-26", "weekly"), "2026-10-03")
check("mensual", nextOccurrenceDate("2026-09-26", "monthly"), "2026-10-26")
check("anual", nextOccurrenceDate("2026-09-26", "annual"), "2027-09-26")
check("una vez no cambia", nextOccurrenceDate("2026-09-26", "once"), "2026-09-26")
check("cambio de mes desde el 31", nextOccurrenceDate("2026-01-31", "monthly"), "2026-03-03")
check("fecha invalida se devuelve", nextOccurrenceDate("basura", "daily"), "basura")

console.log("\n== DIAS HASTA VENCIMIENTO ==")
const from = new Date("2026-09-26T12:00:00")
check("hoy es 0", daysUntil("2026-09-26", from), 0)
check("manana es 1", daysUntil("2026-09-27", from), 1)
check("ayer es -1", daysUntil("2026-09-25", from), -1)
check("en 7 dias", daysUntil("2026-10-03", from), 7)
check("fecha invalida es 0", daysUntil("basura", from), 0)

console.log("\n== ENTRADA PROGRAMADA DESDE UN GASTO ==")
const gasto = {
  id: "g-1",
  date: "2026-09-26",
  vendor: "Geico",
  category: "Seguros / Permisos",
  amount: 180,
  isAiGenerated: false,
  isEditedByUser: false,
}
const entry = scheduledEntryFromExpense(gasto, "monthly", "2026-10-26")
check("kind expense", entry.kind, "expense")
check("descripcion = vendedor", entry.description, "Geico")
check("categoria heredada", entry.category, "Seguros / Permisos")
check("monto heredado", entry.amount, 180)
check("frecuencia mensual", entry.frequency, "monthly")
check("proximo vencimiento", entry.nextDate, "2026-10-26")
check("inicio = fecha del gasto", entry.startDate, "2026-09-26")
check("activa por defecto", entry.active, true)
check("tiene id", typeof entry.id === "string" && entry.id.length > 0, true)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
