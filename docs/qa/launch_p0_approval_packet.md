# Launch P0 Approval Packet

> 기준: `docs/qa/launch_readiness_2026-05-30.md`와 memory `project_open_questions.md` R1-R8. 이 문서는 승인을 요청하기 위한 패킷이며, 승인 없이 DB/RLS, 과금 정책, LLM routing/fallback, dependency 변경을 수행하지 않는다.

## How To Use

1. 아래 D1-D8을 순서대로 승인/보류/수정한다.
2. 승인된 항목만 구현하거나 dashboard에 적용한다.
3. 각 항목의 `Required verification`을 실행해 evidence를 `launch_readiness_2026-05-30.md` 또는 날짜별 launch evidence 문서에 기록한다.
4. 모든 P0가 PASS일 때만 production open 절차로 이동한다.

## Decision Matrix

| Decision | Maps To | Approval Needed | Current Gate |
|---|---|---|---|
| D1 Supabase payment migration | P0-01 / R1 | DB schema/live migration | Approved/applied 2026-05-31; `pnpm verify:payment-readiness` PASS |
| D2 Supabase protected RPC security | P0-02 / R2 | DB/RLS/security scope | Approved/applied 2026-05-31; `pnpm verify:supabase-security-readiness` PASS |
| D3 Canonical paid launch catalog | P0-05 / R3 | Price/billing policy | Approved/applied 2026-05-31; `pnpm verify:billing-policy-readiness` PASS |
| D4 Paid feature spend gates | P0-05 / R4 | Price/billing policy + DB/RLS if changed | Approved/applied 2026-05-31; hapcard/replay/whatif spend/refund/idempotency implemented |
| D5 Vercel project/production URL/env | P0-03/P0-04/P0-07/P0-08 / R5/R7 | Operational dashboard/env | `pnpm verify:vercel-readiness` FAIL |
| D6 OpenAI ZDR project routing | P0-06 / R6 | LLM/security/privacy scope | Approved/applied 2026-05-31 in code; `OPENAI_PROJECT_ID` env/ZDR confirmation still required |
| D7 LLM fallback/circuit breaker/budget | P0-10 / R6 | LLM model/fallback + budget/security behavior | Approved/applied 2026-05-31; `pnpm verify:llm-resilience-readiness` PASS |
| D8 Dependency advisory remediation | P0-12 / R8 | Dependency/version change | Approved/applied 2026-05-31; `pnpm verify:supply-chain-readiness` PASS |

## D1 - Supabase Payment Hardening Migration

Status: Approved by user and applied on 2026-05-31 to Supabase project `jamhkucluhiibqpjsiov`.

Question: May we apply `supabase/migrations/20260530090000_toss_v2_payment_hardening.sql` to production Supabase project `jamhkucluhiibqpjsiov`?

Why it matters:
- Payment init/order/confirm code expects `payments.toss_customer_key`.
- Remote production currently fails `payments.toss_customer_key` read checks.
- Without this migration, live paid feature payment cannot be considered safe.

Recommended decision: approve after confirming this migration is exactly the intended Toss V2 hardening migration.

Post-approval work:
- Run dry-run migration status from the launch machine.
- Apply migration to the canonical Supabase project.
- Re-run payment DB and payment flow readiness.

Required verification:

```bash
pnpm verify:payment-readiness
pnpm verify:payment-flow-readiness
pnpm verify:launch-readiness
```

Result as of 2026-05-31:
- `pnpm dlx supabase db push --dry-run --linked`: PASS, remote database is up to date.
- `pnpm verify:payment-readiness`: PASS, remote `payments.toss_customer_key` exists.
- `pnpm verify:payment-flow-readiness`: PASS.

## D2 - Supabase Protected RPC Security

Status: Approved by user and applied on 2026-05-31 via `20260531013539_protected_rpc_security_hardening.sql`.

Question: May we create and apply a migration that fixes `search_path`, revokes `EXECUTE` from `anon`/`authenticated`, and grants only required server roles for protected token/payment/admin RPCs?

Affected RPCs:
- `confirm_feature_payment` (current pay-per-use RPC)
- `confirm_token_purchase` (historical token-pack RPC, dropped by `20260601000000_feature_pay_per_use.sql`)
- `deduct_tokens`
- `deduct_tokens_once`
- `refund_tokens`
- `refund_tokens_once`
- `award_free_talisman_session_rewards`
- `award_hapcard_share_reward`
- `match_classics`
- `purge_deleted_users`

Why it matters:
- These functions modify tokens, payments, rewards, RAG retrieval, or deletion state.
- Current readiness gate shows public-role execution exposure.
- This is a hard launch blocker for paid service.

Recommended decision: approve a dedicated security migration before production paid traffic.

Post-approval work:
- Create one narrowly scoped migration for function privilege/search_path hardening.
- Re-run local migration contract tests.
- Apply to Supabase production only after dry-run review.
- Re-run Supabase advisor and function privilege checks.

Required verification:

```bash
pnpm verify:supabase-security-readiness
pnpm verify:db-rls-readiness
pnpm verify:launch-readiness
```

Result as of 2026-06-03:
- `pnpm verify:supabase-security-readiness`: PASS.
- `pnpm verify:db-rls-readiness`: PASS, including live Supabase RLS integration.
- Live `has_function_privilege` check: `anon` and `authenticated` cannot execute active protected RPCs; `service_role` can.
- Live `pg_proc.proconfig` check: active protected RPCs have `search_path=public`.
- Pay-per-use migration drops legacy `confirm_token_purchase`.
- Supabase security advisor no longer reports protected RPC public execution findings.

## D3 - Canonical Paid Launch Catalog

Status: Approved by user and applied on 2026-05-31 for token products, then superseded by approved pay-per-use work on 2026-06-01/03. Current launch branch uses feature prices: hapcard 800 KRW, whatif 500 KRW, replay 400 KRW.

Question: Which paid launch policy is canonical?

Option A: PRD token products are canonical. Historical decision, superseded on the pay-per-use branch.
- 10 tokens / 1,000 KRW
- 55 tokens / 4,500 KRW
- 120 tokens / 8,000 KRW

Option C: pay-per-use feature prices are canonical for current launch branch.
- Hapcard create: 800 KRW
- Whatif: 500 KRW
- Replay: 400 KRW
- No `token_ledger.reason='purchase'` credit on cash payment.

Option B: older `fluttering-gathering-island.md` pricing/subscription text is canonical.

Why it matters:
- Server product catalog already matches Option A.
- Planning docs still contain older pricing/subscription language.
- Launch cannot be legally/product-wise consistent until this is resolved.

Recommended decision: choose Option A unless there is a product reason to reopen pricing.

Post-approval work:
- Update stale pricing docs to the chosen policy.
- Keep `PRD.md`, `docs/specs/payments.md`, `fluttering-gathering-island.md`, and implementation consistent.

Required verification:

```bash
pnpm verify:billing-policy-readiness
pnpm verify:payment-flow-readiness
```

Result as of 2026-06-03:
- `pnpm verify:billing-policy-readiness`: PASS.
- `pnpm verify:payment-flow-readiness`: PASS.

## D4 - Paid Feature Spend Gates

Status: Approved by user and applied on 2026-05-31 for token spend, then extended by approved pay-per-use work on 2026-06-01/03. Hapcard create, replay, and whatif are paid launch features with idempotent free-token spend/refund, cache-hit no-charge behavior, and one-time Toss feature payment when balance is insufficient.

Question: Should launch charge tokens for hapcard creation and whatif, or keep only replay paid for launch?

Current state:
- Hapcard creation spends 8 free tokens when balance exists and refunds on post-charge generation failure.
- Replay spends 4 free tokens when balance exists and refunds on post-charge generation failure.
- Whatif spends 5 free tokens when balance exists and refunds on post-charge generation failure.
- Insufficient balance opens one-time Toss feature payment and unlocks only the requested `feature_ref`.
- Duplicate feature requests are idempotent through token ledger reference constraints/RPCs.

Option A: charge only replay at launch and explicitly document hapcard/whatif as free for launch.

Option B: implement token spend/refund/idempotency for hapcard creation and whatif before launch.

Why it matters:
- Option A is simpler operationally but weakens paid launch scope.
- Option B is more consistent with paid content docs but requires route/test/DB/RLS/security validation.

Recommended decision: pick one policy explicitly. Do not leave mixed docs/code behavior.

Required verification after implementation:

```bash
pnpm verify:billing-policy-readiness
pnpm verify:payment-flow-readiness
pnpm verify:db-rls-readiness
pnpm verify:launch-readiness
```

Result as of 2026-05-31:
- `pnpm verify:billing-policy-readiness`: PASS.
- `pnpm verify:payment-flow-readiness`: PASS.
- `pnpm verify:db-rls-readiness`: PASS.
- `pnpm verify:launch-readiness`: still FAIL only on external env/dashboard gates.

## D5 - Vercel, Production URL, Auth, Toss, Sentry Env

Question: May we create/link the Vercel project and configure production/preview env and dashboard settings?

Needed inputs:
- Production origin / `NEXT_PUBLIC_APP_URL`
  - MVP before custom domain purchase: use the fixed Vercel Production `*.vercel.app` URL.
  - Do not use Vercel Preview URLs, deployment-hash URLs, localhost, or paths.
- Vercel team/project name
- Supabase Auth Site URL and redirect URLs
- Google/Kakao provider dashboard settings
- Toss live keys and allowed success/fail URLs
- Sentry server/browser DSNs and alert rules
- `LLM_DAILY_BUDGET_USD`

Why it matters:
- `verify:launch-env`, `verify:vercel-readiness`, `verify:auth-readiness`, `verify:toss-live-readiness`, and `verify:ops-readiness` all fail on environment/dashboard readiness.

Recommended decision: approve Vercel project setup and use the Vercel Production `*.vercel.app` URL as the MVP production origin before live payment work. Custom domain purchase can be deferred until post-MVP market validation, but all Auth/Toss/Kakao/Google callback settings must still use the current production origin.

Required verification:

```bash
pnpm verify:launch-env
pnpm verify:vercel-readiness
pnpm verify:auth-readiness
pnpm verify:toss-live-readiness
pnpm verify:ops-readiness
pnpm e2e
pnpm e2e:auth
```

## D6 - OpenAI ZDR Project Routing

Status: Approved by user and applied in code on 2026-05-31. Manual OpenAI project choice, ZDR confirmation, and Vercel env setup remain.

Question: May we require `OPENAI_PROJECT_ID` in production and update the main OpenAI client factory to pass `project` explicitly?

Why it matters:
- Common OpenAI caller already disables provider storage and guards PII/score leakage.
- `src/lib/llm/clients.ts` still does not pass `project`.
- Production ZDR evidence is not complete without project routing and dashboard confirmation.

Recommended decision: approve explicit project routing for production LLM calls after confirming ZDR project status.

Required verification:

```bash
pnpm verify:openai-readiness
pnpm verify:llm-boundary-readiness
pnpm verify:launch-readiness
```

Result as of 2026-05-31:
- Main OpenAI client reads and passes `OPENAI_PROJECT_ID`.
- `pnpm verify:llm-boundary-readiness`: PASS.
- `pnpm verify:openai-readiness`: still FAIL until `OPENAI_PROJECT_ID` is set, the production OpenAI project's ZDR status is confirmed, and GPT-5/GPT-5 mini model access passes for that project.

## D7 - LLM Fallback, Circuit Breaker, Runtime Budget

Status: Approved by user and applied on 2026-05-31.

Question: Should launch implement Claude fallback, OpenAI circuit breaker, and runtime daily budget enforcement now?

Current state:
- OpenAI retry/timeout/error UX is covered.
- Replay has provider outage error path.
- Docs/runbooks require fallback/circuit breaker/budget enforcement.
- Runtime code implements Claude fallback, OpenAI circuit breaker, and `LLM_DAILY_BUDGET_USD` enforcement.

Option A: implement fallback/circuit breaker/budget before launch.

Option B: explicitly defer and update launch DoD/runbooks so readiness gates reflect the approved scope.

Recommended decision: Option A for paid launch reliability, unless launch scope is intentionally reduced.

Required verification:

```bash
pnpm verify:llm-resilience-readiness
pnpm verify:openai-readiness
pnpm verify:launch-readiness
```

Result as of 2026-05-31:
- `pnpm verify:llm-resilience-readiness`: PASS.
- `pnpm verify:openai-readiness`: still blocked only by external `OPENAI_PROJECT_ID`/ZDR/model-access confirmation.

## D8 - Production Dependency Advisory Remediation

Status: Approved by user and applied on 2026-05-31.

Question: May we update dependency versions/lockfile to clear production advisories?

Applied remediation:
- `next` and `eslint-config-next` updated to `16.2.6`.
- `@sentry/nextjs` updated to `10.55.0`.
- `shadcn` moved from production dependencies to devDependencies.
- `fast-uri` override set to `3.1.2`.

Why it matters:
- Launching paid production with high/critical advisories is a No-Go.
- Remaining moderate advisories are non-blocking but should be reviewed before hardening sign-off.

Current state: the approved P0 dependency remediation is complete for high/critical launch blocking advisories. Do not add further dependency overrides without a new §1.1 approval.

Remaining non-blocking moderate advisories from `pnpm audit --prod --json`:

| Module | Current path | Patched version | Launch note |
|---|---|---:|---|
| `postcss` | `next > postcss@8.4.31` | `>=8.5.10` | Moderate XSS risk if untrusted CSS is parsed/stringified and embedded in HTML style tags. |
| `brace-expansion` | `@sentry/nextjs > @sentry/bundler-plugin-core > glob > minimatch > brace-expansion@5.0.5` | `>=5.0.6` | Moderate range expansion DoS risk in glob/minimatch tooling path. |
| `ws` | `@supabase/supabase-js > @supabase/realtime-js > ws@8.20.0` | `>=8.20.1` | Moderate memory disclosure advisory; practical exploit requires unusual `close()` reason misuse. |

Optional follow-up decision: approve a narrow override-only remediation for `postcss`, `brace-expansion`, and `ws`, then rerun the supply-chain and full launch gates.

Required verification:

```bash
pnpm audit --prod
pnpm verify:supply-chain-readiness
pnpm tsc --noEmit
pnpm lint
pnpm vitest run
pnpm build
pnpm e2e
pnpm e2e:auth
pnpm verify:launch-readiness
```

Result as of 2026-05-31:
- `pnpm verify:supply-chain-readiness`: PASS with critical 0 / high 0 / moderate 3 / low 0 / info 0 on the latest 2026-06-03 run. Moderate advisories are non-blocking but remain review evidence before hardening sign-off.
- `pnpm audit --prod --json`: confirms the moderate advisories are `postcss`, `brace-expansion`, and `ws`.
- `pnpm tsc --noEmit`, `pnpm lint`, `pnpm vitest run`, `pnpm build`, and `pnpm e2e:auth` pass from the earlier full validation; rerun after any new override approval.

## Final Gate After Approved Work

After all approved P0 items are complete:

```bash
pnpm tsc --noEmit
pnpm lint
pnpm vitest run
pnpm build
pnpm e2e
pnpm e2e:auth
pnpm verify:launch-readiness
```

Then run the relevant skills from AGENTS.md:

- Payment/security changes: focused `/cso` then focused `/qa` re-run on 2026-05-31 and recorded in `launch_readiness_2026-05-30.md`; re-run if payment/security code changes again.
- PR/launch review: `/review`
- After deployment: `/canary`

Go/No-Go remains **오픈 보류** until every required launch gate passes and production smoke evidence exists.
