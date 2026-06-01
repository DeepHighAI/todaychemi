import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient, createEmbeddingsClient } from '@/lib/llm/clients';
import {
  buildWhatif,
  getWhatifCacheKey,
  type BuildWhatifInput,
  type BuildWhatifDeps,
} from '@/lib/whatif/builder';
import { buildWhatifRagQueryText } from '@/lib/whatif/query-text';
import { FEATURE_TOKEN_COSTS } from '@/lib/payments/token-costs';
import { DiagnosticTypeSchema, type WhatifErrorCode } from '@/types/diagnostic';
import type { ChartCore } from '@/types/chart';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { toErrorMessage } from '@/lib/errors/to-message';
import { fetchLatestUserChart } from '@/lib/chart/queries';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

function tokenRpcInserted(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return (data as { inserted?: unknown }).inserted === true;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  // 1. path 파라미터 validation
  const { type: rawType } = await params;
  const typeParsed = DiagnosticTypeSchema.safeParse(rawType);
  if (!typeParsed.success) {
    return apiErrorResponse('INVALID_TYPE', `unknown diagnostic type: ${rawType}`, 400);
  }
  const type = typeParsed.data;

  // 2. auth
  const supabaseUserClient = await createServerClient();
  const { data: userData } = await supabaseUserClient.auth.getUser();
  if (!userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  // 3. user_charts fetch — latest by created_at (self-anchor, theory_profile_version 미사용)
  const userChartRes = await fetchLatestUserChart(supabaseUserClient, userId);
  if (userChartRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', `user_charts lookup: ${userChartRes.error.message}`, 500);
  }
  if (!userChartRes.data) {
    return apiErrorResponse('USER_CHART_NOT_FOUND', 'user chart not found', 404);
  }
  const userChart = userChartRes.data as unknown as ChartRow;

  // 4. buildWhatif 호출 준비
  const input: BuildWhatifInput = {
    user_id: userId,
    type,
    chart: userChart.chart_core,
    chart_hash: userChart.chart_hash,
  };
  const serviceClient = createServiceRoleClient();
  const deps: BuildWhatifDeps = {
    supabaseUserClient,
    supabaseServiceClient: serviceClient,
    openaiClient: createOpenAiClient() as unknown as BuildWhatifDeps['openaiClient'],
    embeddingsClient: createEmbeddingsClient(),
    ragQueryText: buildWhatifRagQueryText,
  };

  let charged = false;
  let billingRef = '';

  try {
    const cacheKey = getWhatifCacheKey(input);
    billingRef = cacheKey;
    const cacheClient = supabaseUserClient as unknown as SupabaseClient;
    const existingRes = await cacheClient
      .from('whatif_results')
      .select('whatif_id')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (existingRes.error) {
      return apiErrorResponse('INTERNAL_ERROR', existingRes.error.message, 500);
    }

    if (!existingRes.data) {
      const { data: deductData, error: deductErr } = await serviceClient.rpc('deduct_tokens_once', {
        uid: userId,
        delta: -FEATURE_TOKEN_COSTS.whatif,
        reason: 'whatif_use',
        ref: cacheKey,
      });
      if (deductErr) {
        return apiErrorResponse('INSUFFICIENT_TOKENS', deductErr.message, 402);
      }
      charged = tokenRpcInserted(deductData);
    }

    const { result } = await buildWhatif(input, deps);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = toErrorMessage(err);
    if (charged) {
      const { error: refundErr } = await serviceClient.rpc('refund_tokens_once', {
        uid: userId,
        delta: FEATURE_TOKEN_COSTS.whatif,
        reason: 'whatif_refund',
        ref: billingRef,
      });
      if (refundErr) {
        console.error('whatif_refund_failed', {
          user_id: userId,
          type,
          original_error: message,
          refund_error: refundErr.message,
        });
      }
    }
    console.error('whatif_build_failed', { user_id: userId, type, error: message });
    if (message.startsWith('GROUNDING_FAILED')) {
      return apiErrorResponse('GROUNDING_FAILED', message, 422);
    }
    return apiErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
