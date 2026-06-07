# 앱인토스(Apps in Toss) 연동 검토 보고서

- 작성일: 2026-06-07
- 대상: 오늘케미(오늘사이/TWODAY) → 앱인토스 미니앱 출시
- 근거 자료: 앱인토스 개발자센터 공식 문서(2026-06 기준 최신) + `toss/apps-in-toss-examples` 샘플 저장소 실코드 분석
- 크로스체크: 공식 문서 ↔ 샘플 코드 ↔ 오늘케미 현재 코드베이스(Next.js 16.2.6 / Supabase / 토스페이먼츠 SDK 2.7.0) 3자 대조 완료

---

## 0. 결론 요약 (두괄식)

**출시 가능하다. 단, "기존 웹을 그대로 올리는 것"이 아니라 "미니앱 전용 프론트엔드 채널을 하나 새로 만드는 것"이다.**

핵심 이유 3가지:

| # | 앱인토스 확정 정책 | 오늘케미 현재 상태 | 결론 |
|---|---|---|---|
| 1 | **로그인은 토스 로그인만 허용** (구글·이메일 등 일체 금지) | Supabase Auth (Google SSO + 이메일/비밀번호) | 미니앱에서는 기존 로그인 전부 제외, 토스 로그인 브릿지 신규 개발 |
| 2 | **디지털 상품 결제는 인앱결제(IAP)만 허용. 토스페이먼츠 명시적 금지** | ADR-039 pay-per-use가 토스페이먼츠 기반 (800/500/400원) | 결제 클라이언트 전면 교체 (서버 잠금 구조 `isFeatureUnlocked`는 재사용 가능) |
| 3 | **미니앱 = 정적 번들(.ait)을 콘솔에 업로드**, 토스가 자체 도메인에서 서빙. SSR 없음, iframe 금지 | Next.js App Router (서버 컴포넌트 + 31개 API 라우트, Vercel) | 화면(프론트)은 Vite 기반 SPA로 새로 빌드, 백엔드(Vercel API)는 그대로 재사용 |

좋은 소식: **백엔드 자산(만세력 엔진, 점수식, LLM 파이프라인, Supabase DB, 31개 API 라우트)은 거의 100% 재사용**된다. 새로 만드는 것은 "토스 안에서 도는 화면 껍데기 + 로그인/결제 연결부"다.

나쁜 소식: **수수료**. 인앱결제는 앱마켓 수수료 15%(향후 30% 가능) + 토스 수수료 5%(현재 CBT 프로모션 0%)가 붙는다. 합카드 800원 판매 시 실수령 약 **636~647원** (애플/구글 기준 상이). LLM 원가 대비 마진 재계산이 필요하다.

---

## 1. 앱인토스 플랫폼 구조 (조사 확정 사실)

### 1.1 두 가지 연동 방식
- **WebView SDK** (`@apps-in-toss/web-framework`): 기존 웹 기술(React SPA)로 개발. 오늘케미에 해당.
- **React Native SDK** (`@apps-in-toss/framework`): 네이티브 수준 성능 필요 시.
- 둘 다 `Granite` 공통 런타임 사용. `granite.config.ts`로 설정, `granite dev/build` 명령 사용.

### 1.2 배포 모델 (가장 중요한 구조적 사실)
- `granite build` → 웹 빌드 결과물(dist)을 **`.ait` 번들 파일**로 패키징 → **앱인토스 콘솔에 업로드**.
- 토스가 자기 도메인에서 서빙: 실서비스 `https://{appName}.apps.tossmini.com`, QR 테스트 `https://{appName}.private-apps.tossmini.com`.
- **우리 서버(Vercel)에서 화면을 서빙하는 게 아니다.** SSR/서버컴포넌트 불가. 번들 압축해제 기준 100MB 이하.
- API 호출은 미니앱 → Vercel로 cross-origin 요청 → **CORS 허용 목록에 위 두 도메인 등록 필수**.
- 검수: 영업일 최대 3일. 출시 즉시 전체 사용자 반영. 콘솔에서 버전 관리·롤백 가능.
- 테스트: 샌드박스 앱(시뮬레이터/실기기) + 토스앱 QR 테스트. **검수 요청은 테스트 1회 이상 완료해야 활성화.**
- iframe 사용 금지. 위반 시 보안 심사 반려. (※ [2026-06-08 정정] 종전 "유튜브 임베드만 예외"는 공식 문서 미확인 — `webview.md`는 iframe 제한만 명시하고 YouTube 예외를 언급하지 않음. 임베드 필요 시 채널톡 확인 필수.)

### 1.3 SDK 버전 정책
- **SDK 2.x 이상 의무** (**2025-03-23** 이후 1.x 번들 업로드 불가 — 공식 release-note 확인. 종전 본문 "2026-03-23"은 1년 오기 정정 [2026-06-08]). npm `@apps-in-toss/web-framework` 최신 안정 = **2.6.x** (**3.x 계열 미존재** — 종전 "3.x 마이그레이션 가이드 선공개" 기술은 release-note 미확인으로 오류 정정) → **2.6.x 핀** 채택.
- **React 버전**: web-framework 2.6.1은 React peerDependency를 강제하지 않음 → 오늘케미 React 19.2.4 사용 가능할 것으로 판단되나, **샌드박스 부팅(P2 단계)에서 실증 필수**.
- ⚠️ 샘플 저장소(`apps-in-toss-examples`)는 SDK 1.5.2 + React 18 고정 — **구조 참고만 하고 버전은 따르지 말 것**. 같은 맥락으로 `with-in-app-purchase` README의 "샌드박스 IAP 테스트 불가" 문구는 stale — 최신 공식 문서(sandbox.md 기능 표 + iap/develop.md)는 **일회성 IAP 샌드박스 테스트 지원(과금 없음)**을 명시. 최신 문서 우선.

### 1.4 서버 API (파트너 서버 ↔ 앱인토스 서버)
- 토스 로그인 토큰 교환, IAP 주문 상태 조회, 스마트 발송 등은 **mTLS(양방향 TLS) 필수**.
- 인증서는 콘솔에서 발급(다중 인증서로 무중단 교체 지원). 샘플 서버는 Node `https.request`에 cert/key 넣는 단순 패턴 → **Vercel 함수에서 환경변수(base64 PEM)로 cert/key 보관해 구현**. ⚠️ [2026-06-08 정정] 현재 `toss-server.ts`는 **HTTP Basic auth**(Toss Payments)라 mTLS와 메커니즘이 다름 — "패턴 대체"가 아니라 **신규 모듈**(`toss-mtls-client.ts`, 인증서 회전 절차 포함)이 맞다.
- 공통 응답 `resultType: SUCCESS|FAIL`. 요청 제한 분당 3,000 QPM.

---

## 2. 정책 검토 (서비스 적합성)

### 2.1 운세 서비스 = 제한 카테고리 아님 ✅
제한 목록(가상자산, 자금세탁, 사행성, 금융중개, 투자자문, 의료, 불법조장)에 **운세/사주는 없음**. 단, "내부 정책상 승인 불가" 재량 조항이 있으므로 사전 채널톡 상담 권장.

### 2.2 데이팅/만남 카테고리 아님 ✅ (중요)
앱인토스의 만남·소개팅 강화 규제(만 19세 인증, 법인 필수, 신고 시스템 등)는 "**이용자 간 매칭·채팅**" 서비스에 적용된다. 오늘케미는 이용자끼리 연결하지 않고(인연은 내가 입력하는 비공개 데이터, ADR-002 자유채팅 없음) 해당하지 않는다. **콘솔 카테고리 등록 시 '소셜/만남' 계열을 선택하지 않도록 주의** — 라이프스타일/운세 계열로 등록.

### 2.3 생성형 AI 의무 ⚠️ (법적 의무, 추가 개발 필요)
AI 산출물을 노출하는 미니앱은:
1. **사전 고지**: 최초 이용 시점에 생성형 AI 활용 사실 고지
2. **표시 의무**: AI 생성 결과물에 라벨/배지/워터마크 표시
- 위반 시 과태료 최대 3,000만 원. → 합카드·오늘카드·만약합 화면에 "AI 생성" 라벨 + 온보딩/웰컴에 고지 문구 추가 개발 필요.

### 2.4 외부 링크/자사 유도 금지 ⚠️
- 자사 앱·웹 설치/이동 유도 전면 금지. **공유 링크가 자사 웹사이트로 랜딩되는 것도 금지.**
- → 현재 S-07a 공유(웹 URL 랜딩)와 카카오 공유 흐름은 미니앱에서 사용 불가. `getTossShareLink('intoss://{appName}/...', ogImageUrl)` + `share()` SDK로 대체. 딥링크는 토스앱 설치자에게는 미니앱으로, 미설치자는 스토어로 연결됨.
- '앱 내 기능'으로 등록한 흐름은 미니앱 안에서 완결되어야 함(결제 포함).

### 2.5 미니앱 어뷰징 방지
동일 워크스페이스에서 유사 기능 앱 중복 출시 금지. (향후 운세 시리즈 앱을 쪼개 출시하는 전략은 불가 — 기존 앱 업데이트로 대응해야 함.)

### 2.6 TDS(토스 디자인 시스템) — **선택** (§1.6과 절충 여지) [2026-06-08 정정]
> ⚠️ **정정**: 종전 본문은 "모든 비게임 WebView 미니앱 TDS 필수, 검수 기준 포함"을 "WebView 튜토리얼 원문"으로 인용했으나 **오인용**이다. 공식 `webview.md`는 TDS를 **선택**으로 기술한다("TDS 사용 여부를 선택해요"). `deploy.md`/`guide.md` 어디에도 TDS 강제·검수 기준 포함 문구는 없다.

- `@toss/tds-mobile`는 **권장**(일관 UX)이나 **의무 아님**. 따라서 §1.6 디자인 시스템("Toss × iOS 26 × M3")과의 충돌은 원칙적으로 소멸 — 자체 디자인 시스템 유지 가능.
- TDS를 일부 채택할 경우(셸/내비게이션 등) 그 범위만 §1.1 사안. 검수 기준에 TDS가 실제로 포함되는지는 **채널톡 확인 권장**(필수 아님).
- 참고: TDS 컴포넌트는 로컬 브라우저에서 렌더되지 않음 → 채택 시 샌드박스 앱에서만 검증 가능.

---

## 3. 기능별 연동 설계 검토

### 3.1 로그인 (전면 교체)
**플로우** (공식 문서 + `with-app-login` 샘플 실코드로 확인):
1. 클라이언트: `appLogin()` → `authorizationCode`(유효 10분) + `referrer`
2. 우리 서버: mTLS로 `POST /generate-token` → accessToken(1h)/refreshToken(14d)
3. 우리 서버: `GET /login-me` → **`userKey`**(토스 고유 식별자) + 동의 scope별 암호화 PII
4. 우리 서버: `userKey` ↔ Supabase 유저 매핑(최초면 생성) → 자체 세션 발급
- 사용자가 토스에서 연결 끊기/탈퇴 시 **콜백 URL로 통지** → 탈퇴 처리 연동 필요 (me/delete-request 흐름 재사용).
- PII: name/phone/birthday/ci/gender 등은 **콘솔에서 scope 선택 + 사용자 동의** 시에만 내려오고 AES-256-GCM 암호화(복호화 키는 콘솔 통해 이메일 수령).
  - **PII 최소화(ADR-011·§5) 관점 권고: `user_key`만 사용하고 PII scope는 받지 않는 것이 기본.** birthday/gender를 받으면 온보딩 프리필이 되지만 복호화 키 관리 + 개인정보 처리 범위 확대가 따라옴 → §1.1 결정 사안.
- 비로그인 구간: lazy-login 구조(결제·기록 시점에 토스 로그인 요구) 가능. ⚠️ [2026-06-08 정정] 종전 본문의 `getAnonymousKey`는 **공식 문서·샘플 저장소에서 미확인** — 존재·시그니처를 채널톡으로 확인하거나, **fallback으로 현행 guest/today(legal-consent 쿠키 + `__guest__` 센티넬) 또는 Supabase anonymous-session** 사용. 현행 guest 흐름과의 매핑은 P2~P3에서 실증.

### 3.2 결제 (전면 교체, 서버 잠금 구조는 재사용)
**확정 정책**: 디지털 상품(합카드·만약합·다시합)은 **인앱결제(IAP)만**. 토스페이는 실물 전용. 토스페이먼츠 금지.

**IAP 플로우** (문서 + `with-in-app-purchase` 샘플로 확인):
1. 콘솔에 상품(sku) 등록: 합카드 800 / 만약합 500 / 다시합 400 — 3종 (판매가 = 공급가 + VAT 구조 확인 필요)
2. `IAP.getProductItemList()` → 상품 노출
3. `IAP.createOneTimePurchaseOrder({ options: { sku, processProductGrant }, onEvent, onError })`
   - `processProductGrant({ orderId })` 콜백 안에서 **우리 서버 unlock API 호출** → 서버가 mTLS `POST /order/get-order-status`로 `PURCHASED|PAYMENT_COMPLETED` 검증 후 `isFeatureUnlocked` 잠금 해제 → `true` 반환
   - **30초 내 true를 반환하지 못하면 사용자에게 "환불 신청" 페이지가 뜸** → unlock API는 빠르고 멱등해야 함
4. 복원: 앱 재진입 시 `getPendingOrders()` → 미지급 주문 재지급 → `completeProductGrant({ orderId })` (검수 필수 테스트 시나리오)
5. 환불: **Apple/Google 정책 준수**. `REFUNDED` 주문 감지(주문 조회 API/SDK) 시 잠금 회수 정책 필요.

**ADR-039와의 호환성**: 모델 C(선생성 → 성공 시 결제)는 IAP 구조와 잘 맞는다. `resolveFeatureCharge`의 `pay_required` 분기에서 402 대신 IAP 시트를 띄우고, confirm 라우트 역할을 "orderId 검증 + unlock"으로 교체하면 된다. 잠금 단일진실(`isFeatureUnlocked`)·read-path 게이트는 그대로 유지.

**수수료/정산** (공식 정산 문서):
- 앱마켓 수수료 15% (총수익 증가 시 30% 가능성 명시) + 토스 수수료 5% (CBT 한시 0%)
- 800원 결제 예시(문서의 11,000원 예시 비율 적용): 애플 약 636원 / 구글 약 647원 실수령
- 정산: 익월 말 지급. **사업자 공동인증서 + 팝빌 가입 필요**(세금계산서 역발행 승인 의무 — 미승인 2회 시 운영 중단 가능).
- 구글 기프트카드 결제 현금영수증은 2025-12-01부터 토스가 대행 발행.

### 3.3 공유 (교체)
- `getTossShareLink('intoss://{appName}/hapcard/{id}', ogImageUrl)` → `share({ message })`.
- OG 이미지는 **https 절대경로 공개 URL** 필요. `/api/og/hapcard/[id]`는 인증 401(크롤러 차단)이지만 **공유 토큰 기반 공개 OG 라우트 `/api/og/share/[token]`는 이미 존재·무인증**([2026-06-08 확인]) → 미니앱 공유는 이 share-token 라우트를 사용(선행 과제 아님, 신규 개발 불요).
- `intoss://` 스킴은 정식 출시 후에만 동작. 출시 전엔 `intoss-private://...?_deploymentId=` QR 테스트.

### 3.4 Supabase (재사용 가능, 설정 추가)
공식 "Supabase 연동하기" 가이드 존재 — WebView 미니앱에서 supabase-js 직접 사용 패턴 공식 지원. 단:
- Auth의 소셜 로그인은 정책상 사용 불가 → DB/RLS는 서버 경유(현 구조 유지)가 안전. 미니앱에서 supabase-js 직결은 선택사항.
- Supabase Origin 허용 목록에 `apps.tossmini.com`/`private-apps.tossmini.com` 추가.

### 3.5 마케팅/성장 도구 (신규 기회, 선택)
- **스마트 발송**(기능성 푸시·알림, mTLS API), **세그먼트**, **프로모션(토스 포인트 지급)**, **공유 리워드(contactsViral)**, **토스애즈 픽셀**, 분석 SDK(`Analytics`), 리뷰 요청(`requestReview`).
- 오늘카드(일일 운세) 리텐션 푸시에 스마트 발송이 직접적으로 유용 → Phase 2 후보.

---

## 4. 대표가 직접 확인/준비해야 할 것 (개발 외)

| # | 항목 | 내용 | 비고 |
|---|---|---|---|
| 1 | 콘솔 가입·워크스페이스·앱 등록 | https://apps-in-toss.toss.im — `appName` 확정(딥링크·도메인에 영구 사용), 로고, 사용 연령, 고객센터 이메일/연락처 | appName은 사실상 변경 불가로 취급 |
| 2 | 사업자 등록·계약 | 개인/법인 서류 제출. **사업자 없이도 출시 가능**(문서 명시)하나 유료 결제·정산엔 사업자 필요 | 현 개인 상태 확인 필요 |
| 3 | 세금계산서 준비 | 사업자 공동인증서(연 4,400원) + 팝빌 가입 | 정산 받으려면 필수 |
| 4 | IAP 상품 3종 등록 | 800/500/400원, 상품명·아이콘·설명. VAT 포함가 기준 확인 | 콘솔에서 등록 |
| 5 | 토스 로그인 콘솔 설정 | 약관 등록, scope 선택(최소화 권고), 연결끊기 콜백 URL, 복호화 키 수령 | §1.1 결정 후 |
| 6 | mTLS 인증서 발급 | 콘솔에서 발급 → Vercel 환경변수 보관 | 개발 착수 전 |
| 7 | 검수 기준 사전 문의 (채널톡) | ① 운세 카테고리 사전 승인 여부 ② TDS 의무 범위(셸만 vs 전체 UI) ③ 기존 웹서비스 병행 운영 시 유의점 | 가장 먼저 권장 |
| 8 | 단가·마진 재검토 | 800원 → 실수령 ~636원. LLM 원가(GPT-5) 대비 마진 + 가격 인상 여부 | 가격 변경은 §1.1 |
| 9 | AI 고지 문구 | 생성형 AI 사전 고지 + 라벨 문구 확정 (법령 준수) | 법무 검토 권장 |
| 10 | 테스트 기기 | 샌드박스 앱 설치(iOS/Android 실기기 권장). 지원 OS: **Android 7+ / iOS 16+** | TDS는 샌드박스에서만 확인 가능. 분석·공유리워드·인앱광고는 샌드박스 미지원 → QR 토스앱 테스트 |
| 11 | **앱 내 기능 등록 (최소 1개, 비게임 필수)** | 콘솔 '앱 출시'에서 기능명 + `intoss://{appName}/경로` 등록. 기능명은 토스 UX 라이팅('~하기'/명사형, 서비스 기능이 드러나게). 검토 1~2영업일, 출시 후 정상 접속 확인 의무 | 예: "오늘 케미 보기"→`/`, "케미카드 보기"→`/feed` — 미니앱 SPA 라우트와 매핑 필요 |
| 12 | **돈합 모드 카피 검토** | 제한 서비스 '금융상품 중개·투자자문·리딩방'으로 오인되지 않도록 돈합·(Phase 2) 딥합 재물/이직 카피에서 투자 추천·수익 보장성 표현 제거/점검 | 검수 반려 예방. ADR-009(단정 표현 필터)와 연계 |

---

## 5. 추가 개발 항목 (우선순위)

### P0 — 미니앱이 돌아가기 위한 최소 (필수)
1. **미니앱 셸 신규 구축**: Vite(또는 rsbuild) + React SPA + `@apps-in-toss/web-framework` + `granite.config.ts` + TDS 패키지. 모노레포 내 `miniapp/` 워크스페이스 권장. 기존 컴포넌트는 Next 의존(라우터·Image·서버컴포넌트) 제거 후 이식.
2. **토스 로그인 브릿지**: `appLogin` 클라이언트 + 서버 mTLS 토큰 교환 + `userKey`↔Supabase 유저 매핑 + 자체 세션(Bearer) 발급 + 연결끊기 콜백 핸들러.
3. **API 인증·CORS 전환**: 31개 라우트에 tossmini 도메인 CORS 허용 + 쿠키 세션 대신 Bearer 토큰 인증 경로 추가 (기존 웹은 쿠키 유지, 듀얼 인증).
4. **1차 화면 범위 이식**: 온보딩 → 인연 등록 → 합카드 → 오늘카드 (4 핵심 플로우 우선, 합피드/본명식/만약합은 2차).

### P1 — 출시 검수 통과 요건
5. **IAP 결제 통합**: sku 3종 + `createOneTimePurchaseOrder`/`processProductGrant` + 서버 unlock(주문 상태 mTLS 검증, 멱등) + `getPendingOrders` 복원 + REFUNDED 회수 정책. (샌드박스 필수 시나리오 3종 테스트 포함)
6. **생성형 AI 고지/라벨**: 최초 사용 고지 + 합카드·오늘카드·만약합 결과에 AI 라벨.
7. **TDS 적용**: 내비게이션 바, 브릿지, (검수 기준 확인 결과에 따라) 버튼·리스트 등.
8. **공유 교체**: `getTossShareLink` + 공개 OG 라우트(공유 토큰).
9. **뒤로가기/가시성 처리**: `useBackEvent`, visibility 이벤트 (미니앱 UX 검수 항목).

### P2 — 출시 후 성장
10. 스마트 발송(오늘카드 리텐션 푸시), 세그먼트, 프로모션(토스 포인트), 공유 리워드, Analytics SDK, Sentry, 토스애즈 픽셀.

### 규모 감각 (PO용)
- 백엔드: 신규 약 3~4개 모듈(토스 로그인 교환, IAP 검증 unlock, 연결끊기 콜백, mTLS 클라이언트) **+ auth 레이어 리팩터**(31 라우트 user-resolution을 Bearer 듀얼화 + CORS). ⚠️ [2026-06-08] "기존 로직 변경 거의 없음"은 낙관 — 인증 레이어는 비자명한 변경이다(§13 B3 참조).
- 프론트: 신규 SPA 셸 + 화면 이식 — **이번 작업의 80%가 여기**. 1차 4개 플로우 기준으로 범위를 좁히는 것을 권장.

---

## 6. 제외/비활성화 항목 (미니앱 빌드에서)

| 항목 | 사유 | 처리 |
|---|---|---|
| Google OAuth + 이메일/비밀번호 로그인·가입 페이지 | 토스 로그인만 허용 | 미니앱에 미포함 (웹 버전은 유지) |
| 토스페이먼츠 SDK·`feature-pay-sheet`·`/api/payments/feature/init·confirm` | 디지털 상품은 IAP만, 토스페이먼츠 금지 | 미니앱 경로에서 IAP로 대체. 웹 버전 유지 여부는 별도 결정 |
| 카카오 공유 콜백·웹 URL 랜딩 공유 | 자사 웹 랜딩 금지 | `getTossShareLink`로 대체 |
| 자사 웹/앱 유도 요소 (링크·배너·문구 일체) | 외부 링크 정책 | 미니앱에서 제거 |
| Next.js 미들웨어·서버 컴포넌트 기반 화면 셸 | 정적 번들 구조 | SPA 라우팅으로 대체 |
| 자체 하단 TabBar(검수 기준에 따라) | TDS Tabbar/내비게이션 바 사용 | 검수 기준 확인 후 결정 |
| iframe(있다면) | 전면 금지 | 해당 없음 확인됨 |
| TWA/Bubblewrap·PWA·FCM 런칭 경로 (`docs/patterns/twa_bubblewrap.md`) | 앱인토스는 .ait 번들 별도 패키징 경로 | 미니앱 빌드에 미적용 (Play 스토어 TWA 채널은 별개로 유지 — 단, 미니앱 내에서 자사 앱 설치 유도 금지) |
| 세션 쿠키 인증 (미니앱 경로) | iOS WebView 서드파티 쿠키 제한 + cross-origin | Bearer 세션 토큰 + 앱인토스 네이티브 Storage(`Storage` SDK) 보관으로 대체 |

---

## 7. §1.1 의사결정 필요 항목 (개발 착수 전 확정 요청)

1. **D1. 미니앱 프론트 아키텍처**: (A) 모노레포 내 별도 Vite SPA 신규 + 컴포넌트 이식 ← 권장(샘플과 동일 구조, 리스크 최소) / (B) Next.js static export를 granite로 감싸기(미들웨어·서버컴포넌트 제거 필요, 비권장).
2. **D2. 토스 로그인 scope**: (A) `user_key`만(PII 무수집, ADR-011 정합) ← 권장 / (B) birthday·gender 수신해 온보딩 프리필(복호화 키 관리 + 개인정보 범위 확대).
3. **D3. 결제 이원화**: 미니앱=IAP 확정. 기존 웹(Vercel)의 토스페이먼츠 pay-per-use를 (A) 병행 유지 / (B) 미니앱 단일 채널로 정리.
4. **D4. 1차 출시 화면 범위**: 4 플로우(온보딩/인연등록/합카드/오늘카드) vs 전체 8 플로우.
5. **D5. TDS 적용 깊이**: 검수 기준 채널톡 확인 후, 셸만 TDS vs 콘텐츠 영역까지 TDS 혼용 범위. (§1.6 디자인 시스템과의 절충)
6. **D6. 가격**: 수수료 ~20% 반영해 800/500/400 유지 또는 인상 (가격 변경은 ADR-039 + `feature-prices.ts` 동시 갱신 의무).

---

## 8. 리스크 및 유의사항

- **수수료 인상 리스크**: 앱마켓 수수료 "총수익 늘면 30% 변경 가능" 명문화 — 마진 시뮬레이션에 30% 시나리오 포함할 것.
- **검수 재량 조항**: "내부 정책상 승인 불가" 가능성 — 운세 카테고리 사전 상담으로 리스크 제거 권장.
- **30초 지급 제한**: 합카드 LLM 생성(14~26s 측정치)을 결제 후 동기 생성하면 30초 한도와 충돌 위험 → **모델 C(선생성 후 결제) 유지가 정답**. 선생성 실패 시 결제 자체를 막는 현 구조가 유리.
- **출시 즉시 전체 반영**: 카나리 배포 없음(콘솔 롤백만 존재) → 검수 전 샌드박스+QR 테스트 강도 높여야 함.
- **CORS/세션**: 테스트 환경과 라이브 환경의 CORS·세션 동작 차이가 공식 문서에 경고되어 있음 — 라이브 직후 로그인/결제 재검증 필수.
- **번들 용량**: 이미지·폰트(Noto Sans KR 등)는 번들 제외하고 CDN 로드 권장 (100MB 한도 + 초기 로딩).
- **돈합 카피 오인 리스크**: 제한 서비스 목록의 '투자자문·금융상품 추천'으로 해석될 표현이 돈합/딥합(재물·이직)에 있으면 반려 가능 → 출시 전 카피 점검 (§4 #12).
- **샌드박스 ≠ 라이브**: 샌드박스는 http 허용·일부 기능 미지원(분석/공유리워드/인앱광고) — 라이브는 https만. 환경 차이로 인한 회귀는 QR 토스앱 테스트로 보완.

---

## 9. 결정 확정 (§1.1, 2026-06-07 사용자 확정)

| ID | 결정 | 내용 |
|---|---|---|
| D1 | 미니앱 프론트 아키텍처 | **(A) 모노레포 내 별도 Vite SPA 신규 + 컴포넌트 이식** (샘플과 동일 구조) |
| D2 | 토스 로그인 scope | **(A) `user_key`만** — PII 무수집, ADR-011 정합. 복호화 키 불필요 |
| D3 | 결제 이원화 | **미니앱=IAP, 기존 웹 토스페이먼츠 pay-per-use (A) 병행 유지** |
| D4 | 1차 출시 화면 범위 | **전체 8 플로우** (온보딩/인연등록/합피드/합카드/오늘홈/본명식/만약합/다시합·공유 포함) |
| D5 | TDS 적용 깊이 | **채널톡으로 검수 기준 확인 후 범위 결정** ([2026-06-08 정정] TDS는 공식상 **선택** — §2.6 참조. "셸 TDS 확정" 전제는 재확인 대상) |
| D6 | 가격 | **1,000 / 800 / 600원 티어로 변경 — 웹+미니앱 통일 적용** (합카드/만약합/다시합) |

D6 후속 의무(§12 변경 매트릭스): `feature-prices.ts`(단일출처) 800/500/400 → 1000/800/600 + **ADR-039 개정** + `payments.md`·`fluttering-gathering-island.md`·`PRD.md` 동시 갱신 + 관련 테스트 갱신. 부분 갱신 후 PR 금지.

---

## 10. 실행 로드맵 (제안)

| Phase | 내용 | 주체 | 비고 |
|---|---|---|---|
| **P0. 가격 통일 (웹 선행)** | feature-prices.ts 1000/800/600 + ADR-039 개정 + 문서 3종 동시 갱신 + 테스트 | 개발 세션 | 미니앱과 무관하게 즉시 가능. §12 의무 |
| **P1. 콘솔·계약 준비** | 콘솔 가입→워크스페이스→앱 등록(appName 확정), 사업자 서류, 팝빌, mTLS 인증서 발급, IAP 상품 3종 등록(1,000/800/600), 토스 로그인 약관 + scope=user_key, 연결끊기 콜백 URL, **채널톡 문의 2건(운세 카테고리 사전 확인 + TDS 범위)** | **대표** | 개발 착수의 선행 조건 (특히 appName·mTLS·sku) |
| **P2. 미니앱 셸** | pnpm workspace `miniapp/` + Vite + `@apps-in-toss/web-framework` + TDS + granite.config.ts + 샌드박스 부팅 확인 | 개발 세션 | weekly-todo-react 샘플 구조 준용 |
| **P3. 인증 브릿지** | `appLogin` → 서버 mTLS 토큰 교환 → user_key↔Supabase 매핑 → Bearer 세션(웹 쿠키와 듀얼) + CORS(tossmini 2도메인) + 연결끊기 콜백 핸들러 | 개발 세션 | 신규 서버 모듈 |
| **P4. 화면 8 플로우 이식** | D4 전체 범위, TDS 혼용(D5 채널톡 결과 반영) | 개발 세션 | 작업량 최대 구간 |
| **P5. IAP 결제** | sku 3종 + createOneTimePurchaseOrder/processProductGrant + 서버 unlock(mTLS 주문검증, 멱등, 30초 내) + getPendingOrders 복원 + REFUNDED 회수 | 개발 세션 | ADR-039 모델 C 유지 |
| **P6. 정책 요건** | 생성형 AI 사전 고지 + 결과물 AI 라벨(웹 동시 적용 권장), 공유 intoss:// 딥링크 + 공개 OG(공유 토큰), 뒤로가기/가시성 처리 | 개발 세션 | AI 라벨은 법적 의무 |
| **P7. QA·검수·출시** | 샌드박스 IAP 필수 시나리오 3종 + QR 토스앱 테스트 + 검토 요청(영업일 3일) → 출시 | 대표+개발 | 검수 요청은 테스트 1회 이상 완료 필요 |

---

## 11. 외부 검토안 크로스체크 결과 (2026-06-07 추가)

별도 검토안(사용자 제공)과 본 보고서를 대조·공식 문서 재검증한 결과. 구조 권고(D1~D3 상당)는 양쪽 일치.

**본 보고서가 놓쳤던 것 (외부 검토가 맞음 — 본 문서에 반영 완료)**
1. **앱 내 기능 최소 1개 등록 (비게임 필수)** — 검토 1~2영업일, `intoss://` 라우트 매핑, 출시 후 접속 확인 의무 → §4 #11 (공식 function.md로 검증 ✅)
2. **돈합 카피 = 투자자문 오인 리스크** → §4 #12, §8 (제한 서비스 목록과 연결)
3. 세부 운영 디테일: 세션 토큰의 네이티브 Storage 보관, iOS 쿠키 제한 명시, 인증서 만료/교체 담당, 샌드박스 OS 하한(Android 7/iOS 16) → §6·§4 #10 반영

**외부 검토안의 오류·수정 필요 (본 보고서/공식 문서가 맞음)**
1. **가격 stale**: 800/500/400 기준으로 작성됨 → §1.1 D6으로 **1,000/800/600 + 부적 10/8/6 확정·코드/문서 적용 완료** (2026-06-07)
2. **"SDK 2.x가 React 19 지원" 단정** → npm 실측: web-framework 2.6.1은 React peerDep 자체가 없음. "지원 명시"가 아니라 "강제 없음" — 샌드박스 실증 필요로 표현 정정 (§1.3)
3. **"만 19세 이상 워크스페이스 멤버 필요" 단정** → 샌드박스 문서에 연령 요건 없음. 콘솔에는 별도 '미성년자 콘솔 참여방법' 문서가 존재(미성년자도 절차상 가능) — 사실 확인 필요 항목으로 강등
4. **출처 표기 오류 다수**: 'IAP만 허용'·'생성형 AI 고지' 등 정책 주장의 근거가 GitHub package.json으로 잘못 링크됨 — 내용 자체는 공식 `intro/guide.md`로 본 보고서에서 검증 완료
5. "Kakao 로그인 제외" — 카카오 로그인은 S-00(2026-05)에서 이미 Google로 대체되어 현재 코드에 없음. 제외 대상은 카카오 *공유 콜백*뿐 (사실관계 정정)

**외부 검토안이 다루지 않은 것 (본 보고서 유지 항목)**
수수료·정산 구조(15%+5%, 팝빌 역발행 미승인 2회 시 운영 중단), 검수 3영업일·출시 즉시 전체 반영·롤백 체계, 번들 100MB, 운세 카테고리 사전 상담·데이팅 미해당 판단·유사 앱 중복 출시 금지, 연결끊기 콜백 처리, `processProductGrant` 30초 제한 ↔ 모델 C 적합성, REFUNDED 잠금 회수, 공개 OG 라우트 선행 과제, 성장 도구(스마트 발송/세그먼트/프로모션), AI 라벨 과태료 3,000만 원.

**합의 확인된 사항 (양쪽 일치 + 문서 검증)**
WebView SDK + Vercel API 유지 / 토스 로그인·IAP 전환 / userKey-only scope / Next 화면 .ait 직행 불가 / CORS 2도메인 / mTLS 서버 처리 / IAP 4종 SDK 함수 흐름 / 공유 getTossShareLink 전환 / TWA·PWA·FCM 경로 미니앱 미적용 / 샘플 README "샌드박스 IAP 불가"는 stale — 최신 문서(샌드박스 IAP ✅ 과금 없음)가 우선.

---

## 12. 출처 (전부 2025년 이후 자료)

- 앱인토스 개발자센터 시작하기: https://developers-apps-in-toss.toss.im/bedrock/intro.html
- 서비스 오픈 정책(로그인/결제/광고 제한, AI 고지, 외부링크): https://developers-apps-in-toss.toss.im/intro/guide.md
- WebView 시작하기(SDK 2.x 의무, TDS 선택, granite.config): https://developers-apps-in-toss.toss.im/tutorials/webview.md
- 미니앱 출시(검수 3일, .ait, tossmini.com 도메인/CORS): https://developers-apps-in-toss.toss.im/development/deploy.md
- 토스 로그인 개발: https://developers-apps-in-toss.toss.im/login/develop.md
- 인앱 결제 SDK·주문 상태 API: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/인앱 결제/IAP.md
- 인앱 결제 개발(샌드박스 필수 시나리오): https://developers-apps-in-toss.toss.im/iap/develop.md
- 정산(수수료 15%+5%, 팝빌): https://developers-apps-in-toss.toss.im/settlement/intro.md
- API 사용하기(mTLS, 방화벽, QPM): https://developers-apps-in-toss.toss.im/development/integration-process.md
- 토스페이 개발(실물 전용 비교 확인): https://developers-apps-in-toss.toss.im/tosspay/develop.md
- 공유 링크: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/공유/getTossShareLink.md
- Supabase 연동: https://developers-apps-in-toss.toss.im/supabase/intro.md
- 만남·소개팅 주의사항(미해당 확인): https://developers-apps-in-toss.toss.im/intro/_caution-social.md
- 샘플 저장소(with-app-login 서버 mTLS 패턴, with-in-app-purchase, weekly-todo-react granite 설정): https://github.com/toss/apps-in-toss-examples

---

## 13. 코드베이스·공식문서 재검증 보강 (2026-06-08, 12-agent 워크플로)

본 절은 §1~§12를 공식 앱인토스 문서(57 클레임) + 실제 코드베이스에 재대조하고 4-lens 적대적 검토로 도출한 **문서가 놓친 공백**이다. 위 §1~§10 인라인 정정([2026-06-08] 표기)과 함께 적용한다.

### B1. 크로스채널 계정 모델 (CRITICAL — 미해결 제품 결정)
- 웹 유저 = Supabase Google/email `user_id`. 미니앱 유저 = Toss `userKey`로 신규 생성되는 별도 `user_id`(§3.1-4 "최초면 생성"). `isFeatureUnlocked`는 `user_id` 기준 → **웹에서 결제·잠금해제한 합카드가 미니앱에서는 잠긴 상태로 보인다(동일인, 다른 계정).**
- D2(`user_key`만, 이메일 scope 무수집)는 자동 계정 링크를 불가능하게 만든다.
- 옵션: (A) **분리 계정 v1 수용** + 문서화된 업그레이드 경로 (D2 정합·최단 출시) / (B) Toss email scope 수신해 기존 Supabase 계정 자동 링크 (구매 이전성 확보, D2 완화 + ADR-011 재검토) / (C) 명시적 계정 연결 플로우.
- **결정 게이트: P3 진입 전 §1.1 확정.** 권장 = (A). 채널톡 질문: "user_key-only 로그인이 추후 email scope를 받아 기존 계정과 링크 가능한가?"

### B2. 마진 워터폴 (2026-06-08 실측 — §8 보강, 종전 추정치 정정)

**기능별 LLM 원가** (tech_stack.md §3.3 실측 월비용 ÷ 호출량, ₩1,300/USD):

| 기능 | 모델·토큰 | 월비용 / 호출량 | 건당 ≈ |
|---|---|---|---|
| 케미카드 | GPT-5, in 3,500+out 800 | $50–80 / 5,000 | **₩13–21** |
| 만약에 우리 | GPT-5, in 2,500+out 600 | $10–15 / 1,000 | **₩13–20** |
| 다시 맞추기 | 카드 재생성 ≈ 케미카드급 | (별도 추정) | **~₩15–21** |

→ LLM 원가 = 판매가의 **~2%**. (종전 검토의 "건당 수천원" 추정은 ~1000× 오류로 폐기.)

**순수령** (수수료 차감. 공식 예시 800원→636/647 = net ~80% 비율 채택):

| 기능 | 판매가 | 미니앱 A 표준(15+5%≈80%) | 미니앱 B CBT(15+0%≈85%) | 미니앱 C worst(30+5%≈66.5%) | 웹 PG(~3%≈97%) |
|---|---|---|---|---|---|
| 케미카드 | 1,000 | ~800 | ~850 | ~665 | ~970 |
| 만약에 우리 | 800 | ~640 | ~680 | ~532 | ~776 |
| 다시 맞추기 | 600 | ~480 | ~510 | ~399 | ~582 |

**LLM 차감 후 마진(미니앱 A):** 케미카드 ~₩783 / 만약에 우리 ~₩624 / 다시 ~₩463 = 판매가의 **~77–78%** → 마진 건전.

**채널 비대칭(D6 동일가):** 미니앱은 웹 대비 ~17–18% 낮음(IAP 20% 수수료). 예: 케미카드 LLM후 웹 ~₩953 vs 미니앱-A ~₩783(건당 ~₩170차). 적자 아님 — TAM 확대 비용으로 수용 가능. (종전 "~35% 낮다·순수령 610" 표기는 오류 정정.)

**Model C 선생성 sunk:** 미전환 선생성분 LLM(~₩17)만 손실. 전환율 20% 가정 시 결제 1건당 실효 LLM ≈ ₩85 ≪ 순수령 → 마진 위협 아님.

**CBT 일몰:** 토스 5% 복귀 시 net 85%→80%(케미카드 건당 ~₩50↓). 경미.

**결론:** **D6 가격 패리티는 마진상 안전**(미니앱도 ~77% 마진). 채널별 차등가 불요. worst-case(30%) net 66%만 모니터링 + 인상 트리거 준비. (LLM 원가가 미미하므로 §4 #8 "LLM 원가 대비 마진" 우려는 해소.)

### B3. Bearer 듀얼 인증 = 인증 레이어 리팩터 (§5 규모감각 정정)
- 현재 Bearer·CORS **전무**, 31 라우트 전부 쿠키 `getUser()`. iOS WebView 서드파티 쿠키 차단으로 cross-origin 쿠키 실패 → **Bearer 필수**이며 모든 보호 라우트의 user-resolution을 듀얼화해야 함.
- 미해결 설계: Bearer 발급 지점(appLogin 교환 후?), 저장처(Toss 네이티브 Storage SDK vs sessionStorage), 갱신(1h access ↔ Toss refresh 14d), 검증 순서(Bearer 우선→쿠키 fallback), 탈퇴 콜백 시 폐기 → P3에서 mini-ADR로 명세 + iOS 실기기 샌드박스 검증.

### B4. compat spike = P0 게이트 (§1.3 P2 → P0 격상)
- Granite + web-framework 2.6.x + **React 19.2.4** + 기존 deps(vaul 1.1.2 / @base-ui/react 1.4.1 / recharts 3.8.x / Tailwind v4)의 동시 호환은 **미실증**. 본 이식(P4) 착수 전 **go/no-go 스파이크**로 검증: 최소 컴포넌트 1개 `granite build` → 샌드박스 부팅. 실패 시 React 18 다운그레이드 결정.

### B5. .ait 번들 내 관측성 (미언급)
- 현재 Sentry는 Next 라우트 측에 존재 → SPA 번들에서 소실. 미니앱 런타임 에러·LLM 실패 리포팅 전략 부재. 채널톡: "Toss WebView에서 Sentry 동작? 권장 에러 리포팅 메커니즘?" → 미지원 시 Toss Analytics 이벤트 또는 커스텀 엔드포인트.

### B6. 인앱 법무/CS + 탈퇴 콜백 삭제 + IAP 환불 (문서 미반영)
- 외부링크 금지 → terms/privacy/refund를 **인앱 뷰(번들 정적 렌더)**로 노출(링크 아님).
- `privacy_policy.md`: Toss를 처리위탁자로 추가 + 연결끊기(UNLINK/WITHDRAWAL_*) 콜백 수신 시 세션 무효화·삭제 절차 조항 신설. `refund_policy.md`/`terms_of_service.md`: Apple/Google IAP 환불·REFUNDED 잠금 회수 조항 신설.
- 신규 `api/toss/disconnect`: mTLS 검증 → `userKey` 추출 → `/me/delete-request` 흐름 재사용(멱등).

### B7. 부적(무료 토큰) + IAP 정책 리스크 (미검토)
- ADR-039 하이브리드(무료 부적 우선 → 부족 시 현금). 무료 데일리 부적이 Toss에 "가상통화"로 보일 수 있고, 동일 기능이 sometimes-free/sometimes-IAP인 구조가 IAP-only 규정과 충돌할 소지 → **채널톡 확인 필수**: "데일리 무료 크레딧(부적) 허용? sometimes-free/sometimes-IAP 허용?"

### B8. 채널톡 질문 리스트 (§4 #7 확장)
①운세 카테고리 사전 승인(돈합=투자자문 오인 위험 구체화) ②TDS 실제 검수 포함 여부·범위(A2) ③부적/가상통화 정책(B7) ④`getAnonymousKey` 존재·시그니처(A4) ⑤Sentry/에러리포팅 지원(B5) ⑥`/order/get-order-status` 지연 SLA(30초 한도 대비) ⑦user_key-only → 추후 email scope 링크 가능 여부(B1) ⑧iframe·외부임베드 허용 범위(A3).

### B9. 검증된 사실·재사용 확정 (변경 불요)
- **정확 확인(공식 문서 ✅)**: 토스로그인-only·IAP-only·토스페이먼츠 금지·수수료 15%+5%(CBT 0%)·636/647 순수령·정산(팝빌/역발행)·mTLS·3000 QPM·tossmini 도메인+CORS·AI 고지 과태료 3천만원·외부링크 금지·운세 비제한·데이팅 미해당·getTossShareLink/intoss://·Supabase 공식 가이드·토큰 수명(10분/1h/14d)·탈퇴 콜백 3종(UNLINK/WITHDRAWAL_TERMS/WITHDRAWAL_TOSS).
- **코드 재사용 확정**: `isFeatureUnlocked`(token_ledger OR payments confirmed 이중 소스)는 IAP unlock을 **수정 없이** 흡수 가능 — IAP `processProductGrant`가 mTLS 주문검증 후 payments row(status=confirmed) insert하면 read-path 게이트(ohaeng/role)·3 유료 라우트 Model C 모두 그대로 동작. 백엔드 도메인 로직(만세력·점수식·LLM·DB) 100% 재사용.
