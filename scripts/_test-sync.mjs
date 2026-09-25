// Prueba rápida de la lógica pura de lib/sync.ts (merge, tombstones, cifrado).
// Ejecutar: node scripts/_test-sync.mjs
import assert from "node:assert/strict"
import {
  mergeTrips,
  pruneTombstones,
  parseTombstones,
  buildDoc,
  savedAtOf,
  encryptJson,
  decryptJson,
  syncKeyId,
  isValidSyncCode,
  normalizeSyncCode,
} from "../lib/sync.ts"

// Todas las fechas de prueba son relativas a "ahora" para que funcionen
// sin importar la fecha real del equipo (los tombstones caducan a los 30 días).
const iso = (minutesFromNow) => new Date(Date.now() + minutesFromNow * 60_000).toISOString()
const t = (id, savedAt, earnings = 0) => ({ id, earnings, raw: savedAt ? { savedAt } : {} })

// 1. La versión más nueva gana, sin importar el orden de origen.
{
  const local = [t("a", iso(-180), 10)]
  const remote = [t("a", iso(-30), 99)]
  const { trips } = mergeTrips(local, remote)
  assert.equal(trips.length, 1)
  assert.equal(trips[0].earnings, 99, "remote más nuevo debe ganar")
}
{
  const local = [t("a", iso(-10), 55)]
  const remote = [t("a", iso(-30), 99)]
  const { trips } = mergeTrips(local, remote)
  assert.equal(trips[0].earnings, 55, "local más nuevo debe ganar")
}

// 2. Se conservan los viajes que sólo existen en un lado (lo que antes se perdía).
{
  const local = [t("a", iso(-300)), t("nuevo", iso(-5))]
  const remote = [t("viejo", iso(-400))]
  const { trips } = mergeTrips(local, remote)
  assert.deepEqual(
    trips.map((x) => x.id).sort(),
    ["a", "nuevo", "viejo"],
  )
  assert.equal(trips[0].id, "nuevo", "ordenados por más reciente")
}

// 3. Un borrado (tombstone) elimina el viaje aunque venga del otro teléfono.
{
  const local = []
  const remote = [t("borrado", iso(-120))]
  const { trips } = mergeTrips(local, remote, { borrado: iso(-60) })
  assert.equal(trips.length, 0, "el tombstone debe borrarlo")
}

// 4. Si el viaje se vuelve a crear DESPUÉS del borrado, sobrevive.
{
  const local = [t("recreado", iso(-10))]
  const remote = []
  const { trips, deleted } = mergeTrips(local, remote, { recreado: iso(-60) })
  assert.equal(trips.length, 1, "recreado después del borrado debe sobrevivir")
  assert.deepEqual(Object.keys(deleted), [], "el tombstone viejo se descarta")
}

// 5. Un borrado caducado (> 30 días) no puede borrar un viaje intacto.
{
  const local = [t("x", iso(-1000))]
  const { trips } = mergeTrips(local, [], { x: iso(-50_000) })
  assert.equal(trips.length, 1)
}

// 6. En empate (datos de la versión anterior, sin hora) gana el local: así una
//    copia vieja de IndexedDB no puede pisar una edición más reciente.
{
  const local = [t("igual", "", 11)]
  const remote = [t("igual", "", 22)]
  const { trips } = mergeTrips(local, remote)
  assert.equal(trips[0].earnings, 11, "sin hora, gana localStorage")
}


// 6. Prune de tombstones viejos (> 30 días) y parseo defensivo.
{
  const now = "2026-03-15T00:00:00.000Z"
  const pruned = pruneTombstones({ viejo: "2026-01-01T00:00:00.000Z", nuevo: "2026-03-10T00:00:00.000Z" }, now)
  assert.deepEqual(Object.keys(pruned), ["nuevo"])
  assert.deepEqual(parseTombstones("no-es-json"), {})
  assert.deepEqual(parseTombstones(null), {})
  assert.deepEqual(parseTombstones('[1,2]'), {})
}

// 7. El documento cifrado sólo se puede abrir con el mismo código.
{
  const code = "mi-codigo-privado"
  const tomb = iso(-60)
  const doc = buildDoc([t("a", iso(-120), 12)], { b: tomb })
  const payload = await encryptJson(code, doc)
  assert.ok(payload.length > 40, "payload no vacío")
  assert.ok(!payload.includes("mi-codigo"), "el payload no contiene el código")
  const back = await decryptJson(code, payload)
  assert.equal(back.entries[0].earnings, 12)
  assert.equal(back.deleted.b, tomb)
  assert.equal(await decryptJson("otro-codigo-distinto", payload), null, "con otro código debe fallar")
  assert.equal(await decryptJson(code, "basura"), null, "payload corrupto debe devolver null")
}

// 8. El id de sync es estable y depende del código (normalizado).
{
  const a = await syncKeyId("Abc12345")
  const b = await syncKeyId("  abc12345 ")
  const c = await syncKeyId("abc12346")
  assert.equal(a, b, "debe ignorar espacios y mayúsculas")
  assert.notEqual(a, c)
  assert.equal(a.length, 64)
  assert.ok(isValidSyncCode("12345678"))
  assert.ok(!isValidSyncCode("1234567"))
  assert.equal(normalizeSyncCode("  Xy Z  "), "xy z")
}

console.log("OK · todas las pruebas de lib/sync.ts pasaron")
