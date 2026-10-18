"use client"

/**
 * Guía de consulta (usuario + agentes IA).
 * Acceso: MÁS → CÓMO FUNCIONA
 * Sincronizada con AI_INSTRUCTIONS_DINERO.md
 */

export function HowItWorksScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8 pt-3">
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Guide</p>
        <h1 className="text-xl font-extrabold text-white">How Copilot works</h1>
        <p className="mt-1 text-[12px] leading-snug text-neutral-400">
          Quicken-style register (whole bank visible and editable), Business/Personal classification,
          transfers without duplicating income, daily reconciliation with approval before applying.
          Para ti y para cualquier agente de IA.
        </p>
      </header>

      <Section title="1. Pantallas principales">
        <P>
          <B>TODAY</B> — day entries (trips). <B>EARNINGS</B> — income by platform and
          reconciliation. <B>MONEY</B> — Ledger (per-account registers + projected flow).{" "}
          <B>REPORTS</B> — summaries. In <B>MORE</B>: Expenses, Panel, Copilot AI, Data, this guide.
        </P>
      </Section>

      <Section title="2. Dual Register (MONEY)">
        <P>
          There are two layers: <B>Real / Posted</B> (already in the bank / already spent) and <B>Projected</B> (upcoming
          or payable). Deleting or editing a projection must not alter the real bank
          balance until you mark the line as Posted / Receipt.
        </P>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Bill</B> = payable (EZPass, Tower, facturas) → projected
          </li>
          <li>
            <B>Receipt</B> = already paid / in the statement → posted + photo if scanned
          </li>
        </ul>
      </Section>

      <Section title="3. Reconcile EARNINGS → MONEY">
        <ol className="list-decimal space-y-2 pl-4 text-[12px] text-neutral-300">
          <li>
            Goes into <B>EARNINGS</B> and pick the day.
          </li>
          <li>Review income by platform (edit if a trip or fee is missing).</li>
          <li>
            Toca <B>Reconcile day → MONEY</B>.
          </li>
          <li>
            The system <B>replaces</B> that day's scheduled projection (e.g. $400) with the real net sum
            of the day. It doesn't stack duplicates (fixed IDs per day + platform).
          </li>
          <li>You can later edit any ledger line if something was off.</li>
        </ol>
      </Section>

      <Section title="4. Escanear documentos">
        <P>
          Al escanear debes elegir: <B>Bill o Receipt</B>, y <B>Business o Personal</B>. Business y
          Personal se llevan por separado en reportes. EZPass / Tower suelen ser <B>Bill + Business</B>.
        </P>
        <P>
          If the AI gets the OCR wrong, fix it before saving or later in the register (everything is
          editable).
        </P>
      </Section>

      <Section title="5. Edit the ledger">
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>Tap a row → modal (vendor, amount, date, Bill/Receipt, Business/Personal, category).</li>
          <li>Data on the phone: localStorage <code className="text-yellow-400/90">claris_cash_flow_entries</code>.</li>
        </ul>
      </Section>

      <Section title="6. For AI agents">
        <P>
          Read the repo file <B>AI_INSTRUCTIONS_DINERO.md</B> (source of truth for agents).
          Key rules: suggest match/classification/daily reconciliation;{" "}
          <B>no bulk changes without the owner's approval</B>; full register visible;
          transfers ≠ income; the day's projection is replaced, not stacked; reports only with
          classified data (category + Business/Personal); zero data loss; don't invent OCR.
        </P>
      </Section>

      <Section title="7. Per-account registers">
        <P>
          In MONEY, each bank/card has its register. Tap the account card to see the
          movimiento completo de esa cuenta (como Quicken).
        </P>
      </Section>

      <Section title="8. Transferencias">
        <P>
          Transfer = money between <B>your</B> accounts. Never inflates income. Paying the card from
          checking is not a category expense again.
        </P>
      </Section>

      <Section title="9. Vencimientos">
        <P>
          Each card can have a due day. The home shows upcoming due dates to pay on
          tiempo.
        </P>
      </Section>

      <Section title="10. Proyecciones">
        <P>
          Shared projected flow (by date, with weekday: Monday, Tuesday…). To
          reconcile the day, the income projection is <B>replaced</B> with the real external
          income.
        </P>
      </Section>

      <Section title="14. Register = bank truth (like Quicken)">
        <P>
          Each account has its <B>register</B> with <B>all</B> the bank transactions: date,
          detail, amount and running balance — not just "unmatched transfers".
        </P>
        <P>
          The assistant classifies and suggests; <B>nunca oculta</B> the bank movement. You always
          verificas y corriges con un tap.
        </P>
        <P>
          Fixed header (account + balance) and list with <B>scroll inside a box</B>.
        </P>
      </Section>

      <Section title="15. Approval before assistant changes">
        <P>
          The AI can <B>auto-suggest</B>: categories, Business/Personal, matching
          transfers, replacing the day's projection, list of what needs classifying.
        </P>
        <P>
          <B>Doesn't apply bulk changes to the ledger</B> until you approve (Approve / Approve all /
          editar antes). Cualquier fila sigue editable a mano.
        </P>
      </Section>

      <Section title="16. Daily reconciliation (assistant method)">
        <ol className="list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Bank sync → lines in each register.</li>
          <li>Suggest type: income / expense / transfer.</li>
          <li>Suggest category + Business or Personal.</li>
          <li>Suggest transfer pairs (same amount, different accounts).</li>
          <li>
            <B>Reemplazar</B> the day's income projection with the real sum of external income
            (nunca apilar).
          </li>
          <li>Close projected expenses when the real charge appears.</li>
          <li>Report what's left unclassified or unmatched.</li>
          <li>Wait for your approval before saving bulk changes.</li>
        </ol>
      </Section>

      <Section title="17. Why classifying matters">
        <P>
          Reports (spending by category, income by platform, Business vs Personal) and AI analysis
          <B>are only reliable</B> if the day is reconciled and classified. If classification
          is missing, it must say how many lines are missing — don't invent totals.
        </P>
      </Section>

      <Section title="18. Transfers ≠ income">
        <P>
          Income = money from <B>fuera</B>, once where it came in. Transfer = between <B>tus</B>{" "}
          accounts. No suma a "cuánto generé".
        </P>
      </Section>

      <p className="mt-6 text-center text-[10px] text-neutral-600">
        Copilot Dual Register · in-app guide · see also AI_INSTRUCTIONS_DINERO.md
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
