# COPILOTO V7 — DOCUMENTO MAESTRO DE ENFOQUE Y EJECUCIÓN
**Corte:** 27 de noviembre de 2026  
**Propósito:** detener la repetición de tareas, conservar las decisiones y dirigir el trabajo hacia un CRM funcional, seguro y verificable.

> Síntesis de las conversaciones recuperadas del 26 y 27 de noviembre, los documentos maestros, How This Works y el código de la rama. No es una transcripción literal. Cuando una nota antigua contradiga una prueba o el código actual, prevalece la evidencia más reciente.

## 1. Misión: qué estamos construyendo

Construir **Copiloto V7** como el centro de administración y operaciones de los negocios, integrado dentro de la aplicación Claris existente. No es una aplicación nueva que reemplace Claris ni una maqueta visual aislada. Es un CRM y centro operativo conectado a una base CRM propia, desde el que se administran las funciones que los proveedores externos permitan integrar.

Copiloto recibe información, organiza, crea expedientes, conserva el historial, analiza y prepara acciones. El usuario conserva el control. Toda comunicación saliente, aceptación de trabajo y movimiento financiero sensible requiere aprobación humana explícita.

**Resultado esperado:** administrar desde Copiloto Transport, Taxes y Work Opportunities; consultar clientes, mensajes, documentos, citas, tareas, reservas, oportunidades, facturas y estados en un lugar; y recuperar los registros desde otro dispositivo sin depender del teléfono original.

## 2. Límites innegociables

- Proyecto: Copiloto V7, dentro del repositorio transittaxmc-create/claris.
- Base CRM nueva: Supabase mimgwleghecseoymgdug.
- Base financiera/Plaid antigua: Supabase zrcnpmipdhpjdjkfrrgt. Está fuera del CRM: NO TOCAR.
- No modificar ni romper Today, Entry, Earnings, Money/Projections, Reports, viajes, peajes, gastos, balances, backups o Plaid. CRM es un módulo independiente y lazy-loaded.
- No reemplazar la aplicación Claris completa ni cambiar la ruta raíz para convertirla en el preview V7.
- No fusionar a main, desplegar a producción ni alterar producción sin aprobación explícita.
- Railway es solo entorno temporal de revisión. Vercel claris es el destino final tras revisión y autorización.
- No usar clientes reales, SSN/ITIN, declaraciones, W-2/1099 ni documentos fiscales reales durante desarrollo.
- No enviar SMS, WhatsApp o email reales; no aceptar oportunidades ni procesar pagos/reembolsos reales.
- No cambiar, renombrar ni migrar números o cuentas WhatsApp durante esta fase.
- No usar scraping de WhatsApp Web ni afirmar que se pueden leer grupos personales.
- No ejecutar DDL/migraciones ni modificar el ledger hasta resolver la discrepancia histórica documentada.
- No copiar secretos a código, logs o documentación. El token Twilio/ZapClaw previamente expuesto se considera comprometido y debe rotarse antes de usar esas integraciones.

## 3. Estructura funcional del producto

### A. Consola principal y experiencia por dispositivo
- **Escritorio:** centro de administración profundo, navegación lateral y vistas amplias para expedientes, tablas, documentos, facturación, configuración, reportes y control de operaciones.
- **Teléfono / Copiloto Go:** herramienta rápida de campo, no copia reducida del dashboard. Prioriza Today, Inbox, Trips, Clients y acciones inmediatas con pocos pasos.
- Estados visibles y honestos: demo, pendiente, requiere aprobación, completado, fallido, no conectado. Nunca presentar una simulación como operación real.

### B. Transport — Island City Transit
- Clientes, contactos, reservas, pasajeros, solicitudes, viajes, asignaciones, vehículos y seguimiento.
- Pickup, paradas, destino, fecha/hora, vuelo/aerolínea/terminal cuando aplique, tarifa, estado y notas.
- Historial de servicio y comunicaciones unido al expediente correcto.
- Agenda, recordatorios, seguimientos y tareas.
- Preparar operaciones compatibles desde Copiloto; proveedores externos siguen siendo sistemas conectados.
- WhatsApp Business Transport: **934-208-1400**. No cambiarlo en esta fase.

### C. Taxes — Brakha Group Tax Services
- Expediente por cliente y año fiscal; intake, organizer, checklist, documentos, preparación, revisión, autorización y seguimiento.
- Historial de conversación y documentos vinculados al cliente/año correcto.
- Bóveda fiscal privada, separada de fotos de clientes y de Transport.
- OCR sobre capturas temporales; conservar originales finales en almacenamiento central.
- Autorización expresa del cliente antes de e-file. Marcar Filed solo con confirmación real del proveedor.
- WhatsApp personal utilizado para Taxes: **934-200-8109**. Preferencia: conservarlo si es técnicamente viable. No convertirlo a Business ni migrarlo sin análisis, respaldo y autorización.

### D. Communications Center — un historial, áreas separadas
- Una bandeja unificada para canales realmente conectados.
- Preservar mensaje original, remitente, destinatario, canal, número/cuenta, fuente, grupo cuando aplique, timestamp, ID externo y adjuntos.
- Clasificación y resumen de IA separados del original, con área destino y confianza.
- Enrutar a Transport, Taxes o Work Opportunities sin cruzar expedientes ni permisos.
- Buscar, filtrar, marcar leído, asignar responsable, vincular cliente/reserva/expediente, crear tarea y preparar borrador.
- Estados veraces: Draft → Pending approval → Approved → Queued → Sent (solo con confirmación del proveedor), o Failed / Not sent.
- Approved o Queued nunca significa Sent. Aprobación humana explícita para cada mensaje saliente. Registrar aprobación, envío, resultado, errores y auditoría.
- Consentimiento, STOP/opt-out, límites del canal e idempotencia.

### E. Clients — perfil 360
- Expediente de contacto con identidad, teléfonos/emails, preferencias, consentimientos, origen, notas, tareas, citas, reservas, mensajes y documentos autorizados.
- Una persona puede relacionarse con Transport y Taxes, pero expedientes, permisos y documentos siguen separados.
- Prospecto o mensaje nuevo no recibe automáticamente un número de cuenta.
- Regla histórica: ACT-0-### se asigna cuando el usuario acepta el contacto y crea la ficha, o cuando la crea manualmente; primer número documentado ACT-0-100. No reescribir códigos existentes ni IDs históricos ICT.
- No tocar el expediente de Mr. Shah como prueba.

### F. Documents — bóveda central privada
- Los teléfonos son dispositivos de captura/consulta, nunca el almacenamiento maestro.
- Si un iPhone se pierde, cambia, se borra o se resetea, iniciar sesión en otro dispositivo y recuperar registros/documentos desde almacenamiento central privado, con MFA y revocación independiente del dispositivo perdido.
- Separar capturas temporales de OCR de documentos originales/finales.
- Metadatos: propietario, unidad, cliente/expediente, tipo, año, versión, hash, MIME/tamaño, estado OCR, retención y auditoría de acceso.
- URLs firmadas de corta duración, rutas no adivinables y permisos verificados.
- El bucket crm-client-photos es para fotos; no usarlo para documentos fiscales.

### G. Work Opportunities — evaluación de ofertas
- Capturar ofertas, guardar fuente y original, extraer datos y alertar rápidamente.
- Clasificación acordada:
  - **VERDE — La quiero:** máxima prioridad.
  - **AMARILLA — La puedo mirar:** requiere evaluación o faltan datos.
  - **ROJA — No me interesa:** fuera de la bandeja/alertas activas; conservar solo lo necesario para auditoría.
- Evaluar vehículo, categoría comercial, capacidad/equipaje, horario, disponibilidad, pickup, destino, distancia al pickup, millas vacías, pago, espera, duración, peajes, combustible, parking, costos, rentabilidad y deadline.
- Separar requisitos excluyentes de preferencias flexibles. No inventar distancias, pagos ni datos. Información faltante queda visible y normalmente requiere revisión amarilla.
- Preparar respuesta YES editable; nunca enviar ni aceptar automáticamente. Aprobación humana explícita.
- Limitación confirmada: WhatsApp Personal/grupos no ofrece API oficial equivalente para leer grupos; ZapClaw Coexistence revisado no lee grupos. No prometer captura automática. Empezar con compartir/reenviar/captura manual u otra vía oficial verificada.

### H. Square — administración desde Copiloto
- El objetivo es gestionar desde Copiloto las operaciones compatibles de Square: clientes, invoices, documentos/adjuntos y operaciones transaccionales permitidas.
- Square permanece como sistema conectado de pagos; Copiloto es el centro de control y no debe fingir que reemplaza el ledger de Square.
- Cada acción se clasifica como API compatible dentro de Copiloto, handoff/deep link al dashboard de Square o no soportada.
- Sandbox primero; OAuth/scopes mínimos, webhooks firmados, idempotencia y auditoría.
- No almacenar datos de tarjetas. Cobros, capturas, reembolsos y acciones sensibles requieren aprobación humana. Sin pagos reales en desarrollo.

### I. Agenda, tareas y notificaciones
- Crear citas/solicitudes desde canales conectados o captura por compartir/copiar/pegar, incluso si falta una fecha.
- Recordatorios, seguimientos, vencimientos y tareas vinculadas a cliente, unidad, reserva, expediente u oportunidad.
- Push local no equivale a push remoto con app cerrada. Verificar registro, entrega, reintentos, dispositivo y revocación.
- No mostrar contenido fiscal sensible en notificaciones de pantalla bloqueada.

## 4. Decisiones técnicas ya tomadas

- Repositorio: transittaxmc-create/claris.
- Rama: feat/copiloto-v7-phase1-foundation.
- Supabase CRM: mimgwleghecseoymgdug.
- Supabase financiero legado (NO TOCAR): zrcnpmipdhpjdjkfrrgt.
- Railway review: proyecto copiloto-v7-temporal, entorno review, servicio copiloto-v7-preview.
- Preview previsto: https://copiloto-v7-preview-review.up.railway.app.
- Vercel claris: destino final cuando se autorice; no publicar producción ahora.
- Copiloto conserva su nombre; Transport = Island City Transit; Taxes = Brakha Group Tax Services. Nombre corporativo Transitax sigue sin decidir.
- CRM es acceso independiente y lazy-loaded; no quitar Today, Earnings, Money, Reports ni More.
- Supabase CRM es el sistema principal de expedientes; integraciones externas son adaptadores.
- No añadir tablas/migraciones hasta reconciliar el historial SQL aplicado.

## 5. Estado real: no confundir demo con producto terminado

### Existe / evidencia registrada
- Rama feature separada de main. HEAD verificado al corte: f8c559ff59ba09038bdb64d966e67d42e83a61a4.
- Carpeta de continuidad docs/copiloto-v7-master/ y secciones de continuidad en components/copiloto/how-it-works-screen.tsx.
- CRM añadido como acceso independiente en la navegación de la rama y carga lazy del CRMScreen.
- Preview escritorio /copiloto-v7-preview con pantallas demostrativas: Overview, Communications, Clients, Documents, Transport, Taxes, Work Opportunities y Square.
- Prototipo móvil /copiloto-v7-go con Today, Inbox, Trips, Clients y More.
- La interfaz demo usa datos sintéticos y estado React local. No persiste al refrescar ni está conectada a la base CRM.
- Auditorías de migraciones, Auth/MFA/RLS, endpoints, Storage y límites de proveedores ya están registradas en CURRENT-STATE y How This Works. No repetirlas sin evidencia nueva.

### No está terminado
- No existe todavía una vertical V7 completa con persistencia de punta a punta.
- El preview no está conectado a Supabase CRM; en la última prueba documentada /api/crm/state devolvió 503 crm_cloud_not_configured por falta de variables CRM en Railway review.
- No hay membresías/unidades Transport vs Taxes ni autorización multiárea implementada.
- MFA no estaba enrolado en los usuarios observados; leaked-password protection estaba desactivada. Seguridad no está lista.
- Dos versiones aplicadas del ledger (20261126033314 y 20261126035245) no tienen el SQL original recuperado; además hay scripts con efectos visibles sin registro ledger. No ejecutar DDL hasta resolver procedencia.
- No hay bóveda fiscal separada, versionado, OCR final ni recuperación verificada.
- Taxes y Work Opportunities son demostraciones locales, no persistencia.
- SMS dispatch devuelve 501; outbox no equivale a envío. WhatsApp, email y Twilio no están conectados/verificados en CRM.
- No se ha verificado push remoto ni entrega con app cerrada.
- Square no está conectado ni probado en Sandbox.
- No hay integración tax software/e-file verificada.
- No se ha completado QA visual real de escritorio/iPhone.

### Comprobaciones registradas
- pnpm run test:crm-push: PASS 4/4 en el commit de referencia anterior.
- pnpm run build: PASS en clon limpio documentado para la versión previa de navegación.
- pnpm exec tsc --noEmit: FAIL con 66 diagnósticos en main y feature en la comparación anterior; mismo conjunto, sin nuevos en feature. El typecheck global sigue fallando.
- Railway deployment previo SUCCESS en commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e; no prueba que el último commit esté desplegado.
- Último deployment observado al corte: 3accbe2e-e61c-410c-91aa-be114cf82f18, commit f8c559ff..., estado **BUILDING**. No entregar URL como funcional hasta SUCCESS y verificación HTTP/rutas.
- Push registration: no verificada. Cuatro tests locales de validación aprobados; registro remoto y entrega real pendientes.

## 6. Por qué parece que estamos dando vueltas

Hemos invertido trabajo en documentación, auditorías y prototipos, pero todavía no cerramos una función real de extremo a extremo. Hay pantallas, rutas y componentes de demostración, pero no una vertical conectada con base de datos, permisos, persistencia, auditoría y pruebas. Por eso puede parecer que avanzamos visualmente sin que el CRM esté operativamente avanzado.

La solución no es seguir agregando pantallas, renombrando secciones ni repetir auditorías ya documentadas. La solución es trabajar por una vertical completa, terminarla con evidencia y solo entonces pasar a la siguiente. Las auditorías ya completadas se reutilizan; solo se repiten si hay una pregunta o evidencia nueva.

## 7. Orden obligatorio de ejecución — sin saltos

### Paso 1 — Cerrar el preview actual
- Consultar el deployment Railway más reciente y su SHA.
- Si BUILDING, esperar; si FAILED, leer logs y corregir solo el error comprobado.
- Si SUCCESS, probar URL y rutas /copiloto-v7-preview y /copiloto-v7-go.
- QA visual real en escritorio y iPhone: navegación, ancho de seis accesos, formularios, overflow, estados, consola y recarga.
- Registrar build, tests, typecheck, URL, screenshots y defectos. No mezclar este cierre con rediseños no solicitados.

### Paso 2 — Cerrar el bloqueo de base de datos y seguridad
- Recuperar desde Git/historial verificable el SQL exacto de 20261126033314 y 20261126035245; documentar procedencia de scripts no ledger.
- No reconstruir SQL a partir de efectos, no reejecutar migraciones reflejadas ni editar manualmente el ledger.
- Diseñar membresías/unidades de negocio y permisos Transport/Taxes.
- Resolver MFA, password protection, sesiones/dispositivos, autorización servidor, RLS, Storage y pruebas negativas A/B de lectura/escritura/borrado.
- Aplicar cambios solo tras revisión SQL y pruebas sintéticas en entorno autorizado.

### Paso 3 — Primera entrega funcional: Clients + Transport + Communications
Este es el primer vertical y debe ser el foco. No comenzar otro módulo hasta que pase:
1. Modelo persistente de cliente, contacto, reserva/servicio, mensaje, tarea y vínculo de unidad.
2. Autenticación y autorización por usuario/unidad en servidor y RLS.
3. Crear, consultar, editar y archivar con auditoría e idempotencia.
4. Historial 360: mensajes y operaciones unidos al expediente correcto; original inmutable y análisis separado.
5. Bandeja de aprobación; todo mensaje saliente requiere aprobación; ningún estado se marca Sent sin respuesta real del proveedor.
6. Persistencia tras recarga y recuperación desde otro dispositivo.
7. Pruebas sintéticas A/B: ningún dato Transport visible desde Taxes ni viceversa.
8. QA escritorio/iPhone y actualización de How This Works + CURRENT-STATE.

### Paso 4 — Documents vault y Taxes
- Crear bóveda privada separada; límites MIME/tamaño; versiones/hash; OCR temporal; retención; auditoría y restore.
- Después conectar expediente Taxes, año fiscal, checklist, documentos, revisión y aprobación.
- No datos reales ni e-file real durante desarrollo.

### Paso 5 — Work Opportunities
- Implementar captura segura manual/share/forward de una fuente autorizada.
- Parser con fuente/original, extracción, datos faltantes y confianza.
- Motor verde/amarillo/rojo con disponibilidad y costos; explicar cada clasificación.
- Borrador YES con aprobación explícita; sin aceptación ni envío automático.

### Paso 6 — Canales y notificaciones
- ZapClaw SMS (proveedor elegido por el usuario; NO Twilio), sujeto a verificar primero API/webhooks/auth oficiales; luego opt-out y pruebas sintéticas/sandbox.
- Email con proveedor/API autorizado.
- WhatsApp solo por métodos oficiales compatibles; mantener números actuales; no lectura de grupos personales ni scraping.
- Push: registro remoto, entrega con app abierta/cerrada, reintentos y revocación probados.
- Todo mensaje saliente requiere aprobación.

### Paso 7 — Square Sandbox
- Identificar app/cuenta Sandbox y scopes.
- Implementar primero lectura/directorio e invoices/documentos compatibles.
- Verificar cada acción por API; handoff al dashboard o marcar no soportada cuando corresponda.
- Webhooks firmados, idempotencia, auditoría y aprobación de acciones de dinero.
- No pagos reales.

### Paso 8 — QA integral y preparación de release
- Build, tests, typecheck (separar deuda baseline de errores nuevos), pruebas negativas, seguridad, recuperación, responsive, accesibilidad y rendimiento.
- Actualizar documentos y preparar PR/diff.
- No merge a main ni producción sin aprobación expresa separada.

## 8. Regla de terminado por función

Una función no se considera terminada por tener pantalla o botón. Solo se cierra cuando:
1. UI desktop/móvil y estados loading/empty/error están completos.
2. Backend y persistencia funcionan; los datos sobreviven recarga y cambio de dispositivo.
3. Autorización de servidor y RLS impiden acceso cruzado.
4. Auditoría e idempotencia están implementadas.
5. Tests positivos y negativos pasan con datos sintéticos.
6. Proveedor externo está probado en Sandbox, si aplica, o el límite está explícitamente documentado.
7. QA visual y de interacción está completada.
8. How This Works y CURRENT-STATE reflejan la evidencia y fueron releídos para verificar.

## 9. Disciplina para evitar desviaciones

- Antes de cada cambio: identificar el paso actual, criterio de aceptación y archivos exactos que se modificarán.
- No volver a auditar ni reescribir lo ya documentado sin evidencia nueva.
- No crear prototipos nuevos mientras exista una vertical incompleta que pueda implementarse.
- No abrir más de un frente técnico a la vez.
- Después de cada cambio: build/test apropiado, verificar diff, registrar commit y actualizar estado.
- Si una dependencia externa bloquea, completar lo que sí puede construirse y dejar el bloqueo con acción concreta; no simular conexión.
- En cada deployment informar READY/BUILDING/FAILED, commit/SHA, URL probada, push registration y pruebas push; indicar expresamente si How This Works fue actualizado.
- No volver a pedir al usuario decisiones ya registradas. Preguntar solo si falta una autorización realmente necesaria.

## 10. Próxima acción exacta

**No comenzar otro rediseño ni volver a hacer el inventario desde cero.** Primero cerrar y verificar el deployment BUILDING del commit f8c559ff59ba09038bdb64d966e67d42e83a61a4 y el acceso móvil/escritorio. Luego resolver el bloqueo histórico de migraciones y seguridad; inmediatamente después construir la vertical Clients + Transport + Communications de punta a punta. Mantener toda la ejecución en la rama feature y usar solo datos sintéticos.

**Este documento es la guía de enfoque vigente.** Si una tarea no contribuye al paso actual o a un bloqueo explícito, se pospone para no desviar el trabajo.


---

## 10. ACTUALIZACIÓN DE CONTINUIDAD — conversaciones del 26–27 nov 2026 (añadido 14:10 ET)

Esta sección amplía el documento maestro existente; no crea un proyecto paralelo ni sustituye decisiones anteriores. Se recuperaron las conversaciones recientes disponibles y se contrastaron con `CURRENT-STATE.md`, este documento y el manual de continuidad. No es una transcripción literal de todos los chats: conserva requisitos y decisiones relevantes. Cuando el estado del código/deployment contradiga un mensaje anterior, prevalece la evidencia técnica más reciente.

### 10.1 Objetivo de producto reafirmado
- Construir el CRM Copiloto V7 como una sola experiencia coherente dentro de Claris, sin reconstruir ni reemplazar la aplicación financiera existente.
- Las tres piezas a integrar son: (1) funciones operativas actuales de Claris que deben preservarse, (2) arquitectura y módulos CRM Copiloto V7, y (3) registros/funciones del CRM. No son tres bases de datos que deban fusionarse.
- Copiloto debe ser el centro principal de operaciones: recibe y organiza información, crea/actualiza expedientes, conserva historial y coordina proveedores externos.
- No seguir produciendo pantallas aisladas ni prototipos alternos. El siguiente avance debe ser una función vertical real con datos sintéticos, persistencia, permisos, auditoría y pruebas.

### 10.2 Experiencia diferenciada por dispositivo — decisión del usuario
**Escritorio = oficina / administración profunda**
- Dashboard completo, navegación lateral, tablas y paneles amplios.
- Administración de clientes, expedientes, documentos, análisis, configuración, integraciones y reportes.
- La riqueza funcional no debe sacrificarse.

**Teléfono / Copiloto Go = herramienta de campo / velocidad**
- No es una versión comprimida del escritorio ni un tablero lleno de atajos.
- Prioridad: hacer el trabajo rápido mientras el usuario está en movimiento (solo cuando sea seguro y legal usar la pantalla).
- Acciones prioritarias: Inbox y respuesta a mensajes; crear/editar reservas y viajes; localizar/seleccionar cliente y consultar su perfil; registrar pickup/destino/precio/ubicación rápidamente; revisar y responder oportunidades.
- Pocos pasos, botones táctiles claros, formularios cortos con valores contextuales, autoguardado y confirmación visible.
- Complejidad del backend y beneficios del CRM permanecen; la interfaz reduce la carga cognitiva, no elimina funciones.
- La pantalla Today de Copiloto V7 es una referencia funcional de captura rápida: entrada de precio y ubicación sin navegación extensa. Reutilizar ese principio para Trips/Bookings y captura de oportunidades.
- Mantener una navegación simple y consistente; no convertir cada módulo en una colección de accesos rápidos.
- No exigir interacción visual al conducir. Voz/manos libres solo después de diseñar y probar un flujo seguro; no asumir que ya existe.

### 10.3 Flujo operativo que debe sentirse rápido
1. Llega solicitud por canal disponible o captura manual.
2. Copiloto conserva el mensaje original y lo clasifica sin alterar el contenido original.
3. Se encuentra un cliente existente o se crea un prospecto/ficha según la regla de aprobación; no asignar número de cuenta automáticamente a todo mensaje entrante.
4. Desde la conversación se puede crear una reserva/servicio con pickup, destino, fecha/hora, precio, notas y detalles aplicables.
5. Se puede preparar respuesta; cada mensaje saliente requiere aprobación humana explícita.
6. La reserva, el cliente, el mensaje, documentos y tareas quedan relacionados en el historial.
7. Estados visibles distinguen borrador, pendiente, aprobado, en cola, enviado confirmado y fallido. Nunca llamar “enviado” a algo solo guardado o en cola.
8. Todo debe persistir tras cerrar/recargar la app y recuperarse desde otro dispositivo.

### 10.4 Mensajería y clientes — decisiones del 27 nov
- Un historial unificado de comunicaciones con separación estricta por unidad Transport / Taxes.
- Perfil 360 interno para cada cliente: no crear portales públicos ni cuentas de autoservicio de cliente.
- Los expedientes se crean internamente cuando se aprueba/acepta un viaje o trabajo, o cuando el usuario crea manualmente la ficha; un mensaje entrante por sí solo no crea una cuenta formal.
- Implementar SMS por fases. Las pruebas serán con números de prueba/datos ficticios; no enviar a clientes reales.
- Aprobación obligatoria de cada mensaje saliente, incluso respuestas asistidas por IA.
- Guardar original, canal, cuenta/número, remitente/destinatario, timestamp, ID externo, adjuntos, estado de entrega, consentimiento/STOP y auditoría.
- Evitar pérdida/duplicación mediante webhooks, idempotencia, reintentos y registro de errores; no depender del historial local del teléfono.
- WhatsApp Personal/grupos: no prometer lectura automática de grupos ni scraping. Captura por compartir/reenviar o mecanismo oficial verificado.
- Números actuales a preservar: Transport WhatsApp Business 934-208-1400; Taxes WhatsApp personal 934-200-8109. No migrar, convertir ni cambiar cuentas/números sin análisis y autorización.

### 10.5 Square — aclaración de rol y hardware
- Square es procesador/proveedor de pagos y merchant services, no el CRM ni el dueño del expediente de cliente.
- Copiloto mantiene el perfil 360, servicios, reservas, comunicaciones y documentos. Square procesa y reporta las operaciones que la cuenta y APIs permitan; Copiloto vincula invoice/pago/estado al expediente.
- Investigar y verificar capacidades de la merchant account antes de prometer clientes, invoices, adjuntos, cobros, reembolsos o gestión de transacciones. Cada función debe quedar como API integrada, handoff a Square o no soportada.
- El hardware identificado es **Square Terminal con pantalla e impresora integrada**.
- Recibos de pagos: comprobar la ruta soportada por Terminal API y permisos/dispositivo; no asumir que es una impresora universal.
- Facturas, órdenes y documentos propios: la impresión en la impresora interna no se debe prometer vía API si Square no admite diseños arbitrarios; definir ruta compatible y verificarla.
- Sandbox primero. No cobrar, reembolsar ni enviar transacciones reales durante desarrollo.

### 10.6 Copiloto Go y enlaces de preview — precisión
- Se propuso la ruta `/copiloto-v7-go` y el enlace `https://copiloto-v7-preview-review.up.railway.app/copiloto-v7-go`; hubo varios intentos de deployment fallidos en el hilo anterior, por lo que no se debe inferir que esa ruta estaba disponible entonces.
- La conversación posterior compartió el preview principal y Go como enlaces de Railway, pero indicó expresamente que no se había verificado HTTP de ambas rutas en ese momento.
- El estado técnico de CURRENT-STATE al corte es la fuente de verdad para deployment y rutas. No afirmar “funcional” por tener URL o por deployment SUCCESS: comprobar HTTP, ruta y prueba visual/funcional.
- Las pantallas Copiloto Go/Preview son demostraciones locales hasta que CURRENT-STATE registre persistencia, backend y pruebas de extremo a extremo. No confundir interacciones React locales con CRM conectado.

### 10.7 Seguridad y límites no negociables reafirmados
- CRM Supabase `mimgwleghecseoymgdug`; Finanzas/Plaid `zrcnpmipdhpjdjkfrrgt` permanece completamente separado y fuera de alcance.
- No modificar Today, Entry, Earnings, Money/Projections, Reports, tolls, balances, backups o Plaid.
- No datos reales de clientes, SSN/ITIN, documentos fiscales, comunicaciones reales ni pagos reales hasta que seguridad y pruebas estén aprobadas.
- No merge a `main`, no despliegue Vercel productivo y no reemplazar la aplicación principal sin autorización expresa.
- No ejecutar migraciones/DDL ni tocar el ledger hasta recuperar/probar la procedencia de las dos migraciones históricas faltantes.
- No copiar secretos a código/documentación. El token Twilio/ZapClaw expuesto previamente se considera comprometido y debe rotarse antes de habilitarlo.

### 10.8 Foco de ejecución inmediato — no volver a empezar
**Punto de control:** el documento `CURRENT-STATE.md` ya registra las auditorías, el estado de Railway, los 66 diagnósticos TypeScript compartidos con main, las limitaciones de SMS/push/Square y la discrepancia del ledger. No repetir esas auditorías sin evidencia nueva.

**Siguiente secuencia obligatoria:**
1. Leer este documento y `CURRENT-STATE.md`; revisar el HEAD actual de la rama y el último deployment real. Resolver diferencias entre rama y deployment antes de compartir enlaces.
2. Cerrar el QA responsive pendiente de Preview y Go (escritorio + iPhone), sin rediseñar módulos no solicitados.
3. Resolver de forma segura la discrepancia de migraciones y el diseño de autorización/MFA/aislamiento Transport–Taxes. No aplicar DDL mientras falte el SQL/procedencia.
4. Implementar el primer flujo persistente: **Clients + Transport + Communications**. Prioridad UX móvil: mensaje/solicitud → cliente → reserva con precio y ubicación → borrador/respuesta con aprobación → historial persistente.
5. Completar pruebas sintéticas de aislamiento, autorización, persistencia/recuperación, idempotencia y auditoría.
6. Solo después avanzar a Documents/Taxes, Work Opportunities, canales SMS/WhatsApp/email, push y Square Sandbox, según criterios de aceptación de las secciones anteriores.

### 10.9 Regla de trabajo y entrega por cada sesión
Antes de editar, declarar internamente (y en el resumen de progreso cuando sea útil): hito actual, criterio de aceptación, archivos exactos y qué NO se tocará. Un solo frente técnico a la vez.
Después de editar: comprobar diff, commit, build/tests pertinentes, estado real de deployment si se desplegó, HTTP/rutas si se comparte enlace, y actualizar este documento + `CURRENT-STATE.md` + la sección correspondiente de `components/copiloto/how-it-works-screen.tsx`. No declarar documentación actualizada sin releerla.
Cada entrega debe dejar: qué cambió, archivos, commit, pruebas y resultados exactos, errores/limitaciones, estado Railway (READY/BUILDING/FAILED), push remoto (registrado/no verificado) y pruebas de notificación completadas/pendientes. No merge ni producción sin autorización.


### 10.10 Corrección de proveedor SMS — 2026-11-27
El usuario confirmó expresamente que **no está usando Twilio**. El proveedor a investigar e integrar para SMS es **ZapClaw** (Claw, no Cloud). Esta decisión supersede la propuesta histórica “Twilio primero” que aparece en How This Works §10. No reutilizar Twilio, no crear variables TWILIO_* y no migrar números. ZapClaw aún no está técnicamente verificado ni conectado al CRM. Investigar documentación oficial, API, autenticación, webhooks/callbacks, estados y límites antes de diseñar el adaptador. No pedir secretos en el chat; la credencial expuesta previamente debe rotarse en el panel oficial y guardarse solo como secreto del entorno autorizado. Pruebas sintéticas primero; sin mensajes reales ni cambios de número/cuenta sin aprobación expresa.
