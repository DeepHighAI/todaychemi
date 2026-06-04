# Launch Evidence Template

> 사용 시점: Local launch gate, Vercel Preview smoke, Production smoke, 또는 rollback/canary 검증 직후 복사해서 날짜별 evidence 문서로 저장한다. 비밀키 값, 원본 PII, birth_date, nickname, email, gender 원본은 기록하지 않는다.
>
> 자동 초안: `pnpm verify:launch-readiness -- --summary-json <json>` 실행 후 `pnpm create:launch-evidence -- --summary-json <json> --out <md> --environment <Local|Preview|Production> --domain <url>`을 사용한다. `서비스 오픈 가능`은 자동 생성 옵션으로 찍지 않는다. Production smoke와 live feature payment/unlock/token ledger 증거를 수동으로 채운 뒤 판정값을 변경하고 `pnpm verify:launch-evidence-readiness <json> <md> docs/qa/external_settings_checklist.md`로 검증한다.
>
> `조건부 가능`도 자동 초안 그대로는 충분하지 않다. Production evidence의 dashboard/smoke/payment/monitoring/canary 섹션과 Decision 섹션의 `Reason`, `Known risks accepted`, `Rollback trigger`, `Next review time`을 운영자가 채우고, launch summary JSON과 외부 설정 체크리스트를 함께 검증해야 통과한다.

## Summary

| Field | Value |
|---|---|
| Evidence date/time (KST) | TBD |
| Environment | Local / Preview / Production |
| Production origin | TBD |
| Vercel project | TBD |
| Deployment URL | TBD |
| Commit SHA | TBD |
| Supabase project ref | `jamhkucluhiibqpjsiov` |
| Go/No-Go | 서비스 오픈 가능 / 조건부 가능 / 오픈 보류 |
| Operator | TBD |

## Gate Results

| Check | Result | Evidence |
|---|---:|---|
| `pnpm tsc --noEmit` | TBD | command output summary |
| `pnpm lint` | TBD | command output summary |
| `pnpm vitest run` | TBD | files/tests summary |
| `pnpm build` | TBD | build summary |
| `pnpm audit --prod` | TBD | high/critical count |
| `pnpm verify:supply-chain-readiness` | TBD | PASS/FAIL summary |
| `pnpm verify:launch-audit-readiness` | TBD | final audit/backlog/evidence/runbook artifact check |
| `pnpm verify:launch-readiness` | TBD | PASS/FAIL summary |
| `pnpm verify:launch-readiness -- --summary-json <path>` | TBD | secret-free gate status JSON path |
| `pnpm verify:launch-evidence-readiness <json> <md> docs/qa/external_settings_checklist.md` | TBD | secret/PII artifact scan plus checklist evidence scan |
| `pnpm e2e -- --base-url <url>` | TBD | desktop/mobile count |
| `pnpm e2e:auth -- --base-url <url>` | TBD | desktop/mobile count |

Note: `pnpm verify:launch-readiness` also runs local `pnpm verify:launch-audit-readiness`, `pnpm tsc --noEmit`, `pnpm lint`, `pnpm vitest run`, `pnpm build`, `pnpm db:push:dry`, `pnpm e2e`, and `pnpm e2e:auth`; the explicit `--base-url` commands above are for Preview/Production smoke against deployed URLs and work in PowerShell, bash, and CI shells.

## Dashboard Evidence

| Area | Required Evidence | Result |
|---|---|---:|
| Vercel | production origin, env presence, rollback deployment | TBD |
| Supabase migrations | remote latest matches local | TBD |
| Supabase Auth | Site URL and redirect URLs include production origin | TBD |
| Supabase security | protected RPCs not executable by `anon`/`authenticated` | TBD |
| Toss | live keys active, success/fail URLs, live payment method | TBD |
| OpenAI | ZDR project, `OPENAI_PROJECT_ID`, model access | TBD |
| Sentry | server/browser events and payment/LLM/5xx alerts | TBD |

## Production Smoke Notes

Record only non-sensitive IDs and redacted summaries.

| Flow | Result | Evidence |
|---|---:|---|
| signup/login/OAuth callback | TBD | no email values |
| onboarding to today/me | TBD | no birth date values |
| relation create/feed | TBD | no nickname values |
| hapcard create/view | TBD | hapcard id only |
| replay token spend/refund | TBD | ledger reference id only |
| whatif | TBD | result id only |
| paid feature payment success | TBD | toss_order_id/feature_ref only |
| paid fail/cancel | TBD | toss_order_id only |
| paid manual refund/cancel drill | TBD | toss_order_id and owner only |
| OG/share | TBD | URL path only |
| 401/404/500 UX | TBD | status/code only |

## Payment Ledger Evidence

| Event | Non-sensitive Reference | Expected | Actual |
|---|---|---|---|
| payment init | toss_order_id | pending payment row | TBD |
| payment confirm | toss_order_id/feature_ref | confirmed feature unlock, no purchase ledger | TBD |
| duplicate confirm | toss_order_id/feature_ref | idempotent no double unlock | TBD |
| replay spend | replay reference id | negative ledger | TBD |
| replay refund | replay reference id | refund ledger on failure | TBD |
| monetary refund/cancel drill | toss_order_id | Toss dashboard/manual refund status and before/after ledger export recorded | TBD |

## Monitoring

| Signal | Window | Result |
|---|---|---:|
| Sentry 5xx rate | 15 min | TBD |
| Payment confirm failures | 15 min | TBD |
| LLM timeout/rate-limit/outage | 15 min | TBD |
| Supabase DB/Auth errors | 15 min | TBD |
| Vercel function errors | 15 min | TBD |

## Canary Evidence

| Check | Window | Result |
|---|---|---:|
| Production canary start time | first 15 min | TBD |
| Feature payment and unlock canary | first live low-value feature order | TBD |
| Manual refund/cancel operator canary | first live low-value order or approved dry run | TBD |
| Auth/OAuth canary | first production smoke account | TBD |
| LLM fallback/circuit breaker budget canary | first 15 min | TBD |
| Rollback deployment confirmed available | before public traffic | TBD |

## Decision

Final decision:

Reason:

Known risks accepted:

Rollback trigger:

Next review time:
