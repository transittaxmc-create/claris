// Prueba directa de la fusión nube↔dispositivo del CRM (lib/crm/merge.ts)
// y de la clasificación de carriles (lib/crm/classify-inbound.ts), sin
// navegador ni mocks: se importan los módulos reales compilados con el
// tsc del proyecto — el mismo código que corre en la app.
//
// La prueba central es el ciclo que Miguel vivió el 2026-11-28: vio los
// 12 mensajes en su bandeja, cerró la app, la reabrió y los mensajes
// habían desaparecido. La aritmética anterior (deletedHere) clasificaba
// la semilla de la nube como "borrada aquí" cuando la lista local corría
// vacía en el remonte y empujaba el borrado a la nube. Esta suite fija
// por nombre que eso no puede volver a pasar.
//
// Ejecutar: node scripts/_test-crm-merge.mjs
import { execFileSync } from "node:child_process"
import { mkdtempSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(join(tmpdir(), "crm-merge-test-"))

execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "bin", "tsc"),
    join(ROOT, "lib", "crm", "merge.ts"),
    join(ROOT, "lib", "crm", "classify-inbound.ts"),
    "--outDir", tmp,
    "--module", "esnext",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
)
renameSync(join(tmp, "merge.js"), join(tmp, "merge.mjs"))
renameSync(join(tmp, "classify-inbound.js"), join(tmp, "classify-inbound.mjs"))

const { mergeCloudList, preserveExtras, nextSyncedIds } = await import(pathToFileURL(join(tmp, "merge.mjs")).href)
const { classifyInbound, msgViewKey, deriveLane } = await import(pathToFileURL(join(tmp, "classify-inbound.mjs")).href)

let passed = 0
let failed = 0
function check(nombre, actual, esperado) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(esperado)
  if (a === e) { passed++; console.log(`  ok   ${nombre}`) }
  else { failed++; console.log(`  FAIL ${nombre}\n       esperado ${e}\n       obtenido ${a}`) }
}

const msg = (id, extra = {}) => ({ id, body: `mensaje ${id}`, ...extra })
const ids = (list) => list.map((x) => x.id)

console.log("\n== EL CICLO DE MIGUEL: SEMILLA → CERRAR/REABRIR CON LOCAL VACÍO ==")
// Los 12 mensajes están en la nube y anotados como sincronizados en este
// teléfono. La app se cierra y se reabre: la lista local corre VACÍA en
// el remonte (el escenario exacto del defecto). La fusión debe pintar
// los 12 y no emitir NINGÚN borrado — el resultado ni siquiera tiene un
// campo donde un borrado pudiera viajar.
{
  const cloud = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12"].map((id) => msg(id))
  const syncedBefore = new Set(cloud.map((m) => m.id))
  const r = mergeCloudList({ cloud, local: [], syncedBefore, hydrated: true, pullOk: true })
  check("remount-with-empty-local-keeps-cloud-messages-and-emits-no-delete: applied", r.applied, true)
  check("remount-with-empty-local-keeps-cloud-messages-and-emits-no-delete: los 12 siguen visibles", ids(r.merged), ids(cloud))
  check("remount-with-empty-local-keeps-cloud-messages-and-emits-no-delete: nada que subir", r.upsertLocalOnly, [])
  check("remount-with-empty-local-keeps-cloud-messages-and-emits-no-delete: el resultado NO tiene campo de borrados", Object.keys(r).sort(), ["applied", "merged", "upsertLocalOnly"])
}
{
  // Variante a medio hidratar: la lista local solo alcanzó a cargar 1 de 12.
  const cloud = ["m1", "m2", "m3"].map((id) => msg(id))
  const r = mergeCloudList({ cloud, local: [msg("m1")], syncedBefore: new Set(["m1", "m2", "m3"]), hydrated: true, pullOk: true })
  check("remount-with-half-hydrated-local-keeps-cloud-messages: merged", ids(r.merged), ["m1", "m2", "m3"])
  check("remount-with-half-hydrated-local-keeps-cloud-messages: sin subidas", r.upsertLocalOnly, [])
}

console.log("\n== GUARDAS: SIN HIDRATACIÓN O SIN LECTURA ÍNTEGRA NO SE TOCA NADA ==")
{
  const local = [msg("m1")]
  const r1 = mergeCloudList({ cloud: [msg("m1"), msg("m2")], local, syncedBefore: new Set(["m1"]), hydrated: false, pullOk: true })
  check("unhydrated-local-blocks-the-merge: applied", r1.applied, false)
  check("unhydrated-local-blocks-the-merge: local intacto", ids(r1.merged), ["m1"])
  const r2 = mergeCloudList({ cloud: [], local, syncedBefore: new Set(["m1"]), hydrated: true, pullOk: false })
  check("failed-pull-blocks-the-merge: applied", r2.applied, false)
  check("failed-pull-blocks-the-merge: local intacto", ids(r2.merged), ["m1"])
}

console.log("\n== NUBE VACÍA: SOSPECHOSA HASTA CONFIRMARLA ==")
{
  const local = [msg("m1")]
  const r1 = mergeCloudList({ cloud: [], local, syncedBefore: new Set(["m1"]), hydrated: true, pullOk: true })
  check("empty-cloud-first-pull-is-suspect-and-keeps-local: applied", r1.applied, false)
  check("empty-cloud-first-pull-is-suspect-and-keeps-local: local intacto", ids(r1.merged), ["m1"])
  const r2 = mergeCloudList({ cloud: [], local, syncedBefore: new Set(["m1"]), hydrated: true, pullOk: true, honorEmptyCloud: true })
  check("empty-cloud-confirmed-honors-cloud-truth: applied", r2.applied, true)
  check("empty-cloud-confirmed-honors-cloud-truth: merged vacío", r2.merged, [])
  const r3 = mergeCloudList({ cloud: [], local: [], syncedBefore: new Set(), hydrated: true, pullOk: true })
  check("empty-cloud-with-no-memory-applies-clean: applied", r3.applied, true)
}

console.log("\n== MIGRACIÓN INICIAL Y BORRADO EN OTRO LADO ==")
{
  const r = mergeCloudList({ cloud: [msg("a")], local: [msg("a"), msg("x")], syncedBefore: new Set(["a"]), hydrated: true, pullOk: true })
  check("never-synced-local-record-survives-and-uploads: merged", ids(r.merged), ["a", "x"])
  check("never-synced-local-record-survives-and-uploads: upsert", ids(r.upsertLocalOnly), ["x"])
}
{
  const r = mergeCloudList({ cloud: [msg("a")], local: [msg("a"), msg("b")], syncedBefore: new Set(["a", "b"]), hydrated: true, pullOk: true })
  check("deleted-elsewhere-drops-locally-without-reupload: merged", ids(r.merged), ["a"])
  check("deleted-elsewhere-drops-locally-without-reupload: upsert vacío (no resucita)", r.upsertLocalOnly, [])
}
{
  const r = mergeCloudList({ cloud: [msg("a", { v: 2 })], local: [msg("a", { v: 1 })], syncedBefore: new Set(["a"]), hydrated: true, pullOk: true })
  check("cloud-version-wins-for-shared-ids", r.merged[0].v, 2)
}
{
  const s = nextSyncedIds([msg("a")], [msg("x")])
  check("nextSyncedIds = nube + subidos confirmados", [...s].sort(), ["a", "x"])
}

console.log("\n== EXTRAS LOCALES SOBREVIVEN AL PULL ==")
{
  const merged = [{ id: "r1", notes: "de la nube" }]
  const prev = [{ id: "r1", notes: "viejo", fare: 80, paid: true }]
  const out = preserveExtras(merged, prev, ["fare", "paid"])
  check("preserveExtras re-engancha fare/paid", [out[0].fare, out[0].paid], [80, true])
  check("preserveExtras no pisa los campos de la nube", out[0].notes, "de la nube")
}

console.log("\n== CLASIFICACIÓN DE CARRILES (§5) ==")
{
  const groups = [{ groupId: "grp-trabajos", fn: "work_groups" }, { groupId: "grp-taxes", fn: "taxes" }]
  check("SMS es transporte", classifyInbound({ lane: "sms_transport" }, groups), "transport")
  check("WhatsApp Business es transporte", classifyInbound({ lane: "wa_business_transport" }, groups), "transport")
  check("grupo registrado de trabajo manda", classifyInbound({ lane: "wa_personal", isGroup: true, chatId: "grp-trabajos" }, groups), "work_groups")
  check("grupo registrado de impuestos manda", classifyInbound({ lane: "wa_personal", isGroup: true, chatId: "grp-taxes" }, groups), "taxes")
  check("grupo desconocido → cuarentena", classifyInbound({ lane: "wa_personal", isGroup: true, chatId: "grp-nuevo" }, groups), "")
  check("DM 1:1 del personal → impuestos", classifyInbound({ lane: "wa_personal", isGroup: false }, groups), "taxes")
  check("vista SMS", msgViewKey({ lane: "sms_transport", fn: "transport" }), "sms")
  check("vista WhatsApp Business", msgViewKey({ lane: "wa_business_transport", fn: "transport" }), "wab")
  check("vista impuestos", msgViewKey({ lane: "wa_personal", fn: "taxes" }), "taxes")
  check("vista trabajo", msgViewKey({ lane: "wa_personal", fn: "work_groups" }), "work")
  check("vista cuarentena", msgViewKey({ lane: "wa_personal", fn: "" }), "quar")
  check("campaña saliente no vive en bandejas", msgViewKey({ lane: "wa_personal", fn: "taxes", direction: "outbound" }), null)
  check("histórico WhatsApp deriva a Business", deriveLane({ channel: "WhatsApp" }).lane, "wa_business_transport")
  check("histórico SMS deriva a SMS", deriveLane({ channel: "SMS" }).lane, "sms_transport")
  check("lane existente se conserva con su fn", deriveLane({ lane: "wa_personal", fn: "" }), { lane: "wa_personal", fn: "" })
}

rmSync(tmp, { recursive: true, force: true })
console.log(`\n${"=".repeat(50)}`)
console.log(`PASADAS: ${passed}   FALLADAS: ${failed}`)
console.log("=".repeat(50))
process.exit(failed === 0 ? 0 : 1)
