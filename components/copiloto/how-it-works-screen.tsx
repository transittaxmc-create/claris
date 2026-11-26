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
          <li><B>Notificaciones:</B> ya existe una primera versión local documentada abajo: prueba manual en este dispositivo y aviso de seguimientos vencidos/al día cuando se abre el CRM. Esto NO equivale todavía a recordatorios automáticos de citas ni a push remoto programado con la app cerrada.</li>
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
          <li><B>Último despliegue de producción registrado:</B> <a className="text-yellow-300 underline" href="https://claris-lime.vercel.app/" target="_blank" rel="noreferrer">https://claris-lime.vercel.app/</a> — alias del proyecto Vercel <B>claris</B>; deployment <B>dpl_DyeTiM8ricAkko4eREZSVJPG51nT</B>, estado READY; commit <B>21a0a86230ffca0b9675194c36ab2f86c80d28c6</B>. Preview: <a className="text-yellow-300 underline" href="https://claris-9g25myvvb-island-city.vercel.app" target="_blank" rel="noreferrer">claris-9g25myvvb-island-city.vercel.app</a>.</li>
          <li><B>Otro proyecto Vercel:</B> <B>claris-lime</B> es un proyecto separado en Vercel conectado al mismo repositorio. No se debe decir que este último despliegue actualizó claris-lime; verificar el proyecto y su último deployment antes de publicar allí o cambiar dominios.</li>
          <li><B>Supabase exclusivo CRM:</B> Project ID <B>mimgwleghecseoymgdug</B>; URL de proyecto <a className="text-yellow-300 underline" href="https://mimgwleghecseoymgdug.supabase.co" target="_blank" rel="noreferrer">https://mimgwleghecseoymgdug.supabase.co</a>. Acceso directo al dashboard: <a className="text-yellow-300 underline" href="https://supabase.com/dashboard/project/mimgwleghecseoymgdug" target="_blank" rel="noreferrer">abrir proyecto CRM</a>. Este dashboard URL se deriva del Project ID confirmado; autorización aún pendiente.</li>
          <li><B>Supabase financiero (NO usar para CRM):</B> Project ID <B>zrcnpmipdhpjdjkfrrgt</B>. Pertenece a Claris / Island City Transit y debe permanecer aislado.</li>
        </ul>

        <P><B>Modelo operativo personal — propietario único y aprobación humana:</B></P>
        <P>
          Este CRM está pensado principalmente para Miguel como operador individual de su cartera
          de clientes, no para una empresa grande con cientos de empleados. La primera versión debe
          priorizar sencillez, rapidez en el teléfono, bajo costo operativo, privacidad y control
          directo. Preparar roles y permisos para crecer más adelante, pero no introducir complejidad
          empresarial innecesaria en la experiencia inicial.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Bandeja unificada:</B> objetivo de recibir en una sola ficha los mensajes entrantes por SMS y WhatsApp Business y, cuando se integre, email. Mostrar cliente, canal, fecha, conversación e historial.</li>
          <li><B>Asistente de respuesta:</B> al entrar un mensaje, la IA puede resumirlo y preparar un borrador de respuesta usando el historial y los datos permitidos del cliente. Miguel revisa, edita y pulsa <B>APROBAR Y ENVIAR</B>. Por defecto, la IA NO envía respuestas externas automáticamente. La aprobación humana es obligatoria salvo que Miguel autorice más adelante automatizaciones específicas y limitadas.</li>
          <li><B>Notificación al propietario:</B> avisar a Miguel de nueva conversación, cita próxima, nuevo pedido/solicitud, documento recibido y seguimiento vencido. La notificación debe abrir directamente la ficha o conversación correspondiente.</li>
          <li><B>Notificación al cliente:</B> confirmaciones y recordatorios por el canal que el cliente haya elegido y autorizado. Mantener separados los avisos internos al propietario y los mensajes externos al cliente.</li>
          <li><B>Citas:</B> al crear o cambiar una cita, guardar fecha, hora, zona horaria, cliente, servicio, ubicación y estado. Programar recordatorio interno a Miguel; ofrecer confirmación/recordatorio al cliente solo si existe consentimiento y canal habilitado. Manejar cancelación y reprogramación.</li>
          <li><B>Seguimientos:</B> cada cliente puede tener próxima acción, fecha/hora, responsable (inicialmente Miguel), prioridad y estado. El CRM debe crear avisos antes del vencimiento y mostrar una lista de tareas de hoy/atrasadas.</li>
          <li><B>Registro de consentimiento:</B> guardar por contacto y por canal si autorizó SMS, WhatsApp y email; fecha/hora, método y alcance (transaccional/servicio o marketing), además de bajas y preferencias. No asumir que tener el teléfono o haber escrito una vez equivale a aceptar campañas promocionales.</li>
          <li><B>Broadcast/campañas:</B> permitir seleccionar un grupo de clientes y preparar una campaña, pero validar consentimiento por canal, exclusiones, bajas, límites y contenido antes de enviar. Incluir vista previa, destinatarios, conteo, prueba a Miguel y confirmación final. Nunca enviar a toda la libreta por defecto.</li>
        </ul>

        <P><B>Tarjeta digital y QR — requisito funcional:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Crear una tarjeta digital profesional de Miguel/negocio con nombre, marca/logo, servicios, teléfono, email, sitio web y botones de contacto. Debe verse bien en móvil y poder compartirse por SMS, WhatsApp o email.</li>
          <li>Generar un enlace público seguro y un QR que abra esa tarjeta. Ofrecer acciones para compartir el enlace/QR y para que el cliente guarde el contacto como vCard (.vcf).</li>
          <li>Permitir escanear un QR o tarjeta de otra persona para iniciar la creación de un contacto, mostrar los datos detectados y pedir confirmación antes de guardarlos. Evitar duplicados y no importar datos silenciosamente.</li>
          <li>Definir qué datos de la tarjeta son públicos y permitir actualizarla sin cambiar el QR/enlace. No exponer notas privadas ni datos del CRM en la tarjeta pública.</li>
        </ul>

        <P><B>Pedidos, servicios, pagos y rutas — flujo conectado a revisar:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>El propietario indicó que existe otro trabajo/proyecto iniciado, aún incompleto, relacionado con recibir solicitudes/órdenes, pagos y cálculo de rutas. Antes de crear una segunda función, localizar y auditar ese trabajo existente en el repositorio y en el historial.</li>
          <li>Flujo objetivo: cliente envía solicitud/orden → CRM crea registro pendiente → confirmación de recepción al cliente (si el canal está autorizado) → aviso a Miguel → Miguel revisa y llama/prepara cotización → calcula ruta/precio según reglas existentes → envía propuesta → registra aceptación/pago → actualiza el estado del trabajo → seguimiento y cierre.</li>
          <li>La confirmación inicial debe decir que la solicitud fue recibida, no que el servicio está confirmado ni pagado. Estados separados: recibido, en revisión, cotizado, esperando aprobación, aprobado, pago pendiente, pagado, programado, en progreso, completado y cancelado, ajustados al proyecto existente.</li>
          <li>Integrar pagos solo después de identificar el proveedor y el módulo ya comenzado. No guardar números completos de tarjetas ni datos sensibles de pago en tablas CRM; usar checkout/tokenización del proveedor. No tocar funciones financieras personales de Claris.</li>
          <li>El cálculo de ruta, distancia, tiempo y precio debe reutilizar el proyecto existente si corresponde. No inventar tarifas ni duplicar un motor de rutas sin auditar primero los archivos y reglas existentes.</li>
        </ul>

        <P><B>Arquitectura de notificaciones — definición de producto:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Push al propietario:</B> web push desde servidor mediante suscripción del dispositivo, permiso explícito, service worker y claves/credenciales guardadas solo en servidor. Cada notificación debe incluir tipo de evento, registro relacionado, fecha y enlace interno. Guardar varias suscripciones si Miguel usa más de un dispositivo.</li>
          <li><B>iPhone:</B> para recibir Web Push de esta aplicación web en iOS/iPadOS, el usuario debe añadir la web app a la pantalla de inicio y aceptar las notificaciones; Apple documenta Web Push para web apps añadidas a Home Screen desde iOS 16.4. Probar en el iPhone real. No prometer entrega si el usuario no instala/autoriza o el sistema bloquea avisos.</li>
          <li><B>Programación:</B> citas y seguimientos requieren trabajos programados del lado servidor y zona horaria correcta; no depender de que la página esté abierta o de timers del navegador. Evitar avisos duplicados con claves idempotentes y permitir posponer/completar.</li>
          <li><B>Canales independientes:</B> push es para el propietario/app; SMS, WhatsApp y email son canales externos para el cliente. Un fallo de un canal no debe borrar el evento ni impedir que aparezca en la bandeja CRM.</li>
          <li><B>Auditoría:</B> registrar evento creado, destinatario, canal, consentimiento comprobado, mensaje aprobado, proveedor, ID de envío, estado/entrega/fallo y baja. Proteger datos personales y no guardar tokens en el frontend.</li>
        </ul>

        <P><B>Reglas prácticas de mensajería en EE. UU. — validar antes de activar campañas:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Para SMS de aplicación a personas en números estadounidenses mediante número local de 10 dígitos, los proveedores/carreadores exigen registro A2P 10DLC. La marca y campaña, propósito, muestras y proceso verificable de consentimiento deben configurarse antes de enviar tráfico productivo. Ver guía oficial: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc.</li>
          <li>Guardar y respetar STOP/UNSUBSCRIBE y otras bajas; no volver a enviar campañas a quien se dio de baja. Mantener identificación del remitente y mecanismo HELP/STOP según el canal/proveedor. La mensajería de servicio y marketing debe etiquetarse por separado y revisarse según las reglas aplicables.</li>
          <li>WhatsApp Business Platform requiere configurar la cuenta empresarial, número, permisos y plantillas aprobadas cuando corresponda; revisar las reglas actuales de Meta antes de programar envíos fuera de la ventana permitida. No confundir WhatsApp Business App con acceso API para integrarlo al CRM.</li>
          <li>Email también debe registrar preferencias, bajas y rebotes; separar mensajes de servicio de promociones y mantener identificación/remitente y enlaces de baja para comunicaciones comerciales según la normativa aplicable.</li>
          <li>La aplicación debe bloquear el envío si falta consentimiento requerido, el canal está dado de baja o el destinatario no es elegible. Un broadcast siempre requiere revisión de destinatarios y aprobación final de Miguel.</li>
        </ul>


        <P><B>Registro de implementación local — PWA y avisos del propietario (2026-11-25):</B></P>
        <P>
          Esta actualización supersede el estado anterior que indicaba que todavía no existían
          manifest ni service worker. Se está construyendo primero la base local, sin esperar la
          autorización del Supabase CRM. La información de clientes sigue guardándose en la clave
          existente <B>claris_crm_clients_v1</B>; esta actualización no migra, borra ni reemplaza
          esos datos y no modifica el módulo financiero.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Manifest:</B> se añade <B>app/manifest.ts</B>, publicado por Next.js como <B>/manifest.webmanifest</B>, con nombre Copiloto V7, modo standalone, color de tema y punto de inicio raíz. app/layout.tsx declara el manifest y conserva la configuración Apple existente.</li>
          <li><B>Service worker:</B> se añade <B>public/sw.js</B> con instalación/activación, recepción de eventos push, presentación de notificaciones y acción al pulsar para abrir la ruta indicada. El worker es infraestructura de cliente; por sí solo no envía notificaciones ni programa citas.</li>
          <li><B>Panel en CRM:</B> <B>components/copiloto/crm-notifications.tsx</B> registra el worker, muestra el estado del soporte/permiso, solicita permiso únicamente después de pulsar el botón del usuario y permite enviar una notificación de prueba local. Se integra en <B>components/copiloto/crm-screen.tsx</B>.</li>
          <li><B>Alcance real de esta fase:</B> registro del service worker y notificación de prueba requieren navegador compatible y permiso concedido. Además, al abrir el CRM, si hay fechas nextContact vencidas o de hoy, se presenta un aviso local agrupado como máximo una vez al día. Esta comprobación solo corre cuando el CRM está abierto; no es un programador en segundo plano. En iPhone, Web Push requiere instalar Copiloto en la pantalla de inicio y conceder permiso desde la web app instalada. No se ha probado todavía en el iPhone físico.</li>
          <li><B>Push remoto aún pendiente:</B> no hay todavía suscripción Push persistida en servidor, claves VAPID, endpoint de envío, cron/job de citas ni proveedor de entrega. Por eso no se promete aviso con la aplicación cerrada para eventos reales hasta completar esa fase backend. Los eventos de cita/seguimiento tampoco se crean en esta etapa.</li>
          <li><B>Seguridad y límites:</B> el navegador no contiene secretos; no se instala SDK ni se accede a Supabase; no se envían SMS, WhatsApp ni email. La IA no envía mensajes externos. Los datos CRM existentes permanecen en el almacenamiento local.</li>
          <li><B>Archivos cambiados en este avance:</B> <B>app/manifest.ts</B> (nuevo), <B>public/sw.js</B> (nuevo), <B>components/copiloto/crm-notifications.tsx</B> (nuevo), <B>app/layout.tsx</B>, <B>components/copiloto/crm-screen.tsx</B> y este manual.</li>
          <li><B>Publicación de esta fase:</B> commit <B>67f2cb32ff4f8dd43cf01fb2dae8d2db4017fb02</B>, deployment Vercel del proyecto <B>claris</B> en estado <B>READY</B>; alias de producción incluye <B>https://claris-lime.vercel.app</B>. El build reportó compilación exitosa y generó la ruta <B>/manifest.webmanifest</B>. El proyecto Vercel separado llamado <B>claris-lime</B> no tiene Git conectado y no es el deployment que sirve ese alias; su intento independiente falló al aprovisionar recursos, por lo que no se considera fuente de producción.</li>
          <li><B>Verificación externa pendiente:</B> el build de producción confirmó compilación y generación de la ruta manifest, pero las herramientas de lectura HTTP no pudieron inspeccionar los endpoints publicados. Confirmar en el navegador del iPhone que <B>/manifest.webmanifest</B> y <B>/sw.js</B> responden, activar permiso y pulsar el test. La entrega push remota y los avisos con app cerrada siguen pendientes de VAPID, persistencia de suscripciones y un job backend.</li>

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

        <P><B>INFORME DE NOTIFICACIONES Y MENSAJERÍA — actualizado 2026-11-25:</B></P>
        <P>
          Esta sección registra tanto la implementación técnica de push al propietario como el flujo
          de trabajo acordado para centralizar mensajes de clientes. Diferenciar siempre lo que ya
          existe en código de lo que todavía requiere prueba física, calendario o proveedor externo.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Base PWA y permiso:</B> <B>app/manifest.ts</B> define Copiloto V7 como web app instalable; <B>app/layout.tsx</B> declara el manifest y metadatos Apple; <B>public/sw.js</B> registra instalación/activación, recepción push y clic de notificación. En iPhone se debe añadir Copiloto a Home Screen, abrir la app instalada y conceder permiso desde una acción del propietario.</li>
          <li><B>Prueba local conservada:</B> <B>components/copiloto/crm-notifications.tsx</B> mantiene una prueba local mediante <B>showNotification</B>. Esto solo prueba la notificación generada en el dispositivo; no demuestra entrega remota.</li>
          <li><B>Push remoto implementado en código:</B> <B>lib/crm-push.ts</B> genera VAPID JWT ES256 y cifra el contenido Web Push con AES-128-GCM conforme al formato <B>aes128gcm</B>. No se añadió dependencia npm; usa <B>node:crypto</B> y el paquete <B>@vercel/blob</B> que ya estaba instalado.</li>
          <li><B>Suscripciones:</B> <B>POST /api/crm/push/subscribe</B> guarda la suscripción del dispositivo; <B>DELETE</B> permite eliminarla. El archivo de suscripciones se cifra con AES-256-GCM antes de guardarse en Vercel Blob. El documento Blob es público por la modalidad de almacenamiento existente, pero contiene solo datos cifrados; la clave de cifrado permanece como variable secreta del servidor. Límite actual: 10 dispositivos.</li>
          <li><B>Configuración pública:</B> <B>GET /api/crm/push/config</B> entrega únicamente la clave VAPID pública y el estado de configuración; nunca expone la clave VAPID privada ni la clave de cifrado.</li>
          <li><B>Prueba push remota:</B> <B>POST /api/crm/push/test</B> envía una notificación desde el servidor directamente a la suscripción del dispositivo que solicita la prueba. La respuesta HTTP positiva confirma aceptación del servicio push, pero la entrega final debe verificarse viendo el aviso en el iPhone real.</li>
          <li><B>Envío backend confiable:</B> <B>POST /api/crm/push/send</B> envía a las suscripciones registradas y exige <B>Authorization: Bearer</B> con <B>CRM_PUSH_SEND_SECRET</B>. Este endpoint es para futuras automatizaciones/webhooks; no se debe colocar ese secreto en el navegador.</li>
          <li><B>Variables Vercel creadas para el proyecto correcto:</B> <B>CRM_PUSH_VAPID_PUBLIC_KEY</B>, <B>CRM_PUSH_VAPID_PRIVATE_KEY</B>, <B>CRM_PUSH_STORE_SECRET</B>, <B>CRM_PUSH_SUBJECT</B> y <B>CRM_PUSH_SEND_SECRET</B>. Se configuraron en Production, Preview y Development. Los valores privados no se copian a este manual ni a GitHub. <B>BLOB_READ_WRITE_TOKEN</B> ya existía y se reutiliza. No se cambió Supabase ni se utilizó el Supabase financiero.</li>
          <li><B>Interfaz CRM:</B> <B>components/copiloto/crm-notifications.tsx</B> registra el service worker, solicita permiso solo tras pulsar el botón, crea/recupera la suscripción PushManager, la registra en el servidor y ofrece botones separados para prueba remota y prueba local. Si ya existe una suscripción en el teléfono, intenta sincronizarla con el servidor al abrir el CRM.</li>
          <li><B>Protección de rutas:</B> los endpoints de suscripción y prueba verifican que el origen de la petición sea el mismo sitio. La prueba remota envía solo a la suscripción que la solicita, no a todos los dispositivos. El envío general exige el secreto de backend. Las suscripciones se cifran en reposo.</li>
          <li><B>Estado de verificación — actualizado 2026-11-25:</B> Miguel confirmó prueba física LOCAL exitosa en su iPhone: activó <B>Enable Testing</B>, pulsó <B>Local Test</B> y recibió la notificación del dispositivo. Esto verifica que el service worker / showNotification puede mostrar una notificación local en ese iPhone. <B>No confundir con prueba remota:</B> la entrega remota servidor → Push Service → iPhone todavía requiere confirmación explícita independiente; tampoco demuestra aún notificaciones automáticas de citas, mensajes o tareas.</li>
          <li><B>iPhone y banner persistente:</B> iOS controla la presentación y duración de las notificaciones. Una PWA no puede dibujar un banner/burbuja flotante permanente encima de otra aplicación ni mantener una luz propia fuera de Claris. <B>requireInteraction</B> se solicita donde el sistema lo admita, pero iOS puede ignorarlo. Cerrar/descartar una notificación del sistema no debe significar que el futuro mensaje CRM quede resuelto; la bandeja persistente y su contador deben vivir dentro del CRM.</li>
          <li><B>Seguimientos existentes:</B> <B>components/copiloto/crm-screen.tsx</B> revisa <B>claris_crm_clients_v1</B> al abrir/montar el CRM y avisa de clientes no inactivos cuya fecha <B>nextContact</B> sea hoy o anterior, como máximo una vez al día con <B>claris_crm_followup_notice_v1</B>. Esta revisión no corre en segundo plano mientras CRM está cerrado.</li>
          <li><B>Citas y viajes:</B> todavía no existe un modelo de citas/eventos conectado a push, un calendario CRM terminado, un job/cron programado ni recordatorio automático 30 minutos antes de una recogida. El endpoint de envío ya sirve como base segura, pero no hay programación ni reglas de cita implementadas.</li>
        </ul>

        <P><B>Registro de prueba en dispositivo — 2026-11-25:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Acción realizada por Miguel:</B> activó el control <B>Enable Testing</B> y ejecutó <B>Local Test</B> desde la pantalla de notificaciones del CRM.</li>
          <li><B>Resultado reportado:</B> la notificación apareció y fue recibida en el iPhone físico. Resultado: <B>LOCAL TEST = PASS (confirmado por el propietario)</B>.</li>
          <li><B>Alcance:</B> prueba local del dispositivo; no es evidencia de entrega remota ni de disparadores automáticos por citas. No registrar como prueba remota aprobada.</li>
          <li><B>Próxima validación:</B> ejecutar y confirmar por separado <B>Remote Push Test</B>; después probar un evento real de cita con la app cerrada y verificar hora, destinatario, enlace al registro y ausencia de duplicados.</li>
        </ul>

        <P><B>Flujo de trabajo de mensajes — requisitos confirmados por el propietario:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Bandeja única:</B> el objetivo es centralizar mensajes entrantes de SMS y WhatsApp Business dentro del CRM, para que Miguel no tenga que revisar distintas aplicaciones mientras trabaja con otra plataforma. Cada mensaje debe crear una conversación/pendiente asociado al cliente, con canal, remitente, fecha/hora, mensaje original y estado.</li>
          <li><B>No perder pendientes:</B> descartar o cerrar el banner/notificación del iPhone nunca debe borrar ni resolver el mensaje. El mensaje debe permanecer en una bandeja del CRM con contador visible hasta que Miguel lo responda o lo cierre explícitamente.</li>
          <li><B>Alerta durante otra app:</B> cuando llega un mensaje, el servidor debe enviar push incluso si Claris está cerrada. La notificación del sistema puede verse sobre la aplicación de trabajo; iOS decide si aparece como banner, cuánto dura y si queda en Notification Center. No prometer un overlay flotante persistente por encima de todas las apps.</li>
          <li><B>Respuesta con aprobación:</B> el CRM puede preparar un borrador, pero nunca enviarlo sin que Miguel pulse <B>Approve &amp; Send</B>. Debe poder editarlo, posponerlo, ignorarlo temporalmente o elegir llamar al cliente.</li>
          <li><B>Confirmación de reservación:</B> el borrador debe explicar con precisión qué queda confirmado: fecha/día, hora, dirección de recogida, destino si fue proporcionado y tipo de servicio. Si falta un dato esencial, avisar y solicitar aclaración; no confirmar una reserva incompleta ni inventar detalles.</li>
          <li><B>Acción alternativa:</B> permitir llamar al cliente directamente. Si Miguel marca la llamada como realizada, registrar la acción y resultado en el historial, sin enviar un SMS/WhatsApp automático.</li>
          <li><B>Estados mínimos:</B> pendiente, en revisión, esperando datos del cliente, borrador listo, enviado (con ID/estado del proveedor cuando exista), llamada realizada y cerrado/cancelado. Solo marcar enviado después de que el proveedor acepte el envío; la entrega/lectura se registra solo si el proveedor la informa.</li>
          <li><B>Recordatorios de pendientes:</B> ordenar por urgencia/antigüedad y permitir avisos posteriores configurables. Cerrar la alerta no cambia el estado del mensaje. Añadir modo “Estoy manejando” para no exigir interacción con el teléfono durante un viaje.</li>
          <li><B>Indicador discreto:</B> dentro del CRM debe existir un contador/indicador de mensajes pendientes y una lista que sobreviva al cierre de la aplicación. El badge del icono o recordatorios adicionales solo se usarán si iOS y la PWA lo soportan realmente; no asumir que existe un punto flotante universal.</li>
          <li><B>Privacidad de SMS:</B> los SMS que llegan a la aplicación personal Mensajes del iPhone no se pueden importar automáticamente a una PWA web. Para centralizarlos se necesitará un número/canal de negocio y un proveedor/API de SMS con webhooks. WhatsApp requiere WhatsApp Business Platform/API; la aplicación personal WhatsApp no se conecta automáticamente al CRM.</li>
          <li><B>Proveedores no decididos:</B> no está seleccionado Twilio, otro proveedor SMS ni proveedor WhatsApp. Investigar opciones, costos, número empresarial, configuración de Meta, consentimientos y reglas aplicables antes de activar mensajes reales.</li>
          <li><B>Separación de canales:</B> push es el aviso privado para Miguel; SMS/WhatsApp son conversaciones externas con el cliente. El push no envía una respuesta al cliente. La respuesta solo sale después de aprobación explícita.</li>
        </ul>

        <P><B>Próximos pasos, en este orden:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Publicar el código push y este manual juntos; revisar que Vercel termine el build de producción en estado READY.</li>
          <li><B>LOCAL TEST completado el 2026-11-25:</B> Enable Testing → Local Test; Miguel confirmó que recibió la notificación en su iPhone. No repetir esta prueba como pendiente.</li>
          <li><B>Pendiente:</B> confirmar Remote Push Test en el iPhone físico y registrar el resultado por separado.</li>
          <li>Si la prueba remota falla, revisar respuesta HTTP, runtime logs, suscripción, permiso y claves VAPID sin exponer secretos; no marcar push como terminado hasta recibir confirmación visual en el iPhone.</li>
          <li>Después, crear el modelo de eventos/citas, recordatorios configurables (por ejemplo 30 minutos antes), cola y programación del servidor con zona horaria, deduplicación e idempotencia; conectar clic de push al registro relacionado.</li>
          <li>Elegir y configurar proveedor SMS y WhatsApp Business oficial; implementar webhooks entrantes y salida con consentimiento, STOP/HELP, reglas de plantillas y registro de estados.</li>
          <li>Construir la bandeja unificada persistente, borradores editables, aprobación antes de enviar, confirmación detallada de recogida, opción de llamar, modo “Estoy manejando”, contador y recordatorios de pendientes.</li>
        </ol>
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
          cambio y documentar el bloqueo. Después de cada sesión, actualizar esta sección con trabajo completado, pruebas reales, pendientes y el punto exacto para continuar. Al cerrar cada tarea o deployment, confirmar expresamente al propietario si la documentación quedó actualizada, si el resultado de notificaciones quedó registrado y cuál es el estado real del deployment. No afirmar que algo fue documentado o desplegado sin verificarlo.
        </P>
      </Section>


      <Section title="10. TWILIO SMS — continuidad y seguridad (2026-11-25)">
        <P>
          <B>Objetivo confirmado por Miguel:</B> conectar primero SMS con Twilio al CRM Copiloto V7;
          después evaluar e integrar WhatsApp Business. El CRM es para una operación pequeña y personal,
          por lo que la primera versión debe ser sencilla, segura y fácil de operar desde el iPhone.
        </P>
        <P><B>Estado real al cierre de esta sesión:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>La cuenta Twilio ya fue creada por el propietario y se identificó su Account SID. No guardar el SID completo ni secretos en esta documentación.</li>
          <li>El propietario compartió accidentalmente un Auth Token en el chat. Tratar ese token como expuesto y no volver a copiarlo, mostrarlo, incluirlo en código, GitHub, documentación ni mensajes.</li>
          <li>La revisión previa de variables de entorno de Vercel no encontró variables TWILIO_* ni una integración SMS de Twilio en el código. Por tanto, <B>Twilio todavía NO está conectado al CRM</B>; no se ha confirmado envío ni recepción de SMS desde Copiloto.</li>
          <li>Se aclaró que los comandos de terminal <B>export</B> no son necesarios para que Miguel los ejecute desde el iPhone. La integración se configurará por el backend y variables secretas de Vercel.</li>
          <li>Se indicó abrir <B>https://console.twilio.com/</B> y navegar a <B>Account → API keys &amp; tokens → Auth Tokens</B>. El siguiente paso de seguridad es solicitar <B>Request a secondary token</B>. Miguel no debe pegar ni enviar ese token en el chat.</li>
          <li>Después de crear el token secundario, no promoverlo todavía hasta confirmar si existe otra aplicación o servicio que utilice la credencial Twilio actual. Al promover el nuevo token, el anterior deja de funcionar; primero hay que actualizar y probar todas las integraciones que dependan de él.</li>
          <li>La rotación del Auth Token no cancela ni cierra la cuenta Twilio. Es un cambio de credencial API. Activar MFA/2FA y revisar Usage, Messaging Logs y Billing para detectar actividad o cargos desconocidos.</li>
          <li>Guardar credenciales únicamente en Vercel Environment Variables del proyecto correcto, nunca en el frontend, repositorio, capturas ni chat. Variables previstas: <B>TWILIO_ACCOUNT_SID</B> y <B>TWILIO_AUTH_TOKEN</B>; los valores no deben aparecer en documentación. Evaluar API Key restringida para producción cuando corresponda.</li>
        </ul>
        <P><B>Prueba acordada — primero Twilio, después CRM:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Desde Safari en el iPhone, entrar a Twilio Console y localizar <B>Messaging → Try out SMS</B> (la etiqueta puede variar según la consola).</li>
          <li>Realizar una prueba controlada desde la herramienta de prueba de Twilio al teléfono propio, siguiendo las restricciones de verificación que muestre Twilio. No considerar esto todavía una integración CRM.</li>
          <li>Una vez que la prueba de Twilio funcione, implementar en el backend de Copiloto V7 el envío y recepción mediante endpoints/webhooks seguros; persistir conversaciones, mensajes y estados del proveedor.</li>
          <li>Configurar un número de negocio y comprobar requisitos de registro de mensajería comercial en EE. UU., incluido A2P 10DLC si se usa un número local de 10 dígitos para tráfico sujeto a ese requisito.</li>
          <li>Probar SMS saliente, SMS entrante, estados de entrega/error, asociación con el cliente correcto, consentimiento, STOP/HELP y prevención de duplicados. No enviar campañas reales antes de verificar cumplimiento y consentimiento.</li>
          <li>Crear una bandeja de mensajes persistente en el CRM. Las notificaciones push son avisos privados para Miguel; SMS/WhatsApp son canales externos con clientes. Cerrar un banner no debe borrar ni resolver un mensaje.</li>
          <li>Los borradores generados por el CRM siempre requieren revisión y aprobación explícita de Miguel antes de enviar. No confirmar una reserva si faltan datos esenciales.</li>
        </ol>
        <P><B>WhatsApp — decisión y límite de seguridad:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Miguel utiliza actualmente WhatsApp Business App en su iPhone y quiere conservar ese número y su uso normal. <B>No migrar, desconectar ni registrar ese número en la API</B> sin explicar primero las consecuencias y recibir autorización expresa.</li>
          <li>Para una primera prueba futura, evaluar Twilio WhatsApp Sandbox con un número de prueba. Investigar coexistencia entre WhatsApp Business App y WhatsApp Business Platform antes de proponer una migración del número real.</li>
          <li>WhatsApp se aborda después de que SMS esté integrado y probado. Respetar consentimiento, plantillas aprobadas y reglas de la plataforma.</li>
        </ul>
        <P><B>Estado de pruebas y próximo punto exacto de continuación:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Twilio Console:</B> cuenta creada; todavía no se ha completado en esta sesión la solicitud del token secundario ni una prueba SMS.</li>
          <li><B>Rotación de credencial:</B> pendiente; no declarar resuelta hasta crear el token nuevo, actualizar cualquier integración que lo use y promoverlo de forma segura. No solicitar el secreto al propietario.</li>
          <li><B>Prueba SMS de Twilio:</B> pendiente; todavía no hay resultado PASS reportado.</li>
          <li><B>Integración SMS en CRM:</B> pendiente de implementación y pruebas; no hay evidencia de conexión activa.</li>
          <li><B>WhatsApp:</B> pendiente, sin migración del número personal de WhatsApp Business App.</li>
          <li><B>Push:</B> conservar el estado de la sección anterior: prueba LOCAL en iPhone confirmada; prueba REMOTE y disparadores automáticos de citas siguen pendientes y deben informarse por separado.</li>
          <li><B>Próxima acción al retomar:</B> guiar a Miguel desde Safari, paso a paso, a la pantalla de Auth Tokens para solicitar el secondary token sin compartirlo; después comprobar si usa Twilio en otra aplicación. Luego volver a Twilio Console para la prueba SMS. No pedirle comandos de terminal.</li>
        </ul>
        <P>
          <B>Regla de cierre:</B> solo marcar Twilio como conectado cuando existan credenciales seguras en
          Vercel, endpoints/webhooks implementados, un deployment correcto y pruebas reales de SMS
          entrante y saliente registradas. Actualizar esta sección junto con cada cambio de código.
        </P>
      </Section>

      <Section title="11. AUDITORÍA DE CONTINUIDAD — 2026-11-25">
        <P>
          <B>Objetivo:</B> dejar un punto de recuperación verificable para que la siguiente sesión
          continúe desde el estado real del repositorio, sin reconstruir ni repetir trabajo.
        </P>
        <P><B>Identidad y respaldo de código verificados:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Repositorio canónico: <B>transittaxmc-create/claris</B>; rama de producción: <B>main</B>; proyecto Vercel: <B>claris</B> (Next.js), ID <B>prj_EaOp8GqqgF0i4BBEp3CJSY8phcKW</B>.</li>
          <li>Último commit revisado antes de esta actualización: <B>e29fca99fd45e317742bd90297da1167ea90b9d8</B> — “Docs: documentar continuidad Twilio SMS y seguridad CRM”. La revisión de estado combinado de GitHub devolvió check Vercel = success.</li>
          <li>Deployment de producción correspondiente: <B>dpl_E5knNR2e6rgLmkNSMPtktcb8PpfW</B>, commit <B>e29fca99</B>, estado <B>READY</B>; alias de producción incluye <B>https://claris-lime.vercel.app</B>.</li>
          <li>La auditoría confirmó que los archivos CRM y push existen en <B>main</B>: <B>components/copiloto/crm-screen.tsx</B>, <B>components/copiloto/crm-notifications.tsx</B>, <B>lib/crm-push.ts</B> y las rutas <B>/api/crm/push/config</B>, <B>/subscribe</B>, <B>/test</B> y <B>/send</B>.</li>
          <li>La actualización de esta sección es documentación solamente; no cambia lógica del CRM, finanzas, Supabase ni credenciales. El commit/deployment que resulte de esta actualización debe verificarse y añadirse a este registro.</li>
        </ul>
        <P><B>Push — inventario de configuración y pruebas:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>La inspección de nombres de variables Vercel encontró <B>CRM_PUSH_VAPID_PUBLIC_KEY</B>, <B>CRM_PUSH_VAPID_PRIVATE_KEY</B>, <B>CRM_PUSH_STORE_SECRET</B>, <B>CRM_PUSH_SEND_SECRET</B> y <B>CRM_PUSH_SUBJECT</B>, dirigidas a Production, Preview y Development. Los valores secretos no se leyeron ni se copiaron.</li>
          <li><B>LOCAL TEST = PASS</B>, confirmado por Miguel en el iPhone físico el 2026-11-25.</li>
          <li><B>REMOTE PUSH TEST = PENDIENTE</B>: todavía falta que Miguel confirme que el aviso enviado por el servidor apareció físicamente en el iPhone. La existencia de la ruta y de las variables no prueba la entrega.</li>
          <li>Recordatorios automáticos de citas, eventos programados, cron/cola y prueba con app cerrada = <B>PENDIENTES</B>.</li>
        </ul>
        <P><B>CRM, persistencia y Supabase:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>El CRM actual usa <B>claris_crm_clients_v1</B> en localStorage del dispositivo. La auditoría no encontró evidencia de persistencia cloud CRM habilitada; no asumir sincronización entre teléfonos.</li>
          <li>El proyecto Supabase CRM esperado es <B>mimgwleghecseoymgdug</B>; el Supabase financiero es <B>zrcnpmipdhpjdjkfrrgt</B> y está prohibido reutilizarlo para CRM.</li>
          <li>La consulta directa de acceso al proyecto CRM devolvió falta de permisos durante esta auditoría. Estado: <B>acceso y proyecto destino aún no verificados</B>; no ejecutar migraciones ni SQL hasta recuperar autorización y comprobar el project ref.</li>
          <li>Se encontraron variables de entorno con nombres SUPABASE_* en Vercel, pero sus valores no se inspeccionaron. Por tanto, <B>no está verificado a qué proyecto apuntan</B>. Antes de usarlas, confirmar el destino sin mostrar secretos y evitar cualquier conexión accidental al proyecto financiero.</li>
        </ul>
        <P><B>Twilio SMS y WhatsApp:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>La inspección de variables Vercel no encontró ninguna variable <B>TWILIO_*</B>. El código revisado tampoco contiene una integración SMS de Twilio confirmada. Twilio no está conectado al CRM.</li>
          <li>La cuenta Twilio existe, pero el Auth Token compartido anteriormente debe tratarse como expuesto. No volver a copiarlo ni pedirlo por chat. Solicitar un secondary token y comprobar primero si otro servicio usa la credencial actual; no promover/rotar hasta planificar la actualización segura de todas las dependencias.</li>
          <li>Prueba de SMS desde Twilio Console, endpoints/webhooks SMS, SMS entrante/saliente y estados de entrega = <B>PENDIENTES</B>. WhatsApp Business API también está pendiente; no migrar ni desconectar el número actual de WhatsApp Business App sin autorización expresa.</li>
        </ul>
        <P><B>Orden de continuación para el siguiente chat:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Leer primero las secciones 8, 10 y 11 de este manual y verificar el último commit de <B>main</B> y el último deployment real de Vercel; no asumir que el SHA anterior sigue siendo el último después de esta actualización.</li>
          <li>Completar <B>Remote Push Test</B> desde el iPhone y registrar PASS/FAIL según evidencia física; si falla, revisar endpoint, permiso, suscripción, VAPID y logs sin revelar secretos.</li>
          <li>Guiar a Miguel en Safari para solicitar el secondary token de Twilio; antes de promoverlo, confirmar si la credencial anterior se usa en otro sistema. Después ejecutar la prueba controlada de SMS en Twilio Console.</li>
          <li>Recuperar autorización del proyecto Supabase CRM, confirmar el project ref <B>mimgwleghecseoymgdug</B> y verificar de forma segura el destino de las variables Vercel. No tocar el Supabase financiero.</li>
          <li>Diseñar persistencia cloud CRM/Auth/RLS y migración desde localStorage solo después de contar con acceso, esquema revisado y backup de datos locales. No borrar ni sobrescribir registros existentes.</li>
          <li>Luego implementar automatizaciones de citas y la bandeja persistente de mensajes; probar cada flujo en el iPhone antes de marcarlo terminado.</li>
        </ol>
        <P>
          <B>Regla de respaldo y cierre:</B> GitHub <B>main</B> conserva el código y la documentación
          versionados; un deployment READY confirma la publicación del código, pero no es un backup
          de los datos de clientes del dispositivo. No declarar backup de datos CRM hasta probar una
          exportación/restauración o persistencia cloud con conteos verificados. Al final de cada sesión,
          actualizar este manual con fecha, commit, deployment (READY/BUILDING/FAILED), archivos
          modificados, pruebas PASS/FAIL/PENDIENTES, bloqueos y el siguiente paso exacto. Confirmar
          expresamente al propietario que la documentación quedó actualizada o indicar que no se pudo.
        </P>
      </Section>

      <Section title="12. PRUEBA TÉCNICA DE PRODUCCIÓN — 2026-11-25/26">
        <P>
          <B>Deployment:</B> el commit <B>4f47fda0989afb5b9581c0007c92122910b31c7d</B>
          quedó publicado en producción en el deployment <B>dpl_7Np1m8P125YmC4JEwq1xsudE9knZ</B>,
          estado final <B>READY</B>. El alias <B>https://claris-lime.vercel.app</B> está asociado
          a ese deployment. Esta publicación contiene la auditoría documental de la sección 11.
        </P>
        <P><B>Comprobaciones HTTP realizadas desde el deployment publicado:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>PASS:</B> página principal responde HTTP 200 y entrega la aplicación Copiloto V7.</li>
          <li><B>PASS:</B> <B>/api/crm/push/config</B> responde HTTP 200 y devuelve <B>enabled=true</B> con clave pública VAPID presente. No se copiaron claves privadas ni secretos.</li>
          <li><B>PASS:</B> <B>/sw.js</B> responde HTTP 200 y contiene los manejadores de eventos <B>push</B> y <B>notificationclick</B>.</li>
          <li><B>NO VERIFICADO:</B> entrega remota de extremo a extremo al iPhone. La prueba requiere una suscripción push real generada y registrada desde el dispositivo de Miguel; no se debe enviar una prueba con una suscripción inventada ni marcarla como PASS por el simple hecho de que el servidor esté configurado.</li>
          <li><B>PENDIENTE:</B> Miguel debe abrir Copiloto desde el icono instalado en la pantalla de inicio del iPhone, entrar al panel de notificaciones del CRM y pulsar <B>Send remote push test</B> si el dispositivo ya aparece registrado. Si no está registrado, pulsar primero <B>Enable remote push</B> y aceptar el permiso. Confirmar si el aviso “Copiloto CRM — prueba push” aparece físicamente.</li>
        </ul>
        <P>
          <B>Resultado global:</B> infraestructura y endpoints de configuración de push disponibles;
          prueba local previamente confirmada PASS; prueba remota física aún pendiente; automatizaciones
          de citas y pruebas con la app cerrada siguen pendientes. No declarar el sistema de notificaciones
          completamente operativo hasta confirmar la recepción en el iPhone y probar los disparadores automáticos.
        </P>
        <P>
          <B>Nota de observabilidad:</B> la consulta de logs de runtime de 24 horas no fue aceptada por
          la retención del plan Hobby; una consulta de los últimos 30 minutos no devolvió registros.
          Esto no equivale a una prueba de ausencia de errores ni sustituye la prueba funcional del dispositivo.
        </P>
      </Section>

      <Section title="13. CRM RESERVATIONS — AIRPORT FLIGHT TRACKING & ADDRESS NAVIGATION (2026-11-25)">
        <P>
          <B>Objetivo confirmado por el propietario:</B> documentar el alcance de las reservaciones
          del CRM Copiloto V7. Esta sección registra requisitos acordados; <B>no significa que
          estén implementados ni desplegados</B>.
        </P>
        <P><B>A. Direcciones de pickup y drop-off en la orden CRM:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>El flujo GPS de viajes que ya existe en Copiloto es independiente y no debe duplicarse ni modificarse por este requisito.</li>
          <li>Dentro de cada reservación del CRM, mostrar las direcciones de pickup y drop-off que pertenecen a esa orden.</li>
          <li>Los campos/datos de ambas direcciones deben seguir siendo editables por el usuario.</li>
          <li>Agregar un botón pequeño de navegación en la esquina o junto a cada dirección. El botón de pickup abre el navegador/GPS con la dirección de recogida ya cargada; el botón de drop-off abre el navegador/GPS con la dirección de destino ya cargada.</li>
          <li>La acción debe evitar copiar, volver a escribir o teclear manualmente la dirección en la aplicación de mapas. No reemplaza ni altera la dirección guardada en la orden.</li>
          <li>Permitir abrir Apple Maps o Google Maps mediante enlaces de navegación compatibles con el dispositivo. Si se ofrecen ambas opciones, la elección debe ser clara y rápida.</li>
          <li>La navegación se inicia únicamente cuando el usuario toca el botón; no iniciar GPS ni navegación automáticamente al abrir una reservación.</li>
        </ul>
        <P><B>B. Recogida normal frente a recogida en aeropuerto:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Para una recogida en dirección normal, conservar el flujo habitual de pickup y drop-off; no pedir número de vuelo ni campos de aeropuerto.</li>
          <li>Cuando el tipo de pickup sea aeropuerto, la reservación debe solicitar y guardar la información necesaria del vuelo, incluyendo aerolínea, número de vuelo, fecha y aeropuerto, además de la hora programada cuando esté disponible.</li>
          <li>Incluir en la misma orden una acción <B>Track Flight</B> para consultar el vuelo y mostrar su estado, por ejemplo: a tiempo, retrasado, en vuelo, aterrizado o cancelado.</li>
          <li>El seguimiento automático o las actualizaciones periódicas requieren seleccionar e integrar un proveedor de datos de vuelos. Hasta que exista integración y respuesta válida y reciente, no presentar estados como confirmados ni prometer actualización automática.</li>
          <li>El registro de vuelo debe permanecer asociado a la reservación correspondiente. Considerar cambios de hora, fecha local, terminal y puerta cuando el proveedor disponga de esos datos.</li>
        </ul>
        <P><B>C. Límites y reglas de implementación:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Este alcance corresponde al CRM y sus órdenes de reservación; no crear un segundo módulo genérico de pickup/drop-off ni duplicar el registro GPS de viajes existente.</li>
          <li>Antes de programar, inspeccionar la estructura real de reservaciones y los campos actuales para integrar los botones sin perder ni sobrescribir datos existentes.</li>
          <li>Probar que editar una dirección conserva el nuevo valor y que cada botón abre el destino correcto: pickup abre pickup y drop-off abre drop-off.</li>
          <li>Probar por separado una reservación con dirección normal y otra con pickup de aeropuerto, incluyendo la acción Track Flight.</li>
          <li>Investigar cobertura, frecuencia de actualización, costos y términos de un proveedor de vuelos antes de contratarlo o activar cargos. No realizar compras sin aprobación del propietario.</li>
          <li>Los canales SMS y push tienen sus estados pendientes documentados en las secciones 10–12; no afirmar que alertas de vuelos o mensajes a clientes funcionan hasta implementar y probar cada canal.</li>
        </ul>
        <P>
          <B>Estado al 2026-11-25:</B> requisitos y distinción funcional confirmados con el propietario.
          No se ha implementado el formulario de reservaciones, el botón de navegación por dirección,
          la integración de seguimiento de vuelos ni sus automatizaciones. Próximo paso: inspeccionar
          el código CRM vigente y su modelo de reservaciones; documentar el diseño técnico antes de
          modificarlo. Mantener los cambios aislados del módulo financiero.
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
