import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { apiErrorResponse, paymentRequiredResponse } from '@/lib/errors/route-response';
import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
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
  cache_key: string;
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

  const db = supabase;
  const hapcardRes = await db
    .from('hapcards')
    .select('hapcard_id,user_id,relation_id,mode,user_chart_hash,relation_chart_hash,cache_key,content')
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

  // pay-per-use 읽기 게이트 (ADR-039, 모델 C, Phase 7). 미결제 선생성 본문 유출 차단 —
  // 본문이 content 에 저장돼 있거나 rules 로 재계산되더라도 잠금 미해제면 반환하지 않는다.
  const service = createServiceRoleClient();
  if (!(await isFeatureUnlocked(service, userId, 'hapcard', hapcard.cache_key))) {
    return paymentRequiredResponse('hapcard', hapcard.cache_key, FEATURE_PRICES_KRW.hapcard.amount_krw);
  }

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
    self: (userChartRes.data as unknown as ChartRow).chart_core,
    relation: (relationChartRes.data as unknown as ChartRow).chart_core,
    mode: hapcard.mode,
  });

  return NextResponse.json({ interpretation, source: 'rules' });
}
