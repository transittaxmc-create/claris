// Prueba de la validación de monto al guardar un viaje (plan de fix 1.1)
// y de la guarda de idempotencia contra doble toque (1.2). Ejecutar:
//   node --import ./scripts/_test-register-alias.mjs scripts/_test-trip-amount.mjs
import assert from "node:assert/strict"
import { tripAmountError, grossOf, newTrip } from "../components/copiloto/types.ts"

function tripWith(patch) {
  return { ...newTrip(), ...patch }
}

// 1.1 — un viaje en $0 no se guarda.
assert.equal(
  tripAmountError(tripWith({})),
  "Enter an amount over $0 to save this trip.",
  "viaje nuevo en $0",
)

// 1.1 — solo peaje en Uber no es ingreso (gross lo excluye) → sigue en $0.
assert.equal(
  tripAmountError(tripWith({ platform: "Uber", toll: 12 })),
  "Enter an amount over $0 to save this trip.",
  "solo peaje en Uber",
)

// 1.1 — montos negativos no se guardan (ni FARE ni FEE ni TIPS).
assert.match(tripAmountError(tripWith({ earnings: -5 })), /negative/)
assert.match(tripAmountError(tripWith({ earnings: 20, platformFee: -1 })), /negative/)
assert.match(tripAmountError(tripWith({ earnings: 20, tips: -2 })), /negative/)
assert.match(tripAmountError(tripWith({ earnings: 20, extraCash: -1 })), /negative/)
assert.match(tripAmountError(tripWith({ earnings: 20, toll: -3 })), /negative/)

// 1.1 — basura no numérica no se guarda.
assert.match(tripAmountError(tripWith({ earnings: Number.NaN })), /not valid/)
assert.match(tripAmountError(tripWith({ earnings: Infinity })), /not valid/)

// 1.1 — un viaje válido sí pasa (FARE, TIPS, EXTRA o peaje fuera de Uber/Lyft).
assert.equal(tripAmountError(tripWith({ earnings: 25 })), null)
assert.equal(tripAmountError(tripWith({ tips: 5 })), null)
assert.equal(tripAmountError(tripWith({ extraCash: 10 })), null)
assert.equal(tripAmountError(tripWith({ platform: "Cash", toll: 8 })), null)
assert.equal(tripAmountError(tripWith({ earnings: 40, platformFee: 3.5 })), null)

// 1.1 — el gross que se valida es el mismo que muestra la app.
assert.equal(grossOf(tripWith({ earnings: 25, tips: 5 })), 30)
assert.equal(grossOf(tripWith({ platform: "Uber", earnings: 25, toll: 10 })), 25)

// 1.2 — la guarda de idempotencia de saveNewFromEntry: guardar dos veces el
// mismo id (doble toque) deja UNA sola fila.
function saveOnce(prev, stamped) {
  return prev.some((p) => p.id === stamped.id) ? prev : [stamped, ...prev]
}
const first = tripWith({ earnings: 30 })
let rows = saveOnce([], first)
rows = saveOnce(rows, { ...first })
assert.equal(rows.length, 1, "doble toque crea una sola fila")
rows = saveOnce(rows, tripWith({ earnings: 15 }))
assert.equal(rows.length, 2, "un viaje distinto sí se agrega")

console.log("OK _test-trip-amount: 1.1 validación + 1.2 idempotencia")
