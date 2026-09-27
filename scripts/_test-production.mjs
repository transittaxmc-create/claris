// Pruebas de producción por hora y plan realista.
// Ejecutar: node scripts/_test-production.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, renameSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "production-test-"))

cpSync(join(ROOT, "lib", "production.ts"), join(tmp, "production.ts"))
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
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
renameSync(join(tmp, "production.js"), join(tmp, "production.mjs"))

const { hourWindow, productionThisHour, hourlyAdvice, planToCover, timerReading } = await import(
  pathToFileURL(join(tmp, "production.mjs")).href
)

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

console.log("\n== CRONOMETRO: ENCENDIDO Y APAGADO ==")
// 15:40:30 — encendido, corre con el reloj de la hora.
const at = (h, m, s = 0, ms = 0) => new Date(2026, 8, 27, h, m, s, ms)
const encendido = timerReading({ now: at(15, 40, 30), on: true, stoppedAt: null })
check("encendido cuenta 40:30", encendido.elapsedSec, 40 * 60 + 30)
check("encendido esta corriendo", encendido.running, true)
check("encendido quedan 20 min", encendido.remainingMin, 20)

// Apagado a las 15:40:00 y mirado a las 15:52: el reloj NO avanza.
const apagado = timerReading({ now: at(15, 52), on: false, stoppedAt: at(15, 40).getTime() })
check("apagado se congela en 40:00", apagado.elapsedSec, 40 * 60)
check("apagado no corre", apagado.running, false)
check("apagado conserva lo trabajado", apagado.remainingMin, 20)

// Apagado en una hora anterior: la hora nueva empieza en cero, no arrastra.
const horaNueva = timerReading({ now: at(16, 5), on: false, stoppedAt: at(15, 40).getTime() })
check("hora nueva arranca en cero", horaNueva.elapsedSec, 0)
check("hora nueva no corre", horaNueva.running, false)

// Apagado sin marca de tiempo (por ejemplo tras limpiar la memoria): cero.
const sinMarca = timerReading({ now: at(15, 52), on: false, stoppedAt: null })
check("sin marca de tiempo queda en cero", sinMarca.elapsedSec, 0)

// Apagado a mitad de hora: cuenta solo lo trabajado de esa hora.
const media = timerReading({ now: at(16, 45), on: false, stoppedAt: at(16, 30).getTime() })
check("apagado a las 16:30 cuenta 30 min", media.elapsedSec, 30 * 60)
check("y le quedan 30 min de hora", media.remainingMin, 30)

// Marca de tiempo posterior a la hora en curso (reloj movido): se corta en 60:00.
const tope = timerReading({ now: at(16, 30), on: false, stoppedAt: at(17, 5).getTime() })
check("nunca pasa de 60 min", tope.elapsedSec, 3600)
check("tope deja 0 min", tope.remainingMin, 0)

// Volver a encender: sigue contando la hora en curso desde el reloj real.
const reencendido = timerReading({ now: at(15, 45), on: true, stoppedAt: null })
check("al reencender sigue el reloj", reencendido.elapsedSec, 45 * 60)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
