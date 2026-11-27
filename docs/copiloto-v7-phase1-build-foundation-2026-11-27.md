# Copiloto V7 — Phase 1 Build Foundation & Architecture
**Date:** 2026-11-27  
**Status:** Authorized; implementation started in an isolated branch  
**Branch:** `feat/copiloto-v7-phase1-foundation`

## 1. Purpose
Evolve the existing Copiloto application into a professional operations platform while preserving proven legacy workflows. Copiloto remains the platform name.

## 2. Verified starting point
- Repository: `transittaxmc-create/claris`.
- Existing Next.js root route renders `components/copiloto/copiloto-app.tsx`.
- The current shell is mobile-first and uses bottom navigation.
- Current default tab is `ENTRY`; primary visible tabs are TODAY, EARNINGS, MONEY and REPORTS.
- CRM and TAX 2026 are under MORE.
- No Work Opportunities screen or unified Communications Center was found in the inspected navigation.
- Existing finance, trip, toll, CRM, tax and backup flows must be preserved while the new shell is introduced incrementally.

## 3. Target architecture
```text
COPILOTO — platform and shared control plane
├── Executive Home
├── Communications Center
│   ├── Source connectors (disabled/test-only until approved)
│   ├── Message intake and immutable original
│   ├── Classification and routing
│   ├── Human approval queue
│   └── Delivery/audit timeline
├── Transport — Island City Transit
│   ├── Clients and reservations
│   ├── Conversations and follow-ups
│   └── Service history
├── Taxes — Brakha Group Tax Services
│   ├── Client files and tax-year folders
│   ├── Secure document intake
│   └── Preparation workflow and reminders
├── Work Opportunities
│   ├── Captured offers and source evidence
│   ├── Green / Yellow / Red classification
│   ├── Vehicle, schedule and profitability checks
│   └── Prepare YES → explicit human approval
└── Shared platform services
    ├── Identity, roles and workspace isolation
    ├── Private document vault
    ├── Notifications
    └── Audit, backups and recovery
```

## 4. Brand and scope decisions
- Copiloto remains the platform brand.
- Transport identity: Island City Transit.
- Taxes identity: Brakha Group Tax Services.
- Transitax corporate naming is undecided and deferred.
- No WhatsApp account renaming, number changes or migration during this phase.
- Personal finance management is not a first-phase priority.

## 5. Non-negotiable safety rules
- Synthetic data only during development and testing.
- No real outbound messages, payments or provider activation.
- Human approval required for every outbound message and job acceptance.
- Do not run migrations until repository migration files and database migration history are reconciled.
- Do not touch the legacy finance Supabase project while building the CRM.
- Preserve Transport/Taxes data and permissions separation.
- Never claim mocked or planned integrations are operational.

## 6. Design direction
Professional, calm, premium and practical. Responsive desktop layout with clear navigation; compact mobile navigation with accessible touch targets. Clear workspace identity, readable data hierarchy, useful empty/error/loading states. Final brand identity is deferred until architecture and core workflows are stable.

## 7. Initial implementation sequence
1. Complete source and dependency map for the existing shell.
2. Implement the responsive Copiloto application shell and workspace navigation.
3. Build an executive home with clearly marked synthetic/demo content.
4. Add Communications Center and Work Opportunities workflow shells without live provider connections.
5. Link existing CRM and Taxes screens safely into their workspaces.
6. Add automated tests for new logic and preserve existing tests.
7. Verify preview build, responsive behavior and visual QA.
8. Update this document and `Copiloto → How This Works` after each milestone.

## 8. Starting deployment evidence
At audit time, the latest observed Production deployment was **READY** on commit `f06c1258df1714f3a44a98c1a8b5d8549d635e29`. This is the existing production state, not a deployment of this branch. No phase-one build or preview deployment has yet been run.

## 9. Current status and handoff
- [x] User authorization received.
- [x] Isolated implementation branch created.
- [x] Initial application shell and navigation inspected.
- [x] Starting point and architecture recorded in How This Works.
- [ ] New UI code implemented.
- [ ] Automated tests run for phase-one UI.
- [ ] Preview build and visual QA completed.
- [ ] Continuity folder updated with final phase report.

**Next task:** continue the shell/navigation source map and implement the first responsive Copiloto workspace screen. Do not merge or deploy to Production without explicit approval.
