"use client"

/**
 * Procedures manual — Island City Transit / Copiloto.
 * Access: MORE → HOW IT WORKS
 * Organized by topic. Update it every time a rule or flow changes.
 */

export function HowItWorksScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8 pt-3">
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
          Island City Transit
        </p>
        <h1 className="text-xl font-extrabold text-white">Copiloto — Procedures Manual</h1>
        <p className="mt-1 text-[12px] leading-snug text-neutral-400">
          Every amount saves automatically. Everything is editable. Nothing counts as done until
          verified on the phone.
        </p>
      </header>

      <Section title="1. TODAY — daily trip entries">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Top strip:</B> shift timer (<B>START / PAUSE / RESUME / END</B>), live mileage
            counter, and <B>GROSS TODAY</B> — hidden on open (privacy in front of the passenger), tap
            to show/hide.
          </li>
          <li>
            <B>TODAY | REGISTER</B> line: two totals under the strip, both hidden on open. Each one
            shows/hides with its own tap.
          </li>
          <li>
            <B>Header:</B> greeting + your live location with neighborhood, e.g.{" "}
            <B>Midtown · 5th Ave, New York</B>. Refreshes automatically.
          </li>
          <li>
            <B>PLATFORM</B> → <B>ECONOMY</B> → <B>LOCATIONS</B> → <B>NOTES</B> →{" "}
            <B>REGISTER | SAVE</B>.
          </li>
          <li>
            <B>ECONOMY</B> colors: <B>FARE</B>, <B>EXTRA CASH</B>, <B>TIPS</B> in green;{" "}
            <B>TOLLS</B> in amber; <B>FEE</B> in red.
          </li>
          <li>
            <B>LOCATIONS:</B> capture pickup/dropoff with GPS. Capturing the <B>pickup</B> starts
            toll detection (no need to press START).
          </li>
        </ul>
      </Section>

      <Section title="2. Tolls — automatic E-ZPass detection">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            With the pickup captured, each GPS fix is checked against <B>25 NY/NJ plazas</B> (2026
            E-ZPass discounted rates).
          </li>
          <li>
            When you pass a plaza, the amount appears <B>live in the TOLLS box</B> and accumulates if
            you pass more than one. A blue notice shows plaza + amount.
          </li>
          <li>
            Each toll is written to <B>NOTES</B>: <B>[HH:MM] Plaza name - $X.XX</B> — this is the
            payment record.
          </li>
          <li>
            <B>Uber / Lyft rule:</B> the toll IS recorded in TOLLS (for control), but it is{" "}
            <B>NOT added to GROSS</B> — Uber/Lyft already pay it inside the fare. Counting it would
            double-count.
          </li>
          <li>
            <B>All other trips:</B> the toll IS added to GROSS.
          </li>
          <li>
            <B>GROSS</B> = fare + extra cash + tips (+ toll, except Uber/Lyft). <B>NET</B> = GROSS −
            FEE.
          </li>
          <li>
            If a toll wasn't detected, type it manually in TOLLS and add the{" "}
            <B>[HH:MM] Plaza - $X.XX</B> line in NOTES so the record is complete.
          </li>
        </ul>
      </Section>

      <Section title="3. TOLL AUDIT (MORE) — E-ZPass reconciliation">
        <P>
          A register <B>only for E-ZPass</B>. Nothing to do with the bank.
        </P>
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>GPS toll log:</B> automatic, built from the trip notes.
          </li>
          <li>
            <B>Scan statements:</B> extracts date, time, plaza, amount and <B>reference number</B>{" "}
            per charge. Same reference scanned twice = merged (not a duplicate).
          </li>
          <li>
            <B>Reconciliation</B> statement ↔ GPS: <B>MATCHED</B> · <B>DUPLICATE</B> ·{" "}
            <B>NO GPS MATCH</B> · <B>NOT ON STATEMENT</B>. <B>Copy report</B> button for the plain-text
            report.
          </li>
          <li>
            <B>Weekly bill:</B> detected tolls accumulate into <B>ONE bill due Friday</B> (not one
            per day). Partial payments before Friday deduct from it.
          </li>
        </ul>
      </Section>

      <Section title="4. EARNINGS — daily jobs and receivables">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Each completed trip appears here, grouped by platform.</li>
          <li><B>GROSS</B> / <B>NET</B> for the day, trip count, and weekly total (Mon–Sun).</li>
          <li>Trip status: <B>PENDING</B>, <B>MATCHED</B>, <B>SHORT</B>, <B>OVER</B>.</li>
          <li><B>Update receivables → Money</B> (⋯ menu) sends the day's net by platform to MONEY.</li>
          <li>Hourly rate shows on TODAY next to the daily total (green if on pace).</li>
          <li>Quick platform buttons on TODAY for faster entry; BREAK is in the ⋯ menu.</li>
        </ul>
      </Section>

      <Section title="5. MONEY — registers and projections">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>One register per account</B> (Quicken style). The <B>★ main account</B> is the one
            you pick in <B>DATA → ACCOUNTS</B> — tap the ★ on any account there to make it the main
            one, and use its switch to choose which accounts show in MONEY and count in
            Projections. Accounts are hidden, never deleted.
          </li>
          <li>
            <B>Real bank balance first, projected second — never mixed</B> in the same view. Only
            the projected balance may go negative.
          </li>
          <li>
            <B>Projected register:</B> OPENING BALANCE (real bank) → movements → DAY CLOSE per day
            → CLOSING BALANCE.
          </li>
          <li>
            <B>Recurring rows:</B> tap for <B>Skip this day</B> / <B>$0 this day</B>. Changing the
            date with <B>Just this time</B> moves that occurrence. Frequencies: one-time, daily,
            weekly, monthly.
          </li>
          <li>
            <B>Transfers NEVER inflate income.</B> <B>Who pays mandates:</B> platforms (Uber, Lyft,
            Empower, Gallant, AKI Mobility, TG TEXPORT, CTG, Aventus Ride) = real income. Your own
            cards/accounts moving money (UBER PRO CARD, BRANCH, bank-to-bank) = internal transfer.
          </li>
        </ul>
      </Section>

      <Section title="6. REPORTS">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Financial Statement:</B> income/expenses from real bank data, by date range.
          </li>
          <li>
            <B>Schedule C (DRAFT):</B> IRS form draft — a CPA must review before filing. Mileage
            fills automatically from the log.
          </li>
          <li>
            <B>Mileage log:</B> IRS format (date, destination, business purpose, miles). Starts when
            you press START; every saved trip adds pickup → dropoff.
          </li>
          <li>
            <B>Weekly vendor report:</B> spending by vendor and category, weeks grouped by month.
          </li>
        </ul>
      </Section>

      <Section title="7. MORE">
        <P>
          <B>Expenses</B> (receipt scan + manual) · <B>Envelopes</B> (rent, leasing, phone) ·{" "}
          <B>Pending deposits</B> (money held by platforms) · <B>Data</B> (backup, sync, reset) ·
          this manual.
        </P>
      </Section>

      {/* ───────────────────────────────────────────────────────────── */}
      <Section title="8. DATA & BACKUP — where data lives and how to switch phones">
        <P>
          <B>Implementado: 2026-11-13 · Autor: Miguel / Copiloto V7</B>
        </P>

        <P>
          <B>Dónde vive cada dato:</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Viajes (trips):</B> en este teléfono — localStorage{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">ic_tip_tracker</code>{" "}
            + copia en IndexedDB. Si el navegador borra caché, IndexedDB devuelve los viajes al
            abrir la app.
          </li>
          <li>
            <B>Gastos (expenses):</B>{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">ic_expenses</code>{" "}
            (localStorage) + copia IndexedDB.
          </li>
          <li>
            <B>Ledger / proyecciones / recurrentes:</B>{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">claris_cash_flow_entries</code>{" "}
            ·{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">claris_scheduled_entries</code>{" "}
            (localStorage).
          </li>
          <li>
            <B>Fotos de recibos y statements:</B> servidor Vercel Blob (almacén de archivos de
            Vercel). Se suben vía{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">/api/receipt-image</code>{" "}
            al escanear. El ID de cada imagen queda guardado dentro de{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">claris_receipts_v1</code>.
            Para auditoría del IRS, las fotos se pueden subir también a Google Drive (ver paso 3
            abajo).
          </li>
          <li>
            <B>Respaldos completos (backup JSON):</B> Google Drive del usuario — carpeta{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              Copiloto_Auditoria_Recibos
            </code>
            . El archivo incluye TODOS los datos de la app: trips, expenses, ledger, cuentas,
            configuración.
          </li>
          <li>
            <B>Sync entre teléfonos (código privado):</B> Vercel Blob — archivo cifrado{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              claris-sync-&lt;hash&gt;.enc
            </code>
            . El servidor solo ve el hash y texto cifrado; nunca ve los datos en claro.
          </li>
          <li>
            <B>Banco (Plaid):</B> Vercel Blob — snapshot en{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">bank-snapshot.json</code>.
            Se refresca automáticamente cada 5 minutos en la app.
          </li>
          <li>
            <B>Tokens Google Drive:</B> Vercel Blob —{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">gdrive-tokens.json</code>
            . Solo el servidor los lee; el teléfono solo ve si está conectado o no.
          </li>
        </ul>

        <P>
          <B>Procedimiento para cambiar de teléfono (paso a paso):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Paso 1 — Conectar Google Drive (solo la primera vez):</B> ir a DATA → BACKUP →
            sección PHONE TRANSFER. Presionar <B>Conectar Drive →</B> (botón gris pequeño arriba a
            la derecha). Google pide permiso para "ver y administrar solo los archivos que creó esta
            app". Aceptar. La app regresa y el botón cambia a{" "}
            <B>✓ Drive · desconectar</B>.
          </li>
          <li>
            <B>Paso 2 — SUBIR a Drive:</B> presionar <B>SUBIR A DRIVE</B>. La app construye el
            respaldo completo y lo sube directamente a Google Drive sin descargar nada al teléfono.
            El archivo queda en la carpeta{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              Copiloto_Auditoria_Recibos
            </code>{" "}
            con nombre{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              copiloto-respaldo-YYYY-MM-DD.json
            </code>
            . Si ya existe un archivo con el mismo nombre, se sobreescribe.
          </li>
          <li>
            <B>Paso 3 — En el otro teléfono, abrir la app y conectar Drive:</B> igual que el paso
            1. Usar la misma cuenta de Google.
          </li>
          <li>
            <B>Paso 4 — RESTAURAR desde Drive:</B> presionar <B>RESTAURAR DRIVE</B>. La app lista
            los respaldos disponibles en la carpeta. Elegir el archivo deseado (el más reciente
            aparece primero). Se muestra un resumen: fecha, # entradas, # gastos, # viajes. Presionar{" "}
            <B>SÍ, RESTAURAR</B> para confirmar. La app se recarga y queda idéntica al teléfono
            original.
          </li>
          <li>
            <B>Sin Drive conectado:</B> el botón SUBIR descarga el archivo JSON al teléfono (igual
            que antes). El botón RESTAURAR pide elegir un archivo local. Ambos modos siguen
            funcionando.
          </li>
        </ul>

        <P>
          <B>Procedimiento para fotos de recibos y statements (auditoría IRS):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            Escanear recibo o statement con la cámara desde EXPENSES → botón de cámara. La foto se
            sube a Vercel Blob automáticamente y la IA extrae monto, fecha, vendor.
          </li>
          <li>
            Para tenerlas en Google Drive (recomendado para auditoría): subir el respaldo completo
            con SUBIR A DRIVE — el backup JSON contiene los IDs de todas las imágenes, que están en
            el servidor Vercel Blob. Las fotos en sí se pueden descargar desde DOWNLOAD ALL (FULL
            BACKUP) o desde el registro de gastos.
          </li>
          <li>
            <B>Carpeta en Drive:</B>{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              Copiloto_Auditoria_Recibos
            </code>{" "}
            — nombre diseñado para identificar de inmediato que es documentación de auditoría.
          </li>
        </ul>

        <P>
          <B>Rutas API nuevas (implementadas 2026-11-13):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/status</code>{" "}
            → si Drive está conectado.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/auth</code>{" "}
            → inicia el flujo OAuth2 de Google.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/callback</code>{" "}
            → Google redirige aquí tras autorizar; guarda tokens en Vercel Blob.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">POST /api/gdrive/upload</code>{" "}
            → sube un archivo a la carpeta de Drive.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/restore</code>{" "}
            → lista o descarga respaldos de Drive.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">DELETE /api/gdrive/disconnect</code>{" "}
            → borra los tokens (desconecta Drive).
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              GET/POST/DELETE /api/sync
            </code>{" "}
            → sync entre teléfonos. <B>Reparado 2026-11-13</B>: antes usaba Supabase (quota
            agotada); ahora usa Vercel Blob.
          </li>
        </ul>

        <P>
          <B>Variables de entorno requeridas en Vercel (para Google Drive):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GOOGLE_CLIENT_ID</code>{" "}
            — de Google Cloud Console, proyecto OAuth2.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GOOGLE_CLIENT_SECRET</code>{" "}
            — mismo proyecto.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GOOGLE_REDIRECT_URI</code>{" "}
            = https://claris-lime.vercel.app/api/gdrive/callback
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">BLOB_READ_WRITE_TOKEN</code>{" "}
            — Vercel Blob (ya configurado; lo usan también bank snapshot y receipt images).
          </li>
        </ul>

        <P>
          <B>Notas de seguridad:</B> el backup JSON no está cifrado (es un archivo privado en tu
          Drive personal). El sync entre teléfonos SÍ está cifrado con AES-GCM-256 derivado de tu
          código privado — el servidor nunca ve los datos en claro. Los tokens de Drive se guardan
          en Vercel Blob con nombre no-adivinable y solo el servidor los lee.
        </P>
      </Section>

      <Section title="9. TAXES 2026 — Schedule C and self-employment">
        <P>All figures come from trips and business-classified expenses. A CPA must review before filing.</P>
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Official forms:</B> Schedule C, Schedule SE, Form 1040, Form 8995. Open from REPORTS → Tax Worksheet.</li>
          <li><B>Tax Worksheet:</B> REPORTS shows auto-filled lines you can edit. PDFs open in a new tab.</li>
          <li><B>Mileage 2026:</B> $0.725/mi (Jan–Jun), $0.76/mi (Jul–Dec).</li>
          <li><B>SE tax:</B> 15.3% on net profit. Half is deductible.</li>
          <li><B>QBI:</B> 20% deduction on qualified business income.</li>
          <li><B>Social Security wage base 2026:</B> $184,500.</li>
          <li><B>Vehicle:</B> choose standard mileage OR actual expenses — not both.</li>
          <li><B>Always deductible:</B> tolls, parking, platform fees, transfer fees, business supplies.</li>
          <li><B>Data flow:</B> trips → line 1; fees → line 10; business expenses → category lines; net → Schedule SE.</li>
          <li><B>Weekly:</B> REPORTS → This week / Last week. Set aside ~25–30% of net for taxes.</li>
          <li>Only <B>business</B> expenses count. Personal and unclassified do not.</li>
          <li>Outstanding receivables are not income until received.</li>
        </ul>
      </Section>

      <Section title="10. Standing rules">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Steady:</B> screens are fixed — no lateral shifting when typing, on every screen.
          </li>
          <li>
            <B>Privacy:</B> money amounts start hidden (••••••); each one shows with its own tap.
          </li>
          <li>
            <B>One place per fact:</B> each piece of data lives in a single place, no duplicates
            across views.
          </li>
          <li>
            <B>Approval first:</B> the assistant suggests; bulk changes to the ledger wait for your
            approval.
          </li>
          <li>
            <B>Deployed ≠ done:</B> done = you see it and confirm it on your phone.
          </li>
        </ul>
      </Section>


      <Section title="11. CRM COPILOTO V7 — CONTINUIDAD OFICIAL DEL PROYECTO">
        <P>
          <B>Actualizado: 2026-11-25 · Documento de referencia para Miguel y todos los agentes.</B>
          Esta sección es la fuente de continuidad del CRM. Leerla completa antes de investigar,
          modificar código, bases de datos, permisos o despliegues. No asumir ni inventar estados.
        </P>

        <P><B>Identidad y ubicación del módulo:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Nombre canónico: <B>CRM Copiloto V7</B>. “B7” fue una confusión al dictar/escribir; usar V7.</li>
          <li>El CRM es un módulo dentro de Copiloto V7 / aplicación Claris; no crear una aplicación separada.</li>
          <li>Repositorio identificado: <B>transittaxmc-create/claris</B>. Archivo principal de interfaz: <B>components/copiloto/crm-screen.tsx</B>.</li>
          <li>Acceso del usuario: abrir <B>More → Client management → CRM</B>. CRM permanece dentro de More; NO agregarlo como icono nuevo al menú inferior ni alterar las opciones existentes.</li>
          <li>Este registro oficial está en <B>More → Help → How it works</B>, en el archivo <B>components/copiloto/how-it-works-screen.tsx</B>.</li>
        </ul>

        <P><B>Expediente maestro — conversación inicial, visión y alcance acordado:</B></P>
        <P>
          El punto de partida del 2026-11-25 fue añadir una función CRM a la aplicación Claris
          que ya existe y guardar allí la información de clientes. La decisión del propietario
          fue continuar dentro de esa misma aplicación y repositorio: NO crear otra aplicación,
          otro repositorio ni un sistema paralelo. El nombre correcto es <B>Copiloto V7 CRM</B>.
          Este CRM debe desarrollarse como módulo propio, sin interferir con el producto financiero
          que ya funciona en Claris.
        </P>
        <P>
          La visión inicial recuperada contempla una gestión centralizada de clientes y contactos,
          expedientes/casos, servicios, documentos, citas, tareas, actividades e historial. Las
          entidades de negocio que se propusieron para estructurar esa base fueron perfiles,
          organizaciones, membresías, clientes, contactos, servicios, trabajos de transporte,
          casos de impuestos, documentos, citas, tareas y registros de actividad. <B>Importante:</B>
          esa lista fue una propuesta de estructura; no significa que esas tablas ya estén creadas
          en Supabase. Verificar el esquema real antes de afirmar que existe.
        </P>
        <P>
          La experiencia prevista debe permitir conocer quién es cada cliente, cómo contactarlo,
          qué servicio o asunto tiene, qué se habló, qué documentos faltan, cuál es la próxima
          acción y cuándo hay que volver a contactarlo. El historial debe dar continuidad a cada
          relación y evitar perder conversaciones o seguimientos. Las funciones de expedientes,
          documentos, citas, tareas y actividad forman parte del alcance a desarrollar; la primera
          pantalla CRM actual todavía no implementa todo ese alcance.
        </P>

        <P><B>Canales de comunicación e integraciones — registrar como alcance pendiente:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Llamadas y email:</B> la versión actual ya permite abrir el marcador del teléfono mediante tel: y el correo mediante mailto: desde la ficha del cliente. No confundir estas acciones con una central telefónica o un sistema de email integrado.</li>
          <li><B>SMS / mensajes de texto:</B> debe contemplarse como canal de comunicación del CRM para conversaciones y seguimiento con clientes. No hay proveedor, número remitente, credenciales, API ni flujo de envío/recepción verificados en el proyecto al 2026-11-25. No afirmar que SMS está conectado.</li>
          <li><B>WhatsApp Business:</B> debe contemplarse como integración de mensajería empresarial, separada del WhatsApp personal. Deben investigarse y definirse la cuenta/Business Portfolio de Meta, número empresarial, verificación, proveedor/API oficial, plantillas cuando correspondan, consentimiento del cliente, recepción de respuestas y registro de la conversación en el historial. No hay proveedor, cuenta, número, credenciales ni conexión confirmados todavía.</li>
          <li><B>Historial unificado:</B> objetivo de diseño: que llamadas registradas, emails, SMS y mensajes de WhatsApp que se integren queden asociados al contacto/cliente y a su actividad, con fecha, canal, dirección (entrante/saliente) y resultado. Esta es una especificación de producto pendiente de implementación, no una capacidad actual.</li>
          <li><B>Automatizaciones:</B> planificar recordatorios y tareas de seguimiento relacionados con fechas de contacto, citas, documentos pendientes y tareas vencidas. Definir reglas, horarios, zona horaria, preferencias y consentimiento antes de activar envíos automáticos.</li>
          <li><B>Push:</B> además de SMS/WhatsApp, se mantiene el requisito conversado de notificaciones push incluso con la app cerrada, cuando el sistema operativo/navegador lo permita y el usuario haya concedido permiso. Servicio, worker, suscripciones y entrega no están verificados.</li>
          <li><B>Proveedores:</B> no seleccionar ni inventar Twilio, Meta Cloud API u otro proveedor como decisión tomada. Investigar opciones y costos cuando llegue el momento; documentar la decisión y sus credenciales como variables secretas de servidor, nunca en el cliente.</li>
        </ul>

        <P><B>Mapa de ubicaciones, proyectos y enlaces de referencia:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Aplicación existente:</B> <a className="text-yellow-300 underline" href="https://claris-lime.vercel.app/" target="_blank" rel="noreferrer">https://claris-lime.vercel.app/</a> — URL de Claris compartida previamente por el propietario. No asumir que este dominio recibe automáticamente cada despliegue del proyecto Vercel llamado claris.</li>
          <li><B>GitHub — repositorio:</B> <a className="text-yellow-300 underline" href="https://github.com/transittaxmc-create/claris" target="_blank" rel="noreferrer">https://github.com/transittaxmc-create/claris</a> — propietario/organización <B>transittaxmc-create</B>, repositorio <B>claris</B>, rama de producción observada <B>main</B>.</li>
          <li><B>CRM UI:</B> <a className="text-yellow-300 underline" href="https://github.com/transittaxmc-create/claris/blob/main/components/copiloto/crm-screen.tsx" target="_blank" rel="noreferrer">components/copiloto/crm-screen.tsx</a>.</li>
          <li><B>Este manual / continuidad:</B> <a className="text-yellow-300 underline" href="https://github.com/transittaxmc-create/claris/blob/main/components/copiloto/how-it-works-screen.tsx" target="_blank" rel="noreferrer">components/copiloto/how-it-works-screen.tsx</a>.</li>
          <li><B>Componente contenedor:</B> <B>CopilotoApp</B> dentro de la aplicación Next.js 16. La entrada del CRM debe seguir la navegación ya acordada <B>More → Client management → CRM</B>.</li>
          <li><B>Vercel — proyecto desplegado en esta sesión:</B> <a className="text-yellow-300 underline" href="https://vercel.com/island-city/claris" target="_blank" rel="noreferrer">https://vercel.com/island-city/claris</a> — nombre <B>claris</B>, ID <B>prj_EaOp8GqqgF0i4BBEp3CJSY8phcKW</B>, conectado al repositorio GitHub anterior.</li>
          <li><B>Despliegue que contiene este informe:</B> <a className="text-yellow-300 underline" href="https://claris-og1od35q6-island-city.vercel.app" target="_blank" rel="noreferrer">https://claris-og1od35q6-island-city.vercel.app</a> — producción READY verificada; deployment <B>dpl_CRKKT7EMyCcRFBF1NuR8xetFsBxB</B>; commit <B>34bc18e642911c84ff5c0341afec2532e240dbe8</B>.</li>
          <li><B>Otro proyecto Vercel:</B> <B>claris-lime</B> es un proyecto separado en Vercel conectado al mismo repositorio. No se debe decir que este último despliegue actualizó claris-lime; verificar el proyecto y su último deployment antes de publicar allí o cambiar dominios.</li>
          <li><B>Supabase exclusivo CRM:</B> Project ID <B>mimgwleghecseoymgdug</B>; URL de proyecto <a className="text-yellow-300 underline" href="https://mimgwleghecseoymgdug.supabase.co" target="_blank" rel="noreferrer">https://mimgwleghecseoymgdug.supabase.co</a>. Acceso directo al dashboard: <a className="text-yellow-300 underline" href="https://supabase.com/dashboard/project/mimgwleghecseoymgdug" target="_blank" rel="noreferrer">abrir proyecto CRM</a>. Este dashboard URL se deriva del Project ID confirmado; autorización aún pendiente.</li>
          <li><B>Supabase financiero (NO usar para CRM):</B> Project ID <B>zrcnpmipdhpjdjkfrrgt</B>. Pertenece a Claris / Island City Transit y debe permanecer aislado.</li>
        </ul>

        <P><B>Stack y configuración que deben verificarse antes de continuar:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Aplicación: Next.js 16, React y componente principal <B>CopilotoApp</B>, en el repositorio <B>transittaxmc-create/claris</B>.</li>
          <li>En la conversación de configuración se compartieron instrucciones para instalar <B>@supabase/supabase-js</B> y <B>@supabase/ssr</B> y configurar clientes/middleware de sesión. Antes de reinstalar o duplicar archivos, inspeccionar package.json, lockfile, helpers de Supabase y middleware para saber qué quedó realmente aplicado.</li>
          <li>Variables CRM esperadas en Vercel deben apuntar únicamente al proyecto <B>mimgwleghecseoymgdug</B>. Confirmar los nombres y valores existentes sin imprimir secretos. Nunca copiar las credenciales del proyecto financiero ni exponer service-role/secret keys al navegador.</li>
          <li>El usuario indicó que intentó autorizar Supabase y que no le aparecía el flujo como en una conexión anterior. La revisión de herramientas del 2026-11-25 no pudo acceder al proyecto CRM: autorización/permisos siguen siendo el bloqueo principal. No crear tablas ni cambiar variables hasta confirmar el proyecto correcto.</li>
        </ul>

        <P><B>Estado de decisiones — confirmado, propuesto y pendiente:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Confirmado por el propietario:</B> CRM dentro de Claris existente; nombre V7; Supabase separado para CRM; finanzas y Plaid intactos; acceso por More → Client management → CRM; no añadir opción al menú inferior.</li>
          <li><B>Implementado y verificado en código:</B> pantalla inicial de clientes con alta/edición/eliminación, búsqueda, filtros, estados, notas, fecha de seguimiento, botones tel: y mailto:, y almacenamiento local en <B>claris_crm_clients_v1</B>.</li>
          <li><B>Propuesto, no confirmado como creado:</B> esquema relacional con perfiles, organizaciones, membresías, clientes, contactos, servicios, trabajos de transporte, casos de impuestos, documentos, citas, tareas y actividad; roles, Auth y RLS.</li>
          <li><B>Pendiente:</B> acceso efectivo a Supabase CRM, inspección del esquema real, persistencia cloud, migración segura de datos locales, documentos/expedientes/citas/tareas completas, SMS, WhatsApp Business, automatizaciones y push probado en segundo plano.</li>
          <li><B>No decidido / no recuperado:</B> proveedor de SMS, proveedor/API de WhatsApp, número empresarial, cuentas/credenciales de Meta, costos, plantillas, reglas de campañas y consentimiento detallado. No solicitar de nuevo al propietario información que ya aparezca en chats o enlaces; primero revisar el historial y las cuentas conectadas disponibles.</li>
        </ul>

        <P><B>Objetivo y alcance:</B></P>
        <P>
          Construir un CRM profesional para organizar clientes y prospectos, contactos,
          conversaciones, notas, seguimiento, citas, documentos y tareas. El CRM debe ser un
          módulo independiente en sus datos y permisos, aunque comparta la aplicación y su
          navegación. Mantener la experiencia ligera: no leer ni cargar registros del CRM hasta
          que el usuario abra el módulo. La pantalla se monta cuando tab === CRM; no afirmar que
          existe división de bundle/code-splitting sin verificarla.
        </P>

        <P><B>Lo que existe actualmente — verificado en el código:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>components/copiloto/crm-screen.tsx</B> implementa alta, edición y eliminación de clientes; búsqueda por nombre, empresa, teléfono y correo; filtros y contadores.</li>
          <li>Campos actuales: nombre, empresa, teléfono, email, estado, origen, notas/historial de interacción, próxima fecha de contacto y fecha de creación.</li>
          <li>Estados actuales: Lead, Active, Follow-up e Inactive. Orígenes: Referral, Website, Social media, Returning client, Walk-in y Other.</li>
          <li>Acciones disponibles: llamar por teléfono, enviar email, abrir detalle, editar y eliminar cliente.</li>
          <li>La clave de almacenamiento actual es <B>claris_crm_clients_v1</B> en localStorage. Por tanto, los registros actuales quedan guardados en ese dispositivo/navegador; todavía no hay persistencia CRM en la nube confirmada.</li>
          <li>El componente muestra expresamente que Cloud sync se habilitará después de autorizar el acceso a la base de datos CRM.</li>
        </ul>

        <P><B>Supabase — separación obligatoria:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Proyecto Supabase destinado exclusivamente al CRM V7, según la información del propietario: <B>mimgwleghecseoymgdug</B>. Debe verificarse el acceso y la identidad del proyecto antes de ejecutar cambios.</li>
          <li>Proyecto financiero Claris / Island City Transit: <B>zrcnpmipdhpjdjkfrrgt</B>. Es distinto y NO debe utilizarse para guardar datos CRM.</li>
          <li>En la revisión del 2026-11-25, el listado de proyectos accesibles no mostró el proyecto CRM y la consulta directa devolvió falta de permisos. Estado: <B>acceso al proyecto CRM no verificado / pendiente de autorización</B>. No decir que la conexión está lista.</li>
          <li>Después de recuperar autorización: inspeccionar el proyecto correcto; diseñar tablas CRM independientes, relaciones, índices, Auth y políticas RLS; probar permisos por usuario/rol antes de habilitar datos reales.</li>
          <li>Planificar una migración segura desde localStorage, si existen registros, con respaldo, conteo y verificación antes/después. No borrar ni sobrescribir registros locales.</li>
        </ul>

        <P><B>Notificaciones push — requisito acordado, no implementación confirmada:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>El propietario requiere que las notificaciones puedan llegar incluso cuando la aplicación esté cerrada, sujeto al soporte del dispositivo/navegador y a que el usuario otorgue permiso.</li>
          <li>Casos de uso previstos: nuevos clientes/prospectos, seguimientos pendientes, citas próximas, documentos recibidos, tareas y vencimientos.</li>
          <li>Estado al 2026-11-25: requisito conversado; no se ha verificado servicio push, registro de dispositivos/tokens, permisos, worker ni entrega en segundo plano. No afirmar que push ya funciona ni que existe autorización del teléfono.</li>
          <li>Antes de implementarlo, revisar la arquitectura y decisiones previas; definir consentimiento por usuario, almacenamiento seguro de suscripciones/tokens, envío desde servidor y apertura del CRM en el registro relacionado.</li>
        </ul>

        <P><B>Protección del módulo financiero — regla crítica para todos los agentes:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>El CRM no debe modificar pantallas, lógica, tablas, credenciales, variables de entorno ni datos del módulo financiero.</li>
          <li>No tocar Plaid, balances, transacciones bancarias, proyecciones, ledger, gastos, ingresos, sincronización bancaria ni reglas de conciliación para desarrollar CRM.</li>
          <li>No cambiar el esquema ni las credenciales de <B>zrcnpmipdhpjdjkfrrgt</B> como parte del trabajo CRM. Usar exclusivamente el proyecto CRM autorizado.</li>
          <li>No ejecutar reset, truncate, borrados masivos, migraciones generales ni cambios de configuración compartida sin autorización explícita y respaldo verificado.</li>
          <li>Preferir cambios pequeños y aislados en archivos CRM. Revisar el diff para confirmar que no se modificaron módulos financieros o navegación no relacionada.</li>
        </ul>

        <P><B>Próximos pasos, en este orden:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Recuperar y verificar autorización del Supabase CRM <B>mimgwleghecseoymgdug</B>; confirmar que no se está trabajando en el Supabase financiero.</li>
          <li>Inspeccionar el código y el estado real del proyecto; documentar lo que ya existe antes de cambiarlo.</li>
          <li>Diseñar y crear el esquema CRM con Auth/RLS, relaciones e índices, exclusivamente en el proyecto CRM autorizado.</li>
          <li>Conectar el módulo actual a la nube, preservar los datos locales y probar altas, ediciones, búsquedas, permisos y persistencia entre dispositivos.</li>
          <li>Diseñar e implementar push notifications para los eventos acordados, y probar entrega con la aplicación cerrada en dispositivos compatibles y con permiso concedido.</li>
          <li>Verificar el resultado en la aplicación real y actualizar esta sección con fecha, archivos cambiados, pruebas, resultados y siguiente tarea.</li>
        </ol>

        <P><B>Protocolo obligatorio para el siguiente agente:</B></P>
        <P>
          Antes de actuar, leer esta sección y revisar el código actual. Continuar desde el estado
          verificado, no desde suposiciones ni desde mensajes aislados. No reconstruir el CRM,
          no duplicar funciones existentes, no mover CRM fuera de More, no cambiar el menú inferior
          y no tocar el módulo financiero. Si un acceso o estado no puede verificarse, detener ese
          cambio y documentar el bloqueo. Después de cada sesión, actualizar esta sección con
          trabajo completado, pruebas reales, pendientes y el punto exacto para continuar.
        </P>
      </Section>

      <p className="mt-6 text-center text-[10px] text-neutral-600">
        Island City Transit · Copiloto procedures manual · update with every rule change
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3.5">
      <h2 className="mb-2 text-[13px] font-extrabold text-white">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[12px] leading-relaxed text-neutral-300 last:mb-0">{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-yellow-400/95">{children}</strong>
}
