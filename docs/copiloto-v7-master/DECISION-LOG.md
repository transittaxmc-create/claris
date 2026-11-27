# Copiloto V7 — registro de decisiones del usuario

Este registro consolida requisitos explícitos recuperados de conversaciones anteriores y documentos del proyecto. Si una decisión cambia, registrar fecha, motivo y aprobación.

## Producto y alcance
- Copiloto V7/B7 es el proyecto correcto. Integrarlo dentro de Claris existente como CRM/módulo operativo independiente.
- Copiloto permanece como nombre de plataforma.
- CRM como icono independiente en menú inferior, sin quitar ni modificar opciones actuales, y carga lazy al entrar.
- Base Supabase nueva e independiente.
- Agenda acepta solicitudes/citas desde WhatsApp, SMS, llamadas y captura por compartir/copiar/pegar; recordatorios incluso sin fecha.

## Negocios
- Transport = Island City Transit.
- Taxes = Brakha Group Tax Services.
- Transitax como nombre corporativo final está pendiente.
- No cambiar cuentas/números WhatsApp ni migrarlas durante esta fase.
- WhatsApp Business Transport: 934-208-1400.
- WhatsApp personal utilizado para Taxes: 934-200-8109.

## Separación y protección
- Supabase CRM mimgwleghecseoymgdug.
- Supabase financiero legado zrcnpmipdhpjdjkfrrgt no se debe confundir, modificar ni usar para CRM.
- No tocar Money, Projections, Plaid ni variables financieras.
- No usar datos reales de clientes ni documentos fiscales durante desarrollo.
- No enviar comunicaciones reales ni procesar pagos reales.
- No aceptar oportunidades automáticamente.
- Aprobación humana explícita para mensajes salientes, aceptación de trabajo y movimiento de dinero.
- Seguridad reforzada requisito previo a clientes reales.
- Cada dispositivo es captura/consulta, no almacén maestro; registros/documentos recuperables desde almacenamiento privado central al cambiar de iPhone; MFA y revocación de dispositivo perdido.

## CRM existente — reglas históricas
- Prospecto/mensaje nuevo no recibe número de cuenta automáticamente.
- Cuenta nace solo cuando usuario acepta mensaje y crea ficha, o crea ficha manualmente.
- Formato ACT-0-###, primer número documentado ACT-0-100. No reescribir cuentas existentes; conservar códigos ICT históricos.
- No tocar caso de Mr. Shah.

## Integraciones
- Square administrable desde Copiloto en operaciones compatibles (customers, invoices, documentos y otras capacidades confirmadas), manteniendo Square como sistema conectado de pagos.
- Square Sandbox primero; no live transactions.
- WhatsApp Personal/grupos no se lee por scraping. ZapClaw Coexistence no lee grupos y no soporta WhatsApp Personal directamente; no prometer ingestión automática.
- Evaluar forwarding/share/captura manual o API oficial autorizada.
- Twilio existe según conversación anterior, pero no integración CRM productiva verificada; token previamente expuesto, nunca repetir/pedir en chat.
- Gmail connector de ChatGPT no significa que Claris tenga Gmail API conectada.
- Toda función externa distingue API real, deep link, handoff manual o no soportada.

## UX
- Profesional, moderna, responsive escritorio/iPhone.
- Copiloto centro de operaciones, no maqueta desconectada.
- Documentos y registros organizados en categorías/carpetas y recuperables centralmente.
- Minimizar vueltas/conversaciones; no volver a preguntar decisiones guardadas.
- Documentar en Copiloto → How This Works y carpeta master GitHub para continuidad.

## Seguridad y publicación
- No merge a main ni deploy producción sin aprobación explícita.
- Railway preview para pruebas sintéticas.
- Vercel claris es destino final; no crear proyecto permanente alterno.
- Reconciliar migraciones antes de SQL.
- Nunca exponer secretos ni incluirlos en documentación.
