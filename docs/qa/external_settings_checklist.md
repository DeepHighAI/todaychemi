# External Settings Checklist

> 목적: Vercel 기본 Production URL로 MVP를 열기 전, 외부 dashboard 설정을 secret-free로 체크한다. 실제 key 값, DSN, service role key, token, email, birth_date, nickname, gender 원본은 기록하지 않는다.

## 작성 방법

1. 각 `TBD`를 `OK`, `PASS`, `N/A(구체적 사유)` 중 하나로 바꾼다.
2. Evidence에는 실제 secret 값을 적지 않는다.
3. Evidence에는 실제 증거를 적는다. `origin only`, `checked`, `presence only`, `project name only` 같은 작성 안내문을 그대로 두면 검증에 실패한다.
4. 공개 가능한 값만 적는다: project name, origin, URL path, `proj_...` prefix, `live_gck_`/`live_gsk_` prefix, alert name, owner, command PASS/FAIL.
5. 설정을 바꾼 뒤 Vercel에서 redeploy하고 아래 Verification Commands를 다시 실행한다.
6. `pnpm verify:external-settings-checklist`가 PASS해야 이 checklist가 완료된 것이다.
7. `N/A(사유)`, `N/A(reason)`, `N/A(TBD)`처럼 placeholder 사유는 검증에 실패한다.
8. `FAIL` 또는 `DONE` 같은 임의 상태값은 미완료로 처리되어 검증에 실패한다.
9. `Result`, `Production`, `Preview` 상태 컬럼이 있는 표는 반드시 `Evidence` 또는 `Notes` 컬럼을 함께 둔다.

## Evidence 예시

아래처럼 secret-free로만 적는다.

```text
project=twoday, origin=https://twoday-mvp.vercel.app, branch=main
site_url=production origin, redirect=/auth/callback, providers=google+kakao
openai_project=<선택한 project 이름>, id_prefix=proj_, zdr=confirmed
toss=live_gck/live_gsk present, success=/api/payments/feature/confirm, fail=/payments/fail
alerts=payment-confirm-failure,llm-provider-outage,5xx-spike
custom_domain=not_purchased_for_mvp, trigger=after_market_validation, owner=<name>
```

도메인을 아직 구매하지 않은 MVP는 정상 경로다. `NEXT_PUBLIC_APP_URL`에는 커스텀 도메인이 아니라 Vercel의 고정 Production `*.vercel.app` origin을 넣고, custom-domain 항목은 위 예시처럼 구매 트리거와 담당자만 기록한다.

## Production Origin

| Item | Result | Evidence |
|---|---:|---|
| Vercel project is SAJU/TWODAY production project, not another app | TBD | project name only |
| Fixed Vercel Production `*.vercel.app` URL selected | TBD | origin only, no path |
| `NEXT_PUBLIC_APP_URL` equals fixed Vercel Production origin | TBD | origin only |
| Preview/deployment-hash URL is not used as production origin | TBD | checked |
| Future custom-domain migration note recorded | TBD | owner/date |

## Vercel Environment Variables

Record only presence and environment scope. Evidence must be secret-free and specific.

| Key | Production | Preview | Evidence |
|---|---:|---:|---|
| `NEXT_PUBLIC_APP_URL` | TBD | TBD | fixed production origin |
| `NEXT_PUBLIC_SUPABASE_URL` | TBD | TBD | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | TBD | TBD | public anon |
| `SUPABASE_SERVICE_ROLE_KEY` | TBD | TBD | value never recorded |
| `OPENAI_API_KEY` | TBD | TBD | value never recorded |
| `OPENAI_PROJECT_ID` | TBD | TBD | `proj_...` shape only |
| `ANTHROPIC_API_KEY` | TBD | TBD | value never recorded |
| `LLM_DAILY_BUDGET_USD` | TBD | TBD | number only |
| `KASI_SERVICE_KEY` | TBD | TBD | value never recorded |
| `TOSS_CLIENT_KEY` | TBD | TBD | `live_gck_...` prefix only |
| `TOSS_SECRET_KEY` | TBD | TBD | `live_gsk_...` prefix only |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | TBD | TBD | public |
| `KAKAO_ADMIN_KEY` | TBD | TBD | value never recorded |
| `SENTRY_DSN` | TBD | TBD | value never recorded |
| `NEXT_PUBLIC_SENTRY_DSN` | TBD | TBD | value never recorded |

Legacy aliases must stay unset for launch:

| Key | Production | Preview | Evidence |
|---|---:|---:|---|
| `TOSS_PAYMENTS_CLIENT_KEY` | TBD | TBD | unset confirmation |
| `TOSS_PAYMENTS_SECRET_KEY` | TBD | TBD | unset confirmation |

## Supabase Auth

Project ref must be `jamhkucluhiibqpjsiov`.

| Item | Result | Evidence |
|---|---:|---|
| Site URL equals `NEXT_PUBLIC_APP_URL` | TBD | origin only |
| Redirect URL includes `${NEXT_PUBLIC_APP_URL}/auth/callback` | TBD | URL path only |
| Local redirect URLs kept for smoke only | TBD | localhost paths only |
| Google provider enabled | TBD | provider enabled |
| Kakao provider enabled if included in launch scope | TBD | provider enabled |
| Kakao email optional setting matches `docs/specs/auth.md` | TBD | checked |
| Email/password minimum length is 8 | TBD | checked |
| Password strength requires letters plus digits | TBD | checked |
| Sign-in/sign-up rate limit is 10 per 5 minutes | TBD | checked |
| Leaked password protection enabled | TBD | checked |

## Google / Kakao Developer Consoles

| Console | Item | Result | Evidence |
|---|---|---:|---|
| Google | Web origin is `NEXT_PUBLIC_APP_URL` | TBD | origin only |
| Google | OAuth callback is Supabase callback URL | TBD | path only |
| Kakao | Web origin is `NEXT_PUBLIC_APP_URL` | TBD | origin only |
| Kakao | OAuth callback is Supabase callback URL | TBD | path only |
| Kakao | JavaScript key present in Vercel env | TBD | presence only |
| Kakao | Admin key present in Vercel env | TBD | presence only |

## OpenAI / ZDR

| Item | Result | Evidence |
|---|---:|---|
| Production OpenAI project selected | TBD | project name/id prefix only |
| ZDR status confirmed for production project | TBD | dashboard/contract reference, no secret |
| `OPENAI_API_KEY` belongs to same project as `OPENAI_PROJECT_ID` | TBD | checked |
| GPT-5 access confirmed by `pnpm verify:openai-readiness` | TBD | PASS/FAIL |
| GPT-5 mini access confirmed by `pnpm verify:openai-readiness` | TBD | PASS/FAIL |
| `LLM_DAILY_BUDGET_USD` launch cap confirmed | TBD | number only |

## Anthropic Fallback

| Item | Result | Evidence |
|---|---:|---|
| `ANTHROPIC_API_KEY` configured in Vercel | TBD | presence only |
| Fallback path covered by `pnpm verify:llm-resilience-readiness` | TBD | PASS/FAIL |
| Fallback usage/cost monitoring owner assigned | TBD | owner only |

## Toss Payments

| Item | Result | Evidence |
|---|---:|---|
| Toss live client key configured | TBD | `live_gck_` prefix only |
| Toss live secret key configured | TBD | `live_gsk_` prefix only |
| Success URL is `${NEXT_PUBLIC_APP_URL}/api/payments/feature/confirm` | TBD | URL path only |
| Fail/cancel URL is `${NEXT_PUBLIC_APP_URL}/payments/fail` | TBD | URL path only |
| Business/payment method settings approved for live traffic | TBD | checked |
| Live low-value feature payment smoke completed | TBD | toss_order_id/feature_ref only |
| Duplicate confirm did not double-confirm/unlock feature | TBD | toss_order_id/feature_ref only |
| Refund/cancel operating owner confirmed | TBD | owner only |
| Manual monetary refund/cancel drill completed or explicitly deferred | TBD | toss_order_id/owner only |

## Sentry / Operations

| Item | Result | Evidence |
|---|---:|---|
| Server DSN configured | TBD | presence only |
| Browser DSN configured | TBD | presence only |
| Default PII collection disabled | TBD | checked |
| Payment confirm failure alert exists | TBD | alert name only |
| LLM timeout/rate-limit/provider outage alert exists | TBD | alert name only |
| 5xx spike alert exists | TBD | alert name only |
| Rollback owner and trigger are recorded | TBD | owner/trigger only |

## Verification Commands

Run after dashboard values are configured and Vercel is redeployed.

Note: Vercel dashboard env values are not automatically available to a local terminal. Run the full launch gate from a shell, CI job, or validation environment that has production-equivalent env values loaded. Record only command PASS/FAIL summaries, never the secret values.

```bash
pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app
pnpm print:vercel-env-plan
pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app
pnpm verify:external-settings-readiness
pnpm verify:external-settings-checklist
pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-06-01_production.json
pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_2026-06-01_production.json --out docs/qa/launch_evidence_2026-06-01_production.md --environment Production --go-no-go "조건부 가능"
pnpm verify:launch-evidence-readiness docs/qa/launch_gate_2026-06-01_production.json docs/qa/launch_evidence_2026-06-01_production.md docs/qa/external_settings_checklist.md
```

`서비스 오픈 가능`은 이 checklist와 production evidence의 dashboard/smoke/payment/monitoring/canary/decision 항목이 모두 채워진 뒤 수동으로만 기록한다.
