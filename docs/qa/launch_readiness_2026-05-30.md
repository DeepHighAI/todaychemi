# Launch Readiness Audit - 2026-05-30

> 기준일: 2026-05-30 KST. 목적: Vercel 배포와 유료 부적 결제까지 실제 오픈 가능한지 현재 상태를 증거 기반으로 점검한다.

## 판정

**오픈 보류.**

로컬 품질 검증, Supabase live migration/RLS, pay-per-use payment/token ledger, billing policy, LLM boundary/resilience, supply-chain remediation, and local/mocked E2E coverage are now passing. 다만 통합 launch readiness gate는 여전히 실패한다. 남은 실패는 Vercel project/env, production origin, Auth dashboard/provider, OpenAI ZDR project env, Toss live keys/dashboard, Sentry/operations env처럼 외부 설정과 production smoke evidence가 필요한 항목이다.

## 2026-05-31 Approved Work Update

- D1 approved/applied: `20260530090000_toss_v2_payment_hardening.sql` was pushed to canonical Supabase project `jamhkucluhiibqpjsiov`.
- D2 approved/applied: `20260531013539_protected_rpc_security_hardening.sql` was created and pushed to the same project.
- Supabase dry-run after apply: `pnpm dlx supabase db push --dry-run --linked` reports `Remote database is up to date`.
- Payment DB readiness: `pnpm verify:payment-readiness` now passes; remote `payments` includes `toss_customer_key`.
- Protected RPC security readiness: `pnpm verify:supabase-security-readiness` passes.
- Live function privilege check: `anon_execute=false`, `authenticated_execute=false`, `service_role_execute=true` for active protected RPCs including `confirm_feature_payment`, `deduct_tokens`, `deduct_tokens_once`, `refund_tokens`, `refund_tokens_once`, `award_free_talisman_session_rewards`, `award_hapcard_share_reward`, `match_classics`, and `purge_deleted_users`. Legacy `confirm_token_purchase` is dropped by the pay-per-use migration.
- Live function setting check: active protected RPCs have `search_path=public`.
- Supabase security advisor after D2 no longer reports protected RPC public execution findings. Remaining advisor items are existing INFO/WARN findings: service-role-only RLS tables with no policies, `vector` extension in `public`, and leaked password protection disabled.
- D3/D4 approved/applied on 2026-05-31 for token products, then superseded by the approved pay-per-use branch on 2026-06-01/03: hapcard/whatif/replay use free-token spend/refund/idempotency when balance exists, and insufficient balance opens one-time Toss feature payment without `purchase` ledger credit.
- D6/D7 approved/applied: production requires `OPENAI_PROJECT_ID`; the OpenAI client passes `project`; Claude fallback, OpenAI circuit breaker, and `LLM_DAILY_BUDGET_USD` runtime budget enforcement are implemented.
- D8 approved/applied: `next`/`eslint-config-next` updated to `16.2.6`, `@sentry/nextjs` updated to `10.55.0`, `shadcn` moved to `devDependencies`, and `fast-uri` override `3.1.2` added.
- P0-09 validation update: focused `/cso` security validation and focused `/qa` payment/E2E validation were re-run on 2026-05-31 after payment/security DB changes. Local TypeScript, lint, unit test, production build, Supabase dry-run, security, payment, LLM boundary, E2E coverage, public E2E, and authenticated E2E gates pass.
- Integrated launch gate now fails only on: launch env, Auth readiness, OpenAI/ZDR readiness, Toss live readiness, Vercel readiness, Operations/E2E readiness, and External settings checklist readiness.

## 2026-06-01 Continuation Update

- `pnpm verify:launch-env` still fails on the same 10 missing launch keys: `NEXT_PUBLIC_APP_URL`, `OPENAI_PROJECT_ID`, Toss live keys, Kakao keys, `LLM_DAILY_BUDGET_USD`, `ANTHROPIC_API_KEY`, and Sentry DSNs.
- Vercel connector check: team `deephigh` is visible, but only project `3eyes` is visible; no SAJU/TWODAY launch project is linked or discoverable. `.vercel/project.json` is still absent locally.
- Supabase connector check: canonical project `jamhkucluhiibqpjsiov` / `twoday` is `ACTIVE_HEALTHY`; remote migrations include `20260531013539_protected_rpc_security_hardening` and `20260531031246_token_spend_idempotency`.
- Supabase security advisor still reports remaining non-RPC items: service-role-only RLS tables with no policies (INFO), `vector` extension in `public` (WARN), and leaked password protection disabled (WARN). The leaked-password item remains a P0 Auth dashboard action before public launch.
- Launch evidence hardening now requires generated evidence to reference its `Source summary JSON`; `pnpm verify:launch-evidence-readiness` and `pnpm verify:launch-waiting-state` pass against the latest local summary/evidence pair.
- MVP launch will not use a custom domain yet. The canonical launch URL is the fixed Vercel Production `*.vercel.app` origin; later custom-domain purchase requires updating Vercel, Supabase Auth, Toss, Kakao, and Google settings together.
- Added a Korean, secret-free external settings checklist at `docs/qa/external_settings_checklist.md` plus `pnpm verify:external-settings-checklist`. It currently fails as expected until the operator replaces the remaining `TBD` status cells after dashboard setup.
- Google/Kakao OAuth runbooks now align with the same MVP production origin policy and record only secret-free dashboard evidence; `pnpm verify:launch-audit-readiness` checks both runbooks.
- The external settings checklist verifier now rejects `TBD`, `FAIL`, arbitrary status values such as `DONE`, and placeholder `N/A` reasons in status cells; only `OK`, `PASS`, or `N/A(구체적 사유)` are accepted. Instructional `TBD` prose is allowed, but completed rows with `TBD`/placeholder evidence still fail. Any table with `Result`, `Production`, or `Preview` status columns must also include `Evidence` or `Notes`.
- Checklist verifier findings now include the row item/key context beside the line number, so operators can fill the remaining dashboard/env rows without cross-referencing the Markdown table manually.
- Completed checklist rows now also require real secret-free evidence in `Evidence` or legacy `Notes` cells; leaving guide placeholders such as `origin only`, `checked`, or `presence only` fails `pnpm verify:external-settings-checklist`.
- `pnpm verify:external-settings-readiness` now includes `verify:external-settings-checklist`, so the fast external preflight catches missing operator evidence as well as dashboard/env blockers.
- `scripts/README.md` was synced to the same external-settings preflight scope, and `pnpm verify:launch-audit-readiness` now checks that script catalog wording does not drift back to the older six-gate-only description.
- `pnpm verify:launch-readiness` now includes `verify:external-settings-checklist` as a required gate, so a launch summary cannot pass while operator dashboard evidence is still `TBD`.
- `pnpm verify:launch-evidence-readiness` now requires the external settings checklist to be included when evidence is manually elevated to `서비스 오픈 가능`; it also rejects checklist status-cell `TBD`, `FAIL`, missing evidence columns, and placeholder evidence cells for service-open decisions while allowing instructional checklist prose.
- `pnpm verify:launch-evidence-readiness` now also requires `조건부 가능` evidence to be Production evidence with the matching launch summary JSON, completed external settings checklist input, dashboard/smoke/payment/monitoring/canary sections, and `Reason`, `Known risks accepted`, `Rollback trigger`, `Next review time`, so a PASS summary cannot be promoted to conditional launch without explicit operational, risk, and rollback evidence.
- OpenAI project choice remains a manual decision (`Default project` vs `AnythingLLM` vs a new production project). External evidence must record only the selected project name plus `proj_` prefix, not the full project id; `pnpm verify:launch-evidence-readiness` now rejects pasted full `proj_...` ids in launch/checklist artifacts.
- Secret-free launch evidence scanning now also rejects pasted Sentry DSN URLs, JWT-like token values, standalone email addresses, and birth-date-like values near `birth`/`dob`/`생년월일` context even when they are not written as explicit env/PII assignments.
- `pnpm verify:launch-audit-readiness` now also requires the external checklist placeholder-catalog sync test, so future checklist wording changes cannot silently drift away from the two launch verifiers.
- `pnpm verify:external-settings-readiness` now prints the Korean external settings guide, checklist, no-custom-domain MVP instruction, and launch evidence template paths directly in its next-step output. `pnpm verify:external-settings-checklist` also groups unresolved checklist rows by dashboard/setup section before listing line-level findings.
- `pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app` now gives operators a secret-free preflight for the MVP production origin and prints the derived Supabase/Auth/OAuth/Toss dashboard URLs before they paste settings into provider consoles.
- `pnpm print:vercel-env-plan` now prints the Vercel Production/Preview env key plan and launch-only unset legacy alias list without printing secret values.
- `pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app` now prints the full Korean dashboard setup order across Vercel, Supabase Auth, Google/Kakao, OpenAI/Anthropic, Toss, Sentry, and final evidence commands.
- `pnpm vitest run` is now stabilized for the full launch suite by limiting Vitest to 4 workers. This keeps Windows/jsdom cold-start worker creation from failing before assertions run; the exact required command now passes again. The integrated launch gate unit-test timeout is 720s so a successful but cold Windows/jsdom run is not falsely marked timed out.
- Launch evidence now separates automated feature-token refunds from manual Toss monetary refund/cancel operations. MVP still excludes Toss refund automation, so production evidence must record the manual dashboard owner and either a low-value refund/cancel drill or an explicit deferral reason.
- Launch runbook command examples now use `pnpm verify:launch-evidence-readiness <json> <md> docs/qa/external_settings_checklist.md` for positional evidence files; `--` remains reserved for commands that pass option flags such as `--summary-json`.
- Preview/Production E2E smoke commands now use shell-neutral `pnpm e2e -- --base-url <url>` and `pnpm e2e:auth -- --base-url <url>` instead of bash-only `PLAYWRIGHT_BASE_URL=<url> pnpm ...` assignments, so the runbook works directly in PowerShell.
- The E2E runner now validates `--base-url` as an absolute `http(s)` origin with no path/query/hash/credentials before launching Playwright, preventing accidental `/login` or preview-path smoke targets.

## 2026-06-02 Pay-per-use Continuation Update

- Current branch `feature/pay-per-use-billing` supersedes the old token-pack purchase route for this launch branch: paid feature unlocks now use `/api/payments/feature/init`, `/api/payments/feature/confirm`, `FeaturePaySheet`, and `/payments/fail`; the deleted `/payments/charge` flow is no longer required by launch gates.
- Billing policy readiness now checks feature prices directly: hapcard create `800 KRW` / free-token cost `8`, whatif `500 KRW` / cost `5`, and replay `400 KRW` / cost `4`. Existing free-token spend/refund/idempotency behavior remains required when the user has balance.
- Supabase payment readiness now verifies the pay-per-use DB surface: `payments.charge_type`, `payments.feature_id`, `payments.feature_ref`, and `toss_customer_key`, plus token ledger compatibility. `pnpm db:push:dry` confirms the remote database is up to date, including `20260601000000_feature_pay_per_use.sql`.
- Toss live readiness now checks the feature-confirm callback origin and the canonical success URL `/api/payments/feature/confirm` plus fail URL `/payments/fail`.
- Public/auth E2E and static E2E coverage now reflect pay-per-use: unauthenticated feature init returns 401, the fail page has safe recovery links, authenticated smoke confirms there is no legacy charge button, and paid coverage tracks feature init/fail/unlock/refund idempotency instead of token pack charge/success.
- Latest integrated launch gate was re-run on 2026-06-02 with `pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-05-31_local.json`. All local/code/security/payment/LLM/supply-chain/E2E gates passed; required failures remain exactly: launch env, External settings checklist readiness, Auth readiness, OpenAI/ZDR readiness, Toss live readiness, Vercel readiness, Operations/E2E readiness.

## 2026-06-03 Security/Evidence Update

- Supabase RPC security readiness now checks the active pay-per-use `confirm_feature_payment` RPC and verifies legacy `confirm_token_purchase` is dropped by `20260601000000_feature_pay_per_use.sql`.
- `src/types/database.types.ts` no longer exposes the dropped `confirm_token_purchase` RPC, reducing the chance of future source code accidentally calling a removed token-pack function.
- Launch evidence templates now record paid feature payment success with `toss_order_id/feature_ref` and feature unlock evidence, not token-purchase ledger credit.
- Latest integrated launch gate was re-run on 2026-06-03 KST. It completed all 25 gates, timed out on none, and still fails only on the known external setup/evidence items.
- Vercel connector re-check: team `deephigh` is accessible, but its project list still contains only `3eyes`; no SAJU/TWODAY launch project or environment evidence exists yet.
- Supabase connector re-check: canonical project `jamhkucluhiibqpjsiov` / `twoday` is `ACTIVE_HEALTHY`, project URL is `https://jamhkucluhiibqpjsiov.supabase.co`, and remote migrations include `20260601000000_feature_pay_per_use`.
- Supabase security advisor re-check: protected RPC public execution findings remain absent. Remaining non-P0 advisor items are `rls_enabled_no_policy` INFO for `anon_requests`, `banned_phrase_hits`, `legal_consents`, `llm_cost_tracking`; `extension_in_public` WARN for `vector`; and `auth_leaked_password_protection` WARN, which remains a P0 Auth dashboard action before public launch.
- Supabase performance advisor re-check: P1/P2 performance debt remains. Current lints include 7 unindexed FK INFO findings (`banned_phrase_hits`, `daily_haps`, `hapcard_score_snapshots`, `hapcard_share_rewards` x2, `hapcard_shares`, `hapcards`), 21 Auth RLS initplan WARN findings, and 21 unused-index INFO findings. Any index/RLS policy remediation is a DB/RLS change and requires AGENTS.md Section 1.1 approval before implementation.

## 2026-06-04 Payment Spec Drift Guard Update

- Payment launch checklist now uses the active pay-per-use confirm route `/api/payments/feature/confirm` for server-side stored amount verification. The stale token-charge checklist entry for `/api/payments/confirm` has been removed.
- `pnpm verify:payment-readiness` now checks `docs/specs/payments.md` and fails if the stale token-charge confirm checklist returns, so future launch evidence cannot accidentally ask the operator to verify the deleted route.
- Re-run 2026-06-04 KST: `pnpm vitest run tests/scripts/verify-payment-readiness.test.ts`, `pnpm verify:payment-readiness`, `pnpm verify:payment-flow-readiness`, `pnpm tsc --noEmit`, `pnpm lint`, and the full `pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-05-31_local.json` pass all local/code/payment/LLM/Supabase/E2E gates. Required failures remain only the known external setup/evidence gates.
- External settings guide now explicitly separates Vercel dashboard env setup from full launch gate env injection. `pnpm verify:launch-readiness` must run from a local shell, CI job, or validation environment with production-equivalent env values loaded; Vercel dashboard values are not automatically available to the local terminal. `pnpm print:launch-dashboard-plan` and `pnpm verify:external-settings-checklist` now print this warning.
- Vercel connector re-check on 2026-06-04 KST still shows only project `3eyes` under team `deephigh`; no SAJU/TWODAY launch project exists yet.
- Supabase connector re-check on 2026-06-04 KST confirms canonical project `jamhkucluhiibqpjsiov` / `twoday` is `ACTIVE_HEALTHY`, and remote migrations include `20260601000000_feature_pay_per_use`. Security advisors still have no protected RPC public-execute finding; remaining P0 dashboard item is leaked password protection. Performance advisor debt remains P1/P2 and requires DB/RLS/index approval before remediation.

## 확인한 현재 상태

- Git: branch `feature/pay-per-use-billing`, HEAD `98fcc61 refactor(payments): remove token-charge code path (Phase 6)`, dirty worktree contains readiness script/test/doc/evidence updates.
- Vercel: connector re-check confirms team `deephigh` contains only project `3eyes`. TWODAY/SAJU/Happle launch project and env are not present.
- Domain: no custom domain for MVP. Use the fixed Vercel Production `*.vercel.app` origin as `NEXT_PUBLIC_APP_URL`; do not use Preview, deployment-hash, localhost, or a path URL for launch settings.
- Supabase: connector re-check confirms canonical project `jamhkucluhiibqpjsiov` / name `twoday` / region `ap-northeast-2` / `ACTIVE_HEALTHY`.
- Supabase migrations: remote is up to date after applying `20260530090000_toss_v2_payment_hardening.sql`, `20260531013539_protected_rpc_security_hardening.sql`, token spend idempotency, and `20260601000000_feature_pay_per_use.sql`.
- Payment code: pay-per-use feature billing is on branch `feature/pay-per-use-billing`: `/api/payments/feature/init`, `/api/payments/feature/confirm`, in-view `FeaturePaySheet`, and `/payments/fail` exist. Legacy token-charge routes/pages are removed.
- Current paid gates: hapcard create deducts 8 tokens, replay deducts 4 tokens, and whatif deducts 5 tokens; all three refund on post-charge generation failure through idempotent token ledger RPCs.
- Whatif Hanja feedback: current Whatif UI components call `convertHanja()` for hero body, numbered list, keywords, and citations.
- Env catalog: `.env.example` and `docs/specs/secrets.md` now use `KASI_SERVICE_KEY`, matching current route handlers and scripts.
- Toss confirm idempotency: confirm API now sends a deterministic `Idempotency-Key` derived from `orderId` and a SHA-256 hash of `paymentKey`, so duplicate callbacks/retries reuse the same provider-level key without exposing the raw payment key.
- Open questions authority: memory `project_open_questions.md` restored with R1-R8 launch-blocking approval questions.
- Documentation sync: `AGENTS.md`, `tech_stack.md`, `fluttering-gathering-island.md`, `docs/README.md`, launch-critical specs/runbooks, and source LLM boundary comments now reflect Next.js 16.2.6, OpenAI ZDR project routing, Claude fallback, LLM budget enforcement, and the approved billing policy.

## Implementation Summary and Changed Files

This audit produced launch-readiness implementation, verification, and evidence work across these areas:

| Area | Completed work | Primary files |
|---|---|---|
| Billing/payment/token ledger | Pay-per-use feature billing is current on `feature/pay-per-use-billing`: hapcard/whatif/replay use free-token spend/refund/idempotency when balance exists, and show in-view Toss payment when balance is insufficient. | `src/app/api/hapcards/route.ts`, `src/app/api/hapcards/[id]/replay/route.ts`, `src/app/api/whatif/[type]/route.ts`, `src/app/api/payments/feature/init/route.ts`, `src/app/api/payments/feature/confirm/route.ts`, `src/components/payments/feature-pay-sheet.tsx`, `src/lib/payments/feature-prices.ts`, `src/lib/payments/toss-server.ts` |
| Supabase payment/security | Payment hardening and protected RPC migrations applied and verified against canonical Supabase project. | `supabase/migrations/20260531013539_protected_rpc_security_hardening.sql`, `supabase/migrations/20260531031246_token_spend_idempotency.sql`, `src/types/database.types.ts`, `scripts/verify-payment-readiness.ts`, `scripts/verify-supabase-security-readiness.ts` |
| OpenAI/ZDR and LLM resilience | Production OpenAI project routing, legacy factory re-export alignment, `store:false` boundary checks, Claude fallback, OpenAI circuit breaker, cost tracking, daily budget enforcement, and cost-tracking write-failure handling implemented. | `src/lib/llm/clients.ts`, `src/lib/llm/openai.ts`, `src/lib/llm/anthropic.ts`, `src/lib/llm/budget.ts`, `src/lib/llm/circuit-breaker.ts`, `src/lib/llm/cost.ts`, `tests/lib/llm/clients.test.ts`, `tests/lib/llm/openai.test.ts` |
| Env/secret boundaries | Launch env catalog and client/server secret boundary checks added. | `.env.example`, `docs/specs/secrets.md`, `src/lib/supabase/env.ts`, `src/lib/supabase/service-role-env.ts`, `src/lib/supabase/service-role.ts`, `scripts/verify-launch-env.ts`, `scripts/verify-secret-boundary-readiness.ts` |
| E2E/readiness automation | Playwright public/auth smoke, core-flow coverage scanner, integrated launch gate, evidence generator, and evidence secret/PII scanner added. | `playwright.config.ts`, `tests/e2e/*`, `scripts/run-e2e.ts`, `scripts/verify-e2e-coverage-readiness.ts`, `scripts/verify-launch-readiness.ts`, `scripts/create-launch-evidence.ts`, `scripts/verify-launch-evidence-readiness.ts`, `tests/scripts/*.test.ts` |
| Operations/runbooks | Launch opening runbook, external settings guide, OAuth/share runbooks, external settings checklist, P0 approval packet, local evidence snapshot, launch audit artifact gate, and audit backlog created. | `docs/runbooks/launch_opening.md`, `docs/runbooks/external_launch_settings.md`, `docs/runbooks/google_oauth.md`, `docs/runbooks/kakao_oauth_share.md`, `docs/qa/external_settings_checklist.md`, `docs/qa/launch_p0_approval_packet.md`, `docs/qa/launch_evidence_template.md`, `docs/qa/launch_gate_2026-05-31_local.json`, `docs/qa/launch_evidence_2026-05-31_local.md`, `scripts/verify-external-settings-checklist.ts`, `scripts/verify-launch-audit-readiness.ts` |
| Supply chain | Approved dependency remediation applied and high/critical production advisory gate added. | `package.json`, `pnpm-lock.yaml`, `scripts/verify-supply-chain-readiness.ts`, `docs/qa/launch_readiness_2026-05-30.md` |

## Validation Run

| Check | Result | Notes |
|---|---:|---|
| `pnpm tsc --noEmit` | PASS | Added `tsc` pass-through script so the exact command works on this pnpm/Windows setup. |
| `pnpm lint` | PASS | 0 errors. |
| `pnpm vitest run` | PASS | Latest full-suite run inside the 2026-06-04 KST integrated gate: 258 files / 1997 tests in 625.30s; gate duration 628.7s. `vitest.config.ts` caps the full launch suite at 4 workers to avoid Windows/jsdom cold-start worker startup failures while preserving parallel execution. |
| `pnpm test -- tests/lib/payments tests/app/api/payments tests/app/payments` | PASS | 11 files / 45 tests. Payment-focused `/qa` regression scope for Toss confirm/idempotency change. |
| `pnpm verify:payment-flow-readiness` | PASS | Pay-per-use source invariants plus focused tests for feature prices/env/provider idempotency, feature init/confirm/complete, feature pay sheet/fail/wallet, and hapcard/whatif/replay paid gates, unlocks, ownership, cash limits, and idempotent refund paths. |
| `pnpm verify:toss-live-readiness` | FAIL | Expected launch-readiness failure: payment redirect source invariants pass, but `NEXT_PUBLIC_APP_URL`, `TOSS_CLIENT_KEY=live_ck_*`, and `TOSS_SECRET_KEY=live_sk_*` are not configured locally. Legacy `TOSS_PAYMENTS_*` aliases must also be unset for launch. Values are never printed. |
| `pnpm verify:billing-policy-readiness` | PASS | Pay-per-use feature pricing is canonical on the current branch: hapcard create 800 KRW / cost 8, whatif 500 KRW / cost 5, replay 400 KRW / cost 4. Free-token spend/refund/idempotency and cache-hit no-charge evidence remain required. |
| `pnpm verify:db-rls-readiness` | PASS | Static migration/RLS checks plus DB contract tests and live Supabase RLS integration. Live RLS: 1 file / 51 tests. Does not cover SECURITY DEFINER RPC exposure. |
| `pnpm build` | PASS | Re-run inside the 2026-06-04 KST integrated gate with Next.js 16.2.6 production build. Warning: Edge runtime disables static generation for one page class. |
| `pnpm e2e` | PASS | Re-run 2026-06-04 KST: Playwright desktop/mobile public smoke 14/14. Covers unauth start/login, signup/legal render, guest onboarding to today view, unauthenticated feature init 401, invalid auth callback safety, unauth `/api/me` 401, public OG share missing-token 404, custom 404 page safety, and pay-per-use payment fail UX. |
| `pnpm e2e:auth` | PASS | Re-run 2026-06-04 KST: seeded email login and authenticated core app smoke pass desktop/mobile 4/4. Covers signup page render, email login redirect, `/api/me`, `/api/me/wallet`, relation create, feed, me wallet, hapcard replay, whatif, absence of the legacy charge button, payment fail UX, and mocked 500 response. |
| `pnpm verify:e2e-coverage-readiness` | PASS | Static coverage gate now finds launch-critical Playwright coverage for public shell, signup/login, onboarding, relation create, feed, hapcard, replay, whatif, today, me, pay-per-use feature init/fail/unlock/refund idempotency, OG/share/401/404, payment internal-error UX, and 500 path. This is local/mocked coverage; live preview/production smoke remains required. |
| `pnpm verify:launch-env` | FAIL | Expected launch-readiness failure: 10 required local/prod env keys missing. Values are never printed. `ANTHROPIC_API_KEY` is required because Claude fallback is part of launch LLM resilience; Sentry DSNs are required because operations readiness is launch-blocking. Catalog drift checks now pass for `.env.example` and `docs/specs/secrets.md`; value shape checks cover pure production origin, `OPENAI_PROJECT_ID`, Toss live prefixes, positive LLM budget, and Toss legacy aliases. |
| `pnpm verify:secret-boundary-readiness` | PASS | Scans `NEXT_PUBLIC_*` naming and Client Component import graphs. Server-only launch secrets are not reachable from 102 client roots / 139 reachable source files. |
| `pnpm verify:launch-audit-readiness` | PASS | Verifies final launch audit/backlog/approval/manual-settings/evidence/runbook artifacts, package readiness scripts, OAuth runbooks, and the scripts catalog entry for external-settings readiness. |
| `pnpm verify:launch-readiness` | FAIL | Re-run 2026-06-04 KST. Integrated gate runner includes 25 required gates. PASS: secret/public env boundary, launch audit artifact readiness, TypeScript, lint, unit tests, production build, LLM/score boundary, LLM resilience, payment DB, payment flow, billing policy, DB/RLS, Supabase migration dry-run, Supabase RPC security, Supply-chain, Public E2E, Auth E2E, and Core E2E coverage. FAIL remains only on external setup/evidence: launch env, External settings checklist readiness, Auth readiness, OpenAI/ZDR readiness, Toss live readiness, Vercel readiness, Operations/E2E readiness. No gate timed out. |
| `pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-05-31_local.json` | FAIL | Re-run 2026-06-04 KST. Local evidence snapshot regenerated from summary `generatedAt=2026-06-04T05:57:49.790Z` UTC. Unit suite timeout is 720s and passed 1997 tests without timeout. Required failures remain exactly: launch env, External settings checklist readiness, Auth readiness, OpenAI/ZDR readiness, Toss live readiness, Vercel readiness, Operations/E2E readiness. |
| `pnpm verify:external-settings-readiness` | FAIL | Re-run 2026-06-01. This focused helper runs `verify:launch-env`, `verify:auth-readiness`, `verify:openai-readiness`, `verify:toss-live-readiness`, `verify:vercel-readiness`, `verify:ops-readiness`, and `verify:external-settings-checklist`; all seven fail until Vercel project/env, Supabase Auth dashboard, OpenAI/ZDR, Toss live, Sentry/operations, and checklist evidence are complete. |
| `pnpm verify:external-settings-checklist` | FAIL | Expected operator-checklist failure. The checklist structure, commands, status cells, evidence cells, and secret/PII scan are enforced, but `docs/qa/external_settings_checklist.md` still contains `TBD` status cells until external dashboard work is completed. |
| `pnpm verify:launch-waiting-state -- --summary-json docs/qa/launch_gate_2026-05-31_local.json --evidence docs/qa/launch_evidence_2026-05-31_local.md` | PASS | Lightweight check for the current external-settings waiting state: summary/evidence consistency, exact required-failure rows, known external blockers, launch audit artifacts, and secret-free evidence all pass. This does not replace the full launch readiness gate. |
| `pnpm verify:known-external-blockers -- --summary-json docs/qa/launch_gate_2026-05-31_local.json` | PASS | Confirms the latest launch summary is blocked only by the known external dashboard/env/checklist evidence work and still includes every launch-required gate result. This does not change Go/No-Go; production open still requires `pnpm verify:launch-readiness` PASS and production smoke evidence. |
| `pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_2026-05-31_local.json --out docs/qa/launch_evidence_2026-05-31_local.md --environment Local` | PASS | Re-run 2026-06-04 KST. Regenerated secret-free local launch evidence Markdown with Go/No-Go = `오픈 보류`, environment = `Local`, and domain/operator intentionally `TBD`. |
| `pnpm verify:launch-evidence-readiness` | PASS | Current local launch gate JSON, evidence Markdown, and external settings checklist contain no detected secret values, full OpenAI project ids, standalone email addresses, or birth-date-like raw PII evidence. `서비스 오픈 가능` evidence is additionally gated on Production environment, PASS launch summary, no `TBD`, dashboard/smoke/payment ledger/monitoring/canary sections, non-empty decision fields, and completed external settings checklist evidence. |
| `pnpm vitest run tests/scripts/verify-launch-evidence-readiness.test.ts tests/scripts/create-launch-evidence.test.ts` | PASS | 2 files / 20 tests. Covers safe evidence prose, secret/raw-PII/full-project-id detections, missing artifact detection, generated evidence Go/No-Go structure checks, required operational evidence sections for service-open decisions, checklist inclusion/completion for service-open decisions, and Go/No-Go evidence rendering. |
| `pnpm vitest run tests/scripts/verify-external-settings-checklist.test.ts tests/scripts/verify-launch-evidence-readiness.test.ts tests/scripts/create-launch-evidence.test.ts` | PASS | 3 files / 37 tests. Covers the external checklist completion gate, status-cell `TBD`/`FAIL`/invalid status rejection, instructional `TBD` prose allowance, placeholder `N/A` reason rejection, missing evidence column rejection, placeholder evidence rejection for status and env rows, current template placeholder catalog sync across both launch verifiers, secret detection in checklist prose, launch evidence scanner regressions, and Go/No-Go evidence rendering. |
| `pnpm vitest run tests/scripts/verify-launch-audit-readiness.test.ts tests/scripts/verify-external-settings-readiness.test.ts` | PASS | 2 files / 3 tests. Locks the launch artifact audit and the focused external-settings preflight command list, including the checklist evidence gate. |
| `pnpm vitest run tests/scripts/verify-launch-audit-readiness.test.ts tests/scripts/verify-launch-readiness.test.ts tests/scripts/verify-launch-evidence-readiness.test.ts tests/scripts/create-launch-evidence.test.ts` | PASS | 4 files / 26 tests. Locks integrated launch gate coverage for launch audit artifacts, external settings checklist evidence, TypeScript, lint, unit suite, production build, Supabase dry-run, Public E2E, Auth E2E, and secret-free summary metadata. |
| `pnpm vitest run tests/scripts/verify-launch-readiness.test.ts tests/scripts/verify-known-external-blockers.test.ts tests/scripts/verify-launch-audit-readiness.test.ts` | PASS | 3 files / 9 tests. Locks the new required checklist gate, known external blocker set, required gate coverage, and launch artifact audit wiring. |
| `pnpm verify:auth-readiness` | FAIL | Focused Auth tests pass 6 files / 43 tests, but production origin, Kakao env, and dashboard provider/redirect checks remain incomplete. |
| `pnpm verify:llm-boundary-readiness` | PASS | Static invariants + focused tests for PII minimization, `store:false`, score leakage blocking, deterministic scoring, and LLM cost-tracking write-failure coverage. Focused tests: 7 files / 149 tests. |
| `pnpm verify:llm-resilience-readiness` | PASS | OpenAI retry/timeout/error UX, Claude fallback, OpenAI circuit breaker, runtime LLM daily budget enforcement, and cost-tracking write-failure handling are implemented and covered by 9 files / 119 focused tests. |
| `pnpm verify:openai-readiness` | FAIL | Expected launch-readiness failure: `OPENAI_PROJECT_ID` is missing locally and production ZDR project status must be confirmed. Main client reads/passes `project`, `OPENAI_PROJECT_ID` must use `proj_*` format, legacy factory export uses the canonical project-routed client, and storage disable/PII guard checks pass. When `OPENAI_API_KEY` and valid `OPENAI_PROJECT_ID` are configured, this gate now runs `pnpm verify:llm-models` to prove GPT-5/GPT-5 mini access for the selected project. |
| `pnpm verify:ops-readiness` | FAIL | Sentry instrumentation, launch opening/canary/outage/incident runbooks, launch evidence template, external settings checklist, P0 approval packet, Playwright config, `pnpm e2e`, `pnpm e2e:auth`, and automated smoke specs exist; Sentry DSNs, `LLM_DAILY_BUDGET_USD`, and `ANTHROPIC_API_KEY` are still missing. |
| `pnpm verify:ops-readiness` after launch evidence/checklist scanner wiring | FAIL | Expected external-env failure remains (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `LLM_DAILY_BUDGET_USD`, `ANTHROPIC_API_KEY`). File/script checks now also confirm the launch evidence scanner, external settings checklist, and `pnpm verify:launch-evidence-readiness` script are present. |
| `pnpm verify:supply-chain-readiness` | PASS | Re-run 2026-06-01: production advisory counts are critical 0, high 0, moderate 3, low 0, info 0. Moderate advisories are non-blocking but should be reviewed before hardening sign-off. |
| `pnpm vitest run tests/scripts/create-launch-evidence.test.ts` | PASS | 1 file / 6 tests. Confirms launch evidence generation remains secret-free, uses canonical Korean Go/No-Go labels, and refuses to auto-generate `서비스 오픈 가능` evidence before production evidence is manually completed. |
| `pnpm verify:payment-readiness` | PASS | Re-run 2026-06-04 KST. D1 plus pay-per-use migration applied. Local Toss hardening and feature pay-per-use migrations exist; remote `payments` has `toss_customer_key`, `charge_type`, `feature_id`, and `feature_ref`; remote `token_ledger` columns are OK. The gate now also confirms `docs/specs/payments.md` uses `/api/payments/feature/confirm` for server-side amount verification and does not reintroduce the deleted `/api/payments/confirm` checklist. |
| `pnpm verify:supabase-security-readiness` | PASS | D2 local migration gate passes for fixed `search_path`, explicit `anon`/`authenticated` revoke, and `service_role` grants. Live privilege and `proconfig` queries also verified the same on `jamhkucluhiibqpjsiov`. |
| `pnpm verify:vercel-readiness` | FAIL | Expected launch-readiness failure: `.vercel/project.json` and `NEXT_PUBLIC_APP_URL` are missing locally. |
| `git diff --check` | PASS | No whitespace errors; Git only reports expected LF→CRLF warnings on Windows. |
| `pnpm db:push:dry` | PASS | Re-run 2026-06-03 KST. Uses `scripts/db-push-dry-run.ts`, which delegates to `pnpm dlx supabase db push --dry-run --linked` and fails if Supabase reports pending migrations. Latest output: `Remote database is up to date`. |
| Launch-critical stale reference grep | PASS | Runtime/spec/runbook references now use `AGENTS.md`, `C:\DEV\CLAUDE.md`, `claude-fallback`, `ANTHROPIC_FALLBACK_MODEL`, or default `claude-sonnet-4-5` as appropriate. The missing root AGENTS path has been removed from current launch docs. |
| Focused `/cso` validation | PASS | 2026-06-04 KST integrated gate: `pnpm verify:secret-boundary-readiness`, `pnpm verify:supabase-security-readiness`, and `pnpm verify:supply-chain-readiness` pass. No server-only launch secret is reachable from client roots; active protected SECURITY DEFINER RPCs have fixed `search_path` and service-role-only execution in migrations; legacy `confirm_token_purchase` is dropped; production high/critical advisories are 0. |
| Focused `/qa` validation | PASS | 2026-06-04 KST integrated gate: `pnpm verify:payment-flow-readiness`, `pnpm verify:llm-boundary-readiness`, `pnpm verify:e2e-coverage-readiness`, `pnpm e2e`, and `pnpm e2e:auth` pass. Local/mocked pay-per-use payment, token spend/refund/idempotency, PII/score isolation, desktop/mobile public smoke, and seeded authenticated core flow are covered. |
| `pnpm dlx supabase db push --dry-run --linked` | PASS | Remote database is up to date after D1+D2 and `20260601000000_feature_pay_per_use.sql`. This is guarded through `pnpm db:push:dry`. |
| Supabase connector project/migration audit | PASS | Connector re-check: canonical `jamhkucluhiibqpjsiov` / `twoday` is `ACTIVE_HEALTHY`; remote migrations include `20260601000000_feature_pay_per_use`. |
| Supabase security advisor | WARN | Connector re-check: protected RPC public execution findings are gone after D2. Remaining items are 4 service-role-table `rls_enabled_no_policy` INFO findings, `extension_in_public` WARN for `vector`, and `auth_leaked_password_protection` WARN. |
| Supabase performance advisor | WARN | Connector re-check: 7 unindexed FK INFO, 21 Auth RLS initplan WARN, and 21 unused-index INFO findings remain as P1/P2 performance debt. Remediation requires DB/RLS approval. |
| Vercel project/env audit | FAIL | Connector re-check: Vercel team `deephigh` contains only project `3eyes`; no SAJU/TWODAY launch project found and env cannot be verified. |

`pnpm verify:launch-env` missing required keys as of this audit:

- `NEXT_PUBLIC_APP_URL`
- `OPENAI_PROJECT_ID`
- `TOSS_CLIENT_KEY`
- `TOSS_SECRET_KEY`
- `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`
- `KAKAO_ADMIN_KEY`
- `LLM_DAILY_BUDGET_USD`
- `ANTHROPIC_API_KEY`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`

## P0 Backlog

| ID | Task | Evidence | Approval |
|---|---|---|---|
| P0-01 | Done: Apply local Toss/payment hardening migrations to production Supabase. | D1 applied on 2026-05-31 and pay-per-use migration is now up to date. `pnpm verify:payment-readiness` PASS; remote `payments.toss_customer_key`, `charge_type`, `feature_id`, and `feature_ref` exist. | Approved/applied. |
| P0-02 | Done: Add/apply DB security migration that revokes direct `anon`/`authenticated` execution for token/payment/admin SECURITY DEFINER RPCs and fixes function `search_path`. | D2 applied on 2026-05-31. Local gate PASS; live `has_function_privilege` shows anon/authenticated false and service_role true for active protected RPCs, and pay-per-use migration drops legacy `confirm_token_purchase`. | Approved/applied. |
| P0-03 | Create/link Vercel project and configure production/preview env. | No SAJU/TWODAY project found; no `.vercel/project.json`. MVP can use the fixed Vercel Production `*.vercel.app` URL as `NEXT_PUBLIC_APP_URL`; custom domain purchase is not required for first open. | Operational approval/manual dashboard. |
| P0-04 | Configure Toss live keys and dashboard readiness. | `pnpm verify:toss-live-readiness` fails because `NEXT_PUBLIC_APP_URL`, `TOSS_CLIENT_KEY=live_ck_*`, and `TOSS_SECRET_KEY=live_sk_*` are missing locally; Vercel env/Toss dashboard unknown. | Operational approval/manual dashboard. |
| P0-05 | Done in current branch: resolve and implement paid feature policy for launch. | `pnpm verify:billing-policy-readiness` PASS. Pay-per-use feature pricing is canonical on `feature/pay-per-use-billing`: hapcard 800 KRW / whatif 500 KRW / replay 400 KRW; free-token spend/refund/idempotency remains for users with balance. | Approved/applied in pay-per-use branch. |
| P0-06 | Partially done: implement OpenAI production project routing; manual ZDR/env remains. | Client passes `OPENAI_PROJECT_ID`; `pnpm verify:openai-readiness` still fails until env is set, ZDR project is confirmed, and GPT-5/GPT-5 mini model access passes for the selected project. | Manual dashboard/env remains. |
| P0-07 | Configure Auth production redirects/providers. | Local Supabase config only covers localhost redirect URLs. | Manual dashboard; security/Auth approval. |
| P0-08 | Configure production monitoring env and alerting. | `pnpm verify:ops-readiness` fails because Sentry DSNs, `LLM_DAILY_BUDGET_USD`, and `ANTHROPIC_API_KEY` are missing. | Operational dashboard/env. |
| P0-09 | Done: re-run focused `/cso` then focused `/qa` after payment/security DB changes. | Focused security gates and payment/E2E QA gates pass on 2026-06-03 KST. `/review` remains required immediately before launch/PR finalization; `/canary` remains post-deploy. | No. |
| P0-10 | Done: implement LLM resilience launch policy. | `pnpm verify:llm-resilience-readiness` PASS. Claude fallback, OpenAI circuit breaker, and `LLM_DAILY_BUDGET_USD` runtime enforcement are present. | Approved/applied. |
| P0-11 | Run live preview/production E2E and canary against real integrations after Vercel/Supabase/Toss/OpenAI env is approved. | Local/mocked launch coverage now passes: `pnpm e2e` 14/14, `pnpm e2e:auth` 4/4, and `pnpm verify:e2e-coverage-readiness` PASS. This still does not prove production OAuth, Toss live payment, live DB migrations, or real token spend/refund. | No for test coverage; production test data/env may need manual setup. |
| P0-12 | Done: remediate production high/critical supply-chain advisories. | `pnpm verify:supply-chain-readiness` PASS with critical 0 / high 0 on 2026-06-03 after approved dependency remediation. Moderate advisories remain non-blocking review items. | Approved/applied. |
| P0-13 | Complete the external settings checklist after dashboard setup. | `docs/qa/external_settings_checklist.md` exists and is secret-scanned, but `pnpm verify:external-settings-checklist` fails until every status cell is `OK`, `PASS`, or justified `N/A(구체적 사유)` and completed rows, including Vercel env rows, have real secret-free evidence. | Manual dashboard/evidence. |

## P1 Backlog

| ID | Task | Evidence |
|---|---|---|
| P1-01 | Configure Sentry DSNs and payment/security alert rules. | Sentry code exists, but env and alert setup are not verifiable. |
| P1-04 | Re-check Supabase performance advisors and add high-impact FK indexes/RLS initplan optimizations after approval. | Connector re-check reports 7 unindexed FK INFO findings, 21 Auth RLS initplan WARN findings, and 21 unused-index INFO findings. This is not a current P0 launch blocker, but DB/RLS/index remediation requires AGENTS.md Section 1.1 approval. |
| P1-07 | Done: turn `pnpm db:push:dry` into a working local command on the launch machine. | `package.json` now uses `scripts/db-push-dry-run.ts` to run `pnpm dlx supabase db push --dry-run --linked` and fail on pending migrations; verified PASS with "Remote database is up to date." |
| P1-08 | Done: move unused `shadcn` CLI out of production dependencies. | `shadcn` is now a devDependency and `pnpm verify:supply-chain-readiness` passes the launch gate with 0 high/critical advisories. |
| P1-09 | Optional approval: remediate non-blocking moderate production advisories with narrow overrides. | `pnpm audit --prod --json` reports `postcss <8.5.10`, `brace-expansion <5.0.6`, and `ws <8.20.1`. This is dependency override work and requires §1.1 approval before implementation. |

Completed during this audit:

- P1-02: Toss provider idempotency key is stable per `orderId`/`paymentKey` confirm attempt. Verified by `tests/lib/payments/toss-server.test.ts`.
- Targeted `/cso` check for P1-02: the new `Idempotency-Key` includes `orderId` plus a SHA-256 hash prefix of `paymentKey`; raw `paymentKey` is not added to Sentry extras or logs by this change.
- Added `pnpm verify:payment-readiness` as a read-only gate for payment DB compatibility. Current production result confirms P0-01 remains closed after D1 plus pay-per-use migration.
- Extended `pnpm verify:payment-readiness` to guard `docs/specs/payments.md` against stale token-charge confirm checklist drift. It now requires `/api/payments/feature/confirm` for server-side amount verification and fails if the deleted `/api/payments/confirm` checklist returns.
- Extended `pnpm verify:launch-env` to fail on `.env.example`/`docs/specs/secrets.md` catalog drift and launch env shape drift. Current catalog checks pass; actual local/prod env values remain P0. Shape checks cover pure production origin with no path/query/hash, `OPENAI_PROJECT_ID` `proj_*`, Toss live key prefixes, positive `LLM_DAILY_BUDGET_USD`, required `ANTHROPIC_API_KEY`, and unset `TOSS_PAYMENTS_*` legacy aliases.
- Split Supabase public env and service-role env helpers so Client Component import graphs no longer include `SUPABASE_SERVICE_ROLE_KEY` references.
- Added `pnpm verify:secret-boundary-readiness` to catch server-only launch secrets in Client Component import graphs and unsafe `NEXT_PUBLIC_*` names. Current result passes.
- Added `pnpm verify:payment-flow-readiness` as a local gate for Toss feature init/confirm/complete UI, provider idempotency, feature unlock, token spend/refund, and wallet evidence. Current local result passes; live DB/Toss/dashboard checks remain P0.
- Added `pnpm verify:toss-live-readiness` as a launch gate for Toss live key prefixes, production origin shape, canonical env alias cleanup, and success/fail redirect source invariants. Current source invariants pass; live env/dashboard setup remains P0.
- Added `pnpm verify:billing-policy-readiness` as a read-only gate for paid policy drift. Current result passes after D3/D4 approval and implementation.
- Added `pnpm verify:db-rls-readiness` as a table RLS gate. Static migration checks and live Supabase RLS integration pass. Protected SECURITY DEFINER RPC exposure is now closed by D2 and verified separately.
- Added `pnpm verify:vercel-readiness` as a local gate for Vercel project link and production origin readiness. Current result confirms P0-03 is still open.
- Added `pnpm verify:auth-readiness` as a local gate for Auth env, OAuth callback, legal consent, and password policy readiness. Focused tests pass; production env/dashboard checks remain open.
- Added `pnpm verify:openai-readiness` as a local gate for OpenAI ZDR env/client readiness. It checks required env presence, `OPENAI_PROJECT_ID` `proj_*` shape, canonical project-routed client usage, `store:false`, and PII guard evidence. When the env is configured, it also runs the strict `pnpm verify:llm-models` check for GPT-5/GPT-5 mini access. Client-side code requirements pass; external `OPENAI_PROJECT_ID`, model access, and ZDR confirmation remain open.
- Added `pnpm verify:llm-boundary-readiness` as a focused gate for PII minimization, score isolation, and deterministic scoring evidence. Current result passes.
- Added `pnpm verify:llm-resilience-readiness` as a local gate for OpenAI retry/timeout/error UX and launch-required fallback/budget runtime behavior. Current result passes.
- Hardened `llm_cost_tracking` persistence: if the post-call cost tracking UPSERT fails, `callOpenAi()` now throws `LLM_COST_TRACKING_FAILED` instead of silently returning an untracked LLM result.
- Aligned the legacy `src/lib/llm/openai.ts` `createOpenAiClient` export with the canonical `src/lib/llm/clients.ts` factory so future imports cannot bypass production `OPENAI_PROJECT_ID` enforcement.
- Added `pnpm verify:supabase-security-readiness` as a local migration gate for protected SECURITY DEFINER RPC hardening. Current result confirms P0-02 is closed after D2.
- Added `pnpm verify:ops-readiness` as a local gate for Sentry/env/runbook/E2E automation readiness. It confirms monitoring env and automated E2E are still open.
- Added `docs/runbooks/launch_opening.md` and wired it into `pnpm verify:ops-readiness`. It gives the launch-day sequence for local gates, Preview smoke, Production smoke, dashboard evidence, Go/No-Go, rollback, and post-launch records.
- Added `docs/qa/launch_evidence_template.md` and wired it into `pnpm verify:ops-readiness` so production smoke/payment ledger/Sentry/Supabase evidence can be recorded without PII.
- Added `pnpm verify:supply-chain-readiness` as a production dependency audit gate. Current result passes with no high/critical production advisories.
- Added `pnpm e2e` with Playwright desktop/mobile public smoke coverage for start/login/signup/legal/guest onboarding/unauthenticated feature init/auth callback, unauth API 401, public OG share 404, custom 404 page safety, and payment fail UX. It is included in the integrated launch gate. Current result: 14/14 PASS.
- Added `pnpm e2e:auth` as an opt-in seeded email login and authenticated core-flow smoke. It is included in the integrated launch gate and passes with network access against the seeded QA account. Current result: 4/4 PASS.
- Added `pnpm verify:e2e-coverage-readiness` as a static gate for launch-critical Playwright flow coverage, including pay-per-use feature init/fail/unlock/refund idempotency coverage. Current result is PASS for local/mocked coverage; production live smoke remains P0-11.
- Added `pnpm verify:launch-readiness` as the integrated launch gate runner. It does not apply migrations or change dashboards; it runs the non-secret readiness gates, including external settings checklist evidence, TypeScript, lint, full unit tests, production build, Supabase migration dry-run, security, payment, LLM, supply-chain, and E2E gates, then returns non-zero while any required gate fails. It now has per-gate timeouts so network or browser hangs become explicit failed evidence.
- Added `tests/scripts/verify-launch-readiness.test.ts` so the integrated launch gate cannot accidentally drop the required TypeScript, lint, unit test, production build, Supabase dry-run, Public E2E, Auth E2E, or secret-free summary constraints without a test failure.
- Added `pnpm verify:launch-audit-readiness` and wired it into the integrated gate so final audit/backlog/approval/manual-settings/evidence/runbook artifacts cannot be omitted before launch sign-off.
- Added `pnpm verify:launch-readiness -- --summary-json <path>` support for evidence capture. The JSON stores gate names, status, exit code, duration, timeout, and required failure names only; it does not persist child command stdout or secret values.
- Added `pnpm verify:launch-waiting-state -- --summary-json <path> --evidence <path>` as a quick re-check while external dashboard/env setup is pending. It verifies summary/evidence consistency and exact required-failure rows, then runs the known external blocker check, launch audit artifact gate, and secret-free evidence scan without rerunning the full launch gate.
- Added `pnpm verify:known-external-blockers -- --summary-json <path>` as a cheap guard for the external-settings waiting state. It passes only when required failures exactly match the known external blocker set: launch env, Auth readiness, OpenAI/ZDR readiness, Toss live readiness, Vercel readiness, Operations/E2E readiness, and External settings checklist readiness.
- Added `pnpm create:launch-evidence` to turn a launch readiness summary JSON into a PII/secret-free evidence Markdown draft for Preview or Production smoke records. Evidence output now uses canonical Korean Go/No-Go labels: `오픈 보류` for failing readiness and `조건부 가능` after the readiness gate passes pending dashboard/smoke evidence. The generator now refuses to auto-record `서비스 오픈 가능`; operators must fill dashboard, smoke, live feature payment/unlock/token ledger, monitoring, canary, and decision evidence first, then update the evidence and run `pnpm verify:launch-evidence-readiness`.
- Added `pnpm verify:launch-evidence-readiness` to scan launch summary/evidence/checklist artifacts for secret values and raw PII assignments before sharing or committing evidence.
- Generated current Local evidence artifacts: `docs/qa/launch_gate_2026-05-31_local.json` and `docs/qa/launch_evidence_2026-05-31_local.md`. Secret/PII pattern scan found no raw key or original PII values in those artifacts.
- Wired the launch evidence scanner into `pnpm verify:ops-readiness` file/script checks so future operations readiness evidence confirms the scanner exists even before Sentry/env dashboard values are configured. The scanner now rejects generated evidence whose `Source summary JSON`, launch verdict, or required-failure rows do not match the provided summary JSON, plus non-canonical Go/No-Go labels, mismatched `Final decision`, `FAIL` readiness marked as openable, `서비스 오픈 가능` outside Production evidence, `서비스 오픈 가능` evidence that still contains `TBD` placeholders, `서비스 오픈 가능` evidence missing dashboard/smoke/payment ledger/monitoring/canary/decision evidence, or service-open verification inputs that omit/incompletely fill `docs/qa/external_settings_checklist.md`.
- Added `docs/qa/launch_p0_approval_packet.md` and wired it into `pnpm verify:ops-readiness` to map P0/R1-R8 approval decisions to post-approval work and required verification.
- Added `docs/qa/external_settings_checklist.md` and `pnpm verify:external-settings-checklist` so the operator can record Vercel, Supabase Auth, OAuth, OpenAI/ZDR, Anthropic, Toss, and Sentry setup status without pasting secrets. The checklist intentionally fails while `TBD`, `FAIL`, invalid status cells, or placeholder evidence remain.
- Updated `docs/runbooks/google_oauth.md` and `docs/runbooks/kakao_oauth_share.md` so OAuth/Web platform/callback setup follows the fixed Vercel Production `*.vercel.app` origin for MVP and records only secret-free evidence.
- P1-06: `/api/me/wallet` now keeps the recent ledger page for display, but computes `monthly_used` and recent usage buckets from a separate current-month negative-ledger query. Verified by `tests/app/api/me/wallet/route.test.ts` and `pnpm verify:payment-flow-readiness`.
- P1-07: `pnpm db:push:dry` no longer depends on a globally/PATH-installed Supabase CLI. It uses `scripts/db-push-dry-run.ts` to run `pnpm dlx supabase db push --dry-run --linked`, fails on pending migrations, and passes on the launch machine.

## P2 Backlog

| ID | Task | Evidence |
|---|---|---|
| P2-04 | Add live canary checklist evidence after deployment. | Launch evidence template and generated evidence now include a Canary Evidence section, but no deployment/canary result exists for this app yet. |

Completed during this audit:

- P2-01: Restored memory `project_open_questions.md` and indexed it from `MEMORY.md`. It records R1-R8 approval questions for Supabase, billing, Vercel, OpenAI/ZDR, Auth, and dependency advisory remediation.
- P2-02: Replaced current launch/project references to the missing root AGENTS path with existing universal rules file `C:\DEV\CLAUDE.md`.
- P2-03: Cleaned up stale launch policy/docs drift for billing/LLM/stack references across `AGENTS.md`, `tech_stack.md`, `fluttering-gathering-island.md`, `docs/README.md`, existing payment specs, LLM/security specs, outage runbooks, and source comments. `pnpm verify:billing-policy-readiness` remains PASS.

## Approval Questions

승인자가 항목별 근거와 승인 후 검증 순서를 한 번에 검토할 수 있도록 `docs/qa/launch_p0_approval_packet.md`를 추가했다.

1. Approved/applied 2026-05-31: create/apply a Supabase security migration that revokes `EXECUTE` from `anon`/`authenticated` for token/payment/admin SECURITY DEFINER RPCs, grants only the required server role, and sets fixed `search_path`.
2. Approved/applied 2026-05-31: apply the existing local Toss hardening migration `20260530090000_toss_v2_payment_hardening.sql` to production Supabase.
3. Approved/applied 2026-06-01/03: pay-per-use feature prices are canonical for the current launch branch: hapcard 800 KRW, whatif 500 KRW, replay 400 KRW.
4. Approved/applied 2026-06-01/03: launch enforces free-token deduction/refund/idempotency when balance exists, and one-time Toss feature payment/unlock when balance is insufficient.
5. Pending manual/operator work: create/link a Vercel project for this repository and configure production/preview env vars.
6. Approved/applied 2026-05-31: require `OPENAI_PROJECT_ID` in production and pass `project` explicitly from the main OpenAI client factory.
7. Approved/applied 2026-05-31: implement Claude fallback, OpenAI circuit breaker, and runtime LLM daily budget enforcement.
8. Domain policy clarified 2026-06-01: MVP uses the fixed Vercel Production `*.vercel.app` URL before any custom domain purchase. Auth redirect URLs for Supabase, Google, and Kakao dashboards still need operator evidence.
9. External settings guide clarified 2026-06-01: `docs/runbooks/external_launch_settings.md` now includes a Korean domain-not-purchased MVP input table for Vercel, Supabase, Google/Kakao, and Toss derived URLs. `pnpm print:launch-dashboard-plan` prints the full dashboard order, `pnpm print:vercel-env-plan` lists the Vercel env keys and unset legacy aliases before dashboard entry, `pnpm verify:external-settings-readiness` prints the no-custom-domain instruction when external setup is still failing, and `pnpm verify:origin-shape-readiness` can validate the chosen Vercel origin before dashboard entry.
10. Approved/applied 2026-05-31: update dependency versions/lockfile to clear production high/critical advisories.

## Manual Launch Tasks

- Vercel: create/link project, use the fixed Vercel Production `*.vercel.app` URL as the MVP production origin, configure env from `.env.example`, deploy preview, then production.
- Supabase Dashboard: set production Site URL and Redirect URLs, enable Google/Kakao providers, enable leaked password protection if approved, verify email/password policy.
- QA Auth: keep `pnpm seed:test-user`/`E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` available for preview/production smoke; `pnpm e2e:auth` requires network access to Supabase Auth.
- Toss Dashboard: switch to live keys, confirm business/payment method setup, set allowed success/fail URLs, decide webhook/cancel automation.
- OpenAI: verify ZDR account/project, set `OPENAI_API_KEY` and `OPENAI_PROJECT_ID` in Vercel production/preview, then confirm GPT-5/GPT-5 mini model access through `pnpm verify:openai-readiness`.
- Sentry: set server/client DSNs, create payment confirm failure alert, OpenAI failure/rate-limit alert, and 5xx alert.
- Evidence: fill `docs/qa/external_settings_checklist.md` with status notes only, never secret values, then run `pnpm verify:external-settings-checklist`.
- Dependencies: production advisory gate now reports critical 0 / high 0 as of the latest 2026-06-03 run; moderate 3 remains non-blocking review evidence.

## Pre-Open Checklist

1. All P0 items closed with evidence.
2. `pnpm tsc --noEmit`, `pnpm lint`, `pnpm vitest run`, `pnpm build`, `pnpm e2e`, and `pnpm e2e:auth` pass.
3. Supabase remote migrations match local migrations.
4. Supabase security advisor no longer reports public token/payment RPC execution.
5. Payment smoke proves feature success, cancel/fail, duplicate confirm, feature unlock, token spend, and refund/idempotency behavior.
6. Auth smoke proves signup/login/OAuth callback on production origin.
7. Core flow smoke proves onboarding, relation create, feed, hapcard, replay, whatif, today, me, OG/share, 401/404/500.
8. `pnpm audit --prod` and `pnpm verify:supply-chain-readiness` pass with no high/critical production advisories.
9. `pnpm verify:external-settings-checklist` and `pnpm verify:external-settings-readiness` pass after all dashboard/env settings and checklist evidence are complete.
10. Focused `/cso` and focused `/qa` evidence remains green; `/review` completed before launch; `/canary` completed after deploy.

## Rollback Procedure

1. Vercel: immediately promote the last known-good deployment or roll back the production alias.
2. Supabase: stop new paid traffic by disabling paid feature CTA or Vercel env/feature flag if available.
3. Toss: pause live payment exposure in app; if needed, disable relevant Toss payment method/dashboard route.
4. Payments/tokens: audit `payments` and `token_ledger` by `toss_order_id`/`feature_ref`/`reference_id`; use a one-off service-role repair only after preserving before/after rows.
5. LLM: roll back prompt versions via `prompt_versions` status or revert deployment if model/client behavior caused failures.
6. Incident: open `docs/runbooks/incident_template.md`, record timeline, user impact, data/payment impact, and remediation.
