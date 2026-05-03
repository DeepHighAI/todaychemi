import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database.types';

import { getSupabasePublicConfig } from './env';

// Middleware helper — refresh Supabase auth cookies on every request.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 4.
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicConfig();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // 세션 갱신 (이 호출 없으면 토큰 만료 후 강제 로그아웃 발생)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 보호된 경로: /app/** — 미인증 시 /login 으로 리다이렉트.
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
