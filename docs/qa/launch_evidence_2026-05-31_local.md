# Launch Evidence - Local

> Generated from a secret-free `pnpm verify:launch-readiness -- --summary-json` result. Do not add secret values, raw PII, birth_date, nickname, email, or original gender values to this file.

## Summary

| Field | Value |
|---|---|
| Evidence date/time (KST) | 2026-06-01 16:47:00 |
| Environment | Local |
| Domain | TBD |
| Vercel project | TBD |
| Deployment URL | TBD |
| Commit SHA | 1ff7d28bbea2184491a2c4cb2b8d3b69965344f3 |
| Working tree status | dirty - uncommitted local changes present |
| Supabase project ref | `jamhkucluhiibqpjsiov` |
| Launch readiness verdict | FAIL |
| Go/No-Go | 오픈 보류 |
| Operator | TBD |
| Source summary JSON | C:\DEV\SAJU\docs\qa\launch_gate_2026-05-31_local.json |

## Launch Gate Results

| Gate | Required | Result | Evidence |
|---|---:|---:|---|
| launch env | yes | FAIL | exit=1, duration=4.7s, timeout=120.0s, timedOut=no |
| Secret/public env boundary readiness | yes | PASS | exit=0, duration=2.1s, timeout=120.0s, timedOut=no |
| Launch audit artifact readiness | yes | PASS | exit=0, duration=2.2s, timeout=120.0s, timedOut=no |
| External settings checklist readiness | yes | FAIL | exit=1, duration=3.8s, timeout=120.0s, timedOut=no |
| TypeScript check | yes | PASS | exit=0, duration=11.9s, timeout=180.0s, timedOut=no |
| Lint check | yes | PASS | exit=0, duration=42.6s, timeout=180.0s, timedOut=no |
| Unit test suite | yes | PASS | exit=0, duration=259.6s, timeout=420.0s, timedOut=no |
| Production build | yes | PASS | exit=0, duration=67.4s, timeout=300.0s, timedOut=no |
| Auth readiness | yes | FAIL | exit=1, duration=9.1s, timeout=120.0s, timedOut=no |
| OpenAI/ZDR readiness | yes | FAIL | exit=1, duration=2.7s, timeout=120.0s, timedOut=no |
| LLM/score boundary readiness | yes | PASS | exit=0, duration=6.5s, timeout=120.0s, timedOut=no |
| LLM resilience readiness | yes | PASS | exit=0, duration=17.7s, timeout=120.0s, timedOut=no |
| payment DB readiness | yes | PASS | exit=0, duration=3.1s, timeout=120.0s, timedOut=no |
| payment flow readiness | yes | PASS | exit=0, duration=27.1s, timeout=120.0s, timedOut=no |
| Toss live readiness | yes | FAIL | exit=1, duration=2.8s, timeout=120.0s, timedOut=no |
| billing policy readiness | yes | PASS | exit=0, duration=1.5s, timeout=120.0s, timedOut=no |
| DB/RLS readiness | yes | PASS | exit=0, duration=11.9s, timeout=180.0s, timedOut=no |
| Supabase migration dry-run | yes | PASS | exit=0, duration=7.1s, timeout=180.0s, timedOut=no |
| Supabase RPC security readiness | yes | PASS | exit=0, duration=1.8s, timeout=120.0s, timedOut=no |
| Vercel readiness | yes | FAIL | exit=1, duration=2.9s, timeout=120.0s, timedOut=no |
| Operations/E2E readiness | yes | FAIL | exit=1, duration=3.0s, timeout=120.0s, timedOut=no |
| Supply-chain readiness | yes | PASS | exit=0, duration=3.1s, timeout=180.0s, timedOut=no |
| Public E2E readiness | yes | PASS | exit=0, duration=59.6s, timeout=300.0s, timedOut=no |
| Auth E2E readiness | yes | PASS | exit=0, duration=66.6s, timeout=300.0s, timedOut=no |
| Core E2E coverage readiness | yes | PASS | exit=0, duration=2.1s, timeout=120.0s, timedOut=no |

## Required Failures

| Gate | Required Action |
|---|---|
| launch env | Must be cleared before production open |
| External settings checklist readiness | Must be cleared before production open |
| Auth readiness | Must be cleared before production open |
| OpenAI/ZDR readiness | Must be cleared before production open |
| Toss live readiness | Must be cleared before production open |
| Vercel readiness | Must be cleared before production open |
| Operations/E2E readiness | Must be cleared before production open |

## Dashboard Evidence

| Area | Required Evidence | Result |
|---|---|---:|
| Vercel | production domain, env presence, rollback deployment | TBD |
| Supabase migrations | remote latest matches local | TBD |
| Supabase Auth | Site URL and redirect URLs include production domain | TBD |
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
| paid charge success | TBD | toss_order_id only |
| paid fail/cancel | TBD | toss_order_id only |
| paid manual refund/cancel drill | TBD | toss_order_id and owner only |
| OG/share | TBD | URL path only |
| 401/404/500 UX | TBD | status/code only |

## Payment Ledger Evidence

| Event | Non-sensitive Reference | Expected | Actual |
|---|---|---|---|
| payment init | toss_order_id | pending payment row | TBD |
| payment confirm | toss_order_id | confirmed payment + purchase ledger | TBD |
| duplicate confirm | toss_order_id | idempotent no double credit | TBD |
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
| Payment charge and ledger canary | first live low-value order | TBD |
| Manual refund/cancel operator canary | first live low-value order or approved dry run | TBD |
| Auth/OAuth canary | first production smoke account | TBD |
| LLM fallback/circuit breaker budget canary | first 15 min | TBD |
| Rollback deployment confirmed available | before public traffic | TBD |

## Decision

Final decision: 오픈 보류

Reason: Launch readiness gate failed; required failures must be cleared before production open.

Known risks accepted:

Rollback trigger:

Next review time:
