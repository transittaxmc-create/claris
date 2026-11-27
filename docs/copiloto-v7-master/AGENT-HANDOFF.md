# Copiloto V7 — instrucciones de continuidad para el siguiente agente

## MANDATO
Actúa como responsable técnico (tech lead). No reinicies el trabajo ni vuelvas a preguntar lo documentado. Inspecciona el estado real antes de cambiar nada. Completa Copiloto V7 por verticales funcionales, con seguridad y evidencia, sin romper Claris/finanzas.

## Lectura obligatoria
1. docs/copiloto-v7-master/README.md
2. MASTER-PLAN.md
3. CURRENT-STATE.md
4. Este archivo.
5. components/copiloto/how-it-works-screen.tsx, especialmente §11, §14, §16–§23 y §24–§33.
6. Informes docs/copiloto-v7-punto-1 hasta punto-10 y docs/copiloto-v7-reconciliacion-migraciones-y-protecciones-2026-11-27.md.
7. GitHub feature branch HEAD y diff respecto de main; inspecciona código, migraciones y CI.
8. Estado real Railway/Vercel antes de deploy.

## Reglas innegociables
- No tocar Supabase financiero zrcnpmipdhpjdjkfrrgt, Plaid, finanzas, variables o lógica Money/Projections.
- CRM Supabase es mimgwleghecseoymgdug; no crear proyecto alterno.
- No merge a main ni publicar en Vercel production sin aprobación explícita.
- No datos reales, documentos fiscales, SSN/ITIN, mensajes, aceptación de ofertas ni pagos reales durante desarrollo.
- No ejecutar SQL/migraciones hasta recuperar y reconciliar archivos faltantes y ledger.
- No exponer/recopiar secretos. Token Twilio/ZapClaw expuesto previamente debe tratarse como comprometido; no pedirlo por chat.
- No scraping WhatsApp Web ni lectura de grupos no autorizada.
- No afirmar conexión sin prueba.
- Cada hito actualiza esta carpeta y How This Works; verificar con fetch.

## Estado inicial
- Branch feat/copiloto-v7-phase1-foundation; main intacta.
- Railway preview inicial SUCCESS: deployment 6c2ac0c8-725b-489c-ae86-a654bea2c3fd, commit faf2350ffcc3e4e5166fa4f64d1d12671d09924a; URL https://copiloto-v7-preview-review.up.railway.app. Tras el cambio de navegación CRM se inició deployment 6a948e27-3a11-4f60-97ca-918914c55056 (commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e), último estado BUILDING; reconsultar Railway hasta terminal y verificar dominio.
- pnpm run test:crm-push: 4/4 PASS.
- Typecheck: 66 errores en feature y 66 idénticos en main; cero diagnósticos adicionales feature, pero typecheck global falla.
- / y /copiloto-v7-preview HTTP 200 por curl; screenshot/browser QA pendiente. El último cambio de navegación no está desplegado en Railway aún.
- UI V7 es DEMO/local state; no conectada a CRM DB. CRM se añadió a navegación inferior y se carga lazy desde la app anfitriona; tests 4/4 y build local PASS tras este cambio, typecheck permanece con 66 errores de baseline. Falta desplegar el commit nuevo y validar visualmente.
- Push remote/app-closed no verificado; Twilio/WhatsApp/Square/email/e-file no conectados.
- Punto 3 DB/security reconciliation abierto.

## Orden de trabajo

### A. Cerrar preview QA
1. Abrir preview con navegador compatible; escritorio/iPhone, navegación, overflow, consola, forms, teclado, estados.
2. Si browser QA no es posible, documentar método alterno y limitación.
3. Corregir defectos en feature branch.
4. Confirmar Railway source branch y SHA tras cada deployment.

### B. Cerrar Auth/seguridad antes de nuevos datos
1. Recuperar SQL exacto de 20261126033314 y 20261126035245 desde Git history/origen verificable.
2. Reconciliar cinco scripts no ledger y sus efectos; no re-ejecutar ni falsificar ledger.
3. Diseñar business_units/memberships y migraciones nuevas solo después de reconciliar.
4. Configurar/probar MFA, leaked password protection, sesiones, revocación y recovery.
5. Separación Transport/Taxes; RLS owner+membership y autorización server-side.
6. Tests negativos A/B para DB, API y Storage.
7. Bóveda fiscal privada separada del bucket fotos CRM; límites MIME/tamaño y URLs breves.
8. Backup y restore con datos sintéticos.

### C. Primer vertical end-to-end
Prioriza Clients + Transport reservations + Communications outbox:
1. Confirmar esquema y compatibilidad con CRM existente.
2. Persistencia server-side de clientes/reservas/mensajes/tareas.
3. Regla ACT-0-### (solo al aceptar/crear ficha; no autogenerar a cada prospecto).
4. Human approval; cola no equivale a envío.
5. Auditoría/idempotencia y estados exactos.
6. Pruebas por usuario/unidad, UI responsive y recuperación en otro dispositivo.

### D. Taxes + Documents
1. Tax cases/checklist/approval con relaciones a clientes Taxes.
2. Vault privado, versionado, temporal OCR vs original final.
3. Upload/download autorizado, signed URLs, MIME/size validation y audit.
4. Nunca documentos fiscales en crm-client-photos.
5. E-file solo si software/API compatible y autorización explícita probada.

### E. Work Opportunities
1. Captura manual/share/forwarding oficialmente soportado.
2. Parser conserva original y marca confidence/faltantes.
3. Evaluación completa de rentabilidad; no inventar datos.
4. Verde/amarillo/rojo y borrador YES; no enviar ni aceptar automáticamente.

### F. Comunicaciones y notificaciones
1. Twilio solo con credenciales seguras y pruebas webhook/status callback; opt-out.
2. Email provider/API autorizado.
3. WhatsApp solo APIs/métodos oficiales; no grupos personales.
4. Push: suscripción real, envío remoto, app cerrada, dispositivo revocado, permisos iOS; registrar resultados.
5. Toda comunicación externa con aprobación humana.

### G. Square
1. Identificar Developer App y Sandbox; OAuth/scopes mínimos.
2. Matriz de capacidades: API in-app, deep-link/handoff o unsupported.
3. Customers/invoices/documents primero; pagos/refunds solo Sandbox y aprobación.
4. Webhooks firmados, idempotencia y auditoría.
5. No live payments.

### H. Final QA y release
1. Build/tests/typecheck; distinguir deuda baseline.
2. Seguridad, privacidad, responsive, accesibilidad, rendimiento y errores.
3. Actualizar punto 9/10 y esta carpeta.
4. Preparar PR/diff; no merge/deploy production sin aprobación.
5. Reportar deployment READY/BUILDING/FAILED, push registration y pruebas push exactas.

## Documentación por hito
Registrar fecha, branch/commit, archivos, cambios, tests, DB/migration impact, seguridad, deployment ID/status/SHA/URL, screenshots, push status, riesgos y próximos pasos. Re-fetch How This Works y master para verificar. Nunca afirmar “terminado” sin evidencia.

## Reporte al usuario
En español simple y breve: hecho/comprobado, pendiente/bloqueado, riesgo/permiso, siguiente paso. No pedir repetir contexto ni hacer cuestionarios. Trabajar secuencialmente.
