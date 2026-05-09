import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { buildWhatif, type BuildWhatifInput, type BuildWhatifDeps } from '@/lib/whatif/builder';
import { buildWhatifRagQueryText } from '@/lib/whatif/query-text';
import { DiagnosticTypeSchema, type WhatifErrorCode } from '@/types/diagnostic';
import type { ChartCore } from '@/types/chart';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

function errorResponse(code: WhatifErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  // 1. path 파라미터 validation
  const { type: rawType } = await params;
  const typeParsed = DiagnosticTypeSchema.safeParse(rawType);
  if (!typeParsed.success) {
    return errorResponse('INVALID_TYPE', `unknown diagnostic type: ${rawType}`, 400);
  }
  const type = typeParsed.data;

  // 2. auth
  const supabaseUserClient = await createServerClient();
  const { data: userData } = await supabaseUserClient.auth.getUser();
  if (!userData?.user) {
    return errorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  // 3. user_charts fetch — latest by created_at (self-anchor, theory_profile_version 미사용)
  const userChartRes = await supabaseUserClient
    .from('user_charts')
    .select('chart_core, chart_hash')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (userChartRes.error) {
    return errorResponse('INTERNAL_ERROR', `user_charts lookup: ${userChartRes.error.message}`, 500);
  }
  if (!userChartRes.data) {
    return errorResponse('USER_CHART_NOT_FOUND', 'user chart not found', 404);
  }
  const userChart = userChartRes.data as unknown as ChartRow;

  // 4. buildWhatif 호출
  const input: BuildWhatifInput = {
    user_id: userId,
    type,
    chart: userChart.chart_core,
    chart_hash: userChart.chart_hash,
  };
  const deps: BuildWhatifDeps = {
    supabaseUserClient,
    supabaseServiceClient: createServiceRoleClient(),
    openaiClient: createOpenAiClient() as unknown as BuildWhatifDeps['openaiClient'],
    embeddingsClient: createEmbeddingsClient(),
    ragQueryText: buildWhatifRagQueryText,
  };

  try {
    const result = await buildWhatif(input, deps);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    if (message.startsWith('GROUNDING_FAILED')) {
      return errorResponse('GROUNDING_FAILED', message, 422);
    }
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
