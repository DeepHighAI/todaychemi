# nextjs15_supabase_ssr.md — Next.js 15/16 + Supabase SSR 패턴

> **패키지**: `@supabase/ssr` v0.5+, `@supabase/supabase-js` v2.45+

---

## 1. 파일 구조

```
src/lib/supabase/
├─ server.ts          # RSC · Server Action · Route Handler용
├─ client.ts          # Client Component용 (브라우저)
├─ middleware.ts       # route/proxy guard helper (cookie refresh optional)
└─ service-role.ts    # Edge Function 내부 · admin 전용
```

---

## 2. server.ts (Server Component / Route Handler)

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component에서는 쿠키 쓰기 불가 (route/proxy guard가 처리)
          }
        },
      },
    }
  );
}
```

---

## 3. client.ts (Client Component)

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

## 4. Route/Proxy Guard (쿠키 갱신)

```typescript
// Next.js 16 proxy 사용 시 src/proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 갱신 (중요: 이 호출 없으면 토큰 만료 후 로그아웃)
  const { data: { user } } = await supabase.auth.getUser();

  // 보호된 경로 리다이렉트
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 5. 사용 예시

```typescript
// app/app/hapcards/page.tsx (Server Component)
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HapcardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: hapcards } = await supabase
    .from('hapcards')
    .select('*')
    .order('created_at', { ascending: false });

  return <HapcardList hapcards={hapcards ?? []} />;
}
```

---

## 6. 주의사항

- Server Component에서는 `cookies()`가 read-only → 세션 갱신은 route/proxy guard에서
- Client Component에서 `createBrowserClient` 재사용 시 싱글톤 패턴 권장 (컴포넌트 외부에 인스턴스 선언)
- `service-role.ts`는 `SUPABASE_SERVICE_ROLE_KEY` 사용 — 클라이언트 번들에 절대 포함 금지
