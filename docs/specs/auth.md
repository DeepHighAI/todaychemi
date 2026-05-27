# Authentication Policy Spec

> This document is the single source of truth (SSOT) for authentication policies in the TWODAY project.
> Changes require §1.1 user approval per CLAUDE.md.

## Providers

| Provider | Status | Notes |
|---|---|---|
| Email/Password | ✅ Active | Primary auth method |
| Google OAuth | ⚠️ Remote secret required | App flow implemented; Dashboard setup follows `docs/runbooks/google_oauth.md` |
| Kakao OAuth | ⚠️ Remote secret required | App flow implemented; Dashboard/Kakao setup required |

## Password Policy

Enforced at two layers:

1. **Supabase config** (`supabase/config.toml`) — server enforcement
   - `minimum_password_length = 8`
   - `password_requirements = "letters_digits"` (영문 + 숫자 조합 필수)

2. **Application layer** (`src/lib/auth/password-policy.ts`) — client-side pre-check
   - Matches Supabase config: ≥8 chars, at least 1 letter and 1 digit
   - Returns typed error codes: `'tooShort'` | `'missingClasses'`

> Remote project (`jamhkucluhiibqpjsiov`) requires **manual Dashboard sync**:
> Authentication → Policies → Minimum password length: 8 / Requirements: "Letters and digits"

## Rate Limits

Configured in `supabase/config.toml` `[auth.rate_limit]`:

| Limit | Value | Scope |
|---|---|---|
| `sign_in_sign_ups` | 10 per 5 min | per IP |
| `token_refresh` | 150 per 5 min | per IP |
| `token_verifications` | 30 per 5 min | per IP |
| `email_sent` | 2 per hour | total |

No application-layer rate limiting (Supabase-only, per §1.1 Q2.A decision 2026-05-07).

> Remote sync: Authentication → Rate Limits → Sign-in/up: 10

## Sign-Up Flow

- 미로그인 사용자가 `/`에 접근하면 `/start`로 이동한다.
- `/start`는 `처음이세요?` → 게스트 선체험, `우리 만난 적 있죠?` → `/login`을 제공한다. 인증 세션이 있으면 `/start`는 `/`로 보낸다.
- `enable_confirmations = false` — email confirmation email not sent; user is immediately active
- `enable_signup = true` — public sign-up allowed
- Auto-session on successful sign-up (Supabase behavior with confirmations OFF)
- Before email sign-up, `/signup` requires all three legal confirmations: Terms, Privacy Policy, and age 14+.
- Email sign-up first calls `POST /api/legal/consent`, which stores a service-role `legal_consents` row and sets the HttpOnly `osa_legal_consent` nonce cookie. Auth `user_metadata` is not treated as legal evidence.
- After sign-up → redirect to `/onboarding` to complete profile
- `/api/onboarding` claims or reads the latest server consent record and stores `public.users.consented_tos_version`, `public.users.consented_privacy_version`, `public.users.consented_at`, and `public.users.age_confirmed`. Missing or stale server consent returns `LEGAL_CONSENT_REQUIRED`.
- Free talisman signup reward is paid after onboarding creates `public.users`: `bonus +5` for auth users created on/after `2026-05-25T00:00:00+09:00`.
- Daily login reward is paid by the authenticated app-entry gate: KST daily `bonus +1` via `POST /api/rewards/session`.

## Guest Preview Flow

- 신규 유저는 가입 전 `POST /api/legal/consent` `flow='guest'`로 약관, 개인정보처리방침, 만 14세 이상 동의를 먼저 기록한다.
- Guest consent nonce cookie TTL은 24시간이다. Email/OAuth consent TTL은 기존처럼 30분이다.
- Supabase anonymous auth는 사용하지 않는다. 게스트 온보딩 입력과 오늘 결과는 현재 탭 `sessionStorage`에만 저장한다.
- `/api/guest/today`는 guest legal cookie와 `OnboardingRequest`를 검증한 뒤 차트 계산과 **오늘 나의 흐름** 생성을 수행한다. `users`, `user_charts`, `daily_haps`에는 쓰지 않는다.
- `/today/me`의 `친구와의 오늘 우리는 보기` CTA는 `/signup?intent=guest`로 이동한다.
- 게스트 전환 가입은 email, Google, Kakao를 모두 지원한다. 가입 후 `/guest/complete`가 `sessionStorage`의 게스트 온보딩 입력을 인증된 `/api/onboarding`에 저장하고 `/relations/new`로 이동한다.
- 게스트 입력이 없거나 server consent가 만료되면 `/start`에서 다시 시작한다.

## Google OAuth Flow

- **오늘사이 로그인**: `/login` → `Google로 시작하기`
- OAuth start is blocked until Terms, Privacy Policy, and age 14+ are checked.
- OAuth start: `src/lib/auth/google.ts`
- Callback: `/auth/callback` exchanges the Supabase code and claims the HttpOnly legal consent nonce for the authenticated user. Unsigned callback query params are ignored.
- Success redirect: `/` 홈의 **오늘의 사이**
- 게스트 전환 시 OAuth callback은 `next=/guest/complete`를 보존한다.
- Remote setup and smoke test: `docs/runbooks/google_oauth.md`

## Kakao OAuth Flow

- **오늘사이 로그인**: `/login` → `카카오로 시작하기`
- OAuth start is blocked until Terms, Privacy Policy, and age 14+ are checked.
- OAuth start: `src/lib/auth/kakao.ts`
- Callback: `/auth/callback` (Google과 같은 Supabase PKCE exchange route) claims the server-owned legal consent record.
- Success redirect: `/` 홈의 **오늘의 사이**
- 게스트 전환 시 OAuth callback은 `next=/guest/complete`를 보존한다.
- Kakao `account_email`은 기본 요구하지 않는다. Supabase Kakao provider에서 "Allow users without an email"을 켠다.
- Kakao profile/email/provider token은 로그인 식별에만 사용하며 LLM payload, share payload, public share page, OG image에는 직렬화하지 않는다.

## Test Account

| Field | Value |
|---|---|
| Email | `Test1@test.com` |
| Password | `test1234` (8 chars, letters+digits — passes policy) |
| Seeded via | `pnpm seed:test-user` (admin.createUser, bypasses policy) |
| Production use | ✅ Intended for QA and demo purposes |

## Key Files

| File | Purpose |
|---|---|
| `src/lib/auth/password-policy.ts` | Policy constants + `validatePassword()` |
| `src/lib/auth/email.ts` | `signInWithEmail`, `signUpWithEmail`, `WeakPasswordError` |
| `src/lib/auth/google.ts` | `signInWithGoogle` OAuth entry |
| `src/lib/auth/kakao.ts` | `signInWithKakao` OAuth entry |
| `src/lib/legal/consent.ts` | Legal version constants + consent state helpers |
| `src/lib/legal/server-consent.ts` | Server-owned legal consent nonce/hash/cookie helpers |
| `src/app/api/legal/consent/route.ts` | Legal consent record creation + HttpOnly nonce cookie |
| `src/app/auth/callback/route.ts` | Supabase OAuth code exchange |
| `src/app/(auth)/login/page.tsx` | Login UI + required OAuth consent block |
| `src/app/(auth)/signup/page.tsx` | Sign-up UI with inline strength validation + required legal consent |
| `src/app/start/page.tsx` | Public 신규/기존 분기 시작 화면 |
| `src/app/guest/start/page.tsx` | Guest legal consent entry |
| `src/app/api/guest/today/route.ts` | Guest-only 오늘 나의 흐름 API |
| `src/app/today/me/page.tsx` | Guest 오늘 나의 흐름 result page |
| `src/app/guest/complete/page.tsx` | Guest → authenticated onboarding migration |
| `src/app/legal/terms/page.tsx` | Public Terms page rendered from `docs/legal/terms_of_service.md` |
| `src/app/legal/privacy/page.tsx` | Public Privacy Policy page rendered from `docs/legal/privacy_policy.md` |
| `src/app/api/rewards/session/route.ts` | Free talisman session reward route |
| `src/components/rewards/free-talisman-reward-gate.tsx` | Invisible authenticated app-entry reward gate |
| `supabase/config.toml` | Local emulator auth config |
| `scripts/seed-test-user.ts` | Test account idempotent seed |
