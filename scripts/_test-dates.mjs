// Pruebas de las fechas del DÍA DEL CONDUCTOR (hora local).
//
// Nacen de un error real: las fechas se sacaban en UTC, así que en Nueva York
// (UTC-4) todo lo posterior a las 20:00 quedaba fechado al día siguiente y el
// panorama semanal de FINANCE mostraba "INGRESO REAL $0.00".
//
// Se fija la zona horaria a Nueva York ANTES de importar los módulos, porque el
// error solo aparece con desfase respecto a UTC.
process.env.TZ = "America/New_York"

import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "dates-test-"))

for (const f of ["types.ts", "geo.ts"]) {
  cpSync(join(ROOT, "components", "copiloto", f), join(tmp, f))
}
cpSync(join(ROOT, "lib", "dates.ts"), join(tmp, "dates.ts"))
cpSync(join(ROOT, "lib", "production.ts"), join(tmp, "production.ts"))

// types.ts y geo.ts usan el alias "@/lib/dates".
for (const f of ["types.ts", "geo.ts"]) {
  const p = join(tmp, f)
  writeFileSync(p, readFileSync(p, "utf8").replace(/"@\/lib\/dates"/g, '"./dates"'))
}

execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "types.ts"),
    join(tmp, "dates.ts"),
    join(tmp, "production.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)

// Node ESM exige la extensión en los imports.
for (const name of ["types", "dates", "production"]) {
  const js = join(tmp, `${name}.js`)
  writeFileSync(
    js,
    readFileSync(js, "utf8")
      .replace(/from "\.\/dates"/g, 'from "./dates.mjs"')
      .replace(/from "\.\/types"/g, 'from "./types.mjs"'),
  )
  renameSync(js, join(tmp, `${name}.mjs`))
}

const { localDateKey, addDaysToKey, localTimeLabel } = await import(pathToFileURL(join(tmp, "dates.mjs")).href)
const { tripDateOf, newExpense } = await import(pathToFileURL(join(tmp, "types.mjs")).href)
const { productionThisHour } = await import(pathToFileURL(join(tmp, "production.mjs")).href)

let passed = 0
let failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(esperado)
  if (a === e) {
    passed++
    console.log(`  ok   ${nombre}`)
  } else {
    failed++
    console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`)
  }
}

console.log("\n== LA HORA LOCAL MANDA (el error de las 20:00) ==")
// 2026-09-29T02:06Z son las 22:06 del 28 en Nueva York.
const tarde = new Date("2026-09-29T02:06:00.000Z")
check("las 22:06 de Nueva York son del dia 28", localDateKey(tarde), "2026-09-28")
check("y NO del 29 (lo que hacia UTC)", tarde.toISOString().slice(0, 10), "2026-09-29")
check("la hora local es 22:06", localTimeLabel(tarde), "22:06")
check("mediodia UTC sigue siendo el mismo dia", localDateKey(new Date("2026-09-28T16:00:00.000Z")), "2026-09-28")
check("madrugada UTC es el dia anterior en NY", localDateKey(new Date("2026-09-28T03:00:00.000Z")), "2026-09-27")

console.log("\n== CLAVES DE FECHA ==")
check("acepta milisegundos", localDateKey(new Date("2026-12-31T23:30:00.000Z").getTime()), "2026-12-31")
check("acepta cadena ISO", localDateKey("2026-01-05T12:00:00.000Z"), "2026-01-05")
check("basura cae a hoy", localDateKey("no-es-fecha"), localDateKey(new Date()))
check("suma un dia", addDaysToKey("2026-09-28", 1), "2026-09-29")
check("cruce de mes", addDaysToKey("2026-09-30", 1), "2026-10-01")
check("cruce de año", addDaysToKey("2026-12-31", 1), "2027-01-01")
check("resta dias", addDaysToKey("2026-03-01", -1), "2026-02-28")
check("clave invalida se devuelve igual", addDaysToKey("", 1), "")

console.log("\n== LA FECHA DEL VIAJE ES LA DEL CONDUCTOR ==")
const viajeTarde = { raw: { datetime: "2026-09-29T02:06:00.000Z" } }
check("viaje de las 22:06 cuenta el dia 28", tripDateOf(viajeTarde), "2026-09-28")
const viajeMediodia = { raw: { datetime: "2026-09-28T16:00:00.000Z" } }
check("viaje de mediodia cuenta el dia 28", tripDateOf(viajeMediodia), "2026-09-28")
check("viaje sin fecha usa hoy", tripDateOf({ raw: {} }), localDateKey(new Date()))
check("gasto nuevo nace con la fecha local", newExpense().date, localDateKey(new Date()))

console.log("\n== PRODUCCION DE ESTA HORA CON FECHA LOCAL ==")
// A las 22:30 de Nueva York, un viaje de las 22:00 es de HOY, no de mañana.
const ahora = new Date(2026, 8, 28, 22, 30, 0)
const viajes = [
  { date: "2026-09-28", time: "22:10", net: 40 },
  { date: "2026-09-29", time: "22:20", net: 99 },
]
check("suma el viaje de hoy a las 22:00", productionThisHour(viajes, ahora), 40)
const ahoraMediodia = new Date(2026, 8, 28, 12, 30, 0)
check(
  "a mediodia no confunde horas",
  productionThisHour([{ date: "2026-09-28", time: "12:05", net: 25 }], ahoraMediodia),
  25,
)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
