// Prueba directa de la clasificación de lugares, sin navegador ni mocks.
// Se importa classify() del módulo real compilado con el tsc del proyecto, así
// que se prueba el mismo código que corre en la app.
//
// Ejecutar: node scripts/_test-classify.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "classify-test-"))

// geo.ts usa la clave de fecha local de lib/dates, así que se compilan los dos.
cpSync(join(ROOT, "components", "copiloto", "geo.ts"), join(tmp, "geo.ts"))
cpSync(join(ROOT, "lib", "dates.ts"), join(tmp, "dates.ts"))
writeFileSync(
  join(tmp, "geo.ts"),
  readFileSync(join(tmp, "geo.ts"), "utf8").replace(/"@\/lib\/dates"/g, '"./dates"'),
)
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "geo.ts"),
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
renameSync(join(tmp, "geo.js"), join(tmp, "geo.mjs"))
renameSync(join(tmp, "dates.js"), join(tmp, "dates.mjs"))
// Node ESM exige la extensión en los imports.
writeFileSync(
  join(tmp, "geo.mjs"),
  readFileSync(join(tmp, "geo.mjs"), "utf8").replace('from "./dates"', 'from "./dates.mjs"'),
)

const { __testClassify } = await import(pathToFileURL(join(tmp, "geo.mjs")).href)
const classify = __testClassify

let passed = 0
let failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

// Respuesta de Nominatim simulada
const nom = (cls, type, name, extra = {}) => ({
  class: cls, type, name,
  display_name: extra.display_name ?? `${name || "Direccion"}, New York`,
  address: { city: "New York", county: "New York County", postcode: "10001", ...(extra.address ?? {}) },
})

console.log("\n== RAMAS DE NEGOCIO (banner azul) ==")
const negocios = [
  ["restaurante", nom("amenity", "restaurant", "Joe's Pizza"), "🍽️", "Joe's Pizza"],
  ["café", nom("amenity", "cafe", "Starbucks"), "🍽️", "Starbucks"],
  ["comida rápida", nom("amenity", "fast_food", "McDonalds"), "🍽️", "McDonalds"],
  ["hospital", nom("amenity", "hospital", "Mount Sinai"), "🏥", "Mount Sinai"],
  ["clínica", nom("amenity", "clinic", "Urgent Care"), "🏥", "Urgent Care"],
  ["hotel", nom("tourism", "hotel", "The Plaza"), "🏨", "The Plaza"],
  ["hostal", nom("tourism", "hostel", "HI Hostel"), "🏨", "HI Hostel"],
  ["escuela", nom("amenity", "school", "PS 41"), "🏫", "PS 41"],
  ["universidad", nom("amenity", "university", "NYU"), "🏫", "NYU"],
  ["gasolinera", nom("amenity", "fuel", "Shell"), "⛽", "Shell"],
  ["supermercado", nom("shop", "supermarket", "Whole Foods"), "🛒", "Whole Foods"],
  ["centro comercial", nom("shop", "mall", "Queens Center"), "🛒", "Queens Center"],
  ["estación", nom("railway", "station", "Grand Central"), "🚉", "Grand Central"],
  ["oficina", nom("office", "company", "Acme Corp"), "🏢", "Acme Corp"],
]
for (const [etiqueta, data, icono, nombreEsperado] of negocios) {
  const r = classify(data)
  check(`${etiqueta}: kind=business`, r.kind, "business")
  check(`${etiqueta}: icono ${icono}`, r.icon, icono)
  check(`${etiqueta}: muestra el nombre`, r.categoryLabel, nombreEsperado)
  check(`${etiqueta}: banner azul`, r.banner, "blue")
}

console.log("\n== AEROPUERTO (kind y banner azul) ==")
const aero = classify(nom("aeroway", "aerodrome", "John F. Kennedy International Airport"))
check("kind=airport", aero.kind, "airport")
check("icono ✈️", aero.icon, "✈️")
check("banner azul", aero.banner, "blue")
check("muestra el nombre en título", aero.categoryLabel, "John F. Kennedy International Airport")

console.log("\n== RESIDENCIA (banner verde) ==")
const casa = classify(nom("place", "house", ""))
check("kind=residence", casa.kind, "residence")
check("icono 🏠", casa.icon, "🏠")
check("banner verde", casa.banner, "green")
check("sin nombre de negocio", casa.businessName, "")
const calle = classify(nom("highway", "residential", ""))
check("una calle sin nombre de vía tambien es residencia", calle.kind, "residence")
const parkway = classify(nom("highway", "motorway", "", { address: { road: "Southern State Parkway" } }))
check("parkway con nombre no es residencia", parkway.kind, "business")
check("parkway muestra el nombre de la vía", parkway.categoryLabel, "Southern State Parkway")
check("parkway icono 🛣️", parkway.icon, "🛣️")

console.log("\n== CASO LIMITE: edificio SIN nombre ==")
// Un building sin name cae a residencia: la rama de negocio exige `name`.
const edificio = classify(nom("building", "yes", ""))
check("building sin nombre -> residence", edificio.kind, "residence")
const edificioConNombre = classify(nom("building", "yes", "Empire State Building"))
check("building CON nombre -> business", edificioConNombre.kind, "business")
check("y usa el icono 🏢", edificioConNombre.icon, "🏢")

console.log("\n== CASO LIMITE: negocio SIN nombre usa etiqueta por defecto ==")
const sinNombre = classify(nom("amenity", "restaurant", ""))
check("restaurante sin nombre sigue siendo business", sinNombre.kind, "business")
check("con etiqueta de respaldo en título", sinNombre.categoryLabel, "Restaurante")
const sinNombreHospital = classify(nom("amenity", "hospital", ""))
check("hospital sin nombre", sinNombreHospital.categoryLabel, "Hospital")
const sinNombreTienda = classify(nom("shop", "supermarket", ""))
check("tienda sin nombre", sinNombreTienda.categoryLabel, "Tienda")

console.log("\n== PAYLOAD VACIO (fallo de geocodificacion) ==")
const vacio = classify({})
check("sin datos -> residence (verde, sin nombre)", vacio.kind, "residence")
check("banner verde", vacio.banner, "green")
check("nombre vacio", vacio.businessName, "")

console.log("\n== PRIORIDAD: aeropuerto gana sobre otras clases ==")
const jfkTerminal = classify({ class: "amenity", type: "terminal", name: "Terminal 4" })
check("terminal -> airport", jfkTerminal.kind, "airport")

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
