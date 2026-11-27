# Copiloto V7 — Punto 9: Integral Verification
Fecha: 2026-11-27

## Trabajo realizado
Se consolidó el pipeline existente `.github/workflows/copiloto-v7-preview-build.yml` para la rama `feat/copiloto-v7-phase1-foundation`. Ahora incluye:
1. instalación con pnpm 12.3.4 y lockfile congelado;
2. verificación TypeScript con `pnpm exec tsc --noEmit`;
3. prueba existente `pnpm test:crm-push`;
4. build de Next.js `pnpm build`.

Se eliminó el workflow redundante `.github/workflows/copiloto-v7-verify.yml` para no ejecutar dos builds paralelos. El pipeline no publica, no usa credenciales y no toca bases de datos.

Commits de consolidación: `c1bc31c9251fafdfdd1fa26d385c38d0662e751d` y `44a8f538c300beb0d8434da83af34a14d526a78a`.

## Estado de ejecución observado
- No se obtuvo una ejecución de GitHub Actions confirmada para los últimos commits.
- El último combined status consultado para el commit `44a8f538c300beb0d8434da83af34a14d526a78a` no devolvió checks de estado.
- Los checks anteriores de Vercel estaban en failure por `build-rate-limit` del equipo; no son fallos de compilación de la rama ni resultados de los tests.
- La publicación temporal de Railway que llegó a SUCCESS corresponde a `main`, no al commit de esta rama.

## Pruebas integrales todavía necesarias
- Build y typecheck de la rama.
- Navegación y responsive desktop/iPhone en preview de la rama correcta.
- Auth y aislamiento entre usuarios y entre Transport/Taxes.
- RLS, endpoints sin sesión/expirada, MFA, recuperación y revocación.
- Storage privado, permisos, retención, auditoría y recuperación de documentos.
- Comunicaciones: webhook, idempotencia, outbox, opt-out, aprobación humana y prueba sin entrega real.
- Transport: persistencia, disponibilidad, reservas, conciliación y peajes.
- Taxes: privacidad documental, workflow, revisión y autorización antes de e-file.
- Work Opportunities: recepción autorizada, datos faltantes, costos completos y sin auto-accept.
- Square Sandbox: scopes, webhooks, idempotencia y pruebas de pagos/refunds solo sandbox.

## Estado
Pipeline de verificación configurado, pero la ejecución del build y los tests no está confirmada. Punto 9 permanece abierto. No declarar listo para producción.
