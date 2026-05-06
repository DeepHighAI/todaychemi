import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database.types';

import { getSupabasePublicConfig } from './env';

// Public paths — 미인증 통과 허용 (login UI / OAuth 콜백 / API 자체 인증 / 정적 자원).
// /_next/* 와 favicon 은 matcher 에서 이미 제외되지만 방어적 가드.
const PUBLIC_PATH_PATTERNS = [
  /^\/login(\/|$|\?)/,
  /^\/auth\//,
  /^\/api\//,
  /^\/_next\//,
  /^\/favicon\.ico$/,
];

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

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATH_PATTERNS.some((p) => p.test(pathname));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
