import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { buildOhaengInterpretation } from '@/lib/hapcard/ohaeng-interpretation';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { OhaengInterpretation } from '@/types/hapcard';

interface HapcardRow {
  hapcard_id: string;
  user_id: string;
  relation_id: string;
  mode: Mode;
  user_chart_hash: string;
  relation_chart_hash: string;
  content: {
    ohaeng_interpretation?: OhaengInterpretation;
  } | null;
}

interface ChartRow {
  chart_core: ChartCore;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (userErr || !userId) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }

  const db = supabase as unknown as SupabaseClient;
  const hapcardRes = await db
    .from('hapcards')
    .select('hapcard_id,user_id,relation_id,mode,user_chart_hash,relation_chart_hash,content')
    .eq('hapcard_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (hapcardRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', hapcardRes.error.message, 500);
  }

  if (!hapcardRes.data) {
    return apiErrorResponse('HAPCARD_NOT_FOUND', `hapcard ${id} not found`, 404);
  }

  const hapcard = hapcardRes.data as HapcardRow;
  if (hapcard.content?.ohaeng_interpretation) {
    return NextResponse.json({
      interpretation: hapcard.content.ohaeng_interpretation,
      source: 'stored',
    });
  }

  const userChartRes = await db
    .from('user_charts')
    .select('chart_core')
    .eq('user_id', userId)
    .eq('chart_hash', hapcard.user_chart_hash)
    .maybeSingle();

  if (userChartRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', userChartRes.error.message, 500);
  }
  if (!userChartRes.data) {
    return apiErrorResponse('USER_CHART_NOT_FOUND', 'user chart not found', 404);
  }

  const relationChartRes = await db
    .from('relation_charts')
    .select('chart_core')
    .eq('relation_id', hapcard.relation_id)
    .eq('chart_hash', hapcard.relation_chart_hash)
    .maybeSingle();

  if (relationChartRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', relationChartRes.error.message, 500);
  }
  if (!relationChartRes.data) {
    return apiErrorResponse('RELATION_CHART_NOT_FOUND', 'relation chart not found', 404);
  }

  const interpretation = buildOhaengInterpretation({
    self: (userChartRes.data as ChartRow).chart_core,
    relation: (relationChartRes.data as ChartRow).chart_core,
    mode: hapcard.mode,
  });

  return NextResponse.json({ interpretation, source: 'rules' });
}
