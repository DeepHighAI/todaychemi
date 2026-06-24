import { NextResponse, type NextRequest } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { getHapcardCacheKey, type BuildHapcardInput } from '@/lib/hapcard/builder';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { previewFeatureCharge, toPreflightJson } from '@/lib/payments/feature-preflight';
import {
  fetchLatestRelationChartForVersion,
  fetchLatestUserChartForVersion,
} from '@/lib/chart/queries';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ensureRelationChartRow } from '@/lib/today/lazy-relation-chart';
import { todayKST } from '@/lib/today/kst-date';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { HapcardRequestSchema, type HapcardRequest } from '@/types/hapcard';
import type { ChartCore } from '@/types/chart';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

export async function POST(request: NextRequest) {
  let body: HapcardRequest;
  try {
    const raw = await request.json();
    const parsed = HapcardRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', parsed.error.message, 400);
    }
    body = parsed.data;
  } catch {
    return apiErrorResponse('INVALID_BODY', 'JSON parse failed', 400);
  }

  const supabaseUserClient = await createServerClient();
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  const [userChartRes, relationChartRes] = await Promise.all([
    fetchLatestUserChartForVersion(supabaseUserClient, userId, body.theory_profile_version),
    fetchLatestRelationChartForVersion(supabaseUserClient, body.relation_id, body.theory_profile_version),
  ]);

  if (userChartRes.error) {
    return apiErrorResponse('USER_CHART_LOOKUP_FAILED', userChartRes.error.message, 500);
  }
  if (!userChartRes.data) {
    return apiErrorResponse(
      'USER_CHART_NOT_FOUND',
      `user chart for theory_profile_version=${body.theory_profile_version} not found`,
      404,
    );
  }

  if (relationChartRes.error) {
    return apiErrorResponse('RELATION_CHART_LOOKUP_FAILED', relationChartRes.error.message, 500);
  }
  let relationChart = relationChartRes.data as unknown as ChartRow | null;
  if (!relationChart) {
    try {
      relationChart = await ensureRelationChartRow(
        supabaseUserClient,
        body.relation_id,
        userId,
        process.env.KASI_SERVICE_KEY ?? '',
        body.theory_profile_version,
      ) as unknown as ChartRow | null;
    } catch (err) {
      return apiErrorResponse('RELATION_CHART_LOOKUP_FAILED', sanitizeErrorForLog(err), 500);
    }
  }
  if (!relationChart) {
    return apiErrorResponse(
      'RELATION_CHART_NOT_FOUND',
      `relation chart for relation_id=${body.relation_id} not found`,
      404,
    );
  }

  const userChart = userChartRes.data as unknown as ChartRow;
  const input: BuildHapcardInput = {
    user_id: userId,
    relation_id: body.relation_id,
    mode: body.mode,
    self: userChart.chart_core,
    self_chart_hash: userChart.chart_hash,
    relation: relationChart.chart_core,
    relation_chart_hash: relationChart.chart_hash,
    theory_profile_version: body.theory_profile_version,
    target_date: todayKST(),
    question_slot: body.question_slot,
  };

  try {
    const serviceClient = createServiceRoleClient();
    const ref = await getHapcardCacheKey(input, supabaseUserClient);
    const resolution = await previewFeatureCharge(serviceClient, userId, 'hapcard', ref);
    if (resolution.mode === 'pay_required') {
      const limit = await checkCashGenLimit(serviceClient, userId);
      if (!limit.allowed) {
        return apiErrorResponse(
          'RATE_LIMITED',
          `daily pre-generation limit ${limit.count}/${limit.limit}`,
          429,
        );
      }
    }
    return NextResponse.json(toPreflightJson(resolution));
  } catch (err) {
    return apiErrorResponse('INTERNAL_ERROR', sanitizeErrorForLog(err), 500);
  }
}
