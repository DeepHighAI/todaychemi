# scripts/ — 운영 스크립트

- `verify-ssaju-accuracy.ts` — G0 게이트 만세력 검증
- `create-launch-evidence.ts` — `verify-launch-readiness --summary-json` 결과를 PII/secret-free launch evidence Markdown 초안으로 변환 (`--go-no-go`는 자동 생성 시 `조건부 가능|오픈 보류`만 사용; `서비스 오픈 가능`은 production evidence 수동 증거 작성 후 verifier로 검증)
- `print-launch-dashboard-plan.ts` — Vercel/Supabase Auth/Google/Kakao/OpenAI/Anthropic/Toss/Sentry 설정 순서를 한국어로 출력하고, `--origin` 입력 시 파생 dashboard URL을 secret-free로 표시 (`pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app`)
- `print-vercel-env-plan.ts` — Vercel Production/Preview에 넣을 launch env key와 비워둘 legacy alias를 secret-free로 출력 (`pnpm print:vercel-env-plan`)
- `run-e2e.ts` — Next dev 서버 시작/대기/Playwright 실행/프로세스 정리를 수행하는 E2E runner. 배포 URL smoke는 shell-neutral `pnpm e2e -- --base-url <url>` 형식을 지원 (`pnpm e2e:auth`는 `@auth` smoke만 opt-in 실행)
- `verify-launch-env.ts` — 런칭 필수/권장 환경변수 누락과 `.env.example`/`docs/specs/secrets.md` catalog drift 점검 (값은 출력하지 않음)
- `verify-secret-boundary-readiness.ts` — Client Component import graph에 server-only env가 섞이지 않는지 점검
- `verify-launch-audit-readiness.ts` — 최종 감사/백로그/승인/수동설정/evidence/runbook 산출물이 빠지지 않았는지 점검
- `verify-launch-readiness.ts` — 런칭 readiness 게이트 통합 실행 (`tsc`/`lint`/`vitest`/`build`, external settings checklist, Supabase dry-run, 보안·결제·LLM·E2E 하위 게이트 포함; `--summary-json <path>`로 secret-free 결과 JSON 저장 가능)
- `verify-launch-waiting-state.ts` — launch summary/evidence가 같은 결과쌍이고 required failure 행이 정확히 일치하며 알려진 외부 설정 blocker만 남은 대기 상태인지 빠르게 점검 (`pnpm verify:launch-waiting-state -- --summary-json <path> --evidence <path>`)
- `verify-known-external-blockers.ts` — launch summary JSON의 required failure가 알려진 외부 dashboard/env blocker 6개와 정확히 일치하고 전체 launch-required gate 결과가 누락되지 않았는지 점검 (`pnpm verify:known-external-blockers -- --summary-json <path>`)
- `verify-external-settings-readiness.ts` — Vercel/Supabase Auth/OpenAI/Toss/Sentry 설정과 operator checklist evidence를 빠르게 재검증하고, 실패 시 `docs/runbooks/external_launch_settings.md`와 `docs/qa/external_settings_checklist.md`를 안내 (`pnpm verify:external-settings-readiness`)
- `verify-external-settings-checklist.ts` — 외부 설정 체크리스트의 TBD 제거와 secret/PII-free 상태를 오픈 직전에 검증 (`pnpm verify:external-settings-checklist`)
- `verify-origin-shape-readiness.ts` — Vercel Production origin이 path/query/hash/trailing slash 없는 `https://...` 형태인지 확인하고 Supabase/Auth/OAuth/Toss dashboard에 넣을 파생 URL을 secret-free로 출력 (`pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app`)
- `verify-launch-evidence-readiness.ts` — launch summary/evidence/checklist artifacts에 secret 값, 원본 PII 직렬화, summary/evidence 불일치, 비정상 Go/No-Go 판정 구조, 오픈 가능 evidence의 미작성 TBD/운영 증거 섹션/checklist 누락이 섞이지 않았는지 점검
- `verify-e2e-coverage-readiness.ts` — 런칭 핵심 플로우별 Playwright 커버리지 존재 여부를 정적으로 점검
- `verify-billing-policy-readiness.ts` — 과금 문서·코드·테스트 drift와 승인 필요 유료화 결정을 read-only 점검
- `verify-db-rls-readiness.ts` — migration contract + table RLS static checks + live Supabase RLS integration 점검
- `verify-llm-boundary-readiness.ts` — LLM PII 최소화·store:false·점수 격리·결정형 점수 테스트 게이트
- `verify-llm-resilience-readiness.ts` — OpenAI timeout/retry/error UX와 Claude fallback/circuit breaker/budget runtime readiness 및 LLM cost-tracking fail-closed 점검
- `verify-auth-readiness.ts` — Auth/OAuth redirect, legal consent, password policy, Kakao env readiness 점검
- `verify-openai-readiness.ts` — OpenAI ZDR 프로젝트/env, canonical project-routed client, LLM storage/PII guard readiness 점검
- `verify-ops-readiness.ts` — Sentry/운영 런북/E2E 자동화 readiness 점검
- `verify-supply-chain-readiness.ts` — `pnpm audit --prod --json` 기반 production high/critical advisory readiness 점검
- `verify-payment-flow-readiness.ts` — 결제 성공/실패/중복/토큰차감/환불 플로우 소스 불변식과 focused tests 점검
- `verify-toss-live-readiness.ts` — Toss live key prefix, production origin, success/fail redirect source invariant 점검
- `verify-payment-readiness.ts` — 결제 코드가 요구하는 원격 Supabase 컬럼과 pay-per-use 결제 스펙 정합성을 read-only로 점검
- `verify-supabase-security-readiness.ts` — 보호 RPC의 search_path/revoke/grant migration readiness 점검
- `verify-vercel-readiness.ts` — Vercel 링크와 production origin 설정을 로컬에서 점검

실행: `pnpm tsx scripts/verify-ssaju-accuracy.ts`  
참고: `docs/specs/manseryeok_validation.md`
