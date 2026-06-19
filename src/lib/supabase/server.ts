import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

import type { Database } from '@/types/database.types';

import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { getSupabasePublicConfig } from './env';

// Server (RSC / Route Handler / Server Action) Supabase client.
// Pattern: docs/patterns/nextjs15_supabase_ssr.md section 2.
//
// 인증 경로 2가지:
//   1) 웹: Supabase 세션 쿠키 (createServerClient + cookies 어댑터). 기존 동작 그대로.
//   2) 앱인토스 미니앱: `Authorization: Bearer <Supabase access_token>`.
//      iOS WebView 가 서드파티 쿠키를 차단하므로 미니앱은 쿠키 대신 Bearer 를 보낸다
//      (session.ts 설계 메모: "클라이언트는 토큰을 Bearer 로 쓰고 서버는 JWT 를 검증한다").
//      Authorization 헤더가 있으면 그 토큰으로 인증한다:
//        - getUser()(인자 없음) 호출을 Bearer 토큰 검증으로 위임(쿠키 세션이 없어도 user 반환).
//        - global 헤더로 PostgREST(RLS) 도 동일 토큰을 사용 → 데이터 쿼리 권한 일치.
export async function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();

  // ── 미니앱 Bearer 경로 ────────────────────────────────────────────────────
  const authHeader = (await headers()).get('authorization');
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    const client = createServerClient<Database>(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      // 쿠키 미사용 — 세션은 Bearer 토큰에서만 온다.
      cookies: { getAll: () => [], setAll: () => {} },
    });
    // 라우트는 getUser()(인자 없음)를 호출한다. 쿠키 세션이 없으면 null 이 되므로,
    // 인자 없는 호출을 Bearer 토큰 검증(getUser(token))으로 위임한다.
    const getUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = (async (jwt?: string) => {
      const result = await getUser(jwt ?? bearer);
      // 진단: getUser 실패 원인을 식별(만료 vs 서명 vs apikey)한다. 미니앱 만료 토큰 401 의
      // 근본 원인 추적용 — 토큰·PII 는 절대 로그하지 않는다(status/code/sanitized message 만).
      if (result.error) {
        const authError = result.error as { status?: number; code?: string };
        console.warn('[supabase] bearer getUser failed', {
          status: authError.status,
          code: authError.code,
          error: sanitizeErrorForLog(result.error),
        });
      }
      return result;
    }) as typeof client.auth.getUser;
    return client;
  }

  // ── 웹 쿠키 경로 (기존 동작) ──────────────────────────────────────────────
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (err) {
          console.warn('[supabase] cookie setAll failed (expected in RSC)', {
            error: sanitizeErrorForLog(err),
          });
          // RSC: cookies() read-only. middleware refreshes session cookies.
        }
      },
    },
  });
}
