# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> 본 문서는 오늘케미(TWODAY) 프로젝트 전용 규칙이다. 보편 규칙은 현재 상위 디렉토리의 `C:\DEV\CLAUDE.md`(Universal Rules)를 참조하며 중복 작성하지 않는다.

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
3. **AGENTS.md 갱신** — §2 프로젝트 상태 업데이트 (완료된 것 반영)
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

### 1.7 사용자 대상 보고는 항상 한국어 (사용자 확정, 2026-06-21)

- 사용자에게 보이는 모든 응답·진행 보고·요약·질문(`AskUserQuestion` 포함)은 **한국어로 작성**한다.
- 예외(영문 유지): 코드 식별자·커밋 메시지·ADR/문서 본문 등 `C:\DEV\CLAUDE.md` 언어 규칙이 영어로 못박은 항목, 그리고 명령어·파일경로·기술 용어. 즉 *유저 사이드 산문*만 한글, 코드/식별자는 영문 병기 가능.
- 의사결정 질문의 한글 작성은 기존 규칙과 동일하게 적용.

---

## 2. 프로젝트 상태 (2026-06-22 기준)

> 본 §2는 `CLAUDE.md` §2(Claude Code 측 현황 로그)의 미러다. 작업 귀속 표기(Claude Code/Cowork)는 "다른 에이전트가 한 작업" 신호로 보존한다. 두 문서가 어긋나면 git history와 더 최근 갱신본을 우선한다 (§12 동기화 의무).

- **Phase 0 G0 게이트 ✅ 100% PASS** — KASI vs ssaju 100/100 (normal 50/50, boundary 30/30, edge 20/20). normalize.ts ssaju 프로덕션 승격 완료(年/月/時柱). 야자시 = 조자시 통합 학파.
- **PR-1/2/3 완료 ✅** — Next.js 스캐폴드(런칭 dependency 16.2.6) + KASI 진본 검증 라이브러리 + G0 100% PASS + Supabase 마이그레이션(SQL 20개)·RLS 통합·Auth 전체 구현·prompt_versions 시드. Supabase Free `jamhkucluhiibqpjsiov`.
- **F4(Hapcard 백엔드) + F5 Sprint(등록 플로우·합카드 UI 9섹션·glossary·mini_radar·share·replay) 완료 ✅** — chart 컴퓨트 A-eager로 chartPending 영구 차단 해소. `supabase db push 0022+0023`(deduct/refund_tokens RPC + replay idempotency) 라이브.
- **/me 본명식 본 화면 + Email/Password 프로덕션 강화 완료 ✅ (2026-05-07)** — 비밀번호 정책(8자+letters_digits) + rate limit + signUp 흐름. **969/969 PASS**.
- **E1+E2 / Y4 완료 ✅** — UI 4토큰 소프트 변환(합→끌림/형→긴장/충→부딪힘/해→소모) + LLM v0.3 prompts. ADR-033/036 합피드 자동 정렬 + 흐름 변화 큼 배지(hapcard_score_snapshots + computeChangeScore).
- **S-08 만약합(Whatif/또 다른 나) 6모드 + followups 완료 ✅ (2026-05-09)** — 백엔드+UI 전체. `0026_whatif_results` 라이브. **1194/1194 PASS**.
- **Hapcard design-review(13섹션 composition lock) + Phase B(Hanja 노출 제거, ADR-038) + Hapcard E2E #1-#13 완료 ✅ (2026-05-10~13)** — `hanja-readings.ts` + `post-process.ts` + `convertHanja()` safety-net + 6모드 prompts v0.8. **1338/1338 PASS**.
- **Launch readiness 보강 ✅ (2026-05-30~31)** — Supabase payment migration + protected RPC security migration 라이브. OpenAI production `OPENAI_PROJECT_ID` routing + Claude fallback(`claude-sonnet-4-5`) + circuit breaker + `LLM_DAILY_BUDGET_USD` runtime budget enforcement. Supply-chain 보강. `pnpm verify:launch-readiness` 통합 게이트 + 로컬 evidence snapshot. Go/No-Go는 외부 설정 6개(launch env·Auth·OpenAI/ZDR·Toss live·Vercel·Operations/E2E) 완료 전 **오픈 보류**. MVP origin = Vercel Production `*.vercel.app` 고정(custom domain 후속 검토).
- **오늘사이→오늘케미 리브랜드 + 컨텍스트 동기화 + main 정렬 완료 ✅ (2026-06-08)** — Claude Works(Cowork)·Claude Code desync 해소. 검증 베이스라인 **2153/2153 PASS**(264 files)·tsc 0·lint 0. `chore/twoday-rebrand-cycle` 26커밋 `origin/main` ff-push(`b414e23..4f2a0fc`).
- **Phase 1 커버리지+QA+용어 통일 완료 ✅ (2026-06-08)** — §1.1 용어 결정: hapcard=**케미카드** · whatif=**또 다른 나** · replay=**케미 다시 맞추기** · today=**오늘 케미**(§8 동기). 1B 컴포넌트 테스트 · 1C 라우트 감사 · 1D E2E depth · 1F cause_factors(`HapcardCauseFactors`) · 1G AI 생성 고지(`AiDisclosureBadge`/`AiDisclosureNotice`) · 1I /review+/codex CLEAN. `feature/phase1-coverage-qa` → `origin/main` ff-push. **2202/2202 PASS**.
- **pay-per-use 결제 전환(ADR-039) Phase 1~8 완료 ✅ (2026-06-01~03)** — 부적 충전 폐지 → 유료 기능 사용 시 즉시 결제. `feature-prices.ts` 단일출처 · 원자성 모델 C(선생성→성공 시 결제) · `isFeatureUnlocked` 잠금 단일진실(쓰기+read-path 본문 라우트 게이트) · 서버 하드닝(#4 ref 소유검증·#6 RPC error 재throw·#7 23505 recovery) · 클라이언트 `feature-pay-sheet.tsx`(402 처리) · 레거시 토큰충전 경로 전체 제거 · `20260601000000` 라이브(drop `confirm_token_purchase`). ADR-039 신규(비협상). **1994/1994 PASS**.
- **인연 등록 슬롯 과금(relation_slot, ADR-039 Amended §9) 완료 ✅ (2026-06-10)** — 모델 B: 인연 2명 무료, 3번째부터 `relation_slot` 1,000원/10부적. draft 스테이징→머티리얼라이즈(claim-first 멱등+lazy recovery) · `insert_relation_if_under_free_cap` 원자 RPC(무료 슬롯 TOCTOU 차단) · open-pending 캡 10 · draft PII purge cron. 마이그레이션 4종(`20260610000000`·`120000`·`130000`·`140000`) 라이브 적용+repair. /code-review 3건 수정. **2283/2283 PASS**.
- **사주 분석 엔진 고도화(파생층+교차분석, ADR-040) 완료 + 배포 ✅ (2026-06-11~12)** — `chart_core.derived`(theory v3: 십신·지장간·신강약·용신/희신·음양·띠) + `cross_analysis`(cross-v1, 비영속, 양방향 십신 교차·궁위 귀속·운세 교차·PII 연령차 밴드) + LLM 프롬프트 14파일(환각 가드 "제공 필드 외 단정 금지"). C1 버그픽스(yunseAdjustment 한자 매칭, `SCORING_VERSION 1→2`). main ff-push `5898dcf..1a4215b`(48커밋, Vercel 배포) + `seed:prompts` 15행(v0.17 active 6+v0.18 canary) + classics 34 rows. ADR-040 신규(비협상). **2474/2474 PASS**.
- **명리 RAG 검수 + lexical 하이브리드 인용 fix ✅ (2026-06-12~13)** — 고전 원문 14건 RAG 자산화(public domain) + curator 14/14 PASS. ISSUE-001(고전 인용 0건, 유사도 < 0.60) → `query-tags.ts`(buildRagQueryTags) + `retrieveClassics` queryTags + builder 배선으로 retrieval 0→5 hits, 실 생성 citations grounding 통과(§1.1 결정 ③ lexical 하이브리드). **2514/2514 PASS**.
- **잔여 개발 계획 승인 + T2/T3 리텐션 + Flow A 완료 ✅ (2026-06-13)** — §1.1 6결정(T1 런치 P0+T2 Phase1 마감+T3 Phase1.5 병행 · Flow A 절충 · S-06 진단 폼 폐기). **T2**: GA4 계측(`ga.ts`, PII 금지, env 부재 시 no-op) · G-4 시나리오 추정 표시 · G-5 쉽게 보기(`easy-term-map.ts`). **T3**: H-1 인연 타임라인(`/api/relations/[id]/timeline`) · H-2 변화 폭 인디케이터(`/api/hapcards/[id]/change`, ADR-036 게이팅) · H-4 공유 5종 레이아웃(미니멀/오행/레이더/코멘트/흐름, ADR-024 Amend). G-10 인연 0건 hero + Track B 분기. T2+T3 누적 23커밋 `origin/main` push(`451396d..33f62d7`). ISSUE-001(OG Satori 다중자식 div flex 위반) 라이브 수정(`e98c6c3`·`73a3bf6`). **2625/2625 PASS**.
- **시주 진태양시 보정 도입 ✅ (ADR-021 Amended)** — 시주만 경도+균시차(Spencer 1971) 보정(서울 126.978°E 기본), 년/월/일주 KASI 앵커 유지. `solar-time.ts` + `DEFAULT_THEORY_PROFILE_VERSION v1→v2`(캐시 분리) + lazy 재계산. §1.3: ADR-021 번호 충돌(FGI↔manseryeok_theory) 리넘버링 §1.1 대기.
- **T6(c) 소형 기술부채 4건 + 배포 완료 ✅ (2026-06-13)** — #4 wallet LedgerReason(relation_slot_use/refund) · #1 glossary 단일글자 경계 · #2 error_events owner SELECT 마이그(`20260613000000`) · #5 FK 인덱스(`20260613000100`). `db:push` 라이브 + `git push origin main`(`1353167`, Vercel). **2638/2638 PASS**.
- **앱인토스 검토 + P0 가격 개정 (2026-06-07) + 검증 (2026-06-08)** — 앱인토스 연동 검토 보고서 + §1.1 D1~D6 확정(Vite SPA 신규·IAP+웹 병행·**가격 1,000/800/600 웹·미니앱 통일 + 부적 10/8/6p**). `feature-prices.ts`·ADR-039·payments.md·FGI·PRD 16+곳 동기. 가격 테스트 동기화 완료. 재검증: 앱인토스 SDK 2.6.x(3.x 미존재)·TDS 선택·웹/미니앱 계정 분리(CRITICAL).
- **미니앱 Bearer auth `main` 머지 + 프로덕션 LLM 복구 완료 ✅ (2026-06-17, Claude Code)** — ① **머지**: `feature/apps-in-toss-miniapp` → `main` clean ff(`9e091f26..4ded0068`, 3커밋: ait devtools+typecheck · 미니앱 Bearer 토큰 API 인증(`src/lib/supabase/server.ts`) · dev bearer 툴링) → `origin/main` push, Vercel 프로덕션 자동 배포. 풀게이트: tsc 0 · lint 0 · **2831/2831 PASS**(314 files). 프로덕션 API가 미니앱 Bearer 토큰 인증(웹 무영향=Authorization 헤더 없으면 쿠키 경로 유지). ② **프로덕션 LLM 장애 복구**: OpenAI 키 로테이션 + Vercel Production env `OPENAI_PROJECT_ID`/`LLM_DAILY_BUDGET_USD=20` 추가 — 둘 다 `VERCEL_ENV=production|preview` 전용 가드(`clients.ts`/`budget.ts`)라 로컬 `verify:openai-readiness` PASS여도 prod만 순차 실패(메모리 `feedback_vercel_prod_llm_env_gates.md`). 합카드 라이브 생성 정상 확인. ③ **§사용자 잔여(외부 대시보드, 비차단)**: Vercel `TOSS_ALLOWED_ORIGINS` localhost 제거 · `NEXT_PUBLIC_APP_URL=https://todaychemi.vercel.app` 설정 · 구 OpenAI 키 `sk-proj-wnKN…` revoke.
- **기운 케어(energy_food/meeting_vibe) Phase 1-8 + ADR-040 Amend 완료 ✅ (2026-06-18)** — 케미카드 보조 콘텐츠(두 사람 공통 보완 원소 음식 전6모드 + 첫/썸 만남 분위기), 9-phase TDD. branch `feature/apps-in-toss-miniapp` 9커밋(`eebb242`~`97fe733`, origin 미푸시). 결정형 pair-complement+element-food-map+energy-food, LLM은 copy만 윤문+가드 폴백, prompts v0.18/v0.19. **2871/2871 PASS**, auditor PASS. 상세는 CLAUDE.md §2 동일 항목.
- **기운 케어 Phase 9 + 검증 + push 완료 ✅ (2026-06-18 2차)** — Phase 9 §12 doc-sync(`3c924ccf`) + Ultracode 6차원 적대 리뷰(0 confirmed 버그) + cleanup(`16f5095f`) + §1.1 B=문서만 정정(`bf50c6d4` ADR-040 §4 banned-phrase 경로 명문화) + /qa·/design-review 브라우저 검증(393px: 6탭 NOT cramped · 첫합 energy_food+meeting_vibe · 돈합 energy_food+vibe 없음[mode gating] · hanja 0 · console 0) + **origin push `0aaca27e..bf50c6d4`(14커밋, DB 마이그 0)**. 잔여(§사용자 수동): `pnpm seed:prompts`(v0.18/v0.19, main 머지·배포 시점). 검수 대기: pair-complement+element-food-map(명리 specialist). 상세는 CLAUDE.md §2.
- **기운 케어 배포 + seed + 검수 완료 ✅ (2026-06-18 3차)** — 사용자 3-task 직접 실행(순서 재정렬: seed는 코드 배포 後에만). Task 2 명리 검수(`docs/qa/myeongri_review_energy_food_2026_06_18.md`: 五行五味 黃帝內經 PASS·pair-complement 합산방식/신강약 잠정) + Task 3 main ff 머지(`4ded0068..912503d7`, 2871/2871 GREEN, Vercel 프로덕션 Ready `vercel inspect` 확인) + Task 1 seed:prompts(6모드 v0.18 active/v0.19 canary, MCP 쿼리 검증) + 프로덕션 E2E 스모크(예시상대1 일합 생성→energy_food 수/짠맛·mode gating·hanja0·DB 영속, 가드 실패모드 제거 입증). **3-task 완료·프로덕션 라이브.** 잔여: 명리 specialist 인간 사인오프(외부). 상세는 CLAUDE.md §2.
- **미니앱 온보딩 저장실패(3중 블로커) 수정 완료 ✅ (2026-06-18 7차, Claude Code)** — 실기기 온보딩 "저장에 실패했어요" 3중 블로커 해소. branch `feature/miniapp-onboarding-consent` 4 원자 커밋(`c6f0990`·`696f4f0`·`21092e7`·`6a17b9d`, **origin 미푸시·main 미머지**). B1 dev-bearer `import.meta.env.DEV` 게이트(.ait JWT 미인라인, grep 0건) · B2 AuthProvider 마운트 자동로그인+AuthRetryGate · B3 `/api/toss/consent`(flow='toss')+마이그 `20260618000000`(CHECK widening)+Step4Review 동의 게이팅 UI+LegalDocSheet 바텀시트. `db:push` 라이브 적용+up-to-date(`jamhkucluhiibqpjsiov`). miniapp tsc0/vitest 26/build OK/JWT0 · root tsc0/lint0/타깃 11/11. §1.2 Ultracode 4차원 적대 리뷰 2 confirmed 즉시수정(0 HIGH/MED). §사용자 수동: Vercel Toss env · `.ait` 재빌드+콘솔 재업로드 · 실기기 8플로우 E2E. 상세는 CLAUDE.md §2.
- **미니앱 온보딩 진입 플로우 수정 완료 ✅ (2026-06-18 8차, Claude Code)** — 실기기 "내 프로필 '시작하기'→홈으로 튕김" + "로그인 후 프로필 없어도 온보딩 안 뜸" 해소. 같은 `feature/miniapp-onboarding-consent` 브랜치 2 커밋(`d68d567`·`e291ad0`, **origin 미푸시·main 미머지**). Fix A: `isNativeTossEnv()`가 set 안 되는 가짜 전역 `__AIT_NATIVE__` 검사 → 실기기 false → 자동로그인 미발화 → 튕김. SDK `getOperationalEnvironment()`(`'toss'|'sandbox'`)+try/catch로 교체([[feedback-ait-native-env-detection]]). Fix B(§1.1 강제 게이트): 신규 `useMeChart`(['me-chart'] 단일출처·에러 비흡수·ChartCore) + `ProfileGate`(탭바 그룹 pathless layout: chart=null→/onboarding, error→fail-open, 온보딩은 게이트 밖→루프없음) + HomePage/MePage 소비 + Step4Review 성공 시 invalidate. Fix C: 죽은 today-401 리다이렉트 제거. miniapp tsc0/vitest 38(+12)/build OK/JWT0 · root tsc0/lint0. DB·루트 변경 0. §사용자 수동: Vercel Toss env · `.ait` 재빌드+재업로드 · 실기기 4케이스 E2E. 상세는 CLAUDE.md §2.
- **미니앱 온보딩(consent 7차 + 진입플로우 8차) main 머지 + 프로덕션 배포 완료 ✅ (2026-06-18)** — `feature/miniapp-onboarding-consent` → `origin/main` clean ff `f62f366..6490ff7`(8커밋, Vercel 프로덕션 배포). 위 7차·8차 "미푸시·미머지" 표기는 stale(해소). 마이그 `20260618000000`은 머지 전 이미 라이브. 잔여(실기기, 코드 외): Vercel Toss env + `.ait` 재빌드·재업로드. 상세는 CLAUDE.md §2.
- **미니앱 실기기 로그인 실패 + 온보딩 409 수정 + 배포 ✅ (2026-06-19, 9차)** — `fix/miniapp-login-base-url` 3커밋 → `origin/main` ff `b8ee504..0cc9dbd`(Vercel 배포). ① 로그인 실패: 프로덕션 `.ait`가 빈 `VITE_API_BASE_URL` 인라인(로컬 vite 빌드, Vercel env 무관)+`??` 빈문자 미처리 → 자기 오리진 404. `resolveApiBaseUrl()`(빈값→PROD prod호스트)로 수정([[feedback-miniapp-vite-build-env]]). ② 진단 관측성: AuthProvider 에러 비삼킴+게이트 `원인:` · `/api/toss/login` 단계별 sanitize 로깅. ③ 온보딩 409: `users` plain INSERT→`upsert(onConflict:'user_id')` 멱등화(재온보딩 200). Supabase Toss SQL=전부 라이브(import 불필요, 409는 코드 문제). miniapp tsc0/vitest43 · root tsc0/lint0/onboarding16·login16. 잔여(실기기): 동일 `.ait` 재테스트→온보딩 200. 상세 CLAUDE.md §2.
- **미니앱 광고 SDK 레드팀 리뷰 + 수정 + 가격 문서 정합 ✅ (2026-06-19, Claude Code)** — `/code-review` 레드팀(오늘 배치 광고 배너·무료부적·IAP 가격·maxDuration) + 앱인토스 MCP(BannerAd 공식 문서) 교차검증. 머니패스·마이그레이션 클린. **F1[HIGH]**: 광고 `TossAds.initialize` 컴포넌트별 호출(공식 문서 ❌, 2번째+ 배너 attach 누락 위험) → 모듈 싱글톤 1회 init(`ensureTossAdsInitialized`, App 마운트) + `useTossAdsReady` 공유 구독 + `isAdSlotAvailable()` 빈 광고 li 가드 + 회귀 테스트(`61800b8`). 운영 광고 그룹 ID `miniapp/.env.production` `VITE_TOSS_AD_GROUP_ID=ait.v2.live...`(빌드타임 인라인, **Vercel env 아님**, 번들 인라인 ×2 검증)(`18053cb`). **F4**: replay 사용자 CTA/flow ₩880→₩440(오픈할인 실청구가) 통일, 정가 ₩880 유지(`0b010ea`). `fix/miniapp-ad-banner-init`→`origin/main` ff `22e279a..18053cb` + `0b010ea`·상태 로그(Vercel). miniapp vitest 63/63 · root tsc0/lint0. 상세 CLAUDE.md §2.
- **미니앱 프로덕션 인증 장애(만료 토큰) 수정 ✅ (2026-06-19, Claude Code)** — 실기기 전 메뉴 401. 근본원인: 만료 Supabase access token 재전송 → `/auth/v1/user` 403 `bad_jwt: token is expired`(auth 로그 전수 만료, 서명/anon key 오류 0건 → 설정 정상). `AuthProvider`가 저장 토큰을 만료검사 없이 복원·재로그인 안 함, refresh·401 복구 없음 → 영구 재전송. 부차: `use-me-chart` enabled 가드 부재로 null-token 캐시 오염. 수정(재로그인 방식, §1.1): `jwt.isJwtExpired` + `getToken()` 만료 폐기 + `reauth.ts` single-flight 브리지 + `apiFetch` 401 1회 재로그인·재시도(루프 가드, 402 제외) + `AuthProvider performLogin` 핸들러 + `use-me-chart enabled:!!token`. 서버 진단 로그(`server.ts` bearer getUser status/code, PII 미로그, additive). 커밋 `fc44832`(클라)·`f9e201e`(서버) → main ff+push(Vercel 서버 로그 즉시). miniapp vitest 87/87(+24) · root tsc0/lint0(루트 6 실패=로컬 `NEXT_PUBLIC_APP_URL` host 아티팩트, 무관·main 동일). §사용자: `.ait` 재빌드·재업로드(클라 반영) · `VITE_DEV_BEARER` 재발급(dev). 상세 CLAUDE.md §2.
- **웹 OAuth 로그인 장애 수정(카카오 제거 + Google 리다이렉트) ✅ (2026-06-20, Claude Code)** — 웹 2장애(미니앱 정상). ① 카카오 KOE205 = Supabase Kakao 기본 `account_email` scope가 비즈니스 인증 앱 전용(개인 앱 실패), 마이그레이션 후 버튼 잔존 → **§1.1 카카오 로그인 제거**(공유 유지): `kakao.ts`(+테스트) 삭제·버튼/핸들러 제거·`oauth/route.ts parseProvider` google-only·ko.json/테스트 동기. ② Google→localhost(다른 프로젝트)=코드 정상(요청 origin), 근본원인 Supabase **Site URL 폴백**(Redirect URLs allowlist 누락) → **외부 대시보드**: Site URL=`https://todaychemi.vercel.app`+Redirect URLs `/auth/callback`·Vercel prod env 정규 ref·Google Cloud 콜백=Supabase callback. 문서 동기(auth.md Kakao Removed·kakao runbook·checklist). root tsc0/lint0·auth 테스트 28/28. branch `fix/web-oauth-kakao-removal`→main ff+push(카카오 버튼 즉시). §사용자: Supabase Dashboard+Vercel env+Kakao provider Disabled. 상세 CLAUDE.md §2.
- **미니앱 UI/UX 개선(테마 토글·글자 크기·CTA 효과) 완료 ✅ (2026-06-21, Claude Code)** — 실 `.ait` QA 4건. branch `feature/miniapp-ui-prefs-polish`(origin 미푸시·main 미머지). §1.1 4결정(글자=전체 zoom·버튼=주요 CTA만·스타일=흐르는 그라데이션 테두리+글로우·`/ait:design`=진단만). ① 홈 우상단 인연등록→**테마 토글**(중앙 카드·0건 hero·피드 등록 유지): `lib/preferences/`(zustand+플랫 localStorage)+`index.html` pre-paint 스크립트+`tokens.css` `@media dark`→`:root[data-theme="dark"]` 단일블록(시스템은 JS 환원). ② 프로필 **글자 크기**(보통/크게): InfoCard 행+vaul 시트+`:root[data-font-scale="large"]{zoom:1.12}`(px 고정→루트 zoom). ③ **주요 CTA** `@keyframes cta-border-flow`+`.btn-cta`(mask 링+글로우, reduced-motion 정적) 8 CTA 적용, 보조/닫기/필터 제외. ④ 테마 토글 탭 타깃 44pt(AIT 제약). miniapp tsc0/vitest **106/106**/`vite build` OK · playwright 실Chromium 시각검증(다크·zoom·그라데이션). DB·루트 변경 0. `setup.ts` Pointer Capture 폴리필. §1.3(함께 수정 ✅): LoadingState `pulse`/`spin` keyframes 미정의 → tokens.css 정의로 로더 복구. §사용자: `.ait` 재빌드·재업로드. 상세 CLAUDE.md §2.
- **미니앱 디자인 정렬 Phase 1(리퀴드글래스 히어로) 완료 + 배포 ✅ (2026-06-21, Claude Code)** — UIDesign(토스×iOS26×M3) 정렬 멀티세션의 Phase 1(파운데이션+히어로 3종). `feature/miniapp-design-alignment`→`origin/main` clean ff `2edb472..72848e8`(Phase 0 포함 6커밋, 웹 무영향). 5 원자커밋: Pretendard Variable CDN+`--font-display` 바인딩(`227dc7f`)·`.liquid` UIDesign 패리티(`::before` 50%·`::after` 하단rim·`> * z-index:1`, `79ca852`)·today/hapcard/whatif 히어로→`.liquid`(`7f854ac`·`dd19881`·`72848e8`, whatif=cool 톤·흰텍스트). miniapp tsc0/vitest 106/106/build OK(매 커밋 게이트). 라이브 검증(test1, `mint:dev-bearer`): 자동로그인✓·Pretendard 로드✓·today 리퀴드 렌더✓(합카드·또다른나 본문은 유료생성 필요라 미렌더, 동일 클래스). §1.1: me-hero=풀 Dawn 별도 세션·Pretendard 지금 도입·검증 코드먼저. 다음=me-hero Dawn(플랜 `phase-1-fluttering-knuth.md`)·Phase 2-7(CTA pill·elevation·레이더·휠피커·통합). §사용자: `.ait` 재빌드·재업로드. 상세 CLAUDE.md §2.
- **미니앱 디자인 정렬 Phase 2+3 완료 ✅ (2026-06-21, Claude Code)** — Phase 1 Deferred(me-hero Dawn `2366251..07712b0`) 배포 후속. branch `feature/miniapp-design-phase2-7`→`origin/main` clean ff **`02c1f85..6dc2ba3`**(8커밋, Vercel 자동배포). tsc0·vitest **119/119**·build OK. Phase 2 CTA pill 통일(`507a3ad`: 주요/결제 CTA `size="cta"`·페이월 3종 스택 pill+ghost·글로우 규율)·Phase 3 rgba→color-mix 버그(`597dcdf`)·me 카드 SectionCard 통일(`7da863b`)·today warn/ok 톤(`bcdc2eb`)·card-elevated→hairline+Feed/whatif(`b870145`)·버튼 disabled affordance(`d313549`, 적대 리뷰 확정 MEDIUM). 라이브 before/after 미실행(VITE_DEV_BEARER 부재, §1.1 지금 push 확정). **다음=Phase 4(레이더) 새 세션.** 상세 CLAUDE.md §2 + `session_miniapp_design_phase2_3_complete_2026_06_21.md`.
- **미니앱 디자인 정렬 Phase 4(데이터 비주얼) 완료 ✅ (2026-06-21, Claude Code)** — `feature/miniapp-design-phase4-dataviz`→`origin/main` clean ff `3902605..94e9c6a`(Vercel, 웹 무영향). 공용 `ui/bar.tsx` 수평 fill 프리미티브(`ba67fbf`)·me 5축 오행 펜타곤 레이더+중립 2칩(`1b3cbd9`, OhaengBars 교체·삭제, 희신 라벨 회피=ADR-018)·합카드 user-vs-relation 오버레이 레이더(`c828243`, ADR-016 섹션 잠금 불변)·`radar-geometry.ts` 단일화(`eef17ae`). §1.1: A1 중립칩·B1 레이더+바 유지·C1 수평바만. 적대 5차원 워크플로우 리뷰(`wf_66e410c2`) 2 confirmed 수정. tsc0·vitest **145/145**·build OK. 상세 CLAUDE.md §2 + `session_miniapp_design_phase4_complete_2026_06_21.md`.
- **미니앱 디자인 정렬 Phase 5(iOS 휠 피커) 완료 ✅ (2026-06-21, Claude Code)** — 네이티브 date/time input→iOS 휠/트레이 4 surface(온보딩2·인연등록·me-edit). `feature/miniapp-design-phase5-wheelpicker`→`origin/main` clean ff `cae1ef1..716094b`(Vercel). 6 feat(`25febb0` 로직·`4864b19` WheelColumn/WheelTray portal/PickerField·`62262e5` 합성필드·`7f57162`·`c45e1ef`·`61a01dc`) + 적대 5차원 리뷰(`wf_f2dc2e9c`, 10제기·8confirmed)→4 fix(`8dde2f2` **HIGH portal pointer-events**[vaul 중첩 트레이 死]·`68a2f5a` a11y 키보드/dialog/haspopup·`9e9c57b` initialDraft clamp·`65175fd` 라벨). 불변 보존(YYYY-MM-DD/HH:MM·검증·draft-store). tsc0·vitest **186/186**·build OK. 라이브 실포인터 재검증✓. 상세 CLAUDE.md §2 + `session_miniapp_design_phase5_complete_2026_06_21.md`.
- **미니앱 디자인 정렬 Phase 6(컴포넌트 통합) 부분 완료 ✅ (2026-06-21, Claude Code)** — 드리프트 제거. main 직접 6커밋. §1.1 3결정(Seg 단일 `Seg<T>`·확인창 센터 `ConfirmDialog`·페이월 표현용 `FeaturePayCard` 추출[머니패스 무변경]). 탭바 M3 active pill(`0a8cc8f`)·`BackButton`(`b4f764a`)·`ui/seg.tsx`(`f63f5ce`)+Seg 마이그(`5ccae37`)·`ConfirmDialog`(`a4b7e1b`)+삭제확인 통일(`7e04f1b`). tsc0·vitest **216/216**·build OK. 다음=Batch D/E. 상세 CLAUDE.md §2 + `session_miniapp_design_phase6_partial_handoff_2026_06_21.md`.
- **미니앱 디자인 Phase 6 Batch D/E + 트랩 픽스 완료 ✅ (2026-06-22, Claude Code)** — Phase 6 마감. main 5커밋 → `origin/main` clean ff `00d80c4..0ac1de5`(Phase 6 전체 12커밋 첫 푸시, Vercel 미니앱 리빌드, 웹 무영향). **Batch D**: 홈 인트로→Dialog(`1cb0b3d`)·이름변경 Dialog+⋯메뉴 Drawer 액션시트(`29bc664`). **Batch E**: 공용 `FeaturePayCard`(`8a1c048`, +12 TDD, 동의 게이트 4중복→단일출처, 머니패스 무변경)→4 페이월 마이그(`2481872`, replay `?replay=1`·payDismissed 보존). 🔴 **트랩 픽스**(`0ac1de5`): Drawer→Dialog 전환 시 base-ui Dialog가 vaul body `pointer-events:none` 상속해 死 → `dialog.tsx` Overlay/Popup `pointerEvents:auto`+가드 테스트([[feedback-synthetic-click-bypasses-pointer-events]]). 적대 Workflow(money/convention 0 confirmed)+라이브 /browse(홈 인트로 실포인터✓). 케미카드 본화면=로컬 LLM500 미도달→온디바이스 이연. tsc0·vitest **230/230**·build OK. §사용자: `.ait` 재빌드·재업로드. 상세 CLAUDE.md §2 + `session_miniapp_design_phase6_partial_handoff_2026_06_21.md`.
- **미니앱 디자인 정렬 Phase 7(전체 통합 검증) 완료 ✅ (2026-06-22, Claude Code)** — 마스터 플랜 `cheerful-juggling-scroll.md`(Phase 0–7) **종료**. 코드 0(감사 전용). 타깃 `UIDesign/`(Toss×iOS26×M3, §1.6) HTTP 렌더 vs `/browse` 실 Chromium 393px 대조. PASS(reachable 4): 오늘/홈(리퀴드 히어로·M3 탭바 pill·reward Dialog)·내사주(dawn 워터컬러 히어로·일주 섹션카드·거대 숫자·바차트·5축 레이더)·온보딩(iOS 휠 트레이)·케미피드(Seg 필터·elevated 카드). AIT: safe-area✅·swipe-back 기본·TDS 미사용(확정). **점수 4.5→8.7(Δ+4.2)**, 잔여=hapcard 결과 히어로/페이월 LLM 게이트 라이브 미도달→온디바이스. 리포트 `~/.gstack/projects/SAJU/designs/phase7-final-audit-2026-06-22.md`. tsc0·**230/230**. 상세 CLAUDE.md §2.
- **`.ait` 재빌드 + dev-bearer 빌드 누수 발견·하드닝 완료 ✅ (2026-06-22, Claude Code)** — 구 `.ait`(6/18~19) → 현 main 재빌드. 🔴 1차 빌드에서 dev-bearer JWT 16건 웹 번들 인라인 발견: `import.meta.env.DEV ? VITE_DEV_BEARER : undefined` 런타임 게이트를 vite8/rolldown 이 DCE 못 함(문서·주석의 "프로덕션 미인라인"은 오해였음). `.env.local` `VITE_DEV_BEARER` blank 후 재빌드 → dist 전체 eyJ 0건. **빌드 하드닝**(`4fd4266`, §1.1 승인, +5 TDD): `miniapp/scripts/assert-no-dev-bearer.ts` — `vite.config.ts` 함수형 전환+`loadEnv`로 해석한 `VITE_DEV_BEARER`가 `command==='build'`에 비어있지 않으면 산출물 생성 전 빌드 실패(serve 무영향, 양방향 검증). 최종 `.ait`: main `4fd4266` 빌드(deploymentId `019eeb3d`, ~4MB, eyJ0·prod host·광고그룹 인라인). [[feedback-miniapp-vite-build-env]]. docs 로그 `b04ab0c`(직전 HEAD). tsc0·vitest **235/235**. §사용자 후속(2026-06-22): IAP SKU 4종 콘솔 등록 완료(판매가 550/440/440/550, 공급가 500/400/400/500) + `miniapp/.env.local` `VITE_TOSS_IAP_SKU_MAP` 반영. 남은 수동: SKU 반영 `.ait` 토스 콘솔 업로드 · Vercel 서버 `TOSS_IAP_SKU_MAP`/mTLS/env 재배포 · dev 재개 시 `pnpm mint:dev-bearer --write`(빌드 전 다시 blank, 가드 강제). 상세 CLAUDE.md §2.

---

## 3. 단일 핵심 (ADR 잠금)

본 제품의 단일 핵심 피처는 다음 두 가지이며, 모든 화면·KPI가 이쪽으로 유입되도록 설계되어 있다. 이 위계를 흔드는 제안은 §1.1 사용자 승인 대상.

| 핵심 | 위치 | ADR |
|---|---|---|
| §4.2 관계 사주 해석 (케미카드 정가 ₩1,100/11부적, 현금 550) | `fluttering-gathering-island.md` §4.2 / `PRD.md` §6 | ADR-010, ADR-016, ADR-026 |
| §4.3 관계 진화 타임라인 재해석 (정가 ₩880/9부적, 현금 440) | 같은 문서 §4.3 (Phase 1.5) | ADR-033 |

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
- **ADR-039** Pay-per-use 결제 — 부적 충전 폐지, 유료 기능 사용 시 즉시 결제. 하이브리드(무료 부적 우선→부족 시 현금)·가격 정가 1,100/880/880(현금 550/440/440, 부적 11/9/9p, 2026-06-19 개정 — 웹·미니앱 통일) 단일출처(`feature-prices.ts`)·원자성 모델 C(선생성→성공 시 결제)·잠금 단일진실 `isFeatureUnlocked`(쓰기+read-path 본문 라우트 모두 게이트). **Amended 2026-06-10 §9**: 인연 등록 슬롯(모델 B) — 2명까지 무료, 3번째부터 `relation_slot` 정가 1,100원/11부적(현금 550), 현재 보유 수 게이트(삭제 시 회복), draft 스테이징→머티리얼라이즈(claim-first 멱등+lazy recovery), cash-gen 한도 미적용. (`docs/adr/ADR-039-pay-per-use-billing.md`)
- **ADR-040** 파생·교차분석층 = LLM 해석 근거 전용, 점수 무개입 — `chart_core.derived`(theory v3) + `cross_analysis`(cross-v1, 비영속). 순수 결정형(1000회 테스트 의무) + 프롬프트 환각 가드("제공 필드 외 단정 금지") + PII 연령차 밴드만. 신강약·용신 룰은 specialist 검수 전 잠정(`manseryeok_theory.md` §6.7). **Amended 2026-06-18 (기운 케어)**: 케미카드 보조 추천층 `energy_food`(전 6모드 공통 보완 원소 음식) + `meeting_vibe`(첫/썸 만남 분위기) — 결정형 파생(`saju/pair-complement.ts` + `hapcard/element-food-map.ts`, 점수 무개입), 음식 선택은 서버·LLM은 `energy_food.copy` 한 문장만 윤문(이름 제약 가드→결정형 폴백), UI = ADR-016 잠금 1~6 위 additive "기운 케어" 탭, seed-prompts active=canary 동본문(콘텐츠 게이팅 불가). (`docs/adr/ADR-040-derivation-cross-analysis-layer.md`)

---

## 4. 기술 스택 (ADR-037 잠금)

상세는 `tech_stack.md` 참조. 핵심 잠금만 요약:

- **Frontend**: Next.js 16.2.6 App Router + TypeScript strict + Tailwind + shadcn/ui + Radix
- **State**: TanStack Query v5 (서버) + Zustand (UI)
- **Backend**: Next.js Route Handlers (별도 서버 X) + Supabase Free (Postgres + Auth + RLS + Storage)
  - **Canonical Supabase project_ref**: `jamhkucluhiibqpjsiov` (`goonghap`, Northeast Asia / Seoul). 다른 ref(예: `aseszttxkxpfzenmbylx`, `muuudarddkvevwdpefvy`)는 작업용 아님. 링크 확인: `pnpm db:status`. 재링크: `pnpm db:link`. push: `pnpm db:push:dry` → `pnpm db:push`.
- **i18n**: next-intl (KO 1차, EN/VI/TH/MS/ID Phase별)
- **만세력**: ssaju (年/月/時柱 절기·입춘 기준 source + day_pillar cross-validator) + KASI (day_pillar 진본) + manseryeok-js (보조 cross-validator) — 2026-05-03 §1.1: ssaju 역할 年/月/時柱 프로덕션 source로 확대. 야자시 = 조자시 통합 학파 (ADR-037)
- **사주 엔진**: 자체 TypeScript `fortune-core` (monorepo 패키지) — 결정형
- **LLM**: OpenAI GPT-5 중심(합카드/다시합/오늘합/딥합) + GPT-5 mini 보조 여지 + Anthropic Claude fallback(`claude-sonnet-4-5` 기본). Production은 ZDR 적용 OpenAI project의 `OPENAI_PROJECT_ID`와 `LLM_DAILY_BUDGET_USD` 필수.
- **결제**: 토스페이먼츠 (KR Phase 1) / Stripe (Phase 3 SEA)
- **Hosting**: Vercel Hobby (Phase 3 진입 전 Cloudflare 전환 재검토)
- **Tests**: Vitest + Playwright + Zod

스택 변경은 §1.1 사용자 승인 대상이며, 승인 시 `tech_stack.md` + `fluttering-gathering-island.md` + `PRD.md` 동시 갱신 의무 (§12).

---

## 5. PII / ZDR 절대 규칙 (협상 불가)

OpenAI / Codex 등 외부 LLM에 **절대 보내지 않는** 필드:
- `birth_date` (원본)
- `name`, `nickname`
- `email`
- `birth_place`
- `gender` (원본)

LLM 페이로드에 허용되는 것은 **`chart_core` + `question_slot` + `theory_profile.profile_version`** 뿐이다. (출처: `tech_stack.md` §3.5, `FRONTEND-PREP.md` §11.2)

OpenAI는 **ZDR (Zero Data Retention)** 계약 적용 필수. 이 규칙을 우회하는 코드 작성 시 즉시 중단하고 사용자에게 보고.

---

## 6. 명령어

### 6.1 현재

```bash
# 개발
pnpm dev

# 기본 검증
pnpm tsc --noEmit
pnpm lint
pnpm vitest run
pnpm build

# E2E / 런칭 게이트
pnpm e2e
pnpm e2e:auth
pnpm verify:launch-readiness
pnpm verify:payment-readiness
pnpm verify:llm-resilience-readiness
pnpm verify:billing-policy-readiness

# 포맷
pnpm format
```

단일 파일 테스트는 `pnpm vitest run path/to/file.test.ts` 형식을 사용한다. 결제/보안 변경 후에는 §10에 따라 `/cso` → `/qa` 검증을 추가한다.

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
└─ AGENTS.md                        # 본 파일
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
| 케미카드 (결과 카드) | `hapcard` | `result-card`, `compat-card`, `합카드` |
| 합점수 | `compatScore` (코드) / "합게이지" (UI) | `score`, `rating` |
| 6모드 | `mode` — `'일합' \| '친구합' \| '돈합' \| '첫합' \| '썸합' \| '오래합'` | `category`, `type` |
| 본명식 | `chart` — `chart_core`, `userChart` | `birthChart`, `natal` |
| 일주 | `ilju` | `dayPillar` |
| 오행 | `ohaeng` | `fiveElements`, `wuxing` |
| 십신 | `sipsin` | `tenGods` |
| 만세력 | `manseryeok` | `lunarCalendar` |
| 합·형·충·해 | `hapChungHyungHae` (코드 키) | 영문 분리 식별자 |
| UI 소프트 alias | `끌림/긴장/부딪힘/소모` (display_label) — 합→끌림, 형→긴장, 충→부딪힘, 해→소모. GlossaryKey는 classical(`합\|형\|충\|해`) 유지, UI 표면만 소프트 용어 | — |
| 오늘 케미 | `todayHap` | `dailyFortune`, `오늘합` |
| 딥합 (깊이 리포트) | `deepHap` | `report`, `deepReport` |
| 케미피드 (인연 그리드) | `feed` | `list`, `grid` (라우트 키), `합피드` |
| 케미 다시 맞추기 (재해석) | `replay` | `reInterpret`, `다시합`, `그럴리 없어! 다시` |
| 또 다른 나 (자기진단 6모드) | `whatif` (DiagnosticType) | `만약에 우리`, `마이플레이`, `만약합` |
| 인연 슬롯 / 등록비 (3번째+ 정가 1,100원/현금 550원) | `relation_slot` (feature_id) | `사람칸`, `person-slot`, `seat`, `quota` |
| 지장간 | `jijanggan` | `hiddenStems`, `장간` (코드 식별자) |
| 신강약 | `sinkang` — `'신강' \| '중화' \| '신약'` | `dayStrength`, `strength` |
| 용신 | `yongsin` (희신 `huisin`) | `usefulGod`, `favorableElement` |
| 궁위 | `gungwi` — 년주/월주/일주/시주 | `palace`... 단 LLM payload 키 `palace`/`palace_meaning`은 전송용 영문 키로 예외 (`palace_name` 금지 — PII 키 스캔) |

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

압축 산출물은 메모리 시스템(`C:\Users\batis\.Codex\projects\C--DEV-SAJU\memory\`)에 작성하며, `MEMORY.md` 인덱스에 한 줄 추가.

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
| `CLAUDE.md` §2/§3/§8 등 변경 | 본 파일(`AGENTS.md`) 대응 섹션 동시 갱신 (Claude Code ↔ Codex 공유 진실 유지) |

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
- `MEMORY.md` — 결정·미결정 인덱스 (`C:\Users\batis\.Codex\projects\C--DEV-SAJU\memory\`)

## 15. Git 저장소

- **Remote**: `origin` = `git@github.com:DeepHighAI/todaychemi.git` (canonical, 유일 remote — 2026-06-10 `twoday`에서 리네임, 구 주소는 GitHub redirect)
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
