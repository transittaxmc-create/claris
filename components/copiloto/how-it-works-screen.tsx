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
            <B>One register per account</B> (Quicken style). <B>CitiBank …6393 ★</B> is the main
            account. Accounts with no transactions are hidden, never deleted.
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
          <B>Pending deposits</B> (money held by platforms) · <B>Data</B> (reset — only from the
          phone) · this manual.
        </P>
      </Section>

      <Section title="8. Standing rules">
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
