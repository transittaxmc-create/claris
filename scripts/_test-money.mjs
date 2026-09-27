// Prueba del campo de dinero (la "tecla de menos"). Ejecutar:
//   node scripts/_test-money.mjs
import assert from "node:assert/strict"
import { moneyTextFromNumber, moneyTextToNumber, normalizeMoneyText, toggleMoneySign } from "../lib/money.ts"

// El bug reportado: al escribir "-" el símbolo desaparecía porque el valor
// numérico se recalculaba a 0. Ahora el texto se conserva.
assert.equal(normalizeMoneyText("-"), "-")
assert.equal(moneyTextToNumber("-"), 0, "mientras se escribe sólo el menos, vale 0")
assert.equal(normalizeMoneyText("-5"), "-5")
assert.equal(normalizeMoneyText("-0.75"), "-0.75")
assert.equal(moneyTextToNumber("-0.75"), -0.75)

// Coma decimal (teclados en español) y varios puntos.
assert.equal(normalizeMoneyText("12,5"), "12.5")
assert.equal(normalizeMoneyText("1.2.3"), "1.23")
assert.equal(moneyTextToNumber("12.5"), 12.5)

// Basura y vacío.
assert.equal(normalizeMoneyText(""), "")
assert.equal(normalizeMoneyText("abc"), "")
assert.equal(normalizeMoneyText("$ 3 4"), "34")
assert.equal(moneyTextToNumber(""), 0)

// Texto mostrado desde el número.
assert.equal(moneyTextFromNumber(0), "")
assert.equal(moneyTextFromNumber(12.5), "12.5")
assert.equal(moneyTextFromNumber(-3), "-3")

// Botón "−"/"+".
assert.equal(toggleMoneySign(""), "-")
assert.equal(toggleMoneySign("-"), "")
assert.equal(toggleMoneySign("12"), "-12")
assert.equal(toggleMoneySign("-12"), "12")
assert.equal(moneyTextToNumber(toggleMoneySign("12")), -12)
assert.equal(moneyTextToNumber(toggleMoneySign("-12")), 12)

// Casos que usa el botón ± del campo (money-input.tsx): negar en mitad de una
// edición y conservar la parte decimal que ya se escribió.
assert.equal(toggleMoneySign("12."), "-12.")
assert.equal(toggleMoneySign("-12."), "12.")
assert.equal(toggleMoneySign("0.75"), "-0.75")
assert.equal(toggleMoneySign("-0.75"), "0.75")
assert.equal(toggleMoneySign("0"), "-0")
// El signo se conserva si el texto ya lo tenía al negarlo dos veces.
assert.equal(toggleMoneySign(toggleMoneySign("12.5")), "12.5")
assert.equal(toggleMoneySign(toggleMoneySign("-7")), "-7")

// Ida y vuelta: lo que se escribe es lo que se guarda.
for (const raw of ["-12.5", "0.01", "1500", "-0.5"]) {
  const saved = moneyTextToNumber(normalizeMoneyText(raw))
  assert.equal(moneyTextFromNumber(saved), raw)
}

console.log("OK · campo de dinero con signo menos verificado")
