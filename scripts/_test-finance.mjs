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

const { groupRealTrips, applyTripsToDays, computeRealWeekTotals, weekdayAverages, computePanorama } = await import(
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

console.log("\n== PROYECCION POR DIA DE LA SEMANA ==")
// Tres lunes con 100, 200 y 300 -> promedio 200
const historico = [
  { date: "2026-09-07", platform: "Uber", net: 100 }, // lunes
  { date: "2026-09-14", platform: "Uber", net: 200 }, // lunes
  { date: "2026-09-21", platform: "Uber", net: 300 }, // lunes
  { date: "2026-09-08", platform: "Lyft", net: 50 }, // martes
  { date: "2026-09-15", platform: "Lyft", net: 150 }, // martes
]
const avgs = weekdayAverages(historico)
check("promedio lunes 200", avgs.mon, 200)
check("promedio martes 100", avgs.tue, 100)
check("miercoles sin dato", avgs.wed, undefined)
check("viajes negativos no cuentan", weekdayAverages([{ date: "2026-09-07", platform: "Uber", net: -5 }]).mon, undefined)

console.log("\n== PANORAMA: balance real + cobertura de pagos ==")
// Semana lun-dom 2026-09-28..2026-10-04
const semana = [
  day("d1", "2026-09-28", { Uber: { actual: 120 } }),
  day("d2", "2026-09-29"),
  day("d3", "2026-09-30", { Uber: { actual: 80 } }),
]
const panorama = computePanorama({
  startingBalance: 100,
  days: semana,
  scheduled: [{ description: "Geico", amount: 400, nextDate: "2026-09-29" }],
  expenses: [{ date: "2026-09-28", amount: 30 }],
  trips: historico,
})
// d1: 100 + 120 real − 30 gasto = 190
// d2: 190 + 100 proyectado − 400 pago = −110
// d3: −110 + 80 real = −30
check("ingreso real semana 200", panorama.weekIncomeReal, 200)
check("gastos semana 30", panorama.weekExpenses, 30)
check("pagos semana 400", panorama.weekPayments, 400)
check("balance final -30", panorama.finalBalance, -30)
check("no cubre", panorama.covered, false)
check("faltante 110", panorama.shortfall, 110)
check("dia 1 con pago de 400", panorama.days[1].payments[0].description, "Geico")
check("dia 1 en rojo", panorama.days[1].belowZero, true)
check("dia 2 en rojo tambien", panorama.days[2].belowZero, true)
check("dia 0 sano", panorama.days[0].belowZero, false)
// Martes proyectado desde historico (sin real): promedio martes 100
check("dia 2 proyectado 100", panorama.days[1].projectedIncome, 100)
check("dia con real no proyecta", panorama.days[0].projectedIncome, 0)

console.log("\n== PANORAMA CON COBERTURA ==")
const cubierto = computePanorama({
  startingBalance: 500,
  days: semana,
  scheduled: [{ description: "Geico", amount: 150, nextDate: "2026-09-29" }],
  expenses: [],
  trips: historico,
})
check("con saldo alto cubre", cubierto.covered, true)
check("sin faltante", cubierto.shortfall, 0)
check("balance final positivo", cubierto.finalBalance > 0, true)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
