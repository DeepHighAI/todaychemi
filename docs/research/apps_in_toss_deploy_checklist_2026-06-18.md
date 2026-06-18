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
- [ ] **B-2 브랜드**: `displayName`=`오늘케미`(한글, 설정됨) · `brand.icon` 등록.
  - ⚠️ `miniapp/granite.config.ts` 의 `brand.icon` 이 현재 빈 값(`''`). 아이콘 자산 확정 후 경로 기입 필요(코드 변경 — 자산 주시면 반영).
- [ ] **B-3 카테고리**: "라이프스타일/운세". "소셜/만남"·투자자문 분류 회피(특히 돈합 모드 — C-1 채널톡 확인).
- [ ] **B-4 IAP SKU 4종 등록** → SKU ID 수령 → A-6/A-7 기입.
  - 가격: `feature-prices.ts` 의 `amount_krw`(오픈 50% 할인가) = 케미카드 **₩500** · 또 다른 나 **₩400** · 케미 다시 맞추기 **₩300** · 인연 슬롯 **₩500**. (이벤트 종료 후 정가 1,000/800/600/1,000 환원 — **§1.1 최종 가격 확정 후 등록**)
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

- [ ] **D-1** `granite.config.ts` appName/icon 확정 반영(B-1/B-2)
- [ ] **D-2** `cd miniapp && pnpm install --ignore-workspace` (루트 lockfile 보호 — 필수 플래그)
- [ ] **D-3** `cd miniapp && pnpm build` → `todaychemi.ait` 생성 확인
- [ ] **D-4** `cd miniapp && pnpm deploy` (`ait deploy`) 또는 콘솔 수동 업로드 → `deploymentId` 발급
- [ ] **D-5** A-6/A-7 SKU env 반영 후 Vercel **재배포**(env 변경은 재배포 시 적용)

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

코드 측에서 대기 중인 항목(자산·확정값 주시면 반영): `granite.config.ts` appName/icon. 그 외 코드 잔여 없음.
