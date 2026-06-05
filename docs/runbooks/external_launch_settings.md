# External Launch Settings

> 외부 설정값은 provider dashboard 또는 Vercel Environment Variables에만 입력한다. 실제 secret 값은 문서, 이슈, PR, 채팅, 로그에 붙여 넣지 않는다.

## MVP 도메인 원칙

아직 별도 도메인을 구매하지 않은 MVP 오픈은 **Vercel 기본 Production URL**을 임시 공식 주소로 사용한다.

예시:

```env
NEXT_PUBLIC_APP_URL=https://twoday-mvp.vercel.app
```

반드시 지킬 것:

- Vercel Preview URL이 아니라, 프로젝트에 고정으로 붙은 Production `*.vercel.app` 주소를 사용한다.
- `https://` 로 시작해야 한다.
- 끝에 `/` 를 붙이지 않는다.
- `/login`, `/auth/callback` 같은 path를 붙이지 않는다.
- `localhost`, `127.0.0.1`, preview deployment URL은 Production `NEXT_PUBLIC_APP_URL`로 쓰지 않는다.
- 나중에 자체 도메인을 구매하면 `NEXT_PUBLIC_APP_URL`, Supabase Auth URL, Toss redirect URL, Kakao/Google origin을 모두 새 도메인으로 바꾸고 Vercel을 재배포한다.

Production URL 찾는 법:

1. Vercel에서 SAJU/TWODAY 프로젝트를 만든다.
2. 첫 Production 배포를 완료한다.
3. Project Dashboard 또는 Settings → Domains에서 `*.vercel.app` production domain을 확인한다.
4. 그 값을 `NEXT_PUBLIC_APP_URL`로 정한다.

## Setup Order

1. Vercel 프로젝트를 만들고 Production `*.vercel.app` URL을 확인한다.
2. 그 URL을 `NEXT_PUBLIC_APP_URL`로 정한다.
3. Vercel Production과 Preview 환경변수를 아래 표대로 입력한다.
4. Supabase Auth Site URL, Redirect URLs, OAuth provider, leaked-password protection을 설정한다.
5. OpenAI project, ZDR 증거, model access, `LLM_DAILY_BUDGET_USD`를 설정한다.
6. Toss live key와 Vercel Production URL 기반 success/fail URL을 설정한다.
7. Sentry DSN과 alert를 설정한다.
8. 환경변수 저장 후 Vercel에서 최신 커밋을 Redeploy한다.
9. 마지막 검증 명령을 실행하고 launch evidence를 작성한다.

설정을 진행하면서 `docs/qa/external_settings_checklist.md`의 `TBD`를 하나씩 `OK`, `PASS`, `N/A(구체적 사유)`로 바꾼다. 실패한 항목은 `FAIL`로 기록하지 말고 `TBD`로 남겨 둔 뒤 해결한다. 실제 key/secret 값은 적지 않고, origin/path/prefix/owner/alert name/command result만 적는다.

## 빠른 실행 카드

아래 순서대로 한 줄씩 완료하면 된다. 중간에 막히면 해당 줄의 체크리스트 Evidence를 `TBD`로 남기고 다음 값을 임의로 넣지 않는다.

| 순서 | 할 일 | 입력 위치 | 체크할 것 |
|---:|---|---|---|
| 1 | Vercel SAJU/TWODAY project 생성 | Vercel Dashboard | project가 다른 앱이 아님 |
| 2 | Production `*.vercel.app` origin 확정 | Vercel Settings → Domains | `https://...vercel.app`, path 없음 |
| 3 | Vercel env 입력 | Vercel Settings → Environment Variables | Production + Preview 둘 다 |
| 4 | Supabase Auth URL 입력 | Supabase Auth → URL Configuration | Site URL = `NEXT_PUBLIC_APP_URL` |
| 5 | Google/Kakao provider 켜기 | Supabase Auth → Providers | callback은 Supabase callback URL |
| 6 | OpenAI project 선택 | OpenAI Platform | ZDR 확인, `proj_` id, GPT-5 접근 |
| 7 | Anthropic fallback key 입력 | Anthropic Console + Vercel env | key presence만 기록 |
| 8 | Toss live redirect 입력 | Toss Dashboard | success/fail path가 production origin 기준 |
| 9 | Sentry DSN/alert 입력 | Sentry + Vercel env | PII off, alert 3종 |
| 10 | Vercel Redeploy 후 검증 | 로컬 터미널 | 아래 Verification Commands 실행 |

Evidence에는 아래처럼 적는다.

```text
origin=https://<project>.vercel.app, scope=production+preview, checked_at=2026-06-01
```

아래처럼 적지 않는다.

```text
checked
presence only
sk-...
live_gsk_전체값
```

Vercel env 입력 전, 아래 명령으로 넣을 key 목록과 비워둘 legacy alias를 먼저 확인한다.

```bash
pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app
pnpm print:vercel-env-plan
```

## 도메인 미구매 MVP 입력표

이번 MVP는 커스텀 도메인을 사지 않아도 된다. 아래 표에서 `<APP_ORIGIN>`만 실제 Vercel Production URL로 바꾼 뒤 각 dashboard에 그대로 넣는다.

| 이름 | 값 |
|---|---|
| `<APP_ORIGIN>` | `https://<project>.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `<APP_ORIGIN>` |
| Supabase Site URL | `<APP_ORIGIN>` |
| Supabase Redirect URL | `<APP_ORIGIN>/auth/callback` |
| Google Web origin | `<APP_ORIGIN>` |
| Google OAuth callback | `https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback` |
| Kakao Web platform origin | `<APP_ORIGIN>` |
| Kakao OAuth callback | `https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback` |
| Toss Success URL | `<APP_ORIGIN>/api/payments/feature/confirm` |
| Toss Fail/Cancel URL | `<APP_ORIGIN>/payments/fail` |

체크리스트의 custom-domain 관련 Evidence는 아래처럼 기록한다.

```text
custom_domain=not_purchased_for_mvp, trigger=after_market_validation, owner=<name>
```

커스텀 도메인을 구매한 뒤에는 위 표의 `<APP_ORIGIN>`을 새 도메인으로 바꾸고 Vercel env, Supabase Auth, Google/Kakao, Toss redirect를 모두 갱신한 뒤 redeploy한다.

대시보드에 입력하기 전에 아래 명령으로 origin 형식과 파생 URL을 먼저 확인한다. 이 명령은 공개 URL만 출력하고 secret은 읽거나 출력하지 않는다.

```bash
pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app
```

## Checklist 작성 예시

`docs/qa/external_settings_checklist.md`의 Evidence는 "무엇을 확인했는지"가 드러나야 한다. 아래처럼 작성 안내문을 실제 증거 문장으로 바꾼다.

| 항목 | 나쁜 Evidence | 좋은 Evidence |
|---|---|---|
| Vercel project | `project name only` | `project=twoday, origin=https://twoday-mvp.vercel.app, branch=main` |
| Production origin | `origin only` | `origin=https://twoday-mvp.vercel.app, source=Vercel Settings/Domains` |
| OpenAI project | `project name/id prefix only` | `project=TWODAY Production, id_prefix=proj_, zdr=confirmed` |
| Toss live key | `live_gck_ prefix only` | `live client/secret key prefixes confirmed in Vercel Production, no legacy aliases` |
| Sentry alert | `alert name only` | `alerts=payment-confirm-failure,llm-provider-outage,5xx-spike` |

실제 key, full project id, DSN, service role key, token, email, birth_date, nickname, gender 원본은 절대 적지 않는다.

## Dashboard 입력 순서

아래 순서대로 하면 앞 단계에서 정한 URL을 다음 dashboard에 그대로 옮길 수 있다.

### 1. Vercel

1. Vercel team `deephigh`에서 SAJU/TWODAY 전용 project를 만든다.
2. Git repository를 연결하고 Production branch가 `main`인지 확인한다.
3. 첫 Production 배포 후 `https://<project>.vercel.app` 주소를 확인한다.
4. 그 주소를 `NEXT_PUBLIC_APP_URL`로 정한다.
5. Project Settings → Environment Variables에 Env Matrix 값을 넣는다.
6. Production과 Preview scope를 모두 선택한다.
7. 저장 후 Redeploy한다.

체크리스트 Evidence 예시:

```text
project=twoday, origin=https://twoday-mvp.vercel.app, branch=main
```

### 2. Supabase Auth

1. Supabase project가 `jamhkucluhiibqpjsiov`인지 확인한다.
2. Authentication → URL Configuration에서 Site URL을 `NEXT_PUBLIC_APP_URL`과 같게 입력한다.
3. Redirect URLs에 `${NEXT_PUBLIC_APP_URL}/auth/callback`을 추가한다.
4. localhost callback은 로컬 smoke용으로 유지한다.
5. Authentication → Providers에서 Google/Kakao provider를 켠다.
6. Password policy와 leaked password protection을 checklist대로 맞춘다.

체크리스트 Evidence 예시:

```text
site_url=production origin, redirect=/auth/callback, providers=google+kakao
```

### 3. Google / Kakao

1. Google OAuth web origin은 `NEXT_PUBLIC_APP_URL` origin으로 넣는다.
2. Google OAuth callback은 Supabase callback URL을 넣는다.
3. Kakao Web platform origin은 `NEXT_PUBLIC_APP_URL` origin으로 넣는다.
4. Kakao OAuth callback도 Supabase callback URL을 넣는다.
5. Kakao JavaScript key와 Admin key가 Vercel env에 존재하는지만 기록한다.

체크리스트 Evidence 예시:

```text
origin=production origin, callback=supabase auth callback
```

### 4. OpenAI / Anthropic

1. ZDR가 확인된 OpenAI project를 고른다.
2. `OPENAI_API_KEY`와 `OPENAI_PROJECT_ID`가 같은 project인지 확인한다.
3. `OPENAI_PROJECT_ID`는 `proj_...` prefix만 checklist에 기록한다.
4. `LLM_DAILY_BUDGET_USD`를 Vercel env에 숫자로 입력한다.
5. Anthropic production key를 Vercel env에 넣고 fallback owner를 정한다.

체크리스트 Evidence 예시:

```text
project=<선택한 OpenAI project 이름>, id_prefix=proj_, zdr=confirmed, budget=20
```

### 5. Toss Payments

1. Toss dashboard에서 live client key와 secret key를 확인한다.
2. Vercel env에는 `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`만 넣는다.
3. `TOSS_PAYMENTS_CLIENT_KEY`, `TOSS_PAYMENTS_SECRET_KEY` legacy alias는 비워둔다.
4. Success URL은 `${NEXT_PUBLIC_APP_URL}/api/payments/feature/confirm`로 넣는다.
5. Fail/Cancel URL은 `${NEXT_PUBLIC_APP_URL}/payments/fail`로 넣는다.
6. 오픈 직전 최저가 유료 기능 live smoke를 진행하고 `toss_order_id`/`feature_ref`만 evidence에 남긴다.

체크리스트 Evidence 예시:

```text
keys=live_gck/live_gsk present, success=/api/payments/feature/confirm, fail=/payments/fail
```

### 6. Sentry / Operations

1. Sentry project DSN을 Vercel `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`에 넣는다.
2. Sentry에서 default PII 수집이 꺼져 있는지 확인한다.
3. payment confirm failure, LLM provider/rate-limit, 5xx spike alert를 만든다.
4. rollback owner와 trigger를 checklist에 적는다.

체크리스트 Evidence 예시:

```text
alerts=payment-confirm-failure,llm-provider-outage,5xx-spike; owner=<name>
```

## Vercel Env Matrix

아래 값은 특별한 이유가 없으면 Vercel Production과 Preview 양쪽에 모두 입력한다. 값 자체는 문서에 기록하지 않는다.

| Key | 필수 | 어디서 얻나 | 검증 |
|---|---:|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Vercel Production `*.vercel.app` origin | `verify:launch-env`, `verify:vercel-readiness`, `verify:auth-readiness`, `verify:toss-live-readiness` |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project `jamhkucluhiibqpjsiov` API URL | `verify:launch-env`, `verify:db-rls-readiness` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon public key | `verify:launch-env`, `verify:db-rls-readiness` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key | `verify:launch-env`, `verify:db-rls-readiness`, `verify:payment-readiness` |
| `OPENAI_API_KEY` | yes | ZDR 확인된 OpenAI project API key | `verify:launch-env`, `verify:openai-readiness` |
| `OPENAI_PROJECT_ID` | yes | 같은 OpenAI project의 `proj_...` id | `verify:launch-env`, `verify:openai-readiness` |
| `ANTHROPIC_API_KEY` | yes | Claude fallback용 Anthropic production key | `verify:launch-env`, `verify:ops-readiness`, 수동 fallback smoke |
| `LLM_DAILY_BUDGET_USD` | yes | MVP 1일 LLM 예산 한도 | `verify:launch-env`, `verify:ops-readiness`, `verify:llm-resilience-readiness` |
| `KASI_SERVICE_KEY` | yes | KASI API key | `verify:launch-env`, core flow smoke |
| `TOSS_CLIENT_KEY` | yes | Toss live client key, `live_gck_*` | `verify:launch-env`, `verify:toss-live-readiness` |
| `TOSS_SECRET_KEY` | yes | Toss live secret key, `live_gsk_*` | `verify:launch-env`, `verify:toss-live-readiness` |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | yes | Kakao app JavaScript key | `verify:launch-env`, `verify:auth-readiness` |
| `KAKAO_ADMIN_KEY` | yes | Kakao app admin key | `verify:launch-env`, `verify:auth-readiness` |
| `SENTRY_DSN` | yes | Sentry server DSN | `verify:launch-env`, `verify:ops-readiness` |
| `NEXT_PUBLIC_SENTRY_DSN` | yes | Sentry browser DSN | `verify:launch-env`, `verify:ops-readiness` |

런칭 기준으로 아래 legacy alias는 비워둔다.

- `TOSS_PAYMENTS_CLIENT_KEY`
- `TOSS_PAYMENTS_SECRET_KEY`

## OpenAI

권장 설정:

1. OpenAI Platform에서 `TWODAY Production` 같은 production 전용 project를 새로 만든다.
2. 그 project에서 API key를 만든다.
3. 같은 project의 `proj_...` id를 확인한다.
4. Vercel에 `OPENAI_API_KEY`, `OPENAI_PROJECT_ID`를 입력한다.

기존 project 중 하나를 써야 한다면 사용자 결정이 필요하다.

- 선택지는 현재 `Default project` 또는 `AnythingLLM`이다.
- 둘 중 하나를 고른 뒤, 실제 project id 전체가 아니라 `proj_` prefix 형태만 checklist/evidence에 기록한다.
- 두 project 모두 ZDR 상태가 같다면 운영 트래픽 분리 관점에서는 SAJU/TWODAY 전용 project를 새로 만드는 선택이 가장 깔끔하다.
- 기존 project를 재사용할 때는 다른 앱 트래픽, 예산, rate limit, audit evidence가 섞이는지 확인한다.

Default project와 AnythingLLM 중 하나를 고르는 임시 기준:

| 질문 | Default project 사용 | AnythingLLM 사용 | 전용 project 생성 |
|---|---|---|---|
| ZDR 계약/상태가 확인됐나 | 확인된 경우만 | 확인된 경우만 | 새 project에서 확인 |
| 다른 앱 트래픽과 섞이나 | 섞이면 피함 | AnythingLLM 운영 트래픽이 있으면 피함 | 섞이지 않음 |
| 예산/rate limit을 따로 보고 싶은가 | 어려울 수 있음 | 어려울 수 있음 | 가장 좋음 |
| launch evidence를 설명하기 쉬운가 | 보통 | 보통 | 가장 좋음 |

MVP launch에서 가장 깔끔한 선택은 `TWODAY Production` 전용 project다. 새 project를 만들 수 없다면, ZDR와 GPT-5/GPT-5 mini 접근이 먼저 확인되는 쪽을 고르고 checklist에는 project 이름과 `id_prefix=proj_`만 기록한다.

주의:

- `OPENAI_API_KEY`와 `OPENAI_PROJECT_ID`는 반드시 같은 project 기준이어야 한다.
- ZDR 적용 여부는 OpenAI dashboard/계약 증거로 별도 확인한다.
- `pnpm verify:openai-readiness`는 `OPENAI_PROJECT_ID`가 유효하면 GPT-5/GPT-5 mini access 확인까지 이어간다.
- `LLM_DAILY_BUDGET_USD`는 MVP 첫날에는 `20`을 기본 추천한다. 더 조심스럽게 시작하려면 `5` 또는 `10`으로 시작한다.
- LLM 모델 또는 prompt 변경은 AGENTS.md §1.1 승인 대상이다.

## Anthropic Fallback

Claude fallback은 approved LLM resilience 경로라 launch env에 필요하다.

1. Anthropic Console에서 production key를 만든다.
2. Vercel에 `ANTHROPIC_API_KEY`를 입력한다.
3. 모델을 명시적으로 바꿀 때만 `ANTHROPIC_FALLBACK_MODEL`을 추가한다. 기본값은 `claude-sonnet-4-5`다.

앱은 fallback 사용량을 `llm_cost_tracking`에 `provider='anthropic'`, `model='claude-fallback'`로 기록한다.

## Vercel

1. Vercel team `deephigh`에서 SAJU/TWODAY 전용 프로젝트를 만들거나 올바른 기존 프로젝트를 연결한다.
2. 현재 connector 기준으로는 `3eyes`만 보였으므로, SAJU/TWODAY는 아직 linked 상태로 보지 않는다.
3. 프로젝트가 연결되면 `.vercel/project.json`에 해당 project의 `projectId`, `orgId`가 생기는지 확인한다.
4. 첫 Production 배포 후 Project Dashboard 또는 Settings → Domains에서 production `*.vercel.app` URL을 확인한다.
5. 그 URL을 `NEXT_PUBLIC_APP_URL`로 Vercel Production/Preview env에 입력한다.
6. Env Matrix의 나머지 값을 모두 입력한다.
7. 환경변수 저장 후 최신 커밋을 Redeploy한다.

Production URL 예시:

```env
NEXT_PUBLIC_APP_URL=https://twoday-mvp.vercel.app
```

Preview env에도 같은 값을 넣는다. Preview 배포마다 바뀌는 URL을 `NEXT_PUBLIC_APP_URL`로 쓰지 않는다.

## Supabase Auth

Supabase project ref는 반드시 `jamhkucluhiibqpjsiov`다.

Authentication → URL Configuration:

```text
Site URL:
https://<vercel-production-url>

Redirect URLs:
https://<vercel-production-url>/auth/callback
http://localhost:3000/auth/callback
http://localhost:3100/auth/callback
```

Preview OAuth smoke를 반드시 해야 하는 경우에만 Preview origin을 추가한다.

```text
https://<vercel-preview-origin>/auth/callback
```

Auth provider checklist:

- Google provider enabled.
- Kakao provider enabled if Kakao login/share callback is in launch scope.
- Kakao email optional setting matches `docs/specs/auth.md`.
- Email/password minimum password length: `8`.
- Password strength: letters plus digits.
- Sign-in/sign-up rate limit: `10` per 5 minutes.
- Leaked password protection enabled before public launch.

Google/Kakao developer console:

```text
Web origin:
https://<vercel-production-url>

OAuth callback:
https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback
```

## Toss Payments

Production에는 live key만 사용한다.

```env
TOSS_CLIENT_KEY=live_gck_...
TOSS_SECRET_KEY=live_gsk_...
```

Toss dashboard에 Vercel Production URL 기준 redirect를 등록한다.

```text
Success URL:
https://<vercel-production-url>/api/payments/feature/confirm

Fail/Cancel URL:
https://<vercel-production-url>/payments/fail
```

오픈 전 live smoke:

1. 무료 부적이 부족한 계정으로 합카드/만약합/다시합 중 하나를 열어 feature pay sheet를 띄운다.
2. 실제 저액 결제 1건을 진행하고 원래 기능 화면으로 `paid=<ref>`가 붙어 복귀하는지 확인한다.
3. `payments.status='confirmed'`, `charge_type='feature_use'`, `feature_id`, `feature_ref`를 확인한다.
4. 유료 결제로 `token_ledger.reason='purchase'` 또는 잔액 증가가 생기지 않는지 확인한다.
5. 취소/실패 URL도 실제 화면에서 안전하게 표시되는지 확인한다.
6. 중복 confirm 요청이 결제 확정/잠금해제를 중복 처리하지 않는지 확인한다.

## Sentry / Operations

Vercel Production과 Preview에 둘 다 입력한다.

```env
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
```

오픈 전 alert:

- payment confirm failure spike
- LLM timeout/rate-limit/provider outage spike
- 5xx error-rate spike

Sentry 설정에서 default PII 전송이 꺼져 있는지 확인한다. 이 프로젝트의 Sentry client/server/edge 설정은 default PII 비활성화를 전제로 검증한다.

## After Setting Values

외부 값을 채우는 동안에는 빠른 확인부터 실행한다. `pnpm verify:external-settings-readiness` 안에는 checklist 검증도 포함되어 있지만, 실패 위치를 더 빨리 보려면 checklist 명령을 바로 한 번 더 실행한다.

중요: Vercel dashboard에 입력한 환경변수는 로컬 터미널의 `pnpm verify:launch-readiness`가 자동으로 읽지 않는다. 전체 launch gate는 다음 둘 중 하나에서 실행한다.

1. production과 같은 값이 주입된 로컬 shell 또는 `.env.local`에서 실행한다. 값 자체는 문서나 로그에 남기지 않는다.
2. 같은 환경변수가 주입된 CI/운영 검증 환경에서 실행한다.

Vercel dashboard 설정 증거는 `docs/qa/external_settings_checklist.md`에 secret-free로 기록하고, full gate 실행 증거는 launch evidence 파일에 command 결과만 기록한다. Vercel env를 바꾼 뒤에는 반드시 redeploy한 다음 production smoke를 실행한다.

```bash
pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app
pnpm print:vercel-env-plan
pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app
pnpm verify:external-settings-readiness
pnpm verify:external-settings-checklist
```

모두 통과하면 전체 launch gate를 실행한다.

```bash
pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-06-01_production.json
```

그 다음 production evidence 초안을 만든다. `서비스 오픈 가능`은 자동 생성하지 않는다.

```bash
pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_2026-06-01_production.json --out docs/qa/launch_evidence_2026-06-01_production.md --environment Production --go-no-go "조건부 가능"
```

Evidence 파일에 dashboard evidence, production smoke, live feature payment/unlock/token ledger evidence, monitoring, canary, decision을 직접 채운 뒤 검증한다.
`조건부 가능` 상태로 남기더라도 Production evidence여야 하며, launch summary JSON과 외부 설정 체크리스트를 함께 검증하고 `Reason`, `Known risks accepted`, `Rollback trigger`, `Next review time`을 반드시 채운다.

```bash
pnpm verify:launch-evidence-readiness docs/qa/launch_gate_2026-06-01_production.json docs/qa/launch_evidence_2026-06-01_production.md docs/qa/external_settings_checklist.md
```

`서비스 오픈 가능` 판정은 다음 조건이 모두 충족될 때만 수동으로 올린다.

- `pnpm verify:launch-readiness` PASS.
- `pnpm verify:external-settings-checklist` PASS.
- Production smoke PASS.
- Live Toss 결제/실패/취소/중복요청/token ledger evidence 기록 완료.
- Sentry alert와 canary evidence 기록 완료.
- Rollback trigger와 rollback owner 기록 완료.
