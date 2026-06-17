import { NextResponse, type NextRequest } from 'next/server';

import { buildCorsHeaders, isTossPreflightRequest } from '@/lib/toss/cors';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Apps-in-Toss CORS 처리 (/api/* 전용) ──────────────────────────────────
  //
  // 미니앱(Vite SPA, *.apps.tossmini.com / *.private-apps.tossmini.com)이
  // Bearer 토큰으로 /api/* 를 크로스오리진 호출할 때 브라우저가 먼저 OPTIONS
  // preflight 를 보낸다. 이 경우 세션/인증 로직 없이 204 를 즉시 반환한다.
  //
  // 실제 메서드(GET/POST/…) 요청은 updateSession 을 통과시키되,
  // CORS 오리진이 허용 목록에 있으면 응답에 CORS 헤더를 추가한다.
  // 동일 오리진 요청(Origin 헤더 없음 / 자체 도메인)은 완전 무영향.
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');

    // preflight 단락 — 세션 로직 건너뜀
    if (isTossPreflightRequest(request)) {
      const corsHeaders = buildCorsHeaders(origin) ?? {};
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    // 실제 API 요청 — 세션/인증 처리 후 CORS 헤더 주입
    const response = await updateSession(request);
    const corsHeaders = buildCorsHeaders(origin);
    if (corsHeaders) {
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
    }
    return response;
  }

  // ── 그 외 모든 경로 — 기존 세션/리다이렉트 로직 그대로 ───────────────────
  return updateSession(request);
}

export const config = {
  // 정적 자산(이미지·폰트 등)은 미들웨어 인증 리다이렉트에서 제외한다.
  // 미제외 시 /fonts/*·/apps-in-toss/* 같은 public 자산이 307 로 로그인 페이지로
  // 리다이렉트되어 히어로 이미지·한글 폰트·OG 폰트가 깨진다.
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|otf|ttf|woff2?)).*)',
  ],
};
