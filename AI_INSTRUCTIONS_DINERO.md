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

**Pattern:** AI shows a short **summary of what it proposed** → user corrects some lines and **Approves** the rest → only then persist.

Exception: pure UI navigation and non-destructive display do not need approval.

---

## 1. Project identity

| Item | Detail |
|------|--------|
| App | Copiloto / Dual Register |
| Production | `https://claris-lime.vercel.app/` |
| Repo | `transittaxmc-create/claris` |
| Tabs | HOY · COBROS · DINERO · REPORTES · MÁS |

Prefer additive, minimal diffs. Do not rewrite HOY/COBROS/REPORTES unless bridging.

---

## 2. Quicken-style register (source of truth)

- Each account has a full **register** of bank movements (visible, editable).
- AI never hides bank lines. User verifies and corrects.
- UI: fixed header + scrollable register box.

---

## 3. Dual money layers

**Real/Posted** vs **Projected/Due**. Bill = to pay later. Receipt = already paid.

---

## 4. Classification (required for reports)

Every income/expense needs: direction (income|expense|transfer), **category**, **Business/Personal**, account.

Reports are invalid on uncategorized lines — say how many are missing instead of inventing totals.

---

## 5. Transfers ≠ income

External money = income once. Owner-to-owner moves = transfer only.

---

## 6. Daily reconciliation

Sync → propose classify → propose transfer matches → replace day income projection (never stack) → report gaps → **wait for approval** before bulk write.

---

## 7. Projected cash flow

Shared timeline; weekdays Monday…; replace projection with real external income when reconciled.

---

## 8. Scanner

Require Bill|Receipt and Business|Personal. Optional recurring schedule.

---

## 9. Persistence

`claris_cash_flow_entries`, `claris_registers_v1`, `claris_custom_categories`. No DROP/TRUNCATE of history.

---

## 10–11. AI must / must not

**Must (propose):** categorize all new bank lines; Biz/Personal; transfer pairs; day projection replace; summary of work; gap list.

**Must not:** hide bank lines; bulk-write without approval; count transfers as income; stack projection+real; invent OCR; wipe data.

---

## 12. One-line summary

**Register = full bank truth; AI proposes categories + matches + daily reconcile and shows a summary; owner corrects and approves; transfers never inflate income; reports need full classification.**

---

## 14. Categories (list + custom + summary / approve)

### Base list

From `EXPENSE_CATEGORIES` in `types.ts` (Fuel, Maintenance, Tolls/EZPass, Food, Car wash, Insurance, Bank fees, Phone, Parking, Supplies, Other). Income may use Platform / Other.

### Custom categories

- Add in **Settings / Ajustes**.
- Store in `claris_custom_categories` (string array).
- Dropdown = built-in + custom.
- If no match, propose closest built-in or "create custom" — do not leave silent blank.

### Auto-categorize + human approve

1. After sync/scan, AI proposes category + Business/Personal for every new line.
2. AI presents a **summary** (e.g. 12 categorized, 2 transfers, 1 needs review).
3. User **corrects** mistakes and **Approves** what is right (or Approve all).
4. Only then bulk-save.
5. Uncategorized lines stay visible; reports warn if any remain.

### Heuristics (propose only)

| Memo contains | Suggest |
|---------------|---------|
| SHELL, EXXON, GAS, FUEL | Fuel |
| EZPASS, SUNPASS, TOLL | Tolls |
| 7-ELEVEN, MCDONALD, RESTAURANT | Food |
| UBER/LYFT payout | Platform income |
| FEE, SERVICE CHARGE | Bank fees |
| PAYMENT TO CARD, TRANSFER | Transfer |
