# launch_opening.md - 서비스 오픈 당일 런북

> 목적: Vercel production 배포와 유료 부적 결제를 실제 사용자에게 열기 전, 필요한 승인과 검증 증거를 한 번에 확인한다. 본 런북은 값을 출력하지 않으며, 비밀키는 Vercel/Supabase/Toss/OpenAI/Sentry dashboard에서만 확인한다.

## 0. 진입 조건

오픈 당일 절차는 아래 조건이 모두 충족된 뒤 시작한다.

- `docs/qa/launch_readiness_2026-05-30.md`의 P0 항목이 모두 닫혀 있다.
- AGENTS.md §1.1 승인 대상인 DB/RLS, 과금 정책, LLM fallback/model routing, 보안/개인정보 범위, dependency 변경이 승인 및 반영돼 있다.
- Supabase remote migrations가 local migrations와 일치한다.
- Vercel production/preview env가 `.env.example`의 launch 필수 키를 포함한다.
- MVP에서 별도 도메인을 아직 구매하지 않았다면 Vercel 기본 Production `*.vercel.app` URL을 `NEXT_PUBLIC_APP_URL`로 사용한다. Preview URL이나 deploy hash URL은 production origin으로 쓰지 않는다.
- Toss live keys, success/fail URL, 결제수단, 사업자 설정이 live dashboard에서 확인돼 있다.
- OpenAI production project의 ZDR 상태와 `OPENAI_PROJECT_ID` routing이 확인돼 있다.
- Sentry server/browser DSN과 payment/LLM/5xx alert가 켜져 있다.

## 1. 로컬 최종 게이트

아래 명령은 같은 commit에서 순서대로 실행한다.

```bash
pnpm tsc --noEmit
pnpm lint
pnpm vitest run
pnpm build
pnpm audit --prod
pnpm verify:supply-chain-readiness
pnpm verify:external-settings-readiness
pnpm verify:external-settings-checklist
pnpm verify:launch-readiness
pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_<date>_<env>.json
pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_<date>_<env>.json --out docs/qa/launch_evidence_<date>_<env>.md --environment <Local|Preview|Production> --domain https://<vercel-production-url>
pnpm verify:launch-evidence-readiness docs/qa/launch_gate_<date>_<env>.json docs/qa/launch_evidence_<date>_<env>.md docs/qa/external_settings_checklist.md
```

기대 결과:

- `pnpm verify:launch-readiness`가 PASS여야 production 오픈으로 진행한다.
- `pnpm verify:external-settings-readiness`는 dashboard/env/checklist evidence 관련 blocker를 빠르게 재확인하는 preflight이며, 이것만으로는 오픈 판정에 충분하지 않다.
- `--summary-json` 결과는 secret-free 상태/exit/duration만 담으므로 evidence 문서에 경로를 남긴다.
- `pnpm create:launch-evidence`는 summary JSON을 날짜별 evidence 문서 초안으로 변환한다. dashboard/smoke/Toss/Sentry 증거는 운영자가 수동으로 채운다.
- `--go-no-go`를 생략하면 FAIL summary는 `오픈 보류`, PASS summary는 `조건부 가능`으로 기록한다. 자동 생성기로 `서비스 오픈 가능`을 바로 기록하지 않는다. production smoke와 live feature payment/unlock/token ledger 증거를 수동으로 채운 뒤 evidence 문서의 판정값을 변경하고 verifier를 통과시킨다.
- PASS summary가 `조건부 가능` 초안을 만들더라도 dashboard/smoke/payment/monitoring/canary evidence와 Decision 섹션의 `Reason`, `Known risks accepted`, `Rollback trigger`, `Next review time`은 수동으로 채운다. launch summary JSON과 외부 설정 체크리스트를 함께 검증하지 않거나 이 필드가 비어 있으면 `pnpm verify:launch-evidence-readiness`가 실패한다.
- `pnpm verify:launch-evidence-readiness`는 evidence artifact와 외부 설정 체크리스트에 secret 값이나 원본 PII 직렬화가 없는지 검사한다.
- 실패한 항목이 있으면 해당 P0/P1 항목에 증거를 붙이고 오픈을 중단한다.
- `pnpm audit --prod`는 high/critical production advisory가 0이어야 한다.

## 2. Preview 배포 검증

Vercel Preview URL이 준비되면 production alias를 전환하기 전에 preview를 먼저 검증한다.
`--base-url` 값은 path/query/hash가 없는 origin만 입력한다.

```bash
pnpm e2e -- --base-url https://<preview-url>
pnpm e2e:auth -- --base-url https://<preview-url>
```

Preview dashboard 확인:

- Supabase Auth redirect URL에 preview `/auth/callback`이 포함돼 있다.
- Google/Kakao OAuth provider가 preview redirect와 충돌하지 않는다.
- Vercel Preview env에 production secret이 실수로 노출되지 않았고, 필요한 preview secret만 들어 있다.
- Sentry event가 preview release/environment로 수집된다.
- live feature payment는 preview에서 열지 않는다. 결제 실거래 테스트는 Toss live dashboard 승인 범위에 따라 production 직전 window에서만 수행한다.

## 3. Production 배포 직전 수동 확인

Production 전환 직전에 dashboard에서 아래를 캡처하거나 기록한다.

- Vercel: project, production `*.vercel.app` URL 또는 자체 도메인, target commit SHA, env presence, rollback 가능한 이전 deployment.
- Supabase: project ref `jamhkucluhiibqpjsiov`, migration history, Auth Site URL, Redirect URLs, provider enablement, leaked-password protection 결정.
- Supabase Security Advisor: token/payment/admin SECURITY DEFINER RPC가 `anon`/`authenticated`로 실행 불가.
- Toss: live client/secret key 활성, success/fail URL, 결제수단, 결제 취소/환불 운영 권한.
- Toss monetary refund/cancel automation is not part of MVP. Before public traffic, confirm the manual dashboard owner, export-before-repair rule, and either a low-value refund/cancel drill or an explicit launch deferral reason in evidence.
- OpenAI: production org/project, ZDR evidence, model access, quota.
- Sentry: release, server/browser DSN, alert rules.

## 4. Production smoke

Production origin으로 전환 후 아래 순서로 smoke를 실행한다. MVP에서 자체 도메인을 쓰지 않는다면 `<production-origin>`은 Vercel 기본 Production `*.vercel.app` URL이다.
`--base-url` 값은 `https://<production-origin>`처럼 origin만 입력하고 `/login`, `/auth/callback`, query, hash는 붙이지 않는다.

```bash
pnpm e2e -- --base-url https://<production-origin>
pnpm e2e:auth -- --base-url https://<production-origin>
pnpm verify:launch-readiness
```

수동으로 추가 확인한다.

- 회원가입/로그인/OAuth callback이 production origin에서 돌아온다.
- onboarding 후 today/me 진입이 가능하다.
- relation create, feed, hapcard, replay, whatif, me wallet이 production DB에서 정상 동작한다.
- Toss live 결제 success/fail/cancel이 의도한 UI와 token ledger를 만든다.
- Toss 금전 환불/취소는 MVP에서 수동 dashboard 운영이다. live 저액 주문으로 환불/취소 드릴을 하거나, 하지 않는다면 owner와 보류 사유를 evidence에 기록한다.
- replay token 차감, 실패 시 refund, 중복 요청 idempotency가 ledger에서 확인된다.
- OG image/share URL, 401/404/500 error UI가 production에서 깨지지 않는다.
- Sentry에 PII 5필드와 gender 원본이 수집되지 않는다.

## 5. 오픈 판정

판정은 세 가지 중 하나만 기록한다.

- 서비스 오픈 가능: 모든 P0 PASS, production smoke PASS, live feature payment/unlock/token ledger 증거 확보.
- 조건부 가능: P0는 닫혔고 P1만 남았으며, 운영자가 known risk와 rollback 조건을 명시적으로 승인.
- 오픈 보류: P0 하나라도 열려 있거나 `pnpm verify:launch-readiness`가 FAIL.

판정 결과와 증거는 `docs/qa/launch_evidence_template.md`를 복사한 날짜별 evidence 문서에 기록하고, 요약을 `docs/qa/launch_readiness_2026-05-30.md`에 이어서 남긴다.

자동 evidence 생성 시에는 먼저 Production evidence 초안을 만든다. `서비스 오픈 가능`은 초안 생성 옵션으로 사용하지 않고, dashboard/smoke/payment/monitoring/canary evidence와 decision field를 모두 채운 뒤 수동으로 기록한다.

```bash
pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_<date>_production.json --out docs/qa/launch_evidence_<date>_production.md --environment Production --domain https://<production-origin>
pnpm verify:launch-evidence-readiness docs/qa/launch_gate_<date>_production.json docs/qa/launch_evidence_<date>_production.md docs/qa/external_settings_checklist.md
```

## 6. 즉시 롤백

문제가 발생하면 아래 순서로 실행한다.

1. Vercel Dashboard에서 last known-good deployment를 production으로 promote한다.
2. 결제 관련 장애이면 paid feature CTA를 숨기거나 관련 Vercel env/feature flag를 내려 신규 결제를 막는다.
3. Toss dashboard에서 추가 결제 노출을 멈추고, 이미 발생한 결제는 `payments.toss_order_id` 기준으로 보존한다.
4. Supabase에서 `payments`와 `token_ledger` before/after row를 먼저 export한 뒤, service-role repair는 별도 승인 후 수행한다.
5. LLM/prompt 문제이면 `docs/runbooks/prompt_rollback.md` 절차로 prompt version을 되돌리거나 deployment를 rollback한다.
6. `docs/runbooks/incident_template.md`를 열고 timeline, user impact, payment impact, data/privacy impact, remediation을 기록한다.

## 7. 사후 기록

오픈 또는 롤백 후 24시간 안에 아래를 남긴다.

- production deployment URL과 commit SHA
- 실행한 명령과 PASS/FAIL 결과
- live payment test order id와 ledger reference id
- Sentry alert/event link
- Supabase migration/security advisor evidence
- Go/No-Go 판정자와 시간
