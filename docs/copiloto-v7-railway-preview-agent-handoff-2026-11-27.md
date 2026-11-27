# Copiloto V7 — Railway preview and session handoff

**Updated:** 2026-11-27  
**Repository:** [transittaxmc-create/claris](https://github.com/transittaxmc-create/claris)  
**Branch:** `feat/copiloto-v7-phase1-foundation`  
**Manual:** [Copiloto → How This Works](../components/copiloto/how-it-works-screen.tsx), §32.

## User's explicit continuity requirement
Miguel requests that all work in this session be documented in Copiloto → How This Works so another agent can resume if this session times out or becomes unavailable. Do not ask him to repeat known project context. Read §32 and the linked sections/reports first. No background work is implied after a session ends.

## Goal
Use Railway only as a temporary V7 review environment. Preserve original Claris Vercel app. Later transfer reviewed work into original app only after explicit approval. No production merge/deploy without separate approval.

## Exact resources
- GitHub repo: `transittaxmc-create/claris` (currently public; recommend private before confidential code/secrets, but do not change without approval).
- Branch: `feat/copiloto-v7-phase1-foundation`
- Branch: https://github.com/transittaxmc-create/claris/tree/feat/copiloto-v7-phase1-foundation
- Compare: https://github.com/transittaxmc-create/claris/compare/main...feat/copiloto-v7-phase1-foundation
- Railway project: `copiloto-v7-temporal`, ID `a27e9703-8ee8-4650-ac57-c966a7301ca1`
- Railway environment: `review`, ID `6b472376-3905-42d1-9e5b-58321f8caf12`
- Railway service: `copiloto-v7-preview`, ID `cd3e119a-0a24-4412-adc0-a0ae56f1e893`

## Verified current Railway state
**Authorization resolved:** Miguel confirmed GitHub authorization was completed. Railway `connect_service_source` now succeeds. Service source is repo `transittaxmc-create/claris`, branch `feat/copiloto-v7-phase1-foundation`, follows branch (commitSha null). The earlier **User does not have access to the repo** error is resolved.

**Current V7 deployment:** `6c2ac0c8-725b-489c-ae86-a654bea2c3fd`, branch `feat/copiloto-v7-phase1-foundation`, commit `faf2350ffcc3e4e5166fa4f64d1d12671d09924a`. Last observed status: **BUILDING**. The older `db880409-f594-4692-b106-35dbe7ba4380` SUCCESS on `main` remains historical and is not the V7 preview. No URL/domains yet.

## Required unblock
Grant Railway's GitHub App access to repository `transittaxmc-create/claris` in GitHub Settings → Applications → Installed GitHub Apps / Railway, or reconnect correct GitHub integration. Then connect Railway service to exact branch `feat/copiloto-v7-phase1-foundation`. Verify service source branch and deployment commit SHA before calling it V7.

## Build/test plan
Branch package.json declares pnpm@12.3.4, Next.js 16.3.3, React 19. Railway Railpack detected Node 26.13.1/pnpm 12.3.4 and ran `pnpm install --frozen-lockfile --prefer-offline`, `pnpm run build`, with start command `pnpm run start`. Logs confirm install completed, Next.js production compilation succeeded and static generation completed 10/10. Next explicitly said **Skipping validation of types**; this is not a TypeScript pass. Deployment remains BUILDING at last check; no runtime/deploy logs, URL or domains. Run `pnpm run test:crm-push` and `pnpm exec tsc --noEmit` independently after deployment settles, then verify runtime health. Never claim success without status/log evidence.

## Visual QA after a real V7 deployment
Test desktop and iPhone responsive UI, main navigation, Communications local draft and NOT SENT approval state, Transport sample records, Taxes checklist, Work Opportunities classifications/missing data/no send, Square demo-only sections, reload, console/network errors, overflow and basic accessibility. Capture evidence and defects.

## Safety / release rules
Synthetic data only. Do not add production Supabase secrets, real customer data, live messaging/payment credentials or production database mutations. No live messages, automatic acceptance, tax filing, Square transactions, or production deployment. Never merge to main without explicit user approval.

## Honest status
Points 4–8 have demo UI, not verified production integrations. Point 3 security/database reconciliation remains open. Points 9–10 remain open. V7 branch deployment is BUILDING (not READY/SUCCESS); Next compilation/static generation succeeded, but types were skipped and dedicated tests/typecheck are pending. No V7 URL, runtime health, visual QA, push registration or notification test verified. No production change, no merge.

## Next agent sequence
1. Read §32 in Copiloto → How This Works and docs for points 9–10.
2. Inspect current branch HEAD and latest GitHub Actions run.
3. Authorization is now resolved; confirm Railway source remains attached to exact feature branch.
4. Recheck deployment `6c2ac0c8-725b-489c-ae86-a654bea2c3fd` until terminal status and verify deployed SHA.
5. Run `pnpm run test:crm-push` and `pnpm exec tsc --noEmit`; fix failures on branch and document each result.
6. After successful deploy and safe config, generate and verify temporary URL.
7. Complete desktop/iPhone QA and capture evidence.
8. Update §32 and docs with commit/deployment state, URL, push registration status and notification test status.
9. Prepare PR/review; wait for explicit merge approval.

## Documentation commit
The durable How This Works update is being committed in this branch. Verify by fetching `components/copiloto/how-it-works-screen.tsx` and confirming §32 and the index entry before relying on it.
