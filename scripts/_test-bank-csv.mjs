// Pruebas del parser de estados de cuenta bancarios.
// Ejecutar: node scripts/_test-bank-csv.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, renameSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "bankcsv-test-"))

cpSync(join(ROOT, "lib", "bank-csv.ts"), join(tmp, "bank-csv.ts"))
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "bank-csv.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
renameSync(join(tmp, "bank-csv.js"), join(tmp, "bank-csv.mjs"))

const { parseBankCsv } = await import(pathToFileURL(join(tmp, "bank-csv.mjs")).href)

let passed = 0, failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

console.log("\n== FORMATO ESTANDAR (coma, con cabecera) ==")
const r1 = parseBankCsv(
  "Fecha,Descripcion,Monto\n2026-09-26,UBER PAYMENT,85.66\n2026-09-25,SHELL GAS,-42.75\n",
)
check("lee 2 transacciones", r1?.length, 2)
check("fecha primera", r1?.[0].date, "2026-09-26")
check("descripcion primera", r1?.[0].description, "UBER PAYMENT")
check("monto primera", r1?.[0].amount, 85.66)
check("monto negativo segunda", r1?.[1].amount, -42.75)

console.log("\n== PUNTO Y COMA ==")
const r2 = parseBankCsv("2026-09-26;LYFT SETTLEMENT;38.04")
check("separador ;", r2?.length, 1)
check("descripcion con ;", r2?.[0].description, "LYFT SETTLEMENT")

console.log("\n== MONEDA, COMAS DE MILES Y SIMBOLOS ==")
check("comas de miles entre comillas", parseBankCsv('2026-09-26,UBER,"$1,234.50"')?.[0].amount, 1234.5)
check("simbolo euro", parseBankCsv("2026-09-26,UBER,\u20ac85.66")?.[0].amount, 85.66)

console.log("\n== FECHAS ALTERNATIVAS ==")
check("26/09/2026", parseBankCsv("26/09/2026,UBER,10.00")?.[0].date, "26/09/2026")
check("26-09-26", parseBankCsv("26-09-26,UBER,10.00")?.[0].date, "26-09-26")
check("20260926", parseBankCsv("20260926,UBER,10.00")?.[0].date, "20260926")

console.log("\n== CASOS INVÁLIDOS ==")
check("linea de cabecera sola no produce nada", parseBankCsv("Fecha,Descripcion,Monto"), null)
check("texto vacio", parseBankCsv(""), null)
check("solo espacios", parseBankCsv("   \n  "), null)
check("linea sin monto", parseBankCsv("2026-09-26,UBER,abc"), null)
check("linea sin fecha valida", parseBankCsv("ayer,UBER,10.00"), null)
check("null", parseBankCsv(null), null)

console.log("\n== DESCRIPCION CON COMAS INTERNAS (formato citado) ==")
const r5 = parseBankCsv('2026-09-26,"UBER TRIP, NYC",85.66')
check("comillas no rompen la descripcion", r5?.[0].description.includes("UBER TRIP"), true)
check("monto intacto", r5?.[0].amount, 85.66)

console.log("\n== COLUMNAS EXTRA (debito/credito separados) ==")
// Bancos que exportan: fecha, descripcion, debito, credito. Toma el último
// numérico, que es el crédito si existe.
const r6 = parseBankCsv("2026-09-26,UBER PAYMENT,0.00,85.66")
check("toma el credito (ultimo numerico)", r6?.[0].amount, 85.66)
const r7 = parseBankCsv("2026-09-25,SHELL GAS,42.75,0.00")
check("cuando el credito es 0, usa el debito", r7?.[0].amount, 0)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
