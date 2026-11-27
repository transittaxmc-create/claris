# CRM Copiloto V7 — SMS Engagement + Customer 360

**Status:** Phase 0 specification prepared; implementation not yet started beyond documentation. This is an internal staff CRM; customer self-service portals are explicitly out of scope for the current architecture.
**Owner decisions (2026-11-27):**
- One unified customer timeline across channels; every event visibly identifies its channel.
- Every outbound message requires explicit owner approval. No AI auto-send.
- Full Customer 360 internal profile: communications, reservations/trips, referrals, revenue/profitability, notes, follow-ups and activity.
- Client accounts are internal business records created/maintained when a transport job is approved/booked or a tax service is accepted. They are not customer login accounts and do not imply a public portal.
- One CRM supports separate business lines: Transport and Tax. A person may have relationships with either or both, but service records, permissions, documents, consent purposes and financial reporting must be scoped by business line.

## Non-negotiable safety and scope
- All tests use synthetic fixtures and isolated test accounts/environments.
- Do not inspect or modify existing customer message bodies or customer records for tests.
- Do not send SMS, WhatsApp, email or push notifications to customers during development or verification.
- Do not connect or activate WhatsApp in this SMS phase.
- Never claim a message was sent or delivered without a provider response that proves that state.
- Keep CRM Supabase project `mimgwleghecseoymgdug` separate from legacy Finance Supabase `zrcnpmipdhpjdjkfrrgt`.
- No destructive schema/data migration. Preserve existing localStorage keys and cloud records until a reviewed migration and rollback plan exists.
- Never store tax returns, SSNs, ITINs, W-2s, 1099s, identity documents or other highly sensitive tax data in Square Customer Directory, CRM notes, SMS, or general-purpose customer custom attributes. Keep sensitive tax files in a dedicated private, access-controlled storage workflow with audit logging and retention controls.

## Verified baseline (2026-11-27)
- Git repository: `transittaxmc-create/claris`, production branch `main`.
- CRM screen: `components/copiloto/crm-screen.tsx`.
- CRM cloud has owner-scoped `crm_clients`, `crm_reservations`, `crm_messages` with RLS enabled.
- Current database aggregate counts: 7 clients, 2 reservations, 1 message. No message or customer content was read for this audit.
- Current CRM message UI stores a received message and its reply draft in one `crm_messages` row; it supports pending/approved/sent/discarded and syncs with the CRM cloud. Message intake is currently manual, not connected to an inbound SMS provider.
- `/api/crm/send` queues/validates only. `/api/crm/send/dispatch` returns 501. No provider sends SMS.
- Existing reservations do not yet provide a complete verified financial ledger (gross, tolls, fees, driver payout, net). Do not display lifetime revenue/profit as authoritative until a dedicated service-job financial record exists.
- Supabase migration ledger currently reports 3 migrations. The live schema includes later-added fields such as client account number/photos, reservation stop address/photos, and message follow-up/send-state fields that are not represented by the three listed ledger entries. This is schema-history drift. **Do not apply new migrations until the source migration history is reconciled against the live schema.**

## Product behavior

### Unified Inbox
- Queues: Needs review, Waiting for customer, Follow-up due, Resolved/Archived.
- Each message shows customer, account number (if assigned), channel, direction, timestamp, current status and last activity.
- Every inbound message receives an AI-assisted reply suggestion where configured; the suggestion is a draft, never an outbound action.
- Actions: Edit draft, Approve & Queue, Ignore, Snooze, and “Already spoke with customer”.
- Ignore/archive is non-destructive: retain the message and its place in the customer timeline. Capture ignored/resolution state and optional reason.
- “Already spoke” records a call/manual interaction activity, marks the relevant follow-up resolved, and retains the SMS event.
- A queued/approved message is clearly labelled **APPROVED — NOT SENT** until a real provider dispatch is implemented. Approval and queueing must never set `sent`.
- Approval audit stores approver, exact approved text, approval timestamp and draft version/hash. Editing after approval invalidates the prior approval and requires re-approval.
- Use idempotency keys to prevent duplicate queue submissions. Provider callbacks, when later implemented, are authoritative for sent/delivered/failed states.

### Internal customer account model (no client portal)
- Create an internal CRM account when a service is approved/accepted; allow a lead/contact record before that only when needed for inquiry handling.
- The account number is an internal identifier only. It is not a username, password, portal invitation or customer-facing login credential.
- No public customer portal, self-registration or client login is part of this phase. Staff access remains behind CRM authentication and owner-scoped authorization.
- Add a `business_line` scope (`transport`, `tax`, with room for future lines) to service records, conversations, tasks, documents, consent and financial events. A shared person/contact identity can link to separate line-specific engagements without mixing restricted records.
- Transport account activation is tied to an approved/accepted trip or service; tax account activation is tied to an accepted tax-preparation engagement. Leads remain leads until that point.

### Customer 360 profile
- Header: customer identity, internal account number, business-line relationship badges, status, contact details, channel consent state and next action.
- Summary metrics: completed trips, gross revenue, direct costs, tolls/fees, driver payout, net profit, referral count and communication activity. Metrics must be derived from linked verified records; missing values display “Not recorded”, never zero by assumption.
- Tabs/sections: Unified timeline, Transport, Tax (only if the staff member is authorized), Reservations & Trips, Referrals, Revenue, Notes & Documents, Follow-ups, Consent & Preferences.
- Use permission-gated sections and separate document vaults for tax vs transport. Do not show tax data to staff who only have transport permissions.
- Timeline is chronological and merges SMS, WhatsApp (future), email/call logs/manual notes, reservation events, referral events and follow-up events. Every event shows source/channel and direction.
- A customer profile may be opened from any inbox item and must link back to the exact conversation/message.
- Match inbound phone numbers using normalized E.164 values. If a number matches multiple records or identity is uncertain, ask the owner to resolve; never silently merge clients.
- Client records and all child records remain owner-scoped. Use composite owner foreign keys and RLS policies.

### Follow-up and engagement
- Create follow-up tasks with due date/time, timezone, priority, owner, status and linked customer/message/reservation.
- Statuses: Open, Snoozed, Completed, Ignored. “Ignored” is retained and auditable.
- Suggested rules: unanswered inquiry, quote sent/no response, reservation requested/unconfirmed, upcoming trip, completed trip, complaint unresolved, referral received, inactive customer.
- Rules create internal tasks and AI drafts only. No outbound automation in this phase.
- Add deduplication keys and quiet hours/timezone handling before any scheduled notifications.

### Revenue and trip attribution
- Keep gross fare, tolls, platform/processing fees, driver payout, other direct costs and net profit as separate fields.
- Define net profit formula with the owner before showing a “profit” KPI. Do not equate trip fare with owner earnings.
- Link each service job to one customer and optionally one reservation/referral. Support adjustments/refunds and currency.
- Do not read or write the legacy Finance database for this CRM feature.

### Consent and compliance
- Store consent per client, channel and purpose (service vs marketing), with source, captured timestamp, evidence/reference and revocation timestamp.
- Block any future send if consent is missing where required, opt-out is active, the number is invalid, or the channel is disabled.
- Process STOP/opt-out events as suppression records and prevent further non-permitted messages.
- Campaign/bulk messaging is out of scope for this phase.

## External customer/payment platform assessment — Square preferred for evaluation, not yet connected
- Square has a real Customer Directory and Customers API. The API can create, retrieve, update, search and delete seller customer profiles; it can synchronize records using customer webhooks and polling. It supports external `reference_id` values and custom attributes. See Square Customers API and customer-profile guidance in the implementation references below.
- Square can also process payments through Payments API, generate Square-hosted checkout links through Checkout API, and support invoices. Payment events such as `payment.created` and `payment.updated` are available through webhooks. The Web Payments SDK tokenizes payment data so the CRM server does not receive raw card numbers; HTTPS and a suitable Content Security Policy are required.
- Therefore Square can be integrated as a payment processor and a secondary contact directory. It is not a replacement for the CRM database or a safe document vault for tax records. Square customer custom attributes can be exported in customer CSVs, including attributes marked hidden; do not put confidential tax information or internal risk notes there. The Square Dashboard's rich Notes feature is not exposed through the Customers API, and the API note field is a separate simple field.
- Recommended authority model: CRM/Supabase remains the system of record for internal customer accounts, business-line relationships, SMS timeline, follow-ups, tax/transport engagement, service ledger and audit history. Square stores only the minimum customer identity/contact fields needed for payments and payment reconciliation. Link the records with `square_customer_id` plus the CRM's immutable internal customer ID as Square `reference_id`.
- Use Square OAuth with minimum scopes (`CUSTOMERS_READ/WRITE`, `PAYMENTS_READ/WRITE`, and invoice/order scopes only if needed); encrypt tokens server-side, keep secrets in Vercel environment variables, validate webhook signatures, use idempotency keys, and log payment/refund events. Never trust the browser to declare a payment paid; verify through Square API/webhook.
- Separate business lines in Square using the appropriate Square location/business configuration or an explicit source/reference convention after confirming the merchant's actual Square account setup. Do not assume two separate Square businesses or locations exist until owner confirms.
- Before connecting production Square, confirm the legal seller entity, existing Square account(s), locations, tax-vs-transport payment flows, fees, refund/dispute handling, and whether payments should be collected by invoice, hosted checkout link or in-app card entry. No live payment or customer sync before explicit authorization.

### Alternative assessment
- Stripe is a strong payment API option and supports customer objects/metadata, but is more payment infrastructure than a ready-made staff CRM directory. For this use case, Square currently appears to fit better because it combines a merchant-facing Customer Directory with payments, invoices and hosted checkout. Stripe can remain the fallback if pricing, account eligibility, payment methods or developer requirements make Square unsuitable.
- HubSpot is a full CRM alternative, but using it as a second CRM risks duplicating the Copiloto workflow. Its Square Data Sync listing says the integration syncs contacts only, not transactions; transaction sync may require custom objects/Enterprise. It is not recommended as the source of truth while we are already building a dedicated CRM.

## Proposed data model (not yet applied)
1. `crm_communications`: append-oriented timeline events; owner, client, business_line, optional reservation, channel, direction, event type, body/summary, source, occurred_at, provider message ID, delivery state, metadata limited to non-secret fields.
2. `crm_reply_drafts`: communication reference, suggested text, edited text, draft version, status, approved text, approver, approval timestamp, queue ID/idempotency key and provider outcome fields.
3. `crm_follow_ups`: client, linked event, title/action, due_at, timezone, priority, status, snooze/completion/ignore audit fields.
4. `crm_referrals`: referrer client, referred client/contact, attribution source, status, dates and linked service jobs.
5. `crm_service_jobs`: customer, business_line, optional reservation, service date/status, gross, tolls, fees, payout, other direct costs, net, currency and reconciliation references.
8. `crm_customer_external_links`: internal client ID, provider (`square` initially), external customer ID, external reference, sync status, last synced version/time, error state; unique per provider/account and internal client. Store no access tokens in this table.
6. `crm_contact_consents`: client, channel, purpose, consent status, evidence/source, captured_at and revoked_at.
7. `crm_activity_log`: immutable owner-scoped audit events for approval, edits, ignore/archive, manual call notes, client linking and profile changes.

The model must be reviewed against the exact live schema and reconciled migration history before DDL. Existing `crm_messages` remains backward compatible during transition; do not rename/drop it in the first migration.

## UI / visual direction
- Preserve the current Copiloto dark/matte visual language and yellow primary action.
- Desktop: three-pane inbox (queue list, conversation, customer context).
- Mobile: single-column navigation with clear back navigation; keep approve/edit/ignore actions thumb-accessible.
- Customer profile uses compact metric cards and a readable vertical timeline; avoid dense tables on iPhone.
- Internal account labels must say “Internal CRM record/account”, never “Client portal” or “Customer login”. Business-line context (Transport / Tax) is always visible.
- Use consistent status colors, larger key metrics, strong typography hierarchy, clear empty/loading/error states and visible sync status.
- No decorative dashboard metrics that are not backed by data.

## Delivery phases and acceptance gates

### Phase 0 — baseline + specification (this branch)
- Document owner decisions, verified current behavior, data model, safety rules and phase gates.
- Acceptance: documentation reviewed; no production data writes; no customer messages sent.

### Phase 1 — safe data foundation and migration reconciliation
- Compare every repository migration file, Supabase migration ledger and live schema.
- Produce a schema drift report and reversible migration plan.
- Add the append-oriented communication timeline and activity/audit model with RLS and composite owner constraints only after reconciliation.
- Define the internal-only customer account lifecycle and `business_line` scoping for Transport and Tax; design permission boundaries and separate private tax-document storage.
- Acceptance: schema diff reviewed; RLS/advisors checked; synthetic owner A cannot read/write owner B fixtures; no existing row changes.

### Phase 2 — inbox workflow and approval audit
- Implement AI draft, edit, approve/queue, ignore, snooze and “already spoke”.
- Every outbound path is approval-gated server-side; no UI-only guard.
- Acceptance: synthetic tests prove no send path is reachable before approval, editing invalidates approval, duplicate approvals are idempotent, ignore preserves history, and no provider is invoked.

### Phase 3 — Customer 360
- Implement profile and unified timeline; connect reservations, referrals, service jobs and notes.
- Show financial KPIs only where underlying verified inputs exist.
- Acceptance: synthetic fixture timeline is chronological, client links are correct, financial totals reconcile to fixture ledger, and owner isolation passes.

### Phase 4 — engagement follow-ups
- Implement internal tasks, due/overdue views, snooze/complete/ignore and duplicate prevention.
- Acceptance: timezone, quiet-hour, idempotency and no-client-send tests pass.

### Phase 5 — payment platform integration (Square first, separate authorization gate)
- First implement Square Sandbox only: OAuth/token storage, customer-directory upsert/search with `reference_id`, payment links/invoices, payment and refund webhooks, reconciliation and idempotency.
- Sync only minimum contact fields; CRM remains source of truth. No sensitive tax documents or identifiers in Square.
- Acceptance: sandbox customer create/update/search, duplicate prevention, webhook signature verification, payment/refund fixture reconciliation and no live charges.

### Phase 6 — real SMS integration (separate authorization gate)
- Select provider and sender, configure secrets in Vercel only, implement inbound webhook signature validation, outbound approved queue worker, provider callbacks, opt-out suppression and delivery audit.
- No live customer traffic until the owner explicitly authorizes a controlled test plan. First tests use provider test credentials or an owner-controlled test number only.
- Acceptance: signed webhook tests, idempotent inbound/outbound, STOP handling, delivery-state verification and approval audit.

### Phase 7 — WhatsApp (later, separate scope)
- Research/confirm official WhatsApp Business Platform account, number, provider, templates and consent requirements.
- Add channel to the same timeline without changing SMS records or personal WhatsApp Business App.
- Require separate explicit authorization before activation or any external message.

## Implementation references
- Square Customers API: https://developer.squareup.com/reference/square/customers-api
- Square customer profile management: https://developer.squareup.com/docs/customers-api/use-the-api/keep-records
- Square customer search: https://developer.squareup.com/docs/customers-api/use-the-api/search-customers
- Square payment options: https://developer.squareup.com/docs/online-payment-options
- Square Web Payments SDK security/tokenization: https://developer.squareup.com/docs/developer-guides/payments-guide
- Square payment webhooks: https://developer.squareup.com/reference/square/payments/webhooks
- Square custom-attribute export visibility: https://developer.squareup.com/docs/customer-custom-attributes-api/overview
- Square security overview: https://squareup.com/help/us/en/article/3797-secure-data-encryption
- HubSpot Square sync limitation: https://ecosystem.hubspot.com/marketplace/listing/square-data-sync

## Immediate blockers / next technical action
- Reconcile migration history drift first. The current live schema and migration ledger do not match; applying another migration blindly risks breaking the CRM.
- Audit the full message sync path and API authorization, then design a backward-compatible communications model.
- Current deployment status is separate from code readiness; verify Vercel deployment by exact commit before calling any phase live.
