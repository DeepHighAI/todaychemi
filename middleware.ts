import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 보호 대상: /app/** + 정적 자원 / favicon 제외 전체.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
