// Pruebas de producción por hora y plan realista.
// Ejecutar: node scripts/_test-production.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, renameSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "production-test-"))

// Se compilan los dos archivos: production.ts ahora usa la clave de fecha local
// de lib/dates.ts, así que hay que llevarlo también al directorio temporal.
cpSync(join(ROOT, "lib", "production.ts"), join(tmp, "production.ts"))
cpSync(join(ROOT, "lib", "dates.ts"), join(tmp, "dates.ts"))
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "production.ts"),
    join(tmp, "dates.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
renameSync(join(tmp, "production.js"), join(tmp, "production.mjs"))
renameSync(join(tmp, "dates.js"), join(tmp, "dates.mjs"))

// Node exige la extensión en los imports de ESM.
{
  const salida = join(tmp, "production.mjs")
  const src = readFileSync(salida, "utf8").replace('from "./dates"', 'from "./dates.mjs"')
  writeFileSync(salida, src)
}

const {
  hourWindow,
  productionThisHour,
  hourlyAdvice,
  planToCover,
  timerReading,
  addWorkedSeconds,
  commitWorkedRange,
  trimWorked,
  hourlyStats,
  hourlyTotals,
  improveAdvice,
} = await import(pathToFileURL(join(tmp, "production.mjs")).href)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

console.log("\n== VENTANA DE LA HORA (el cronómetro se reinicia cada hora) ==")
const t1530 = new Date("2026-09-26T15:30:00")
const w1 = hourWindow(t1530)
check("hora 15", w1.hour, 15)
check("etiqueta", w1.label, "15:00 – 16:00")
check("transcurridos 30", w1.elapsedMin, 30)
check("quedan 30", w1.remainingMin, 30)
const w2 = hourWindow(new Date("2026-09-26T15:00:05"))
check("a los 5 segundos quedan 60", w2.remainingMin, 60)
check("a los 5 segundos transcurridos 0", w2.elapsedMin, 0)
const w3 = hourWindow(new Date("2026-09-26T15:59:30"))
check("al final transcurridos 59", w3.elapsedMin, 59)
check("al final queda 1", w3.remainingMin, 1)
const w4 = hourWindow(new Date("2026-09-26T23:30:00"))
check("ultima hora del dia", w4.label, "23:00 – 00:00")

console.log("\n== PRODUCCION DE LA HORA ==")
const trips = [
  { date: "2026-09-26", time: "15:05", net: 20 },
  { date: "2026-09-26", time: "15:45", net: 35 },
  { date: "2026-09-26", time: "14:50", net: 99 }, // otra hora, no cuenta
  { date: "2026-09-25", time: "15:10", net: 99 }, // otro dia, no cuenta
  { date: "2026-09-26", time: "15:20", net: -5 }, // negativo, no cuenta
]
check("suma solo la hora en curso", productionThisHour(trips, t1530), 55)
check("hora sin viajes", productionThisHour(trips, new Date("2026-09-26T10:00:00")), 0)

console.log("\n== SUGERENCIA: meta cumplida ==")
const a1 = hourlyAdvice(60, { elapsedMin: 30, remainingMin: 30 }, 55)
check("tono goal-met", a1.tone, "goal-met")
check("onTrack", a1.onTrack, true)
check("ritmo 120/h", a1.projectedRate, 120)

console.log("\n== SUGERENCIA: on track ==")
const a2 = hourlyAdvice(30, { elapsedMin: 30, remainingMin: 30 }, 55)
check("ritmo 60/h", a2.projectedRate, 60)
check("onTrack", a2.onTrack, true)
check("tono on-track", a2.tone, "on-track")
check("faltan 25", a2.remainingToGoal, 25)

console.log("\n== SUGERENCIA: alcanzable ==")
// $20 en 30 min (ritmo 40/h) y faltan $35 en 30 min -> necesita 70/h (<= 55*1.3=71.5)
const a3 = hourlyAdvice(20, { elapsedMin: 30, remainingMin: 30 }, 55)
check("tono reachable", a3.tone, "reachable")
check("necesita 70/h", a3.neededRate, 70)

console.log("\n== SUGERENCIA REALISTA: imposible forzarlo ==")
// $5 en 50 min, faltan $50 en 10 min -> necesita 300/h (muy por encima)
const a4 = hourlyAdvice(5, { elapsedMin: 50, remainingMin: 10 }, 55)
check("tono hard", a4.tone, "hard")
check("necesitaria 300/h", a4.neededRate, 300)
check("el mensaje avisa que no es realista", a4.message.includes("No es realista"), true)

console.log("\n== SUGERENCIA: hora cerrada ==")
const a5 = hourlyAdvice(40, { elapsedMin: 60, remainingMin: 0 }, 55)
check("tono hard al cerrar", a5.tone, "hard")
check("menciona lo que falta", a5.message.includes("15.00"), true)

console.log("\n== SIN BASE PARA PROYECTAR (primeros minutos) ==")
const a6 = hourlyAdvice(0, { elapsedMin: 1, remainingMin: 59 }, 55)
check("ritmo nulo", a6.projectedRate, null)

console.log("\n== PLAN REALISTA PARA CUBRIR ==")
const p1 = planToCover({ shortfall: 110, goalRate: 55, hoursPerDay: 8, daysUntilDue: 7 })
check("2 horas necesarias", p1.hoursNeeded, 2)
check("1 dia necesario", p1.daysNeeded, 1)
check("alcanzable", p1.feasible, true)
check("meta diaria 15.71", p1.dailyTarget, 15.71)
check("mensaje con alcanzable", p1.message.includes("alcanzable"), true)

const p2 = planToCover({ shortfall: 800, goalRate: 55, hoursPerDay: 8, daysUntilDue: 1 })
check("15 horas necesarias", p2.hoursNeeded, 15)
check("2 dias necesarios", p2.daysNeeded, 2)
check("NO alcanzable en 1 dia", p2.feasible, false)
check("el mensaje avisa que esta ajustado", p2.message.includes("ajustado"), true)
check("no promete lo imposible", p2.message.includes("Divide el pago"), true)

const p3 = planToCover({ shortfall: 0, goalRate: 55, daysUntilDue: 3 })
check("sin faltante no hay plan", p3.hoursNeeded, 0)
check("cubierto", p3.feasible, true)

const p4 = planToCover({ shortfall: 600, goalRate: 60, hoursPerDay: 10, daysUntilDue: 2 })
check("10 horas a 60/h", p4.hoursNeeded, 10)
check("1 dia de 10h", p4.daysNeeded, 1)
check("cabe en 2 dias", p4.feasible, true)
check("meta diaria 300", p4.dailyTarget, 300)

const p5 = planToCover({ shortfall: 200, goalRate: 0, daysUntilDue: 5 })
check("meta 0 cae a 55/h por defecto", p5.goalRate, 55)
check("4 horas", p5.hoursNeeded, 4)

console.log("\n== CRONOMETRO: ENCENDER, PARAR Y VOLVER A CERO ==")
const at = (h, m, s = 0) => new Date(2026, 8, 27, h, m, s)

// Encendido a mitad de hora: cuenta desde que se encendio, no desde el minuto 0.
const aMitad = timerReading({ now: at(15, 40, 30), on: true, startedAt: at(15, 25).getTime() })
check("encendido a las 15:25, a las 15:40:30 lleva 15:30", aMitad.elapsedSec, 15 * 60 + 30)
check("esta corriendo", aMitad.running, true)
check("le quedan 45 min del bloque", aMitad.remainingMin, 45)

// Encendido sin marca (primer uso): el bloque arranca en el minuto 0 de la hora.
const sinMarca = timerReading({ now: at(15, 40, 30), on: true, startedAt: null })
check("sin marca arranca en el minuto 0", sinMarca.elapsedSec, 40 * 60 + 30)

// Venia de una hora anterior: el bloque nuevo arranca en cero al caer la hora.
const nuevaHora = timerReading({ now: at(16, 12), on: true, startedAt: at(15, 20).getTime() })
check("cada 60 minutos vuelve a cero", nuevaHora.elapsedSec, 12 * 60)
check("y le quedan 48 min", nuevaHora.remainingMin, 48)

// APAGADO: vuelve a cero.
const apagado = timerReading({ now: at(15, 52), on: false, startedAt: at(15, 25).getTime() })
check("apagado vuelve a cero", apagado.elapsedSec, 0)
check("apagado no corre", apagado.running, false)

// Tope: el bloque nunca pasa de 60 minutos (a las 17:59:59 marca 59:59).
const tope = timerReading({ now: at(16, 30), on: true, startedAt: at(16, 0).getTime() })
check("a los 30 min del bloque lleva 30:00", tope.elapsedSec, 1800)
const topeMax = timerReading({ now: at(17, 59, 59), on: true, startedAt: at(16, 30).getTime() })
check("el bloque se corta en 59:59", topeMax.elapsedSec, 3599)

console.log("\n== MINUTOS TRABAJADOS POR HORA (se guardan) ==")
const wk1 = addWorkedSeconds({}, "2026-09-27T15", 600)
check("suma 10 min", wk1["2026-09-27T15"], 600)
const wk2 = addWorkedSeconds(wk1, "2026-09-27T15", 900)
check("acumula en la misma hora", wk2["2026-09-27T15"], 1500)
const wk3 = addWorkedSeconds(wk2, "2026-09-27T15", 9000)
check("no pasa de 60 min por hora", wk3["2026-09-27T15"], 3600)
check("ignora valores basura", addWorkedSeconds(wk3, "2026-09-27T16", -50), wk3)
check("ignora cero", Object.keys(addWorkedSeconds({}, "2026-09-27T16", 0)).length, 0)

// Un bloque que cruza la hora en punto se reparte entre las dos horas.
const cruce = commitWorkedRange({}, at(15, 50).getTime(), at(16, 10).getTime())
check("10 min en la hora 15", cruce["2026-09-27T15"], 600)
check("10 min en la hora 16", cruce["2026-09-27T16"], 600)
// Rango invertido o vacio: no cambia nada.
check("rango invertido no cambia", commitWorkedRange({}, at(16, 10).getTime(), at(15, 50).getTime()), {})
check("rango vacio no cambia", commitWorkedRange({}, at(15, 50).getTime(), at(15, 50).getTime()), {})

const viejo = trimWorked({ "2026-08-01T09": 600, "2026-09-27T09": 1200 }, at(15, 0), 30)
check("la estadistica vieja se recorta", Object.keys(viejo).length, 1)
check("y se queda la reciente", viejo["2026-09-27T09"], 1200)

console.log("\n== ESTADISTICA POR HORA DE TRABAJO ==")
const viajes = [
  { date: "2026-09-27", time: "08:35", net: 60 },
  { date: "2026-09-27", time: "08:50", net: 20 },
  { date: "2026-09-27", time: "09:10", net: 40 },
  { date: "2026-09-27", time: "11:05", net: 30 },
]
const trabajado = { "2026-09-27T08": 1800, "2026-09-27T09": 3600, "2026-09-27T10": 1200 }
const stats = hourlyStats({ trips: viajes, worked: trabajado })
check("horas con viajes o tiempo", stats.length, 4)
check("mas reciente primero", stats[0].key, "2026-09-27T11")
const h8 = stats.find((s) => s.key === "2026-09-27T08")
check("hora 8 produjo 80", h8.produced, 80)
check("hora 8 trabajo 30 min", h8.workedMin, 30)
check("hora 8 ritmo 160/h", h8.rate, 160)
const h10 = stats.find((s) => s.key === "2026-09-27T10")
check("hora 10 sin viajes produce 0", h10.produced, 0)
check("hora 10 ritmo 0/h", h10.rate, 0)
const h11 = stats.find((s) => s.key === "2026-09-27T11")
check("hora 11 sin tiempo medido", h11.workedMin, 0)
check("hora 11 ritmo nulo", h11.rate, null)
check("etiqueta de la hora", h8.label, "08:00 – 09:00")

const soloHoy = hourlyStats({ trips: viajes, worked: trabajado, day: "2026-09-27" })
check("filtro por dia", soloHoy.length, 4)
check("otro dia no trae nada", hourlyStats({ trips: viajes, worked: trabajado, day: "2026-09-26" }).length, 0)

const totales = hourlyTotals(stats, 55)
check("total producido 150", totales.produced, 150)
check("total minutos medidos 110", totales.workedMin, 110)
check("ritmo del conjunto 81.82/h", totales.rate, 81.82)
check("horas medidas", totales.measuredHours, 3)
check("horas que llegan a la meta", totales.goalHours, 1)
check("mejor hora es la 8", totales.best.key, "2026-09-27T08")

console.log("\n== COMO MEJORAR (honesto) ==")
const sinBase = improveAdvice({ stats: [h8], goalRate: 55 })
check("sin base avisa que falta medir", sinBase.length, 1)
check("y dice que deje el cronometro", sinBase[0].detail.includes("cronómetro encendido"), true)
check("no promete nada imposible", sinBase[0].title.includes("no hay base"), true)

const porEncima = improveAdvice({ stats, goalRate: 55 })
check("el conjunto va por encima de 55", porEncima[0].title.includes("por encima de tu meta"), true)
check("da su ritmo real", porEncima[0].title.includes("$82/h"), true)

const porDebajo = improveAdvice({ stats, goalRate: 120 })
check("con meta 120 va por debajo", porDebajo[0].title.includes("Te faltan"), true)
check("y senala la mejor hora como referencia", porDebajo[0].detail.includes("mejor hora"), true)

// Ni la mejor hora llega: se dice claro, sin pedir lo imposible.
const imposible = improveAdvice({ stats, goalRate: 200 })
check("avisa que la mejor hora tampoco llega", imposible[0].title.includes("tampoco llegó"), true)
check("y dice que forzar no es realista", imposible[0].detail.includes("no es realista"), true)
check("sugiere mas horas o viajes largos", imposible[0].detail.includes("viajes más largos"), true)

// Horas con produccion pero sin cronometro: la estadistica sale incompleta.
// (Hacen falta al menos 2 horas medidas para que haya consejos que comparar.)
const sinMedir = improveAdvice({
  stats: hourlyStats({ trips: viajes, worked: { "2026-09-27T08": 600, "2026-09-27T09": 600 } }),
  goalRate: 55,
})
check("avisa de horas sin tiempo medido", sinMedir.some((t) => t.title.includes("sin tiempo medido")), true)

// Mejor franja del dia: se calcula con el historial.
const historial = [
  { key: "2026-09-26T07", day: "2026-09-26", hour: 7, label: "07:00 – 08:00", produced: 90, workedMin: 60, rate: 90 },
  { key: "2026-09-26T18", day: "2026-09-26", hour: 18, label: "18:00 – 19:00", produced: 40, workedMin: 60, rate: 40 },
  { key: "2026-09-25T07", day: "2026-09-25", hour: 7, label: "07:00 – 08:00", produced: 80, workedMin: 60, rate: 80 },
  { key: "2026-09-25T18", day: "2026-09-25", hour: 18, label: "18:00 – 19:00", produced: 50, workedMin: 60, rate: 50 },
]
const franja = improveAdvice({ stats: historial, goalRate: 55 })
check("detecta la mejor franja (07:00)", franja.some((t) => t.title.includes("07:00")), true)
check("como maximo 3 consejos", franja.length <= 3, true)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
