# Authentication Policy Spec

> This document is the single source of truth (SSOT) for authentication policies in the Saju Lens project.
> Changes require §1.1 user approval per CLAUDE.md.

## Providers

| Provider | Status | Notes |
|---|---|---|
| Email/Password | ✅ Active | Primary auth method |
| Google OAuth | ⚠️ Pending | Console permissions issue — separate PR |
| Kakao OAuth | 🚫 Deferred | §1.1 사용자 보류 |

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

- `enable_confirmations = false` — email confirmation email not sent; user is immediately active
- `enable_signup = true` — public sign-up allowed
- Auto-session on successful sign-up (Supabase behavior with confirmations OFF)
- After sign-up → redirect to `/onboarding` to complete profile

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
| `src/app/(auth)/login/page.tsx` | Login UI |
| `src/app/(auth)/signup/page.tsx` | Sign-up UI with inline strength validation |
| `supabase/config.toml` | Local emulator auth config |
| `scripts/seed-test-user.ts` | Test account idempotent seed |
