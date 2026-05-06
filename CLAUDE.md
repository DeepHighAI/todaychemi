# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 본 문서는 합플(Hap-Plae) / Saju Lens 프로젝트 전용 규칙이다. 보편 규칙은 `C:\DEV\CLAUDE.md`(상위 디렉토리)를 참조하며 중복 작성하지 않는다.

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

---

## 2. 프로젝트 상태 (2026-05-06 기준)

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
- §1.3 별도 이슈 잔여: ESLint 9 다운그레이드 별도 PR(§1.1 결정 대기). Kakao redirect_uri 동기화(사용자 보류). Supabase Google provider 활성화(Dashboard 수동). PR-2 시점 untracked 파일 정리(§1.1 결정 필요).
- **S-07a share 완료 ✅** — build-share-payload + share-handler(Web Share+clipboard) + ShareSheet(Drawer) + HapcardShare 통합 + page 배선. `docs/specs/replay.md` 작성 완료(§1.1 D1~D4 결정 매트릭스).
- S-07a 커밋: `99628c0`(build-share-payload) · `f4667eb`(share-handler) · `153d277`(ShareSheet) · `17bd916`(type fix) · `389b901`(HapcardShare+page wiring) · `0e2a8fa`(replay spec).
- §1.3 별도 이슈 잔여: ESLint 9 다운그레이드 별도 PR(§1.1 결정 대기). Kakao redirect_uri 동기화(사용자 보류). Supabase Google provider 활성화(Dashboard 수동). PR-2 시점 untracked 파일 정리(§1.1 결정 필요). `relation_nickname`/`relation_gender_normalized` builder.ts JOIN 연결(§1.1 결정 대기).
- **S-07b Replay 완료 ✅ (2026-05-06)** — buildReplay async 함수 + POST /api/hapcards/[id]/replay route handler GREEN. 커밋 `c69acff`. **805/805 PASS**, 0 TS errors.
- **`supabase db push 0022+0023` 적용 완료 ✅ (2026-05-06)** — `deduct_tokens` / `refund_tokens` RPC + `hapcard_replays_idempotency` UNIQUE 제약 라이브 반영. 검증 스크립트 `scripts/verify-replay-migrations.ts`.
- **다음**: `database.types.ts` 재생성 → route.ts `as unknown as` 캐스트 제거(§1.1 결정 대기). F5 sprint 이후 작업 §1.1 결정 대기.

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
- **LLM**: OpenAI 4단 (GPT-5o 핵심 / GPT-5 딥합 / GPT-5 mini 오늘합 / Anthropic Claude fallback)
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
| 합·형·충·해 | `hapChungHyungHae` | 영문 분리 식별자 |
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
