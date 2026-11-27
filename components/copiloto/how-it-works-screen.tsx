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

      <Section title="INDEX — the one index for this whole manual">
        <P>
          <B>Rule (Miguel, 2026-11-26):</B> this manual has <B>ONE single index</B> — this one. A
          topic that is already listed here is updated <B>in its own section</B>, never in a new
          one; a genuinely new topic is added to this index <B>once</B>, with its section. Every
          deployment updates this index and its sections in the same deployment. (Older sections
          keep the numbers they were written with — two historical series overlap; the date in
          each title tells them apart. Nothing was renumbered, so no older note breaks.)
        </P>
        <P><B>Daily use</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>§1 TODAY — daily trip entries · §2 Tolls — automatic E-ZPass detection · §3 TOLL AUDIT — E-ZPass reconciliation · §4 EARNINGS — daily jobs and receivables · §5 MONEY — registers and projections · §6 REPORTS · §7 MORE</li>
          <li>§8 DATA &amp; BACKUP — where data lives and how to switch phones · §9 TAXES 2026 — Schedule C and self-employment · §10 Standing rules</li>
        </ul>
        <P><B>CRM</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>§11 CRM COPILOTO V7 — official project continuity (2026-11-25) · §13 CRM RESERVATIONS — airport flight tracking &amp; address navigation (2026-11-25) · §17 SUPABASE CRM AUTH + DATABASE (2026-11-25) · §18 CRM AUTH + TABLES (2026-11-25) · §18 (second) REAL PROGRESS — CRM tables created, Auth pending (2026-11-25)</li>
          <li>§19 CRM CLOUD — Phase 1 in production (2026-11-26) · §20 CRM PHASES 2–5 — account number, photos, message tray, reminders (2026-11-26)</li>
        </ul>
        <P><B>Communications, continuity and incidents</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>§10 (second) TWILIO SMS — continuity and security (2026-11-25) · §14 COMMUNICATIONS &amp; COPILOT PLAN — email, SMS, messaging and notices (2026-11-25/26) · §11 (second) CONTINUITY AUDIT (2026-11-25) · §12 PRODUCTION TECHNICAL TEST (2026-11-25/26) · §15 VERCEL BUILD INCIDENT — CRM import (2026-11-25/26) · §16 PREVIOUS CHAT RECOVERY &amp; HANDOFF BETWEEN CHATS (2026-11-25/26)</li>
        </ul>
        <P><B>Priorities</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>§21 PRIORITY LIST — what is open, in plain language, updated with every deployment</li>
          <li>§22 APPLICATION INVENTORY &amp; ARCHITECTURE AUDIT — complete source map, integrations, database state, verified gaps and agent handoff (2026-11-27)</li>
          <li>§23 CRM COPILOT V7 — TECHNICAL AUDIT &amp; VERIFIED GAPS (2026-11-27)</li>
          <li>§24 COPILOTO V7 — PHASE 1 BUILD FOUNDATION &amp; ARCHITECTURE (2026-11-27) · §25 V7 PREVIEW WORKSPACE — FIRST IMPLEMENTATION (2026-11-27) · §26 TRANSPORT OPERATIONS PREVIEW (2026-11-27) · §27 TAX PREPARATION PREVIEW (2026-11-27) · §28 WORK OPPORTUNITIES REVIEW PREVIEW (2026-11-27) · §29 SQUARE OPERATIONS PREVIEW (2026-11-27) · §30 V7 VERIFICATION STATUS (2026-11-27) · §31 RELEASE READINESS & TRANSFER (2026-11-27) · §32 TEMPORARY RAILWAY PREVIEW & AGENT HANDOFF (2026-11-27) · §33 MASTER PROJECT PLAN & CONTINUITY FOLDER (2026-11-27)</li>
        </ul>
      </Section>

      <Section title="1. TODAY — daily trip entries">
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Top strip:</B> shift timer (<B>START / PAUSE / RESUME / END</B>), live mileage
            counter, and <B>GROSS TODAY</B> — hidden on open (privacy in front of the passenger), tap
            to show/hide.
          </li>
          <li>
            <B>TODAY | REGISTER</B> line: two totals under the strip. The <B>TODAY</B> total is
            always visible — no dots mask (Miguel's order, 2026-11-20); the <B>REGISTER</B> total
            starts hidden and shows/hides with its own tap.
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
          <li>
            <B>Quick platform row:</B> the first box always shows the first platform in the list
            (<B>Eco Ride</B>). Tapping a quick button only changes the trip's platform (yellow
            frame) — it never moves the first box and never duplicates the platform. The selector
            also carries <B>Jurny</B>, <B>Curb</B> and <B>CO-OP Drive</B> (with the blue
            ACCESS-A-RIDE badge) and the delivery platforms <B>Dasher</B> and <B>Spark Driver</B>,
            each with its own logo.
          </li>
          <li>
            <B>Camera button:</B> the floating camera fills the trip from a photo of the dispatch
            or job screen. The button never hides under the iPhone's Dynamic Island — a saved
            position that ends up too high rescues itself on open.
          </li>
          <li>
            <B>Top and bottom frame (fixed 2026-11-26):</B> the phone's status bar is now{" "}
            <B>solid black</B> and the app starts below it — the old translucent style laid the
            app UNDER a transparent skin at the top, and the light document background behind
            it showed as the gray/white strip Miguel photographed; a matching edge showed at
            the bottom. The document background is now black end to end, so no content hides
            under a strip at the top or the bottom of any screen: the first and last elements
            are always fully visible. (Miguel's correction, 2026-11-26: it only happened in
            this app, so it was the app — not the phone.)
          </li>
          <li>
            <B>DASHBOARD:</B> the gold button in TODAY's header opens the hub — the day's money
            line from Projections (out today / earned today / shortfall, or the next outgoing
            with its date), the <B>HOURLY</B> card (moved here from EARNINGS) and the{" "}
            <B>E-ZPASS · SUMMARY</B> card (today/shift, week, year, plus what is payable and the
            TOLL AUDIT reconciliation). Starting a <B>NEW SHIFT</B> zeroes the shift counters
            (dashboard earnings, E-ZPass today, miles) — a closed shift's figures keep showing
            until the next START; week and year stay calendar-based and the register is never
            touched.
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
          <li>
            <B>Edit trip:</B> amounts use the rolling decimal — type the digits and the point
            places itself (4025 → $40.25), in FARE and in every Edit trip box. The platform list
            in Edit trip is the same as TODAY's: same order, same clean logos, yellow frame on
            the selected one.
          </li>
          <li>
            <B>NO SHOW / CANCELED:</B> in the trip editor, a job that did not happen can be
            closed without deleting it — <B>NO SHOW</B> sets the trip to <B>$5.00</B> (it counts
            as earned) and <B>CANCELED</B> sets it to <B>$0</B>. The trip stays in the list as a
            record, marked; tap the mark again to undo. The editor also shows a discreet{" "}
            <B>Received: date · time</B> line — when that job was received/uploaded.
          </li>
          <li>
            <B>Per-hour, one single source:</B> the $/h chip on TODAY counts from the moment the
            shift starts (<B>START</B>) and uses the exact same calculation as the DASHBOARD, so
            both always agree.
          </li>
          <li>
            <B>Fixing an earlier day:</B> if you correct a trip from a previous day, that day's
            receivable in MONEY updates by itself, as long as the receivable is still in MONEY.
            A receivable you deleted never comes back on its own — only that day's{" "}
            <B>Update receivables → Money</B> button brings it back.
          </li>
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
          <li>
            <B>Balance by hand:</B> tap an account's balance in MONEY and type the real balance —
            the box opens empty (placeholder $0.00), the value saves, and it counts into
            Projections' starting balance like any other balance.
          </li>
          <li>
            <B>Projections summary line:</B> the top of Projections is one line —{" "}
            <B>REAL BANK | STARTING | ENDING</B>. Tap it and the full detail opens (REAL BANK |
            PROJECTED MONTH plus the five-column strip); tap again to close it.
          </li>
          <li>
            <B>Balance Account row:</B> the first row of the Projections register is one discreet
            line, <B>Balance Account</B>. Tap it to see every switched-on account with its
            balance — the ★ main account first — and the total, which is the same starting
            balance as the strip above. Accounts switched off do not appear and do not count.
          </li>
          <li>
            <B>Checks and reconciliation:</B> a projected income row stays in the list, counting,
            past its day — until the money lands in the bank (then it leaves by itself) or you
            tap its check circle. A checked row stays visible that day marked{" "}
            <B>✓ CHECKED · NO LONGER COUNTS</B> and counts $0; from the next day it is gone, and
            tapping again the same day undoes it. When bank money matches a projection, the row
            is written under <B>✓ RECONCILED WITH THE BANK — RECORD ONLY</B> with Projected vs
            Arrived and the Difference when it is not $0.
          </li>
          <li>
            <B>Weekly band:</B> after the last row of each week (Mon–Sun) the register shows that
            week's band — <B>WEEK IN / OUT / NET</B> — plus the <B>WEEKLY TOLLS</B> line. Tolls
            live only on the WEEKLY TOLLS line and never count inside the band's OUT. Every week
            that has rows shows its band.
          </li>
          <li>
            <B>PAYABLES · LIABILITIES:</B> every recurrent bill carries its own liability
            account. Categorizing a bank payment with that bill's category writes the payment
            into the bill and subtracts from what it owes — a paid bill stays paid, and each
            account keeps its annual record (total paid and number of payments).
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
          <li>
            <B>Mile modes:</B> miles are counted continuously while you move and split by mode —{" "}
            <B>business</B>, <B>commute</B> and <B>personal</B>. A home geofence (Set home) can
            mark the commute automatically.
          </li>
        </ul>
      </Section>

      <Section title="7. MORE">
        <P>
          <B>Expenses</B> (receipt scan + manual) · <B>Envelopes</B> (rent, leasing, phone) ·{" "}
          <B>Pending deposits</B> (money held by platforms) · <B>Data</B> (backup, sync, reset) ·
          this manual.
        </P>
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>CREDIT (MORE):</B> the register of credit accounts — balance, due day, frequency
            and a payoff plan per account. An overdue account shows <B>OVERDUE</B> with its date.
          </li>
          <li>
            <B>Daily goal:</B> in <B>DATA → BOARD GOALS</B> the goal field is free-writing — erase
            the whole number and type yours; it saves when you leave the field.
          </li>
        </ul>
      </Section>

      {/* ───────────────────────────────────────────────────────────── */}
      <Section title="8. DATA & BACKUP — where data lives and how to switch phones">
        <P>
          <B>Implemented: 2026-11-13 · Author: Miguel / Copiloto V7</B>
        </P>

        <P>
          <B>Where each datum lives:</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Trips:</B> on this phone — localStorage{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">ic_tip_tracker</code>{" "}
            + a copy in IndexedDB. If the browser clears the cache, IndexedDB returns the trips when
            the app opens.
          </li>
          <li>
            <B>Expenses:</B>{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">ic_expenses</code>{" "}
            (localStorage) + IndexedDB copy.
          </li>
          <li>
            <B>Ledger / projections / recurrings:</B>{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">claris_cash_flow_entries</code>{" "}
            ·{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">claris_scheduled_entries</code>{" "}
            (localStorage).
          </li>
          <li>
            <B>Receipt and statement photos:</B> Vercel Blob server (Vercel's file
            store). They are uploaded via{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">/api/receipt-image</code>{" "}
            when scanning. Each image's ID is stored inside{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">claris_receipts_v1</code>.
            For an IRS audit, the photos can also be uploaded to Google Drive (see step 3
            below).
          </li>
          <li>
            <B>Full backups (backup JSON):</B> the user's Google Drive — folder{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              Copiloto_Auditoria_Recibos
            </code>
            . The file includes ALL the app's data: trips, expenses, ledger, accounts,
            configuration.
          </li>
          <li>
            <B>Sync between phones (private code):</B> Vercel Blob — encrypted file{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              claris-sync-&lt;hash&gt;.enc
            </code>
            . The server only sees the hash and ciphertext; it never sees the data in clear.
          </li>
          <li>
            <B>AUTOMATIC sync between the two phones (2026-11-26):</B> no code — when Copiloto
            opens, each phone downloads the other's data and publishes its own, merged per item (the
            newest version wins; deleted items travel as a tombstone and do NOT resurrect). It covers trips,
            expenses and MONEY (ledger + recurrings). Transport: Supabase — its own table{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              finance_sync_doc
            </code>{" "}
            in the CRM project, with Miguel's session and RLS per owner (no service key);
            routes{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              /api/data/publish
            </code>{" "}
            and{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              /api/data/snapshot
            </code>{" "}
            with the usual publish key. Miguel's order (2026-11-26): do NOT wait for
            Vercel — the Blob was suspended and the finance project frozen (402), so the
            transport lives in Supabase. If a phone has no CRM session open or the cloud
            does not answer, the sync stays asleep and does NOT touch any local data. UPLOAD/RESTORE stays
            intact as a manual backup.
          </li>
          <li>
            <B>Bank (Plaid):</B> Vercel Blob — snapshot in{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">bank-snapshot.json</code>.
            It refreshes automatically every 5 minutes in the app.
          </li>
          <li>
            <B>Google Drive tokens:</B> Vercel Blob —{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">gdrive-tokens.json</code>
            . Only the server reads them; the phone only sees whether it is connected or not.
          </li>
        </ul>

        <P>
          <B>Procedure to switch phones (step by step):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Step 1 — Connect Google Drive (first time only):</B> go to DATA → BACKUP →
            PHONE TRANSFER section. Tap <B>Connect Drive →</B> (small grey button at the top
            right). Google asks permission to "see and manage only the files this
            app created". Accept. The app returns and the button changes to{" "}
            <B>✓ Drive · disconnect</B>.
          </li>
          <li>
            <B>Step 2 — UPLOAD to Drive:</B> tap <B>UPLOAD TO DRIVE</B>. The app builds the
            full backup and uploads it directly to Google Drive without downloading anything to the phone.
            The file stays in the folder{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              Copiloto_Auditoria_Recibos
            </code>{" "}
            with name{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              copiloto-respaldo-YYYY-MM-DD.json
            </code>
            . If a file with the same name already exists, it is overwritten.
          </li>
          <li>
            <B>Step 3 — On the other phone, open the app and connect Drive:</B> same as step
            1. Use the same Google account.
          </li>
          <li>
            <B>Step 4 — RESTORE from Drive:</B> tap <B>RESTORE DRIVE</B>. The app lists
            the available backups in the folder. Choose the desired file (the most recent
            appears first). A summary is shown: date, # entries, # expenses, # trips. Tap{" "}
            <B>YES, RESTORE</B> to confirm. The app reloads and ends up identical to the original
            phone.
          </li>
          <li>
            <B>Without Drive connected:</B> the UPLOAD button downloads the JSON file to the phone (same
            as before). The RESTORE button asks to choose a local file. Both modes keep
            working.
          </li>
        </ul>

        <P>
          <B>Procedure for receipt and statement photos (IRS audit):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            Scan a receipt or statement with the camera from EXPENSES → camera button. The photo is
            uploaded to Vercel Blob automatically and the AI extracts amount, date, vendor.
          </li>
          <li>
            To have them in Google Drive (recommended for audit): upload the full backup
            with UPLOAD TO DRIVE — the backup JSON contains the IDs of all the images, which are on
            the Vercel Blob server. The photos themselves can be downloaded from DOWNLOAD ALL (FULL
            BACKUP) or from the expense register.
          </li>
          <li>
            <B>Folder in Drive:</B>{" "}
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              Copiloto_Auditoria_Recibos
            </code>{" "}
            — a name designed to immediately identify that it is audit documentation.
          </li>
        </ul>

        <P>
          <B>New API routes (implemented 2026-11-13):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/status</code>{" "}
            → whether Drive is connected.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/auth</code>{" "}
            → starts the Google OAuth2 flow.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/callback</code>{" "}
            → Google redirects here after authorizing; saves tokens in Vercel Blob.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">POST /api/gdrive/upload</code>{" "}
            → uploads a file to the Drive folder.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GET /api/gdrive/restore</code>{" "}
            → lists or downloads Drive backups.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">DELETE /api/gdrive/disconnect</code>{" "}
            → deletes the tokens (disconnects Drive).
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">
              GET/POST/DELETE /api/sync
            </code>{" "}
            → sync between phones. <B>Fixed 2026-11-13</B>: it previously used Supabase (quota
            exhausted); now it uses Vercel Blob.
          </li>
        </ul>

        <P>
          <B>Environment variables required in Vercel (for Google Drive):</B>
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GOOGLE_CLIENT_ID</code>{" "}
            — from Google Cloud Console, OAuth2 project.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GOOGLE_CLIENT_SECRET</code>{" "}
            — same project.
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">GOOGLE_REDIRECT_URI</code>{" "}
            = https://claris-lime.vercel.app/api/gdrive/callback
          </li>
          <li>
            <code className="rounded bg-neutral-800 px-1 text-[11px] text-yellow-300">BLOB_READ_WRITE_TOKEN</code>{" "}
            — Vercel Blob (already configured; also used by bank snapshot and receipt images).
          </li>
        </ul>

        <P>
          <B>Security notes:</B> the backup JSON is not encrypted (it is a private file in your
          personal Drive). The sync between phones IS encrypted with AES-GCM-256 derived from your
          private code — the server never sees the data in clear. The Drive tokens are stored
          in Vercel Blob with an unguessable name and only the server reads them.
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


      <Section title="11. CRM COPILOTO V7 — OFFICIAL PROJECT CONTINUITY">
        <P>
          <B>Updated: 2026-11-26 · Reference document for Miguel and all agents.</B>
          This section is the CRM's continuity source. Read it fully before researching,
          modifying code, databases, permissions or deployments. Do not assume or invent states.
        </P>

        <P>
          <B>Current CRM cloud status — 2026-11-26:</B> Phase 1 is live in production. Section 19
          is the controlling record for the CRM cloud connection. Earlier statements in sections
          11–18 that describe CRM cloud sync, Supabase access or Auth as pending were written before
          that deployment and are superseded for the clients/reservations connection; they remain
          dated history for the other features they discuss.
        </P>

        <P><B>Module identity and location:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Canonical name: <B>CRM Copiloto V7</B>. “B7” was a dictation/writing confusion; use V7.</li>
          <li>The CRM is a module inside Copiloto V7 / the Claris application; do not create a separate application.</li>
          <li>Identified repository: <B>transittaxmc-create/claris</B>. Main interface file: <B>components/copiloto/crm-screen.tsx</B>.</li>
          <li>User access: open <B>More → Client management → CRM</B>. The CRM stays inside More; do NOT add it as a new icon to the bottom menu or alter the existing options.</li>
          <li>This official record is in <B>More → Help → How it works</B>, in the file <B>components/copiloto/how-it-works-screen.tsx</B>.</li>
        </ul>

        <P><B>Master file — initial conversation, agreed vision and scope:</B></P>
        <P>
          The starting point on 2026-11-25 was to add a CRM function to the Claris application
          that already exists and store client information there. The owner's decision
          was to continue inside that same application and repository: do NOT create another application,
          another repository or a parallel system. The correct name is <B>Copiloto V7 CRM</B>.
          This CRM must be developed as its own module, without interfering with the financial product
          that already works in Claris.
        </P>
        <P>
          The recovered initial vision contemplates centralized management of clients and contacts,
          files/cases, services, documents, appointments, tasks, activities and history. The
          business entities proposed to structure that base were profiles,
          organizations, memberships, clients, contacts, services, transportation jobs,
          tax cases, documents, appointments, tasks and activity records. <B>Important:</B>
          that list was a structure proposal; it does not mean those tables are already created
          in Supabase. Verify the real schema before claiming it exists.
        </P>
        <P>
          The planned experience must make it possible to know who each client is, how to contact them,
          what service or matter they have, what was discussed, what documents are missing, what the next
          action is and when to contact them again. The history must give continuity to each
          relationship and avoid losing conversations or follow-ups. The files,
          documents, appointments, tasks and activity functions are part of the scope to develop; the first
          current CRM screen does not yet implement all of that scope.
        </P>

        <P><B>Communication channels and integrations — record as pending scope:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Calls and email:</B> the current version already allows opening the phone dialer through tel: and email through mailto: from the client record. Do not confuse these actions with a phone switchboard or an integrated email system.</li>
          <li><B>SMS / text messages:</B> must be contemplated as a CRM communication channel for conversations and follow-up with clients. There is no provider, sending number, credentials, API or verified send/receive flow in the project as of 2026-11-25. Do not claim SMS is connected.</li>
          <li><B>WhatsApp Business:</B> must be contemplated as a business messaging integration, separate from personal WhatsApp. The Meta account/Business Portfolio, business number, verification, official provider/API, templates when applicable, client consent, reply reception and conversation recording in the history must be researched and defined. There is no confirmed provider, account, number, credentials or connection yet.</li>
          <li><B>Unified history:</B> design objective: that registered calls, emails, SMS and WhatsApp messages that get integrated stay associated with the contact/client and their activity, with date, channel, direction (inbound/outbound) and result. This is a product specification pending implementation, not a current capability.</li>
          <li><B>Automations:</B> plan reminders and follow-up tasks related to contact dates, appointments, pending documents and overdue tasks. Define rules, times, time zone, preferences and consent before activating automatic sends.</li>
          <li><B>Notifications:</B> a first local version documented below already exists: manual test on this device and notice of overdue/today follow-ups when the CRM is opened. This does NOT yet equal automatic appointment reminders or scheduled remote push with the app closed.</li>
          <li><B>Providers:</B> do not select or invent Twilio, Meta Cloud API or another provider as a decision taken. Research options and costs when the time comes; document the decision and its credentials as server secret variables, never on the client.</li>
        </ul>

        <P><B>Map of locations, projects and reference links:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Existing application:</B> <a className="text-yellow-300 underline" href="https://claris-lime.vercel.app/" target="_blank" rel="noreferrer">https://claris-lime.vercel.app/</a> — Claris URL previously shared by the owner. Do not assume this domain automatically receives every deployment of the Vercel project called claris.</li>
          <li><B>GitHub — repository:</B> <a className="text-yellow-300 underline" href="https://github.com/transittaxmc-create/claris" target="_blank" rel="noreferrer">https://github.com/transittaxmc-create/claris</a> — owner/organization <B>transittaxmc-create</B>, repository <B>claris</B>, observed production branch <B>main</B>.</li>
          <li><B>CRM UI:</B> <a className="text-yellow-300 underline" href="https://github.com/transittaxmc-create/claris/blob/main/components/copiloto/crm-screen.tsx" target="_blank" rel="noreferrer">components/copiloto/crm-screen.tsx</a>.</li>
          <li><B>This manual / continuity:</B> <a className="text-yellow-300 underline" href="https://github.com/transittaxmc-create/claris/blob/main/components/copiloto/how-it-works-screen.tsx" target="_blank" rel="noreferrer">components/copiloto/how-it-works-screen.tsx</a>.</li>
          <li><B>Container component:</B> <B>CopilotoApp</B> inside the Next.js 16 application. The CRM entry must follow the already agreed navigation <B>More → Client management → CRM</B>.</li>
          <li><B>Vercel — project deployed in this session:</B> <a className="text-yellow-300 underline" href="https://vercel.com/island-city/claris" target="_blank" rel="noreferrer">https://vercel.com/island-city/claris</a> — name <B>claris</B>, ID <B>prj_EaOp8GqqgF0i4BBEp3CJSY8phcKW</B>, connected to the GitHub repository above.</li>
          <li><B>Last registered production deployment:</B> <a className="text-yellow-300 underline" href="https://claris-lime.vercel.app/" target="_blank" rel="noreferrer">https://claris-lime.vercel.app/</a> — alias of the Vercel project <B>claris</B>; deployment <B>dpl_DyeTiM8ricAkko4eREZSVJPG51nT</B>, status READY; commit <B>21a0a86230ffca0b9675194c36ab2f86c80d28c6</B>. Preview: <a className="text-yellow-300 underline" href="https://claris-9g25myvvb-island-city.vercel.app" target="_blank" rel="noreferrer">claris-9g25myvvb-island-city.vercel.app</a>.</li>
          <li><B>Other Vercel project:</B> <B>claris-lime</B> is a separate project in Vercel connected to the same repository. It must not be said that the last deployment updated claris-lime; verify the project and its last deployment before publishing there or changing domains.</li>
          <li><B>CRM-exclusive Supabase:</B> Project ID <B>mimgwleghecseoymgdug</B>; project URL <a className="text-yellow-300 underline" href="https://mimgwleghecseoymgdug.supabase.co" target="_blank" rel="noreferrer">https://mimgwleghecseoymgdug.supabase.co</a>. Direct dashboard access: <a className="text-yellow-300 underline" href="https://supabase.com/dashboard/project/mimgwleghecseoymgdug" target="_blank" rel="noreferrer">open CRM project</a>. This is the CRM-only Supabase project used by the production CRM CLOUD connection described in section 19.</li>
          <li><B>Finance Supabase (do NOT use for CRM):</B> Project ID <B>zrcnpmipdhpjdjkfrrgt</B>. It belongs to Claris / Island City Transit and must remain isolated.</li>
        </ul>

        <P><B>Personal operating model — single owner and human approval:</B></P>
        <P>
          This CRM is designed mainly for Miguel as the individual operator of his client
          portfolio, not for a large company with hundreds of employees. The first version must
          prioritize simplicity, speed on the phone, low operating cost, privacy and direct
          control. Prepare roles and permissions to grow later, but do not introduce unnecessary
          enterprise complexity into the initial experience.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Unified inbox:</B> objective of receiving in a single record the incoming messages by SMS and WhatsApp Business and, when integrated, email. Show client, channel, date, conversation and history.</li>
          <li><B>Reply assistant:</B> when a message arrives, the AI can summarize it and prepare a reply draft using the client's history and permitted data. Miguel reviews, edits and taps <B>APPROVE &amp; SEND</B>. By default, the AI does NOT send external replies automatically. Human approval is mandatory unless Miguel later authorizes specific, limited automations.</li>
          <li><B>Owner notification:</B> notify Miguel of a new conversation, upcoming appointment, new order/request, received document and overdue follow-up. The notification must open the corresponding record or conversation directly.</li>
          <li><B>Client notification:</B> confirmations and reminders through the channel the client chose and authorized. Keep internal owner notices and external client messages separate.</li>
          <li><B>Appointments:</B> when creating or changing an appointment, save date, time, time zone, client, service, location and status. Schedule an internal reminder to Miguel; offer confirmation/reminder to the client only if consent and an enabled channel exist. Handle cancellation and rescheduling.</li>
          <li><B>Follow-ups:</B> each client can have a next action, date/time, owner (initially Miguel), priority and status. The CRM must create notices before the due date and show a list of today's/overdue tasks.</li>
          <li><B>Consent record:</B> save per contact and per channel whether they authorized SMS, WhatsApp and email; date/time, method and scope (transactional/service or marketing), plus opt-outs and preferences. Do not assume that having the phone number or having written once equals accepting promotional campaigns.</li>
          <li><B>Broadcast/campaigns:</B> allow selecting a group of clients and preparing a campaign, but validate consent per channel, exclusions, opt-outs, limits and content before sending. Include preview, recipients, count, a test to Miguel and final confirmation. Never send to the whole address book by default.</li>
        </ul>

        <P><B>Digital card and QR — functional requirement:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Create a professional digital card for Miguel/the business with name, brand/logo, services, phone, email, website and contact buttons. It must look good on mobile and be shareable by SMS, WhatsApp or email.</li>
          <li>Generate a secure public link and a QR that opens that card. Offer actions to share the link/QR and for the client to save the contact as a vCard (.vcf).</li>
          <li>Allow scanning another person's QR or card to start creating a contact, show the detected data and ask for confirmation before saving it. Avoid duplicates and do not import data silently.</li>
          <li>Define which card data is public and allow updating it without changing the QR/link. Do not expose private notes or CRM data on the public card.</li>
        </ul>

        <P><B>Orders, services, payments and routes — connected flow to review:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The owner indicated there is another work/project started, still incomplete, related to receiving requests/orders, payments and route calculation. Before creating a second function, locate and audit that existing work in the repository and in the history.</li>
          <li>Target flow: client sends request/order → CRM creates a pending record → receipt confirmation to the client (if the channel is authorized) → notice to Miguel → Miguel reviews and calls/prepares a quote → calculates route/price per the existing rules → sends proposal → records acceptance/payment → updates the job status → follow-up and closing.</li>
          <li>The initial confirmation must say the request was received, not that the service is confirmed or paid. Separate states: received, in review, quoted, awaiting approval, approved, payment pending, paid, scheduled, in progress, completed and cancelled, adjusted to the existing project.</li>
          <li>Integrate payments only after identifying the provider and the module already started. Do not store full card numbers or sensitive payment data in CRM tables; use the provider's checkout/tokenization. Do not touch Claris's personal finance functions.</li>
          <li>Route, distance, time and price calculation must reuse the existing project if applicable. Do not invent fares or duplicate a route engine without first auditing the existing files and rules.</li>
        </ul>

        <P><B>Notification architecture — product definition:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Push to the owner:</B> web push from the server through device subscription, explicit permission, service worker and keys/credentials stored only on the server. Each notification must include event type, related record, date and internal link. Save several subscriptions if Miguel uses more than one device.</li>
          <li><B>iPhone:</B> to receive Web Push from this web application on iOS/iPadOS, the user must add the web app to the home screen and accept notifications; Apple documents Web Push for web apps added to the Home Screen since iOS 16.4. Test on the real iPhone. Do not promise delivery if the user does not install/authorize or the system blocks notices.</li>
          <li><B>Scheduling:</B> appointments and follow-ups require server-side scheduled jobs and the correct time zone; do not depend on the page being open or on browser timers. Avoid duplicate notices with idempotent keys and allow snoozing/completing.</li>
          <li><B>Independent channels:</B> push is for the owner/app; SMS, WhatsApp and email are external channels for the client. A failure of one channel must not delete the event or prevent it from appearing in the CRM inbox.</li>
          <li><B>Audit:</B> record event created, recipient, channel, verified consent, approved message, provider, send ID, status/delivery/failure and opt-out. Protect personal data and do not store tokens in the frontend.</li>
        </ul>

        <P><B>Practical US messaging rules — validate before activating campaigns:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>For application-to-person SMS to US numbers through a local 10-digit number, providers/carriers require A2P 10DLC registration. The brand and campaign, purpose, samples and verifiable consent process must be configured before sending production traffic. See the official guide: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc.</li>
          <li>Save and respect STOP/UNSUBSCRIBE and other opt-outs; do not send campaigns again to anyone who opted out. Keep sender identification and a HELP/STOP mechanism per channel/provider. Service and marketing messaging must be labeled separately and reviewed under the applicable rules.</li>
          <li>WhatsApp Business Platform requires configuring the business account, number, permissions and approved templates when applicable; review Meta's current rules before programming sends outside the permitted window. Do not confuse WhatsApp Business App with API access to integrate it into the CRM.</li>
          <li>Email must also record preferences, opt-outs and bounces; separate service messages from promotions and keep identification/sender and opt-out links for commercial communications under the applicable regulations.</li>
          <li>The application must block sending if required consent is missing, the channel is opted out or the recipient is not eligible. A broadcast always requires recipient review and Miguel's final approval.</li>
        </ul>


        <P><B>Local implementation record — PWA and owner notices (2026-11-25):</B></P>
        <P>
          This update supersedes the previous state that indicated there were still no
          manifest or service worker. The local base is being built first, without waiting for the
          CRM Supabase authorization. Client information keeps being stored in the existing
          key <B>claris_crm_clients_v1</B>; this update does not migrate, delete or replace
          those data and does not modify the finance module.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Manifest:</B> <B>app/manifest.ts</B> is added, published by Next.js as <B>/manifest.webmanifest</B>, with name Copiloto V7, standalone mode, theme color and root start point. app/layout.tsx declares the manifest and keeps the existing Apple configuration.</li>
          <li><B>Service worker:</B> <B>public/sw.js</B> is added with install/activation, push event reception, notification display and tap action to open the indicated route. The worker is client infrastructure; by itself it does not send notifications or schedule appointments.</li>
          <li><B>CRM panel:</B> <B>components/copiloto/crm-notifications.tsx</B> registers the worker, shows the support/permission state, requests permission only after the user taps the button and allows sending a local test notification. It is integrated in <B>components/copiloto/crm-screen.tsx</B>.</li>
          <li><B>Real scope of this phase:</B> service worker registration and test notification require a compatible browser and granted permission. Also, when the CRM is opened, if there are nextContact dates overdue or today, a grouped local notice is presented at most once a day. This check only runs when the CRM is open; it is not a background scheduler. On iPhone, Web Push requires installing Copiloto on the home screen and granting permission from the installed web app. It has not yet been tested on the physical iPhone.</li>
          <li><B>Remote push still pending:</B> there is still no server-persisted Push subscription, VAPID keys, send endpoint, appointment cron/job or delivery provider. Therefore no notice with the application closed is promised for real events until that backend phase is completed. Appointment/follow-up events are not created at this stage either.</li>
          <li><B>Security and limits:</B> the browser contains no secrets; no SDK is installed and Supabase is not accessed; no SMS, WhatsApp or email are sent. The AI does not send external messages. Existing CRM data remains in local storage.</li>
          <li><B>Files changed in this advance:</B> <B>app/manifest.ts</B> (new), <B>public/sw.js</B> (new), <B>components/copiloto/crm-notifications.tsx</B> (new), <B>app/layout.tsx</B>, <B>components/copiloto/crm-screen.tsx</B> and this manual.</li>
          <li><B>Publication of this phase:</B> commit <B>67f2cb32ff4f8dd43cf01fb2dae8d2db4017fb02</B>, Vercel deployment of the <B>claris</B> project in <B>READY</B> state; production alias includes <B>https://claris-lime.vercel.app</B>. The build reported successful compilation and generated the <B>/manifest.webmanifest</B> route. The separate Vercel project called <B>claris-lime</B> has no Git connected and is not the deployment serving that alias; its independent attempt failed while provisioning resources, so it is not considered a production source.</li>
          <li><B>External verification pending:</B> the production build confirmed compilation and generation of the manifest route, but the HTTP reading tools could not inspect the published endpoints. Confirm in the iPhone browser that <B>/manifest.webmanifest</B> and <B>/sw.js</B> answer, activate permission and tap the test. Remote push delivery and notices with the app closed remain pending VAPID, subscription persistence and a backend job.</li>

        </ul>

        <P><B>Stack and configuration to verify before continuing:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Application: Next.js 16, React and main component <B>CopilotoApp</B>, in the repository <B>transittaxmc-create/claris</B>.</li>
          <li><B>Supabase client stack:</B> <B>@supabase/supabase-js</B> and <B>@supabase/ssr</B> are installed and locked. The CRM uses browser/server Supabase clients and <B>proxy.ts</B> to refresh the CRM session; do not reinstall or duplicate them.</li>
          <li><B>CRM cloud variables:</B> Vercel uses <B>NEXT_PUBLIC_CRM_SUPABASE_URL</B> and <B>NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY</B> for the CRM-only project <B>mimgwleghecseoymgdug</B>. No CRM service-role key is used in the browser or by the CRM state route. Never copy the finance project credentials or expose secret keys to the browser.</li>
          <li><B>CRM Supabase access:</B> verified for Phase 1. The production app connects only to the CRM project <B>mimgwleghecseoymgdug</B>; the finance project remains separate and untouched.</li>
        </ul>

        <P><B>Decision state — confirmed, proposed and pending:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Confirmed by the owner:</B> CRM inside the existing Claris; name V7; separate Supabase for CRM; finance and Plaid intact; access through More → Client management → CRM; do not add an option to the bottom menu.</li>
          <li><B>Implemented and verified in code:</B> initial clients screen with create/edit/delete, search, filters, statuses, notes, follow-up date, tel: and mailto: buttons, local storage in <B>claris_crm_clients_v1</B>, <B>CRM CLOUD</B> panel, Auth and sync with the CRM's exclusive Supabase.</li>
          <li><B>Proposed, not confirmed as created:</B> future relational expansion with profiles, organizations, memberships, contacts, services, transportation jobs, tax cases, documents, appointments, tasks and activity. The current clients/reservations tables, Auth and RLS are created and connected.</li>
          <li><B>Still pending:</B> the owner’s own account sign-in and visual confirmation on his phone; complete client files/documents/appointments/tasks; SMS and WhatsApp Business; automatic reminders; and a background push test. CRM cloud access, Auth, RLS and the idempotent upload of local clients/reservations are no longer pending for Phase 1.</li>
          <li><B>Not decided / not recovered:</B> SMS provider, WhatsApp provider/API, business number, Meta accounts/credentials, costs, templates, campaign rules and detailed consent. Do not ask the owner again for information that already appears in chats or links; first review the history and the available connected accounts.</li>
        </ul>

        <P><B>Objective and scope:</B></P>
        <P>
          Build a professional CRM to organize clients and prospects, contacts,
          conversations, notes, follow-up, appointments, documents and tasks. The CRM must be an
          independent module in its data and permissions, even though it shares the application and its
          navigation. Keep the experience light: do not read or load CRM records until
          the user opens the module. The screen mounts when tab === CRM; do not claim that
          bundle division/code-splitting exists without verifying it.
        </P>

        <P><B>What currently exists — verified in the code:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>components/copiloto/crm-screen.tsx</B> implements client create, edit and delete; search by name, company, phone and email; filters and counters.</li>
          <li>Current fields: name, company, phone, email, status, source, notes/interaction history, next contact date and creation date.</li>
          <li>Current statuses: Lead, Active, Follow-up and Inactive. Sources: Referral, Website, Social media, Returning client, Walk-in and Other.</li>
          <li>Available actions: call by phone, send email, open detail, edit and delete client.</li>
          <li><B>Local cache:</B> clients still use <B>claris_crm_clients_v1</B> in localStorage as the on-device cache. The cloud connection never deletes localStorage.</li>
          <li><B>CRM CLOUD:</B> with an active session, clients sync with the CRM-only Supabase project. Local-only clients upload with the same ids; when the same id exists in both places, the cloud version controls. Without a session, the CRM remains fully local.</li>
        </ul>

        <P><B>Supabase — mandatory separation:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Supabase project destined exclusively to CRM V7, per the owner's information: <B>mimgwleghecseoymgdug</B>. Access and project identity must be verified before running changes.</li>
          <li>Claris / Island City Transit finance project: <B>zrcnpmipdhpjdjkfrrgt</B>. It is different and must NOT be used to store CRM data.</li>
          <li><B>Current status:</B> CRM Supabase access and the production connection are verified. The earlier 2026-11-25 access problem is superseded by section 19.</li>
          <li>The independent CRM tables <B>public.crm_clients</B> and <B>public.crm_reservations</B>, their relations and indexes, Auth and the per-owner RLS policies are already created and connected. Do not recreate or duplicate them.</li>
          <li>The upload from localStorage is idempotent: local-only records upload with the same ids and localStorage is kept as cache. Verify counts when connecting the owner's real account; do not delete local records.</li>
        </ul>

        <P><B>NOTIFICATIONS AND MESSAGING REPORT — updated 2026-11-25:</B></P>
        <P>
          This section records both the technical push-to-owner implementation and the agreed
          workflow to centralize client messages. Always differentiate what already
          exists in code from what still requires a physical test, calendar or external provider.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>PWA base and permission:</B> <B>app/manifest.ts</B> defines Copiloto V7 as an installable web app; <B>app/layout.tsx</B> declares the manifest and Apple metadata; <B>public/sw.js</B> registers install/activation, push reception and notification click. On iPhone, Copiloto must be added to the Home Screen, the installed app opened and permission granted from an owner action.</li>
          <li><B>Local test kept:</B> <B>components/copiloto/crm-notifications.tsx</B> keeps a local test through <B>showNotification</B>. This only tests the notification generated on the device; it does not prove remote delivery.</li>
          <li><B>Remote push implemented in code:</B> <B>lib/crm-push.ts</B> generates an ES256 VAPID JWT and encrypts the Web Push content with AES-128-GCM in the <B>aes128gcm</B> format. No npm dependency was added; it uses <B>node:crypto</B> and the <B>@vercel/blob</B> package that was already installed.</li>
          <li><B>Subscriptions:</B> <B>POST /api/crm/push/subscribe</B> saves the device subscription; <B>DELETE</B> allows removing it. The subscriptions file is encrypted with AES-256-GCM before being saved in Vercel Blob. The Blob document is public under the existing storage mode, but it contains only encrypted data; the encryption key remains a server secret variable. Current limit: 10 devices.</li>
          <li><B>Public configuration:</B> <B>GET /api/crm/push/config</B> delivers only the public VAPID key and the configuration state; it never exposes the private VAPID key or the encryption key.</li>
          <li><B>Remote push test:</B> <B>POST /api/crm/push/test</B> sends a notification from the server directly to the subscription of the device requesting the test. A positive HTTP response confirms acceptance by the push service, but final delivery must be verified by seeing the notice on the real iPhone.</li>
          <li><B>Reliable backend sending:</B> <B>POST /api/crm/push/send</B> sends to the registered subscriptions and requires <B>Authorization: Bearer</B> with <B>CRM_PUSH_SEND_SECRET</B>. This endpoint is for future automations/webhooks; that secret must not be placed in the browser.</li>
          <li><B>Vercel variables created for the correct project:</B> <B>CRM_PUSH_VAPID_PUBLIC_KEY</B>, <B>CRM_PUSH_VAPID_PRIVATE_KEY</B>, <B>CRM_PUSH_STORE_SECRET</B>, <B>CRM_PUSH_SUBJECT</B> and <B>CRM_PUSH_SEND_SECRET</B>. They were configured in Production, Preview and Development. The private values are not copied into this manual or GitHub. <B>BLOB_READ_WRITE_TOKEN</B> already existed and is reused. Supabase was not changed and the finance Supabase was not used.</li>
          <li><B>CRM interface:</B> <B>components/copiloto/crm-notifications.tsx</B> registers the service worker, requests permission only after a button tap, creates/recovers the PushManager subscription, registers it on the server and offers separate buttons for remote test and local test. If a subscription already exists on the phone, it tries to sync it with the server when the CRM is opened.</li>
          <li><B>Route protection:</B> the subscription and test endpoints verify that the request origin is the same site. The remote test sends only to the subscription that requests it, not to all devices. General sending requires the backend secret. Subscriptions are encrypted at rest.</li>
          <li><B>Verification state — updated 2026-11-25:</B> Miguel confirmed a successful physical LOCAL test on his iPhone: he activated <B>Enable Testing</B>, tapped <B>Local Test</B> and received the device notification. This verifies that the service worker / showNotification can show a local notification on that iPhone. <B>Do not confuse with a remote test:</B> remote delivery server → Push Service → iPhone still requires independent explicit confirmation; it also does not yet prove automatic notifications for appointments, messages or tasks.</li>
          <li><B>iPhone and persistent banner:</B> iOS controls the presentation and duration of notifications. A PWA cannot draw a permanent floating banner/bubble on top of another application or keep its own light outside Claris. <B>requireInteraction</B> is requested where the system admits it, but iOS may ignore it. Closing/dismissing a system notification must not mean the future CRM message is resolved; the persistent inbox and its counter must live inside the CRM.</li>
          <li><B>Existing follow-ups:</B> <B>components/copiloto/crm-screen.tsx</B> checks <B>claris_crm_clients_v1</B> when the CRM opens/mounts and notifies of non-inactive clients whose <B>nextContact</B> date is today or earlier, at most once a day with <B>claris_crm_followup_notice_v1</B>. This check does not run in the background while the CRM is closed.</li>
          <li><B>Appointments and trips:</B> there is still no appointment/event model connected to push, no finished CRM calendar, no scheduled job/cron and no automatic reminder 30 minutes before a pickup. The send endpoint already serves as a secure base, but no scheduling or appointment rules are implemented.</li>
        </ul>

        <P><B>Device test record — 2026-11-25:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Action performed by Miguel:</B> he activated the <B>Enable Testing</B> control and ran <B>Local Test</B> from the CRM notifications screen.</li>
          <li><B>Reported result:</B> the notification appeared and was received on the physical iPhone. Result: <B>LOCAL TEST = PASS (confirmed by the owner)</B>.</li>
          <li><B>Scope:</B> local device test; it is not evidence of remote delivery or automatic triggers by appointments. Do not record as an approved remote test.</li>
          <li><B>Next validation:</B> run and confirm <B>Remote Push Test</B> separately; then test a real appointment event with the app closed and verify time, recipient, link to the record and absence of duplicates.</li>
        </ul>

        <P><B>Message workflow — requirements confirmed by the owner:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Single inbox:</B> the objective is to centralize incoming SMS and WhatsApp Business messages inside the CRM, so Miguel does not have to check different applications while working with another platform. Each message must create a conversation/pending item associated with the client, with channel, sender, date/time, original message and status.</li>
          <li><B>Never lose pending items:</B> dismissing or closing the iPhone banner/notification must never delete or resolve the message. The message must remain in a CRM inbox with a visible counter until Miguel answers it or explicitly closes it.</li>
          <li><B>Alert during another app:</B> when a message arrives, the server must send push even if Claris is closed. The system notification may be seen over the work application; iOS decides whether it appears as a banner, how long it lasts and whether it stays in Notification Center. Do not promise a persistent floating overlay on top of all apps.</li>
          <li><B>Reply with approval:</B> the CRM can prepare and queue an editable draft only after Miguel approves it. The current control is <B>Approve &amp; Queue — NOT SENT</B>; no SMS is transmitted until a real sender is connected and verified. He can postpone, ignore or call the client.</li>
          <li><B>Reservation confirmation:</B> the draft must explain precisely what is confirmed: date/day, time, pickup address, destination if provided and service type. If an essential datum is missing, warn and request clarification; do not confirm an incomplete reservation or invent details.</li>
          <li><B>Alternative action:</B> allow calling the client directly. If Miguel marks the call as made, record the action and result in the history, without sending an automatic SMS/WhatsApp.</li>
          <li><B>Minimum states:</B> pending, in review, waiting for client data, draft ready, sent (with provider ID/status when it exists), call made and closed/cancelled. Only mark sent after the provider accepts the send; delivery/read is recorded only if the provider reports it.</li>
          <li><B>Pending reminders:</B> order by urgency/age and allow configurable later notices. Closing the alert does not change the message's state. Add an “I am driving” mode so no phone interaction is required during a trip.</li>
          <li><B>Discreet indicator:</B> inside the CRM there must be a counter/indicator of pending messages and a list that survives the app closing. The icon badge or additional reminders will only be used if iOS and the PWA really support them; do not assume a universal floating dot exists.</li>
          <li><B>SMS privacy:</B> SMS arriving in the iPhone's personal Messages app cannot be automatically imported into a web PWA. To centralize them, a business number/channel and an SMS provider/API with webhooks will be needed. WhatsApp requires WhatsApp Business Platform/API; the personal WhatsApp app does not automatically connect to the CRM.</li>
          <li><B>Providers not decided:</B> Twilio, another SMS provider or a WhatsApp provider is not selected. Research options, costs, business number, Meta configuration, consents and applicable rules before activating real messages.</li>
          <li><B>Channel separation:</B> push is the private notice for Miguel; SMS/WhatsApp are external conversations with the client. Push does not send a reply to the client. The reply only goes out after explicit approval.</li>
        </ul>

        <P><B>Next steps, in this order:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Publish the push code and this manual together; check that Vercel finishes the production build in READY state.</li>
          <li><B>LOCAL TEST completed on 2026-11-25:</B> Enable Testing → Local Test; Miguel confirmed he received the notification on his iPhone. Do not repeat this test as pending.</li>
          <li><B>Pending:</B> confirm the Remote Push Test on the physical iPhone and record the result separately.</li>
          <li>If the remote test fails, review HTTP response, runtime logs, subscription, permission and VAPID keys without exposing secrets; do not mark push as finished until visual confirmation is received on the iPhone.</li>
          <li>Afterwards, create the events/appointments model, configurable reminders (for example 30 minutes before), server queue and scheduling with time zone, deduplication and idempotency; connect the push click to the related record.</li>
          <li>Choose and configure an SMS provider and official WhatsApp Business; implement inbound webhooks and outbound with consent, STOP/HELP, template rules and state records.</li>
          <li>Build the unified persistent inbox, editable drafts, approval before sending, detailed pickup confirmation, call option, “I am driving” mode, counter and pending reminders.</li>
        </ol>
        <P><B>Finance module protection — critical rule for all agents:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The CRM must not modify screens, logic, tables, credentials, environment variables or data of the finance module.</li>
          <li>Do not touch Plaid, balances, bank transactions, projections, ledger, expenses, income, bank sync or reconciliation rules to develop the CRM.</li>
          <li>Do not change the schema or credentials of <B>zrcnpmipdhpjdjkfrrgt</B> as part of CRM work. Use exclusively the authorized CRM project.</li>
          <li>Do not run reset, truncate, mass deletes, general migrations or shared configuration changes without explicit authorization and a verified backup.</li>
          <li>Prefer small, isolated changes in CRM files. Review the diff to confirm that finance modules or unrelated navigation were not modified.</li>
        </ul>

        <P><B>Next steps, in this order:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Confirm on the owner's phone his real CRM CLOUD panel account and the counts after the first sync; keep using only the CRM Supabase <B>mimgwleghecseoymgdug</B>, never the finance one.</li>
          <li>Inspect the code and the project's real state; document what already exists before changing it.</li>
          <li>Preserve the CRM schema, Auth and RLS already created and connected; do not recreate or duplicate them.</li>
          <li>Test with the owner's real account creates, edits, searches, permissions and persistence across devices, always preserving the local data.</li>
          <li>Design and implement push notifications for the agreed events, and test delivery with the application closed on compatible devices with permission granted.</li>
          <li>Verify the result in the real application and update this section with date, files changed, tests, results and next task.</li>
        </ol>

        <P><B>Mandatory protocol for the next agent:</B></P>
        <P>
          Before acting, read this section and review the current code. Continue from the verified
          state, not from assumptions or isolated messages. Do not rebuild the CRM,
          do not duplicate existing functions, do not move the CRM out of More, do not change the bottom menu
          and do not touch the finance module. If an access or state cannot be verified, stop that
          change and document the block. After each session, update this section with completed work, real tests, pending items and the exact point to continue. When closing each task or deployment, expressly confirm to the owner whether the documentation was updated, whether the notification result was recorded and what the real deployment state is. Do not claim something was documented or deployed without verifying it.
        </P>
      </Section>


      <Section title="10. TWILIO SMS — continuity and security (2026-11-25)">
        <P>
          <B>Objective confirmed by Miguel:</B> first connect SMS with Twilio to CRM Copiloto V7;
          afterwards evaluate and integrate WhatsApp Business. The CRM is for a small, personal operation,
          so the first version must be simple, secure and easy to operate from the iPhone.
        </P>
        <P><B>Real state at the close of this session:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The Twilio account was already created by the owner and its Account SID was identified. Do not save the full SID or secrets in this documentation.</li>
          <li>The owner accidentally shared an Auth Token in the chat. Treat that token as exposed and never copy it again, show it, or include it in code, GitHub, documentation or messages.</li>
          <li>The previous review of Vercel environment variables found no TWILIO_* variables and no Twilio SMS integration in the code. Therefore, <B>Twilio is still NOT connected to the CRM</B>; no SMS sending or receiving from Copiloto has been confirmed.</li>
          <li>It was clarified that terminal <B>export</B> commands are not needed for Miguel to run from the iPhone. The integration will be configured through the backend and Vercel secret variables.</li>
          <li>He was told to open <B>https://console.twilio.com/</B> and navigate to <B>Account → API keys &amp; tokens → Auth Tokens</B>. The next security step is to request <B>Request a secondary token</B>. Miguel must not paste or send that token in the chat.</li>
          <li>After creating the secondary token, do not promote it yet until confirming whether another application or service uses the current Twilio credential. When the new token is promoted, the old one stops working; first update and test every integration that depends on it.</li>
          <li>Rotating the Auth Token does not cancel or close the Twilio account. It is an API credential change. Activate MFA/2FA and review Usage, Messaging Logs and Billing to detect unknown activity or charges.</li>
          <li>Store credentials only in Vercel Environment Variables of the correct project, never in the frontend, repository, screenshots or chat. Planned variables: <B>TWILIO_ACCOUNT_SID</B> and <B>TWILIO_AUTH_TOKEN</B>; the values must not appear in documentation. Evaluate a restricted API Key for production when applicable.</li>
        </ul>
        <P><B>Agreed test — first Twilio, then CRM:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>From Safari on the iPhone, enter the Twilio Console and locate <B>Messaging → Try out SMS</B> (the label may vary by console).</li>
          <li>Run a controlled test from Twilio's test tool to his own phone, following the verification restrictions Twilio shows. Do not consider this a CRM integration yet.</li>
          <li>Once the Twilio test works, implement in the Copiloto V7 backend sending and receiving through secure endpoints/webhooks; persist conversations, messages and provider states.</li>
          <li>Configure a business number and check US commercial messaging registration requirements, including A2P 10DLC if a local 10-digit number is used for traffic subject to that requirement.</li>
          <li>Test outbound SMS, inbound SMS, delivery/error states, association with the correct client, consent, STOP/HELP and duplicate prevention. Do not send real campaigns before verifying compliance and consent.</li>
          <li>Create a persistent message inbox in the CRM. Push notifications are private notices for Miguel; SMS/WhatsApp are external channels with clients. Closing a banner must not delete or resolve a message.</li>
          <li>Drafts generated by the CRM always require Miguel's review and explicit approval before sending. Do not confirm a reservation if essential data is missing.</li>
        </ol>
        <P><B>WhatsApp — decision and safety limit:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Miguel currently uses WhatsApp Business App on his iPhone and wants to keep that number and its normal use. <B>Do not migrate, disconnect or register that number in the API</B> without first explaining the consequences and receiving express authorization.</li>
          <li>For a first future test, evaluate the Twilio WhatsApp Sandbox with a test number. Research coexistence between WhatsApp Business App and WhatsApp Business Platform before proposing a migration of the real number.</li>
          <li>WhatsApp is addressed after SMS is integrated and tested. Respect consent, approved templates and platform rules.</li>
        </ul>
        <P><B>Test state and exact next continuation point:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Twilio Console:</B> account created; the secondary token request and an SMS test have not yet been completed in this session.</li>
          <li><B>Credential rotation:</B> pending; do not declare it resolved until the new token is created, every integration that uses it is updated and it is promoted safely. Do not ask the owner for the secret.</li>
          <li><B>Twilio SMS test:</B> pending; no PASS result reported yet.</li>
          <li><B>SMS integration in CRM:</B> pending implementation and tests; no evidence of an active connection.</li>
          <li><B>WhatsApp:</B> pending, with no migration of the personal WhatsApp Business App number.</li>
          <li><B>Push:</B> keep the previous section's state: LOCAL iPhone test confirmed; REMOTE test and automatic appointment triggers remain pending and must be reported separately.</li>
          <li><B>Next action when resuming:</B> guide Miguel from Safari, step by step, to the Auth Tokens screen to request the secondary token without sharing it; then check whether he uses Twilio in another application. Then return to the Twilio Console for the SMS test. Do not ask him for terminal commands.</li>
        </ul>
        <P>
          <B>Closing rule:</B> only mark Twilio as connected when secure credentials exist in
          Vercel, endpoints/webhooks are implemented, a correct deployment exists and real tests of inbound
          and outbound SMS are recorded. Update this section together with each code change.
        </P>
      </Section>

      <Section title="11. CONTINUITY AUDIT — 2026-11-25">
        <P>
          <B>Objective:</B> leave a verifiable recovery point so the next session
          continues from the repository's real state, without rebuilding or repeating work.
        </P>
        <P><B>Verified identity and code backup:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Canonical repository: <B>transittaxmc-create/claris</B>; production branch: <B>main</B>; Vercel project: <B>claris</B> (Next.js), ID <B>prj_EaOp8GqqgF0i4BBEp3CJSY8phcKW</B>.</li>
          <li>Last commit reviewed before this update: <B>e29fca99fd45e317742bd90297da1167ea90b9d8</B> — “Docs: document Twilio SMS continuity and CRM security”. The GitHub combined status check returned Vercel check = success.</li>
          <li>Corresponding production deployment: <B>dpl_E5knNR2e6rgLmkNSMPtktcb8PpfW</B>, commit <B>e29fca99</B>, status <B>READY</B>; production alias includes <B>https://claris-lime.vercel.app</B>.</li>
          <li>The audit confirmed that the CRM and push files exist in <B>main</B>: <B>components/copiloto/crm-screen.tsx</B>, <B>components/copiloto/crm-notifications.tsx</B>, <B>lib/crm-push.ts</B> and the routes <B>/api/crm/push/config</B>, <B>/subscribe</B>, <B>/test</B> and <B>/send</B>.</li>
          <li>This section's update is documentation only; it does not change CRM logic, finance, Supabase or credentials. The commit/deployment resulting from this update must be verified and added to this record.</li>
        </ul>
        <P><B>Push — configuration and test inventory:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The Vercel variable-name inspection found <B>CRM_PUSH_VAPID_PUBLIC_KEY</B>, <B>CRM_PUSH_VAPID_PRIVATE_KEY</B>, <B>CRM_PUSH_STORE_SECRET</B>, <B>CRM_PUSH_SEND_SECRET</B> and <B>CRM_PUSH_SUBJECT</B>, targeted at Production, Preview and Development. The secret values were neither read nor copied.</li>
          <li><B>LOCAL TEST = PASS</B>, confirmed by Miguel on the physical iPhone on 2026-11-25.</li>
          <li><B>REMOTE PUSH TEST = PENDING</B>: Miguel still has to confirm that the server-sent notice physically appeared on the iPhone. The existence of the route and the variables does not prove delivery.</li>
          <li>Automatic appointment reminders, scheduled events, cron/queue and test with the app closed = <B>PENDING</B>.</li>
        </ul>
        <P><B>CRM, persistence and Supabase:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The current CRM uses <B>claris_crm_clients_v1</B> in the device's localStorage. The audit found no evidence of enabled CRM cloud persistence; do not assume sync between phones.</li>
          <li>The expected CRM Supabase project is <B>mimgwleghecseoymgdug</B>; the finance Supabase is <B>zrcnpmipdhpjdjkfrrgt</B> and reusing it for the CRM is forbidden.</li>
          <li>The direct access query to the CRM project returned a lack of permissions during this audit. Status: <B>access and target project not yet verified</B>; do not run migrations or SQL until authorization is recovered and the project ref is checked.</li>
          <li>Environment variables with SUPABASE_* names were found in Vercel, but their values were not inspected. Therefore, <B>which project they point to is not verified</B>. Before using them, confirm the target without showing secrets and avoid any accidental connection to the finance project.</li>
        </ul>
        <P><B>Twilio SMS and WhatsApp:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The Vercel variable inspection found no <B>TWILIO_*</B> variable. The reviewed code also contains no confirmed Twilio SMS integration. Twilio is not connected to the CRM.</li>
          <li>The Twilio account exists, but the Auth Token shared earlier must be treated as exposed. Do not copy it again or ask for it by chat. Request a secondary token and first check whether another service uses the current credential; do not promote/rotate until the safe update of all dependencies is planned.</li>
          <li>SMS test from the Twilio Console, SMS endpoints/webhooks, inbound/outbound SMS and delivery states = <B>PENDING</B>. WhatsApp Business API is also pending; do not migrate or disconnect the current WhatsApp Business App number without express authorization.</li>
        </ul>
        <P><B>Continuation order for the next chat:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>First read sections 8, 10 and 11 of this manual and verify the last <B>main</B> commit and the last real Vercel deployment; do not assume the previous SHA is still the latest after this update.</li>
          <li>Complete the <B>Remote Push Test</B> from the iPhone and record PASS/FAIL based on physical evidence; if it fails, review endpoint, permission, subscription, VAPID and logs without revealing secrets.</li>
          <li>Guide Miguel in Safari to request the Twilio secondary token; before promoting it, confirm whether the previous credential is used in another system. Then run the controlled SMS test in the Twilio Console.</li>
          <li>Recover authorization for the CRM Supabase project, confirm project ref <B>mimgwleghecseoymgdug</B> and safely verify the target of the Vercel variables. Do not touch the finance Supabase.</li>
          <li>Design CRM cloud persistence/Auth/RLS and migration from localStorage only after having access, a reviewed schema and a backup of the local data. Do not delete or overwrite existing records.</li>
          <li>Then implement appointment automations and the persistent message inbox; test each flow on the iPhone before marking it finished.</li>
        </ol>
        <P>
          <B>Backup and closing rule:</B> GitHub <B>main</B> keeps the versioned code and documentation;
          a READY deployment confirms the code's publication, but it is not a backup
          of the device's client data. Do not declare a CRM data backup until an
          export/restore or cloud persistence with verified counts is tested. At the end of each session,
          update this manual with date, commit, deployment (READY/BUILDING/FAILED), files
          modified, tests PASS/FAIL/PENDING, blocks and the exact next step. Expressly
          confirm to the owner that the documentation was updated or state that it could not be.
        </P>
      </Section>

      <Section title="12. PRODUCTION TECHNICAL TEST — 2026-11-25/26">
        <P>
          <B>Deployment:</B> commit <B>4f47fda0989afb5b9581c0007c92122910b31c7d</B>
          was published to production in deployment <B>dpl_7Np1m8P125YmC4JEwq1xsudE9knZ</B>,
          final status <B>READY</B>. The alias <B>https://claris-lime.vercel.app</B> is associated
          with that deployment. This publication contains the section 11 documentation audit.
        </P>
        <P><B>HTTP checks run from the published deployment:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>PASS:</B> the main page answers HTTP 200 and delivers the Copiloto V7 application.</li>
          <li><B>PASS:</B> <B>/api/crm/push/config</B> answers HTTP 200 and returns <B>enabled=true</B> with a public VAPID key present. No private keys or secrets were copied.</li>
          <li><B>PASS:</B> <B>/sw.js</B> answers HTTP 200 and contains the <B>push</B> and <B>notificationclick</B> event handlers.</li>
          <li><B>NOT VERIFIED:</B> end-to-end remote delivery to the iPhone. The test requires a real push subscription generated and registered from Miguel's device; a test must not be sent with an invented subscription or marked PASS just because the server is configured.</li>
          <li><B>PENDING:</B> Miguel must open Copiloto from the installed home-screen icon on the iPhone, enter the CRM notifications panel and tap <B>Send remote push test</B> if the device already appears registered. If it is not registered, first tap <B>Enable remote push</B> and accept the permission. Confirm whether the “Copiloto CRM — push test” notice physically appears.</li>
        </ul>
        <P>
          <B>Overall result:</B> push configuration infrastructure and endpoints available;
          local test previously confirmed PASS; physical remote test still pending; appointment
          automations and tests with the app closed remain pending. Do not declare the notification system
          fully operational until reception on the iPhone is confirmed and the automatic triggers are tested.
        </P>
        <P>
          <B>Observability note:</B> the 24-hour runtime log query was not accepted by
          the Hobby plan's retention; a query of the last 30 minutes returned no records.
          This is not proof of an absence of errors and does not replace the device's functional test.
        </P>
      </Section>

      <Section title="13. CRM RESERVATIONS — AIRPORT FLIGHT TRACKING & ADDRESS NAVIGATION (2026-11-25)">
        <P>
          <B>Objective confirmed by the owner:</B> document the scope of the CRM Copiloto V7
          reservations. This section records agreed requirements; <B>it does not mean they
          are implemented or deployed</B>.
        </P>
        <P><B>A. Pickup and drop-off addresses in the CRM order:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The trip GPS flow that already exists in Copiloto is independent and must not be duplicated or modified by this requirement.</li>
          <li>Inside each CRM reservation, show the pickup and drop-off addresses that belong to that order.</li>
          <li>The original address saved in the order is shown unchanged by default. It is only edited manually if a change or correction appears; editing is never forced and it never changes automatically. If there are no changes, it stays intact. The navigation button always uses the current address saved in the order.</li>
          <li>Add a small navigation button in the corner or beside each address. The pickup button opens the browser/GPS with the pickup address already loaded; the drop-off button opens the browser/GPS with the destination address already loaded.</li>
          <li>The action must avoid copying, rewriting or manually typing the address in the maps app. It does not replace or alter the address saved in the order.</li>
          <li>Allow opening Apple Maps or Google Maps through device-compatible navigation links. If both options are offered, the choice must be clear and fast.</li>
          <li>Navigation starts only when the user taps the button; never start GPS or navigation automatically when opening a reservation.</li>
        </ul>
        <P><B>B. Normal pickup versus airport pickup:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>For a normal address pickup, keep the usual pickup and drop-off flow; do not ask for a flight number or airport fields.</li>
          <li>When the pickup type is airport, the reservation must request and save the necessary flight information, including airline, flight number, date and airport, plus the scheduled time when available.</li>
          <li>Include in the same order a <B>Track Flight</B> action to look up the flight and show its status, for example: on time, delayed, in flight, landed or cancelled.</li>
          <li>Automatic tracking or periodic updates require selecting and integrating a flight data provider. Until an integration with a valid, recent response exists, do not present statuses as confirmed or promise automatic updates.</li>
          <li>The flight record must stay associated with the corresponding reservation. Consider changes of time, local date, terminal and gate when the provider has that data.</li>
        </ul>
        <P><B>C. Implementation limits and rules:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>This scope belongs to the CRM and its reservation orders; do not create a second generic pickup/drop-off module or duplicate the existing trip GPS record.</li>
          <li>Before programming, inspect the real reservation structure and current fields to integrate the buttons without losing or overwriting existing data.</li>
          <li>Test that editing an address keeps the new value and that each button opens the correct destination: pickup opens pickup and drop-off opens drop-off.</li>
          <li>Test separately a reservation with a normal address and one with an airport pickup, including the Track Flight action.</li>
          <li>Research coverage, update frequency, costs and terms of a flight provider before contracting it or activating charges. Make no purchases without the owner's approval.</li>
          <li>The SMS and push channels have their pending states documented in sections 10–12; do not claim that flight alerts or client messages work until each channel is implemented and tested.</li>
        </ul>
        <P>
          <B>Initial implementation — 2026-11-25:</B> a <B>Reservations</B> tab was added inside
          the CRM, separate from the Clients tab and from the existing trip GPS. The component is
          in <B>components/copiloto/crm-screen.tsx</B>. It allows creating, viewing, editing and deleting
          reservations; associating them with an existing client or registering the passenger directly;
          saving service date/time, passengers, status, pickup, drop-off and notes.
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Addresses:</B> original pickup and drop-off are shown unchanged. They are only modified when the reservation is expressly edited and saved. In the detail there are separate links to Apple Maps and Google Maps for each address; navigation only starts when the owner taps the link.</li>
          <li><B>Normal pickup:</B> does not show or require flight fields.</li>
          <li><B>Airport pickup:</B> enables airport/code, airline, flight number, flight date, scheduled arrival time, terminal and gate. Requires airport, number and date to save.</li>
          <li><B>Preconfigured airports:</B> JFK, LGA, EWR, ISP (Long Island MacArthur), BDL (Bradley International, Connecticut), HVN (Tweed New Haven, Connecticut) and HPN (Westchester County, nearby NY area). A manual airport option is kept.</li>
          <li><B>Track Flight:</B> now runs a manual lookup to the server-side ADSB.lol endpoint (<B>app/api/crm/flights/track/route.ts</B>) and searches for the ICAO callsign corresponding to the flight number and airline. If it detects the aircraft, it shows in flight, ground signal or last position not recent, with position, altitude, speed and heading when available. FlightAware remains as an alternative external link.</li>
          <li><B>Current storage:</B> reservations use localStorage with key <B>claris_crm_reservations_v1</B> as the device cache. With an active CRM CLOUD session, they also sync with the CRM's exclusive Supabase; reservations upload when the Reservations tab is opened with the session active.</li>
          <li><B>CRM base:</B> project <B>mimgwleghecseoymgdug</B> is verified and connected for clients and reservations. No new database was created and the finance project <B>zrcnpmipdhpjdjkfrrgt</B> was not touched.</li>
          <li><B>Free provider chosen (2026-11-25):</B> ADSB.lol API, base https://api.adsb.lol/v2, no API key or account for the anonymous tier; 500 requests/day per IP without a key. It has aircraft search by callsign. Its API declares an ODbL 1.0 license. The ODbL expressly allows commercial use; it requires attribution in public use and share-alike if an adapted database is published. Visible attribution is shown in the CRM. ADSB.lol warns that the data is provided “as is” and does not guarantee accuracy, punctuality, completeness or availability. Official sources: https://www.adsb.lol/docs/open-data/api ; https://www.adsb.lol/docs/privacy-license ; https://opendatacommons.org/licenses/odbl/1-0/ ; https://opendatacommons.org/licenses/odbl/summary/.</li>
          <li><B>ADSB.lol implementation:</B> manual on-demand integration, no API key, account or monthly fee. The CRM converts airline/flight number to an ICAO callsign for the common airlines and queries only when Track Flight is tapped; automatic polling is avoided. The API does not by itself offer scheduled times, delay/cancellation confirmation, gate, terminal or passenger availability. A no-signal result does not mean cancellation. FlightAware is kept as an external link. The lookup is limited by the provider (500/day/IP without a key) and uses a brief 15-second cache.</li>
          <li><B>Free integration build:</B> commit <B>0ce3125ba9fab8dca5c69693863cb24e42c6db26</B> obtained Vercel deployment <B>dpl_Fxaior9uKQ2TFJMP1YxhapvhNPn7</B>, status <B>READY</B>, production alias https://claris-lime.vercel.app. The build compiled correctly and the route inventory confirmed <B>/api/crm/flights/track</B>. The project keeps <B>typescript.ignoreBuildErrors=true</B>, so Vercel skips TypeScript validation; the READY status does not replace runtime tests. The documentation of this integration was updated on GitHub; the deployment of that last update will be verified after the documentation commit.</li>
          <li><B>Pending tests after the ADSB.lol integration:</B> no real flight lookup has been run from the iPhone and coverage/identification for the owner's flights has not been confirmed. On the device, test a test reservation, choose one of the preconfigured airports, enter airline and flight number, tap Track Flight and record whether it returns aircraft/position or “no signal”. Repeat with the usual airlines and review callsign mapping. Also test create/edit/reopen, addresses and Apple/Google Maps links, normal pickup and the FlightAware fallback. A READY build only confirms compilation and deployment, not the external provider's result.</li>
        </ul>
        <P>
          <B>Phase status:</B> reservation interface, navigation and free manual ADS-B position lookup implemented in code. Pending: physically verify on iPhone that the API answers with real flights of the airlines used, validate callsign mappings and coverage at the listed airports. The lookup does not confirm delays/cancellations and does not replace airline/airport information. Cloud persistence of clients/reservations is already in production per section 19; automatic alerts remain pending because there is no connected scheduled event feed. Do not alter or duplicate the trip GPS; keep changes isolated from the finance module.
        </P>
      </Section>


      <Section title="14. COMMUNICATIONS & COPILOT PLAN — EMAIL, SMS, MESSAGING AND NOTICES (2026-11-25/26)">
        <P>
          <B>Objective:</B> complete in CRM Copiloto V7 a communications inbox for the personal
          transportation business, connected to the client profile and their reservations. This section
          records the scope and the real state; it does not mean the channels are connected or that
          the flows are implemented.
        </P>
        <P><B>A. Central human-control rule:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Incoming client messages must be viewable in a CRM inbox, with history per client and conversation, channel, date and status.</li>
          <li>Copilot can summarize the message, check the permitted context of the client/reservation and prepare a suggested reply.</li>
          <li><B>Copilot never sends on its own:</B> every draft must stay visible for review and is only sent after the owner's express approval.</li>
          <li>The user can reply immediately or prepare a message for a future date/time; scheduled messages must show status, local time, time zone, a cancel option and a result record.</li>
          <li>Incoming messages are untrusted external content. They must never be able to change internal instructions, access secrets or order Copilot to execute actions without authorization.</li>
        </ul>
        <P><B>B. Email:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Desired scope: receive and show emails, associate them with the client when possible, read the thread, prepare a draft with Copilot, reply after approval and schedule sends.</li>
          <li>A Gmail connection that may be available inside ChatGPT is not an integration inside the CRM application. The CRM needs its own OAuth authorization and secure token storage, or an email provider configured for the application.</li>
          <li>Evaluate the Gmail API for a two-way inbox linked to the owner's account. SendGrid can serve for transactional/outbound mail, but by itself it does not replace a full Gmail inbox for incoming mail and replies.</li>
          <li>Record deliveries, bounces and errors; respect preferences, unsubscribes and the rules applicable to promotional messages.</li>
        </ul>
        <P><B>C. SMS and messaging:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The agreed route for CRM SMS is Twilio. It requires a suitable sender/number, secure credentials in Vercel, inbound/outbound endpoints, an incoming-message webhook, signature validation, status callbacks and history persistence.</li>
          <li>The inbox must allow reading incoming SMS, replying with a Copilot draft subject to approval and scheduling outbound messages.</li>
          <li>For US SMS traffic from local numbers, review and complete A2P 10DLC or the verification that corresponds to the sender type before production. Configure consent, permitted hours, STOP/HELP and recipient suppression; separate transactional messages from promotional campaigns.</li>
          <li>Scheduling: decide whether to use the provider's native scheduling when applicable or an own queue/cron for times, retries, cancellation and traceability. Do not depend on the iPhone or the browser staying open.</li>
          <li><B>iPhone limit:</B> the CRM cannot freely read the iPhone's native Messages/SMS inbox or reply as if it were that app. It will only receive messages sent to the number/sender connected to the provider (for example, Twilio), or data the user shares through an authorized mechanism. Do not promise access to existing personal SMS.</li>
        </ul>
        <P><B>D. WhatsApp Business:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>WhatsApp stays a separate channel, with API/webhooks and customer-care window rules and approved templates.</li>
          <li>The owner wants to keep his current number in the WhatsApp Business App. Do not migrate it, disconnect it or register it in WhatsApp Business Platform/Twilio without first explaining the consequences and receiving express authorization.</li>
          <li>First complete and test SMS; afterwards evaluate the Sandbox and the compatibility/coexistence of the real number.</li>
        </ul>
        <P><B>E. Copilot and internal notifications:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Copilot must help prioritize messages, summarize conversations, draft replies, identify reservation requests, propose follow-ups and prepare reminders.</li>
          <li>Private notifications for the owner: new reservation, change/cancellation, incoming message, pending reply, overdue follow-up, flight with a relevant change and delivery error.</li>
          <li>Internal push notifications are not the same as SMS/email/WhatsApp sent to clients. Closing a notice must not delete or resolve the original message or task.</li>
          <li>Scheduling must run on a server/queue with an explicit time zone, idempotency, retries and a result record; it must not depend on local effects when opening the CRM.</li>
        </ul>
        <P><B>F. Verified state at 2026-11-25/26:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Current CRM:</B> components/copiloto/crm-screen.tsx contains Clients and Reservations tabs. Clients and reservations keep their cache in localStorage and, with an active session, sync with the CRM's exclusive Supabase. There is still no conversation inbox.</li>
          <li><B>Push:</B> push components/routes exist. The local iPhone test was confirmed by the owner. The physical remote test, automatic scheduled reminders and tests with the app closed are still pending.</li>
          <li><B>Twilio SMS:</B> account created, but the previous audit found no TWILIO_* variables in Vercel and no confirmed SMS integration in the CRM. Not connected; inbound/outbound tests pending.</li>
          <li><B>Twilio credential:</B> an Auth Token shared earlier must be treated as exposed. Do not ask for it again or copy it into the chat. Before rotating it, check dependencies; use an appropriate API Key for production and update it securely.</li>
          <li><B>Email:</B> no email connection inside the CRM has been verified. A ChatGPT Gmail connector, if available, does not prove the application has Gmail access.</li>
          <li><B>WhatsApp:</B> API pending; migrating the current WhatsApp Business App number has not been authorized.</li>
          <li><B>Copilot:</B> no two-way inbox or draft generation connected to real conversations is confirmed. Keep human approval mandatory.</li>
        </ul>
        <P><B>G. Recommended execution order:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Review the current CRM model and complete the reservation design: pickup/drop-off, editing only if there are changes, navigation under user action, normal or airport pickup and Track Flight with a provider subject to approval.</li>
          <li>Keep the secure cloud connection already created for clients and reservations before storing conversations or scheduled jobs; keep the local data and verify counts. Do not touch the finance Supabase zrcnpmipdhpjdjkfrrgt.</li>
          <li>Complete remote push and internal automatic triggers; verify physically on the iPhone.</li>
          <li>Complete the Twilio SMS base: secure credentials, compliance, incoming webhook, approved reply, status callback, history and scheduling; test real inbound and outbound.</li>
          <li>Integrate two-way email with the authorized account/provider, drafts, approval, reply and scheduling; test inbound, outbound and delivery.</li>
          <li>Bring Copilot into the multichannel inbox, always with a draft and approval before sending; test controls and protection against malicious instructions inside received messages.</li>
          <li>Afterwards evaluate the WhatsApp Sandbox and, separately, the safe route for the current number. Do not activate mass campaigns without consent and opt-out controls.</li>
          <li>Test each channel on iPhone and record results PASS/FAIL/PENDING, including delivery, reply, cancellation of scheduled messages and behavior with the app closed.</li>
        </ol>
        <P>
          <B>Closing rule:</B> each stage must update this manual with date, files/services
          modified, commit, real deployment (READY/BUILDING/FAILED), confirmed configuration without
          exposing secrets, tests and blocks. A READY deployment does not prove message delivery or
          data backup. Do not mark a channel as operational until real end-to-end tests are complete.
        </P>
      </Section>

      <Section title="15. VERCEL BUILD INCIDENT — CRM IMPORT WITH INVALID LINE BREAK (2026-11-25/26)">
        <P>
          <B>Incident:</B> the production deployment <B>dpl_CapqAWw6DZxVyff5PHbBKiEYZ3pr</B>,
          associated with commit <B>b42e6fde48ea94785fa9eb9c056a21e331c0cd9d</B> ("Fix CRM integration
          formatting and routing"), failed during <B>pnpm run build</B>. The Turbopack log pointed to
          <B>components/copiloto/copiloto-app.tsx:18:47</B> with the error <B>Expected unicode escape</B>.
        </P>
        <P>
          <B>Root cause:</B> the CreditScreen import line contained the literal characters
          <B>\
</B> before the CRMScreen import, instead of a real line break. The parser
          interpreted the sequence as an invalid escape and stopped the compilation. It was not a
          failure of Supabase, dependencies or the Vercel service.
        </P>
        <P>
          <B>Fix verification:</B> the same file was inspected in the failed commit
          and in the <B>main</B> branch. In the failed commit the imports were joined by the literal
          sequence; in <B>main</B> the imports are already separated correctly, each on its own
          line. The change was not repeated or duplicated because it was already applied in the current code.
        </P>
        <P>
          <B>Verified production state:</B> the main branch points to commit
          <B>c130f2456f3c5645f41c6909fdc63c4f237559f8</B> ("docs(crm): record ADS-B live tracking
          deployment and test plan"). Vercel reported deployment
          <B>dpl_MTs2ZT9XhLNGBtBhw4bnbDkW9XPm</B> in <B>READY</B> state, target production,
          with the Claris project's production alias. This confirms the most recent deployment
          finished correctly; it does not change the historical state of the failed deployment.
        </P>
        <P>
          <B>Scope and tests:</B> this review was read and verification only; no CRM logic was
          modified, no new push subscriptions were registered and no new physical notification
          tests were run. The remote push test, automatic reminders and
          tests with the app closed remain pending per the previous sections.
          The finance module was not modified.
        </P>
        <P>
          <B>Rule for build incidents:</B> keep the deployment ID, commit, first
          log error, file/line, root cause, commit containing the fix and the state of the
          later deployment. Do not launch a new build if the fix is already in main and a
          production deployment READY including that code exists.
        </P>
      </Section>

      <Section title="16. PREVIOUS CHAT RECOVERY & HANDOFF BETWEEN CHATS (2026-11-25/26)">
        <P>
          <B>Reason for this update:</B> the previous chat reached its limit and the work continues
          in a new conversation. The owner asked to recover the previous context and document
          the continuity here, without restarting the project or losing agreements. This section complements
          sections 11 to 15; it does not replace them or erase their history.
        </P>
        <P>
          <B>Historical continuity recovered:</B> the previous chats established that CRM Copiloto V7
          is a personal, lightweight module inside Claris, not an independent application or an enterprise
          CRM for hundreds of users. The agreed navigation is More → Client management → CRM.
          Keep the existing bottom menu. Clearly separate the Transportation/CRM work from the
          finance module and from Plaid. The owner asked that decisions, files, links,
          architecture, tests and pending items be documented in this manual at the end of each phase.
        </P>
        <P>
          <B>Continuity history:</B> previous documentation commits identified in the recovered
          chats: <B>eb71faa8fa99fa63dfb83efd2ac12d61aafa5646</B> (vision, scope and initial CRM
          architecture, channels and isolation rules) and <B>e29fca99fd45e317742bd90297da1167ea90b9d8</B>
          (Twilio continuity, exposed-token security, messaging and pending tests).
          The current manual also contains the sections on audit, push, reservations/flights,
          communications and the build incident described above.
        </P>
        <P>
          <B>Reservation decision reaffirmed in the previous chat:</B> every reservation must
          show pickup and drop-off. If the pickup is a normal address, the usual fields are used
          and no flight number is required. If the pickup is an airport, the relevant flight
          details are requested, including flight number and airline when applicable.
          The record must allow opening the tracking from the same flight number through a
          Track Flight action. The saved address is kept and only edited when the user
          reports a change/correction; navigation must use the current saved address.
        </P>
        <P>
          <B>Flight-tracking limit:</B> the idea of checking whether the flight has already landed must
          be shown as tracking information, not as a guarantee that the passenger is ready.
          The ADSB.lol integration described in section 13 detects ADS-B signals/callsign and limited
          technical states; it does not by itself confirm a commercial landing, cancellation, official
          delay, gate, terminal or passenger availability. Do not add automatic tracking,
          ETA or change notifications without a proper provider/events, coverage evaluation
          and real tests. Keep the current manual lookup until that validation is complete.
        </P>
        <P>
          <B>Notifications and operation:</B> the owner wants Copiloto, initially, to
          notify the operator himself about appointments and tasks; later, broadcast or client
          messages may be evaluated. Client notices require a connected channel, consent
          and approval rules. AI-generated messages must remain drafts until
          the owner reviews and explicitly approves them. Push, SMS, email and WhatsApp are
          independent channels; do not infer that one works because another is configured.
        </P>
        <P>
          <B>Real state updated by section 19:</B> the clients/reservations CRM keeps
          the browser's local cache and, with an active session, syncs with its exclusive Supabase
          project <B>mimgwleghecseoymgdug</B>; the finance project
          <B>zrcnpmipdhpjdjkfrrgt</B> is excluded and was not touched. Push has documented infrastructure/endpoints and variables,
          but remote delivery to the iPhone, notifications with the app closed and
          scheduled appointment reminders are still pending tests. Twilio is not connected
          in a confirmed way; WhatsApp Business and email integration in the CRM are also still
          pending. Do not claim push delivery or working SMS without verifiable evidence.
        </P>
        <P>
          <B>Latest Vercel incident of this continuity:</B> failed deployment
          <B>dpl_CapqAWw6DZxVyff5PHbBKiEYZ3pr</B>, commit <B>b42e6fd</B>, due to the literal sequence
          \
 in the import of <B>components/copiloto/copiloto-app.tsx</B>. The later inspection
          verified that the main branch already contained the separated imports. The incident record
          was added in section 15. Afterwards this section 16 was added to the manual in commit
          <B>a205bf3b64c8759e3be178ceff21c677fadd6db1</B>; the production deployment
          <B>dpl_EvqM4SEXgX5kFczLhJGYW6YJ2jsX</B> was verified as <B>READY</B>.
        </P>
        <P>
          <B>Mandatory rule for the next chat:</B> start by reading this manual and reviewing
          GitHub main, the real files and the latest Vercel deployment. Continue from the documented
          state; do not ask the owner to repeat decisions already recorded. After each
          change or deployment, update this manual with the real commit/ID/status, indicate whether push was
          recorded and clearly separate completed tests from pending tests. Do not touch the
          finance module or the finance Supabase.
        </P>
      </Section>


      <Section title="17. SUPABASE CRM AUTH + DATABASE — review and continuity (2026-11-25)">
        <P>
          <B>Superseded for CRM cloud status:</B> this section records the state found on
          2026-11-25, before Phase 1 was built. For the production connection, Auth and sync, read
          section 19.
        </P>
        <P>
          <B>Project verified:</B> Supabase CRM <B>mimgwleghecseoymgdug</B>, name CRM,
          organization Copiloto V7 CRM, region <B>us-east-2</B>, status <B>ACTIVE_HEALTHY</B>.
          The authorization already allows querying the project, API URL and public key. This project
          is exclusive to the CRM. Do not use the finance Supabase <B>zrcnpmipdhpjdjkfrrgt</B>.
        </P>
        <P>
          <B>Real state of Supabase at review:</B> Auth service available in the project;
          <B>0 users</B> registered; <B>0 application tables in public</B>; application
          migration list empty. No user, table, policy, record or migration had been created yet.
          Auth is not connected to the interface and no protected routes have been configured.
        </P>
        <P>
          <B>Security audit:</B> the advisor reports the function
          <B>public.rls_auto_enable()</B> as SECURITY DEFINER executable by anon and
          authenticated. The SQL inspection confirms it is a function associated with the event trigger
          <B>ensure_rls</B>, enabled, and that its body automatically enables RLS when tables are
          created in public. This function and the trigger were neither modified nor deleted. Review
          the warning carefully before permission changes; every new CRM table must have explicit
          RLS ownership policies.
        </P>
        <P>
          <B>Real state of the code on GitHub main:</B> repository
          <B>transittaxmc-create/claris</B>; Next.js <B>16.3.3</B>, React 19, pnpm
          <B>12.3.4</B>. <B>package.json</B> and <B>pnpm-lock.yaml</B> do not include
          <B>@supabase/supabase-js</B> or <B>@supabase/ssr</B>. There is no <B>proxy.ts</B> or
          <B>middleware.ts</B>. app/page.tsx renders CopilotoApp as a client and there is no
          server-side authentication or route guard. No application file was changed
          during this audit.
        </P>
        <P>
          <B>Current CRM model observed:</B> components/copiloto/crm-screen.tsx stores clients
          in localStorage <B>claris_crm_clients_v1</B> and reservations in
          <B>claris_crm_reservations_v1</B>. Clients include name, company, phone, email,
          status, source, notes, nextContact and createdAt. Reservations include clientId,
          passengerName/Phone, serviceDate, pickupTime, passengers, status, pickupKind,
          pickupAddress, dropoffAddress, airport, airline, flightNumber, flightDate,
          scheduledArrival, terminal, gate, notes, createdAt and updatedAt. The local data
          was neither deleted nor migrated; it must be preserved and synced after establishing
          Auth and the schema.
        </P>
        <P><B>Confirmed continuation plan:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Step 2 — Auth:</B> install and pin compatible versions of @supabase/supabase-js and @supabase/ssr; create browser/server clients; use proxy.ts to refresh cookies in Next.js 16; implement register, login, logout, password recovery and session verification with getClaims() on the server; protect the application without altering the finance module's flow. The public variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured in the correct Vercel project. Never put a service_role/secret key in the browser or in Git.</li>
          <li><B>Step 3 — Tables and RLS:</B> design tables for profiles, clients and reservations based on the fields the interface actually uses; relate auth.users through UUID and client_id; create indexes, constraints and SELECT/INSERT/UPDATE/DELETE policies with auth.uid() = user_id. Do not yet create future entities (tax cases, documents, tasks, etc.) without first defining their fields and flows.</li>
          <li>Connect the CRM to the cloud in a later phase and run an idempotent migration of the two local stores, without deleting localStorage until counts and content are verified in Supabase. Test authorized user, denied cross-access, creates, edits, deletes, search and persistence across devices.</li>
        </ol>
        <P>
          <B>Vercel status:</B> the attempt to query deployments through the authorized integration
          returned <B>403 Forbidden</B>; therefore the current READY/BUILDING/FAILED status is not
          verified in this review. Do not claim there was a deployment or that the application was
          tested in production. This manual update is documentation on GitHub; its
          build result must be verified separately.
        </P>
        <P>
          <B>Notifications:</B> the local iPhone test remains previously confirmed by
          Miguel. This review did not run or record a new push test; the remote test and
          automations are still pending.
        </P>
        <P>
          <B>Security and continuity rule:</B> do not touch the finance module, Plaid, balances,
          projections or the finance Supabase project. Do not expose secrets in chat or code.
          Do not delete local data or create test accounts without authorization. Document each
          change, build result, deployment status and push test separately.
        </P>
      </Section>


      <Section title="18. CRM AUTH + TABLES — step 3 result (2026-11-25)">
        <P>
          <B>Superseded for CRM cloud status:</B> this section records the database step before
          the application was connected. For the production connection, Auth and sync, read
          section 19.
        </P>
        <P>
          <B>Database applied:</B> Supabase migration
          <B>20261126024701_crm_auth_clients_reservations_rls</B>, name
          <B>crm_auth_clients_reservations_rls</B>, applied with result SUCCESS in the project
          <B>mimgwleghecseoymgdug</B>. The corresponding SQL file was saved in the
          repository: <B>supabase/migrations/20261126024701_crm_auth_clients_reservations_rls.sql</B>.
        </P>
        <P>
          <B>Tables created and verified:</B> public.crm_clients and public.crm_reservations.
          Both have RLS enabled, a reference to auth.users through user_id, indexes for
          searches/dates and explicit SELECT, INSERT, UPDATE and DELETE policies for the owner
          user. Reservations also validate that the related client belongs to the same user.
          When a client is deleted, the client_id of their reservations is set to NULL;
          reservations are not deleted by cascade.
        </P>
        <P>
          <B>Verification afterwards:</B> list_tables confirmed both tables and RLS enabled=true;
          pg_policies confirmed the eight policies (four per table); the security advisor returned
          <B>0 findings</B> after revoking public/anon/authenticated EXECUTE on
          public.rls_auto_enable(). The ensure_rls event trigger was kept enabled. The tables
          are empty (0 rows) and auth.users still has 0 users. No localStorage data was loaded
          and no test users were created.
        </P>
        <P>
          <B>Step 3 — COMPLETED:</B> initial structure of clients and reservations and RLS
          controls created and verified. This does not mean the CRM interface is already
          connected to the tables; that integration and the safe migration of the phone's data
          are later tasks.
        </P>
        <P>
          <B>Step 2 — Application Auth — PENDING:</B> the Supabase Auth infrastructure
          exists, but register, login, logout, password recovery, SSR/browser clients, proxy.ts
          and server-side protection with getClaims() were not yet implemented.
          package.json and pnpm-lock.yaml still have no Supabase packages. Do not claim that the
          user can sign in or that the routes are already protected.
        </P>
        <P>
          <B>Tool block:</B> the Vercel integration returned 403 Forbidden both when querying
          deployments and when trying to create a work sandbox; the fallback CLI could not be
          used from the available tools. Because of that, no build was run and the deployment
          triggered by the commits could not be verified. To complete Auth with a reproducible
          install and validate build/deployment, authorized access to the Vercel project
          <B>claris</B> must be recovered. Do not switch projects or use the separate Vercel
          project <B>claris-lime</B> by mistake.
        </P>
        <P>
          <B>Documentation and migration commits:</B> manual updated in commit
          <B>84b026c28bcd52cf69080d082a20ef6ebcff141d</B>; migration SQL file added in
          <B>0a29323b3371594b7534bad828fea71adeae3cc9</B>. These commits record the documentation
          and the SQL; they are not a READY deployment.
        </P>
        <P>
          <B>Notifications:</B> no push test was run at this stage. The previously confirmed
          local iPhone test remains LOCAL TEST = PASS; the Remote Push Test and
          automations are still pending.
        </P>
      </Section>


      <Section title="18. REAL PROGRESS — CRM tables created, Auth pending (2026-11-25)">
        <P>
          <B>Superseded for CRM cloud status:</B> this section records the progress known at
          that point on 2026-11-25. Auth is no longer pending; for the production connection,
          read section 19.
        </P>
        <P>
          <B>Owner confirmation:</B> Miguel confirmed that
          <B>mimgwleghecseoymgdug</B> is the correct Supabase project. The Supabase
          connection is authorized and the project answers ACTIVE_HEALTHY. Do not go back to
          the finance project or create another project.
        </P>
        <P>
          <B>Step 3 — first migration applied:</B> migration
          <B>20261126024701_crm_auth_clients_reservations_rls</B> applied correctly.
          <B>public.crm_clients</B> and <B>public.crm_reservations</B> were created, both with
          RLS enabled, foreign keys to auth.users, indexes and status/quantity constraints.
          Both tables have 0 rows; the existing localStorage data was neither migrated nor
          deleted. Eight policies were installed (SELECT/INSERT/UPDATE/DELETE per table)
          limited to <B>auth.uid() = user_id</B>; reservations also verify that the
          client_id belongs to the same user. EXECUTE on public.rls_auto_enable() was
          revoked for PUBLIC, anon and authenticated; the ensure_rls event trigger stays enabled.
        </P>
        <P>
          <B>Verification afterwards:</B> list_tables confirmed both tables and active RLS.
          The pg_policies query confirmed the eight policies. The Supabase security advisor
          returned <B>0 warnings (lints: [])</B> after the migration. Real operations with two
          different authenticated users still need testing; there are no test users and it is
          not claimed that multi-user isolation has already passed end-to-end tests.
        </P>
        <P>
          <B>Step 2 — Auth:</B> still pending integration in Next.js. The Supabase project's
          Auth is available, but there are no login/register/reset-password screens, no
          SSR/browser clients, no getClaims() verification, no proxy.ts and no server-side
          protection. No users have been created and no emails sent. The integration requires
          adding @supabase/ssr and @supabase/supabase-js to the project and pinning the lockfile.
        </P>
        <P>
          <B>Current Vercel block:</B> the authorized Vercel calls to read
          deployments/sandboxes answer <B>403 Forbidden / Not authorized</B>. Because of that,
          no Vercel work environment could be opened and no build/deployment could be verified
          at this stage. No deployment was made. Before deploying, recover authorized Vercel
          access (team islandCity / project claris) or use an authorized GitHub CI flow.
        </P>
        <P>
          <B>Next tasks:</B> (1) restore Vercel read/write or an authorized CI; (2) implement
          SSR Auth for Next.js 16 with proxy.ts, login, register, logout and recovery;
          (3) configure NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel Production/Preview/Development without
          exposing secrets; (4) protect the application and keep the current route/experience;
          (5) build and deploy; (6) run tests with two accounts and then migrate local data
          idempotently, with no loss.
        </P>
        <P>
          <B>Deployment:</B> none was started for this database change. Deployment status:
          <B>not created / not applicable</B>. Push notifications: no changes; no new push test
          was run in this session. The previously documented local iPhone test remains the only
          reported test; remote tests pending.
        </P>
      </Section>

      <Section title="19. CRM CLOUD — PHASE 1 IN PRODUCTION (2026-11-26)">
        <P>
          <B>Deployment record:</B> CRM Phase 1 was deployed to production on 2026-11-26 in commit
          <B>67056180973bbc47a14bb9d18008c4df2a04da70</B> — “feat(crm): conectar CRM a su Supabase
          exclusivo (Auth + sync)”. Vercel deployment <B>dpl_3hY3QqfDeU8uNRzerJzWprkJ5ktV</B> for the
          <B>claris</B> project reached <B>READY</B> on the production target. That deployment went
          out without this note; this section is its immediate follow-up notes record. From now on,
          every deployment must carry its notes in this manual in the same deployment whenever
          possible.
        </P>
        <P><B>What is connected:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The CRM is connected to its own Supabase project, <B>mimgwleghecseoymgdug</B>, using <B>public.crm_clients</B> and <B>public.crm_reservations</B>. This is separate from the finance Supabase project <B>zrcnpmipdhpjdjkfrrgt</B>, which was not touched.</li>
          <li>The CRM screen includes a <B>CRM CLOUD</B> panel for account creation, sign-in, password recovery and sign-out. The owner creates his own account with his email and a password he chooses, confirms the email, and then signs in. The session belongs to the CRM only; it is not a login wall for the whole app.</li>
          <li>The server route <B>/api/crm/state</B> requires a verified session, forces the record owner from that session and returns cloud counts. Anonymous reads are denied by the CRM tables’ owner-only RLS. No CRM service-role key is used by this connection.</li>
          <li>On sign-in, records whose ids already exist in the cloud remain controlled by the cloud version. Local-only clients and reservations upload with the same ids, without creating duplicates. Clients sync when the CRM is opened with a session; reservations sync when the Reservations tab is opened with a session.</li>
          <li>Changes made while signed in continue to sync. <B>localStorage is never deleted</B>: it remains the on-device cache. Without a session, the CRM works locally exactly as before.</li>
        </ul>
        <P><B>Verification recorded for this deployment:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>A test Auth account was created and its email was confirmed; sign-in then succeeded. Invented test clients and a test reservation that existed only locally uploaded with the same ids, continuous changes also reached the cloud, and the state route and direct read-back agreed: 3 test clients and 1 test reservation.</li>
          <li>Reloading produced the same id sets with no duplicates. Anonymous reads of both CRM tables were denied. No calls were made to the finance Supabase project during the verification.</li>
          <li>After the production deployment, the app responded and <B>GET /api/crm/state</B> without a session returned <B>401</B>, confirming that the new route exists and its session gate is closed without sign-in.</li>
          <li>The deployment does not create the owner’s real account for him. His remaining step is to create/sign in to his own account from the CRM CLOUD panel on his phone and visually confirm his real clients and reservations there.</li>
        </ul>
        <P><B>Still not built — do not describe these as connected:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Historical Phase 1 checkpoint:</B> at that deployment, the SMS/WhatsApp inbox was still design-only and no client messages could be sent. This was superseded by the local/cloud message tray in §20; real inbound automation and outbound SMS remain unconnected.</li>
          <li>Automatic appointment/pickup reminders and scheduled background push are not built. Existing owner-push infrastructure is separate and is not proof that automatic reminders work.</li>
          <li>Client photo attachments for pickups/flights are not built yet.</li>
          <li>Complete client files with documents, appointments and tasks/activity are not built yet; the current client record still uses its existing fields, notes and follow-up date.</li>
        </ul>
        <P>
          <B>Finance protection:</B> this Phase 1 deployment changed only the CRM connection files
          listed in its production record. It did not change finance screens, finance data, Plaid or
          the finance Supabase project.
        </P>
      </Section>

      <Section title="20. CRM PHASES 2–5 — ACCOUNT NUMBER, PHOTOS, MESSAGE TRAY, REMINDERS (IN PRODUCTION, 2026-11-26)">
        <P>
          <B>Status:</B> built and verified on 2026-11-26 in the test branch <B>test/crm-fases</B>
          (worktree claris-test-crm), on Miguel&apos;s order to complete everything defined for the
          CRM, and <B>deployed to production in this same deployment</B> — Miguel authorized the
          upload in the same order (“it has a yes next to it”), so no separate “upload it” was waited
          for. The deployment commit is recorded in the report <B>crm-fases-2026-11-26.md</B>.
          This section supersedes the “Still not built” list at the end of section 19: those four
          items are exactly what was built here. Still owed after this deployment: applying the
          migration below in the CRM project, and Miguel&apos;s visual confirmation on his phone.
        </P>
        <P><B>Reservation view — completed in this same build (Miguel&apos;s older request, finished here):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Opening a reservation shows everything in that one view: pickup, drop-off, and for airport pickups the flight number and the scheduled arrival time (plus terminal/gate when present). The list card already shows passenger, date/time, flight and “pickup → drop-off” without opening it.</li>
          <li><B>GPS buttons:</B> each address in the open reservation carries <B>Apple Maps</B> and <B>Google Maps</B> buttons that open navigation with that address already loaded — one for going to pick up, one for going to drop off, no typing. (These buttons already existed; verified in this build.)</li>
          <li><B>Tappable flight number:</B> the flight number itself is now a button — tapping it runs the same live Track Flight (ADS-B) check as the “Track Flight — Live ADS-B” button and shows the live result in the same view. Before this build the flight number was plain text and only the separate button tracked the flight.</li>
        </ul>
        <P><B>Phase 2 — one account number per client + history:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Every client record carries an <B>account number</B>: format <B>ICT-####</B> (ICT-0001, ICT-0002, …), sequential per owner, assigned once when the client is created and never changed or reused. Existing clients without a number receive the next ones in creation order when the CRM opens. <B>Updated 2026-11-26 — see “Account numbers — the ACT flow on accept” at the end of this section:</B> the fill-on-open described in this bullet no longer happens, and new numbers are <B>ACT-0-###</B>, assigned only when Miguel accepts the person. Numbers already assigned (ICT or ACT) are never rewritten.</li>
          <li><B>One account per client, never one per call or booking.</B> Creating a reservation or logging a message for an existing client links to that same record — matched by phone number — and adds to its history; it never creates a second file.</li>
          <li>The client file shows its <B>history</B>: all of the client&apos;s reservations (past and upcoming), how many times they have booked, and how many messages are on file.</li>
        </ul>
        <P><B>Phase 3 — client photos in the record and the reservation:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Photos (the pickup or flight photo a client sends) attach to the client file and to the reservation. On the device they are stored downsized; with a CRM session they also upload to the <B>private</B> Storage bucket <B>crm-client-photos</B> in the CRM Supabase project, in the owner&apos;s own folder, and are viewed through short-lived signed links.</li>
          <li>Without a session — or before the migration below is applied — photos keep working on the device and are honestly marked <B>“Device only”</B>. Nothing breaks and no photo is silently lost.</li>
        </ul>
        <P><B>Phase 4 — message tray with approval queue (NOT an SMS sender):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The CRM has a <B>Messages</B> tab: incoming client messages (SMS / WhatsApp / other) are logged with the client&apos;s text and a proposed reply. A <B>pending counter</B> stays on the tab until every message is resolved — dismissing or minimizing a message never loses the pending item.</li>
          <li>Opening a message shows the client&apos;s text and the <B>editable draft</B>. <B>Approve &amp; Queue — NOT SENT</B> records Miguel&apos;s approval and saves the draft in the CRM cloud outbox. There is no working carrier send and no manual “Mark as sent” control. Discard closes it. A message from an existing client links to their account automatically by phone; a new sender creates their client record from inside the tray.</li>
          <li>When the message is a booking, <B>“Create reservation from this message”</B> opens the reservation form pre-filled and links the created reservation back to the message and to the client&apos;s history.</li>
          <li><B>Outbound status — corrected 2026-11-27:</B> the CRM only queues the approved draft; it does not send SMS. No Amani phone bridge, Twilio sender or carrier callback exists. The UI now says <B>Approve &amp; Queue — NOT SENT</B>, and <B>/api/crm/send/dispatch</B> returns <B>501 phone_dispatch_not_connected</B> instead of accepting an unverified “sent” status. A real sender and authenticated provider callbacks must be implemented before outbound messaging is enabled.</li>
        </ul>
        <P><B>Phase 5 — reservations today + reminders for Miguel only:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Opening the CRM shows <B>“Reservations today”</B> so the day can be planned, a <B>reminders strip</B> (one day before, and pickup in under two hours), and a red <B>“Past reservations still open”</B> list — a reservation that passed without being completed or cancelled stays visible so none is ever lost.</li>
          <li>Reminders are <B>for Miguel only, never for the client</B>. Built today: the reminder model and logic, the in-app strips, and a device notification when the app is open at the right moment. <B>Remote push with the app closed is still blocked</B>: the existing push route stores subscriptions in the Vercel Blob, which is suspended, and there is no scheduler — do not describe remote push reminders as working.</li>
        </ul>
        <P><B>Required step at deploy time — migration first:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The branch carries <B>supabase/migrations/20261126120000_crm_account_photos_messages.sql</B>: account_number + photos columns, the <B>crm_messages</B> table (owner-only RLS) and the private <B>crm-client-photos</B> bucket with owner-folder policies — all in the CRM project <B>mimgwleghecseoymgdug</B> only. It must be applied in that project&apos;s SQL editor <B>before or together with</B> the production deploy.</li>
          <li>The code is safe before the migration: verified live on 2026-11-26 against the real CRM project without it — sign-in, phase-1 sync and client saves keep working (legacy fallback), the state route answers <B>messagesPending: true</B>, and photos stay device-only. The new fields simply start syncing once the migration exists.</li>
        </ul>
        <P>
          <B>Verification:</B> typecheck with zero new errors over the 65-error baseline and a
          passing production build; a 31-check browser harness with invented data only passed
          31/31 (account numbers, history, photos, tray flow, banners, persistence, and the
          pre-migration cloud degradation). <B>Finance protection:</B> no finance screen, finance
          data, Plaid, or the finance Supabase project was touched. Full record:
          crm-fases-2026-11-26.md.
        </P>
        <P>
          <B>Push status correction (2026-11-27):</B> the subscription registry still depends
          on Vercel Blob, whose production store was reported suspended. A test notification
          must NOT bypass registration or pretend that persistence succeeded. The hardening
          branch now validates trusted provider hostnames, blocks redirects, binds each saved
          subscription to the authenticated CRM owner, and only permits that owner to test or
          remove their registered device. Legacy unowned entries are preserved in the encrypted
          store but are excluded from broadcasts until safely re-registered by an owner. No live push was sent during this audit; physical
          delivery remains unverified until the Blob store works and a clearly labeled test is
          explicitly run on the owner's device.
        </P>
        <P><B>TODAY — the MESSAGE light, where GPS READY used to sit (Miguel&apos;s order, 2026-11-26):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The small pill at the top right of <B>TODAY</B> — the exact slot and size of the old “GPS ready” pill — now reads <B>MESSAGE</B> with a small light. While any message in the CRM tray is still <B>pending</B>, the light is lit and <B>blinks softly</B>; with nothing pending it sits quiet and dim. <B>Tapping it opens the CRM straight on the Messages tab.</B> Nothing else on TODAY moved: the entry fields and the SAVE bar are exactly where they were.</li>
          <li><B>Ignore vs. close — the light rule:</B> deliberately ignoring a message with <B>Discard</B> takes it out of pending and <B>turns the light off</B>. Merely closing or minimizing a message because he is busy leaves it pending — <B>the light stays on</B> until he answers it (approve/send) or discards it. The full conversation stays in the client&apos;s file either way.</li>
          <li><B>GPS READY was not removed — it moved down</B> into the <B>LOCATIONS</B> box, next to pickup and drop-off, where the GPS labels already live. There it reads <B>GPS READY</B> in green, lit, while the GPS is active, and <B>GPS OFF</B> in gray when it is not — the same GPS state the header location line has always used, shown in its new place.</li>
        </ul>
        <P><B>Deletion now sticks — in the app AND in the cloud (Miguel&apos;s order, 2026-11-26):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>The bug:</B> the CRM sync used to be a plain union — any record a phone still held locally but the cloud no longer had was uploaded again on the next open, so records deleted in the cloud (or on the other phone) came back. That is why the duplicate Mr. Shah message and the Roberto Prueba test clients kept resurrecting.</li>
          <li><B>The fix:</B> each device now remembers, per record type (clients, reservations, messages), which ids it has already synced with the cloud. On open, a local record that was synced before and is no longer in the cloud counts as deleted elsewhere: it is removed from the device and is NOT uploaded again. A record deleted on this phone is likewise removed from the cloud. Only never-synced records upload as new.</li>
          <li><B>Messages have a real Delete button</B> (in the open message, next to Discard): Delete removes the message from the device and from the CRM cloud for good. <B>Discard is different</B> — it only closes the message and keeps it in the tray history as discarded.</li>
          <li><B>Cleanup done (2026-11-26):</B> Miguel deleted the duplicate Mr. Shah message from 9:30 AM himself, with the new Delete button, and it stayed deleted — in the cloud only the 9:43 AM copy with Ref-7B42 remains (the 9:30 copy lived only on his phone). The three Roberto Prueba test clients and his test reservation stay as they are until Miguel says to remove them.</li>
        </ul>
        <P><B>Three more tray/profile tools (Miguel&apos;s orders, 2026-11-26 — calls ~13:48 and ~14:41):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Reenviar — return a recorded message to the queue:</B> a message with a stored sent status can be returned to pending with its same draft. The button does not resend anything; the next action only queues the draft again and still does NOT transmit SMS until a real sender is connected.</li>
          <li><B>Change a client&apos;s status from their file:</B> the status row in the Clients list only <B>filters</B> (All / Lead / Active / …) — it never changed anyone. The open client file now carries a real <B>Status control</B>: pick Lead, Active, Follow-up or Inactive right in the profile and the change saves on the device and syncs to the CRM cloud like every other CRM change. The status can still also be changed from Edit client, as before.</li>
          <li><B>Follow-up mark on a sent message:</B> a sent message can be marked <B>Mark follow-up</B> — it gains an amber <B>FOLLOW-UP</B> flag in the open message, in the tray list, and a follow-up count in the client&apos;s file history, so a message that still needs a second touch is never lost. Tap it again (“Following up — tap to clear”) when the follow-up is done.</li>
          <li><B>One short step still owed for the follow-up mark to travel to the cloud:</B> apply migration <B>20261126170000_crm_message_follow_up.sql</B> in the CRM project&apos;s SQL editor (one column, <B>needs_follow_up</B>, on crm_messages). Until then the app works exactly the same and the mark stays on the device — the sync route retries messages without the new column instead of failing — and once the column exists the mark syncs like any other message field. Reenviar and the profile status control need no migration: they ride on fields that already exist.</li>
        </ul>
        <P><B>SMS tray — verified capability, not a live carrier connection (audit correction, 2026-11-27):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>The CRM stores the incoming message record and editable reply draft. Approve &amp; Send currently calls <B>/api/crm/send</B>, which checks the signed-in owner, validates the destination and text, and confirms that the message exists in the CRM cloud.</li>
          <li><B>Important:</B> that route returns <B>queued=true</B>; it does NOT transmit an SMS to a carrier. The repository contains no implemented Amani phone bridge, Twilio sender, or carrier callback. Therefore a queued message is <B>not sent</B>; <B>/api/crm/send/dispatch</B> is disabled and returns 501 until a real sender exists.</li>
          <li>The app now labels the action <B>Approve &amp; Queue — NOT SENT</B> and does not claim “sent from your phone” or “delivered”.</li>
          <li>SMS provider integration remains a separate implementation decision. The recorded technical direction is Twilio SMS with signed inbound webhooks, outbound API, status callbacks, idempotency, consent/STOP handling and durable history; no Twilio credentials or live sends are configured in this branch. Do not port the existing phone number or change WhatsApp Business without explicit authorization.</li>
          <li>All validation must use synthetic records and provider test endpoints only. Never send a test message to a real customer or use a customer's real phone number.</li>
        </ul>
        <P><B>Reservation form package — required-field indicators, auto-fill from the message, address verification, optional stop (Miguel&apos;s suggestions, 2026-11-26, while answering the José test message):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Required fields show themselves:</B> in the reservation form (including the one opened from a message), every required field that is still empty carries a discreet <B>amber border</B>; as each one is filled it turns <B>soft green</B>. Nothing shouts and the matte-black design does not change — a glance says what is missing. <B>Pickup time is now required</B>, like name, date, pickup and drop-off (and airport, flight number and flight date on airport pickups): it was the field that silently blocked Miguel. Above the Save button, one line lists <B>everything still missing at once</B> (“Still missing: Pickup time · Drop-off address”), and <B>Save activates only when the list is empty</B> — no more discovering one missing field per attempt.</li>
          <li><B>The form fills itself from the message:</B> “Create reservation from this message” now reads the client&apos;s text and populates the form with what it carries — <B>pickup, drop-off, date, time, passengers</B>, and <B>flight + airport + terminal</B> when the message is an airport pickup. Miguel only <B>verifies and corrects</B>; he never re-types what the client already wrote. Anything the text does not clearly say stays empty and is marked by the required-field indicators above — the parser never guesses.</li>
          <li><B>Addresses are verified against the map:</B> when an address is populated or typed (pickup, stop, drop-off), the form checks it internally with the <B>same map service Copiloto&apos;s GPS already uses</B> (OpenStreetMap Nominatim — no key, no new provider). The check covers <B>street + house number + CITY together</B>: the right street in the wrong city does <B>not</B> verify — that is exactly the mistake that sends a driver to the wrong place. A verified address turns green with its city (“Address verified — Massapequa”); one that does not match turns <B>soft red</B> with the reason, so Miguel can ask the client to repeat the address. <B>The check marks, it never traps:</B> if he decides to go with the address anyway, he can still save. If the map cannot be reached, nothing is marked — an address is never punished for a failed check.</li>
          <li><B>Optional stop on the way:</B> the form carries a <B>“Stop on the way (optional)”</B> field, verified exactly like the other addresses. On the saved reservation the stop shows between pickup and drop-off, and the <B>Full route</B> button opens the route <B>pickup → stop → drop-off</B>; with no stop it is the direct <B>pickup → drop-off</B> route, as before. The reservation list card shows the stop in the route line too.</li>
          <li><B>One short step still owed for the stop to travel to the cloud:</B> apply migration <B>20261126190000_crm_reservation_stop.sql</B> in the CRM project&apos;s SQL editor (one column, <B>stop_address</B>, on crm_reservations). Until then everything works the same and the stop stays on the device — the sync route retries reservations without the new column instead of failing — and once the column exists the stop syncs like any other reservation field.</li>
        </ul>
        <P><B>Account numbers — the ACT flow on accept (Miguel&apos;s rule, 2026-11-26; he approved working on the code clone by voice and in writing the same day):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>A new person who writes has NO account number.</B> Before this fix the app handed out an ICT-#### number the moment a record existed and filled one in for every client without one each time the CRM opened — a stranger “was born” with an account. That fill-on-open is <B>gone</B>: a client without a number stays without one, and the profile honestly reads <B>“No account number yet”</B>.</li>
          <li><B>The number is born when Miguel accepts:</B> creating the person&apos;s record from their message in the tray (the “Create / find client record” tap) creates their profile and assigns the <B>next ACT-0-###</B> right there — <B>before any reservation exists</B>. The sequence runs after the highest ACT already in use: Mr. Shah is <B>ACT-0-100</B>, so the next accepted person gets <B>ACT-0-101</B>, then ACT-0-102, and so on. Creating a client <B>by hand</B> uses the same rule at save time (or Miguel can type his own number in the field instead).</li>
          <li><B>Assigned numbers are never rewritten.</B> Mr. Shah keeps ACT-0-100; records carrying an older ICT-#### number (for example the José test file, ICT-0003) keep it exactly as it is — the new flow never renumbers real records. Matching an existing client by phone returns their file untouched.</li>
          <li><B>The number is editable in the profile — with a duplicate guard:</B> the client form now carries the account number as a real <B>editable field</B>, so Miguel can correct it himself. If he types a number <B>another client already uses</B>, the save is refused with the warning on the form (“already used by …”) and nothing is written — one account per client also means one client per number. The number lives <B>only in the profile</B> (or on an invoice); a message to the client carries a random reference number instead, never the account number — unchanged from before.</li>
          <li><B>No migration needed:</B> the number rides the existing <B>account_number</B> column, so it syncs between the two phones like every other client field from the moment this deploy is live.</li>
        </ul>
      </Section>

      <Section title="21. PRIORITY LIST — what is open, in plain language">
        <P>
          <B>What this list is for (Miguel's words, 2026-11-26):</B> the open priorities live
          here, written plainly, inside his own application. If Amani does not finish something,
          Miguel sees it here and finds a way to finish it. <B>This list is updated in every
          deploy</B>, in this same section, together with that deploy's notes — never in a new
          section.
        </P>
        <P>
          <B>Done with this deploy (2026-11-26):</B> full English audit — the whole application
          and this manual are now 100% in English: every title, label, button, message and note.
          Text only: no logic, no calculations and no data were changed.
        </P>
        <P><B>Priority 1 — The fare meter (the first project on the list):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>The case:</B> the client is in the car and asks “how much are you going to charge me?”. Miguel types the address and the tool gives him the competitive price in seconds, with no guessing.</li>
          <li><B>How it is calculated:</B> the TLC formula split at the city line — miles and minutes <B>inside</B> NYC at their rate and <B>outside</B> at the other one — plus tolls at E-ZPass cost, plus the airport fee when it applies, rounded to $5; and compared with the market: what Uber, Lyft, Empower and Throo charge for that same trip.</li>
          <li><B>Status:</B> the formula is verified against the TLC page and the per-job fare notes are saved. The market-price research is <B>done</B> (2026-11-26): no site gives true live prices — the aggregators publish modeled ranges, Uber hides its prices behind a login, Lyft is app-only, and Empower and Throo publish no web prices; the method is the TLC formula plus his own flat-rate zone card, with spot checks in the rider apps. <B>Still to build:</B> the quick tool (type the address → see the price) and the fare meter inside the reservation form. The agreed strategy: first win clients with the best price; raise prices later.</li>
        </ul>
        <P><B>Priority 2 — The full CRM (this build):</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Done and in production:</B> the cloud connection (phase 1, §19) and CRM phases 2–5 (§20): client account numbers, profile/reservation photos, a message inbox with an editable draft and an approval queue that is explicitly <B>NOT an SMS sender</B>, today's-reservation notices and reminders for Miguel only. And the <B>MESSAGE notice in TODAY</B> (§20): the light in the slot where GPS READY was — it blinks softly with pending messages, tapping it opens the inbox, ignoring it on purpose turns it off and closing it while busy leaves it on; GPS READY moved down beside pickup/drop-off (green on, grey off).</li>
          <li><B>Done:</B> deleting is really deleting — what is deleted in Copiloto is also deleted in the cloud and does not come back; the message inbox has a <B>Delete</B> button separate from Discard (§20).</li>
          <li><B>Done:</B> three more CRM tools (§20) — a <B>Resend</B> button beside the “Sent” of each sent message (it returns to pending with the same draft), a <B>real status control on the client profile</B> (the list row only filtered) and a <B>follow-up mark</B> on sent messages. <B>Done (2026-11-26):</B> migration <B>20261126170000</B> was applied in the CRM Supabase, so the follow-up mark also travels to the cloud.</li>
          <li><B>Done (2026-11-26):</B> migration <B>20261126120000</B> was applied in the CRM Supabase project — the account number, the photos and the messages now also live in the cloud.</li>
          <li><B>Pending — real outbound SMS:</B> the CRM can approve and queue a reply, but it does NOT transmit SMS. No Amani phone bridge, Twilio sender or carrier callback exists. The inbox now labels the action <B>Approve &amp; Queue — NOT SENT</B>, and the dispatch callback returns <B>501</B> until a real authenticated sender is implemented. Migration <B>20261126180000</B> stores queue/status fields only; it does not connect a phone or carrier. No real customer message may be used for testing.</li>
          <li><B>Done:</B> the <B>reservation form package</B> (§20) — required-field indicators (empty amber, filled green; the time is now required), the full missing list at once and Save active only with the form complete; <B>auto-fill from the message</B> (pickup, destination, date, time, passengers and flight); <B>address verification</B> against the map (street + number + city together; it flags, it never blocks); and an <B>optional stop</B>, verified, that joins the GPS route pickup → stop → destination. <B>Done (2026-11-26):</B> migration <B>20261126190000</B> was applied and verified in the CRM Supabase, so the stop also travels to the cloud.</li>
          <li><B>Done:</B> the <B>account flow on accept</B> (§20) — a new person who writes in stays <B>with no account number</B> (the automatic ICT backfill when opening the CRM is over); when Miguel <B>accepts</B> their message and their profile is created, the system assigns the next <B>ACT-0-###</B> after the highest existing ACT (Shah = ACT-0-100 → the next one is ACT-0-101), before any reservation exists; creating a profile by hand uses the same rule. The number is <B>editable on the profile</B> with an anti-duplicate guard (a number already used by another client is not saved) and numbers already assigned are <B>never rewritten</B> (Shah keeps ACT-0-100; José keeps his ICT-0003). No migration: it travels in the account_number column that already exists.</li>
          <li><B>Open — live inbox refresh:</B> today the app loads the cloud messages when it opens; a message that arrives while the app is open does not appear until the app is reopened (that is why a test message was only found after signing out and back in). The fix — messages arriving live while the app is open — is agreed as the next build (ordered 2026-11-26).</li>
          <li><B>Open — special-fare mark on the client profile:</B> when a client's account is opened in the CRM it must show whether they have a special fare (the Mr. Shah model: $90 Manhattan / $55 JFK) so they are quoted <B>their</B> fare; a new client with no mark is quoted with the standard calculation (TLC formula + market). Ordered 2026-11-26; not built yet.</li>
          <li><B>Pending, blocked outside the CRM:</B> the push notice with the app closed — the subscription store (Vercel Blob) is still suspended and a scheduled trigger is missing. And Miguel's visual confirmation on his phone of everything above.</li>
        </ul>
        <P>
          <B>How this list is kept:</B> each deploy moves what is finished out of the list (or
          marks it done with its date), adds the new things Miguel asks for, and leaves the
          priority order as he left it. If something changes order, it changes here first.
        </P>
      </Section>


      <Section title="22. APPLICATION INVENTORY &amp; ARCHITECTURE AUDIT — VERIFIED 2026-11-27">
        <P><B>Purpose and audit boundary:</B> this section is the whole-application map for Miguel and future agents. It records the code that exists on the official repository, the current production baseline, the live CRM Supabase schema, integrations, and what has and has not been verified. It supplements the operational procedures in §§1–21; it does not replace them.</P>
        <P><B>Official source of truth:</B> GitHub repository <B>transittaxmc-create/claris</B>, default branch <B>main</B>. The audit snapshot began at commit <B>cc852d9a5f071d859d7ff5965674f39ce706191e</B> (2026-11-27, 01:38 UTC). The official Vercel project is <B>claris</B>, project ID <B>prj_EaOp8GqqgF0i4BBEp3CJSY8phcKW</B>, connected to that repository and branch. Do not substitute the separate legacy project claris-lime, any Copiloto V8 repository, or a newly created project.</P>
        <P><B>Production deployment checkpoints:</B> at the start of this audit, Vercel deployment <B>dpl_AHXvXu4BeYEyXCU2hgbYkVXB42HL</B> was READY on production/main at commit cc852d9. After the targeted interface and Copilot AI translation fixes, Vercel deployment <B>dpl_2cBwj6uqPsEG7H2eTrqHRZ5EaESD</B> was reported READY on production/main at commit <B>f06c1258df1714f3a44a98c1a8b5d8549d635e29</B>. This confirms the translated application code built and deployed. The final documentation update and complete source-file index were then committed on main at <B>f7c46e3e6838fdef522ff72927bdd4d7b8c7664b</B>; no Vercel deployment was found for that SHA at the time of handoff. An explicit deployment request returned <B>403 Forbidden</B>, and no authorized local Vercel CLI checkout/session was available as a fallback. Therefore the latest manual is updated in GitHub main, but its final file-index and handoff-note revision is not yet confirmed live in production. The next agent must verify the Git integration or use an authorized CLI path; do not retry the same forbidden API request or claim the latest manual is live until a deployment for the current main SHA is READY.</P>

        <P><B>Repository inventory (GitHub recursive tree):</B> 404 tracked tree entries in total; 88 entries belong to generated .open-next build output, leaving 317 non-.open-next source/config/asset entries in this snapshot. The repository includes 34 Next.js API route handlers, 99 files under components/copiloto, 20 files under lib (including lib/crm), 21 scripts, 60 public assets, and six SQL migration files. The main source areas are app/, components/copiloto/, lib/, scripts/, public/, and supabase/migrations/. Generated .open-next output is not source of truth and must not be edited as application code.</P>

        <P><B>Application shell and navigation:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Runtime:</B> Next.js 16.3.3, React 19, TypeScript 5.7.3, Tailwind CSS 4, Supabase JS/SSR, Vercel Analytics, Vercel Blob, Recharts, and Lucide icons. Package manager is pnpm 12.3.4. The package scripts include dev, build, Cloudflare build/preview/deploy and start; there is no package-level test or lint script.</li>
          <li><B>Entry:</B> app/page.tsx renders components/copiloto/copiloto-app.tsx. That file is the main application orchestrator: navigation state, trip and expense state, shift/GPS/toll events, bank/finance synchronization, scanning, backup, and child-screen wiring.</li>
          <li><B>Shell:</B> app/layout.tsx provides metadata, viewport and English document language; app/manifest.ts provides the PWA manifest; public/sw.js provides the service worker; app/globals.css contains global/mobile presentation rules.</li>
          <li><B>Main navigation:</B> TODAY, EARNINGS, MONEY and REPORTS. The More menu contains CRM, TAX 2026, EXPENSES, CREDIT, SUMMARY, DASHBOARD, COPILOT AI, DATA &amp; BACKUP, ENVELOPES, TOLL AUDIT and HOW IT WORKS.</li>
        </ul>

        <P><B>Functional screen inventory:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>TODAY / Entry:</B> components/copiloto/entry-screen.tsx — trip entry, platform, pickup/drop-off GPS, fare, cash, tips, tolls, fee, notes, shift timer, hourly rate, camera/dispatch scan and CRM message indicator.</li>
          <li><B>EARNINGS / Register:</B> register-screen.tsx and trip-edit-sheet.tsx — trip history, platform grouping, gross/net, expected versus received, pending/matched/short/over states, edit, no-show/canceled outcomes, export/import and receivable updates.</li>
          <li><B>Money / Finance:</B> finance-screen.tsx, cash-flow-register.tsx, cash-flow-store.ts, finance-store.ts, finance-sync.ts, finance-cloud.ts, finance-bridge.ts, dinero-forecast.ts, dinero-proyeccion.tsx and related projection components — account registers, actual bank balances, income/expense ledger, scheduled items, 90-day projections, matching, reconciliation, liabilities, weekly summaries and account controls.</li>
          <li><B>Expenses:</B> expenses-screen.tsx, expense-register-form.tsx, receipt-scanner.tsx, receipts.ts, bill-payments.ts, liabilities.ts and related panels — paid receipts, unpaid bills, categories, business/personal classification, invoice references, scanning, duplicate prevention and recurring due dates.</li>
          <li><B>Reports / Taxes:</B> reports-screen.tsx, mileage-report.tsx, schedule-c-draft.tsx, tax-2026-screen.tsx and tax-worksheet.tsx — trip and expense summaries, transfer fees, mileage log and Schedule C draft. Tax figures remain estimates and require professional review before filing.</li>
          <li><B>Dashboard / production:</B> dash-screen.tsx, v1-dash/v1-dash-screen.tsx, hourly-production.tsx, hourly-strip.tsx and related modules — daily/weekly progress, shift-based hourly production and goals.</li>
          <li><B>Tolls:</B> toll-detect.ts, toll-plazas-2026.ts, shift-tolls.ts, week-tolls.ts, ezpass-weekly.ts, toll-audit.ts and toll-audit-screen.tsx — GPS plaza detection, shift log, weekly statement comparison and reconciliation.</li>
          <li><B>Data, backup and sync:</B> data-screen.tsx, storage.ts, backup.ts, lib/backup.ts, lib/sync.ts and lib/data-sync.ts — local persistence, IndexedDB recovery, export/import, full backup, two-phone encrypted trip sync and the newer authenticated finance document sync.</li>
          <li><B>Other screens:</B> credit-screen.tsx and credit-store.ts; sobres-screen.tsx and sobres-store.ts; ai-screen.tsx and ai-daily-classification.ts; crm-screen.tsx and crm-notifications.tsx; how-it-works-screen.tsx. These are separate functional modules coordinated by copiloto-app.tsx.</li>
        </ul>

        <P><B>Persistence and data boundaries:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Device storage:</B> trip and expense records use localStorage plus IndexedDB backup/recovery. The app also keeps local finance keys, preferences, shift state, mileage, tombstones and CRM offline records. A deleted record must carry its tombstone through sync so it cannot reappear as a merge artifact.</li>
          <li><B>Bank feed:</B> the existing Plaid feed and financial register source are not to be replaced or reconfigured as part of CRM work. The historical financial Supabase project is zrcnpmipdhpjdjkfrrgt; do not confuse it with the CRM project.</li>
          <li><B>New two-phone finance sync:</B> app/api/data/publish and app/api/data/snapshot store one owner-scoped document in public.finance_sync_doc inside the CRM Supabase project. This is a separate table from crm_clients, crm_reservations and crm_messages. It uses the authenticated CRM session, owner_id RLS and the DATA_SYNC_KEY/BANK_PUBLISH_KEY request guard; it does not make the old financial Supabase project the CRM database.</li>
          <li><B>Google Drive:</B> app/api/gdrive/* and Data screen support OAuth, upload, list/restore and disconnect. Runtime success still depends on the configured Google credentials and an actual device test.</li>
          <li><B>Scanners:</B> receipt, balance, bank screenshot, toll statement and iOS scan-inbox routes live under app/api/scan-*. The scan inbox is a separate temporary intake path, not the finance ledger itself.</li>
        </ul>

        <P><B>API route inventory — 34 handlers:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>AI:</B> /api/ai-chat.</li>
          <li><B>Bank:</B> /api/bank/edit-tx, publish, refresh, snapshot and sync-request.</li>
          <li><B>CRM:</B> /api/crm/state; /api/crm/flights/track; /api/crm/send and /api/crm/send/dispatch; /api/crm/push/config, subscribe, test and send.</li>
          <li><B>Cross-device data:</B> /api/data/publish and /api/data/snapshot; /api/finance/state; /api/sync.</li>
          <li><B>Google Drive:</B> /api/gdrive/auth, callback, disconnect, restore, status and upload.</li>
          <li><B>Plaid:</B> /api/plaid/create-link-token, exchange and sync.</li>
          <li><B>Scanning and version:</B> /api/receipt-image, /api/scan-balance, /api/scan-bank-shot, /api/scan-inbox, /api/scan-receipt, /api/scan-toll-statement and /api/version.</li>
        </ul>

        <P><B>CRM module — actual implementation map:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>UI and orchestration:</B> components/copiloto/crm-screen.tsx owns client, reservation and message views, local persistence, session state, cloud reconciliation, account-number assignment, photo controls, message drafts, follow-up and reminder behavior. crm-notifications.tsx manages browser permission, service-worker registration and push subscription/test UI.</li>
          <li><B>Supabase clients:</B> lib/crm/supabase-browser.ts and supabase-server.ts use only NEXT_PUBLIC_CRM_SUPABASE_URL and NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY. There is no CRM service-role key in these clients. proxy.ts refreshes CRM session cookies; app/api/crm/state/route.ts validates server claims and derives user_id from the authenticated session, never from the request body.</li>
          <li><B>Data mapping and helpers:</B> lib/crm/crm-cloud.ts maps app objects to database rows; parse-message.ts conservatively extracts reservation details from message text; geocode.ts checks street/house number/city using OpenStreetMap Nominatim; crm-photos.ts keeps a local copy and uploads photo bytes to private Storage with temporary signed URLs.</li>
          <li><B>Message sending truth:</B> /api/crm/send validates and queues an approved message; it does not itself transmit an SMS over the carrier. The paired-phone dispatch process reports sending/sent/failed through /api/crm/send/dispatch. A sent state means the phone dispatched the text, not that the customer's device confirmed delivery. Never claim automatic SMS delivery or a delivered receipt that this channel cannot prove.</li>
          <li><B>Flight tracking:</B> /api/crm/flights/track maps airline/flight number to an ICAO callsign and queries ADSB.lol. The app must still be tested with real flights; an HTTP READY deployment does not prove flight-provider coverage or correct airline mapping.</li>
          <li><B>Push:</B> browser push code exists, including the service worker and VAPID endpoints. Subscription storage currently depends on Vercel Blob configuration. The manual's previously recorded blocker is the suspended Blob store and missing scheduled trigger; do not mark closed/production-ready until a real closed-app notification reaches the iPhone and the subscription store/trigger are verified.</li>
        </ul>

        <P><B>CRM Supabase — live state checked 2026-11-27:</B> project ref <B>mimgwleghecseoymgdug</B>, project name CRM, region us-east-2, status <B>ACTIVE_HEALTHY</B>, PostgreSQL 17.12.0.000. The database returned two Auth users (count only; no account identities exposed) and these public tables:</P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>crm_clients — 7 rows:</B> id, user_id, name, company, phone, email, status, source, notes, next_contact, timestamps, account_number and photos.</li>
          <li><B>crm_reservations — 2 rows:</B> owner/client references, passenger identity, service date/time, passenger count, status, standard/airport pickup, pickup/stop/drop-off addresses, airport/airline/flight/date/arrival/terminal/gate, notes and photos.</li>
          <li><B>crm_messages — 1 row:</B> owner/client/reservation references, channel, sender, body, draft reply, status, approval/sent timestamps, needs_follow_up, send_state, send_error, send_via and dispatched_at.</li>
          <li><B>finance_sync_doc — 1 row:</B> owner_id, JSON document and updated_at. This is the separate authenticated cross-device finance sync document, not a CRM client record.</li>
          <li><B>RLS:</B> enabled on all four public tables. CRM clients, reservations and messages have SELECT/INSERT/UPDATE/DELETE policies scoped to auth.uid() = user_id. finance_sync_doc is scoped to owner_id = auth.uid().</li>
          <li><B>Photo storage:</B> bucket crm-client-photos exists and is private. Four Storage policies restrict SELECT/INSERT/UPDATE/DELETE to the authenticated owner's first path segment.</li>
          <li><B>Schema presence:</B> account_number, client/reservation photos, stop_address, needs_follow_up and all send_* columns were checked and are present. The CRM schema therefore contains the later phase fields described in §20.</li>
        </ul>

        <P><B>Migration ledger discrepancy — do not ignore:</B> the repository contains six SQL migration files, but Supabase's recorded schema_migrations list returned only three versions (20261126024701, 20261126033314 and 20261126035245). The live database nevertheless contains the account_number/photos/messages/follow-up/send/stop columns, the private photo bucket, and finance_sync_doc. This is consistent with later SQL having been applied through the Supabase SQL Editor without being recorded in the CLI migration ledger. Do not blindly re-run the SQL or assume it is missing. Before the next schema change, reconcile the migration ledger against the live schema and record exactly which scripts were applied and how.</P>

        <P><B>Supabase advisor findings checked 2026-11-27:</B></P>
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li><B>Security warning:</B> leaked-password protection is disabled in Supabase Auth. Review and enable it in Auth security settings after confirming the intended policy.</li>
          <li><B>Performance warnings:</B> two crm_messages composite foreign keys lack covering indexes; finance_sync_doc RLS policies trigger an auth initialization-plan warning; crm_clients has duplicate unique indexes on (id, user_id).</li>
          <li><B>Informational findings:</B> crm_messages_client_idx and crm_clients_user_followup_idx were reported unused at the time of the advisor scan. Do not remove indexes solely from this observation without checking workload and constraints.</li>
          <li><B>Edge Functions:</B> Supabase returned zero Edge Functions for this project.</li>
        </ul>

        <P><B>English-language audit — corrections made during this pass:</B> the latest earlier commit claimed every visible string was English, but a targeted source review found remaining Spanish UI text. The audit corrected visible labels/statuses in data-screen.tsx, reconciliation-view.tsx, trip-edit-sheet.tsx, register-screen.tsx, reports-screen.tsx, schedule-c-draft.tsx, dash-screen.tsx, expenses-screen.tsx and mileage-report.tsx, and corrected the manual's CANCELADO terminology. It also translated the in-app AI prompt, photo/bank/expense/schedule response instructions, API fallback messages and logging text in app/api/ai-chat/route.ts. The AI routing tags were aligned with the English tags already sent by ai-screen.tsx, fixing the bank-reconciliation and expense-analysis mode detection mismatch. Examples of corrected interface labels include CANCELAR, CONECTANDO, CONECTAR Y SINCRONIZAR, SINCRONIZAR AHORA, DESCONECTAR, EXPORTAR/IMPORTAR JSON, BLOQUEADO, Pendiente, RECIBIDO, ESPERADO, DIFERENCIA, CANTIDAD, ENE–JUN/JUL–DIC, Aprobar todo, Todo cuadra and the CSV and on-screen reconciliation headings. User-facing strings and AI instructions now use consistent professional English while Copilot continues to understand Spanish input and reply in the user's language.</P>
        <P><B>Language limitation to track:</B> internal developer comments across legacy source files still contain Spanish. They are not rendered as interface labels and do not change runtime behavior, but they are source-level documentation. If Miguel requires every code comment to be English as well, perform a separate source-comment translation pass, preserving all code, formulas, identifiers, and historical decision notes. Do not claim that every source comment has been translated until that pass is complete.</P>

        <P><B>Build and test evidence:</B> Vercel confirmed a READY production build for commit f06c125, which contains the UI and AI prompt translation code changes. The later manual-only source-file index commit f7c46 has no confirmed deployment yet, for the access reason recorded above. package.json exposes no test/lint script. The repository contains 21 scripts, including focused Node checks for backup, bank CSV, cash flow, classification, dates, decisions, expenses, finance, money, platforms, production, reconciliation, schedules and sync. This audit inventoried those scripts but did not execute them in this GitHub-only inspection. Do not infer that the 21 scripts passed; execute them in a safe linked environment and record the actual results.</P>

        <P><B>Agent continuation protocol — next actions in order:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Check the newest main commit and newest production deployment for project claris. Confirm the build is READY and tied to the latest documentation/UI correction commit; if FAILED, read the actual build log before editing anything.</li>
          <li>Run the available Node verification scripts in a safe project environment, then a production build. Record each command and pass/fail result; do not infer tests passed because a prior deployment was READY.</li>
          <li>Finish the English audit, starting with the in-app AI system prompt and remaining source-level language. Preserve the user-approval gate, no-silent-write rule, accounting definitions, and existing business logic. Search again for Spanish interface literals and generated/exported text.</li>
          <li>Reconcile the six repository SQL migration files with the three recorded Supabase migration entries and the live schema. Record the actual applied state; do not reapply DDL blindly.</li>
          <li>Review the Auth leaked-password warning, duplicate indexes, missing composite foreign-key indexes and finance_sync_doc RLS performance warning. Propose minimal migrations/settings changes; do not weaken RLS or drop data/indexes without a reviewed plan.</li>
          <li>Complete real-device CRM tests: sign-in/sign-up/password reset; client create/edit/status/account number; reservation create/edit, message auto-fill, required fields, address verification, optional stop and route links; photo upload/view/delete on both phones; message approval, actual paired-phone dispatch and failure/retry; follow-up persistence; reminders; and closed-app push.</li>
          <li>Build and test live inbox refresh while the app remains open, and implement the special-fare marker/quote behavior in the client profile. Both remain open in §21.</li>
          <li>Keep the fare-meter project in §21 as a separate priority. Do not mix its unbuilt UI with completed CRM capabilities.</li>
          <li>Update this manual in the same deployment as every code/configuration change. Update the index only for genuinely new topics; update existing sections in place. At handoff, state exact commit, deployment status, database state, tests actually run, remaining blockers and the next single task.</li>
        </ol>

        <P><B>Non-negotiable preservation rules:</B> stay in transittaxmc-create/claris, branch main and Vercel project claris. Keep CRM data in Supabase mimgwleghecseoymgdug. Do not redirect CRM code to zrcnpmipdhpjdjkfrrgt, do not change the Plaid source or the existing finance/register logic while auditing CRM, do not create a second app/repository/project, do not expose secrets in code or documentation, and do not report a feature as verified unless its real behavior was tested. Preserve all user approval gates and the no-silent-modification rule.</P>

        <P><B>Complete file-by-file source index:</B> this index is generated from the same GitHub main tree snapshot as the counts above. It is intended for agents to locate existing modules before creating new ones. The 34 API route paths are enumerated in the API inventory above; the lists below cover the 99 Copiloto files, all shared library files, all 21 scripts, and all six database migrations.</P>
        <P><B>components/copiloto/ — 99 files:</B></P>
        <ul className="mb-3 list-disc space-y-1 pl-4 text-[11px] text-neutral-300">
          <li><B>components/copiloto/account-flags.ts</B></li>
          <li><B>components/copiloto/account-registers-impl.tsx</B></li>
          <li><B>components/copiloto/account-registers.part1</B></li>
          <li><B>components/copiloto/account-registers.tsx</B></li>
          <li><B>components/copiloto/account-settings.tsx</B></li>
          <li><B>components/copiloto/accounts-panel.tsx</B></li>
          <li><B>components/copiloto/ai-daily-classification.ts</B></li>
          <li><B>components/copiloto/ai-screen.tsx</B></li>
          <li><B>components/copiloto/auto-categorize.ts</B></li>
          <li><B>components/copiloto/backup.ts</B></li>
          <li><B>components/copiloto/bank-audit-sheet.tsx</B></li>
          <li><B>components/copiloto/bank-brand.ts</B></li>
          <li><B>components/copiloto/bank-tx-report.tsx</B></li>
          <li><B>components/copiloto/bill-payments.ts</B></li>
          <li><B>components/copiloto/bottom-nav.tsx</B></li>
          <li><B>components/copiloto/cash-flow-register.tsx</B></li>
          <li><B>components/copiloto/cash-flow-store.ts</B></li>
          <li><B>components/copiloto/copiloto-app.tsx</B></li>
          <li><B>components/copiloto/credit-screen.tsx</B></li>
          <li><B>components/copiloto/credit-store.ts</B></li>
          <li><B>components/copiloto/crm-notifications.tsx</B></li>
          <li><B>components/copiloto/crm-screen.tsx</B></li>
          <li><B>components/copiloto/dash-screen.tsx</B></li>
          <li><B>components/copiloto/data-screen.tsx</B></li>
          <li><B>components/copiloto/dinero-forecast.ts</B></li>
          <li><B>components/copiloto/dinero-proyeccion-v2.tsx</B></li>
          <li><B>components/copiloto/dinero-proyeccion.tsx</B></li>
          <li><B>components/copiloto/dispatch-fab.tsx</B></li>
          <li><B>components/copiloto/dispatch-scan.ts</B></li>
          <li><B>components/copiloto/dual-sync.ts</B></li>
          <li><B>components/copiloto/entry-screen.tsx</B></li>
          <li><B>components/copiloto/expense-register-form.tsx</B></li>
          <li><B>components/copiloto/expenses-screen.tsx</B></li>
          <li><B>components/copiloto/ezpass-weekly.ts</B></li>
          <li><B>components/copiloto/finance-bridge.ts</B></li>
          <li><B>components/copiloto/finance-cloud.ts</B></li>
          <li><B>components/copiloto/finance-register-table.tsx</B></li>
          <li><B>components/copiloto/finance-screen.tsx</B></li>
          <li><B>components/copiloto/finance-store.ts</B></li>
          <li><B>components/copiloto/finance-sync.ts</B></li>
          <li><B>components/copiloto/geo.ts</B></li>
          <li><B>components/copiloto/hourly-earnings-chart.tsx</B></li>
          <li><B>components/copiloto/hourly-overlay.tsx</B></li>
          <li><B>components/copiloto/hourly-production.tsx</B></li>
          <li><B>components/copiloto/hourly-strip.tsx</B></li>
          <li><B>components/copiloto/how-it-works-screen.tsx</B></li>
          <li><B>components/copiloto/liabilities-screen.tsx</B></li>
          <li><B>components/copiloto/liabilities.ts</B></li>
          <li><B>components/copiloto/mileage-log.ts</B></li>
          <li><B>components/copiloto/mileage-report.tsx</B></li>
          <li><B>components/copiloto/money-input.tsx</B></li>
          <li><B>components/copiloto/money-ui.tsx</B></li>
          <li><B>components/copiloto/num-pad.tsx</B></li>
          <li><B>components/copiloto/open-bills-panel.tsx</B></li>
          <li><B>components/copiloto/open-bills-store.ts</B></li>
          <li><B>components/copiloto/pending-deposits.tsx</B></li>
          <li><B>components/copiloto/per-hour.ts</B></li>
          <li><B>components/copiloto/plaid-connect.tsx</B></li>
          <li><B>components/copiloto/platform-avatar.tsx</B></li>
          <li><B>components/copiloto/platform-meta.ts</B></li>
          <li><B>components/copiloto/projected-cash-flow.tsx</B></li>
          <li><B>components/copiloto/proyeccion-charts.tsx</B></li>
          <li><B>components/copiloto/proyeccion-form.tsx</B></li>
          <li><B>components/copiloto/proyeccion-foto1.tsx</B></li>
          <li><B>components/copiloto/proyeccion-foto2.tsx</B></li>
          <li><B>components/copiloto/proyeccion-shared.tsx</B></li>
          <li><B>components/copiloto/receipt-scanner.tsx</B></li>
          <li><B>components/copiloto/receipts.ts</B></li>
          <li><B>components/copiloto/reconciliation-check.ts</B></li>
          <li><B>components/copiloto/reconciliation-view.tsx</B></li>
          <li><B>components/copiloto/reconciliation.ts</B></li>
          <li><B>components/copiloto/register-screen.tsx</B></li>
          <li><B>components/copiloto/registers-store.ts</B></li>
          <li><B>components/copiloto/reports-screen.tsx</B></li>
          <li><B>components/copiloto/scan-inbox.ts</B></li>
          <li><B>components/copiloto/schedule-c-draft.tsx</B></li>
          <li><B>components/copiloto/screenshot-txs.ts</B></li>
          <li><B>components/copiloto/selector-logo.tsx</B></li>
          <li><B>components/copiloto/shift-tolls.ts</B></li>
          <li><B>components/copiloto/shift.ts</B></li>
          <li><B>components/copiloto/sobres-screen.tsx</B></li>
          <li><B>components/copiloto/sobres-store.ts</B></li>
          <li><B>components/copiloto/split-editor.tsx</B></li>
          <li><B>components/copiloto/storage.ts</B></li>
          <li><B>components/copiloto/tax-2026-screen.tsx</B></li>
          <li><B>components/copiloto/tax-worksheet.tsx</B></li>
          <li><B>components/copiloto/toll-audit-screen.tsx</B></li>
          <li><B>components/copiloto/toll-audit.ts</B></li>
          <li><B>components/copiloto/toll-detect.ts</B></li>
          <li><B>components/copiloto/toll-plazas-2026.ts</B></li>
          <li><B>components/copiloto/transfer-fees.ts</B></li>
          <li><B>components/copiloto/transfer-matcher.ts</B></li>
          <li><B>components/copiloto/trip-edit-sheet.tsx</B></li>
          <li><B>components/copiloto/types.ts</B></li>
          <li><B>components/copiloto/upcoming-bills-form.tsx</B></li>
          <li><B>components/copiloto/v1-dash/v1-dash-screen.tsx</B></li>
          <li><B>components/copiloto/v1-dash/v1-dash-zones.ts</B></li>
          <li><B>components/copiloto/week-tolls.ts</B></li>
          <li><B>components/copiloto/weekly-close.ts</B></li>
        </ul>
        <P><B>lib/ — 18 shared library files:</B></P>
        <ul className="mb-3 list-disc space-y-1 pl-4 text-[11px] text-neutral-300">
          <li><B>lib/backup.ts</B></li>
          <li><B>lib/bank-csv.ts</B></li>
          <li><B>lib/crm-push.ts</B></li>
          <li><B>lib/crm/crm-cloud.ts</B></li>
          <li><B>lib/crm/crm-photos.ts</B></li>
          <li><B>lib/crm/geocode.ts</B></li>
          <li><B>lib/crm/parse-message.ts</B></li>
          <li><B>lib/crm/supabase-browser.ts</B></li>
          <li><B>lib/crm/supabase-server.ts</B></li>
          <li><B>lib/data-sync.ts</B></li>
          <li><B>lib/dates.ts</B></li>
          <li><B>lib/decisions.ts</B></li>
          <li><B>lib/money.ts</B></li>
          <li><B>lib/plaid.ts</B></li>
          <li><B>lib/production.ts</B></li>
          <li><B>lib/sync.ts</B></li>
          <li><B>lib/utils.ts</B></li>
          <li><B>lib/version-check.ts</B></li>
        </ul>
        <P><B>scripts/ — 21 verification, assembly and database scripts:</B></P>
        <ul className="mb-3 list-disc space-y-1 pl-4 text-[11px] text-neutral-300">
          <li><B>scripts/_check-db.mjs</B></li>
          <li><B>scripts/_check-schema.mjs</B></li>
          <li><B>scripts/_create-sync-table.mjs</B></li>
          <li><B>scripts/_mock-redis.mjs</B></li>
          <li><B>scripts/_test-backup.mjs</B></li>
          <li><B>scripts/_test-bank-csv.mjs</B></li>
          <li><B>scripts/_test-cash-flow.mjs</B></li>
          <li><B>scripts/_test-classify.mjs</B></li>
          <li><B>scripts/_test-dates.mjs</B></li>
          <li><B>scripts/_test-decisions.mjs</B></li>
          <li><B>scripts/_test-expenses.mjs</B></li>
          <li><B>scripts/_test-finance.mjs</B></li>
          <li><B>scripts/_test-money.mjs</B></li>
          <li><B>scripts/_test-platforms.mjs</B></li>
          <li><B>scripts/_test-production.mjs</B></li>
          <li><B>scripts/_test-reconciliation.mjs</B></li>
          <li><B>scripts/_test-schedule.mjs</B></li>
          <li><B>scripts/_test-sync-e2e.mjs</B></li>
          <li><B>scripts/_test-sync.mjs</B></li>
          <li><B>scripts/assemble-registers.js</B></li>
          <li><B>scripts/create-plaid-items-table.sql</B></li>
        </ul>
        <P><B>supabase/migrations/ — 6 SQL migration files:</B></P>
        <ul className="mb-3 list-disc space-y-1 pl-4 text-[11px] text-neutral-300">
          <li><B>supabase/migrations/20261126024701_crm_auth_clients_reservations_rls.sql</B></li>
          <li><B>supabase/migrations/20261126120000_crm_account_photos_messages.sql</B></li>
          <li><B>supabase/migrations/20261126150000_finance_sync_doc.sql</B></li>
          <li><B>supabase/migrations/20261126170000_crm_message_follow_up.sql</B></li>
          <li><B>supabase/migrations/20261126180000_crm_message_send.sql</B></li>
          <li><B>supabase/migrations/20261126190000_crm_reservation_stop.sql</B></li>
        </ul>
        <P><B>Public asset inventory:</B> 60 files under public/. They are grouped into public/bank-logos/ (bank/card/payment-provider marks), public/logos/ (rideshare/transportation platform marks), PWA/app icons (icon.svg, light/dark 32px icons, apple-icon.png), service worker (sw.js), and reference images. Treat these as application assets; do not replace logos or branding without a specific request.</P>
      </Section>

      <Section title="23. CRM COPILOT V7 — TECHNICAL AUDIT & VERIFIED GAPS (2026-11-27)">
        <P><B>Audit scope and safety boundary:</B> review of CRM source code on main, CRM Supabase schema/RLS/storage, Vercel environment-variable names and deployment metadata, and available production runtime-error summaries. No existing customer records were opened or used for tests. No database rows were inserted, updated or deleted. No SMS, WhatsApp, email or push notification was sent. Any future functional test must use a dedicated synthetic account and synthetic records only.</P>
        <P><B>Repository and deployment checkpoint:</B> repository transittaxmc-create/claris, branch main. The inspected main tip is cdb73c1f8123082835bead681f1b80351b7d8b4d. The latest inspected Production deployment is READY at commit f06c1258df1714f3a44a98c1a8b5d8549d635e29. The production deployment is not the exact main tip; the main tip is a later documentation commit. Do not equate READY with every latest documentation commit being live.</P>
        <P><B>Database connection — verified configuration:</B> CRM environment variables NEXT_PUBLIC_CRM_SUPABASE_URL and NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY are configured for Production, Preview and Development and point to the dedicated CRM project mimgwleghecseoymgdug. That project is ACTIVE_HEALTHY in us-east-2. The browser and server clients both use the CRM publishable key and authenticated session; they do not use the legacy Finance Supabase or a CRM service-role key.</P>
        <P><B>Database structure — read-only inspection:</B> public.crm_clients, public.crm_reservations and public.crm_messages exist and have RLS enabled. Their current row counts are 7, 2 and 1 respectively; no row contents were inspected. Each table has owner-scoped SELECT, INSERT, UPDATE and DELETE policies. The private Storage bucket crm-client-photos exists with owner-folder SELECT/INSERT/UPDATE/DELETE policies. These checks verify schema and policy presence, not a live signed-in read/write round trip.</P>
        <P><B>Migration history drift — needs reconciliation:</B> the repository contains six migration files, while Supabase migration history reports only three registered versions. The live schema already contains later CRM fields and the messages table, so the missing history entries do not by themselves prove those changes are absent. Do not blindly re-run the remaining SQL. Compare each migration's intended DDL with the live schema, establish which SQL was applied manually, and reconcile the migration ledger without dropping or rewriting customer data.</P>
        <P><B>Client and reservation synchronization:</B> the UI persists local copies in localStorage and, when a CRM session exists, reads/writes through /api/crm/state. The API derives user_id from the authenticated server session and filters reads/deletes by that owner. The client merge logic tracks previously synced IDs to avoid resurrecting records deleted on another device. This is code-inspected only; multi-device conflict behavior and real authenticated round trips remain untested.</P>
        <P><B>Account-number integrity — partially protected:</B> ACT-0-### numbers are calculated in the browser from the current local client list via nextAccountNumber(clients), so two devices can still calculate the same next candidate concurrently. A live database check found zero duplicate non-empty account numbers and confirmed the unique partial index crm_clients_user_account_idx on (user_id, account_number) where account_number is not empty. The database therefore rejects a duplicate rather than storing it, but the current sync route turns the failed upsert into a generic 502 and does not reserve the number atomically. Improve this by allocating the next number server-side in one transaction and showing a clear retry message. Do not add a duplicate index.</P>
        <P><B>Incoming customer messages — NOT AUTOMATIC:</B> the current inbox offers “Log message” and a form where the operator manually enters/pastes the client's name, phone, channel and message body. The repository has no Twilio inbound webhook route and no automatic SMS/WhatsApp ingestion connector. A message row in crm_messages does not prove provider connectivity.</P>
        <P><B>Outbound SMS — NOT CONNECTED:</B> the UI now calls the action Approve &amp; Queue — NOT SENT. /api/crm/send authenticates the CRM owner, validates the destination/text and confirms the message exists in the CRM cloud; it returns queued=true but does not contact a carrier. Earlier manual text described an Amani phone bridge, but no such bridge or callback exists in this repository. /api/crm/send/dispatch is now deliberately disabled and returns 501 until a real authenticated sender exists. No sent or delivered state is evidence of carrier transmission.</P>
        <P><B>Twilio and WhatsApp:</B> no TWILIO_* environment variables and no Twilio messaging/webhook implementation were found in the inspected project. SMS inbound, outbound, status callbacks, consent/STOP handling and provider delivery tracking remain pending. WhatsApp Business API remains a separate future integration; do not migrate or disconnect the existing WhatsApp Business App number without express authorization.</P>
        <P><B>Push notifications — configuration present, persistence blocked:</B> the CRM has VAPID configuration entries and routes for config, subscribe, test and send. However, lib/crm-push.ts stores encrypted subscriptions in Vercel Blob at crm-private/push-subscriptions.enc. Production runtime errors report that the Vercel Blob store is suspended. Therefore subscription persistence and automatic pushes to registered devices cannot be certified and are expected to fail until the Blob store is restored or the subscription store is migrated. The test endpoint now requires a subscription already registered to the authenticated owner; a request-supplied endpoint alone is not sufficient. Physical iPhone delivery and background triggers remain unverified.</P>
        <P><B>Flight tracking limitation:</B> /api/crm/flights/track queries adsb.lol by ICAO callsign and returns aircraft-position states such as in_air, on_ground, stale or not_found. It is not a scheduled-airline-status integration and does not establish on-time, delayed, landed or cancelled status. The UI/manual must describe this as aircraft-position lookup unless a flight-status provider is integrated.</P>
        <P><B>Address verification:</B> lib/crm/geocode.ts uses the public Nominatim/OpenStreetMap search endpoint. The result is advisory and does not block saving; network failure returns no verification result. Rate limits, provider terms, address match accuracy and an appropriate identifying User-Agent should be reviewed before high-volume use.</P>
        <P><B>Photo storage:</B> images are downscaled in the browser, cached in localStorage and uploaded to the private crm-client-photos bucket when a CRM session exists. Upload errors are swallowed and leave path empty, so a photo may remain device-only. The UI labels this state, but the operator needs a persistent retry/error indicator and a verified cloud-upload state before assuming another device can see the photo.</P>
        <P><B>Security and reliability review (post-merge update, 2026-11-27):</B> Supabase security advisor reports leaked-password protection disabled. Performance advisor reports two unindexed foreign keys on crm_messages, four RLS initplan warnings on finance_sync_doc (not the CRM message/client/reservation tables), and duplicate indexes on crm_clients. Review and fix with measured, non-destructive migrations. PR #82 is now <B>merged into main</B> at commit <B>60d706e696eec816985efa4327d0aee1074ca590</B>. It adds trusted push-provider host validation, strict subscription key checks, redirect blocking, authenticated owner-scoped registration/removal and owner-only test-push lookup. Four synthetic endpoint tests and the Next.js production build passed in GitHub Actions on the exact merge candidate. Vercel's GitHub integration received the merge but rejected all three deployment status contexts with <B>Deployment rate limited — retry in 24 hours</B> (2026-11-27 11:26:58 UTC). No deployment containing this commit is READY yet. Rate limiting, Blob store recovery/migration and physical iPhone delivery remain pending.</P>
        <P><B>Runtime evidence:</B> the Vercel runtime-error query for the CRM API routes over the selected seven-day window returned no grouped runtime errors. This is useful but does not prove functionality. The same Vercel project has unrelated production errors in legacy bank endpoints and a suspended Blob store; the bank/Supabase DNS failures belong to the legacy Finance integration and must not be confused with the dedicated CRM Supabase connection. Hobby runtime-log retention is limited, so longer raw-log inspection is unavailable.</P>
        <P><B>Automated test coverage:</B> the push-hardening branch adds <B>test:crm-push</B> using Node built-in tests and four synthetic endpoint-validation cases; the local isolated run passed <B>4/4</B>, and the GitHub Actions run passed on Node.js 24. This is a unit test only, not a CRM end-to-end suite. A full test still requires a separate synthetic CRM Auth user, fake client/reservation/message records, a preview deployment and explicit test-only provider endpoints. Do not run create/update/delete tests against the owner's real records.</P>
        <P><B>Design and accessibility — source inspection only:</B> the CRM uses a dark neutral surface with a yellow accent, responsive grid classes and large 16px input text in several forms. The inspected screen also contains 27 text-[10px] and 22 text-[11px] usages, many dense uppercase status labels, and 45 button elements with 9 explicit aria-label attributes. These counts identify areas for review, not a complete accessibility score. A screenshot-based visual audit could not be completed in this run because no usable browser capture session was available and the public site could not be opened by the web capture source. Do not claim the visual design has passed; capture the real iPhone screens before final design decisions.</P>
        <P><B>Priority order before production sign-off:</B></P>
        <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Restore the Vercel Blob store or migrate push subscription persistence to a supported, owner-secure store; then test only on the owner's device with a clearly labeled local test notification.</li>
          <li>Choose and implement the real SMS provider path. The recorded project direction is Twilio SMS first, with signed inbound webhooks, outbound send API, status callbacks, idempotency, consent/STOP and a durable message history. Keep the current phone-based path clearly labeled until replaced or actually connected.</li>
          <li>Reconcile the six repository migrations against the three registered database migrations without replaying already-applied DDL.</li>
          <li>Make ACT account-number allocation atomic and unique per owner.</li>
          <li>After Vercel's 24-hour deployment cooldown, verify a production deployment for merge commit 60d706e696eec816985efa4327d0aee1074ca590; do not treat GitHub merge or Actions build as a live deployment. Add push rate limits, restore/migrate the Blob subscription store, and review leaked-password protection and index warnings.</li>
          <li>Clarify flight lookup labels or integrate a true flight-status provider after checking coverage, cost and terms.</li>
          <li>Run isolated synthetic-account tests for sign-in, CRUD, cross-device sync, photo upload, message intake, approved send, callbacks, push persistence and reservation/flight flows.</li>
          <li>Capture and inspect screenshots of the real iPhone CRM screens, then adjust hierarchy, font sizes, touch targets, status clarity and empty/error states.</li>
        </ol>
        <P><B>Audit status (post-merge, 2026-11-27):</B> partial technical audit completed. Database connection/configuration and owner-scoped schema policies are verified by inspection. Push endpoint hardening is merged into main at <B>60d706e696eec816985efa4327d0aee1074ca590</B>; four synthetic validation tests and the Next.js production build pass in GitHub Actions. Vercel automatically received the GitHub merge but returned a deployment-rate-limit failure with a 24-hour retry window. Therefore the merge is <B>not yet deployed to Production</B>; verify the new Vercel deployment after the cooldown and confirm READY on this exact commit. Persistent remote push storage and physical device delivery remain unverified because the Blob store is suspended. Automatic inbound messaging, real outbound SMS, cross-device behavior, CRM end-to-end synthetic tests and screenshot-based design review are NOT verified. The SMS interface now honestly labels approved drafts as NOT SENT, and the unimplemented dispatch callback returns 501. No real customer data was changed and no customer communication was sent.</P>
      </Section>

      <Section title="24. COPILOTO V7 — PHASE 1 BUILD FOUNDATION & ARCHITECTURE (2026-11-27)">
        <P><B>Execution status:</B> Phase 1 has been authorized. Work is beginning in the isolated Git branch <B>feat/copiloto-v7-phase1-foundation</B>. This entry records the verified starting point; it does NOT claim that the new UI, communications center, Transport/Taxes workspaces or Work Opportunities module have been implemented.</P>
        <P><B>Verified current application structure:</B> the Next.js root route renders <B>CopilotoApp</B>. The current app is a single mobile-first shell with a bottom navigation bar. Its default tab is <B>ENTRY</B>; the visible primary tabs are TODAY, EARNINGS, MONEY and REPORTS. CRM and TAX 2026 are currently under MORE. There is no verified Work Opportunities screen or unified Communications Center in the inspected navigation.</P>
        <P><B>Existing systems to preserve:</B> trip and expense capture, finance/projection flows, CRM screen, Tax 2026 screen, backup/data controls, toll detection and current manual. Do not replace these systems wholesale or change the legacy finance Supabase project. New V7 navigation should be introduced incrementally and keep existing workflows reachable until each migration is tested.</P>
        <P><B>Target architecture:</B> Copiloto is the permanent platform name. Its workspaces are <B>Transport</B>, <B>Taxes</B> and <B>Work Opportunities</B>. A shared <B>Communications Center</B> will route inbound items to the correct workspace while preserving the original message, source, timestamps, attachments, AI classification and approval/audit events. Shared services include identity, private document storage, notifications, audit trail and role/permission enforcement. Personal finance management is outside the first-phase priority.</P>
        <P><B>Brand hierarchy:</B> Copiloto remains the platform brand. Island City Transit is the Transport business identity; Brakha Group Tax Services is the Taxes identity. Transitax remains a corporate naming decision to be finalized later. Do not rename WhatsApp accounts, change phone numbers or migrate WhatsApp Personal to Business during this phase.</P>
        <P><B>Safety boundary:</B> development and tests use synthetic data only. No real customer communications, payment processing, provider activation, database migrations or production deployment are authorized by this phase-start entry. Existing migration drift must be reconciled before any DDL. Human approval remains mandatory for every outbound message and every job acceptance.</P>
        <P><B>Design direction:</B> professional, calm, premium and practical; clear information hierarchy, accessible contrast, generous touch targets, responsive desktop navigation and compact mobile navigation. The final brand system is intentionally deferred until the product architecture and core workflows are stable. No screenshot-based design QA has been completed yet.</P>
        <P><B>Initial verified audit findings:</B> package scripts include Next.js production build and a focused CRM push validation test. The current main branch's production deployment was observed as <B>READY</B> on commit <B>f06c1258df1714f3a44a98c1a8b5d8549d635e29</B> at the time of this audit. That deployment does not contain work from this new feature branch. No build or preview deployment has been run for this phase yet.</P>
        <P><B>Next implementation sequence:</B> (1) map the existing shell and screen dependencies; (2) settle the new responsive application shell and navigation; (3) implement the shared workspace landing/dashboard with clearly labeled synthetic content; (4) add the Work Opportunities workflow shell and Communications Center intake model without connecting real providers; (5) connect existing CRM/Taxes screens through safe workspace entry points; (6) add automated tests and document exact coverage; (7) verify a preview build and visual behavior before requesting production approval.</P>
        <P><B>Agent handoff rule:</B> before changing code, read this section and the matching file in <B>docs/</B>. After each implementation step, update both records with commit SHA, changed paths, tests actually run, build/deployment state, unresolved risks and exact next task. Never convert a planned or mocked feature into a statement that it is live.</P>
      </Section>


      <Section title="25. COPILOTO V7 — FIRST RESPONSIVE PREVIEW WORKSPACE (2026-11-27)">
        <P><B>Implementation:</B> a separate preview route has been added at <B>/copiloto-v7-preview</B> on branch <B>feat/copiloto-v7-phase1-foundation</B>. It does not replace the current root application route and does not alter existing production screens.</P>
        <P><B>First working UI:</B> responsive desktop sidebar and mobile bottom navigation; Copiloto overview dashboard; Transport, Taxes, Work Opportunities, Communications, Clients and Documents workspace entry points; sample activity feed; sample opportunity review queue; create-new workspace chooser; searchable navigation; and local interactive follow-up marking.</P>
        <P><B>Data and safety:</B> all dashboard figures, activity items and opportunity examples are synthetic placeholders. The preview is not connected to customer records, CRM Supabase, WhatsApp, SMS, Square, payment processing or any production provider. The opportunity action only marks a sample item for follow-up in local component state; it does not send a response or accept a job.</P>
        <P><B>Visual direction:</B> initial professional workspace shell with deep navy navigation, light neutral work surface and restrained amber accent. This is a first implementation baseline for review, not the final approved brand system.</P>
        <P><B>Files changed:</B> <B>app/copiloto-v7-preview/page.tsx</B> (new) and this manual. The preview page was committed in the feature branch; the first JSX correction was committed separately. Verify the final branch commit before reporting build results.</P>
        <P><B>Not yet implemented:</B> live data persistence, authentication/authorization for this route, real Transport or Tax workflows, real client/document records, inbound communication connectors, OCR, notifications, opportunity parsing/scoring, audit event persistence, or provider integrations. Do not expose this preview to customers or enter real personal/tax data.</P>
        <P><B>Verification state:</B> source code has been written to the feature branch. TypeScript/Next.js build, Vercel Preview deployment, browser rendering, responsive-device QA and automated interaction tests are still pending until independently verified. No production deployment or database change was made.</P>
        <P><B>Next step:</B> run a Preview deployment from this exact branch, inspect build logs and route availability, then perform visual and interaction QA. Retry only after Vercel's 24-hour limit window and record the deployment URL and exact READY/BUILDING/FAILED state only after Vercel confirms it.</P>
      </Section>


      <Section title="26. COPILOTO V7 — INTERACTIVE WORKSPACE MODULES & BUILD CHECK (2026-11-27)">
        <P><B>Implemented in preview source:</B> Transport now has a sample trip ledger and local add-trip interaction; Taxes has an illustrative intake/documents/preparation workflow summary; Communications has a searchable sample inbox and local read/unread state; Clients has a local sample directory and add-sample-client interaction; Documents has a metadata-only sample register and local mark-reviewed action. Work Opportunities already has a sample queue and local follow-up marker. All these changes remain isolated to the preview route.</P>
        <P><B>Data boundary:</B> all interactions are in browser component state and are not persisted. No Supabase/CRM connection, real customer/tax data, document upload, messaging provider, SMS/WhatsApp dispatch, payment provider or production record is accessed. No message can be sent and no trip/job is accepted.</P>
        <P><B>CI attempt:</B> added <B>.github/workflows/copiloto-v7-preview-build.yml</B> to install the locked pnpm dependencies, run the existing synthetic CRM push validation test and run the Next.js production build on pushes to this branch. GitHub's commit workflow-runs lookup returned no workflow runs for the workflow commit; therefore CI has not been observed running and no test/build pass is claimed.</P>
        <P><B>Preview state:</B> Vercel Preview creation remains blocked by the team's HTTP 402 free daily deployment API quota response (retry after 24 hours). No V7 Preview URL or deployment ID exists yet. Existing production deployment is unchanged.</P>
        <P><B>Files added/changed in this step:</B> <B>app/copiloto-v7-preview/page.tsx</B>; <B>.github/workflows/copiloto-v7-preview-build.yml</B>; this manual and the V7 preview workspace document. Feature branch only.</P>
        <P><B>Next:</B> verify the CI workflow actually starts and capture its real job result; resolve compile/test errors if any; then retry Vercel Preview after quota reset and complete browser/mobile QA. Only after this shell is validated should persistent, authenticated backend workflows be implemented.</P>
      </Section>


      <Section title="27. COPILOTO V7 — PHASE 1 READ-ONLY TECHNICAL AUDIT (2026-11-27)">
        <P><B>Authorization:</B> the user explicitly authorized progression through the ten readiness workstreams, with the release boundary remaining “ready for Vercel publication”; production publication is not authorized by this instruction.</P>
        <P><B>Supabase project checked:</B> CRM project <B>mimgwleghecseoymgdug</B>, region us-east-2, status ACTIVE_HEALTHY, PostgreSQL 17.12. The separate legacy finance project remains out of scope.</P>
        <P><B>Database inventory:</B> public schema currently exposes crm_clients (7 rows), crm_reservations (2 rows), crm_messages (1 row), and finance_sync_doc (1 row); RLS is enabled on all four tables. Existing CRM tables are not yet a complete schema for the planned Transport/Taxes/Communications/Work Opportunities/Square architecture.</P>
        <P><B>Migration history:</B> Supabase currently reports three applied migrations: 20261126024701 crm_auth_clients_reservations_rls; 20261126033314 crm_reservations_owner_fk_index; 20261126035245 crm_database_hardening_airport_validation. Prior repository-vs-database migration drift remains a blocking reconciliation item. No DDL or migration was applied during this audit.</P>
        <P><B>Security advisor:</B> one warning — leaked-password protection is disabled. Performance advisor reports two unindexed foreign keys on crm_messages, four RLS initplan warnings on finance_sync_doc, two unused indexes, and one duplicate index pair on crm_clients. Health advisor returned no findings. These are findings to assess and remediate through reviewed migrations, not permission to make unreviewed production changes.</P>
        <P><B>Safety boundary:</B> audit was read-only. No production records were modified, no real messages or payments were sent, no external connector was activated, and no deployment was made.</P>
        <P><B>Next work:</B> complete source/migration reconciliation, inspect current auth and RLS policies plus private storage configuration, map all existing routes/screens before redesign, define module ownership and cross-module links, and produce a reviewed target schema/permission matrix before any database writes.</P>
      </Section>


      <Section title="28. COPILOTO V7 — PUNTO 2: ARQUITECTURA FUNCIONAL Y TÉCNICA (2026-11-27)">
        <P><B>Entrega:</B> se creó docs/copiloto-v7-punto-2-arquitectura-2026-11-27.md en la rama feat/copiloto-v7-phase1-foundation. Define Copiloto como consola principal y a Supabase/Square/Twilio/Meta como servicios conectados mediante adaptadores; no promete operaciones fuera de las APIs o permisos disponibles.</P>
        <P><B>Propiedad de módulos:</B> Overview agrega; Transport posee reservas/viajes; Taxes posee expedientes fiscales; Work Opportunities posee ofertas, extracción, evaluación y decisión; Communications conserva originales, análisis, borradores, aprobaciones y eventos; Clients mantiene relaciones por unidad; Documents controla el vault privado; Square expone solo capacidades permitidas; Notifications conserva alertas; Identity/Audit controla usuarios, permisos, sesiones y trazabilidad.</P>
        <P><B>Separación:</B> cada registro operativo debe tener unidad transport, taxes o work_opportunities. Compartir ficha de contacto no comparte expedientes, viajes ni documentos. RLS y permisos de servidor deben reforzar el aislamiento.</P>
        <P><B>Flujo:</B> UI → endpoint autenticado → autorización/RLS y servicio de dominio → transacción/outbox idempotente → adaptador externo → webhook firmado → estado y auditoría. El mensaje original nunca se sustituye por el análisis IA. Todo envío y aceptación requieren aprobación humana.</P>
        <P><B>Square:</B> comenzar en Sandbox; exponer customers/invoices/payments/refunds solo si endpoint y scopes están disponibles. La UI debe distinguir acción integrada, enlace a Square y función no soportada. No almacenar PAN/CVV.</P>
        <P><B>Documentos y notificaciones:</B> móvil como captura/consulta, vault central privado como maestro; URLs firmadas breves, versiones, auditoría y restore probado. Alertas persistentes son canónicas; push es solo un canal y requiere prueba en iPhone físico.</P>
        <P><B>Compatibilidad:</B> conservar CopilotoApp y las funciones actuales hasta QA. La sincronización financiera heredada permanece apagada. WhatsApp Personal/grupos no se consideran ingestión automática; solo vías oficiales permitidas.</P>
        <P><B>Estado:</B> blueprint de arquitectura entregado; no se crearon tablas, no se aplicaron migraciones, no se conectaron proveedores, no se cambió la ruta raíz y no hubo deployment. Los nombres de entidades son modelo lógico propuesto, no tablas ya existentes. El siguiente bloqueo técnico es reconciliar migraciones y completar el diseño de permisos antes de cualquier DDL.</P>
      </Section>


      <Section title="29. COPILOTO V7 — PUNTO 3: AUDITORÍA DE BASE DE DATOS Y SEGURIDAD (2026-11-27)">
        <P><B>Resultado:</B> auditoría de solo lectura completada; implementación de seguridad pendiente. Proyecto CRM <B>mimgwleghecseoymgdug</B>, ACTIVE_HEALTHY, PostgreSQL 17.12. No confundir con el proyecto financiero legado.</P>
        <P><B>Datos verificados:</B> cuatro tablas públicas — crm_clients (7), crm_reservations (2), crm_messages (1), finance_sync_doc (1). RLS está habilitado en las cuatro. Políticas CRM limitan operaciones al propietario auth.uid() = user_id; finance_sync_doc usa owner_id = auth.uid().</P>
        <P><B>Storage:</B> crm-client-photos existe como bucket privado, con cuatro políticas que limitan el acceso a la carpeta cuyo primer segmento es el UUID del usuario. No hay límite de tamaño ni MIME allowlist configurados. Este bucket de fotos no equivale todavía al vault general de documentos fiscales y de transporte.</P>
        <P><B>Auth:</B> se contaron dos usuarios y cero factores MFA verificados o pendientes. La configuración de proveedores y enforcement no es visible mediante las herramientas disponibles; no afirmar que MFA esté exigido. Security Advisor reporta leaked-password protection desactivada.</P>
        <P><B>Otros avisos:</B> Performance Advisor reporta dos foreign keys sin índice de cobertura en crm_messages y cuatro avisos RLS initplan en finance_sync_doc. Health Advisor sin hallazgos. proxy.ts refresca claims/cookies si existen variables CRM, pero no bloquea por sí solo rutas privadas; cada endpoint debe validar sesión y autorización.</P>
        <P><B>Bloqueo de migraciones:</B> la rama tiene seis archivos SQL; Supabase registra tres migraciones aplicadas. Solo coincide 20261126024701. Las versiones aplicadas 20261126033314 y 20261126035245 no están en el directorio de esta rama; los otros cinco archivos de la rama no aparecen aplicados. No ejecutar DDL hasta reconciliar el historial y el SQL real.</P>
        <P><B>Separación de negocio:</B> el esquema actual demuestra separación por propietario, pero todavía no aislamiento explícito por unidad transport / taxes / work_opportunities ni roles/membresías. Debe diseñarse y probarse antes de datos reales.</P>
        <P><B>Acciones pendientes:</B> reconciliar migraciones; revisar Auth/MFA/sesiones; activar protección de contraseñas filtradas; diseñar autorización por unidad; crear vault privado de documentos con límites MIME/tamaño, versiones y URLs firmadas; verificar secretos solo en servidor; definir backups/restore y revocación de dispositivos; probar accesos negativos entre usuarios y unidades.</P>
        <P><B>Seguridad y deployment:</B> auditoría read-only; no se aplicó DDL, no se cambiaron usuarios/configuración, no se enviaron mensajes ni pagos y no hubo deployment. No usar datos reales hasta cerrar brechas y completar pruebas.</P>
      </Section>


      <Section title="COPILOTO V7 — RECONCILIACIÓN DE MIGRACIONES Y PREPARACIÓN DE PROTECCIONES (2026-11-27)">
        <P><B>Auditoría read-only:</B> Supabase registra tres versiones (20261126024701, 20261126033314, 20261126035245). La rama contiene seis SQL: 20261126024701, 20261126120000, 20261126150000, 20261126170000, 20261126180000 y 20261126190000. Solo coincide el primer archivo con el ledger.</P>
        <P><B>Efectos confirmados en el esquema activo:</B> las cinco migraciones sin entrada en el ledger tienen columnas/tablas/bucket correspondientes presentes: account_number/photos/crm_messages/crm-client-photos, finance_sync_doc, needs_follow_up, send_state/send_error/send_via/dispatched_at y stop_address. También existen crm_reservations_client_owner_idx y crm_reservations_airport_flight_required, coherentes con el propósito de las dos versiones registradas cuyos archivos faltan en la rama. Esto prueba presencia de efectos, no el SQL/procedimiento original.</P>
        <P><B>Decisión:</B> no repetir scripts, no insertar manualmente ledger entries y no ejecutar DDL. Recuperar SQL exacto de 20261126033314 y 20261126035245 desde Git/copia verificable; reconstruir la procedencia de los otros cinco cambios y comparar definiciones antes de cualquier nueva migración.</P>
        <P><B>Storage:</B> crm-client-photos es privado y sus cuatro políticas limitan SELECT/INSERT/UPDATE/DELETE a la carpeta del usuario autenticado. El bucket no tiene límites de tamaño ni allowlist MIME. No reutilizarlo como vault fiscal.</P>
        <P><B>Protecciones preparadas:</B> Transport y Taxes tendrán aislamiento por unidad además del propietario; Documents tendrá bóveda privada separada por unidad/cliente/expediente, URLs firmadas breves, validación MIME/tamaño, versiones, retención, auditoría y recuperación. Autorización por membresías controladas por servidor; no usar user_metadata editable.</P>
        <P><B>Pruebas obligatorias:</B> usuarios sintéticos A/B, aislamiento Transport/Taxes, permisos Documents, operaciones Storage, endpoints sin sesión/expirada, MFA, recuperación/revocación, backups/restore y Advisors.</P>
        <P><B>Estado:</B> revisión de esquema/ledger/RLS/Storage completada en modo read-only; historial divergente confirmado; diseño de protecciones preparado, no implementado ni probado. No se alteró base de datos, Auth, Storage ni producción. Punto 3 sigue abierto.</P>
        <P><B>Informe:</B> docs/copiloto-v7-reconciliacion-migraciones-y-protecciones-2026-11-27.md</P>
      </Section>


      <Section title="COPILOTO V7 — PUNTO 4: CENTRO DE COMUNICACIONES (2026-11-27)">
        <P><B>Preview implementado:</B> app/copiloto-v7-preview/page.tsx ahora presenta un inbox unificado de muestra para Transport, Taxes y Work Opportunities, con indicadores, búsqueda/clasificación, selección de mensaje, revisión y borrador local.</P>
        <P><B>Aprobación segura:</B> la acción de demostración solo cambia el registro de muestra a “Approved · NOT SENT”. No envía, no crea una cola real y no acepta automáticamente oportunidades. La pantalla identifica SAMPLE DATA / NO LIVE CONNECTIONS.</P>
        <P><B>Conectividad real pendiente:</B> no hay conectores verificados de WhatsApp Business, WhatsApp Personal/grupos, SMS, email, Twilio ni ZapClaw. /api/crm/send solo valida/encola la intención; /api/crm/send/dispatch sigue deshabilitada y responde 501 phone_dispatch_not_connected. No afirmar envío ni entrega.</P>
        <P><B>Backend pendiente:</B> ampliar el modelo canónico para mensajes originales, eventos, adjuntos, consentimiento/opt-out, webhooks autenticados, idempotencia, outbox, auditoría y estados del proveedor. Preservar el mensaje original separado del análisis IA. Reconciliar migraciones antes de tocar esquema.</P>
        <P><B>Verificación:</B> cambios guardados en rama feat/copiloto-v7-phase1-foundation. No hubo deployment, cambios de Supabase ni comunicaciones reales. No se ejecutó build/test ni QA visual; ambos siguen pendientes.</P>
        <P><B>Estado:</B> interfaz de demostración implementada y documentada; Centro de Comunicaciones conectado y operativo todavía pendiente. Informe: docs/copiloto-v7-punto-4-centro-comunicaciones-2026-11-27.md</P>
      </Section>

      <Section title="COPILOTO V7 — PUNTO 5: TRANSPORT OPERATIONS (2026-11-27)">
        <P><B>Preview implementado:</B> se creó components/copiloto-v7-preview/transport-workspace.tsx y se integró en app/copiloto-v7-preview/page.tsx. Incluye tablero de viajes, búsqueda/filtro por estado, alta local de solicitudes sintéticas, vehículo, ruta, pickup, fecha/hora, tarifa, peajes, otros gastos, neto estimado y cambio de estado.</P>
        <P><B>Flujo operativo propuesto:</B> recibir solicitud → validar disponibilidad/vehículo → aprobación humana → seguimiento del viaje → cierre y conciliación. No se confirma ni despacha automáticamente.</P>
        <P><B>Conectividad pendiente:</B> el módulo sigue siendo local y de demostración. No está conectado a CRM/reservations, conductores/vehículos, mapas, GPS, proveedor de peajes, Square, pagos ni comunicaciones. Las cifras no representan operaciones reales.</P>
        <P><B>Seguridad:</B> no introducir nombres reales, teléfonos, direcciones de clientes ni datos de pago. No se ejecutaron migraciones ni se modificó Supabase.</P>
        <P><B>Verificación:</B> commits ceadffa502215c8a65b6cfa1150c412d42b0d81c y 557759ef7aa4ae863f4820a6a669db23d2ce15f6 en feat/copiloto-v7-phase1-foundation. Build, tests y QA visual todavía pendientes. No hay deployment validado de esta rama.</P>
        <P><B>Estado:</B> interfaz de demostración de Transport implementada y documentada; integraciones y pruebas reales pendientes. No habilitar con clientes.</P>
      </Section>

      <Section title="COPILOTO V7 — PUNTO 6: TAX PREPARATION (2026-11-27)">
        <P><B>Preview implementado:</B> se creó components/copiloto-v7-preview/tax-workspace.tsx y se integró en app/copiloto-v7-preview/page.tsx. Incluye cola de expedientes sintéticos, año fiscal, tipo de declaración, búsqueda/filtro, estados de intake/preparación/revisión/autorización/finalización y checklist local de documentos.</P>
        <P><B>Controles de proceso:</B> la secuencia propuesta es intake/engagement → identidad y documentos → preparación → revisión del preparador → autorización del cliente → filing y seguimiento. El estado “Filed” solo puede seleccionarse como demostración y no transmite declaraciones.</P>
        <P><B>Privacidad:</B> no ingresar SSN, ITIN, fechas de nacimiento, datos bancarios, W-2/1099 ni documentos reales. No hay bóveda documental, OCR, persistencia CRM ni integración con software tributario.</P>
        <P><B>Seguridad y operaciones pendientes:</B> separar Transport/Taxes por autorización server-side y RLS, MFA, bóveda privada, cifrado, auditoría, retención, backups/restauración, pruebas negativas entre usuarios y unidades, aprobación explícita antes de e-file y comunicaciones.</P>
        <P><B>Verificación:</B> componente e integración en feat/copiloto-v7-phase1-foundation; commit de componente df74bdd7a2865c2b6a8f72c2f86f0a8ef8334b58 y de integración 816713f30ce1e74c4dd71edf385d00f06cab0628. Build, typecheck, tests y QA visual pendientes. No hubo cambios de Supabase ni deployment V7.</P>
        <P><B>Estado:</B> interfaz de demostración de Taxes implementada y documentada; backend seguro, documentos, cálculos reales, integraciones y pruebas pendientes. No habilitar con clientes.</P>
      </Section>

      <Section title="COPILOTO V7 — PUNTO 7: WORK OPPORTUNITIES (2026-11-27)">
        <P><B>Preview implementado:</B> se creó components/copiloto-v7-preview/work-opportunities-workspace.tsx y se integró en app/copiloto-v7-preview/page.tsx. Incluye bandeja sintética, filtros, clasificación verde/interesado, amarilla/revisar y roja/no interesado, detalle de ruta/horario/vehículo, tarifa, deadhead, millas, peajes, combustible, duración y estimación limitada de neto.</P>
        <P><B>Control humano:</B> se puede preparar un borrador YES para revisión; no se envía. No hay aceptación automática, confirmación ni dispatch.</P>
        <P><B>Datos faltantes:</B> tarifa, pickup, hora, vehículo, pasajeros/equipaje o distancia desconocidos se muestran como faltantes; no se inventan ni se confirma rentabilidad con una resta parcial de costos.</P>
        <P><B>WhatsApp:</B> no hay lectura de grupos personales, scraping ni integración no oficial. Deben evaluarse métodos de recepción autorizados y compatibles, como compartir/reenviar o captura manual aprobada. ZapClaw/WhatsApp no se consideran conectados ni verificados aquí.</P>
        <P><B>Verificación:</B> componente 59ed9042df7bd4110f45aed8546551ddddd8c5a4 e integración ae3724b789f77ee2c15bcc81785eb258f380e23d en feat/copiloto-v7-phase1-foundation. Build, typecheck, tests y QA visual pendientes. Sin cambios de Supabase ni deployment V7.</P>
        <P><B>Estado:</B> interfaz de revisión implementada y documentada; ingesta, persistencia, integraciones, análisis completo de costos y pruebas pendientes. No habilitar con operaciones reales.</P>
      </Section>

      <Section title="COPILOTO V7 — PUNTO 8: SQUARE OPERATIONS (2026-11-27)">
        <P><B>Preview implementado:</B> se creó components/copiloto-v7-preview/square-workspace.tsx y se añadió Square a la navegación. La vista de diseño incluye Overview, Customers, Invoices, Payments y Documents con ejemplos sintéticos y matriz de preparación.</P>
        <P><B>Estado real:</B> Square no está conectado ni autorizado en este proyecto; no hay Sandbox, OAuth, API, webhooks, lectura/escritura de clientes o facturas, ni operaciones de pago/reembolso ejecutadas. Las cifras y registros son ejemplos locales, no datos de Square.</P>
        <P><B>Diseño de integración:</B> Square permanece como sistema conectado; Copiloto será el centro de operaciones para las acciones compatibles. Cada acción se clasificará como API soportada, handoff al dashboard de Square o no soportada. Credenciales solo server-side, permisos mínimos, webhooks firmados, idempotencia y auditoría.</P>
        <P><B>Control financiero:</B> Sandbox primero. Capturas, cobros, reembolsos y cambios financieros requerirán aprobación humana explícita. Documentos se organizarán mediante la bóveda privada de Copiloto, no en carpetas públicas.</P>
        <P><B>Verificación:</B> componente e216e2783f7decc70622971b404ce931bb981a6a e integración 7c50dea918814ca9ff39488c4b5326a9ee80d46c en feat/copiloto-v7-phase1-foundation. Sin credenciales, conexión ni pruebas Sandbox. Build, typecheck y QA visual pendientes. No hubo cambios de Supabase.</P>
        <P><B>Estado:</B> diseño de demostración implementado; integración real, scopes, webhooks y pruebas transaccionales pendientes. No usar para pagos reales. Informe: docs/copiloto-v7-punto-8-square-2026-11-27.md</P>
      </Section>

      <Section title="COPILOTO V7 — PUNTOS 9 Y 10: VERIFICATION & RELEASE READINESS (2026-11-27)">
        <P><B>Pipeline añadido:</B> .github/workflows/copiloto-v7-preview-build.yml fue consolidado para ejecutar instalación con lockfile, TypeScript, test:crm-push y build de Next.js. Se eliminó el workflow duplicado para no duplicar builds. El pipeline no publica, no usa secretos y no toca bases de datos. Commits c1bc31c9251fafdfdd1fa26d385c38d0662e751d y 44a8f538c300beb0d8434da83af34a14d526a78a.</P>
        <P><B>Resultado de ejecución:</B> todavía no hay ejecución GitHub Actions confirmada para los últimos commits; el último combined status no devolvió checks. Los checks de Vercel consultados estaban en failure por build-rate-limit del equipo; no son resultados de compilación ni pruebas V7. El deployment SUCCESS de Railway visto en esta sesión es de main, no de la rama de Copiloto V7.</P>
        <P><B>Preview:</B> Railway temporal creado, pero la integración GitHub no ha confirmado acceso a la rama feature. No hay URL V7 pública validada. No usar el deployment de main como preview del V7.</P>
        <P><B>Release bloqueado:</B> Vercel tiene límite diario de deployment; seguridad/base de datos sigue pendiente; build/typecheck/tests/QA visual no confirmados; integraciones Square, mensajería y documentos no conectadas. No merge a main ni producción sin aprobación explícita.</P>
        <P><B>Transferencia:</B> terminar y probar la rama → revisar diff/PR → aprobación explícita de merge → esperar cuota de Vercel → Preview verificado → migraciones reconciliadas en entorno no productivo → aprobación separada para producción. Datos, mensajes y pagos reales siguen prohibidos durante desarrollo.</P>
        <P><B>Estado:</B> puntos 9 y 10 documentados como pipeline y checklist, pero ambos permanecen abiertos hasta ejecutar y verificar las pruebas y cumplir los bloqueos. Informes: docs/copiloto-v7-punto-9-verificacion-integral-2026-11-27.md y docs/copiloto-v7-punto-10-release-readiness-2026-11-27.md</P>
      </Section>


      <Section title="COPILOTO V7 — §32: TEMPORARY RAILWAY PREVIEW & AGENT HANDOFF (2026-11-27)">
        <P><B>User instruction:</B> Miguel requests durable, explicit continuity documentation so another agent can resume without asking him to repeat the project history. Continue as far as possible in the current session; preserve exact status, blockers, commands, links, branch and next actions. Do not claim background work continues after a session ends.</P>
        <P><B>Purpose and release boundary:</B> Railway is intended only as a temporary review environment for the V7 feature branch. The original Claris Vercel project remains the eventual destination. Do not create another permanent production app, bypass Vercel quotas with another account, merge to main, or publish production without Miguel's separate explicit approval.</P>
        <P><B>Git source of truth:</B> repository transittaxmc-create/claris; working branch feat/copiloto-v7-phase1-foundation; branch https://github.com/transittaxmc-create/claris/tree/feat/copiloto-v7-phase1-foundation ; compare https://github.com/transittaxmc-create/claris/compare/main...feat/copiloto-v7-phase1-foundation . GitHub confirms branch exists and current integration identity has admin/push/pull permissions. Repository is currently PUBLIC; recommend making it private before adding confidential code or operational secrets, but do not change visibility without approval.</P>
        <P><B>Railway workspace:</B> project copiloto-v7-temporal, project ID a27e9703-8ee8-4650-ac57-c966a7301ca1; environment review, ID 6b472376-3905-42d1-9e5b-58321f8caf12; service copiloto-v7-preview, ID cd3e119a-0a24-4412-adc0-a0ae56f1e893. Service source repo is transittaxmc-create/claris but branch is null. Latest deployment db880409-f594-4692-b106-35dbe7ba4380 reports SUCCESS, commit 51cb5217cdb9b938678428b51ea64bc8e1300408, branch main, URL null. It is NOT a V7 deployment and must not be represented as V7 preview.</P>
        <P><B>GitHub authorization resolved (2026-11-27):</B> Miguel confirmed Railway/GitHub authorization had been completed. Re-ran connect_service_source successfully. Railway service now reports source repo transittaxmc-create/claris and branch feat/copiloto-v7-phase1-foundation; commitSha is null (follows branch). The previous “User does not have access to the repo” blocker is resolved.</P>
        <P><B>Current V7 branch deployment (verified 2026-11-27):</B> deployment 6c2ac0c8-725b-489c-ae86-a654bea2c3fd, commit faf2350ffcc3e4e5166fa4f64d1d12671d09924a, branch feat/copiloto-v7-phase1-foundation. Railway reports <B>SUCCESS</B> in region iad. Runtime logs show Next.js 16.3.3 started on port 8080 and reported Ready. Temporary public preview domain: https://copiloto-v7-preview-review.up.railway.app (target port 8080). Direct curl probes from the review desktop returned HTTP 200 for both / and /copiloto-v7-preview; the latter HTML contains Communications, Transport, Taxes, Work Opportunities and Square labels and a mobile viewport meta tag (width=device-width, initial-scale=1, viewport-fit=cover). The web fetch tool could not access the URL, and visual browser QA remains pending because Playwright's Chromium install reported unsupported Ubuntu 26.04; no screenshot or interactive browser test was completed. Build logs confirm frozen-lockfile install, Next.js production compilation and static page generation 10/10. Next.js reported “Skipping validation of types”; separate TypeScript check is covered below. `pnpm run test:crm-push` passed 4/4 using Corepack pnpm 12.3.4. Service variableNames is empty; do not add production secrets.</P>
        <P><B>Build configuration:</B> branch package.json uses pnpm@12.3.4, Next.js 16.3.3, React 19; scripts: dev=next dev, build=next build, start=next start, test:crm-push=node --experimental-strip-types --test tests/crm-push-validation.test.ts. Railway Railpack detected Node 26.13.1 and pnpm 12.3.4; commands: pnpm install --frozen-lockfile --prefer-offline, pnpm run build, pnpm run start. Run pnpm run test:crm-push and pnpm exec tsc --noEmit independently after the deployment settles. Inspect runtime logs, service health and configure a temporary public domain only after successful build/deploy and safe configuration.</P>
        <P><B>Build configuration:</B> branch package.json uses pnpm@12.3.4, Next.js 16.3.3, React 19; scripts: dev=next dev, build=next build, start=next start, test:crm-push=node --experimental-strip-types --test tests/crm-push-validation.test.ts. Use lockfile-based install (pnpm install --frozen-lockfile), run pnpm run test:crm-push, TypeScript check (inspect tsconfig and available scripts; likely pnpm exec tsc --noEmit), then pnpm run build. Railway Railpack may detect Next.js automatically; verify actual build and start command, port and health. Do not invent success.</P>
        <P><B>Safety:</B> preview must use synthetic data only. Do not copy production Supabase service-role keys, real customer data, production messaging credentials or payment credentials into Railway. No real outbound messages, opportunity acceptance, tax filing, Square payments/refunds, or production DB migrations. Use isolated staging resources only if available and explicitly approved. Never expose secrets in logs/docs.</P>
        <P><B>Visual QA checklist:</B> after verified deployment, open the exact V7 URL and test desktop and iPhone responsive layouts; capture every main navigation item; test Communications inbox/search/filter/local draft and confirm approval label remains NOT SENT; Transport sample job create/filter/status; Taxes sample case/checklist/status; Work Opportunities filters and missing-info behavior/no send; Square sample sections/no transactions. Check console/network errors, navigation, overflow, keyboard/accessibility basics, and reload behavior. Confirm no real data or external side effects. Record screenshots/evidence and defects before handoff.</P>
        <P><B>Existing implementation status:</B> points 4–8 have demo UI components and documentation on this branch, not production integrations. Point 3 security/database reconciliation remains open. Points 9–10 are not complete: a CI workflow was added, but latest V7 build/typecheck/tests/visual QA have not been verified. Prior Vercel failures were team build-rate-limit, not evidence of source build failure. Do not mark points complete until verified.</P>
        <P><B>Next agent exact sequence:</B> (1) read this §32 and §§22–31 plus docs/copiloto-v7-punto-9-verificacion-integral-2026-11-27.md and docs/copiloto-v7-punto-10-release-readiness-2026-11-27.md; (2) inspect latest branch commit and workflow run; (3) resolve Railway GitHub App repository permission; (4) attach service to exact feature branch and verify deployed SHA; (5) run tests/typecheck/build and fix failures on feature branch; (6) generate/verify preview URL; (7) perform desktop/iPhone QA and document evidence/defects; (8) update this manual and handoff report with exact commits, deployment state, URL, push-notification registration status and notification tests (not implemented/verified unless evidence exists); (9) prepare review/PR and wait for Miguel's explicit merge approval. Original Vercel app remains untouched until approval.</P>
        <P><B>Automated checks (2026-11-27):</B> on a clean clone of the feature branch using Corepack pnpm 12.3.4 and frozen lockfile install, pnpm run test:crm-push passed <B>4/4</B> tests. Independent pnpm exec tsc --noEmit FAILED with <B>66 TypeScript errors</B> across the existing app/API files, including components/copiloto/entry-screen.tsx, storage.ts, reconciliation.ts, trip-edit-sheet.tsx, mileage-log.ts, copiloto-app.tsx, plus tests/crm-push-validation.test.ts TS5097. Error themes include model/type shape mismatches (Trip/Reconciliation/Expense/MileageDay), missing exports/identifiers and an import-extension compiler option. Baseline comparison completed: the same `pnpm exec tsc --noEmit` was run on a clean clone of `main` using pnpm 12.3.4 and frozen lockfile install. `main` also fails with 66 errors, and the sorted TypeScript error lines are identical to the feature branch (no additional or changed TS diagnostics observed). Therefore the current feature branch introduced <B>zero additional TypeScript diagnostics</B> versus main in this comparison, although the repository-wide typecheck remains failing. Do not suppress errors or weaken tsconfig. A Next.js build SUCCESS is not equivalent to a clean typecheck.</P>
        <P><B>Latest verified session status (2026-11-27):</B> GitHub authorization resolved; Railway connected to the exact V7 feature branch. Current deployment 6a948e27-3a11-4f60-97ca-918914c55056 is <B>SUCCESS</B>, commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e, runtime Ready on port 8080, temporary domain https://copiloto-v7-preview-review.up.railway.app. Latest HTTP checks: / and /copiloto-v7-preview both HTTP 200. CRM is a direct primary bottom-nav item after REPORTS; Today/Earnings/Money/Reports/More remain; CRM removed from More; existing CRMScreen lazy-loaded via next/dynamic. Visual screenshot/interactions on iPhone/desktop remain pending because sandbox has no browser installed; do not mark visual QA PASS. Next skipped TypeScript validation. Independent `pnpm run test:crm-push` passed 4/4; `pnpm exec tsc --noEmit` failed with 66 errors across app/API/type files (details recorded in §32 and handoff report). No remote push registration/delivery verified. No merge or production changes. Stage 1 deployment and HTTP verification complete; visual QA remains an explicit outstanding item.</P>
      </Section>

      <Section title="COPILOTO V7 — §33: MASTER PROJECT PLAN & CONTINUITY FOLDER (2026-11-27)">
        <P><B>Instrucción de Miguel:</B> consolidar toda la información de las conversaciones, decisiones, alcance, implementación, bloqueos y próximos pasos en una carpeta central para que el siguiente agente pueda continuar sin repetir preguntas ni reiniciar el proyecto. Trabajar con mínima conversación y documentar cada hito.</P>
        <P><B>Carpeta maestra creada:</B> docs/copiloto-v7-master/ contiene README.md (índice), MASTER-PLAN.md (visión, arquitectura, módulos, seguridad, fases y criterios de aceptación), CURRENT-STATE.md (estado técnico verificado), AGENT-HANDOFF.md (mandato y secuencia para el siguiente agente) y DECISION-LOG.md (decisiones explícitas recuperadas de conversaciones previas).</P>
        <P><B>Identificadores que no deben confundirse:</B> CRM Supabase mimgwleghecseoymgdug; finanzas/Plaid legado zrcnpmipdhpjdjkfrrgt — NO TOCAR. Repositorio transittaxmc-create/claris, rama feat/copiloto-v7-phase1-foundation. Preview Railway https://copiloto-v7-preview-review.up.railway.app. Vercel claris sigue siendo destino final tras aprobación, no desplegar producción.</P>
        <P><B>Avance funcional inmediato:</B> CRM fue añadido como quinto acceso directo de la navegación inferior. TODAY, EARNINGS, MONEY y REPORTS se conservaron; MORE sigue disponible y CRM se retiró de su lista para evitar duplicidad. components/copiloto/copiloto-app.tsx ahora carga CRMScreen con next/dynamic (ssr:false) al abrir la pestaña y muestra Loading CRM durante carga. Commits: 0e0104cba9bf606220f5d16ed62ff77125467d27 y cf1caace273e2ad26dd13766a53631af3330d2c6. Validación local con clon limpio actualizado: pnpm run test:crm-push PASS 4/4; pnpm run build PASS (Next.js 16.3.3, compilación y generación 10/10). pnpm exec tsc --noEmit conserva 66 errores del baseline main, sin nuevos diagnósticos/categorías (posiciones de línea desplazadas por el cambio). El deployment Railway aún corresponde al commit anterior; falta desplegar esta actualización y verificar el ancho visual de los seis accesos en iPhone/escritorio.</P>
                <P><B>Visión consolidada:</B> Copiloto como consola principal; áreas Transport (Island City Transit), Taxes (Brakha Group Tax Services), Work Opportunities, Communications, Clients, Documents, Square, Agenda/Tasks, Dashboard, Identity, Notifications, Audit y Recovery. CRM debe ser icono independiente y lazy-loaded sin alterar navegación/finanzas existentes. Teléfonos son captura/consulta, nunca almacén maestro; documentos y registros recuperables desde bóveda central privada con MFA y revocación de dispositivo.</P>
        <P><B>Reglas obligatorias:</B> no datos reales ni documentos fiscales durante desarrollo; no mensajes salientes, aceptación de ofertas ni pagos reales; aprobación humana para todo envío/aceptación/movimiento de dinero; no scraping WhatsApp Web ni lectura de grupos personales; Square Sandbox primero; no migraciones hasta reconciliar ledger y SQL; no secretos en código/documentación; no merge a main ni producción sin aprobación expresa.</P>
        <P><B>Estado técnico consolidado (deployment 6a948e27, commit b0aa463): Railway SUCCESS; runtime Ready y preview HTTP 200 en / y /copiloto-v7-preview. CRM está añadido como quinto acceso primario y lazy-loaded. pnpm run test:crm-push PASS 4/4. TypeScript reporta 66 diagnósticos idénticos en main y feature (cero nuevos en feature, typecheck global sigue fallando). Visual screenshot/interacción browser QA pendiente por falta de navegador en sandbox. Los módulos de preview son demostraciones locales; no CRM persistente ni integraciones reales. Push remoto/app cerrada, Twilio, WhatsApp, Square, email, OCR y e-file no verificados.</P>
        <P>Etapa 2 — conciliación de migraciones (2026-11-27): lectura de Supabase CRM ACTIVE_HEALTHY y comparación del ledger con SQL del repo completadas. Dos versiones aplicadas (20261126033314 y 20261126035245) no tienen archivo original en la rama ni se recuperaron por búsqueda. Sus efectos existen: crm_reservations_client_owner_idx, crm_reservations_id_user_uidx (id,user_id) y CHECK crm_reservations_airport_flight_required. No se puede certificar el SQL original; no se ejecutó DDL ni se modificó DB/ledger/datos. Advisors: leaked-password protection disabled; FKs crm_messages sin índices covering; cuatro policies finance_sync_doc con auth.uid() por fila; índices duplicados y sin uso. Hallazgos documentados, sin cambios destructivos. Base de datos: esquema y migration ledger divergen. Recuperar SQL exacto de versiones faltantes 20261126033314 y 20261126035245 y procedencia de scripts no registrados. No ejecutar scripts reflejados ni insertar versiones manualmente. Bucket crm-client-photos es solo fotos; documentos fiscales necesitan bóveda privada separada.</P>
        <P><B>Despliegue del nuevo acceso CRM:</B> Railway fue reconectado a la misma rama para compilar el cambio. Deployment 6a948e27-3a11-4f60-97ca-918914c55056, commit b0aa463601a55fd3c5d12a11b28a9eeb63a1f59e; último estado consultado BUILDING, sin URL ni región confirmada. No afirmar que la nueva navegación ya está publicada hasta que Railway informe SUCCESS y se pruebe.</P>
                <P><B>Etapa 3 — Auth/MFA/RLS (2026-11-27):</B> RLS SELECT A/B probado bajo role authenticated en crm_clients, crm_reservations, crm_messages y finance_sync_doc: ambos usuarios solo ven sus propias filas (cross_owner_rows=0). Las cuatro tablas tienen RLS enabled, pero no FORCE RLS. Auth: 2 usuarios, 0 MFA factors observados, 8 sesiones; leaked-password protection desactivada. No existen tablas membership/organizations/business_units; modelo sigue owner-only. APIs usan auth.getClaims y owner_id derivado de sesión; no hay AAL2 ni autorización por unidad Transport/Taxes. Storage fotos privado, pero sin límites MIME/tamaño; no hay vault fiscal separado. <B>Etapa 3 NO CERRADA:</B> faltan MFA enrolamiento/enforcement, configuración de password protection, memberships, pruebas negativas de escritura, hardening Storage y permisos por unidad. No se modificaron Auth, sesiones, DB ni Storage.
        <B>Etapa 4 — Clients + Transport + Communications (2026-11-27):</B> /copiloto-v7-preview tiene diseño e interacciones locales para los módulos, pero no usa fetch/Supabase ni persiste al refrescar. CRMScreen anterior sí tiene sign-in y sync vía /api/crm/state, pero Railway review carece de NEXT_PUBLIC_CRM_SUPABASE_URL y NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY; GET /api/crm/state devuelve 503 crm_cloud_not_configured. SMS queue no envía; dispatch 501. <B>Etapa 4 NO CERRADA:</B> pendiente vertical V7 persistente, prueba login sintético, CRUD cloud, reload y aislamiento por unidad. Bloqueada por etapa 3; no conecté el preview a la DB antes de completar MFA/memberships.
        <B>Etapa 5 — Documents vault (2026-11-27):</B> solo existe crm-client-photos privado para fotos; bucket sin límites MIME/tamaño. El preview enseña metadatos de ejemplo y no sube archivos. No hay bóveda documental/fiscal separada, versionado/hash, OCR, retención, auditoría de descargas ni recuperación verificada. <B>Etapa 5 NO CERRADA:</B> pendiente después de MFA/memberships y diseño de esquema seguro; no se cargaron archivos.
        <B>Etapa 6 — Taxes workflow (2026-11-27):</B> TaxWorkspace tiene casos seed, búsqueda, formulario, estados y checklist solo en React state. No fetch/Supabase/persistencia, tabla tax_cases, vault fiscal, OCR, tax software ni e-file. Separación Taxes/Transport aún no existe. <B>Etapa 6 NO CERRADA:</B> demo visual solamente; falta etapa 3 y 5 antes de datos fiscales reales.
        <B>Etapa 7 — Work Opportunities (2026-11-27):</B> lista seed local, filtros, drafts y clasificación fit en useState; sin persistencia ni intake. WhatsApp Personal/grupos no se leen por API oficial; ZapClaw Coexistence no lee grupos; no scraping. Demo no calcula rentabilidad real ni disponibilidad. <B>Etapa 7 NO CERRADA:</B> falta captura manual/compartir segura, almacenamiento/auditoría, análisis con datos sintéticos y aprobación humana antes de cualquier YES. No se aceptó ni envió ninguna oferta.
        <B>Etapa 8 — SMS/WhatsApp/email/push (2026-11-27):</B> preview sin credenciales. Push config enabled=false/publicKey=null; outbox /api/crm/send 503 crm_cloud_not_configured; dispatch /api/crm/send/dispatch 501 phone_dispatch_not_connected. Código no envía SMS. WhatsApp Business/Coexistence y email no conectados; grupos personales no accesibles por API oficial; no scraping. ZapClaw token previo comprometido: rotar antes de usar. Sin push remoto ni prueba con app cerrada. <B>Etapa 8 NO CERRADA:</B> falta proveedor, credenciales, webhooks, consentimiento, pruebas sandbox y delivery verificado. No se enviaron comunicaciones.
        <B>Etapa 9 — Square Sandbox (2026-11-27):</B> SquareWorkspace solo muestra datos seed y estado local; no OAuth, SDK/API, webhooks ni rutas. No hay credenciales Sandbox ni cuenta conectada. Búsqueda del directorio de plugins no encontró conector Square disponible; Stripe/Shopify no sustituyen Square. No se crearon clientes, invoices ni pagos. <B>Etapa 9 NO CERRADA:</B> pendiente credenciales Sandbox, scopes, OAuth, firma webhook, idempotencia y pruebas de customers/invoices/payment links en Sandbox.
        <B>Prioridad de ejecución:</B> (1) cerrar QA visual; (2) reconciliar migraciones; (3) Auth/MFA/memberships/RLS y pruebas A/B; (4) terminar vertical end-to-end Clients + Transport reservations + Communications outbox; (5) Documents vault/OCR y recuperación; (6) Taxes workflow; (7) Work Opportunities intake/evaluation; (8) notificaciones/Twilio/email/WhatsApp oficial; (9) Square Sandbox; (10) QA integral y preparar transferencia Vercel, sin publicar producción.</P>
        <P><B>Expectativa realista:</B> avanzar hoy lo máximo posible no significa declarar CRM productivo o íntegramente conectado. Cada módulo se cierra con persistencia, autorización/RLS, pruebas, auditoría, QA y evidencia. Si una API/cuenta/permiso no está disponible, dejar handoff exacto y no simular éxito.</P>
        <P><B>Continuidad:</B> leer docs/copiloto-v7-master/README.md y seguir AGENT-HANDOFF.md antes de cualquier cambio. Actualizar la carpeta maestra y How This Works en cada hito, re-fetch para verificar, e informar deployment READY/BUILDING/FAILED, push registration y pruebas push exactas.</P>
      </Section>

      <Section title="COPILOTO V7 — §34: GO MODE · OPERACIÓN MÓVIL RÁPIDA (2026-11-27)">
        <P><B>Objetivo de diseño confirmado por Miguel:</B> la computadora es el centro de administración profundo; el teléfono es herramienta de operación inmediata mientras está en movimiento o negociando. No replicar en móvil un dashboard de escritorio lleno de tarjetas, pestañas y atajos. La pantalla móvil debe reducir pasos, mantener funciones potentes detrás de flujos simples y priorizar mensajes, reservas/viajes, clientes y oportunidades.</P>
        <P><B>Prototipo creado:</B> ruta /copiloto-v7-go (app/copiloto-v7-go/page.tsx), separada de la ruta desktop /copiloto-v7-preview y sin reemplazar Claris. Navegación móvil Today / Inbox / Trips / Clients / More. Today prioriza Quick trip entry, mensajes pendientes y oportunidad que requiere revisión. Trips permite captura rápida de pickup, destination, fare y cliente opcional. Inbox reúne mensajes por canal y área; puede preparar borrador y marcar aprobación simulada, nunca enviar. Clients permite buscar y añadir contacto de muestra. Escritorio añade Field Workflow con la secuencia de extremo a extremo.</P>
        <P><B>Estado real:</B> prototipo interactivo local con datos sintéticos y estado React en memoria. No hay persistencia Supabase, no se conserva tras reload, no hay GPS real, no hay envío de SMS/WhatsApp, no se acepta trabajo ni se procesa pago. Save trip/Add client/Approve draft son simulaciones explícitamente etiquetadas. No afirmar que los datos están guardados en CRM central.</P>
        <P><B>Commit:</B> d9be60e07dd3ad649825c6c40f15c0fed1490e23. Documentación CURRENT-STATE actualizada en commit 64ffcb747b933de6ceb3893c4455082f7132ea91. Build, TypeScript, browser visual QA y Railway deployment de esta ruta todavía pendientes. Próximo paso: validar build y responsive en Railway review; luego conectar el flujo a la base CRM y APIs solo tras completar seguridad y migraciones. No merge a main ni producción.</P>
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
