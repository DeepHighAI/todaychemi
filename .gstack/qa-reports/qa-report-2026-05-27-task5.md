# Task #5 Runtime QA Report — 2026-05-27

**Branch**: `codex/remaining-dev-1-3`  
**Tester**: Claude (Opus 4.7, automated browser QA)  
**Baseline**: 1600/1600 unit tests PASS, 0 TS errors, 0 lint errors  

---

## Summary

7개 항목 브라우저 런타임 검증 완료. **2건 버그 수정(TDD)**, **2건 Finding 보고(§1.1 결정 대상)**.

| 항목 | 결과 | 비고 |
|------|------|------|
| 1. 법적 페이지 | ✅ PASS | privacy/terms/refund 마크다운 렌더 정상 |
| 2. 공유 링크 | ✅ PASS (F-002 제외) | 공유 카드·CTA·OG메타 정상. OG 이미지 라우트 별도 Finding |
| 3. 결제 성공 | ✅ PASS (제약) | 에러 카드 정상. 해피패스는 실제 Toss 필요 — 로컬 불가 |
| 4. 소셜 동의 | ✅ PASS | 비로그인→리다이렉트, 로그인→동의 폼 렌더 |
| 5. 데이터 권리 API | ✅ PASS (BUG-01 수정) | export 500 수정, delete-request 멱등 확인 |
| 6. 인증 후 합카드 | ✅ PASS (BUG-02 수정) | gpt-5 모델 수정 후 합카드 생성 성공 |
| 7. QA 보고서 | ✅ DONE | 본 파일 |

---

## Phase 1 — 로그아웃 공개 페이지

모두 PASS.

- `/legal/privacy` — 마크다운 본문 렌더, 콘솔 에러 0.
- `/legal/terms` — 마크다운 본문 렌더, 콘솔 에러 0.
- `/legal/refund` — 마크다운 본문 렌더, 콘솔 에러 0.
- `/auth/social-consent` (provider 없이, 비로그인) → `/login` 리다이렉트 확인.
- `/h/<무효토큰>` → 404(`notFound()`) 확인.

---

## Phase 2 — 인증 후 페이지 + 데이터 권리 API

### 소셜 동의 (항목 4)
- `/auth/social-consent?provider=google` (로그인 상태) → 동의 폼 렌더 정상.
- `POST /api/legal/social-consent` 경로는 폼 제출 불필요 테스트로 UI 확인에 국한.

### 결제 성공 (항목 3)
- `/payment/success` (params 없이) → 에러 카드 "결제 승인 정보가 올바르지 않습니다." 정상.
- `/payment/*` 는 middleware public allowlist 부재이나 page 자체 `getUser()` 처리 → WAI.
- **제약**: 해피패스는 실제 Toss 결제 필요 → 로컬 환경 불가.

### 데이터 권리 API (항목 5)

**BUG-01 발견 및 TDD 수정 ✅ (`853fda2`)**
- 증상: `GET /api/me/export` → 500 `TypeError: Cannot read properties of undefined (reading 'rest')`.
- 원인: `src/app/api/me/export/route.ts:85` — `db.from` 메서드를 `this` 바인딩 없이 추출, 실제 Supabase client 내부 `this` 참조 깨짐.
- 수정: `db.from.bind(db)` 추가.
- 회귀 테스트: `tests/app/api/me/export/route.test.ts` — `FakeClientWithThis` 케이스(언바인드 시 throw) 추가. RED→GREEN 확인.
- 수정 후: 인증 시 7테이블 JSON 다운로드 200 정상. 비인증 401 정상.

`POST /api/me/delete-request`
- 인증: `{ok:true, already_requested:false}` → 재호출 시 `already_requested:true` 멱등 확인.
- 비인증: 401 확인.
- ⚠️ **부작용**: `Test1@test.com` 계정 `deletion_requested_at` live DB에 기록됨 → §1.1 롤백 보고(아래).

---

## Phase 3 — 합카드 생성 + 공유 end-to-end

### 인증 후 합카드 생성 (항목 6)

**BUG-02 발견 및 TDD 수정 ✅ (`c2278a6`)**
- 증상: `POST /api/hapcards` → 500 `404 The model 'gpt-5o' does not exist or you do not have access to it.`
- 원인: `src/lib/llm/model-router.ts:6-7` — `hapcard: 'gpt-5o'`, `replay: 'gpt-5o'` (OpenAI에 실존하지 않는 모델명. R8 `feedback_llm_model_mismatch.md`).
- 수정: `hapcard: 'gpt-5'`, `replay: 'gpt-5'`.
- 테스트 갱신: `tests/lib/llm/model-router.test.ts` (3건), `tests/lib/hapcard/builder.test.ts` (4건), `tests/lib/replay/builder.test.ts` (4건) — RED 확인 후 GREEN.
- 수정 후: `POST /api/hapcards` → 200 OK (51초). `llm_model: "gpt-5"` DB 저장 확인.
- DB CHECK 변경 불필요: `0028_llm_model_check_realign.sql` 이미 `gpt-5` 허용.

생성된 합카드:
- `hapcard_id`: `6b49d901-f595-4cb5-82dc-23dcb51c79f6`
- `compat_score`: 74, `prompt_version`: v0.13, `llm_model`: gpt-5
- 13섹션 렌더 확인: AppBar "테스트2 · 무신 ↔ 갑인", "더 자세히 펼쳐보기", "그럴리 없어! 다시", "오늘 우리는 공유하기" 버튼 확인.

### 공유 링크 (항목 2)

`POST /api/hapcards/6b49d901.../share` → 200 OK
- `url`: `http://localhost:3000/h/aKbv8860uDsAVQPJkFOyG02bKl8lyNFyzTcjjVyAfgM`
- `og_image_url`: `http://localhost:3000/api/og/share/aKbv8860uDsAVQPJkFOyG02bKl8lyNFyzTcjjVyAfgM` ← localhost (request origin 사용)
- `expires_at`: 2026-06-26

`/h/<raw token>` 비로그인 접근 PASS:
- 페이지 타이틀: "테스트2님과의 돈이 오가는 사이" ✅
- OG meta: `og:title`, `og:description` 정상 ✅
- CTA: "오늘사이에서 보기" → `/login` ✅
- 모드 배지: "돈합" ✅

---

## Findings (§1.1 / §1.3 보고)

### F-001: `NEXT_PUBLIC_APP_URL` 미설정 → OG meta 이미지 URL이 `https://hap.plae` 사용
- **증거**: `og:image` = `https://hap.plae/api/og/share/...`, 브라우저 콘솔 `ERR_NAME_NOT_RESOLVED`.
- **위치**: `src/lib/share/public-share.ts:34` — `process.env.NEXT_PUBLIC_APP_URL ?? 'https://hap.plae'` fallback.
- **영향**: 프로덕션에서 공유 시 OG 이미지 불러오기 실패(링크 미리보기 깨짐). 메신저 크롤러 차단.
- **조치**: `.env.production` 에 `NEXT_PUBLIC_APP_URL=https://실제도메인` 설정 필요. **§1.1 결정 대상**.

### F-002: `/api/og/share/<token>` OG 이미지 라우트 빈 응답(empty response)
- **증거**: `curl` exit code 52 (empty reply), dev log `⨯ Error: failed to pipe response`.
- **위치**: `src/app/api/og/share/[token]/route.tsx` — `export const runtime = 'nodejs'` + `ImageResponse`.
- **원인 추정**: Next.js 16 Turbopack dev 환경에서 `next/og` (`ImageResponse`)의 native/WASM 모듈 스트림 파이프 오류. Vercel 프로덕션 배포 환경에서는 정상 동작 가능성 있음.
- **참고**: hapcard OG 라우트는 `runtime = 'edge'` 사용 — edge vs nodejs 차이 주목.
- **조치**: (1) Vercel 배포 후 OG 이미지 실제 동작 확인, (2) 미동작 시 `runtime = 'edge'` 전환 + `createServiceRoleClient()` → edge 호환 클라이언트로 교체. **§1.3 별도 PR 대상**.

### F-003 (기존 문서): `Test1@test.com` `deletion_requested_at` 기록됨
- delete-request 테스트로 live DB에 timestamp 기록. NULL 복구 여부 사용자 결정.

### F-004 (기존): `middleware.ts` `/login` 리다이렉트 시 `?next=` 미보존 — 별도 판단.

### F-005 (기존): `gpt-5o` 스펙 문서 전반 동기화 필요
- `tech_stack.md`, `FRONTEND-PREP.md`, `docs/specs/*` 등이 `gpt-5o`를 핵심 모델로 기술.
- ADR-037 + §12 변경 매트릭스 대상 → **별도 작업, §1.1 확인 필요**.

---

## 버그 수정 커밋

| 커밋 | 내용 |
|------|------|
| `853fda2` | fix(export): bind db.from to preserve this context in export route |
| `c2278a6` | fix(llm): route hapcard and replay flows to gpt-5 (gpt-5o not a real model) |

---

## 미결 제약

- 결제 해피패스: 실제 Toss 결제 필요 → 로컬 불가, 에러 카드 경로만 검증.
- F-002 OG 이미지: Vercel 배포 환경에서 재검증 필요.

---

## Decisions & Disposition (2026-05-27)

§1.1 절차로 F-001~F-005 전원 처리 완료.

| Finding | Disposition | 커밋 |
|---------|-------------|------|
| F-001 — `NEXT_PUBLIC_APP_URL` fallback 깨짐 | 해결 — `getAppOrigin()` 헬퍼 신규 (`src/lib/app-url.ts`) + `VERCEL_PROJECT_PRODUCTION_URL` Vercel fallback + 호출부 2곳 교체 + `.env.example` 문서화 | `1e40cac` |
| F-002 — OG 이미지 빈 응답 | 무코드 — `runtime='nodejs'` 유지. Vercel 배포 후 수동 재검증(dev-only Turbopack 추정). 실패 시 `runtime='edge'` 전환(별도 PR). | N/A |
| F-003 — `Test1@test.com` `deletion_requested_at` 기록 | 무조치 — 삭제 유예 흐름 검증용 데이터 보존. 복구 안 함. | N/A |
| F-004 — 로그인 리다이렉트 `?next=` 미보존 | 해결 — `src/lib/supabase/middleware.ts` 미들웨어 수정 + `tests/lib/middleware-next-redirect.test.ts` TDD 3건 RED→GREEN | `38829f7` |
| F-005 — `gpt-5o` 문서·스크립트 식별자 stale | 해결 — docs/scripts/prompts 전반 `gpt-5o`→`gpt-5` (Bucket B, 27 파일). DB CHECK legacy enum(`gpt-5o`) 보존(Bucket A). 1608 PASS · 0 typecheck · 0 lint. | `4223e83` |

**§1.3 관찰 (범위 외, 별도 PR 대상)**:
- `docs/specs/contracts.md:225` `PromptVersion.model_name` union 이 실코드 `src/types/prompt.ts` 와 구조 불일치(aspirational doc drift).
- Vercel 배포 후 F-002 재검증 결과에 따라 `runtime='edge'` 전환 여부 결정.
