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

      <Section title="4. EARNINGS">
        <P>
          Income by platform, payout reconciliation (pending / matched / difference), close day to
          send deposits as projections.
        </P>
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
      <Section title="8. DATA & BACKUP — dónde viven los datos y cómo cambiar de teléfono">
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
