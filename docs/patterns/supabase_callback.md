# supabase_callback.md — Supabase Auth Callback 라우트

> **용도**: Google OAuth, Kakao OAuth 공통 콜백

---

## 1. 콜백 라우트

```typescript
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Anonymous → 회원 전환 처리 (§6.9)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await migrateAnonymousProfile(supabase, user.id);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 에러 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

async function migrateAnonymousProfile(supabase: SupabaseClient, userId: string) {
  // anonymous 세션에서 생성된 데이터를 신규 user_id로 마이그레이션
  // (실제 구현은 Edge Function migrate-anonymous-profile 호출)
}
```

---

## 2. Google OAuth 시작

```typescript
// src/lib/auth/google.ts
import type { LegalConsentState } from '@/lib/legal/consent';
import { signInWithOAuthProvider } from '@/lib/auth/oauth';

export async function signInWithGoogle(legalConsent: LegalConsentState) {
  await signInWithOAuthProvider('google', legalConsent);
}
```

---

## 2.1 Kakao OAuth 시작

```typescript
// src/lib/auth/kakao.ts
import type { LegalConsentState } from '@/lib/legal/consent';
import { signInWithOAuthProvider } from '@/lib/auth/oauth';

export async function signInWithKakao(legalConsent: LegalConsentState) {
  await signInWithOAuthProvider('kakao', legalConsent);
}
```

---

## 3. Supabase Dashboard 설정

```
Authentication → URL Configuration:
  Site URL: https://<production-domain>
  Redirect URLs:
    https://<production-domain>/auth/callback
    https://staging.<domain>/auth/callback
    http://localhost:3000/auth/callback

Authentication → Providers → Google:
  Client ID: <Google Cloud Console OAuth Client ID>
  Client Secret: <Google Cloud Console OAuth Client Secret>

Authentication → Providers → Kakao:
  Client ID: <Kakao REST API key>
  Client Secret: <Kakao client secret>
  Allow users without an email: enabled

Google Cloud Console → Authorized redirect URIs:
  https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback
  http://127.0.0.1:54321/auth/v1/callback

Kakao Developers → Redirect URI:
  https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback
  http://127.0.0.1:54321/auth/v1/callback
```

---

## 4. TWA Deep Link 처리

TWA 환경에서 `/auth/callback`으로 Custom Tabs → 앱 복귀:

```json
// public/.well-known/assetlinks.json
// TWA가 https://<domain>/auth/callback 을 앱으로 intercept
```

`twa_bubblewrap.md` 참조.

---

## 5. 에러 처리

| 에러 | 원인 | 처리 |
|---|---|---|
| `auth_callback_failed` | code 교환 실패 | 로그인 재시도 안내 |
| `provider_disabled` | OAuth provider 비활성 | Supabase Dashboard 확인 |
| TWA redirect 실패 | assetlinks.json 미설정 | `twa_bubblewrap.md` §7 체크리스트 |
