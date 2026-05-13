import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { fetchLatestUserChart } from '@/lib/chart/queries';
import { createClient } from '@/lib/supabase/server';
import type { ChartCore } from '@/types/chart';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const { data, error } = await fetchLatestUserChart(supabase, user.id);

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', '', 500);
    }

    const chart = data ? ((data as unknown as { chart_core: ChartCore }).chart_core) : null;
    return NextResponse.json({ ok: true, chart });
  } catch (err) {
    console.error('[/api/me/chart]', err);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
