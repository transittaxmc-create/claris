// Pruebas de la lógica de reconciliación y del desglose por plataforma.
// Se ejecuta con: node scripts/_test-reconciliation.mjs
//
// reconciliation.ts es TypeScript puro (sin React ni DOM), así que se traduce
// con el tsc que ya trae el proyecto y se importa desde Node. Así se prueba el
// código real, no una copia. Sin dependencias nuevas.

import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

// La raíz del proyecto se deduce de la ubicación de este archivo, para que el
// test funcione desde cualquier directorio de trabajo.
const ROOT = resolve(import.meta.dirname, "..")
const SRC = join(ROOT, "components", "copiloto")

const tmp = mkdtempSync(join(tmpdir(), "recon-test-"))
// Se copian los módulos a un temporal porque el tsc de un solo archivo no
// resuelve el alias "@/" que usa storage.ts (que aquí no hace falta). geo.ts
// solo declara tipos, así que se copia para que types.ts resuelva su import.
for (const file of ["reconciliation.ts", "types.ts", "geo.ts"]) {
  cpSync(join(SRC, file), join(tmp, file))
}
// types.ts y geo.ts usan la clave de fecha local de lib/dates.
cpSync(join(ROOT, "lib", "dates.ts"), join(tmp, "dates.ts"))

for (const f of ["types.ts", "geo.ts", "dates.ts"]) {
  try {
    const p = join(tmp, f)
    writeFileSync(p, readFileSync(p, "utf8").replace(/"@\/lib\/dates"/g, '"./dates"'))
  } catch {}
}
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "reconciliation.ts"),
    join(tmp, "dates.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    // types.ts usa crypto.randomUUID, que vive en los tipos del DOM.
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)

// El tsc deja los imports sin extensión, que Node ESM no resuelve: se añade
// ".mjs" y se renombran los archivos para que Node los trate como módulos.
for (const name of ["types", "reconciliation", "dates"]) {
  const js = join(tmp, `${name}.js`)
  writeFileSync(
    js,
    readFileSync(js, "utf8")
      .replace(/from "\.\/types"/g, 'from "./types.mjs"')
      .replace(/from "\.\/dates"/g, 'from "./dates.mjs"'),
  )
  renameSync(js, join(tmp, `${name}.mjs`))
}

const R = await import(pathToFileURL(join(tmp, "reconciliation.mjs")).href)
const { expectedOf, receivedOf, diffOf, reconStateOf, groupByPlatform, reconSummary, sortTrips, applyDifferenceToTrip, applyBankMatchesToTrips, round2, buildPlatformGroup } = R

let passed = 0
let failed = 0

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed += 1
    console.log(`  ok   ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL ${name}\n       esperado ${e}\n       obtenido ${a}`)
  }
}

// Viaje de prueba: net = earnings + extraCash + tips + toll − platformFee
function trip(over = {}) {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    platform: over.platform ?? "Uber",
    isVoucher: false,
    earnings: over.earnings ?? 100,
    extraCash: over.extraCash ?? 0,
    tips: over.tips ?? 0,
    toll: over.toll ?? 0,
    platformFee: over.platformFee ?? 0,
    pickup: "",
    dropoff: "",
    time: over.time ?? "10:00",
    ref: "",
    status: over.status ?? "pending",
    ...(over.reconciliation ? { reconciliation: over.reconciliation } : {}),
  }
}

console.log("\n== neto esperado ==")
check("sin override usa el neto calculado", expectedOf(trip({ earnings: 85.66 })), 85.66)
check("resta platformFee", expectedOf(trip({ earnings: 100, platformFee: 15.5 })), 84.5)
check("suma extraCash, tips y toll", expectedOf(trip({ earnings: 10, extraCash: 1, tips: 2, toll: 3 })), 16)
check("override manda sobre el cálculo", expectedOf(trip({ earnings: 100, reconciliation: { expected: 92.25 } })), 92.25)

console.log("\n== estado de reconciliación ==")
check("sin recibido -> pending", reconStateOf(trip()), "pending")
check("recibido igual -> ok", reconStateOf(trip({ earnings: 100, reconciliation: { received: 100 } })), "ok")
check("recibido menor -> short", reconStateOf(trip({ earnings: 100, reconciliation: { received: 95 } })), "short")
check("recibido mayor -> over", reconStateOf(trip({ earnings: 100, reconciliation: { received: 103 } })), "over")
check("diferencia de medio centavo -> ok (tolerancia)", reconStateOf(trip({ earnings: 100, reconciliation: { received: 100.004 } })), "ok")
check("un centavo ya cuenta -> short", reconStateOf(trip({ earnings: 100, reconciliation: { received: 99.99 } })), "short")

console.log("\n== diferencia ==")
check("diferencia negativa", diffOf(trip({ earnings: 100, reconciliation: { received: 95 } })), -5)
check("diferencia positiva", diffOf(trip({ earnings: 100, reconciliation: { received: 103 } })), 3)
check("sin recibido la diferencia es 0", diffOf(trip()), 0)
check("no arrastra ruido de coma flotante", diffOf(trip({ earnings: 0.1, extraCash: 0.2, reconciliation: { received: 0.3 } })), 0)

console.log("\n== resumen agregado ==")
const set = [
  trip({ id: "a", earnings: 100, reconciliation: { received: 100 } }), // ok
  trip({ id: "b", earnings: 50, reconciliation: { received: 45 } }), // short −5
  trip({ id: "c", earnings: 20, reconciliation: { received: 22 } }), // over +2
  trip({ id: "d", earnings: 30 }), // pending
]
const s = reconSummary(set)
check("esperado total", s.expected, 200)
check("recibido solo de reconciliados", s.received, 167)
check("diferencia agregada ignora pendientes", s.diff, -3)
check("conteo pendientes", s.pendingCount, 1)
check("conteo short", s.shortCount, 1)
check("conteo over", s.overCount, 1)
check("conteo ok", s.okCount, 1)
check("problemas = short + over", s.problemCount, 2)

console.log("\n== agrupación por plataforma ==")
const mixed = [
  trip({ id: "1", platform: "Uber", earnings: 100 }),
  trip({ id: "2", platform: "Uber", earnings: 50, reconciliation: { received: 48 } }),
  trip({ id: "3", platform: "Lyft", earnings: 40, reconciliation: { received: 40 } }),
  trip({ id: "4", platform: "Avis", earnings: 25 }), // plataforma fuera de PLATFORMS
]
const groups = groupByPlatform(mixed)
check("plataformas detectadas, canónicas primero", groups.map((g) => g.platform), ["Uber", "Lyft", "Avis"])
check("Uber tiene 2 viajes", groups[0].count, 2)
check("Uber bruto", groups[0].gross, 150)
check("Uber neto", groups[0].net, 150)
check("Uber esperado", groups[0].expected, 150)
check("Uber recibido (solo reconciliados)", groups[0].received, 48)
check("Uber diferencia", groups[0].diff, -2)
check("Uber pendientes", groups[0].pendingCount, 1)
check("Lyft cuadra", groups[1].diff, 0)
check("una plataforma desconocida no se pierde", groups[2].platform, "Avis")
check("su total sí se cuenta", groups[2].gross, 25)
check("se descartan plataformas sin viajes", groups.length, 3)

// El orden canónico manda aunque los datos lleguen desordenados.
const shuffled = groupByPlatform([
  trip({ id: "a", platform: "Other", earnings: 5 }),
  trip({ id: "b", platform: "Cash", earnings: 5 }),
  trip({ id: "c", platform: "Uber", earnings: 5 }),
  trip({ id: "d", platform: "Lyft", earnings: 5 }),
  trip({ id: "e", platform: "Aventus Ride", earnings: 5 }),
  trip({ id: "f", platform: "Eco Ride", earnings: 5 }),
  trip({ id: "g", platform: "Throo", earnings: 5 }),
  trip({ id: "h", platform: "AKI Technology", earnings: 5 }),
  trip({ id: "i", platform: "Classic Ryde", earnings: 5 }),
])
check(
  "orden canónico de PLATFORMS",
  shuffled.map((g) => g.platform),
  ["Uber", "Lyft", "Eco Ride", "Throo", "AKI Technology", "Classic Ryde", "Aventus Ride", "Cash", "Other"],
)

console.log("\n== orden ==")
const forSort = [
  trip({ id: "x", earnings: 10, time: "09:00" }),
  trip({ id: "y", earnings: 90, time: "18:00" }),
  trip({ id: "z", earnings: 50, time: "13:00" }),
]
check("por monto, mayor primero", sortTrips(forSort, "amount").map((t) => t.id), ["y", "z", "x"])
check("por hora, más reciente primero", sortTrips(forSort, "time").map((t) => t.id), ["y", "z", "x"])
check("no muta el array original", forSort.map((t) => t.id), ["x", "y", "z"])

console.log("\n== ajuste automático ==")
const short = trip({ earnings: 100, reconciliation: { received: 95 } })
const fixed = applyDifferenceToTrip(short)
check("earnings ajustado para cuadrar", fixed.earnings, 95)
check("tras ajustar, la diferencia es 0", diffOf(fixed), 0)
check("tras ajustar, el estado es ok", reconStateOf(fixed), "ok")
check("el original no se muta", short.earnings, 100)
const over = applyDifferenceToTrip(trip({ earnings: 100, reconciliation: { received: 103 } }))
check("también ajusta cuando pagaron de más", over.earnings, 103)
const pending = trip({ earnings: 100 })
check("sin recibido no toca nada", applyDifferenceToTrip(pending), pending)
check("si ya cuadra devuelve el mismo objeto", applyDifferenceToTrip(trip({ earnings: 100, reconciliation: { received: 100 } })).earnings, 100)

console.log("\n== redondeo ==")
check("round2 de 0.1+0.2", round2(0.1 + 0.2), 0.3)
check("round2 de 1.005", round2(1.005), 1.01)
check("round2 de negativo", round2(-2.345), -2.35)

console.log("\n== estado conciliado ==")
check("un pago que cuadra cuenta como conciliado", R.reconciliationMatches(trip({ earnings: 100, reconciliation: { received: 100 } })), true)
check("un pago que no cuadra no", R.reconciliationMatches(trip({ earnings: 100, reconciliation: { received: 99 } })), false)
check("sin pago tampoco", R.reconciliationMatches(trip({ earnings: 100 })), false)

console.log("\n== normalización del status al guardar ==")
check("pago que cuadra -> matched", R.normalizeTripStatus(trip({ earnings: 100, status: "pending", reconciliation: { received: 100 } })).status, "matched")
check("pago que no cuadra -> sigue pending", R.normalizeTripStatus(trip({ earnings: 100, status: "pending", reconciliation: { received: 90 } })).status, "pending")
check("sin pago -> pending", R.normalizeTripStatus(trip({ earnings: 100, status: "pending" })).status, "pending")
check("marcado a mano se respeta", R.normalizeTripStatus(trip({ earnings: 100, status: "matched" })).status, "matched")
const unchanged = trip({ earnings: 100, status: "pending" })
check("si no cambia, devuelve el mismo objeto", R.normalizeTripStatus(unchanged) === unchanged, true)

console.log("\n== conciliación bancaria: aplicar matches de la IA ==")
const bancarios = [
  trip({ id: "b1", earnings: 85.66 }),
  trip({ id: "b2", earnings: 38.04 }),
  trip({ id: "b3", earnings: 54 }),
]
const r1 = applyBankMatchesToTrips(bancarios, [
  { tripId: "b1", amount: 85.66 },
  { tripId: "b2", amount: 30 }, // pagaron de menos
])
check("aplica los dos matches", r1.applied, 2)
check("b1 recibido exacto -> matched", r1.trips[0].reconciliation.received, 85.66)
check("b1 status matched", r1.trips[0].status, "matched")
check("b2 recibido 30 (de menos) -> pending", r1.trips[1].status, "pending")
check("b2 diferencia visible", diffOf(r1.trips[1]), -8.04)
check("b3 intacto sin recibido", receivedOf(r1.trips[2]), null)
check("b3 sin tocar status", r1.trips[2].status, "pending")
check("total aplicado", r1.appliedTotal, 115.66)
check("match con id inexistente no cuenta", applyBankMatchesToTrips(bancarios, [{ tripId: "no-existe", amount: 10 }]).applied, 0)
check("match con monto inválido se ignora", applyBankMatchesToTrips(bancarios, [{ tripId: "b1", amount: "abc" }]).applied, 0)
check("sin matches no toca nada", applyBankMatchesToTrips(bancarios, []).trips, bancarios)

rmSync(tmp, { recursive: true, force: true })

console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
