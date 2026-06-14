# 오늘케미 → 앱인토스 런칭 빌드 · Goal Prompt

- 작성일: 2026-06-14
- 용도: **앱인토스(Apps in Toss) 미니앱 출시 빌드를 완성**하기 위해 실행 세션(Claude Code 등)에 통째로 입력하는 목표 지시문(goal prompt)이다.
- 근거: 앱인토스 MCP 라이브 문서(2026-06-14 재검증) + `docs/research/apps_in_toss_integration_review_2026-06-07.md`(§9 확정 결정 D1~D6, §13 12-agent 재검증) + 현재 코드베이스.
- 사용법: 아래 `=== GOAL PROMPT START ===` ~ `=== GOAL PROMPT END ===` 블록 전체를 실행 세션 첫 메시지로 붙여넣는다. GSD 마일스톤(`/gsd-new-milestone`) 시드로도 사용 가능.

---

## 이 문서를 쓰기 전 검증한 라이브 사실 (MCP, 2026-06-14)

리뷰 문서(2026-06-07/08) 이후 1주 경과 — 빌드/출시의 핵심 사실을 앱인토스 MCP로 재대조해 아래를 확정·정정했다. **goal prompt는 이 사실 위에 작성됐다.**

1. **빌드 체인 확정** (`tutorials/webview.md`): `pnpm add @apps-in-toss/web-framework` → `pnpm ait init` → `granite.config.ts` 자동 생성 → `pnpm build` → 프로젝트 루트에 `<appName>.ait` 생성 → 콘솔 업로드 → QR 토스앱 테스트 → 검토 요청(테스트 1회 이상 완료 필수).
2. **`granite.config.ts` 형상**: `appName`(딥링크 `intoss://{appName}` 고유키, 콘솔과 동일) · `brand{ displayName, primaryColor, icon(콘솔 업로드 URL) }` · `web{ host, port, commands{ dev:'vite dev', build:'vite build' } }` · `permissions[]` · `outdir:'dist'`.
3. **⚠️ TDS WebView = React 18 강제** (신규 사실): 공식 TDS 설치 명령이 `@toss/tds-mobile @toss/tds-mobile-ait @emotion/react@^11 react@^18 react-dom@^18`로 **react@^18을 핀**한다. 현재 앱은 React 19.2.4 → **TDS 채택 시 React 18 다운그레이드가 사실상 강제**. 이로써 호환성 스파이크(B4)가 단순 권고가 아니라 **P0 go/no-go 게이트**로 격상된다.
4. **사업자 등록 = 하드 선행조건** (정정): `prepare/console-workspace.md` 명시 — 비사업자 개인도 출시는 가능하나 **수익화 기능과 토스 로그인은 사용 불가**. 우리는 둘 다 필수 → **사업자 등록 없이는 빌드 자체가 무의미**. 워크스페이스 직접 생성은 **만 19세 이상**.
5. **로그인** (`login/develop.md`, `appLogin.md`): `appLogin()` → `{ authorizationCode, referrer:'DEFAULT'|'SANDBOX' }`. 코드 유효 10분·일회성. 토큰 교환/사용자정보 조회는 **반드시 서버**(mTLS). BaseURL `https://apps-in-toss-api.toss.im`.
6. **IAP** (`iap/develop.md`, framework 레퍼런스): `getProductItemList()` → `createOneTimePurchaseOrder({ options:{ sku, processProductGrant(orderId)→boolean|Promise<boolean> }, onEvent, onError })` → `getPendingOrders`/`completeProductGrant`(복원) → `getCompletedOrRefundedOrders`(환불 감지). SDK ≥1.1.3(지급완료), ≥1.2.2(복원). **`processProductGrant`는 30초 내 true 반환** 못 하면 사용자에게 환불 페이지 노출.
7. **iframe**: 전면 금지, **단 YouTube 임베드는 예외 허용**(라이브 문서가 명시 — 리뷰 문서의 "예외 미확인" 표기는 정정됨).
8. **출시**: `.ait` 압축해제 100MB 이하, 리소스는 빌드와 분리(CDN) 권장. 비게임은 **앱 내 기능 최소 1개**(검토 1~2영업일). 검수 가이드 = `checklist/app-nongame.md`(반드시 준수). 외부링크/자사앱 유도 금지 = `checklist/miniapp-external-link.md`.
9. **로컬 상태**: `public/apps-in-toss/`에 로고/썸네일 에셋 다수 기존재(콘솔 등록에 재사용). `src/lib/payments/feature-prices.ts` = list 1,000/800/600(+relation_slot 1,000)에 **2026-06-14 오픈초기 50% 할인 적용 중**(amount 500/400/300/500). → **고정가 IAP sku와 충돌**(아래 §5 게이트).

---

```
=== GOAL PROMPT START ===
```

## §0. MISSION (북극성)

너의 임무는 **오늘케미(TWODAY)를 앱인토스 미니앱으로 출시할 수 있는 빌드를 완성**하는 것이다. "출시할 수 있는 빌드"의 정의:

> **DONE = (1) `pnpm build`로 `<appName>.ait` 번들이 생성되고, (2) 앱인토스 샌드박스 앱 + 토스앱 QR에서 8개 핵심 플로우가 토스 로그인·IAP 결제 포함 완결 동작하며, (3) `checklist/app-nongame.md` 검수 기준 + 외부링크/AI고지/IAP 필수 시나리오를 모두 충족해 콘솔 "검토 요청"을 제출할 수 있는 상태.**

핵심 전략(확정): **백엔드(Vercel API·만세력 엔진·점수식·LLM·Supabase·31 라우트)는 재사용**하고, **토스 안에서 도는 프론트 채널(Vite SPA) + 로그인/결제 연결부만 신규 구축**한다. 기존 Next.js 웹은 그대로 병행 운영한다.

너는 코드/설정/문서를 만든다. 콘솔 가입·사업자 등록·인증서 발급·sku 등록·검수 제출은 **대표(사용자)의 외부 작업**이며(§7), 그 산출물(appName, mTLS 인증서, sku, 복호화 키 등)을 입력받아 빌드에 반영한다.

---

## §1. 시작 전 필독 (재결정·재탐색 금지)

아래는 **이미 확정**됐다. 다시 묻거나 다시 정하지 마라. 그대로 따른다.

- **권위 문서**: `docs/research/apps_in_toss_integration_review_2026-06-07.md` 전체(특히 §3 기능 설계, §6 제외 항목, §9 확정 D1~D6, §10 로드맵, §13 B1~B9). 이 문서가 빌드 설계의 단일 출처다.
- **프로젝트 규칙**: `CLAUDE.md`(§1 필수규칙·§3 비협상 ADR·§5 PII/ZDR·§8 용어·§12 변경매트릭스), 상위 `C:\DEV\CLAUDE.md`.
- **확정 결정 D1~D6** (리뷰 §9):
  | ID | 확정 내용 |
  |---|---|
  | D1 | 모노레포 내 **별도 Vite SPA 신규** + 컴포넌트 이식 (Next 미들웨어/서버컴포넌트/Image 의존 제거 후) |
  | D2 | 토스 로그인 scope = **`user_key`만** (PII 무수집, ADR-011 정합, 복호화 키 불필요) |
  | D3 | 결제 이원화 — 미니앱=**IAP**, 기존 웹=토스페이먼츠 pay-per-use **병행 유지** |
  | D4 | 1차 출시 = **전체 8 플로우** (온보딩·인연등록·케미피드·케미카드·오늘케미·본명식·또다른나·다시맞추기 + 공유) |
  | D5 | TDS 적용 깊이 = **채널톡 검수기준 확인 후 결정** (TDS는 공식상 *선택* — §5 게이트로 잔존) |
  | D6 | 가격 = **1,000 / 800 / 600원** 티어(웹·미니앱 통일). 단일출처 `feature-prices.ts`. |
- **잠금 ADR(비협상)**: ADR-002(자유채팅 X)·ADR-011(별명만)·ADR-035(점수 결정형, LLM 점수 개입 금지)·ADR-038(Hanja 노출 금지, `convertHanja()` 안전망 의무)·ADR-039(pay-per-use, 잠금 단일진실 `isFeatureUnlocked`)·ADR-040(파생/교차분석층).

---

## §2. 앱인토스 MCP 사용 규칙 (그라운딩 필수)

**모든 SDK 시그니처·버전 핀·설정 형상·검수 기준은 코드 작성 직전 앱인토스 MCP로 라이브 재확인한다.** 기억이나 일주일 지난 리뷰 문서를 시그니처/버전/검수 기준의 출처로 삼지 마라(개념·결정의 출처로만 사용).

- 도구: `mcp__apps-in-toss__search_docs` / `get_doc` / `list_examples` / `get_example` / `search_tds_rn_docs`·`get_tds_rn_doc` / `search_tds_web_docs`·`get_tds_web_doc`.
- 각 Phase 진입 시 해당 영역 문서를 먼저 검색→정독한 뒤 구현한다. 시작점 시드:
  | 주제 | doc id / url |
  |---|---|
  | WebView 빌드 셋업·granite.config | `38ca80ed3b775d6c` · `tutorials/webview.md` |
  | 미니앱 출시(.ait/검수/100MB) | `8971d4b432ecb114` · `development/deploy.md` |
  | 토스앱 테스트(번들/QR) | `e6fd6d2b697f7860` · `development/test/toss.md` |
  | 비게임 검수 체크리스트(=DONE 바) | `ee88cf6dad963867` · `checklist/app-nongame.md` |
  | 외부링크/자사앱 유도 금지 | `3a4727e22e4083fd` · `checklist/miniapp-external-link.md` |
  | 앱 내 기능(최소 1개) | `6af044c79403a514` · `development/test/function.md` |
  | 콘솔 앱 등록·사업자 | `d990b2480c0b106f` · `prepare/console-workspace.md` |
  | 토스 로그인 개발(서버 교환) | `7bfd7becd29c506e` · `login/develop.md` |
  | IAP 개발(필수 시나리오) | `ee1fc55236c33bf9` · `iap/develop.md` |
  | mTLS/API 개요 | `834f175372a0c3f7` · `api/overview.md` |
  | TDS WebView | `tossmini-docs.toss.im/tds-mobile` (MCP `search_tds_web_docs`) |
- 샘플 저장소(`toss/apps-in-toss-examples`)는 **구조 참고만** — SDK 1.5.2/React18 고정이라 버전은 따르지 마라.

---

## §3. 절대 제약 (위반 시 즉시 중단·보고)

**플랫폼 정책 (검수 반려 사유):**
- 로그인은 **토스 로그인만**. 미니앱에 Google OAuth·이메일/비번 로그인·가입 페이지 **포함 금지**.
- 디지털 상품(케미카드·또다른나·다시맞추기) 결제는 **IAP만**. 토스페이먼츠 SDK·`feature-pay-sheet`·`/api/payments/feature/*`를 미니앱 경로에 **싣지 마라**.
- **외부 링크/자사 앱·웹 유도 전면 금지** — 공유가 자사 웹으로 랜딩되는 것도 금지. terms/privacy/refund는 **링크가 아닌 인앱 정적 뷰**로.
- **생성형 AI 고지/라벨은 법적 의무**(미이행 과태료 최대 3,000만원): 최초 사용 사전 고지 + 케미카드·오늘케미·또다른나 결과에 "AI 생성" 라벨. (웹의 `AiDisclosureBadge`/`AiDisclosureNotice` 자산 재사용.)
- iframe 금지(YouTube 임베드만 예외). 번들 100MB 이하. 서버 API는 **mTLS**, CORS 허용목록에 `*.apps.tossmini.com`/`*.private-apps.tossmini.com`.
- 카테고리는 **라이프스타일/운세**로 — '소셜/만남' 선택 금지(데이팅 규제 회피). 돈합 카피의 투자자문/수익보장 오인 표현 점검.

**PII/ZDR (협상 불가, `CLAUDE.md §5`):** 외부 LLM 페이로드에 `birth_date·name·nickname·email·birth_place·gender` 원본 절대 금지. 허용은 `chart_core + question_slot + theory_profile.profile_version`만. D2(`user_key`만)를 깨고 토스 PII scope를 받지 마라(받으려면 §5 게이트).

**프로젝트 규칙:** TDD(테스트 먼저)·원자 커밋(한 번에 한 변경)·`CLAUDE.md §8` 용어(hapcard=케미카드 등 코드 식별자 불변, UI 한글)·코드 주석 한글·`convertHanja()` 안전망·§12 변경매트릭스 동시갱신·**무관한 코드 수정 금지**(발견 이슈는 메모 후 별도 보고). 컨텍스트 60% 도달 시 핸드오프 압축(§1.4).

---

## §4. 빌드 범위 — Phase별 산출물 & 종료 게이트

각 Phase는 **MCP 정독 → TDD 구현 → 종료 게이트 검증 → 사용자 보고** 순. 게이트 미충족 시 다음 Phase로 넘어가지 마라. P1은 대표 작업이라 병행 가능하나, **P2 이후 코드 작업의 다수는 P1 산출물(appName·mTLS·sku)에 의존**한다.

### P0 — 호환성 스파이크 (go/no-go 게이트) ★최우선
- 목표: Granite + `@apps-in-toss/web-framework`(최신 안정 2.6.x, MCP로 현재 버전 재확인) + 기존 deps(React, vaul, @base-ui/react, recharts, Tailwind v4)의 동시 부팅 검증.
- 작업: 모노레포에 임시 `miniapp/` 워크스페이스 → SDK 설치 → `ait init` → 최소 컴포넌트 1개 → `pnpm build`(.ait) → 샌드박스 부팅.
- **결정 강제**: TDS 채택 시 `react@^18` 강제(라이브 확인됨) ↔ 앱 React 19.2.4. **(A) React 18로 미니앱 셸 고정 / (B) TDS 미채택하고 React 19 유지**를 §5-2로 사용자에게 올린다.
- 종료 게이트: 최소 .ait가 샌드박스에서 흰화면 없이 부팅 + React 버전 정책 확정.

### P1 — 콘솔·계약 준비 (대표 작업 / §7과 동일, 병행)
- 산출물 수령: 확정 `appName`, mTLS 인증서(cert/key PEM), IAP sku 3종, 토스 로그인 약관+scope=`user_key`, 연결끊기 콜백 URL 등록, 채널톡 답변(운세 카테고리/TDS 범위/부적 정책/getAnonymousKey/Sentry/주문조회 SLA/계정링크/임베드).
- 종료 게이트: 위 값들이 `.env`/설정에 주입 가능 상태. **사업자 등록 완료**(없으면 로그인·결제 불가 → 빌드 무의미).

### P2 — 미니앱 셸
- 작업: `miniapp/`(pnpm workspace) Vite+React SPA, `granite.config.ts`(appName/brand/web.commands/outdir, 콘솔과 동일), SPA 라우터, 공용 레이아웃·디자인 토큰 이식(globals.css M3 토큰), i18n(next-intl → SPA용), TanStack Query, 에러/로딩/빈상태 프리미티브. Next 의존(`next/*`, 서버컴포넌트, 미들웨어) 전부 제거.
- MCP: `webview.md`(셋업), TDS 채택 시 `search_tds_web_docs`.
- 종료 게이트: 빈 셸 + 탭 내비게이션이 샌드박스 부팅, 환경분기(dev/prod) 동작.

### P3 — 인증 브릿지 (백엔드 신규 + 31라우트 듀얼인증 리팩터)
- 클라: `appLogin()` → `authorizationCode` 서버 전달.
- 서버 신규 모듈: `toss-mtls-client.ts`(인증서 회전 포함) · `POST /api/toss/login`(코드→accessToken/refresh→`/login-me`→`userKey`) · `userKey↔Supabase user_id` 매핑(최초 생성) · 자체 **Bearer 세션** 발급 · `POST /api/toss/disconnect`(UNLINK/WITHDRAWAL_* 콜백 → `/me/delete-request` 재사용, 멱등).
- 31 보호 라우트: 쿠키 `getUser()` → **Bearer 우선 + 쿠키 fallback** 듀얼 인증으로 user-resolution 추상화 + CORS(tossmini 2도메인). 토큰 저장은 토스 네이티브 `Storage` SDK(iOS 서드파티 쿠키 차단 대응).
- **B1 계정 모델은 §5-1 게이트** 확정 후 진행. mini-ADR로 Bearer 발급/저장/갱신/검증순서/폐기 명세.
- 종료 게이트: 샌드박스에서 토스 로그인 → Bearer로 보호 API 200 + 연결끊기 콜백 멱등 처리.

### P4 — 8 플로우 화면 이식 (작업량 최대)
- D4 전체: 온보딩 → 인연등록(relation_slot 무료2/유료 게이트 포함) → 케미피드 → 케미카드(13섹션) → 오늘케미 → 본명식 → 또다른나 → 다시맞추기. 공유 진입점 포함.
- 규칙: 화면은 백엔드 API를 **그대로 호출**(도메인 로직 재구현 금지). ADR-016 카드 컴포지션·ADR-038 convertHanja·ADR-040 근거 탭 유지. TDS 혼용 범위는 D5 결과 반영.
- 종료 게이트: 8 플로우가 샌드박스에서 데이터·에러·빈상태까지 동작(결제 전 무료/잠금 분기 포함).

### P5 — IAP 결제 통합 (ADR-039 모델 C 유지)
- sku 3종(케미카드/또다른나/다시맞추기) + `getProductItemList` 노출 + `createOneTimePurchaseOrder({options:{sku, processProductGrant}})`.
- `processProductGrant(orderId)` → **우리 서버 unlock API**(mTLS `order/get-order-status`로 `PURCHASED|PAYMENT_COMPLETED` 검증 → `isFeatureUnlocked` 해제 → true). **30초 내·멱등** 필수. IAP가 mTLS 검증 후 `payments`(status=confirmed) insert하면 기존 read-path 게이트·Model C 그대로 흡수(리뷰 §13 B9 확인).
- 복원: 재진입 시 `getPendingOrders` → 재지급 → `completeProductGrant`. 환불: `getCompletedOrRefundedOrders`로 `REFUNDED` 감지 → 잠금 회수 정책.
- `resolveFeatureCharge`의 `pay_required` 분기에서 402/토스페이먼츠 시트 대신 **IAP 시트**를 띄운다(웹은 불변).
- **IAP sku 가격 = §5-3 게이트**(오픈초기 50% 할인 ↔ 고정가 sku).
- 종료 게이트: 샌드박스 IAP **필수 시나리오 3종**(정상결제→지급 / 미결주문 복원 / 환불 회수) PASS.

### P6 — 정책 요건
- AI 고지/라벨(§3, 법적 의무) 미니앱 전 결과면 배선.
- 공유: `getTossShareLink('intoss://{appName}/...', ogImageUrl)` + `share()`. OG는 **무인증 공개 라우트**(`/api/og/share/[token]` 기존재) 사용. 자사 웹 랜딩 제거.
- 뒤로가기/가시성: `useBackEvent`·visibility 이벤트(미니앱 UX 검수 항목).
- terms/privacy/refund **인앱 정적 뷰** + privacy에 Toss 처리위탁자·연결끊기 조항, refund/terms에 IAP 환불·REFUNDED 회수 조항(법무 검토 권장).
- 종료 게이트: 공유 딥링크 동작 + AI 라벨 노출 + 정책 문서 인앱 렌더.

### P7 — QA·검수·출시
- `pnpm build` → `<appName>.ait`(100MB 이하 확인, 폰트/이미지 CDN 분리) → 콘솔 업로드 → QR 토스앱 테스트.
- `checklist/app-nongame.md` 전 항목 + 외부링크 가이드 + IAP 3종 시나리오 + AI 고지 재점검.
- 종료 게이트: 검토 요청 제출 가능 상태 + 대표에게 검수 제출 인수인계(영업일 3일, 출시 즉시 전체 반영·카나리 없음 → 샌드박스/QR 테스트 강도 최대).

---

## §5. 미결정 게이트 — 추측 말고 사용자에게 올려라 (`CLAUDE.md §1.1`)

해당 Phase 진입 전 `AskUserQuestion`(한국어)으로 확정받는다. 임의 가정 금지.

1. **B1 크로스채널 계정 모델** (P3 전): 웹 유저(Supabase)와 미니앱 유저(toss `userKey`)가 별도 `user_id` → 웹 구매분이 미니앱에서 잠겨 보인다. (A) 분리계정 v1 수용+업그레이드 경로 / (B) email scope 받아 자동링크(D2·ADR-011 재검토) / (C) 명시적 연결 플로우. 권장 A. 채널톡: "user_key-only → 추후 email scope 링크 가능?"
2. **D5 TDS 깊이 + React 버전** (P0/P2): TDS는 `react@^18` 강제. (A) React 18 셸 + TDS 채택 / (B) React 19 유지 + TDS 미채택(자체 디자인). 채널톡 "TDS가 실제 검수 기준에 포함되는지/범위" 답변과 묶어 결정. §1.6 디자인 시스템과의 절충 사안.
3. **IAP sku 가격 vs 오픈초기 50% 할인** (P5): `feature-prices.ts`에 50% 할인(amount 500/400/300) 적용 중인데 IAP sku는 고정가 등록. (A) 할인가 sku로 이벤트 기간 등록 / (B) 미니앱은 정가, 할인은 웹 한정 / (C) 토스 프로모션/포인트로 할인 대체. 가격 변경은 ADR-039+`feature-prices.ts`+문서 동시갱신 의무(§12).
4. **부적(무료 토큰) + IAP 정책** (P5 전): 무료 데일리 부적이 "가상통화"로, sometimes-free/sometimes-IAP가 IAP-only 규정과 충돌 소지. 채널톡 확인 필수.
5. **비로그인/guest + 관측성** (P3): `getAnonymousKey` 미확인 → 채널톡 확인 또는 현행 guest(legal-consent 쿠키+`__guest__`)/Supabase anon으로 fallback. Sentry가 .ait 번들에서 동작하는지(미지원 시 Toss Analytics/커스텀 엔드포인트) 채널톡 확인.

---

## §6. 재사용 / 신규 / 제외

- **재사용(수정 최소)**: 만세력 엔진·점수식·파생/교차분석(ADR-040)·LLM 파이프라인·Supabase DB/RLS·31 API 라우트·`isFeatureUnlocked` 잠금 단일진실·`AiDisclosureBadge`/`Notice`·공개 OG 공유토큰 라우트.
- **신규**: `miniapp/` Vite 셸 + 8 플로우 화면 이식 / `toss-mtls-client.ts` / `/api/toss/login`·`/api/toss/disconnect` / Bearer 듀얼인증+CORS 레이어 / IAP 클라+서버 unlock / 인앱 정책 정적 뷰.
- **미니앱에서 제외**: Google OAuth·이메일 로그인/가입 · 토스페이먼츠 SDK·`feature-pay-sheet`·`/api/payments/feature/*` · 카카오/웹URL 랜딩 공유 · 자사 앱/웹 유도 · Next 미들웨어/서버컴포넌트 셸 · TWA/PWA/FCM 경로 · 세션 쿠키 인증(미니앱 경로). (전부 웹 버전은 유지.)

---

## §7. 대표(사용자) 선행·병행 작업 (개발 외 — 막히면 즉시 요청)

1. 콘솔 가입(만19세+ 워크스페이스) → 앱 등록 → **`appName` 확정**(영구). 로고/썸네일은 `public/apps-in-toss/` 재사용.
2. **사업자 등록**(필수 — 미등록 시 로그인·결제 불가) + 정산용 사업자 공동인증서 + 팝빌 가입(세금계산서 역발행).
3. mTLS 인증서 발급(콘솔) → cert/key PEM 전달.
4. IAP sku 3종 등록(§5-3 가격 확정 후, VAT 포함가).
5. 토스 로그인 약관 등록 + scope=`user_key` + 연결끊기 콜백 URL + (scope 받을 경우만)복호화 키 수령.
6. 앱 내 기능 ≥1개 등록(예: "오늘 케미 보기"→`/`).
7. **채널톡 문의(B8)**: ①운세 카테고리 사전승인(돈합 오인) ②TDS 검수 포함 여부/범위 ③부적/가상통화 정책 ④`getAnonymousKey` 존재 ⑤Sentry/에러리포팅 ⑥주문조회 SLA(30초) ⑦user_key→email scope 링크 ⑧iframe/임베드 범위.
8. 테스트 기기(Android 7+/iOS 16+ 실기기 권장).

---

## §8. 최종 검증 (= DONE 바, P7 충족 시 보고)

- [ ] `pnpm build` → `<appName>.ait` 생성, 압축해제 100MB 이하.
- [ ] 샌드박스 + 토스앱 QR에서 8 플로우 완결 동작.
- [ ] 토스 로그인 → Bearer 보호 API → 연결끊기 콜백 멱등.
- [ ] IAP 필수 시나리오 3종(결제·복원·환불) PASS, 30초 내 멱등 unlock.
- [ ] AI 고지+라벨, 공유 딥링크+공개 OG, 뒤로가기/가시성, 인앱 정책 뷰.
- [ ] `checklist/app-nongame.md` + 외부링크 가이드 전 항목 충족.
- [ ] 미니앱 경로에 토스페이먼츠/구글·이메일 로그인/외부 랜딩 **부재** 확인.
- [ ] PII/ZDR: LLM 페이로드에 PII 0건, scope=user_key 유지.
- [ ] tsc 0 · lint 0 · 신규/이식 코드 테스트 GREEN.
- [ ] §1.1 게이트(§5) 전부 사용자 확정 반영.
- [ ] 대표에게 검수 제출 인수인계 완료.

---

## §9. 산출 규약

TDD(테스트 먼저) · 원자 커밋(`type: desc`, 한 변경) · 무관 리팩터 금지(별도 보고) · `CLAUDE.md §8` 용어/§12 변경매트릭스/§13 메모 의무 · 검증 스킬(§10: 화면=`/qa`·`/design-review`, 결제=`/cso`+`/qa`, 라우트=`/qa`+`/codex`) · 마이그레이션은 라이브 적용 확인 후에만 main push(`feedback_migration_before_deploy`) · 컨텍스트 60%서 핸드오프 압축. **검증 없이 "완료" 보고 금지.**

```
=== GOAL PROMPT END ===
```

---

## 부록: 이 goal prompt가 리뷰 문서 대비 추가/정정한 점

1. **React 18 강제 + TDS** 를 P0 go/no-go 게이트의 결정 강제 사실로 승격(라이브 TDS 설치 명령 `react@^18` 핀 확인).
2. **사업자 등록 = 하드 선행조건** 명문화(비사업자는 로그인·수익화 불가 — 미충족 시 빌드 무의미).
3. **오픈초기 50% 할인 ↔ 고정가 IAP sku 충돌**을 신규 §1.1 게이트(§5-3)로 추가(리뷰 D6 이후 2026-06-14 코드 변경분).
4. iframe-YouTube 예외가 현재 공식 문서에 명시됨(리뷰 정정 표기 → 재정정).
5. MCP doc-id 시드 표로 실행 세션의 그라운딩 진입점을 고정.

---

## 실행 로그 (2026-06-14~15, Claude Code 자율 실행)

### ✅ P0 — 호환성 스파이크: GO
- `miniapp/` Vite 8 + React 19.2.4 + `@apps-in-toss/web-framework` 2.7.0 → `ait build` → `todaychemi.ait` 3.84MB 생성. 앱 heavy deps(recharts/vaul/@base-ui/tanstack/zustand/lucide) React 19 충돌 0.
- web-framework 2.7.0 peerDeps 비어 React 무관. TDS@2.4.1 = react ≤18 강제(R19 제외). Vite 8 핀 필수(plugin-react 6 peer). 결과: `miniapp/SPIKE_RESULT.md`.
- 미완: 샌드박스 기기 부팅(P7, 사용자 기기 필요).

### ✅ §5 결정 확정 (사용자, 2026-06-14)
- §5-2 = **React 19 + TDS 미채택** (스파이크 검증 경로). 셸은 React 18 다운그레이드 호환으로 작성(헤지).
- §5-1 = **분리 계정 v1 + 업그레이드 경로** (userKey only, ADR-011 정합).
- §5-3 = **할인가 IAP sku** (500/400/300, 웹·미니앱 통일, 이벤트 후 정가).

### ✅ 구현 레퍼런스(빌드 바이블)
- `docs/research/apps_in_toss_implementation_reference.md` (9-agent 워크플로). 빌드/로그인/mTLS/IAP/공유/검수정책 + 31라우트 통합맵 + 결정매트릭스 + NOT-FOUND 31건. **구현 시 동반 참조 필수.**

### ✅ D-INFRA 적대 검증 → 비블로커
- Vercel Node 함수 = env PEM client cert로 mTLS 가능. 정적 egress IP 불요(목적지 allowlist만, mTLS가 파트너 인증). 콜백=Basic Auth. → P3 구현 노트(Node 런타임, Edge 아님).

### ⚠️ TDS 잔여 리스크 (채널톡 우선)
- 공식 docs = TDS '권장'(design.md)/'선택'(webview.md). MCP instruction만 '필수' → 충돌. `@toss/tds-mobile`=React≤18.
- 디포지션: React 19 + no-TDS 진행(doc 근거). 채널톡 "TDS/Navigation 바 비게임 검수 필수?" 확인 + 셸 React 18 호환 유지(저비용 피벗 보존).

### ✅ P2 — 셸 파운데이션 (build GREEN)
- `miniapp/` 정식 셸: Providers(Query/next-intl ko/Storage-Auth) + HashRouter(react-router 7) + 8 라우트 stub + AppShell(backEvent, TDS-swappable AppNav) + tokens.css(globals.css 토큰 이식) + Bearer API client + pinch-zoom meta. `ait build`→`todaychemi.ait` 3.64MB, tsc 0. Tailwind=토큰 only.
- 미완(stub): appLogin 실배선 · API base URL · 8 플로우 UI · IAP.

### 다음 (우선순위)
1. **P1 사용자 외부작업 (임계경로 — 코드로 대체 불가)**: 사업자 등록(로그인·결제 선행 필수) → 콘솔 appName 확정 → mTLS 인증서 발급 → IAP sku 3종(공급가=VAT역산, 표시 500/400/300) → 토스로그인 scope=`user_key` + 연결끊기 콜백 URL → 앱 내 기능 ≥1 → **채널톡 6문의(TDS 필수여부 우선)**.
2. **P3 인증 브릿지** (코드, 자율 가능): `toss-mtls-client.ts` + `/api/toss/login` + `/api/toss/disconnect` + 31라우트 Bearer 듀얼 auth + CORS. cert 수령 후 통합 테스트.
3. **P4 8 플로우 이식** (워크플로 병렬 후보, §7.3 맵): 15~21일 추정. 셸 파운데이션 위에 구축.
4. P5 IAP · P6 정책(AI라벨/공유/정책뷰) · P7 QA/검수/출시.

### 산출물 위치
- 스파이크+셸: `miniapp/` (origin 미커밋, 로컬 isolated). 빌드 아티팩트(node_modules/dist/*.ait) gitignore.
- 빌드 바이블: `docs/research/apps_in_toss_implementation_reference.md`.
- 본 목표 프롬프트: `docs/research/apps_in_toss_launch_goal_prompt.md`.
