/**
 * POST /api/toss/consent
 *
 * 앱인토스 미니앱 전용 — Toss 로그인 사용자의 법적 동의(약관·개인정보·연령)를 기록한다.
 *
 * 미니앱은 쿠키를 쓸 수 없어(iOS 서드파티 쿠키 차단) 웹의 쿠키 기반 동의 플로우
 * (/api/legal/consent + osa_legal_consent 쿠키)를 쓸 수 없다. 대신 Bearer 인증으로
 * 사용자를 식별한 뒤 `createClaimedLegalConsentRecord(flow='toss')` 로 auth_user_id 에
 * 직접 동의 행을 기록한다. 이후 /api/onboarding 의 getLatestLegalConsentForUser 가 이를 발견한다.
 *
 * 공유 계약:
 *   요청: { terms: true, privacy: true, age: true } (Authorization: Bearer)
 *   성공: { ok: true, consented_at }
 *   에러: { error: { code, message } }
 *
 * ⚠️ service-role 사용 → Node runtime 전용.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { createClaimedLegalConsentRecord } from '@/lib/legal/server-consent';

export const runtime = 'nodejs';

// 약관·개인정보·연령 동의 — 셋 다 true 만 허용(웹 LegalConsentRequestSchema 와 동일 의미).
const TossConsentSchema = z
  .object({
    terms: z.literal(true),
    privacy: z.literal(true),
    age: z.literal(true),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Zod 검증
  const parsed = TossConsentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiErrorResponse('INVALID_BODY', 'legal consent required', 400);
  }

  // 2. Bearer 인증 — 미니앱은 쿠키 불가, Authorization 헤더의 토큰으로 직접 getUser.
  const bearerToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearerToken) {
    return apiErrorResponse('UNAUTHORIZED', 'Authorization header required', 401);
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(bearerToken);

  if (authError || !user) {
    return apiErrorResponse('UNAUTHORIZED', 'invalid or expired token', 401);
  }

  // 3. 동의 기록 — flow='toss', auth_user_id 직접 기록(쿠키 불요).
  try {
    const consent = await createClaimedLegalConsentRecord({
      serviceClient: createServiceRoleClient(),
      flow: 'toss',
      userId: user.id,
    });
    return NextResponse.json(
      { ok: true, consented_at: consent.consentedAt },
      { status: 200 },
    );
  } catch (err) {
    console.error('[/api/toss/consent]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
