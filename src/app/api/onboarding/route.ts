import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiErrorResponse } from '@/lib/errors/route-response';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { OnboardingRequestSchema } from '@/types/onboarding';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import { computeChart } from '@/lib/chart/compute';
import { resolveLegalConsentForOnboarding } from '@/lib/legal/server-consent';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = OnboardingRequestSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const legalConsent = await resolveLegalConsentForOnboarding({
    serviceClient: createServiceRoleClient(),
    cookieStore: await cookies(),
    userId: user.id,
  });
  if (!legalConsent) return apiErrorResponse('LEGAL_CONSENT_REQUIRED', '', 403);

  // chart compute 먼저 — 성공 시에만 users INSERT (partial state 방지)
  let computeResult;
  try {
    computeResult = await computeChart(
      {
        entity_id: user.id,
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
  } catch {
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }

  // builder.ts 패턴 동일: Zod 검증 완료 후 untyped client로 INSERT (users 테이블 타입 해소 우회)
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from('users').insert({
    user_id: user.id,
    nickname: parsed.data.nickname,
    birth_date: parsed.data.birth_date,
    birth_date_calendar: parsed.data.birth_date_calendar,
    is_lunar_leap: parsed.data.is_lunar_leap,
    birth_time_knowledge: parsed.data.birth_time_knowledge,
    birth_time: parsed.data.birth_time,
    gender: parsed.data.gender,
    consented_at: legalConsent.consentedAt,
    consented_tos_version: legalConsent.termsVersion,
    consented_privacy_version: legalConsent.privacyVersion,
    age_confirmed: legalConsent.ageConfirmed,
  });

  if (error) {
    if (error.code === '23505') return apiErrorResponse('USER_ALREADY_ONBOARDED', '', 409);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }

  const { error: chartError } = await db.from('user_charts').upsert(
    {
      user_id: user.id,
      chart_hash: computeResult.chart_hash,
      chart_core: computeResult.chart_core,
      theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    },
    { onConflict: 'chart_hash' },
  );
  if (chartError) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  return NextResponse.json({ ok: true });
}
