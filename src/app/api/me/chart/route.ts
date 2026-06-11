import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { ensureUserChartRow } from '@/lib/chart/ensure-user-chart';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    // 현재 theory_profile_version 기준 차트 — 없으면 users 행으로 lazy 재계산 (v2 전환, ADR-021)
    const ensured = await ensureUserChartRow(
      supabase,
      user.id,
      process.env.KASI_SERVICE_KEY ?? '',
    );

    return NextResponse.json({ ok: true, chart: ensured?.chart_core ?? null });
  } catch (err) {
    console.error('[/api/me/chart]', { error: sanitizeErrorForLog(err) });
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
