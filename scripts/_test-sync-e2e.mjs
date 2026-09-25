// Prueba de extremo a extremo de la sincronización entre dos teléfonos,
// usando el servidor real (next start) + el mock de KV.
// Ejecutar: node scripts/_test-sync-e2e.mjs
import assert from "node:assert/strict"

const BASE = process.env.BASE_URL ?? "http://localhost:3100"
const realFetch = globalThis.fetch
// pullRemote/pushRemote usan rutas relativas (como en el navegador).
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" && input.startsWith("/") ? BASE + input : input
  return realFetch(url, init)
}

const { syncWithCloud, syncKeyId } = await import("../lib/sync.ts")

const iso = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString()
const trip = (id, savedAt, earnings) => ({ id, earnings, raw: { savedAt } })
// Código único por ejecución: así la prueba no depende de lo que quedó
// guardado en el servidor de una ejecución anterior.
const CODE = `codigo-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// 0. Sin configurar (un servidor en :3000 SIN las variables de KV) -> aviso
//    claro en lugar de fallar en silencio. Se activa con CHECK_UNCONFIGURED=1.
if (process.env.CHECK_UNCONFIGURED === "1") {
  const key = await syncKeyId(CODE)
  const res = await realFetch(`http://localhost:3000/api/sync?key=${key}`)
  assert.equal(res.status, 501, "sin KV debe responder 501")
  const json = await res.json()
  assert.equal(json.error, "sync_no_configurado")
  console.log("· aviso 'sin configurar' verificado (501)")
} else {
  console.log("· aviso 'sin configurar' omitido (usa CHECK_UNCONFIGURED=1 con un servidor en :3000)")
}

// 1. Teléfono A sube su viaje Y un gasto.
const a1 = trip("a1", iso(-30), 20)
const gastoA = { id: "ga1", savedAt: iso(-28), amount: 45.5, vendor: "BP Gas Station", category: "Gasolina / Combustible", date: "2026-03-24", isAiGenerated: false, isEditedByUser: false }
{
  const r = await syncWithCloud(CODE, [a1], {}, [gastoA])
  assert.ok(r.ok, `A debía sincronizar: ${r.message}`)
  assert.equal(r.pushed, 1)
  assert.equal(r.expenses?.length, 1, "A subió su gasto")
}

// 2. Teléfono B (que no tiene nada) recibe el viaje de A y aporta el suyo:
//    aquí es donde antes se perdía la información. También debe recibir el
//    gasto de A.
const b1 = trip("b1", iso(-20), 35)
{
  const r = await syncWithCloud(CODE, [b1], {})
  assert.ok(r.ok, `B debía sincronizar: ${r.message}`)
  const ids = r.trips.map((t) => t.id).sort()
  assert.deepEqual(ids, ["a1", "b1"], "B debe tener los viajes de los dos")
  assert.equal(r.trips[0].id, "b1", "ordenados por más reciente")
  assert.equal(r.expenses?.length, 1, "B debe recibir el gasto de A")
  assert.equal(r.expenses?.[0]?.vendor, "BP Gas Station")
  assert.equal(r.expenses?.[0]?.amount, 45.5)
}

// 3. A vuelve a abrir la app: ahora también ve el viaje de B.
{
  const r = await syncWithCloud(CODE, [a1], {})
  assert.ok(r.ok)
  assert.deepEqual(
    r.trips.map((t) => t.id).sort(),
    ["a1", "b1"],
    "A debe recibir el viaje de B",
  )
}

// 4. A borra su viaje: el borrado debe llegar a B (no revivir).
{
  const del = { a1: iso(-5) }
  const r = await syncWithCloud(CODE, [], del)
  assert.ok(r.ok)
  assert.deepEqual(
    r.trips.map((t) => t.id),
    ["b1"],
  )
  // B sincroniza con su copia local (que todavía tiene a1)
  const r2 = await syncWithCloud(CODE, [a1, b1], {})
  assert.ok(r2.ok)
  assert.deepEqual(
    r2.trips.map((t) => t.id),
    ["b1"],
    "el borrado de A debe llegar a B",
  )
}

// 5. Un código distinto NO puede ver los datos del otro (sólo nadie más).
//    No falla: simplemente abre su propio espacio vacío, y los viajes de B
//    siguen intactos bajo el código original.
{
  const r = await syncWithCloud("otro-codigo-999", [trip("x", iso(-1), 99)], {})
  assert.ok(r.ok, "otro código abre su propio espacio")
  assert.deepEqual(
    r.trips.map((t) => t.id),
    ["x"],
    "no debe ver los viajes del otro código",
  )
  const again = await syncWithCloud(CODE, [], {})
  assert.ok(again.ok)
  assert.deepEqual(
    again.trips.map((t) => t.id),
    ["b1"],
    "los datos del código original siguen intactos",
  )
}

// 6. Códigos cortos se rechazan antes de tocar la red.
{
  const r = await syncWithCloud("corto", [], {})
  assert.equal(r.reason, "invalid_code")
}

// 7. Si el documento guardado está dañado, avisa en vez de perder datos.
{
  const key = await syncKeyId(CODE)
  await realFetch(`${BASE}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, payload: "esto-no-es-un-documento-cifrado" }),
  })
  const r = await syncWithCloud(CODE, [], {})
  assert.equal(r.ok, false)
  assert.equal(r.reason, "bad_code")
}

console.log("OK · sincronización entre dos teléfonos verificada de extremo a extremo")
