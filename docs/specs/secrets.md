# Secrets & Environment Variables Catalog

> 본 문서는 환경변수 전체 목록과 민감도, 취득 방법, Vercel 등록 절차를 기술한다.
> `.env` 파일은 절대 git commit 금지. `.gitignore`에 `.env*` 등록 필수.

---

## 1. 환경변수 목록

| Variable | Purpose | Sensitivity | How to obtain |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Low (public) | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 anon key | Low (public) | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버 서비스 role key (RLS 우회) | **Critical** | Supabase Dashboard → Project Settings → API |
| `SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID` | Supabase local Kakao OAuth REST API key | High | Kakao Developers → App keys |
| `SUPABASE_AUTH_EXTERNAL_KAKAO_SECRET` | Supabase local Kakao OAuth client secret | **Critical** | Kakao Developers → Kakao Login → Security |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | KakaoTalk Share JavaScript key | Low (public) | Kakao Developers → App keys |
| `KAKAO_ADMIN_KEY` | KakaoTalk Share callback Authorization key | **Critical** | Kakao Developers → App keys |
| `OPENAI_API_KEY` | OpenAI API 인증 (GPT-5/GPT-5 mini) | **Critical** | platform.openai.com → API Keys |
| `OPENAI_PROJECT_ID` | OpenAI 프로젝트 ID (ZDR 적용 프로젝트) | High | platform.openai.com → Settings → Projects |
| `ANTHROPIC_API_KEY` | Anthropic Claude fallback 인증 | **Critical** | console.anthropic.com → API Keys |
| `KASI_API_KEY` | 한국천문연구원 API (만세력 기준) | High | astro.kasi.re.kr → API 신청 |
| `TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 | Medium (public) | 토스페이먼츠 대시보드 → 개발자 도구 |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (서버 전용) | **Critical** | 토스페이먼츠 대시보드 → 개발자 도구 |
| `TOSS_PAYMENTS_CLIENT_KEY` | 임시 legacy alias | Medium (public) | 기존 환경 호환용 |
| `TOSS_PAYMENTS_SECRET_KEY` | 임시 legacy alias | **Critical** | 기존 환경 호환용 |
| `SENTRY_DSN` | Sentry 에러 수집 DSN | Medium | sentry.io → Project → Settings → DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | 브라우저 Sentry 에러 수집 DSN | Low (public) | sentry.io → Project → Settings → DSN |
| `LLM_DAILY_BUDGET_USD` | LLM 일일 예산 상한 (초과 시 fallback 차단) | Low | 직접 설정 (예: `20`) |
| `BUBBLEWRAP_KEYSTORE_PATH` | TWA APK 서명용 keystore 파일 경로 | **Critical** | `keytool -genkey` 로 생성 (Phase 0 G5+) |
| `BUBBLEWRAP_KEYSTORE_PASSWORD` | Bubblewrap keystore 패스워드 | **Critical** | keystore 생성 시 설정 |

---

## 2. 민감도 분류 기준

| 등급 | 설명 | 예시 |
|---|---|---|
| **Critical** | 유출 시 즉각적 금전 피해 또는 데이터 침해 | API keys, secret keys, keystore |
| **High** | 유출 시 서비스 운영 중단 또는 간접 피해 | Project ID, KASI key |
| **Medium** | 유출 시 이상 사용 가능성, 모니터링 필요 | TOSS_CLIENT_KEY, SENTRY_DSN |
| **Low (public)** | `NEXT_PUBLIC_*` — 브라우저에 노출되는 값 | Sentry browser DSN, Supabase URL |

> `NEXT_PUBLIC_*` 변수는 번들에 포함되어 클라이언트에 노출됨. 절대 비밀값 사용 금지.

---

## 3. Vercel 환경 등록

### 3개 환경 구성

| Vercel 환경 | 용도 | 분기 |
|---|---|---|
| Production | 실 서비스 | `main` 브랜치 |
| Preview | PR 리뷰, QA | `feature/*`, `fix/*` 등 |
| Development | `vercel dev` 로컬 실행 | 로컬 |

### Vercel CLI 등록 절차

```bash
# 프로젝트 최초 연결 (1회)
npx vercel link

# 환경변수 등록 (각 변수마다 환경 선택)
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
npx vercel env add OPENAI_API_KEY production
npx vercel env add OPENAI_API_KEY preview

# 로컬 개발용 .env.local 자동 생성
npx vercel env pull .env.local
```

### Vercel 대시보드 등록 절차

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. 변수명, 값, 적용 환경(Production/Preview/Development) 선택
3. "Save" 클릭
4. 민감 변수는 "Sensitive" 체크박스 활성화 (마스킹)

---

## 4. 로컬 개발 환경 설정

### .env.local 파일 (git 제외)

```bash
# .env.local — 절대 커밋 금지
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
OPENAI_API_KEY=sk-proj-...
OPENAI_PROJECT_ID=proj_...
ANTHROPIC_API_KEY=sk-ant-...
KASI_API_KEY=...
TOSS_CLIENT_KEY=test_ck_...              # 개발: test_ 접두사
TOSS_SECRET_KEY=test_sk_...              # 개발: test_ 접두사
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
LLM_DAILY_BUDGET_USD=5                   # 개발 환경 낮은 예산
```

### Sandbox vs Production 키 구분

- 토스페이먼츠: 개발/테스트 시 `test_ck_*` / `test_sk_*` 사용 (실결제 없음)
- 운영 배포 시 `live_ck_*` / `live_sk_*` 으로 교체 (Vercel Production 환경에만 등록)
- OpenAI: 개발 환경에서 `LLM_DAILY_BUDGET_USD` 낮게 설정하여 비용 제어

---

## 5. 키 로테이션 절차

### 즉시 로테이션이 필요한 경우

- 키가 git history에 노출된 경우
- 팀원 이탈 시
- 이상 사용량 감지 시 (Sentry `INTERNAL` 급증, OpenAI 비용 급증)

### 로테이션 절차

1. 새 키 발급 (각 서비스 대시보드)
2. Vercel 환경변수 업데이트 (Production → Preview → Development 순)
3. `npx vercel env pull .env.local` 로 로컬 갱신
4. 기존 키 즉시 폐기 (각 서비스 대시보드에서 revoke)
5. Vercel 재배포 트리거 (`npx vercel --force`)
6. 로테이션 완료 후 모니터링 1시간 (`/canary` 스킬 실행)

### 정기 로테이션 일정

| 키 | 주기 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 90일 |
| `SUPABASE_AUTH_EXTERNAL_KAKAO_SECRET` | 180일 |
| `KAKAO_ADMIN_KEY` | 180일 |
| `OPENAI_API_KEY` | 90일 |
| `ANTHROPIC_API_KEY` | 90일 |
| `TOSS_SECRET_KEY` | 출시 전 1회 + 180일 |
| `BUBBLEWRAP_KEYSTORE_PASSWORD` | Play 스토어 업로드 key 분리 후 검토 |

---

## 6. 보안 주의사항

- `SUPABASE_SERVICE_ROLE_KEY`: RLS를 우회하므로 서버 컴포넌트 / Route Handler 외부 노출 절대 금지
- `KAKAO_ADMIN_KEY`: `/api/share/kakao/callback` Authorization 검증 전용. `NEXT_PUBLIC_` prefix 금지
- `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`: 브라우저 노출 전제의 public key이며 secret/admin key와 혼동 금지
- `OPENAI_API_KEY`: ZDR(Zero Data Retention) 적용 프로젝트(`OPENAI_PROJECT_ID`) 연결 필수 (CLAUDE.md §5)
- `BUBBLEWRAP_KEYSTORE_*`: Google Play 서명 키는 분실 시 앱 업데이트 불가. 암호화된 오프라인 백업 필수
- Toss 일반 결제 webhook은 최신 TossPayments V2 기준으로 HMAC secret 검증 대상이 아니다. 환불·취소 자동화 활성화 시 webhook payload의 `paymentKey`로 Toss 결제 조회 API를 다시 호출해 상태를 검증한다.
