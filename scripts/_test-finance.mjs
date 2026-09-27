// Pruebas del puente FINANCE: los viajes reales alimentan la corrida de caja.
// Ejecutar: node scripts/_test-finance.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "finance-test-"))

cpSync(join(ROOT, "components", "copiloto", "finance-bridge.ts"), join(tmp, "finance-bridge.ts"))
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "finance-bridge.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
renameSync(join(tmp, "finance-bridge.js"), join(tmp, "finance-bridge.mjs"))

const { groupRealTrips, applyTripsToDays, computeRealWeekTotals } = await import(
  pathToFileURL(join(tmp, "finance-bridge.mjs")).href
)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

// Semana tipo Lun-Dom con 3 días laborables
function day(id, date, platforms = {}) {
  const names = ["Uber", "Lyft", "Eco Ride"]
  return {
    id, date, isWorkingDay: true,
    platforms: names.map((platformName) => ({
      platformName,
      projectedAmount: platforms[platformName]?.projected ?? 0,
      actualAmount: platforms[platformName]?.actual ?? 0,
    })),
  }
}

const days = [
  day("d1", "2026-09-28"),
  day("d2", "2026-09-29", { Uber: { actual: 10 } }),
  day("d3", "2026-09-30"),
]

console.log("\n== AGRUPACION ==")
const g = groupRealTrips([
  { date: "2026-09-28", platform: "Uber", net: 100 },
  { date: "2026-09-28", platform: "Uber", net: 50 },
  { date: "2026-09-28", platform: "Lyft", net: 30 },
  { date: "2026-09-29", platform: "Uber", net: 0 },   // neto 0 se ignora
  { date: "2026-09-29", platform: "Lyft", net: -5 },  // negativo se ignora
  { date: "", platform: "Uber", net: 40 },            // sin fecha se ignora
])
check("Uber 28 suma dos viajes", g.get("2026-09-28")?.get("Uber"), 150)
check("Lyft 28", g.get("2026-09-28")?.get("Lyft"), 30)
check("29 sin viajes validos", g.has("2026-09-29"), false)

console.log("\n== APLICACION A DIAS ==")
const applied = applyTripsToDays(days, [
  { date: "2026-09-28", platform: "Uber", net: 150 },
  { date: "2026-09-28", platform: "Lyft", net: 30 },
  { date: "2026-09-29", platform: "Uber", net: 90 },
  { date: "2026-09-30", platform: "Eco Ride", net: 25 },
])
check("dia 1 Uber real = 150", applied[0].platforms[0].actualAmount, 150)
check("dia 1 Lyft real = 30", applied[0].platforms[1].actualAmount, 30)
check("dia 1 Eco Ride sigue 0", applied[0].platforms[2].actualAmount, 0)
check("dia 2: real 90 > manual 10 -> 90", applied[1].platforms[0].actualAmount, 90)
check("dia 3 Eco Ride real = 25", applied[2].platforms[2].actualAmount, 25)
check("proyectado no se toca", applied[0].platforms[0].projectedAmount, 0)

console.log("\n== NUNCA REDUCE LO MANUAL ==")
const noReduce = applyTripsToDays(days, [
  { date: "2026-09-29", platform: "Uber", net: 5 }, // 5 < 10 manual
])
check("real 5 contra manual 10 -> se conserva 10", noReduce[1].platforms[0].actualAmount, 10)

console.log("\n== DIAS SIN VIAJES INTACTOS ==")
check("dia 1 sin cambios si no tiene viajes", applyTripsToDays(days, []), days)

console.log("\n== TOTALES REALES ==")
const totals = computeRealWeekTotals([
  { date: "2026-09-28", platform: "Uber", net: 100 },
  { date: "2026-09-28", platform: "Lyft", net: 50.5 },
  { date: "2026-09-29", platform: "Uber", net: 0 },
  { date: "2026-09-29", platform: "Lyft", net: -3 },
])
check("ingreso real 150.5", totals.realIncome, 150.5)
check("solo viajes positivos cuentan", totals.realTripCount, 2)
check("desglose Uber", totals.platforms.find((p) => p.platform === "Uber")?.total, 100)
check("desglose Lyft", totals.platforms.find((p) => p.platform === "Lyft")?.total, 50.5)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
