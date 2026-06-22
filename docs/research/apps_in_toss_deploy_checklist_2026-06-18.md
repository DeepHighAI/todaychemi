# 앱인토스 미니앱 배포 체크리스트 (2026-06-18 기준)

> 코드·백엔드는 준비 완료. **실제 배포를 막는 유일한 블로커 = 콘솔/대시보드 외부 설정**이다.
> 실행은 전부 사용자(대표) 직접 작업(콘솔·Vercel 대시보드). 본 문서는 그 정확한 순서·값 가이드다.

## 0. 현재 상태 (코드 측 — 완료)

- ✅ 토스 브릿지(`/api/toss/login`·`/iap/unlock`·`/disconnect`)·mTLS 클라이언트·CORS·Bearer 인증 → `main` 반영 + Vercel 배포됨
- ✅ `20260614154823_toss_connections.sql` → 라이브 DB 적용 완료(`db:push:dry` = up to date)
- ✅ 미니앱 코드 잔여 작업(케미카드 402 결제 픽스·공유 OG·외부링크 제거·할인가 표시) → `main` 머지·푸시(`a8b656b`)
- ✅ `miniapp` 자체 게이트: tsc 0 · vitest 9/9 · `ait build` → `todaychemi.ait` 생성 성공
- ✅ 루트 tsc/lint PASS
- ⏳ mTLS 인증서 `mTLS_인증서_20260618.zip` 수령(루트, `.gitignore`됨) — 아래 A-4에서 사용

---

## A. Vercel Production 환경변수 (대시보드 → Project → Settings → Environment Variables → Production)

> 모두 **Production** 스코프. 시크릿은 클라이언트 번들 금지(`VITE_*`만 클라이언트 노출). 입력 후 **재배포** 필요.

- [ ] **A-1** `NEXT_PUBLIC_APP_URL` = `https://todaychemi.vercel.app`
- [ ] **A-2** `TOSS_ALLOWED_ORIGINS` = `https://todaychemi.apps.tossmini.com,https://todaychemi.private-apps.tossmini.com`
  - 프로덕션은 위 2개만. localhost 등 개발 오리진 제거.
- [ ] **A-3** `TOSS_USER_PASSWORD_SECRET` = 강한 무작위 문자열(32자+). 유령계정 비밀번호 HMAC 키, 서버 전용. **한 번 정하면 변경 금지**(기존 미니앱 계정 로그인 깨짐).
- [ ] **A-4** `TOSS_MTLS_CERT_PEM` / `TOSS_MTLS_KEY_PEM` = `mTLS_인증서_20260618.zip` 압축 해제 후 cert(.pem)·key(.pem) 내용 붙여넣기.
  - Vercel 은 개행을 `\n` 리터럴로 저장하고 런타임에 자동 복원(소비 라우트는 `runtime='nodejs'` — 적용됨).
  - 회전용 `TOSS_MTLS_CERT_PEM_NEXT`/`_KEY_PEM_NEXT` 는 2차 cert 발급 시에만(지금은 비움).
- [ ] **A-5** `TOSS_DISCONNECT_BASIC_AUTH` = `username:password` (예 `todaychemi:<강한값>`). **B-5 콘솔 등록값과 반드시 일치.**
- [ ] **A-6** `TOSS_IAP_SKU_MAP` = `hapcard:<sku>,whatif:<sku>,replay:<sku>,relation_slot:<sku>` (서버 검증용; B-4 SKU ID 확정 후)
- [ ] **A-7** `VITE_TOSS_IAP_SKU_MAP` = `{"hapcard":"<sku>","whatif":"<sku>","replay":"<sku>","relation_slot":"<sku>"}` (미니앱 빌드 env; B-4 후)
- [ ] **A-8** `VITE_API_BASE_URL` = `https://todaychemi.vercel.app` (미니앱 빌드 env. 기본 폴백이 동일하나 명시 권장)
- 참고: `TOSS_CLIENT_KEY`/`TOSS_SECRET_KEY`(웹 토스페이먼츠), `OPENAI_*`/`SUPABASE_*` 등은 기존 운영값 유지.

---

## B. 토스 콘솔 (앱인토스 콘솔 → 앱 등록·설정)

- [ ] **B-1 앱 등록 + appName 확정** = `todaychemi` (RFC-1123: 소문자·숫자·하이픈, ≤63). **사실상 영구**.
  - ⚠️ `granite.config.ts` 의 `appName:'todaychemi'` 및 `toss-share.ts` 의 `APP_NAME='todaychemi'` 와 **반드시 일치**. 콘솔에서 다른 이름 확정 시 두 파일도 같이 변경 요청.
- [x] **B-2 브랜드**: `displayName`=`오늘케미`(한글) · `brand.icon` 설정 완료.
  - ✅ 앱 로고 = `twoday_app_logo_600.svg`. `public/apps-in-toss/twoday_app_logo_600.svg` 로 Vercel 호스팅, `granite.config.ts brand.icon` = `https://todaychemi.vercel.app/apps-in-toss/twoday_app_logo_600.svg` (2026-06-18). 콘솔 업로드 이미지 URL로 교체 원하면 그 링크로 1줄 교체 가능.
- [ ] **B-3 카테고리**: "라이프스타일/운세". "소셜/만남"·투자자문 분류 회피(특히 돈합 모드 — C-1 채널톡 확인).
- [x] **B-4 IAP SKU 4종 등록** → SKU ID 수령 → A-6/A-7 기입.
  - 최종 확정가(2026-06-22): 케미카드 **₩550(공급가 500원)** · 또 다른 나 **₩440(공급가 400원)** · 케미 다시 맞추기 **₩440(공급가 400원)** · 인연 슬롯 **₩550(공급가 500원)**.
  - 코드 단일출처: `feature-prices.ts` 의 `amount_krw` 및 `miniapp/src/lib/iap/prices.ts` 의 `IAP_DISPLAY_PRICE_KRW` = 550/440/440/550.
- [ ] **B-5 토스 로그인 설정**: scope = **user_key 만**(PII 미수집, ADR-011). 연결해제 콜백 URL = `https://todaychemi.vercel.app/api/toss/disconnect` + Basic Auth(A-5 값과 일치).
- [ ] **B-6 인앱 기능 등록**(≥1) — 미니앱 내에서 완결되는 기능 경로 지정.

---

## C. 채널톡 사전 문의 (콘솔 채널톡 — 검수 반려 리스크 선해소)

- [ ] **C-1** 운세 카테고리 사전 승인 + **돈합** 모드가 투자자문/금융상품 추천으로 분류될 리스크 여부
- [ ] **C-2** 비게임 검수에 **TDS 필수 여부**·범위(현재 React19 + no-TDS 채택 → 검수 통과 가능 여부 확인)
- [ ] **C-3** 부적(무료 크레딧 → 부족 시 IAP) 하이브리드가 가상자산/유사화폐 정책 위반 아닌지
- [ ] **C-4** IAP `processProductGrant` 30초 grant 한도 vs `order/get-order-status` SLA
- [ ] (참고·기결정) user_key-only → 추후 email scope 계정연동 = v1 분리계정 수용(Option A 확정) · Sentry/iframe = 영향 적음

---

## D. 빌드 & 배포 (B 완료 후)

- [x] **D-1** `granite.config.ts` appName=`todaychemi`·icon URL 확정 반영 완료(2026-06-18)
- [x] **D-2** `pnpm install --ignore-workspace` 완료(격리 설치)
- [x] **D-3** `pnpm build` → `todaychemi.ait` 생성 완료(3.99MB, deploymentId `019eda12-f8f5-736f-8d7d-d2900c248c91`). Phase 4.2 검증 PASS(appName·displayName·icon)
  - ⚠️ icon URL은 **Vercel 배포 후** 해석됨 → 아래 GitHub push + Vercel 재배포 필요(이미 진행). 업로드 전 env(A절)도 설정해야 미니앱 API/인증/IAP 동작.
- [ ] **D-4** `cd miniapp && pnpm deploy` (`ait deploy`) 또는 콘솔 수동 업로드 → `deploymentId` 발급
- [ ] **D-5** A-6 서버 SKU env 반영 후 Vercel **재배포**(env 변경은 재배포 시 적용). A-7 미니앱 빌드 env는 `miniapp/.env.local`에 반영 후 `.ait` 재빌드·재업로드.

---

## E. 배포 후 검증 (샌드박스 → 검수 제출)

- [ ] **E-1** 샌드박스 기기(iOS16+/Android7+) `intoss-private://todaychemi?_deploymentId=...` 부팅
- [ ] **E-2** 8 플로우 스모크: 온보딩·인연등록·케미피드·케미카드·오늘케미·본명식·또 다른 나·케미 다시 맞추기(+공유)
- [ ] **E-3** 토스 로그인 실세션(userKey → Supabase 매핑) 확인
- [ ] **E-4** IAP 실결제: 케미카드/또 다른 나/다시맞추기/인연슬롯 구매 → 잠금해제, 복원(getPendingOrders), 환불 폴링
  - ※ **케미카드 결제 버그(402 버튼 비활성) 픽스 검증** — 이번 라운드 핵심
- [ ] **E-5** 공유: 토스 공유 시트 + OG 미리보기 이미지 노출 확인
- [ ] **E-6** 콘솔 검수 요청 제출(비게임 가이드 `checklist/app-nongame.md` 대조)

---

## 순서 요약

B-1(appName) → B-2~B-6 + C(채널톡) 병행 → A(env, mTLS+secrets) → A-6/A-7(SKU, B-4 후) → D(빌드·배포) → E(샌드박스·검수).

코드 측 대기 항목 없음 — appName/icon 확정·빌드 완료. 남은 건 콘솔/Vercel env(사용자) + `.ait` 업로드뿐.
