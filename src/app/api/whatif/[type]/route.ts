import { NextResponse, type NextRequest } from 'next/server';
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
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { DiagnosticTypeSchema, type WhatifErrorCode } from '@/types/diagnostic';
import type { ChartCore } from '@/types/chart';
import { apiErrorResponse, paymentRequiredResponse } from '@/lib/errors/route-response';
import { toErrorMessage } from '@/lib/errors/to-message';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { fetchLatestUserChart } from '@/lib/chart/queries';

interface ChartRow {
  chart_core: ChartCore;
  chart_hash: string;
}

function createLazyWhatifDeps(
  supabaseUserClient: BuildWhatifDeps['supabaseUserClient'],
  supabaseServiceClient: BuildWhatifDeps['supabaseServiceClient'],
): BuildWhatifDeps {
  return {
    supabaseUserClient,
    supabaseServiceClient,
    openaiClient: {
      chat: {
        completions: {
          create: (req, options) => {
            const client = createOpenAiClient() as unknown as BuildWhatifDeps['openaiClient'];
            return client.chat.completions.create(req, options);
          },
        },
      },
    },
    embeddingsClient: {
      create: (params) => createEmbeddingsClient().create(params),
    },
    ragQueryText: buildWhatifRagQueryText,
  };
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

  // 4. buildWhatif 호출 준비
  const input: BuildWhatifInput = {
    user_id: userId,
    type,
    chart: userChart.chart_core,
    chart_hash: userChart.chart_hash,
  };
  const serviceClient = createServiceRoleClient();
  const deps = createLazyWhatifDeps(supabaseUserClient, serviceClient);

  // pay-per-use 게이트 (ADR-039, 모델 C). ref = whatif cacheKey.
  let charged = false;
  let billingRef = '';

  try {
    const cacheKey = getWhatifCacheKey(input);
    billingRef = cacheKey;

    const resolution = await resolveFeatureCharge(serviceClient, userId, 'whatif', cacheKey);
    charged = resolution.charged;

    if (resolution.mode === 'pay_required') {
      const limit = await checkCashGenLimit(serviceClient, userId);
      if (!limit.allowed) {
        return apiErrorResponse(
          'RATE_LIMITED',
          `daily pre-generation limit ${limit.count}/${limit.limit}`,
          429,
        );
      }
      await buildWhatif(input, deps); // 선생성 — 본문 보류
      return paymentRequiredResponse(resolution.price.feature_id, cacheKey, resolution.price.amount_krw);
    }

    const { result } = await buildWhatif(input, deps);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = toErrorMessage(err);
    const safeMessage = sanitizeErrorForLog(err);
    if (charged) {
      const { error: refundErr } = await serviceClient.rpc('refund_tokens_once', {
        uid: userId,
        delta: FEATURE_PRICES_KRW.whatif.token_cost,
        reason: 'whatif_refund',
        ref: billingRef,
      });
      if (refundErr) {
        console.error('whatif_refund_failed', {
          user_id: userId,
          type,
          original_error: safeMessage,
          refund_error: sanitizeErrorForLog(refundErr.message),
        });
      }
    }
    console.error('whatif_build_failed', { user_id: userId, type, error: safeMessage });
    if (message.startsWith('GROUNDING_FAILED')) {
      return apiErrorResponse('GROUNDING_FAILED', safeMessage, 422);
    }
    return apiErrorResponse('INTERNAL_ERROR', safeMessage, 500);
  }
}
