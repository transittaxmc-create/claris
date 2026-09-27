// Pruebas de la detección de gastos duplicados (findDuplicateExpense).
// Ejecutar: node scripts/_test-expenses.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "expenses-test-"))

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

const { findDuplicateExpense, normalizeVendorName, expenseCents } = await import(
  pathToFileURL(join(tmp, "types.mjs")).href
)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

// Gasto existente de referencia
const existente = {
  id: "e-1",
  vendor: "Shell",
  date: "2026-09-26",
  amount: 42.75,
  category: "Gasolina / Combustible",
  notes: "Gasolina Regular",
  isAiGenerated: true,
  isEditedByUser: false,
}

function cand(over = {}) {
  return {
    id: null,
    vendor: existente.vendor,
    date: existente.date,
    amount: existente.amount,
    ...over,
  }
}

console.log("\n== DUPLICADO EXACTO ==")
const dup = findDuplicateExpense(cand(), [existente])
check("mismo vendedor, fecha y monto", dup !== null, true)
check("señala al gasto existente", dup?.expense.id, "e-1")
check("diferencia 0 centavos", dup?.centsDiff, 0)

console.log("\n== TOLERANCIAS ==")
check("1 centavo de diferencia cuenta como duplicado (OCR)", findDuplicateExpense(cand({ amount: 42.74 }), [existente]) !== null, true)
check("1 centavo arriba tambien", findDuplicateExpense(cand({ amount: 42.76 }), [existente]) !== null, true)
check("2 centavos ya NO", findDuplicateExpense(cand({ amount: 42.73 }), [existente]), null)

console.log("\n== NORMALIZACION ==")
check("vendedor en mayusculas", findDuplicateExpense(cand({ vendor: "SHELL" }), [existente]) !== null, true)
check("vendedor con espacios", findDuplicateExpense(cand({ vendor: "  shell  " }), [existente]) !== null, true)
check("vendedor con espacios internos multiples", findDuplicateExpense(cand({ vendor: "shell   gas" }), [{ ...existente, vendor: "shell gas" }]) !== null, true)
check("normalizeVendorName limpia", normalizeVendorName("  Shell   GAS "), "shell gas")
check("expenseCents redondea", expenseCents(42.755), 4276)
check("expenseCents de NaN es 0", expenseCents("abc"), 0)

console.log("\n== NO DUPLICADO ==")
check("vendedor distinto", findDuplicateExpense(cand({ vendor: "Chevron" }), [existente]), null)
check("fecha distinta", findDuplicateExpense(cand({ date: "2026-09-25" }), [existente]), null)
check("monto muy distinto", findDuplicateExpense(cand({ amount: 55.0 }), [existente]), null)
check("lista vacia", findDuplicateExpense(cand(), []), null)

console.log("\n== EDICION: no se marca a si mismo ==")
check("editar el propio gasto no es duplicado", findDuplicateExpense(cand({ id: "e-1" }), [existente]), null)
check("pero si otro con el mismo id no existe, sigue detectando", findDuplicateExpense(cand({ id: "e-9" }), [existente]) !== null, true)

console.log("\n== SIN FIRMA: no se puede declarar duplicado ==")
check("vendedor vacio", findDuplicateExpense(cand({ vendor: "" }), [existente]), null)
check("vendedor null", findDuplicateExpense(cand({ vendor: null }), [existente]), null)
check("monto 0", findDuplicateExpense(cand({ amount: 0 }), [existente]), null)
check("monto negativo", findDuplicateExpense(cand({ amount: -5 }), [existente]), null)
check("fecha vacia", findDuplicateExpense(cand({ date: "" }), [existente]), null)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
