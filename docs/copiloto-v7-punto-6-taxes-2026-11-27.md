# Copiloto V7 — Punto 6: Tax Preparation Preview
Fecha: 2026-11-27

## Alcance implementado
Se agregó `components/copiloto-v7-preview/tax-workspace.tsx` y se integró desde `app/copiloto-v7-preview/page.tsx` en `feat/copiloto-v7-phase1-foundation`.

La interfaz de demostración incluye:
- Cola de expedientes sintéticos y búsqueda/filtro por estado.
- Tax year, tipo de declaración y estados de intake, documentos, preparación, revisión, autorización y filing.
- Checklist local de documentos para organizer, identidad, ingresos, deducciones y registros de vehículo/millas.
- Alta local de expedientes de muestra.
- Ciclo de trabajo propuesto con autorización explícita del cliente antes de filing.

## Límites y seguridad
- No es un portal tributario ni un sistema de preparación fiscal conectado.
- No ingresar SSN, ITIN, fecha de nacimiento, datos bancarios, W-2/1099 ni documentos reales.
- No hay OCR, almacenamiento documental privado, integración con software tributario, e-file, persistencia CRM ni notificaciones.
- No se ejecutaron migraciones ni cambios en Supabase.
- Los estados y cifras son demostrativos; cambiar un caso a Filed no transmite una declaración.

## Cambios
- Commit del componente: `df74bdd7a2865c2b6a8f72c2f86f0a8ef8334b58`
- Commit de integración: `816713f30ce1e74c4dd71edf385d00f06cab0628`
- Commit de continuidad: `d070ef819528f6341b162472f3bd37f9e4a3a68a`

## Verificación pendiente
Build, typecheck, pruebas automatizadas y QA visual pendientes. No hay deployment validado de esta rama. La publicación temporal de Railway observada en esta sesión corresponde a `main`, no a la rama V7.

## Estado
Interfaz de demostración implementada y documentada. Persistencia, seguridad, documentos, cálculos tributarios, integraciones, e-file y pruebas de extremo a extremo pendientes. No habilitar con clientes reales.
