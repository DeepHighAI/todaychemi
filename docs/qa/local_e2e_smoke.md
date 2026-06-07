# 로컬 E2E Manual Smoke 가이드

오늘케미 프로젝트의 핵심 사용자 flow를 브라우저에서 직접 점검하는 절차서다.

---

## 0. 사전 준비

### 0-1. 의존 설치

```powershell
cd C:/DEV/SAJU
pnpm install
```

### 0-2. 환경 변수 확인 (`.env.local`)

아래 키가 반드시 설정되어 있어야 한다.

| 키 | 비고 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jamhkucluhiibqpjsiov.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → API → `service_role` key |
| `OPENAI_API_KEY` | LLM flow(F5·F6·F8) 필수. LLM_DAILY_BUDGET_USD=20 기본 |
| `KASI_SERVICE_KEY` | 시드·차트 계산용. `.env.example` 과 실제 코드 모두 이 이름을 사용한다. |

> LLM 관련 키(`OPENAI_API_KEY`)가 없으면 F5·F6·F8 에서 LLM 호출이 실패한다. F1~F4·F7은 LLM 없이도 동작한다.

### 0-3. DB 상태 확인

```powershell
# 0024+0026 적용 완료, v0.3 active 6/6 확인
npx tsx scripts/verify-b1-migrations.ts
```

기대 출력:
```
[0024+seed] v0.3 active: 6/6
[0024] v0.2 rolled_back: 6
[0026] whatif_results 테이블: ✅ 쿼리 가능
```

### 0-4. 테스트 계정 생성

```powershell
pnpm seed:test-user
```

> **보안 경고**: 계정 비밀번호는 코드에 평문 하드코딩된 **로컬 dev 전용 시드**다. 프로덕션 DB에 절대 사용 금지.

| 항목 | 값 |
|---|---|
| 이메일 | `Test1@test.com` |
| 비밀번호 | `test1234` |
| 별명 | 테스트1 |
| 생년월일 | 1990-01-01 (양력, 남성, 12:00) |

멱등 스크립트 — 이미 존재하면 skip. 재실행 안전.

### 0-5. dev 서버 시작

```powershell

```

브라우저에서 `http://localhost:3000` 열기. 첫 빌드는 10~20초 소요.

### 0-6. DevTools 세팅 (권장)

- **Network 탭** 열기 → `/api/*` 응답 코드 확인
- **Console 탭** 열기 → 런타임 에러 감시

---

## ⚠ LLM 비용 경고

F5(케미카드)·F6(오늘 홈)·F8(만약에 우리)는 LLM API 호출이 발생한다.

| Flow | 예상 비용/회 | 캐시 조건 |
|---|---|---|
| F5 케미카드 | ~$0.05 (GPT-5) | 같은 user+relation 의 `chart_hash` 가 동일하면 DB 캐시 hit → 재호출 무료 |
| F6 오늘 홈 | ~$0.05 (GPT-5 mini) | 오늘 날짜(`jinjin_date`) 기준 DB 캐시. 같은 날 재접속 = 무료 |
| F8 만약에 우리 | ~$0.05/모드 (GPT-5) | `cache_key`(chart_hash + type) 기준 캐시. 같은 날 같은 모드 재호출 = 무료 |

한도: `LLM_DAILY_BUDGET_USD=20` (`.env.local` 설정값). 초과 시 503 응답.

---

## 1. F0 — 게스트 선체험 → 가입 유도

**URL**: `/start` → `/guest/start` → `/onboarding` → `/today/me` → `/signup?intent=guest`  
**LLM**: 있음 (`/api/guest/today`, GPT-5 mini)  
**사전 조건**: 로그아웃 상태

### Steps

1. `http://localhost:3000/` 접속
2. `/start`로 이동하고 `처음이세요?`, `우리 만난 적 있죠?` 버튼 표시 확인
3. `처음이세요?` 클릭
4. 이용약관, 개인정보처리방침, 만 14세 이상 동의 체크 후 `동의하고 시작하기`
5. 자기 사주 온보딩 입력 후 review에서 `시작하기`
6. `/today/me`에서 **오늘 나의 흐름** 결과 확인
7. `친구와의 오늘 케미 보기` 클릭
8. `/signup?intent=guest`에서 이메일 또는 Google/Kakao 가입 진행
9. 가입 완료 후 `/guest/complete`를 거쳐 `/relations/new` 이동 확인

### Expected

- 가입 전 게스트 입력값은 같은 탭 `sessionStorage`에만 남는다.
- `POST /api/guest/today`는 200을 반환하고 `users`, `user_charts`, `daily_haps`에 insert하지 않는다.
- 가입 전환 후 `/api/onboarding`이 201 또는 기존 온보딩 409를 반환하고 게스트 sessionStorage가 정리된다.
- 세션이 유지된 기존 유저가 `/start`에 접근하면 `/` 홈으로 이동한다.

## 2. F1 — 회원가입 → 로그인

**URL**: `/signup` → `/login`  
**LLM**: 없음  
**사전 조건**: 서버 실행 중, 신규 이메일 계획 (기존 `Test1@test.com` 외 새 이메일 사용 시)

### Steps

1. `http://localhost:3000/signup` 접속
2. 이메일 입력 (예: `smoke1@example.com`)
3. 비밀번호 입력 — **8자 이상 + 영문 + 숫자** 조합 필수 (예: `Smoke1234`)
4. `이메일로 가입` 버튼 클릭
5. `/onboarding` 또는 `/` 로 자동 리다이렉트 확인
6. (또는) `/login` 에서 `Test1@test.com` / `test1234` 로 로그인 시도

### Expected

- 가입 성공 시: `/onboarding` 리다이렉트
- 로그인 성공 시: `/` (오늘 홈) 리다이렉트, TabBar(홈·피드·내 프로필) 노출
- 인증 앱 첫 진입 시 `POST /api/rewards/session`이 호출된다. KST 기준 당일 첫 진입이면 `bonus +1`, 신규 계정이 온보딩을 완료한 뒤 첫 앱 화면에 들어오면 가입 보상 `bonus +5`도 함께 기록된다.

### Failure check

| 증상 | 원인 | 대응 |
|---|---|---|
| "이미 사용 중인 이메일" | 중복 | 다른 이메일 사용 |
| "비밀번호는 8자 이상이어야 해요" | 정책 미충족 | 8자+영문+숫자 확인 |
| "요청이 너무 많아요" | Rate limit 10회/5분 | 5분 대기 |
| Network 400/422 | body parse 문제 | Console → error 메시지 확인 |
| Google 버튼 실패 | Dashboard Google provider 미활성 | Email 로그인만 사용 |

---

## 3. F2 — 자기 사주 온보딩

**URL**: `/onboarding`  
**LLM**: 없음  
**사전 조건**: 로그인 완료, 온보딩 미완료 상태 (신규 계정)

> 이미 온보딩 완료한 계정은 `/`로 리다이렉트된다. 테스트 시 신규 계정 사용 권장.

### Steps

1. 로그인 후 `/onboarding` 자동 이동 또는 직접 접속
2. **별명** 입력 (예: `스모크`)
3. **생년월일** 입력 (예: `1990-01-15`)
4. **달력 종류** 선택: `양력`
5. **태어난 시간** — `정확해요` 선택 후 시간 입력 (예: `09:00`)
6. **성별** 선택: `남` 또는 `여`
7. **개인정보 처리방침 동의** 체크
8. `시작하기` 버튼 클릭

### Expected

- POST `/api/onboarding` → 201
- Eager chart 계산 트리거 (백그라운드)
- `/` (오늘 홈) 리다이렉트

### Failure check

| 증상 | 확인 |
|---|---|
| 폼 Submit 후 아무 반응 없음 | Console error, Network 탭 `/api/onboarding` 응답 확인 |
| `KASI_SERVICE_KEY` 관련 에러 | `.env.local` 키 이름과 값 확인 |
| 시간 미입력 시 에러 | "태어난 시간을 입력해주세요" 검증 메시지 확인 |

---

## 4. F3 — 인연 등록

**URL**: `/relations/new`  
**LLM**: 없음  
**사전 조건**: 자기 사주 온보딩 완료

### Steps

1. 피드 or 오늘 홈에서 `인연 추가` 버튼 클릭 또는 직접 `/relations/new` 접속
2. **인연 별명** 입력 (예: `테스트인연`)
3. **생년월일** 입력 (예: `1992-06-20`)
4. **달력 종류** 선택: `양력`
5. **태어난 시간** — `몰라요` 선택 (또는 시간 입력)
6. **성별** 선택
7. **관계 유형** 선택: 6가지 중 1가지 (예: `친구합`)
8. **동의** 체크
9. `등록하기` 버튼 클릭

### Expected

- POST `/api/relations` → 201
- Eager relation_chart 계산 트리거
- `/feed` 리다이렉트
- 방금 등록한 인연 카드가 피드에 표시됨

### Failure check

| 증상 | 확인 |
|---|---|
| 등록 실패 | Network 탭 `/api/relations` 응답, Console error |
| 피드에 카드 미표시 | 페이지 새로고침 후 재확인 |

---

## 5. F4 — 케미피드 정렬 + 변화 배지

**URL**: `/feed`  
**LLM**: 없음  
**사전 조건**: 인연 1명 이상 등록 완료

### Steps

1. TabBar `피드` 탭 클릭 또는 직접 `/feed` 접속
2. 인연 카드 목록 확인

### Expected

- 인연 카드 그리드 표시 (최근 생성 순 정렬)
- 각 카드: 별명 + 관계 유형 라벨(예: `친구합`, `썸합`) + 호환성 점수(합게이지)
- 점수 변화가 클 경우 `변화 큰 {점수차}` 배지(ChangeBadge) 표시 (첫 등록 직후엔 없을 수 있음)
- 빈 상태 시: "아직 등록된 인연이 없어요. 첫 인연을 추가해보세요."

### Failure check

| 증상 | 확인 |
|---|---|
| 카드 미표시 | Network 탭 `GET /api/relations` 응답 확인 |
| 점수 0 | 케미카드 아직 미생성 상태. F5 실행 후 다시 확인 |

---

## 6. F5 — 케미카드 9섹션 생성

**URL**: `/hapcard/[id]` (`id` = 인연의 `hapcard_id`)  
**LLM**: 있음 (~$0.05, GPT-5). DB 캐시 hit 시 무료.  
**사전 조건**: 인연 등록 완료

### id 확인 방법

1. 피드 `/feed` 에서 인연 카드 클릭
2. URL이 `/hapcard/xxxx-xxxx-...` 로 변경됨

### Steps

1. 피드에서 인연 카드 클릭 → `/hapcard/[id]` 이동
2. 로딩 상태 확인 (LLM 호출 중)
3. 결과 렌더 완료 대기 (최초 생성 시 5~15초)

### Expected

9개 섹션 모두 표시 여부 확인:

| 섹션 | 확인 포인트 |
|---|---|
| Hero (일주) | 두 사람의 ilju chip + 가운데 `↔` |
| 합게이지 | 숫자 점수 + 티어(약함/보통/좋음/매우 좋음) + 끌림·긴장·부딪힘·소모 세부 바 |
| 오행 흐름 | 본인 vs 인연 오행 막대 5종(목·화·토·금·수) |
| 오행 비교 (MiniRadar) | 오각형 레이더 차트 2개 오버레이 |
| 끌림의 이유 | LLM 생성 텍스트 목록 |
| 오늘의 조언 | LLM 생성 조언 목록 |
| 고전에서 찾은 지혜 | 고전 인용 문구 |
| Glossary 툴팁 | 명리 용어(끌림·긴장·부딪힘·소모 등) 클릭 → 툴팁 팝오버 |
| Footer | 면책 문구 + `다시 해석하기` 버튼 |

### Failure check

| 증상 | 확인 |
|---|---|
| 로딩 무한 대기 | Network 탭 `POST /api/hapcards` 응답 확인. 401 → 로그인 재확인 |
| "chartPending" 에러 | eager chart 아직 계산 중. 10초 후 새로고침 |
| LLM 에러 카드 | `OPENAI_API_KEY` 설정 + 일일 예산 확인 |

---

## 7. F6 — 오늘 홈 (Today)

**URL**: `/`  
**LLM**: 있음 (~$0.05, GPT-5 mini). 당일 DB 캐시 hit 시 무료.  
**사전 조건**: 자기 사주 + 인연 1명 이상

### Steps

1. TabBar `홈` 탭 클릭 또는 직접 `/` 접속
2. 로딩 완료 대기

### Expected

| 영역 | 확인 포인트 |
|---|---|
| DateLine | 오늘 날짜 (YYYY.MM.DD 형식) |
| TodayHero | LLM 생성 오늘 운세 카드 (한 줄 결론 + 조언) |
| AvoidActionCards | 오늘 피할 말 + 오늘 좋은 행동 |
| WhatifTrigger | `이런건 어때 ✨` 버튼 (만약에 우리 진입) |
| RecentFeedRows | 최근 인연 최대 5명 (합점수 표시) |

### Failure check

| 증상 | 확인 |
|---|---|
| TodayHero 로딩 장시간 | `GET /api/today` 응답 시간 확인. LLM-only timeout 25s (`TODAY_LLM_TIMEOUT_MS`) — 그 이상 걸리면 KASI compute 또는 cache lookup 문제 |
| body 가 "오늘 메시지를 준비하지 못했어요" (TEMPLATE) | `error_events` 테이블 확인 — `error_code` IN ('LLM_TIMEOUT','LLM_PARSE_FAIL','USER_CHART_NOT_FOUND','TODAY_BUILD_FAIL') |
| `TODAY_FETCH_FAILED` | OPENAI_API_KEY, 예산 한도, Supabase 연결 확인 |

### Task 1 instrumentation 확인 절차 (Phase 3 후속)

응답 시간 14s 이상이 보고된 경우 또는 TEMPLATE body 가 노출된 경우:

```sql
SELECT
  error_code,
  context->>'phase' AS failed_phase,
  (context->>'total_ms')::int AS total_ms,
  context->'phases' AS phases,
  stack,
  created_at
FROM error_events
WHERE context->>'source' = 'today.recordTrace'
ORDER BY created_at DESC
LIMIT 20;
```

해석:
- `failed_phase='llm'` + `error_code='LLM_TIMEOUT'` → 25s 안에 GPT-5 응답 미도착 (예산/quota/모델 latency 점검)
- `failed_phase='llm'` + `error_code='LLM_PARSE_FAIL'` → JSON 응답 형식 깨짐 (prompt 본문 검수)
- `failed_phase='relationChart'` + total_ms > 10000 → KASI compute 첫 호출 지연 (관련 인연 chart 사전 생성 검토)
- `failed_phase='userChart'` + `error_code='USER_CHART_NOT_FOUND'` → onboarding chart compute 실패 (relations/route 의 eager compute 점검)

phases 배열에서 각 단계 ms 비교하여 병목 단계 식별 가능.

---

## 8. F7 — /me 본명식 5섹션

**URL**: `/me`  
**LLM**: 없음  
**사전 조건**: 자기 사주 온보딩 완료

### Steps

1. TabBar `내 프로필` 탭 클릭 또는 직접 `/me` 접속

### Expected

| 섹션 | 확인 포인트 |
|---|---|
| Hero | 일주(ilju) 한자 + 설명 |
| 본명식 (PillarGrid) | 년주·월주·일주·시주 — 각 4칸에 천간·지지 한자 |
| 오행 분포 (OhaengBars) | 목·화·토·금·수 막대 비율 |
| 일간 (DayMaster) | 일간 오행 설명 (예: "나무처럼 곧고 뻗어나가는 기질...") |
| 운세 흐름 (YunseCard) | 대운(현재 대운) · 세운(올해) · 월운(이번 달) · 일운(오늘) — 각 간지 표시 |

### Failure check

| 증상 | 확인 |
|---|---|
| "본명식이 아직 등록되지 않았어요" | 온보딩 완료 확인 (`/onboarding`) |
| OhaengBars 바가 보이지 않음 | DevTools CSS 확인 (width: 0% 인지) |
| 시주 `—` 표시 | 시간 입력 안 했을 때 정상 |

---

## 9. F8 — 만약에 우리 6모드

**URL**: `/` 에서 WhatifSheet 진입 (또는 직접 `/whatif/[type]`)  
**LLM**: 있음 (~$0.05/모드, GPT-5). 당일 same 모드 캐시 hit 시 무료.  
**사전 조건**: 자기 사주 온보딩 완료

`[type]` 값 → `work | love | conflict | leadership | money | first_meet`

### Steps

1. `/` 오늘 홈에서 `이런건 어때 ✨` 버튼 클릭
2. WhatifSheet(드로어) 열림 확인
3. 6개 카드 중 1개 클릭 (예: `일할 때 나` → `/whatif/work`)
4. 로딩 상태 확인 (첫 생성 5~10초)
5. 결과 확인

### Expected

| 섹션 | 확인 포인트 |
|---|---|
| 키워드 | 짧은 성격 키워드 칩 목록 |
| 일단 이거 해봐 | 실행 가능한 행동 권장 |
| 첫 만남 TIP | `first_meet` 모드에서만 표시 |
| 고전 인용 | 명리 고전 인용 문구 |

6모드 전체 테스트 시 각 모드 1회씩 호출. 총 ~$0.30 예상.  
**캐시**: 같은 날 같은 모드 재진입 시 DB 캐시 hit → 무료.

### Failure check

| 증상 | 확인 |
|---|---|
| ErrorCard "토큰이 부족해요" | 사용자 무료 부적 잔액 부족. pay-per-use feature pay sheet와 `payments.feature_*` unlock 확인 필요 |
| ErrorCard "처리 중 오류" | LLM 키·예산 확인 |
| WhatifSheet 미열림 | Console error, `WhatifTrigger` → `WhatifSheet` import 확인 |

---

## 부록 A: 보조 flow (선택)

### F9 — 케미 다시 맞추기 (Replay)

케미카드 하단 `다시 해석하기` 버튼 클릭. 토큰 4 차감. 당일 1회만 가능(idempotency).  
Expected: 새 LLM 결과로 케미카드 갱신.

### F10 — 공유 시트 (Share)

케미카드 `공유하기` 버튼 → ShareSheet 드로어. 범위 선택(별명만/오행포함/성별포함) → `카카오톡` / `인스타그램/카드` / `링크 복사`.
Expected: `/h/<token>` 공개 링크가 생성되고 OG 카드가 표시된다. Kakao callback으로 서버가 성공을 검증한 경우에만 `bonus +1`이 1회 지급된다. 같은 오늘 케미 카드는 1회만 보상되며 KST 기준 하루 최대 5회다.
(PC 브라우저에서는 카드 이미지 다운로드 또는 링크 복사 경로 동작. 복사/다운로드만으로는 보상 지급 없음)

### F11 — Glossary 툴팁·바텀시트

케미카드 본문에서 파란 밑줄 용어(끌림·긴장·부딪힘·소모 등) 클릭.  
Expected: 툴팁 팝오버 → `더 알아보기` → GlossarySheet(바텀시트) 열림 + 관련 용어 목록.

### F12 — 로그아웃 → 재로그인

Supabase 세션 만료 재현: DevTools → Application → Cookies → Supabase 쿠키 삭제 → 새로고침.  
Expected: `/login` 리다이렉트 → 재로그인 후 이전 상태 복구.

---

## 부록 B: 버그 보고 템플릿

이슈 발견 시 `MEMORY.md` §1.3 별도 이슈로 기록하거나 GitHub Issue로 등록.

```markdown
### 재현 단계
1. (URL)
2. (Action)
3. (Expected)

### 실제 결과
(What actually happened)

### 스크린샷 / 콘솔 에러
(Paste console error, Network 응답 코드/body)

### 환경
- git SHA: (git log --oneline -1)
- 브라우저: (Chrome/Safari/Firefox + 버전)
- OS: (Windows/Mac)
```

---

## 부록 C: 유용한 명령어

```powershell
# 개발 서버
pnpm dev

# DB 상태 확인 (v0.3 active 6/6 + whatif_results 확인)
npx tsx scripts/verify-b1-migrations.ts

# 단위 테스트 전체 (1194개 기준)
pnpm test

# 타입 체크
pnpm tsc --noEmit

# 린트
pnpm lint

# 테스트 계정 재시드 (멱등)
pnpm seed:test-user

# v0.3 프롬프트 재시드 (멱등)
pnpm seed:prompts
```

### DevTools Network 필터 팁

| Flow | 감시할 엔드포인트 |
|---|---|
| F1 로그인 | Supabase Auth `/token` |
| F0 게스트 선체험 | `/api/legal/consent`, `/api/guest/today` |
| F1/F2 무료 부적 | `/api/rewards/session`, `/api/me/wallet` |
| F2 온보딩 | `/api/onboarding` |
| F3 인연 등록 | `/api/relations` |
| F5 케미카드 | `/api/hapcards` (POST, 최초 생성) |
| F6 오늘 홈 | `/api/today` |
| F7 /me | `/api/me/chart` |
| F8 만약에 우리 | `/api/whatif/[type]` |

---

## 부록 D: 자주 발생하는 문제

### "Another next dev server is already running" (Next.js 16)

**증상:** `pnpm dev` 실행 시 포트 3000이 점유되고 부팅 거절.

```
⚠ Port 3000 is in use by process <PID>, using available port 3001 instead.
⨯ Another next dev server is already running.
Run taskkill /PID <PID> /F to stop it.
```

**원인:** 이전 세션의 `next dev` 프로세스가 비정상 종료(터미널 창 닫기, 절전 진입 등)로 포트를 점유한 채 살아남은 orphan 프로세스. Next.js 16 신규 가드가 같은 프로젝트 디렉토리에서 두 번째 서버 시작을 거부한다.

**해결:**

```powershell
# 메시지에 표시된 PID로 교체
taskkill /PID <PID> /F

# 포트 해제 확인 (출력 없으면 PASS)
netstat -ano | Select-String ":3000.*LISTENING"

# 재시도
pnpm dev
```

**예방:**
- `pnpm dev` 종료는 반드시 **`Ctrl+C`** 후 프롬프트 복귀 확인
- 시스템 절전·재시작 전 dev 서버 먼저 종료
- VS Code Integrated Terminal에서 X 버튼으로 창 닫기 시 자식 프로세스가 살아남을 수 있음

---

## 알려진 제약

| 항목 | 상태 |
|---|---|
| Google OAuth | `docs/runbooks/google_oauth.md` 기준 Dashboard Client ID/Secret 설정 후 smoke 필요. Email/Password는 계속 신뢰 |
| 기능 결제 시트 | `/api/payments/feature/init` + `FeaturePaySheet` 기준. Live Toss/Supabase/Vercel env 설정 후 feature 결제 smoke 필요 |
| Playwright 자동화 | `pnpm e2e` 기본 public/protected shell smoke 구성됨. `pnpm e2e:auth`는 `pnpm seed:test-user` 후 seeded email login + authenticated API smoke를 opt-in 실행 |
| KASI_SERVICE_KEY | `.env.example` 과 실제 코드 모두 `KASI_SERVICE_KEY` 사용 |
