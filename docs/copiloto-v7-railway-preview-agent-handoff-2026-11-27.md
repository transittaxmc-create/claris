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
The service points at repo `transittaxmc-create/claris`, but branch is null. Latest deployment `db880409-f594-4692-b106-35dbe7ba4380` is SUCCESS for **main**, commit `51cb5217cdb9b938678428b51ea64bc8e1300408`, URL null. This is not the V7 branch preview. Attempt to connect exact feature branch failed with: **User does not have access to the repo**. No V7 public URL exists.

## Required unblock
Grant Railway's GitHub App access to repository `transittaxmc-create/claris` in GitHub Settings → Applications → Installed GitHub Apps / Railway, or reconnect correct GitHub integration. Then connect Railway service to exact branch `feat/copiloto-v7-phase1-foundation`. Verify service source branch and deployment commit SHA before calling it V7.

## Build/test plan
Branch package.json declares pnpm@12.3.4, Next.js 16.3.3, React 19. Scripts include `build`, `start`, `test:crm-push`. Run lockfile install, `pnpm run test:crm-push`, inspect tsconfig and run TypeScript check (likely `pnpm exec tsc --noEmit`), then `pnpm run build`. Inspect actual Railway build/start logs and health. Never claim success without logs/status.

## Visual QA after a real V7 deployment
Test desktop and iPhone responsive UI, main navigation, Communications local draft and NOT SENT approval state, Transport sample records, Taxes checklist, Work Opportunities classifications/missing data/no send, Square demo-only sections, reload, console/network errors, overflow and basic accessibility. Capture evidence and defects.

## Safety / release rules
Synthetic data only. Do not add production Supabase secrets, real customer data, live messaging/payment credentials or production database mutations. No live messages, automatic acceptance, tax filing, Square transactions, or production deployment. Never merge to main without explicit user approval.

## Honest status
Points 4–8 have demo UI, not verified production integrations. Point 3 security/database reconciliation remains open. Points 9–10 remain open pending actual build, tests and visual QA. No V7 Railway deployment, no V7 URL, no verified test run, no visual QA, no production change, no merge.

## Next agent sequence
1. Read §32 in Copiloto → How This Works and docs for points 9–10.
2. Inspect current branch HEAD and latest GitHub Actions run.
3. Resolve Railway GitHub App repo access.
4. Attach Railway to exact feature branch; verify deployed SHA.
5. Run tests/typecheck/build and fix issues on branch.
6. Generate and verify temporary URL.
7. Complete desktop/iPhone QA and capture evidence.
8. Update §32 and docs with commit/deployment state, URL, push registration status and notification test status.
9. Prepare PR/review; wait for explicit merge approval.

## Documentation commit
The durable How This Works update is being committed in this branch. Verify by fetching `components/copiloto/how-it-works-screen.tsx` and confirming §32 and the index entry before relying on it.
