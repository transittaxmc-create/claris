/**
 * Fusión nube ↔ dispositivo del CRM — la versión SEGURA (2026-11-28).
 *
 * Reemplaza la aritmética anterior de crm-screen.tsx, donde el efecto de
 * fusión calculaba `deletedHere` (sincronizado antes ∩ en la nube ∩ ya no
 * está en la lista local) y empujaba ese borrado a la nube con
 * onCloudSync(merged, deletedHere). Si la lista local corría vacía o a
 * medio hidratar en un remonte (cerrar y reabrir la app), la bandeja
 * entera se clasificaba como "borrada aquí": los mensajes desaparecían
 * de la pantalla y el borrado podía llegar a la nube (análisis de Dixie,
 * 2026-11-28; síntoma confirmado por Miguel el mismo día: vio los 12
 * mensajes, cerró, reabrió y ya no estaban).
 *
 * Reglas de esta fusión — estructurales, no parches:
 *  (a) Un récord que existe en la nube NUNCA desaparece de la lista por
 *      un remonte con la lista local vacía o a medio hidratar: la fusión
 *      parte de la lista de la nube COMPLETA y no filtra ningún id por
 *      ausencia local. No existe ningún cálculo de "borrado aquí".
 *  (b) La fusión JAMÁS emite borrados: su resultado no contiene ninguna
 *      lista de ids para borrar. Borrar en la nube solo ocurre por la
 *      acción explícita de Delete del usuario, que la pantalla registra
 *      en su propio conjunto de borrados pendientes (fuera de aquí).
 *  (c) Sin hidratación local completa o sin una lectura de nube íntegra,
 *      la fusión NO se aplica: el estado local queda intacto.
 *  (d) Una lectura de nube VACÍA con memoria local previa es sospechosa
 *      (sesión momentáneamente equivocada, lectura degradada): no se
 *      honra hasta que el llamador la confirma (segunda lectura vacía
 *      consecutiva, mismo dueño) con `honorEmptyCloud`.
 * Lo que sí hace: la nube manda en los ids que trae (su versión gana);
 * lo local que NUNCA se sincronizó se conserva y se devuelve en
 * `upsertLocalOnly` para subirlo (migración inicial idempotente, mismos
 * ids); lo sincronizado antes que la nube ya no trae se cae de la copia
 * local y NO se vuelve a subir (fue borrado en otro lado; el borrado de
 * otro lado manda sin que este dispositivo emita nada).
 */

export type MergeInput<T> = {
  /** Lista que devolvió la nube en esta lectura (ya mapeada a la forma local). */
  cloud: readonly T[]
  /** Lista local actual del dispositivo. */
  local: readonly T[]
  /** Ids que este dispositivo ya confirmó en la nube en sesiones anteriores. */
  syncedBefore: ReadonlySet<string>
  /** La lista local terminó de cargarse del almacenamiento del dispositivo. */
  hydrated: boolean
  /** La lectura de la nube terminó bien y es íntegra para esta colección. */
  pullOk: boolean
  /** El llamador confirma que una nube vacía es real (ver regla (d)). */
  honorEmptyCloud?: boolean
}

export type MergeResult<T> = {
  /** Lista fusionada lista para pintar y persistir en local. */
  merged: T[]
  /** Récords locales nunca sincronizados: el llamador debe subirlos. */
  upsertLocalOnly: T[]
  /** false → la fusión no se aplicó; el llamador conserva su estado local. */
  applied: boolean
}

export function mergeCloudList<T extends { id: string }>(input: MergeInput<T>): MergeResult<T> {
  const { cloud, local, syncedBefore, hydrated, pullOk } = input
  // Regla (c): sin hidratación o sin lectura íntegra no se toca nada.
  if (!hydrated || !pullOk) {
    return { merged: [...local], upsertLocalOnly: [], applied: false }
  }
  // Regla (d): nube vacía con memoria previa = sospechosa hasta confirmarla.
  if (cloud.length === 0 && !input.honorEmptyCloud && (local.length > 0 || syncedBefore.size > 0)) {
    return { merged: [...local], upsertLocalOnly: [], applied: false }
  }
  const cloudIds = new Set(cloud.map((x) => x.id))
  // Lo nunca sincronizado y ausente de la nube: se conserva y se sube.
  // Lo sincronizado antes y ausente de la nube: borrado en otro lado —
  // se cae de la copia local y NO entra ni en merged ni en upsert.
  const localOnly = local.filter((x) => !cloudIds.has(x.id) && !syncedBefore.has(x.id))
  // Regla (a): la nube entra COMPLETA, sin filtrar por ausencia local.
  // Regla (b): no se calcula ni se devuelve ningún borrado.
  return { merged: [...cloud, ...localOnly], upsertLocalOnly: localOnly, applied: true }
}

/**
 * Los campos EXTRA del prototipo (carril/función de un mensaje, tarifa y
 * pago de una reserva, tarifa preferencial de un cliente…) viven solo en
 * el dispositivo: las tablas de la nube no los tienen todavía y los
 * mapeos de crm-cloud.ts no los transportan. Al fusionar, la versión de
 * la nube gana en los campos compartidos; los extras se re-enganchan
 * desde la copia local anterior con el mismo id, para que un pull no se
 * los lleve por delante.
 */
export function preserveExtras<T extends { id: string }>(
  merged: readonly T[],
  previousLocal: readonly T[],
  fields: readonly string[],
): T[] {
  if (!previousLocal.length || !fields.length) return [...merged]
  const prevById = new Map(previousLocal.map((x) => [x.id, x]))
  return merged.map((item) => {
    const prev = prevById.get(item.id)
    if (!prev) return item
    const out: Record<string, unknown> = { ...(item as Record<string, unknown>) }
    const src = prev as Record<string, unknown>
    for (const f of fields) {
      if (src[f] !== undefined) out[f] = src[f]
    }
    return out as T
  })
}

/** Conjunto sincronizado tras un ciclo confirmado: ids de la nube más
 *  los locales cuya subida el llamador confirmó. Solo se llama cuando la
 *  escritura terminó bien — la memoria de sincronizados jamás se anota
 *  por adelantado (esa era la otra mitad del defecto: ids marcados como
 *  sincronizados antes de que la subida existiera). */
export function nextSyncedIds<T extends { id: string }>(
  cloud: readonly T[],
  upsertedOk: readonly T[],
): Set<string> {
  const out = new Set<string>()
  for (const x of cloud) out.add(x.id)
  for (const x of upsertedOk) out.add(x.id)
  return out
}
