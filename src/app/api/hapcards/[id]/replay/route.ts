import { NextResponse } from 'next/server';
import { todayKST } from '@/lib/today/kst-date';
import type { NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient } from '@/lib/llm/clients';
import {
  buildReplay,
  type BuildReplayInput,
  type BuildReplayDeps,
} from '@/lib/replay/builder';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import {
  HapcardDbRowSchema,
  ReplayRequestSchema,
  type ReplayRequest,
  type ReplayErrorCode,
  type HapcardResult,
} from '@/types/hapcard';
import { apiErrorResponse, paymentRequiredResponse } from '@/lib/errors/route-response';
import { toErrorMessage } from '@/lib/errors/to-message';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // 1. body parse + validate (strict — 미지 필드 거부)
  let body: ReplayRequest;
  try {
    const rawText = await request.text();
    const raw = rawText.trim() ? JSON.parse(rawText) : {};
    const parsed = ReplayRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return apiErrorResponse('INVALID_BODY', parsed.error.message, 400);
    }
    body = parsed.data;
  } catch {
    return apiErrorResponse('INVALID_BODY', 'JSON parse failed', 400);
  }

  // 2. auth
  const supabaseUserClient = await createServerClient();
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  // 3. hapcard 조회 (RLS: user_id 자동 enforce)
  const hapcardRes = await supabaseUserClient
    .from('hapcards')
    .select('*')
    .eq('hapcard_id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!hapcardRes.data) {
    return apiErrorResponse('HAPCARD_NOT_FOUND', `hapcard ${id} not found`, 404);
  }
  const parseResult = HapcardDbRowSchema.safeParse(hapcardRes.data);
  if (!parseResult.success) {
    console.error('hapcard_db_row_invalid', { id, issues: parseResult.error.issues });
    return apiErrorResponse('INTERNAL_ERROR', 'hapcard data shape invalid', 500);
  }
  const hapcard = { ...hapcardRes.data, ...parseResult.data } as unknown as HapcardResult;

  // 4. 일진/ref/서비스 클라이언트 — 한 번만 산출(자정 경계 desync 방지). ref 는 dated (idempotency 버그 수정).
  const jinjin_date = todayKST();
  const ref = `replay:${id}:${jinjin_date}`;
  const serviceClient = createServiceRoleClient();

  // 5. idempotency 체크 — 오늘 이미 replay 존재 시. 모델 C: 선생성된 row 가 미결제일 수 있으므로
  //    잠금 게이트(isFeatureUnlocked) 통과 시에만 본문 공개. 미결제면 재빌드 없이 결제 요구.
  const idempotencyRes = await supabaseUserClient
    .from('hapcard_replays')
    .select('*')
    .eq('hapcard_id', id)
    .eq('jinjin_date', jinjin_date)
    .maybeSingle();
  if (idempotencyRes.data) {
    if (await isFeatureUnlocked(serviceClient, userId, 'replay', ref)) {
      return NextResponse.json(idempotencyRes.data, { status: 200 });
    }
    return paymentRequiredResponse('replay', ref, FEATURE_PRICES_KRW.replay.amount_krw);
  }

  // 6. LLM outage 게이트
  if (process.env.LLM_ALL_PROVIDERS_DOWN === 'true') {
    return apiErrorResponse('REPLAY_DURING_OUTAGE', 'LLM providers unavailable', 503);
  }

  // 7. pay-per-use 게이트 (ADR-039, 모델 C). ref = dated replay key. charged=true 는 free 신규 차감만.
  const input: BuildReplayInput = {
    hapcard,
    jinjin_date,
    replay_reason: body.replay_reason,
  };
  const deps: BuildReplayDeps = {
    supabaseUserClient,
    supabaseServiceClient: serviceClient,
    openaiClient: createOpenAiClient() as unknown as BuildReplayDeps['openaiClient'],
  };

  let charged = false;
  try {
    const resolution = await resolveFeatureCharge(serviceClient, userId, 'replay', ref);
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
      await buildReplay(input, deps); // 선생성 — 본문 보류
      return paymentRequiredResponse(resolution.price.feature_id, ref, resolution.price.amount_krw);
    }

    const result = await buildReplay(input, deps); // free | unlocked
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = toErrorMessage(err);
    if (charged) {
      const { error: refundErr } = await serviceClient.rpc('refund_tokens_once', {
        uid: userId,
        delta: FEATURE_PRICES_KRW.replay.token_cost,
        reason: 'replay_refund',
        ref,
      });
      if (refundErr) {
        console.error('replay_refund_failed', {
          user_id: userId,
          hapcard_id: id,
          phase: 'build_error',
          original_error: message,
          refund_error: refundErr.message,
        });
      }
    }
    return apiErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
