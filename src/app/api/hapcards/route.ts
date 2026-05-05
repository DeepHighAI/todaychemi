import { NextResponse, type NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { buildHapcard, type BuildHapcardInput, type BuildHapcardDeps } from '@/lib/hapcard/builder';
import { buildRagQueryText } from '@/lib/rag/query-text';
import { HapcardRequestSchema, type HapcardRequest, type HapcardErrorCode } from '@/types/hapcard';
import type { ChartCore } from '@/types/chart';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

// 통일된 에러 응답 — { error: { code, message } }, code 는 UPPER_SNAKE.
function errorResponse(code: HapcardErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  // 1. body parse + validate
  let body: HapcardRequest;
  try {
    const raw = await request.json();
    const parsed = HapcardRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse('INVALID_BODY', parsed.error.message, 400);
    }
    body = parsed.data;
  } catch {
    return errorResponse('INVALID_BODY', 'JSON parse failed', 400);
  }

  // 2. auth — supabaseUserClient
  const supabaseUserClient = await createServerClient();
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) {
    return errorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  // 3. user_charts fetch (RLS 자동 enforce)
  const userChartRes = await supabaseUserClient
    .from('user_charts')
    .select('chart_core, chart_hash')
    .eq('user_id', userId)
    .eq('theory_profile_version', body.theory_profile_version)
    .maybeSingle();
  if (userChartRes.error) {
    return errorResponse('USER_CHART_LOOKUP_FAILED', userChartRes.error.message, 500);
  }
  if (!userChartRes.data) {
    return errorResponse(
      'USER_CHART_NOT_FOUND',
      `user chart for theory_profile_version=${body.theory_profile_version} not found`,
      404,
    );
  }
  const userChart = userChartRes.data as ChartRow;

  // 4. relation_charts fetch (RLS 자동 enforce via relation_charts.user_id)
  const relationChartRes = await supabaseUserClient
    .from('relation_charts')
    .select('chart_core, chart_hash')
    .eq('relation_id', body.relation_id)
    .eq('theory_profile_version', body.theory_profile_version)
    .maybeSingle();
  if (relationChartRes.error) {
    return errorResponse(
      'RELATION_CHART_LOOKUP_FAILED',
      relationChartRes.error.message,
      500,
    );
  }
  if (!relationChartRes.data) {
    return errorResponse(
      'RELATION_CHART_NOT_FOUND',
      `relation chart for relation_id=${body.relation_id} not found`,
      404,
    );
  }
  const relationChart = relationChartRes.data as ChartRow;

  // 5. buildHapcard 호출
  const input: BuildHapcardInput = {
    user_id: userId,
    relation_id: body.relation_id,
    mode: body.mode,
    self: userChart.chart_core,
    self_chart_hash: userChart.chart_hash,
    relation: relationChart.chart_core,
    relation_chart_hash: relationChart.chart_hash,
    theory_profile_version: body.theory_profile_version,
    question_slot: body.question_slot,
  };

  const deps: BuildHapcardDeps = {
    supabaseUserClient,
    supabaseServiceClient: createServiceRoleClient(),
    openaiClient: createOpenAiClient() as unknown as BuildHapcardDeps['openaiClient'],
    embeddingsClient: createEmbeddingsClient(),
    ragQueryText: buildRagQueryText,
  };

  try {
    const result = await buildHapcard(input, deps);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    if (message.startsWith('GROUNDING_FAILED')) {
      return errorResponse('GROUNDING_FAILED', message, 422);
    }
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
