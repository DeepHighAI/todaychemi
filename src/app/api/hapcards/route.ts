import { NextResponse, type NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import { buildHapcard, type BuildHapcardInput, type BuildHapcardDeps } from '@/lib/hapcard/builder';
import { buildRagQueryText } from '@/lib/rag/query-text';
import {
  fetchLatestUserChartForVersion,
  fetchLatestRelationChartForVersion,
} from '@/lib/chart/queries';
import { HapcardRequestSchema, type HapcardRequest, type HapcardErrorCode } from '@/types/hapcard';
import type { ChartCore } from '@/types/chart';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { toErrorMessage } from '@/lib/errors/to-message';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

export async function POST(request: NextRequest) {
  // 1. body parse + validate
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

  // 2. auth — supabaseUserClient
  const supabaseUserClient = await createServerClient();
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  // 3+4. user_charts / relation_charts 는 독립 쿼리 — 병렬 fetch (RLS 자동 enforce)
  // MeEdit 시 chart_hash 변경으로 신규 row INSERT (ADR-016 FK 보존) → 복수 row 가능.
  // fetchLatest*ForVersion 은 .order(desc).limit(1) 로 latest row 를 안전하게 선택.
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
  const userChart = userChartRes.data as unknown as ChartRow;

  if (relationChartRes.error) {
    return apiErrorResponse(
      'RELATION_CHART_LOOKUP_FAILED',
      relationChartRes.error.message,
      500,
    );
  }
  if (!relationChartRes.data) {
    return apiErrorResponse(
      'RELATION_CHART_NOT_FOUND',
      `relation chart for relation_id=${body.relation_id} not found`,
      404,
    );
  }
  const relationChart = relationChartRes.data as unknown as ChartRow;

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
    console.error('[POST /api/hapcards]', err);
    const message = toErrorMessage(err);
    if (message.startsWith('GROUNDING_FAILED')) {
      return apiErrorResponse('GROUNDING_FAILED', message, 422);
    }
    return apiErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
