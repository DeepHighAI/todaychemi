/**
 * POST /api/toss/login
 *
 * Apps-in-Toss 로그인 브릿지 (Option A).
 *
 * 흐름:
 *   1. Zod 로 { authorizationCode, referrer } 검증
 *   2. exchangeAuthCode (mTLS) → Toss accessToken
 *   3. fetchLoginMe (mTLS) → userKey (PII 불필요 — userKey 만 추출)
 *   4. findOrCreateSupabaseUserForTossUserKey → Supabase 세션 민팅
 *   5. { access_token, refresh_token, expires_at } 반환
 *
 * ⚠️ PII 로깅 금지 (CLAUDE.md §5, ADR-040 §5).
 *    authorizationCode / userKey / 이메일 등을 로그에 남기지 않는다.
 *
 * 출처: 구현 레퍼런스 §2.9(E2E 시퀀스), §7.1(auth surface)
 */

export const runtime = 'nodejs'; // mTLS = Node https 전용

import { z } from 'zod';
import { NextResponse } from 'next/server';

import { exchangeAuthCode, fetchLoginMe } from '@/lib/toss/login';
import { findOrCreateSupabaseUserForTossUserKey } from '@/lib/toss/session';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

// ---------------------------------------------------------------------------
// 요청 스키마
// ---------------------------------------------------------------------------

const LoginBodySchema = z.object({
  /** appLogin() 반환값 — 유효 10분, 일회성 */
  authorizationCode: z.string().min(1),
  /** appLogin() 반환값 그대로 서버 전달 */
  referrer: z.enum(['DEFAULT', 'SANDBOX']),
});

// ---------------------------------------------------------------------------
// POST 핸들러
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ── 1. 요청 바디 파싱 + 검증 ─────────────────────────────────────────────
  const json = await request.json().catch(() => null);
  const parsed = LoginBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse('INVALID_BODY', 'authorizationCode 와 referrer 가 필요합니다', 400);
  }

  const { authorizationCode, referrer } = parsed.data;

  // 실패 단계 마커 — Vercel 로그에서 mTLS/토스API/Supabase 중 어디서 깨졌는지 식별용.
  let stage: 'token_exchange' | 'fetch_user_key' | 'mint_session' = 'token_exchange';

  try {
    // ── 2. Toss 토큰 교환 (mTLS) ─────────────────────────────────────────
    const tossToken = await exchangeAuthCode({ authorizationCode, referrer });

    // ── 3. userKey 조회 (mTLS) ──────────────────────────────────────────
    stage = 'fetch_user_key';
    const loginMe = await fetchLoginMe(tossToken.accessToken);
    const { userKey } = loginMe; // PII 필드는 접근하지 않는다

    // ── 4. Supabase 세션 민팅 ────────────────────────────────────────────
    stage = 'mint_session';
    const session = await findOrCreateSupabaseUserForTossUserKey(userKey);

    // ── 5. 미니앱에 세션 반환 ────────────────────────────────────────────
    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    });
  } catch (err) {
    // Toss API 에러 구조체 판별
    const tossErr = err as { kind?: string; errorCode?: string };

    // 진단 로깅 — PII(authorizationCode/userKey/email) 금지(§5). sanitize 거친 메시지만.
    console.error('[POST /api/toss/login]', {
      stage,
      kind: tossErr.kind,
      errorCode: tossErr.errorCode,
      error: sanitizeErrorForLog(err),
    });

    if (tossErr.kind === 'toss_api_error') {
      const code = tossErr.errorCode ?? 'TOSS_API_ERROR';

      // invalid_grant: 코드 만료·재사용 (§2.3)
      if (code === 'invalid_grant') {
        return apiErrorResponse('INVALID_BODY', '인증 코드가 만료되었거나 이미 사용되었습니다', 400);
      }

      // 사용자 정보 미존재 (§2.5 서버 에러코드)
      if (code === 'USER_NOT_FOUND' || code === 'USER_KEY_NOT_FOUND') {
        return apiErrorResponse('UNAUTHORIZED', '사용자 정보를 찾을 수 없습니다', 401);
      }

      // 기타 Toss API 에러
      return apiErrorResponse('INTERNAL_ERROR', '', 502);
    }

    // 환경변수 누락 등 설정 오류
    if ((err as Error).message?.includes('환경변수')) {
      return apiErrorResponse('INTERNAL_ERROR', '', 500);
    }

    // 기타 서버 내부 오류
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
