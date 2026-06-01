import { NextResponse, type NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import {
  buildHapcard,
  getHapcardCacheKey,
  type BuildHapcardInput,
  type BuildHapcardDeps,
} from '@/lib/hapcard/builder';
import { buildRagQueryText } from '@/lib/rag/query-text';
import { FEATURE_TOKEN_COSTS } from '@/lib/payments/token-costs';
import {
  fetchLatestUserChartForVersion,
  fetchLatestRelationChartForVersion,
} from '@/lib/chart/queries';
import { todayKST } from '@/lib/today/kst-date';
import { HapcardRequestSchema, type HapcardRequest, type HapcardErrorCode } from '@/types/hapcard';
import type { ChartCore } from '@/types/chart';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { toErrorMessage } from '@/lib/errors/to-message';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

function tokenRpcInserted(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return (data as { inserted?: unknown }).inserted === true;
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
    target_date: todayKST(),
    question_slot: body.question_slot,
  };

  const serviceClient = createServiceRoleClient();
  const deps: BuildHapcardDeps = {
    supabaseUserClient,
    supabaseServiceClient: serviceClient,
    openaiClient: createOpenAiClient() as unknown as BuildHapcardDeps['openaiClient'],
    embeddingsClient: createEmbeddingsClient(),
    ragQueryText: buildRagQueryText,
  };

  let charged = false;
  let billingRef = '';

  try {
    const cacheKey = await getHapcardCacheKey(input, supabaseUserClient);
    billingRef = cacheKey;
    const existingRes = await supabaseUserClient
      .from('hapcards')
      .select('hapcard_id')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (existingRes.error) {
      return apiErrorResponse('INTERNAL_ERROR', existingRes.error.message, 500);
    }

    if (!existingRes.data) {
      const { data: deductData, error: deductErr } = await serviceClient.rpc('deduct_tokens_once', {
        uid: userId,
        delta: -FEATURE_TOKEN_COSTS.hapcardCreate,
        reason: 'hapcard_use',
        ref: cacheKey,
      });
      if (deductErr) {
        return apiErrorResponse('INSUFFICIENT_TOKENS', deductErr.message, 402);
      }
      charged = tokenRpcInserted(deductData);
    }

    const result = await buildHapcard(input, deps);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[POST /api/hapcards]', err);
    const message = toErrorMessage(err);
    if (charged) {
      const { error: refundErr } = await serviceClient.rpc('refund_tokens_once', {
        uid: userId,
        delta: FEATURE_TOKEN_COSTS.hapcardCreate,
        reason: 'hapcard_refund',
        ref: billingRef,
      });
      if (refundErr) {
        console.error('hapcard_refund_failed', {
          user_id: userId,
          relation_id: input.relation_id,
          original_error: message,
          refund_error: refundErr.message,
        });
      }
    }
    if (message.startsWith('GROUNDING_FAILED')) {
      return apiErrorResponse('GROUNDING_FAILED', message, 422);
    }
    return apiErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
