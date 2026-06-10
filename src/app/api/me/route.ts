import { NextResponse } from 'next/server';
import type { Json } from '@/types/database.types';

import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { MeUpdateRequestSchema } from '@/types/me';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import { computeChart } from '@/lib/chart/compute';
import { todayKST } from '@/lib/today/kst-date';

// GET /api/me — Drawer 사전 채움용 프로필 조회 (PII는 본인 RLS row만, LLM 미경유)
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

    const db = supabase;
    const { data, error } = await db
      .from('users')
      .select('nickname, birth_date, birth_date_calendar, is_lunar_leap, birth_time_knowledge, birth_time, gender')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);
    if (!data) return apiErrorResponse('NOT_ONBOARDED', '', 404);

    return NextResponse.json({ ok: true, profile: data });
  } catch (err) {
    console.error('[GET /api/me]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

// PATCH /api/me — 온보딩 7필드 재기입 (legal consent fields 제외)
// 순서: compute → UPDATE users → upsert user_charts → DELETE today daily_haps
export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = MeUpdateRequestSchema.safeParse(json);
  if (!parsed.success) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  // 온보딩 여부 확인 — users row 없으면 404
  const db = supabase;
  const { data: existing, error: existingError } = await db
    .from('users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingError) return apiErrorResponse('INTERNAL_ERROR', '', 500);
  if (!existing) return apiErrorResponse('NOT_ONBOARDED', '', 404);

  // KASI compute (LLM 미호출, 결정형)
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

  // users UPDATE (legal consent fields 는 건드리지 않음)
  const { error: updateError } = await db
    .from('users')
    .update({
      nickname: parsed.data.nickname,
      birth_date: parsed.data.birth_date,
      birth_date_calendar: parsed.data.birth_date_calendar,
      is_lunar_leap: parsed.data.is_lunar_leap,
      birth_time_knowledge: parsed.data.birth_time_knowledge,
      birth_time: parsed.data.birth_time,
      gender: parsed.data.gender,
    })
    .eq('user_id', user.id);
  if (updateError) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  // user_charts upsert — 동일 chart_hash면 no-op, 다르면 신규 row INSERT
  // old row 보존 → 과거 hapcards FK 무결성 유지 (ADR-016)
  const { error: chartError } = await db.from('user_charts').upsert(
    {
      user_id: user.id,
      chart_hash: computeResult.chart_hash,
      chart_core: computeResult.chart_core as unknown as Json,
      theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    },
    { onConflict: 'chart_hash' },
  );
  if (chartError) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  // 오늘 daily_haps 캐시 무효화 — 새 chart 반영을 위해 오늘 row 삭제
  await db
    .from('daily_haps')
    .delete()
    .eq('user_id', user.id)
    .eq('target_date', todayKST());

  return NextResponse.json({ ok: true, chart_hash: computeResult.chart_hash });
}
