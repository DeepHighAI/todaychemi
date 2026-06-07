import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import { OnboardingRequestSchema } from '@/types/onboarding';
import { computeChart } from '@/lib/chart/compute';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { createOpenAiClient } from '@/lib/llm/clients';
import { resolveGuestLegalConsentFromCookie } from '@/lib/legal/server-consent';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildDailyHap } from '@/lib/today/builder';
import { callDailyHapLlm } from '@/lib/today/openai';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

export async function POST(request: Request) {
  const parsed = OnboardingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const guestConsent = await resolveGuestLegalConsentFromCookie({
    serviceClient: createServiceRoleClient(),
    cookieStore: await cookies(),
  });
  if (!guestConsent) return apiErrorResponse('LEGAL_CONSENT_REQUIRED', '', 403);

  let computeResult;
  try {
    computeResult = await computeChart(
      {
        entity_id: 'guest',
        birth_date: parsed.data.birth_date,
        birth_date_calendar: parsed.data.birth_date_calendar,
        is_lunar_leap: parsed.data.is_lunar_leap,
        birth_time_knowledge: parsed.data.birth_time_knowledge,
        birth_time: parsed.data.birth_time,
        gender: parsed.data.gender,
        theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
      },
      process.env.KASI_SERVICE_KEY!,
    );
  } catch (err) {
    console.error('[POST /api/guest/today] compute failed', {
      error: sanitizeErrorForLog(err),
    });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }

  try {
    const openai = createOpenAiClient();
    // 게스트는 인연 등록 자체가 불가 → relation 경로 미사용 (relation=null 고정).
    // Task 2 / ADR-008: prompt fetch 용 service-role client + 고정 sentinel userId.
    // (게스트 세션은 익명이라 deterministic sampling 대상 외 — fixed seed 로 일관 노출.)
    const promptClient = createServiceRoleClient();
    const guestUserId = '__guest__';
    const card = await buildDailyHap({
      fetchTodayCache: async () => null,
      fetchYesterdayCache: async () => null,
      fetchUserChart: async () => computeResult.chart_core,
      fetchRelation: async () => null,
      fetchRelationChart: async () => null,
      callLlm: (input) => callDailyHapLlm(input, openai, promptClient, guestUserId),
      saveCard: async () => undefined,
      today_date: computeResult.chart_core.yunse.iliun.today_date,
    });

    return NextResponse.json({
      ok: true,
      card,
      chart: computeResult.chart_core,
    });
  } catch (err) {
    console.error('[POST /api/guest/today]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
