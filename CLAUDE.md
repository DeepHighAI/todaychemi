# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 본 문서는 오늘사이(TWODAY) 프로젝트 전용 규칙이다. 보편 규칙은 `C:\DEV\CLAUDE.md`(상위 디렉토리)를 참조하며 중복 작성하지 않는다.

---

## 1. 필수 규칙 (사용자 확정, 절대 우선)

이 다섯 규칙은 다른 모든 가이드보다 우선한다. 위반 시 작업을 중단하고 사용자에게 보고할 것.

### 1.1 중요한 의사결정은 반드시 사용자에게 묻고 진행
"중요한 의사결정"의 범위:
- ADR 신규 작성·수정·폐기
- 기획서/PRD 섹션 의미 변경 (오탈자 수정 제외)
- 가격·과금·Phase 범위·6모드 taxonomy 변경
- 라이브러리 채택·교체 (잠금된 스택 외 추가)
- DB 스키마 변경, RLS 정책 변경
- LLM 모델·프롬프트 버전 변경
- 보안·개인정보 처리 범위 변경

→ `AskUserQuestion` 또는 직접 질문으로 사용자 승인 후 진행. 임의 가정 금지.

### 1.2 모든 코드는 개발 후 스킬로 테스트·검증
구현이 끝나면 다음 스킬 중 적합한 것을 호출하여 검증한다 (§10 매핑 표 참조):
- `/qa` — 기능 테스트 + 버그 수정
- `/qa-only` — 보고만, 수정 금지
- `/review` — PR 머지 전 최종 검토
- `/design-review` — 시각 QA + 수정
- `/browse` — 헤드리스 브라우저 동작 확인
- `/codex` — 2차 의견·도전·상담

검증 없이 "완료" 보고 금지. 어떤 스킬을 어떤 결과로 돌렸는지 명시.

### 1.3 테스트 중 관련 없는 코드는 절대 수정 금지
QA·디버깅·E2E 실행 중 발견한 *별개의* 이슈는:
1. 즉시 메모(§13 위치)에 기록
2. 현재 작업 완료 후 사용자에게 별도 보고
3. 사용자 승인 전에는 수정 금지

같은 PR에 무관한 리팩터링/정리 commit 추가 금지. 한 번에 한 가지 변경.

### 1.4 컨텍스트 60% 도달 시 오토메모리로 압축·인계

**적용 대상: Opus·Sonnet 모델 모두, 예외 없음.**

컨텍스트 사용량이 60%를 넘으면 즉시 아래 절차를 실행한다:

1. **상태 저장** — 진행 중 결정·미결 질문·다음 단계를 `session_<task>_handoff_<date>.md`로 작성
   - 완료된 파일 목록 + 미완료 파일 목록
   - 다음 세션에서 재개할 정확한 위치 (파일명·섹션명)
   - 작업 중인 타입 인터페이스·활성 ADR 번호
2. **인덱스 갱신** — `MEMORY.md`에 핸드오프 파일 1줄 추가
3. **CLAUDE.md 갱신** — §2 프로젝트 상태 업데이트 (완료된 것 반영)
4. **사용자 알림** — "컨텍스트 XX%, 압축 완료. 새 세션을 시작해 주세요." 보고
5. **새 세션 복원** — 세션 시작 시 `MEMORY.md` → 핸드오프 파일 순으로 읽어 컨텍스트 복원 후 작업 재개

**자율 이어가기 금지**: 압축 후 같은 세션에서 작업을 계속하면 안 된다. 반드시 새 세션을 시작해야 한다.

압축 시 보존 의무 항목은 §11 참조.

### 1.5 반복 실수·중요한 개발 메모는 별도 기록
다음은 발견 즉시 기록한다 (§13 위치):
- 같은 실수를 두 번 이상 한 경우
- 잠금된 ADR을 위반할 뻔한 시도
- 잘 알려지지 않은 명리 도메인 함정 (시나리오 추정 모드, 음력 변환 엣지케이스 등)
- 외부 API 동작 차이 (KASI vs ssaju vs manseryeok-js 불일치)
- 비결정형 결과를 만든 코드 패턴 (LLM이 점수에 개입 등)

기록 → 다음 작업 진입 전 해당 메모 확인이 의무.

### 1.6 모든 UI 작업은 UIDesign/ 와이어·디자인 시스템 준수 (비협상, 2026-05-06 확정)

- **시각적 단일 진실**: `UIDesign/system.css`(토큰), `UIDesign/primitives.jsx`(공용 컴포넌트), `UIDesign/screens-*.jsx`(화면)
- `UIDesign/` 자체는 **수정 금지**(§2와 동일). 프로덕션 구현은 반드시 `src/`에 작성.
- 화면 신규·수정 시 대응 와이어가 있으면 그것을 따름. 없으면 §1.1 사용자 승인 후 진행.
- **디자인 토큰**은 `src/app/globals.css` CSS 변수로만 정의. 컴포넌트 인라인 스타일·매직 넘버 금지.
- **"Toss × iOS 26 × M3 Expressive"** 무드 변경은 §1.1 승인 대상.
- 완료 검증: `/design-review` 또는 `/qa` 스킬로 와이어 일치 확인 후 보고.

---

## 2. 프로젝트 상태 (2026-05-10 기준)

- **Phase 0 G0 게이트 ✅ 100% PASS** — KASI vs ssaju 100/100 (normal 50/50, boundary 30/30, edge 20/20). normalize.ts ssaju 프로덕션 승격 완료(年/月/時柱). 야자시 = 조자시 통합 학파.
- **PR-1 완료** — Next.js 16.2.4 스캐폴드 생성됨. `pnpm dev` 정상 동작.
- **PR-3 완료** — KASI 진본 검증 라이브러리 + 100건 픽스처 + G0 verify 100% PASS.
- **PR-2 완료 ✅** — C-4(SQL 20개) + C-7(RLS 통합 39개) + C-5(Auth 전체 구현) + C-6(prompt_versions 시드 6건) 전체 완료. **154/154 tests PASS** (17 files). tsc 0 errors. Supabase Free `jamhkucluhiibqpjsiov` 적용 완료.
  - C-5: `src/lib/auth/kakao.ts` + `src/app/auth/callback/route.ts` + `src/app/login/page.tsx` 완료.
  - C-6: `scripts/seed-prompts.ts` + `pnpm seed:prompts` → 6모드 v0.2 active 시드 완료.
- **F3 완료** — `prompts/system/` 6모드 system prompt v0.2 작성 완료 (commit `5f9625e`). 명리 specialist 검수 대기.
- **`.env.local` 완성** — KASI_SERVICE_KEY, OPENAI_API_KEY, Supabase 키 6개, KAKAO 3개 모두 입력 완료. `KAKAO_REDIRECT_URI` = `jamhkucluhiibqpjsiov` (2026-05-04 수정).
- `UIDesign/` 는 Babel CDN 기반 참조 프로토타입 — **수정 금지**, 프로덕션 코드는 `src/app/`에 작성

**F4 완료 ✅ + G4 RAG 시드 완료 (2026-05-05)** — **508/508 PASS**, 0 TS errors.
- Step 1~14 전체 완료. 주요 커밋: Step 11(`060e74f`) · Step 12(`335bb68`) · Step 13(`d922182`) · 이슈 수정(`ac0885e`) · docs 메모리 갱신(`daf7e1e`).
- `supabase db push 0021_classics` ✅ — RLS 통합 41/41 PASS.
- `rag_content/classics/` YAML 20건 시드 완료 (`approved_ai_pending_human`) — §7.2 명리 specialist 크라우드 검수 미수행, 향후 필요.

**F5 Sprint 진행 중 (2026-05-06)** — **767/767 PASS**, 0 TS errors.
- B1+B3 완료(jsdom+testing-library, route groups). B5(타입 리프트) + S-00(Kakao→Google OAuth) + S-01-A(로그인 polish) 완료. S-01-B+S-02(온보딩 단일 페이지) 완료. S-03(인연 등록 단일 페이지) 완료. S-04(합피드 페이지) 완료. S-05(합카드 호출 + 에러 UX) 완료. S-06(합카드 9섹션) 완료. S-06c-a(glossary tooltip) + S-06c-b(glossary bottom sheet) 완료. **S-06b(mini_radar 오각형 오버레이) 완료**. **chart 컴퓨트 A-eager 완료 — chartPending 영구 차단 해소** ✅.
- 완료 커밋: `6abc2a4`(B5 types) · `ab1c87e`(S-00 Google OAuth) · `199b89f`(S-01-A 로그인) · `7e21788`(onboarding types) · `0731125`(onboarding page+route) · `c44059b`(relation types) · `9935f32`(relations page+route) · `b6bb288`(GET /api/relations) · `e707d11`(feed page+grid) · `c3e07bf`(theory version const) · `ef30b5a`(feed mode query) · `dd10783`(hapcard page S-05) · `0c65f52`(S-06 9 sections compose) · `138b778`(S-06c-a glossary tooltip) · `a520141`(S-06c-b glossary bottom sheet) · `6f8bd68`(S-06b mini_radar) · `fcab0ee`(chart-hash) · `02ac388`(compute) · `72e149b`(onboarding eager) · `f4ad43f`(relations eager).
- §1.3 별도 이슈 잔여: ESLint 9 다운그레이드 별도 PR → **✅ 완료(12ae939)**. Kakao redirect_uri 동기화(사용자 보류). Supabase Google provider 활성화(Dashboard 수동). PR-2 시점 untracked 파일 정리(§1.1 결정 필요).
- **S-07a share 완료 ✅** — build-share-payload + share-handler(Web Share+clipboard) + ShareSheet(Drawer) + HapcardShare 통합 + page 배선. `docs/specs/replay.md` 작성 완료(§1.1 D1~D4 결정 매트릭스).
- S-07a 커밋: `99628c0`(build-share-payload) · `f4667eb`(share-handler) · `153d277`(ShareSheet) · `17bd916`(type fix) · `389b901`(HapcardShare+page wiring) · `0e2a8fa`(replay spec).
- §1.3 별도 이슈 잔여: ESLint 9 다운그레이드 별도 PR → **✅ 완료(12ae939)**. Kakao redirect_uri 동기화(사용자 보류). Supabase Google provider 활성화(Dashboard 수동). PR-2 시점 untracked 파일 정리(§1.1 결정 필요). `relation_nickname`/`relation_gender_normalized` builder.ts JOIN → **✅ 완료(7a0cb8c)**.
- **S-07b Replay 완료 ✅ (2026-05-06)** — buildReplay async 함수 + POST /api/hapcards/[id]/replay route handler GREEN. 커밋 `c69acff`. **805/805 PASS**, 0 TS errors.
- **`supabase db push 0022+0023` 적용 완료 ✅ (2026-05-06)** — `deduct_tokens` / `refund_tokens` RPC + `hapcard_replays_idempotency` UNIQUE 제약 라이브 반영. 검증 스크립트 `scripts/verify-replay-migrations.ts`.
- **후속 작업 완료 ✅ (2026-05-06)**:
  - Task 1 (`b9e4e72`): `database.types.ts` 재생성 → route.ts tokenRpc 캐스트 제거.
  - Task 2 (`7a0cb8c`): `relation_nickname`/`relation_gender_normalized` builder.ts JOIN 연결 + vitest testTimeout 15s 상향 (jsdom cold-load 회귀 해소). **810/810 PASS**, 0 TS errors.
  - Task 4 (`aa729ff`): `docs/specs/payments.md:271` `'hapcard'` → `'hapcard_use'` 정정.
- **§1.3 별도 이슈 잔여**: ESLint 9 다운그레이드 별도 PR → **✅ 완료(12ae939)**. `payments.md:271` `'refund'` ↔ `'bonus'` 불일치 → **✅ 완료(e3a6a03)**. 라우트 `'replay_refund'` reason → **✅ 완료(route.ts:115 canonical)**.
- **다음**: F5 sprint 이후 작업 §1.1 결정 대기.
- **§1.1 결정 2건 완료 ✅ (2026-05-06)**:
  - Decision 2 (`e3a6a03`): `token_ledger.reason` enum 6값 doc-only 동기화 — `db_schema.md:319` + `payments.md:271` + `0009_token_ledger.sql:6`. **810/810 PASS**, 0 TS errors.
  - Decision 1 (`12ae939`): ESLint flat config 마이그레이션 — `eslint.config.mjs` 신규 + `package.json` lint 스크립트 `eslint .` + eslint `10→9` 다운그레이드(typescript-eslint v8 호환). `pnpm lint` PASS (0 errors, 7 warnings). **810/810 PASS**, 0 TS errors.
- **§1.3 별도 이슈 추가**: 7개 파일 unused `eslint-disable @typescript-eslint/no-explicit-any` 경고 → **✅ 완료(9ac5bfa, 4 tracked + 3 untracked auto-fix). pnpm lint 0/0.**
- **PR-B(S-99) 완료 ✅ (2026-05-06)** — ErrorCard/LoadingState/EmptyState + global error/loading/not-found + error-codes 카탈로그. 커밋 `cec5038`. **833/833 PASS**, 0 TS errors.
- **PR-A1(S-03 today 백엔드) 완료 ✅ (2026-05-06)** — GET /api/today route + cache-key(sha256) + builder(3-tier fallback) + openai(GPT-5 mini) + kst-date + types + daily_hap.md system prompt. 커밋 `77a90ef`. **850/850 PASS**, 0 TS errors.
- **PR-C(S-96 OG 이미지) 완료 ✅ (2026-05-06)** — buildOgPayload(PII 0건) + OgTemplate(1200x630 Edge) + GET /api/og/hapcard/[id] + buildSharePayload URL에 range 추가 + page.tsx server wrapper(generateMetadata) + HapcardView.tsx 분리. 커밋 `acc94c6`. **866/866 PASS**, 0 TS errors. Auth 401 유지(메신저 크롤러 차단) — 공유 토큰 별도 PR.
- **PR-A2(Today UI + TabBar) 완료 ✅ (2026-05-06)** — §1.6 UIDesign 준수 규칙 + globals.css M3 토큰 + TabBar + layout.tsx 통합 + Today 6 컴포넌트 + /api/me/chart route + (app)/page.tsx Today 조립 (3 useQuery + Top-N=5 최근순 + chart=null guard) + /me placeholder. **911/918 PASS** (full suite; 7 실패는 jsdom cold-load 사전 flake — 단독 실행 시 18/18 GREEN). PR-A2 영역 단독: layout 3/3 + Today 컴포넌트 28/28 + /api/me/chart 4/4 + (app)/page 8/8 + /me 2/2 = **45/45 PASS**, 0 TS errors, 0 lint errors.
- §1.1 PR-A2 Phase 4 결정 사용자 확정: (1) /api/relations Top-N=5 (서버 created_at desc 그대로) (2) /api/me/chart 신규 호출 (user_charts 최신 1건).
- §1.3 별도 이슈 추가: jsdom cold-load 시 hookTimeout 부족 → **✅ 완료(72ba226, vitest.config.ts:34 hookTimeout:15000). 923/923 full suite GREEN.**
- **Phase 6 manual smoke 완료 ✅ (2026-05-06)** — Bug 1(globals.css @import 순서, caba530) + Bug 2(라우트/미들웨어 exclusion-list 재작성 + /app 리다이렉트 삭제, bda3033) 수정. **923/923 PASS**, 0 TS, 0 lint. /login 200 ✓, / Today 화면 도달 ✓, TabBar 3탭 ✓, /me placeholder ✓. §1.3 잔여: API 401(만료 쿠키 Playwright 세션 한정). hookTimeout flake → ✅ 완료(72ba226).
- **F5 /me 본명식 본 화면 완료 ✅ (2026-05-07)** — PillarGrid + DayMasterCard + MeHero + YunsePlaceholder + page composition(5섹션 + useQuery). **942/942 PASS**, 0 TS, 0 lint. 커밋: `eb3b05b`(ko.json) · `b146ce5`(컴포넌트 4종) · `0ad0b9e`(page 조립).
- **QA /me 본명식 완료 ✅ (2026-05-07)** — Email/Password 로그인 추가(영구 기능) + 테스트 계정 시드(Test1@test.com) + /me 5섹션 브라우저 시각 검증. OhaengBars 바 비가시 버그 수정. **948/948 PASS**, 0 TS, 0 lint. 커밋: `390d8f8`(email auth) · `23ae3c7`(ohaeng fix). §1.1 후속: Google SSO 진단(별도) · email auth 프로덕션 정책 결정 필요.
- **Email/Password 프로덕션 강화 완료 ✅ (2026-05-07)** — 비밀번호 정책(8자+letters_digits) + rate limit(30→10/5min) + signUp 흐름(/signup 페이지) + TDD 20건 신규. **969/969 PASS**, 0 TS, 0 lint. 커밋: `b9aaea9`(supabase config) · `7f35599`(password-policy) · `8747ff7`(signUpWithEmail) · `7510008`(i18n) · `9b45b4f`(signup page) · `b8267c9`(login link) · `22187a1`(auth.md). §사용자 수동 절차: Supabase Dashboard → Auth 정책 동기화 필요(jamhkucluhiibqpjsiov). Google SSO 별도 세션.
- **E1+E2 완료 ✅ (2026-05-07)** — UI 4토큰 소프트 변환(합→끌림/형→긴장/충→부딪힘/해→소모) + LLM v0.3 prompts + migration 0024. **1033/1033 PASS**, 0 TS, 0 lint. branch: `feature/e1-ui-term-conversion` (Cycles 1-12) + `feature/e2-llm-prompts-v0.3` (Cycles 13-15). §사용자 수동 절차: `pnpm db:push`(0024) → `pnpm seed:prompts` → v0.3 active 확인.
- **Y4 완료 ✅ (2026-05-09)** — ADR-033/036 합피드 자동 정렬 + 흐름 변화 큼 배지 전체 완료 (Cycles 1-14). hapcard_score_snapshots 테이블 + computeChangeScore + /api/feed(정렬) + FeedPage 전환 + ChangeBadge + i18n(feed.badge.change_significant). **1068/1068 PASS**, 0 TS, 0 lint. 커밋: `dbb7939`(Phase 1+2) · `c98f764`(feed route) · `b62ea17`(feed page+badge) · `bd50a6d`(i18n). §사용자 수동 절차: `pnpm db:push`(0025 migration 이미 dbb7939 시점 적용 완료). branch: `feature/y4-change-score-feed-sort`.
- **§1.3 cleanup 완료 ✅ (2026-05-09)** — `yunse_adjustment` fixture 3건 + replay route Zod parse. 0 TS errors 달성. 커밋: `287ec28`. ScoreBreakdownSchema + HapcardDbRowSchema 추가 (`src/types/hapcard.ts`). §1.3 잔여: vitest default-reporter 환경 이슈(별도 세션). 기타 §1.3 baseline 4건 → ✅ 완료.
- **S-08 만약합(Whatif) 기능 전체 구현 완료 ✅ (2026-05-09)** — 6모드 백엔드+UI 전체 완성. 주요 산출물: `src/types/diagnostic.ts`(6모드 타입) · `src/lib/whatif/`(builder/cache-key/output-schema/prompt-loader/query-text) · `/api/whatif/[type]` route · WhatifSheet + WhatifTrigger + 5개 섹션 컴포넌트 · WhatifView 4-state. **1174/1174 PASS**. §사용자 수동 절차: `pnpm db:push`(0026_whatif_results) 필요. 커밋 키: `518aa7e`(D1 supporting files) · `43945c6`(route) · `fffc024`(WhatifView) · `60fa445`(PII guard).
- **S-08 followups #1-#5 완료 ✅ (2026-05-09)** — `chore/s08-followups` → `master` fast-forward 병합. #1(`b6f7765`) DEFAULT_LLM_MODEL 통합 · #2.1(`4cd4057`) 에러 코드 카탈로그 6건 · #2.2(`6b14193`) WhatifView ErrorCard 매핑 · #3(`07a7060`) ClassicCitation 스키마 일원화(`src/lib/rag/citation-schema.ts`) · #4(`281a425`) refund_tokens 실패 로깅 · #5(`901291a`) ErrorCard CTA + INSUFFICIENT_TOKENS "충전하러 가기"→`/me`. **1192/1192 PASS**, 0 TS, 0 lint.
- **§1.3 cleanup 2차 완료 ✅ (2026-05-09)** — (1) Replay route 환불 catch 로깅(`313a2bb`, TDD 2건) (2) `messages/ko.json` `whatif.error.*` 블록 4키 전체 제거 (3) `0009_token_ledger.sql:6` 주석 whatif_use/whatif_refund 동기화(`05fedcf`). **1194/1194 PASS**, 0 TS, 0 lint.
- **§1.3 잔여 1건**: `INSUFFICIENT_TOKENS` CTA href `/me` → 충전 페이지 구현 시 `/payments/charge` 업데이트(`src/lib/errors/error-codes.ts:40`). 별도 PR.
- **B1 DB push 확인 완료 ✅ (2026-05-09)** — `0024_prompt_v0_3_rollback` + `0026_whatif_results` 이미 라이브 반영 확인(`supabase db push --dry-run` → "up to date"). `pnpm seed:prompts` v0.3 active 6/6 확인. `whatif_results` 테이블 쿼리 가능 확인. `scripts/verify-b1-migrations.ts` 신규 추가. **1194/1194 PASS**, 0 TS, 0 lint.
- **로컬 E2E manual smoke 가이드 완료 ✅ (2026-05-09)** — `docs/qa/local_e2e_smoke.md` 신규(454줄). 8 핵심 flow(회원가입/온보딩/인연등록/합피드/합카드/오늘홈/본명식/만약합) + LLM 비용 경고 + 알려진 제약. 커밋 `4b2a62f`.
- **P0 working tree 정리 완료 ✅ (2026-05-09)** — 19개 base migration(0001~0020) + supabase/.gitignore + G0 KASI toolchain(scripts 7종·tests 11건·fixtures) + PR-A2 layout/styles tests + DB contract/RLS tests + seed-prompts 커밋. UIDesign/ → .gitignore(로컬 전용). master clone 재현 가능 상태 회복. **1194/1194 PASS**, 0 TS, 0 lint. 커밋: `2f4948d`·`dc7bede`·`99f64b5`·`a74330b`·`f186817`·`89438c0`·`10f7539`. stale 브랜치 3개 삭제 완료(feature/e1·e2·s08).
- **Yunse Y0/Y1 완료 확인 ✅ (2026-05-09, 재검증)** — `src/types/chart.ts` YunseCore(4레이어: 대운·세운·월운·일운) + `src/lib/kasi/normalize.ts:mapSsajuToYunse()` + `src/components/me/yunse-card.tsx` YunseCard(실구현, placeholder 아님) + 테스트 passing. 메모리 stale 항목 해소.
- **P1/P2 정리 완료 ✅ (2026-05-09)** — C4 stale 브랜치 3개 삭제(feature/e1·e2·s08). C5 vitest reporter = non-issue(pnpm test 1194/1194 정상). C1 Yunse 완료 확인. 잔여: C2(D1 결제 페이지 의존) · B1(pnpm db:push 0024+0026 사용자 수동) · B2(Supabase Dashboard 수동).
- **§1.6 UI design-review 완료 ✅ (2026-05-10)** — /login·/signup·/feed·/onboarding·/relations/new 5개 화면 감사 + 5개 finding 수정(FINDING-001~005). 커밋 `ffcad13`·`365ebf6`·`0526aac`·`43af94b`. **1203/1203 PASS**, 0 TS, 0 lint. §1.3 잔여: time-accuracy Seg pill 변환·rounded-2xl 토큰화·Seg pill DRY·필터 매직픽셀(별도 PR).
- **Hapcard design-review Phase 0-9 완료 ✅ (2026-05-10)** — 13섹션 composition lock + AppBar/CtaBar/Timeline/ReplayButton/SharePreviewTile/MiniRadar 신규 + replayHint footer 제거 → ReplayButton 컴포넌트로 대체. commits `982ea52`~`6bd7ea6`(13개). **1252/1252 PASS**, 0 TS, 0 lint. /qa-only DONE_WITH_CONCERNS(6 PASS · 1 BLOCKED hapcard 500 · 1 INFO). 로컬 `main` 브랜치 fast-forward 완료. GitHub PR 생성 보류(git remote 미설정). §1.3 잔여: 테스트 계정 onboarding 시드 추가 → hapcard 브라우저 E2E #1-#13 별도 PR.
- **Phase B 완료 ✅ (2026-05-11)** — Hanja 노출 제거 + LLM 프롬프트 한글 친화 (ADR-038). 주요 산출물: `src/lib/glossary/hanja-readings.ts` + `post-process.ts` + `banned-phrases.containsClassicalHanja()` + builder UI 매핑 + 6모드 prompts v0.8 + 4 컴포넌트 safety-net. **1324/1324 PASS**, 0 TS, 0 lint. §1.3 잔여: evidence.tsx compound regex 확장 + SHINSAL_READINGS sort 강화 + `cause_factors` 렌더 컴포넌트 구현 시 `convertHanja()` 필수 + `containsClassicalHanja()` 런타임 연결 결정(§1.1 대기) (모두 별도 PR). §사용자 수동 절차: `pnpm seed:prompts` → v0.7 6건 rolled_back, v0.8 6건 active.
- **Phase B §1.3 잔여 정리 완료 ✅ (2026-05-13)** — 4건 중 3건 머지(`HapcardCauseFactors`는 backlog). PR1 `eac2fbb`(SHINSAL sort) · PR2 `49dad3c`(evidence compound regex + GLOSSARY_TERMS 6→18) · PR3 `bd4ed56`(containsClassicalHanja Option C warn-and-pass). **1335/1335 PASS**, 0 TS, 0 lint. §1.1 결정(2026-05-13): containsClassicalHanja = Option C(경고 로그 + 통과), 진행 방식 = 독립 3 PR 순차, `cause_factors` 렌더 컴포넌트 = 백로그(ADR-038:45 의무 명시).
- **Hapcard E2E #1-#13 브라우저 검증 완료 ✅ (2026-05-13)** — 11/13 PASS (84.6%). 4건 §1.3 이슈 수정: PR-X1 `043e166`(IljuChip ADR-038 convertHanja) · PR-X2 `8b2b665`(gauge breakdown Math.round) · PR-X3 `3f1831c`(OG try-catch 500 반환). **1338/1338 PASS**, 0 TS, 0 lint. §1.3 잔여: ISSUE-3(Body eyebrow "전체 해석"으로 변경 — ✅ 완료 `4233bda`) · ISSUE-4(OG Noto Sans KR 폰트 등록 + Edge 런타임 복원 — ✅ 완료 `dcf5b88`). 모든 §1.3 잔여 해소.
- **main ff push 완료 ✅ (2026-05-28)** — `origin/main` `0d78f97` → `cf288f6` (28 ff). 26 코드 커밋 + RAG 사전검토 docs(`43265f9`) + vaul jsdom mock(`cf288f6`). typecheck/lint/test 전체 PASS. Vercel 자동 배포 트리거됨. **1690/1690 PASS**.
- **오늘사이 방향 정렬 라운드 진행 중 (2026-05-28)** — `feature/today-direction-alignment` branch. Phase 1(G3+G4 카피 `39684d1`) + Phase 2(G1 환영 팝업 `7e61b49`) 완료. **1695/1695 PASS**(+5 신규). Phase 3(G2 오늘카드 인연 종합 — 별도 "오늘 합온도" 점수식 + GPT-5 격상 + 캐시 키 relation_chart_hash 추가, 6 sub-cycle TDD) 새 세션 재개 예정. 유저사이드 용어 통일 규칙 신규 영구 확정([[feedback-user-side-terminology]]).
- **오늘사이 Phase 3 (G2 오늘카드 인연 종합) 완료 ✅ (2026-05-28)** — 10-cycle TDD 모두 그린. `feature/today-direction-alignment`에 C1~C9 커밋(`bd4561b` C1 → `97c15c2` C9). **1760/1760 PASS**(+65 신규), 0 TS, 0 lint. 주요 산출물: `src/types/dailyHap.ts` 3필드(relation_id/relation_nickname/today_compat_score) · `src/lib/scoring/today.ts` 결정형 점수식(가중치 0.25/0.15/0.20/0.40, **W1 사용자 확정**, TODAY_SCORING_VERSION='1.0.0', SCORING_VERSION 독립) · `src/lib/today/cache-key.ts` 객체 인자(self+relation+date+prompt_ver+model_id) · `src/lib/today/builder.ts` fetchRelation/fetchRelationChart + 3축 빌더 · `src/lib/today/openai.ts` 3축 페이로드 + GPT-5 격상 · `src/lib/today/relation-picker.ts` 자동 선택(preferred → 최근 등록 → null) · `prompts/system/today_with_relation.md` v0.1(3 시나리오 예시) · `src/app/api/today/route.ts` relation_id query + flag 분기 + applyRelationMetaToResponse(캐시 hit 시에도 최신 relation 재주입) · `src/components/today/today-hero.tsx` 인연 chip + 오늘 합온도 라벨 + 인연 0건 CTA · `tech_stack.md` LLM 매핑 동시 갱신(§12). feature flag `NEXT_PUBLIC_TODAY_WITH_RELATION` 기본 켜기, `false` 시 단독축 즉시 복귀. DB 마이그레이션 없음(relation 필드는 in-memory 응답). 잔여(별도 PR): daily_haps 컬럼 영속화(relation_id/nickname/today_compat_score) · 인연 chip 인터랙티브 드롭다운 · lazy relation chart compute · C10 browser manual smoke 사용자 검증.
- **Phase 3 main 통합 + F1~F4 후속 완료 ✅ (2026-05-28)** — Phase A: main ff 머지 + push(`cf288f6..b278e7e`, 13 커밋, Vercel auto-deploy). Phase B: `feature/post-g2-followups` 11 커밋(`5b759bb`~`3b4809d`). 주요 산출물: F1(daily_haps 영속화) — `supabase/migrations/0029_daily_haps_g2_columns.sql`(relation_nickname/today_compat_score + llm_model default gpt-5) · route.ts saveCard 영속화 + fetchTodayCache primary_relation_id 필터(인연 교체 시 캐시 분리) · `rowToCard` export · `scripts/verify-0029.ts`. F2(인연 chip 인터랙티브) — `src/components/today/relation-chip.tsx` vaul Drawer + 5건 cap + ✓ aria-current + controlled open prop · today-hero outer Link 해제 + chipNode 슬롯 · today-page-client router.replace + invalidateQueries · ko.json `with_relation.menu_title/view_all/current_label/close_label`. F3(lazy KASI compute) — `src/lib/today/lazy-relation-chart.ts:ensureRelationChart` + error_events INSERT(KASI_COMPUTE_FAIL). F4(prompt_versions 시드) — `seed-prompts.ts` HAPCARD_MODE_NAMES + OTHER_VALID_NAMES 분리, today_with_relation v0.1 적재. §사용자 수동 절차: `pnpm db:push`(0029) → `pnpm tsx scripts/verify-0029.ts` PASS → `pnpm seed:prompts`(7 row, today_with_relation v0.1 active).
- **Phase 3 후속 4-task PR ✅ (2026-05-28)** — `feature/post-phase3-followups-batch` 5 커밋(`7ca2f6d`·`dd88c28`·`b2274b6`·`ed25700`·`30e4a30`). Task 4(DailyHapCard legacy 3필드 즉시 삭제: compat_score·headline_strength·delta_vs_yesterday) + Task 1(오늘카드 latency instrumentation — builder phase 측정 + 25s LLM timeout + error_events trace 적재 + LLM_PARSE_FAIL/TODAY_BUILD_FAIL 코드) + Task 2(ADR-008 canary 5% routing infra — loadPromptForUser SHA-256 sampling + seed-prompts canary frontmatter + today/openai.ts DB-backed 전환 + daily_hap 시드 추가 + 7건 v(bump) canary) + Task 3(393px RelationChip overflow guard — max-w + truncate + shrink-0). **1819/1819 PASS**(+35), 0 TS, 0 lint. §사용자 수동 절차: `pnpm seed:prompts` → 15 row (8 active + 7 canary) 시드 확인. §1.3 잔여: today cache_key 의 hardcoded prompt_version (canary 본문 변경 시 동기화 필요) · guest canary 노출 정책 (현재 `__guest__` fixed seed) — 별도 PR.
- **QA Phase 3 후속 검증 + 회귀 fix ✅ (2026-05-28)** — `/qa docs/qa/local_e2e_smoke.md` 9 flow 자동 검증. main 직접 4 커밋(`466935e`·`902af27`·`dfae986`·`c857b6d`). 2 회귀 발견 + fix: **ISSUE-001** (F6 오늘카드 LLM_PARSE_FAIL `Unexpected end of JSON input` → TEMPLATE fallback; root cause = `max_completion_tokens: 800` 한도, fix = 2000 상향) + **ISSUE-002** (error_events 테이블 0016 시점 RLS enabled + 0 policies → Task 1 instrumentation 적재 + lazy-relation-chart F3.3 KASI 로깅 모두 silently fail; fix = 0030 마이그레이션 authenticated INSERT). DB: 0029 + 0030 db push 완료, seed:prompts 15 row 적용. 9 flow sweep: F1/F4/F7 ✅, F2 redirect ✅, F0/F3 진입 ✅, F5/F8 manual smoke 위임, F6 ISSUE 발견+fix. **1820/1820 PASS** (+1 regression test). §사용자 수동: dev server 재시작 후 F6 manual smoke verify (LLM 응답 시간 회복 + daily_haps 오늘 row 시드 + error_events 신규 적재 없음). §1.3 잔여: error_events SELECT 정책 · F3.3 KASI 적재 e2e verify · today 14-26s latency 추가 최적화 · F5/F8 자동 QA — 별도 PR.
- **결제 전환(pay-per-use) Phase 1 완료 ✅ (2026-06-01)** — `/plan-eng-review` 설계·승인. 부적 충전(토큰 번들 구매) 제거 → 유료 기능(합카드·만약합·다시합) 사용 시 즉시결제(ADR-039 신규 예정). branch `feature/pay-per-use-billing`. §1.1 5결정: 하이브리드(부적 우선→부족 시 1회 현금)·1회성 Toss 결제창·800/500/400원·그린필드·**원자성 C(선생성+성공 시 결제)**. **git**: main에 이전 세션 미커밋 WIP 129파일 스냅샷 `b414e23`(토큰충전 흐름 본체+launch readiness+LLM resilience — Phase 6 삭제 복구용) + Phase 1 `4de3d76`(`feature-prices.ts` 800/500/400 단일출처 + migration `20260601000000` payments.charge_type/feature_id/feature_ref·`confirm_feature_payment` RPC(토큰적립 X)·drop `confirm_token_purchase` + error-codes `PAYMENT_REQUIRED`/`RATE_LIMITED` additive). tsc 0, 변경 테스트 GREEN. Phase 2~9(서버게이트 unlock/gate/cash-limit·결제라우트 init/confirm·3라우트 통합+replay 멱등fix·클라이언트 pay-sheet·제거·read-path 유출감사·docs/ADR·검증) 잔여 → task #11~#18. 핸드오프 메모: `session_pay_per_use_phase1_complete_2026_06_01.md`. 플랜: `~/.claude/plans/task-cached-goose.md`. ⚠️ `db:push`(0601 migration)는 Phase 6 제거 후에만(안 그러면 라이브 confirm 라우트 깨짐).
- **pay-per-use Phase 2+3 완료 ✅ (2026-06-02)** — TDD로 서버 코어 완성. **Phase 2 `f1aef9e`**(13 tests): `feature-unlock.ts`(`isFeatureUnlocked` 단일 잠금 게이트) + `feature-gate.ts`(`resolveFeatureCharge`→free|unlocked|pay_required, charged 플래그) + `cash-gen-limit.ts`(일일 미결제 선생성 한도 5, env `CASH_GEN_DAILY_LIMIT`). **Phase 3 `f31b457`**(20 tests): `feature-complete.ts`(`confirmFeaturePaymentForUser` 토큰적립X·멱등) + `POST /api/payments/feature/init`(confirmed 단락·pending 재사용·신규 insert) + `GET /api/payments/feature/confirm`(303 to allowlist `/hapcard`|`/whatif` + `&paid=ref`, open-redirect 방어) + `src/types/feature-payment.ts`. interim `database.types.ts` 패치(payments charge_type/feature_id/feature_ref + token_amount nullable + confirm_feature_payment RPC — Phase 6 regen이 정식화). 전체 1965/1965·payments 74/74 PASS, tsc 0, lint 0. 핸드오프: `session_pay_per_use_phase2_3_complete_2026_06_02.md`. **Phase 4(라우트 통합 + replay 멱등 fix)부터 재개**, 이후 Q2 = Phase 4 후 `/codex challenge` 중간 게이트. Q1 = me "충전" 버튼 제거(Phase 5).

---

## 3. 단일 핵심 (ADR 잠금)

본 제품의 단일 핵심 피처는 다음 두 가지이며, 모든 화면·KPI가 이쪽으로 유입되도록 설계되어 있다. 이 위계를 흔드는 제안은 §1.1 사용자 승인 대상.

| 핵심 | 위치 | ADR |
|---|---|---|
| §4.2 관계 사주 해석 (합카드 8p) | `fluttering-gathering-island.md` §4.2 / `PRD.md` §6 | ADR-010, ADR-016, ADR-026 |
| §4.3 관계 진화 타임라인 재해석 (4p) | 같은 문서 §4.3 (Phase 1.5) | ADR-033 |

### 비협상 ADR (변경 시 §1.1 승인 필수)

- **ADR-002** 자유채팅 미제공 — 모든 LLM 결과는 구조화 카드/리포트 안에서만
- **ADR-010** 단일 핵심 위계 — 보조 콘텐츠가 핵심을 가리지 않음
- **ADR-011** 별명만, 실명 수집 금지 — DB 컬럼·UI 라벨 모두 "별명"
- **ADR-015** 재해석 시 명리 근거 항상 표시
- **ADR-016** 결과 카드 6 컴포넌트 Phase 1 잠금
- **ADR-018** 모트 = 명리 정확성 자산 (KASI Agreement + 다중 검증 + 고전 RAG)
- **ADR-035** 점수 결정형 — LLM은 점수 산출에 개입 금지 (`compatibility_scoring_spec.md` 참조)
- **ADR-037** 기술 스택 잠금 (`tech_stack.md` 참조)
- **ADR-038** Hanja 노출 금지 — UI display layer에서 한자 제거. RAG/DB verbatim 유지. `convertHanja()` safety-net 의무.

---

## 4. 기술 스택 (ADR-037 잠금)

상세는 `tech_stack.md` 참조. 핵심 잠금만 요약:

- **Frontend**: Next.js 15 App Router + TypeScript strict + Tailwind + shadcn/ui + Radix
- **State**: TanStack Query v5 (서버) + Zustand (UI)
- **Backend**: Next.js Route Handlers (별도 서버 X) + Supabase Free (Postgres + Auth + RLS + Storage)
  - **Canonical Supabase project_ref**: `jamhkucluhiibqpjsiov` (`goonghap`, Northeast Asia / Seoul). 다른 ref(예: `aseszttxkxpfzenmbylx`, `muuudarddkvevwdpefvy`)는 작업용 아님. 링크 확인: `pnpm db:status`. 재링크: `pnpm db:link`. push: `pnpm db:push:dry` → `pnpm db:push`.
- **i18n**: next-intl (KO 1차, EN/VI/TH/MS/ID Phase별)
- **만세력**: ssaju (年/月/時柱 절기·입춘 기준 source + day_pillar cross-validator) + KASI (day_pillar 진본) + manseryeok-js (보조 cross-validator) — 2026-05-03 §1.1: ssaju 역할 年/月/時柱 프로덕션 source로 확대. 야자시 = 조자시 통합 학파 (ADR-037)
- **사주 엔진**: 자체 TypeScript `fortune-core` (monorepo 패키지) — 결정형
- **LLM**: OpenAI 4단 (GPT-5 핵심 / GPT-5 딥합 / GPT-5 mini 오늘합 / Anthropic Claude fallback)
- **결제**: 토스페이먼츠 (KR Phase 1) / Stripe (Phase 3 SEA)
- **Hosting**: Vercel Hobby (Phase 3 진입 전 Cloudflare 전환 재검토)
- **Tests**: Vitest + Playwright + Zod

스택 변경은 §1.1 사용자 승인 대상이며, 승인 시 `tech_stack.md` + `fluttering-gathering-island.md` + `PRD.md` 동시 갱신 의무 (§12).

---

## 5. PII / ZDR 절대 규칙 (협상 불가)

OpenAI / Claude 등 외부 LLM에 **절대 보내지 않는** 필드:
- `birth_date` (원본)
- `name`, `nickname`
- `email`
- `birth_place`
- `gender` (원본)

LLM 페이로드에 허용되는 것은 **`chart_core` + `question_slot` + `theory_profile.profile_version`** 뿐이다. (출처: `tech_stack.md` §3.5, `FRONTEND-PREP.md` §11.2)

OpenAI는 **ZDR (Zero Data Retention)** 계약 적용 필수. 이 규칙을 우회하는 코드 작성 시 즉시 중단하고 사용자에게 보고.

---

## 6. 명령어

### 6.1 현재 (스캐폴드 미생성)
- 빌드/테스트 명령어 없음. `package.json` 미존재.
- 스펙 변경만 가능. 변경 시 §12 변경 매트릭스 적용.

### 6.2 스캐폴드 생성 후 (Phase 0 G0 이후, 사용자 승인 필요)
다음은 `FRONTEND-PREP.md` §16 작업 순서 기준 *예정* 명령어. 실제 실행 전 §1.1 적용.

```bash
# 초기 스캐폴드 (1회)
pnpm create next-app --typescript

# shadcn 컴포넌트 (필요할 때마다 add)
pnpm dlx shadcn@latest add button badge dialog drawer popover accordion toggle-group progress

# 개발
pnpm dev

# 타입 체크 (Contracts-first 검증, 매 PR 전)
pnpm tsc --noEmit

# 단위 테스트
pnpm vitest run
pnpm vitest run path/to/file.test.ts   # 단일 파일

# E2E
pnpm playwright test
pnpm playwright test --ui              # 디버그 UI
pnpm playwright test tests/flow-a.spec.ts   # 단일 플로우

# 린트 / 포맷
pnpm lint
pnpm format
```

이 표는 스캐폴드 생성 시 실측 명령어로 갱신한다 (§12 의무에 포함).

---

## 7. 디렉토리 가이드

### 7.1 현재 구조

```
C:\DEV\SAJU\
├─ fluttering-gathering-island.md   # 서비스 기획서 (v1.1 잠금)
├─ PRD.md                           # UI 디자이너 PRD (v1.1 잠금)
├─ compatibility_scoring_spec.md    # ADR-035 점수 결정형 명세
├─ tech_stack.md                    # ADR-037 스택 잠금
├─ FRONTEND-PREP.md                 # 프로토타입 → 프로덕션 마이그레이션 핸드북
├─ docs/                            # 보조 spec/runbook/legal/pattern (인덱스: docs/README.md)
├─ src/types/                       # Contracts-first stubs (index, mode, relation, chart, hapcard, scoring, prompt)
├─ scripts/                         # 운영 스크립트 (verify-ssaju-accuracy.ts)
├─ tests/fixtures/                  # G0 게이트 KASI reference (placeholder)
├─ prompts/                         # banned_phrases catalog + 6모드 system prompt scaffolds
├─ .env.example                     # 환경변수 카탈로그
├─ .github/workflows/               # CI (typecheck, lint, vitest)
├─ .gitignore
├─ UIDesign/                        # Babel CDN 기반 React 프로토타입 (수정 금지)
└─ CLAUDE.md                        # 본 파일
```

> fortune_architecture.md(v3.3)는 2026-05-03 폐기. 유효 내용은 `docs/specs/`, `docs/runbooks/`, `docs/legal/`, `docs/patterns/`로 분산 추출.

### 7.2 미래 구조

스캐폴드 후 디렉토리는 `FRONTEND-PREP.md` §2 참조. `src/types/` 이미 생성됨 — Contracts-first 시작점 (`C:\DEV\CLAUDE.md`).

---

## 8. 도메인 용어 사전 (프로젝트 전용)

`C:\DEV\CLAUDE.md` "Terminology Consistency" 표를 확장한다. 한 개념 = 한 용어 원칙은 동일.

| 개념 | 사용 | 사용 금지 |
|---|---|---|
| 사용자 | `user` | `member`, `account` |
| 인연 (CRM 대상) | `relation` | `contact`, `friend`, `partner`, `target` |
| 인연 별명 | `nickname` | `name`, `displayName` (UI 라벨도 "별명") |
| 합카드 (결과 카드) | `hapcard` | `result-card`, `compat-card` |
| 합점수 | `compatScore` (코드) / "합게이지" (UI) | `score`, `rating` |
| 6모드 | `mode` — `'일합' \| '친구합' \| '돈합' \| '첫합' \| '썸합' \| '오래합'` | `category`, `type` |
| 본명식 | `chart` — `chart_core`, `userChart` | `birthChart`, `natal` |
| 일주 | `ilju` | `dayPillar` |
| 오행 | `ohaeng` | `fiveElements`, `wuxing` |
| 십신 | `sipsin` | `tenGods` |
| 만세력 | `manseryeok` | `lunarCalendar` |
| 합·형·충·해 | `hapChungHyungHae` (코드 키) | 영문 분리 식별자 |
| UI 소프트 alias | `끌림/긴장/부딪힘/소모` (display_label) — 합→끌림, 형→긴장, 충→부딪힘, 해→소모. GlossaryKey는 classical(`합\|형\|충\|해`) 유지, UI 표면만 소프트 용어 | — |
| 오늘합 | `todayHap` | `dailyFortune` |
| 딥합 (깊이 리포트) | `deepHap` | `report`, `deepReport` |
| 합피드 (인연 그리드) | `feed` | `list`, `grid` (라우트 키) |
| 다시합 (재해석) | `replay` | `reInterpret` |

새로운 도메인 용어 추가 시 본 표를 갱신하며 §1.1 승인 절차 적용.

---

## 9. 미결정 항목 (R1-R7)

`MEMORY.md` 의 `project_open_questions.md` 가 권위 있는 출처. 미결정 항목과 관련된 코드는 **결정 전까지 구현 보류**한다 (스텁·플레이스홀더 금지). 해당 영역 작업 요청 시 §1.1 적용하여 결정 시점부터 확인.

---

## 10. 검증 스킬 매핑 (필수 규칙 §1.2 운용)

| 작업 종류 | 우선 호출 스킬 | 보조 |
|---|---|---|
| 신규 컴포넌트·페이지 구현 | `/qa-only` → 결과 보고 → 수정 → `/qa` | `/design-review` (시각 QA) |
| API 라우트 / Server Action | `/qa` (단위 테스트 포함) | `/codex` (보안 2차 검토) |
| 시각 변경 (Tailwind, 토큰) | `/design-review` | `/browse` (실 페이지 캡처) |
| 결제 / 토스페이먼츠 흐름 | `/cso` (보안 감사) → `/qa` | `/codex` (도전) |
| 만세력·점수 결정형 로직 | Vitest deterministic 테스트 + `/codex consult` | — |
| LLM 프롬프트 변경 | banned_phrases 회귀 코퍼스 + `/codex challenge` | — |
| PR 머지 직전 | `/review` | `/autoplan` |
| 배포 후 모니터링 | `/canary` | `/benchmark` |

스킬 호출 결과를 사용자에게 요약 보고. PASS/FAIL 명시.

---

## 11. 컴팩션 규칙 (필수 규칙 §1.4 운용)

압축 시 반드시 보존:
- 현 세션에서 수정한 파일 목록
- 작업 중인 `types/*.ts` 인터페이스 (Contracts-first)
- 활성 ADR 번호와 결정 상태
- `C:\DEV\CLAUDE.md` 및 본 파일 내용
- `fluttering-gathering-island.md` v1.1 갱신 진행 상황
- `MEMORY.md` 의 미결정 항목 (R1-R7) 변동
- 미해결 사용자 질문

압축 산출물은 메모리 시스템(`C:\Users\batis\.claude\projects\C--DEV-SAJU\memory\`)에 작성하며, `MEMORY.md` 인덱스에 한 줄 추가.

---

## 12. 변경 매트릭스 의무 (ADR-037)

스택·핵심 정책 변경 시 다음 파일을 **동시에** 갱신해야 한다:

| 변경 | 갱신 대상 |
|---|---|
| 기술 스택 (라이브러리·모델·호스팅) | `tech_stack.md` + `fluttering-gathering-island.md` + `PRD.md` |
| ADR 신규/수정 | `fluttering-gathering-island.md` §17 ADR 표 + 본 파일 §3 |
| 도메인 용어 추가 | 본 파일 §8 + `C:\DEV\CLAUDE.md` 해당 표 |
| LLM 모델 매핑 변경 | `tech_stack.md` §3 + `prompt_versions` 테이블 + 카나리 절차 |
| 6모드 taxonomy | `fluttering-gathering-island.md` §4.2 + `PRD.md` §6 + `types/relation.ts` (`mode` enum) |

부분 갱신 후 PR 제출 금지. 동시 갱신 누락 발견 시 §1.1 적용.

---

## 13. 메모 위치 (필수 규칙 §1.5 운용)

| 종류 | 위치 |
|---|---|
| 반복 실수 / 도메인 함정 | 메모리 시스템에 `feedback_*.md` 신규 작성 + `MEMORY.md` 인덱싱 |
| 미결정 사항 신규 발생 | `project_open_questions.md` 항목 추가 (R 번호 부여) + `MEMORY.md` 갱신 |
| 외부 API 차이 / 비결정형 발견 | 메모리 시스템에 `project_*.md` 작성, ADR 위반 우려 시 즉시 사용자 보고 |
| 단기 작업 노트 | `TaskCreate` (현 세션 한정) |

기록 → 다음 작업 진입 전 검색·확인이 의무. 같은 실수 두 번 발생 시 본 파일 §13에 한 줄 추가하여 영구화.

---

## 14. 참조

- `C:\DEV\CLAUDE.md` — 보편 규칙 (언어·터미놀로지·Contracts-first·Agent routing)
- `tech_stack.md` — ADR-037 잠금 스택 (단일 진실 출처)
- `FRONTEND-PREP.md` — 프로토타입 → 프로덕션 마이그레이션 (스캐폴드 시 1차 참조)
- `docs/README.md` — fortune_architecture.md(v3.3) 폐기 후 추출된 spec/runbook/legal/pattern 인덱스
- `docs/legal/pii_minimization.md` — PII 5필드 + gender 단일 truth source (ADR-004/ADR-011)
- `MEMORY.md` — 결정·미결정 인덱스 (`C:\Users\batis\.claude\projects\C--DEV-SAJU\memory\`)

## 15. Git 저장소

- **Remote**: `origin` = `https://github.com/batisututu/coupleUnse.git`
- **기본 브랜치**: `main` (배포 Production 브랜치 — `docs/specs/secrets.md` §3)
- **커밋 규칙**: `C:\DEV\CLAUDE.md` "Git Conventions" 준수 — English, imperative mood, `type: description` (feat|fix|refactor|test|docs|chore), 72자 이내
- **시크릿 금지**: `.env.local` 등 런타임 시크릿은 `.gitignore` 등록 완료. 추적 파일에 실제 키 값 commit 절대 금지 (`docs/specs/secrets.md` 참조)
- **force-push / `main` 브랜치 삭제**: destructive 작업은 §1.1 사용자 승인 대상

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
