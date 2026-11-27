# Copiloto V7 — Punto 10: Release Readiness
Fecha: 2026-11-27

## Fuente y destino
- Repositorio: `transittaxmc-create/claris`.
- Rama de trabajo: `feat/copiloto-v7-phase1-foundation`.
- Rama principal: `main`.
- Proyecto de publicación definitivo: Vercel `claris`.
- Supabase CRM asignado: `mimgwleghecseoymgdug`; no confundir con la base histórica de finanzas.
- Railway temporal: proyecto `copiloto-v7-temporal`, entorno `review`; la primera implementación de servicio quedó asociada a `main`, no está validada como preview V7.

## Bloqueos actuales
1. Vercel bloquea builds por límite diario del equipo (`api-deployments-free-per-day` / `build-rate-limit`).
2. No hay deployment V7 de la rama correcta ni URL pública verificada.
3. La integración GitHub de Railway no ha confirmado acceso a la rama de trabajo; el intento de conectar esa rama devolvió que el usuario no tiene acceso al repositorio. No utilizar la URL temporal de Railway como prueba del V7.
4. Build, typecheck, tests y QA visual V7 no están confirmados.
5. Punto 3 de base de datos/seguridad sigue abierto; la reconciliación de migraciones y las protecciones pendientes no deben aplicarse sin revisión.
6. Square, Twilio, WhatsApp, almacenamiento documental y demás integraciones no están conectados/verificados.
7. No hay aprobación de seguridad para clientes reales.

## Secuencia segura de transferencia
1. Terminar el trabajo en la rama de feature y documentar cada etapa en How This Works.
2. Resolver GitHub ↔ Railway y publicar un preview de la rama exacta, con datos sintéticos y sin secretos de producción.
3. Completar build, typecheck, pruebas, QA responsive y auditoría de seguridad.
4. Revisar el diff final y crear/actualizar PR contra `main`.
5. Obtener aprobación explícita antes de merge.
6. Tras el merge autorizado, esperar la disponibilidad de Vercel, desplegar primero Preview y verificarlo.
7. Aplicar migraciones solo después de reconciliar ledger/esquema y aprobar SQL; probar en entorno no productivo.
8. Producción solo con aprobación explícita y checklist de seguridad completo.

## Estado de publicación
- Vercel producción: sin cambios por esta etapa.
- Vercel preview V7: no disponible / no verificado.
- Railway: servicio temporal creado, pero el deployment SUCCESS observado es de `main`; no es la rama V7 ni tiene URL verificada.
- Merge a `main`: no realizado.
- Datos, mensajes y pagos reales: prohibidos durante desarrollo.

## Resultado
Punto 10 documentado como checklist y bloqueos. Copiloto V7 NO está listo para publicación ni para uso con clientes reales. La transferencia al proyecto original queda pendiente de aprobación explícita, verificación técnica y liberación de Vercel.
