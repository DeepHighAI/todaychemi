import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database.types';

import { getSupabasePublicConfig } from './env';

// Public paths — 미인증 통과 허용 (login UI / OAuth 콜백 / API 자체 인증 / 정적 자원).
// /_next/* 와 favicon 은 matcher 에서 이미 제외되지만 방어적 가드.
const PUBLIC_PATH_PATTERNS = [
  /^\/start(\/|$|\?)/,
  /^\/guest\//,
  /^\/login(\/|$|\?)/,
  /^\/signup(\/|$|\?)/,
  /^\/onboarding(\/|$|\?)/,
  /^\/today\/me(\/|$|\?)/,
  /^\/auth\//,
  /^\/h\//,
  /^\/legal(\/|$|\?)/,
  /^\/privacy(\/|$|\?)/,
  /^\/terms(\/|$|\?)/,
  /^\/api\//,
  /^\/_next\//,
  /^\/favicon\.ico$/,
];

const AUTH_LOOKUP_TIMEOUT_MS = 3000;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
}

function sanitizeInternalPath(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function resolveAuthenticatedLoginNext(request: NextRequest): URL {
  const next = sanitizeInternalPath(request.nextUrl.searchParams.get('next'));
  if (!next) return new URL('/', request.url);

  const nextUrl = new URL(next, request.url);
  if (nextUrl.pathname === '/login' || nextUrl.pathname === '/signup' || nextUrl.pathname === '/start') {
    return new URL('/', request.url);
  }

  return nextUrl;
}

// Middleware helper — refresh Supabase auth cookies on every request.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 4.
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicConfig();
  let supabaseResponse = NextResponse.next({ request });
  let user: { id: string } | null = null;

  if (hasSupabaseAuthCookie(request)) {
    const { createServerClient } = await import('@supabase/ssr');
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

    // 세션 갱신. 원격 Auth 지연 시 보호 경로는 로그인으로 보내고 공개 경로는 통과시킨다.
    user = await Promise.race([
      supabase.auth
        .getUser()
        .then(({ data }) => data.user ?? null)
        .catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_LOOKUP_TIMEOUT_MS)),
    ]);
  }

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATH_PATTERNS.some((p) => p.test(pathname));

  if (user && pathname === '/start') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(resolveAuthenticatedLoginNext(request));
  }

  if (user && pathname === '/signup') {
    if (request.nextUrl.searchParams.get('intent') === 'guest') {
      return NextResponse.redirect(new URL('/guest/complete', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!user && pathname === '/') {
    return NextResponse.redirect(new URL('/start', request.url));
  }

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search); // 목적지 보존
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
