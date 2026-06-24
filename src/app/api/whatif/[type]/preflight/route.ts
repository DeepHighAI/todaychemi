import { NextResponse, type NextRequest } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { fetchLatestUserChart } from '@/lib/chart/queries';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { previewFeatureCharge, toPreflightJson } from '@/lib/payments/feature-preflight';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { todayKST } from '@/lib/today/kst-date';
import { getWhatifCacheKey, type BuildWhatifInput } from '@/lib/whatif/builder';
import { DiagnosticTypeSchema } from '@/types/diagnostic';
import type { ChartCore } from '@/types/chart';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type: rawType } = await params;
  const typeParsed = DiagnosticTypeSchema.safeParse(rawType);
  if (!typeParsed.success) {
    return apiErrorResponse('INVALID_TYPE', `unknown diagnostic type: ${rawType}`, 400);
  }
  const type = typeParsed.data;

  const supabaseUserClient = await createServerClient();
  const { data: userData } = await supabaseUserClient.auth.getUser();
  if (!userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  const userChartRes = await fetchLatestUserChart(supabaseUserClient, userId);
  if (userChartRes.error) {
    return apiErrorResponse(
      'INTERNAL_ERROR',
      `user_charts lookup: ${sanitizeErrorForLog(userChartRes.error.message)}`,
      500,
    );
  }
  if (!userChartRes.data) {
    return apiErrorResponse('USER_CHART_NOT_FOUND', 'user chart not found', 404);
  }

  const userChart = userChartRes.data as unknown as ChartRow;
  const input: BuildWhatifInput = {
    user_id: userId,
    type,
    chart: userChart.chart_core,
    chart_hash: userChart.chart_hash,
    target_date: todayKST(),
  };

  try {
    const serviceClient = createServiceRoleClient();
    const ref = getWhatifCacheKey(input);
    const resolution = await previewFeatureCharge(serviceClient, userId, 'whatif', ref);
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
