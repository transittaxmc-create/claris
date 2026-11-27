# Copiloto V7 — First Preview Workspace
Date: 2026-11-27
Branch: `feat/copiloto-v7-phase1-foundation`
Route: `/copiloto-v7-preview`

## Implemented
- Responsive desktop sidebar and mobile bottom navigation.
- Copiloto overview dashboard with sample operational metrics.
- Workspace entry points: Transport, Taxes, Work Opportunities, Communications, Clients, Documents.
- Searchable navigation.
- Sample priority inbox/activity feed.
- Work Opportunities sample queue with green/yellow review states and a local-only follow-up toggle.
- Create-new workspace chooser.
- Private-workspace and human-approval design cues.

## Safety and data
All displayed figures, messages, clients/work items are synthetic examples. This page is not connected to CRM Supabase, production records, WhatsApp, SMS, Square, payment processing, or any provider. No outbound messages or job acceptances can occur. Do not enter real client/tax information into this preview.

## Architecture
The new route is isolated from `app/page.tsx`, which continues to render the existing CopilotoApp. No production root route replacement and no database changes were made.

## Not implemented yet
Authentication/authorization for this route, persistent storage, live Transport and Taxes workflows, real CRM/client/document data, message connectors, OCR, notifications, opportunity ingestion/parser/scoring, audit persistence, and provider integrations.

## Verification status
Source has been committed to the feature branch. A build, Vercel Preview deployment, browser rendering, mobile/desktop QA, and automated interaction tests remain pending until verified. Production is unchanged.
