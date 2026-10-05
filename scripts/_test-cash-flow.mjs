// Prueba del libro mayor (la union de la informacion). Ejecutar:
//   node scripts/_test-cash-flow.mjs
//
// Lo que se protege aqui:
//  1. que las semillas de ejemplo se vayan y NO se lleven nada del usuario
//  2. que un movimiento repetido actualice en vez de duplicar
//  3. que un gasto se convierta en movimiento con su origen correcto
import assert from "node:assert/strict"

/* localStorage minimo: el modulo guarda y lee de ahi. */
const almacen = new Map()
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
  clear: () => almacen.clear(),
}

const {
  sinSemillas, upsertMovimiento, idDeGasto, movimientoDeGasto,
  leerLibroMayor, guardarMovimiento, LEDGER_KEY, IDS_SEMILLA,
} = await import("../components/copiloto/cash-flow-store.ts")

const mov = (over = {}) => ({
  id: "x", date: "2026-10-04", description: "d", source: "manual",
  type: "expense", status: "actual", amount: 1, ...over,
})

let n = 0
const ok = (nombre) => { n++; console.log("  ok   " + nombre) }

console.log("\n== SEMILLAS DE EJEMPLO ==")
const conSemillas = [
  mov({ id: "seed-1", description: "Depósito Semanal Uber", amount: 485.5 }),
  mov({ id: "seed-2", description: "Gasolina Shell Autopista", amount: 45 }),
  mov({ id: "seed-3", description: "Ingreso estimado Lyft jornada", amount: 180 }),
  mov({ id: "seed-4", description: "Factura E-ZPass Peajes Quincenal", amount: 65.25 }),
  mov({ id: "claris:gasto:abc", description: "Mi gasto de verdad", amount: 30 }),
]
const limpio = sinSemillas(conSemillas)
assert.equal(limpio.length, 1, "solo sobrevive el movimiento del usuario")
assert.equal(limpio[0].id, "claris:gasto:abc")
ok("las cuatro semillas se van")

// LO IMPORTANTE: nunca por prefijo. Un id que solo EMPIEZA por "seed" es del
// usuario y no se puede tocar. En la otra app, purgar por prefijo le borro datos.
const parecidos = [
  mov({ id: "seed-5", description: "Movimiento del usuario" }),
  mov({ id: "seedling", description: "Otro del usuario" }),
  mov({ id: "seed", description: "Y otro" }),
  mov({ id: "mi-seed-1", description: "Y otro mas" }),
]
assert.equal(sinSemillas(parecidos).length, 4, "un id parecido NO se toca")
ok("un id que solo empieza por 'seed' sobrevive")

assert.deepEqual(sinSemillas(null), [])
assert.deepEqual(sinSemillas(undefined), [])
assert.deepEqual(sinSemillas("basura"), [])
assert.deepEqual(sinSemillas([null, undefined, mov({ id: "seed-1" })]), [], "la basura no rompe")
ok("entradas raras no rompen")
assert.equal(IDS_SEMILLA.size, 4, "solo hay cuatro semillas conocidas")

console.log("\n== NO DUPLICAR ==")
let lista = upsertMovimiento([], mov({ id: "a", amount: 10 }))
assert.equal(lista.length, 1)
lista = upsertMovimiento(lista, mov({ id: "a", amount: 99 }))
assert.equal(lista.length, 1, "el mismo id no crea otra fila")
assert.equal(lista[0].amount, 99, "y se queda con el valor nuevo")
ok("repetir el mismo id actualiza, no duplica")

lista = upsertMovimiento(lista, mov({ id: "b" }))
assert.equal(lista.length, 2)
assert.equal(lista[0].id, "b", "el nuevo va arriba")
ok("uno nuevo si entra")
assert.deepEqual(upsertMovimiento(null, mov({ id: "z" })).length, 1)
ok("una lista nula no rompe")

console.log("\n== DE GASTO A MOVIMIENTO ==")
assert.equal(idDeGasto("abc"), "claris:gasto:abc")
ok("el id es determinista")

const escaneado = movimientoDeGasto({
  id: "g1", date: "2026-10-04", vendor: "E-ZPass", category: "Peajes",
  amount: 45.5, isAiGenerated: true, isEditedByUser: false,
})
assert.equal(escaneado.id, "claris:gasto:g1")
assert.equal(escaneado.source, "receipt", "escaneado -> recibo")
assert.equal(escaneado.status, "actual", "dinero que ya salio")
assert.equal(escaneado.type, "expense")
assert.equal(escaneado.amount, 45.5)
assert.equal(escaneado.sourceLabel, "Recibo escaneado")
ok("un gasto escaneado entra como recibo")

const manual = movimientoDeGasto({
  id: "g2", date: "2026-10-04", vendor: "Taller", category: "Varios",
  amount: 120, isAiGenerated: false, isEditedByUser: true,
})
assert.equal(manual.source, "manual", "escrito a mano -> manual")
assert.equal(manual.sourceLabel, "Gasto manual")
ok("uno escrito a mano entra como manual")

// El importe no puede llegar con cola de coma flotante al libro.
const feo = movimientoDeGasto({
  id: "g3", date: "2026-10-04", vendor: "x", category: "Varios",
  amount: 0.1 + 0.2, isAiGenerated: false, isEditedByUser: false,
})
assert.equal(feo.amount, 0.3, "se redondea a centavos")
ok("el importe se redondea")

const sinFecha = movimientoDeGasto({ id: "g4", vendor: "", amount: -5, isAiGenerated: false })
assert.equal(sinFecha.description, "Gasto", "sin vendedor no queda vacio")
assert.equal(sinFecha.date, "", "una fecha rara no rompe")
ok("faltantes no rompen")

console.log("\n== GUARDAR Y LEER ==")
almacen.clear()
assert.deepEqual(leerLibroMayor(), [], "sin nada guardado, vacio")
ok("empieza vacio (ya no planta semillas)")

guardarMovimiento(mov({ id: "claris:gasto:g1", amount: 45.5 }))
assert.equal(leerLibroMayor().length, 1)
guardarMovimiento(mov({ id: "claris:gasto:g1", amount: 50 }))
assert.equal(leerLibroMayor().length, 1, "guardar dos veces el mismo no duplica")
assert.equal(leerLibroMayor()[0].amount, 50)
ok("guardar dos veces el mismo gasto no duplica")

// Un libro que YA tenia semillas guardadas se limpia solo.
almacen.set(LEDGER_KEY, JSON.stringify([mov({ id: "seed-1" }), mov({ id: "claris:gasto:g9" })]))
assert.equal(leerLibroMayor().length, 1, "las semillas guardadas se quitan al leer")
assert.equal(leerLibroMayor()[0].id, "claris:gasto:g9")
ok("un libro con semillas viejas se limpia")

almacen.set(LEDGER_KEY, "no es json")
assert.deepEqual(leerLibroMayor(), [], "json roto no rompe")
ok("json corrupto devuelve vacio")

console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${n}   FALLADAS: 0`)
console.log("=".repeat(50))
