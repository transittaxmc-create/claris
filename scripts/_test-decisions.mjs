// Pruebas de las decisiones de dinero: el héroe "¿PUEDO GASTAR?", el día más
// ajustado de la semana y los avisos (máximo tres, urgente primero y luego por
// dinero). Lógica pura: se compila el módulo real y se prueba sin navegador.
//
// Ejecutar: node scripts/_test-decisions.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, renameSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "decisions-test-"))

cpSync(join(ROOT, "lib", "decisions.ts"), join(tmp, "decisions.ts"))
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(tmp, "decisions.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
renameSync(join(tmp, "decisions.js"), join(tmp, "decisions.mjs"))

const { spendable, tightestDay, moneyAlerts } = await import(pathToFileURL(join(tmp, "decisions.mjs")).href)

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

console.log("\n== ¿PUEDO GASTAR? ==")
const conAire = spendable({ bank: 3040, commitments: 980, reserve: 375 })
check("descuenta compromisos y reserva", conAire.amount, 1685)
check("veredicto con aire", conAire.verdict, "aire")
check("cobertura 100 % o más", conAire.coveragePct >= 100, true)

const ajustado = spendable({ bank: 1000, commitments: 900, reserve: 50 })
check("queda poco: ajustado", ajustado.verdict, "ajustado")
check("cantidad exacta", ajustado.amount, 50)

const corto = spendable({ bank: 500, commitments: 700, reserve: 100 })
check("negativo: corto", corto.verdict, "corto")
check("dice cuánto falta", corto.amount, -300)
check("cobertura menor a 100", corto.coveragePct < 100, true)

const sinCompromisos = spendable({ bank: 800, commitments: 0, reserve: 0 })
check("sin compromisos no estorba", sinCompromisos.amount, 800)
check("cobertura 100 con nada que cubrir", sinCompromisos.coveragePct, 100)

const bancoCero = spendable({ bank: 0, commitments: 200, reserve: 0 })
check("banco en cero avisa corto", bancoCero.verdict, "corto")
check("margen 0 con banco 0", bancoCero.marginPct, 0)

const basura = spendable({ bank: NaN, commitments: -50, reserve: -10 })
check("valores basura no rompen", basura.amount, 0)

console.log("\n== EL DÍA MÁS AJUSTADO DE LA SEMANA ==")
const dia = (date, balanceAfter, payments = [], expenses = 0, realIncome = 0) => ({
  date,
  realIncome,
  expenses,
  payments,
  balanceAfter,
  belowZero: balanceAfter < 0,
})
const semana = [
  dia("2026-09-28", 400, [], 0, 200),
  dia("2026-09-29", 640, [], 0, 240),
  dia("2026-09-30", 460, [{ description: "Seguro del carro", amount: 180 }]),
  dia("2026-10-01", 250, [], 0, 210),
  dia("2026-10-02", 515, [], 0, 265),
]
const peor = tightestDay(semana)
check("elige el balance más bajo", peor.date, "2026-10-01")
check("con su balance", peor.balanceAfter, 250)
check("y lo que vence ese día", peor.dueAmount, 0)
const miercoles = tightestDay([semana[2]])
check("el día del seguro muestra el vencimiento", miercoles.dueAmount, 180)
check("y su descripción", miercoles.due, ["Seguro del carro"])
check("semana vacía no rompe", tightestDay([]), null)
check("empate: se queda el más cercano", tightestDay([dia("2026-09-28", 300), dia("2026-09-29", 300)]).date, "2026-09-28")

console.log("\n== AVISOS: TRES COMO MÁXIMO, URGENTE PRIMERO ==")
const lleno = moneyAlerts({
  overdue: [{ description: "Seguro del carro", amount: 180, daysLate: 3 }],
  unpaidTollBills: { count: 2, amount: 24.8 },
  shortfall: 0,
  tightDay: null,
  expensesWithoutReceipt: { count: 2, amount: 96.4 },
  unclassified: { count: 5 },
})
check("nunca más de tres", lleno.length, 3)
check("primero el vencido", lleno[0].id, "vencidos")
check("el vencido dice hace cuántos días", lleno[0].detail.includes("hace 3 días"), true)
check("después la plata pendiente (peajes)", lleno[1].id, "peajes")
check("y luego la higiene (sin recibo)", lleno[2].id, "sin-recibo")
check("lo que sobra se corta (sin clasificar)", lleno.some((a) => a.id === "sin-clasificar"), false)

const soloHigiene = moneyAlerts({
  overdue: [],
  unpaidTollBills: { count: 0, amount: 0 },
  shortfall: 0,
  tightDay: null,
  expensesWithoutReceipt: { count: 0, amount: 0 },
  unclassified: { count: 3 },
})
check("con un solo aviso, lo muestra", soloHigiene.length, 1)
check("y es el de clasificar", soloHigiene[0].id, "sin-clasificar")

const nada = moneyAlerts({
  overdue: [],
  unpaidTollBills: { count: 0, amount: 0 },
  shortfall: 0,
  tightDay: null,
  expensesWithoutReceipt: { count: 0, amount: 0 },
  unclassified: { count: 0 },
})
check("sin problemas, sin avisos", nada.length, 0)

const semanaCorta = moneyAlerts({
  overdue: [],
  unpaidTollBills: { count: 0, amount: 0 },
  shortfall: 320.5,
  tightDay: { date: "2026-10-01", balanceAfter: -120, dueAmount: 180, due: ["Seguro"] },
  expensesWithoutReceipt: { count: 0, amount: 0 },
  unclassified: { count: 0 },
})
check("la semana corta avisa", semanaCorta[0].id, "semana-corta")
check("dice cuánto falta", semanaCorta[0].detail.includes("320.50"), true)
check("y cuál es el día ajustado", semanaCorta[0].detail.includes("2026-10-01"), true)

const dosVencidos = moneyAlerts({
  overdue: [
    { description: "Seguro", amount: 180, daysLate: 3 },
    { description: "Teléfono", amount: 60, daysLate: 9 },
  ],
  unpaidTollBills: { count: 0, amount: 0 },
  shortfall: 0,
  tightDay: null,
  expensesWithoutReceipt: { count: 0, amount: 0 },
  unclassified: { count: 0 },
})
check("agrupa los vencidos", dosVencidos[0].title, "2 pagos vencidos")
check("suma el dinero vencido", dosVencidos[0].amount, 240)
check("nombra el más viejo", dosVencidos[0].detail.includes("Teléfono"), true)

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
