# AI Instructions — Copiloto / Dual Register (DINERO module)

> Paste this file (or its path) into any AI agent working on this project.
> Also mirrored in-app under **Más → Cómo funciona**.
> Scope is **surgical**: DINERO / Ledger / scanner / cash-flow bridge only.

---

## 0. Approval gate (mandatory)

The assistant may **propose** and **prepare** work automatically.
It must **not permanently apply** ledger changes until the **owner approves**.

| Allowed without approval | Requires explicit approval |
|--------------------------|----------------------------|
| Read bank feed / registers | Write category, Biz/Personal, Bill/Receipt to entries |
| Suggest classifications | Mark transfers matched and reclassify lines |
| Draft daily reconcile report | Replace a day's income projection with bank totals |
| Highlight unmatched / uncategorized | Delete or merge entries |
| Answer "what is missing?" | Any bulk update to `claris_cash_flow_entries` |

**Pattern:** AI shows a short proposal → user taps **Approve** / **Approve all** / **Edit first** → only then persist.

Exception: pure UI navigation and non-destructive display do not need approval.

---

## 1. Project identity

| Item | Detail |
|------|--------|
| App | Copiloto / Dual Register (transport cash-flow copiloto) |
| Stack | Next.js App Router, TypeScript, Tailwind CSS, SPA tab navigation |
| Production | `https://claris-lime.vercel.app/` |
| Repo | `transittaxmc-create/claris` |
| Tabs | HOY · COBROS · DINERO (Money / Ledger) · REPORTES · MÁS |

**Do not** rewrite HOY, COBROS, or REPORTES unless the task is an explicit bridge (e.g. Cobros → ledger). Prefer additive, minimal diffs.

---

## 2. Quicken-style register (source of truth)

- Each **bank / card account** has its own **register**.
- The register shows **all bank movements** for that account (not only "unmatched transfers").
- User must **always** see: date, bank detail, amount, running balance, classification.
- AI helps classify and reconcile; **AI never hides** bank lines.
- Everything remains **editable** after AI acts (tap row → correct).

**UI:** Account detail = fixed header (balance + actions) + **scrollable box** for the register list (list scrolls inside the box; page chrome stays fixed).

**Home (Ledger):** Available / Owe / Net → Projected cash flow (shared) → Account chips → open one register.

---

## 3. Dual money layers

| Layer | Meaning | Affects cash available? |
|-------|---------|-------------------------|
| **Real / Posted** | On bank statement or already spent | Yes |
| **Projected / Due** | Expected income or still to pay (Bill / AP) | Forecast only until posted |

### Document kinds

| Kind | Meaning | Ledger |
|------|---------|--------|
| **Bill** | To pay later (EZPass invoice, Tower, open AP) | `projected` |
| **Receipt** | Already paid / matches statement | `actual` |

Toll docs that look like receipts are often **Bills**. Never invent OCR amounts.

---

## 4. Classification rules (required for reports)

Every **income** and **expense** line should eventually have:

1. **Direction:** income | expense | **transfer** (internal)
2. **Category:** Fuel, EZPass, Fee, Food, Insurance, Platform, …
3. **Business / Personal**
4. **Account** (which register)

**Reports and AI analysis are invalid** until the day's lines are classified. Prefer stating "N uncategorized" over inventing totals.

Transfers **never** count as income or as a category expense (e.g. paying the card from checking is not "Fuel" again).

---

## 5. Transfers vs income (no double count)

- **Income** = money from **outside** (Uber, client, external PayPal payment, etc.), counted **once** where it first landed.
- **Transfer** = money between **owner's** accounts (PayPal → Citi, Checking → Card). Same dollar; not new income.
- Example: +$10 Citi + +$10 PayPal = **$20 income**. Later PayPal → Citi $10 = transfer only; income stays **$20**.

Matcher may **suggest** pairs (same amount, different accounts, ±4 days). Apply only after approval (or explicit user match).

Do **not** dump every retail purchase into "Unmatched transfer." Candidates should look like transfers (payment to card, transfer, venmo move), not 7-Eleven.

---

## 6. Daily reconciliation method (AI must know this)

**Goal:** all accounts up to date, classified, balanced for the day.

1. **Sync bank** — pull snapshot into each account register.
2. **Classify each new line** (propose): income / expense / transfer + category + Business/Personal.
3. **Match transfers** between accounts (propose pairs).
4. **Replace** that day's **projected income** with **sum of external income** posted that day (never stack projection + real).
5. **Close projected expenses** when the real charge posts (no double subtract).
6. **AP / Bills:** apply payments FIFO to oldest open bill when user pays.
7. **Report gaps:** uncategorized count, unmatched true-transfer candidates, open projections.
8. **Wait for approval** before writing bulk changes; user can edit any single row anytime.

Cobros reconcile → **replace** same-day income projection placeholders with stable IDs (no duplicates).

---

## 7. Projected cash flow (shared book)

- One **timeline** for forecasts (not one projection register per bank).
- Labels: **Monday, Tuesday, …** + short date (no relative "Hoy" as primary label).
- Lines: Real / Proj / Due; running **Projected balance** on available cash.
- Income projection for a day is **replaced** by real external income when reconciled.

---

## 8. Scanner

On verify form, require:

- Document type: Statement | Receipt | Bill
- Business | Personal
- Optional: schedule recurring (frequency + until when)

Statement → reconcile/import bank lines.
Receipt → posted expense (match bank if possible).
Bill → projected / AP.

---

## 9. Persistence

| Data | Storage |
|------|---------|
| Ledger entries | `localStorage` **`claris_cash_flow_entries`** |
| Registers meta | `claris_registers_v1` |
| Schedules / tolls | `claris_scheduled_entries`, `claris_toll_bills` |

- Additive schema only if DB is used later.
- **Forbidden:** DROP / TRUNCATE / wipe of user history.

---

## 10. What the AI must do automatically (propose)

- Detect new bank lines after sync.
- Propose income vs expense vs transfer.
- Propose category + Business/Personal.
- Propose transfer pairs.
- Propose replace of day's income projection.
- List what is still uncategorized / unreconciled.
- Answer report questions **only** using classified data; otherwise say what is missing.

## 11. What the AI must not do

- Hide bank transactions from the register.
- Apply bulk classification or matches without approval.
- Count internal transfers as income.
- Stack projection + real income for the same day.
- Count card payment from checking as a second category expense.
- Drop or truncate historical data.
- Invent OCR amounts.
- Rewrite HOY / COBROS / REPORTES for cosmetics.

---

## 12. One-line summary

**Register = full bank truth, always visible and editable; AI proposes match + classification + daily reconcile; owner approves before bulk writes; transfers never inflate income; projections replace, never stack; reports require Business/Personal and category.**

---

## 13. Checklist before finishing a code or reconcile task

- [ ] Register still shows full bank lines + edit path
- [ ] Approval gate respected for bulk writes
- [ ] Transfer ≠ income
- [ ] Cobros / day income uses **replace** semantics
- [ ] Bill vs Receipt preserved on scan
- [ ] Business/Personal available for reporting
- [ ] No destructive data ops
- [ ] Mobile: fixed chrome + internal scroll for long registers
