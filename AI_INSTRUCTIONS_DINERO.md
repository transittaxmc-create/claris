# AI Instructions — Copiloto / Dual Register (DINERO module)

> Paste this file (or its path) into any AI agent working on this project.
> Scope is **surgical**: DINERO / General Ledger / scanner / cash-flow bridge only.

---

## 1. Project identity

| Item | Detail |
|------|--------|
| App | Copiloto / Dual Register (transport cash-flow copiloto) |
| Stack | Next.js App Router, TypeScript, Tailwind CSS, SPA tab navigation |
| Production | `https://claris-lime.vercel.app/` |
| Repo | `transittaxmc-create/claris` (typical path) |
| Tabs | HOY · COBROS · DINERO (Finance) · REPORTES |

**Do not** rewrite HOY, COBROS, or REPORTES routes/screens unless the task is an explicit bridge (e.g. reconcile Cobros → ledger). Prefer additive, minimal diffs.

---

## 2. Dual Register (core model)

There are **two money layers**, not one:

| Layer | UI label | Meaning | Affects bank balance? |
|-------|----------|---------|------------------------|
| Actual / Posted | BANK BALANCE | Already in bank or already spent | **Yes** |
| Projected | PROJECTED | Expected to arrive or still to pay | **No** (until moved to Posted) |

### Document kinds

| Kind | When | Ledger `status` | Typical `source` / label |
|------|------|-----------------|---------------------------|
| **Bill** | To pay later (Easy Pass, Tower, SunPass, invoices) | `projected` | `projection` / `Bill` |
| **Receipt** | Already paid / on bank statement | `actual` | `receipt` or `bank` / `Receipt` |

- Toll documents that *look* like receipts are often **Bills**.
- Never invent amounts if OCR fails; user fills fields manually.

---

## 3. Persistence

| Data | Storage |
|------|---------|
| General Ledger entries | `localStorage` key **`claris_cash_flow_entries`** |
| Related finance keys | e.g. `claris_scheduled_entries`, `claris_toll_bills`, finance week keys |

- Primary ledger path today is **localStorage**, not Supabase for the dual register.
- If schema work is ever required: **additive only** (`CREATE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- **Forbidden:** `DROP TABLE`, `TRUNCATE`, destructive resets of historical user data.

---

## 4. Key source files (DINERO)

| File | Role |
|------|------|
| `components/copiloto/cash-flow-register.tsx` | General Ledger UI (5-col table, edit modal, Bill/Receipt) |
| `components/copiloto/cash-flow-store.ts` | Read/write ledger, `movimientoDeGasto`, `reconciliarCobrosAlLibro` |
| `components/copiloto/receipt-scanner.tsx` | Scan + **required** Bill/Receipt dropdown before save |
| `components/copiloto/finance-screen.tsx` | Finance chrome / sub-tabs (Cash Run, General Ledger, …) |
| `components/copiloto/types.ts` | `CashFlowEntry`, `Expense`, optional `docType` |

Expense → ledger mapping: `movimientoDeGasto` / `guardarMovimiento`.

Stable IDs (anti-duplication):

- Expense: `claris:gasto:{expenseId}`
- Cobros by day/platform: `claris:cobro:YYYY-MM-DD:{platform}`

---

## 5. Reconciliation: COBROS → Ledger (replace, do not stack)

**User flow**

1. User verifies income on **COBROS** (grouped by platform).
2. User triggers **RECONCILE** (or equivalent).
3. Verified net totals for that day are pushed into the General Ledger as **projected income**.

**Hard rules**

1. **Replace, do not stack.** If a scheduled daily projection exists (e.g. $400/day placeholder), reconciliation **removes/replaces** that placeholder for the day and writes the reconciled Cobros amount (may be higher or lower than $400).
2. **Deterministic IDs** per day + platform (`claris:cobro:…`) so re-running reconcile upserts instead of duplicating.
3. Reconciled lines enter as **`status: "projected"`** (expected inflow), not as live bank balance, until the user marks them Posted / matched if needed.
4. Deleting or editing a **projection** must **not** change **BANK BALANCE** (actual layer only moves when status is actual/posted).
5. Reference implementation: `reconciliarCobrosAlLibro` in `cash-flow-store.ts` (filter day placeholders → upsert by platform → persist).

---

## 6. Document scan rules

Before save, **Document type is required** (dropdown; no silent default of Receipt):

- **Bill — to pay later** → projected payable in the ledger.
- **Receipt — already paid** → posted expense; attach scan photo when possible for **View** / match to bank.

User is responsible for classification at scan time (e.g. Easy Pass = Bill).  
Anything wrong later is fixed in the **ledger** (full edit).

---

## 7. Ledger editability (fully reversible)

Every entry must remain correctable:

| Action | Behavior |
|--------|----------|
| Tap description / pencil | Open full edit modal |
| Modal **Save** | Persist to `claris_cash_flow_entries` |
| Inline amount blur | Save amount only |
| **→ Bill** / **→ Receipt** | Instant status/source/label flip |
| Delete | Remove entry (confirm) |

**Editable fields:** description/vendor, amount, date, income/expense, Bill vs Receipt, category, notes (keep image attachment if stored as `data:image…` in notes).

UI copy for the ledger prefers **English technical labels**: DUAL REGISTER, BANK BALANCE, PROJECTED, SETTLEMENT, Bill, Receipt, Posted, etc.

---

## 8. What the AI must do when changing code

1. **Surgical diffs only** — touch the minimum set of DINERO-related files.
2. **Preserve data** — no wiping localStorage seeds beyond intentional `sinSemillas` / known demo IDs; no destructive DB ops.
3. **Keep replace semantics** on Cobros reconcile; never introduce double-counting.
4. **Keep Bill/Receipt semantics** on scan and on ledger correction.
5. **Mobile-first** — no horizontal table scroll; adequate tap targets.
6. Prefer **additive** type fields (`docType?`, etc.).
7. After changes: clear commits; do not “clean up” unrelated modules.
8. Do not promise cloud sync unless it is explicitly implemented.

---

## 9. What the AI must not do

- Drop or truncate historical ledger data.
- Assume every scan is a Receipt.
- Stack Cobros reconcile on top of the same day’s projection without replacing placeholders.
- Move projected amounts into BANK BALANCE without an explicit user action (Match / → Receipt / status = actual).
- Rewrite HOY / COBROS / REPORTES for cosmetic reasons.
- Invent OCR amounts.

---

## 10. One-line summary

**Dual register = real bank + projections; Bill = to pay (projected); Receipt = already paid (posted); Cobros reconcile replaces that day’s projection (no duplicates); entire ledger is editable and saves to localStorage on Save / blur / Bill↔Receipt toggle.**

---

## 11. Suggested agent checklist before finishing a task

- [ ] No destructive data operations  
- [ ] Cobros path still **replace** + stable IDs  
- [ ] Scan still requires Bill vs Receipt  
- [ ] Ledger still fully editable and reversible  
- [ ] HOY / COBROS / REPORTES untouched unless required for bridge  
- [ ] Mobile layout still no horizontal overflow on ledger table  
