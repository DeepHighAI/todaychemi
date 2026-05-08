import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createOpenAiClient } from '@/lib/llm/clients';
import {
  buildReplay,
  type BuildReplayInput,
  type BuildReplayDeps,
} from '@/lib/replay/builder';
import {
  HapcardDbRowSchema,
  ReplayRequestSchema,
  type ReplayRequest,
  type ReplayErrorCode,
  type HapcardResult,
} from '@/types/hapcard';

function todayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

function errorResponse(code: ReplayErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // 1. body parse + validate (strict — 미지 필드 거부)
  let body: ReplayRequest;
  try {
    const raw = await request.json();
    const parsed = ReplayRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse('INVALID_BODY', parsed.error.message, 400);
    }
    body = parsed.data;
  } catch {
    return errorResponse('INVALID_BODY', 'JSON parse failed', 400);
  }

  // 2. auth
  const supabaseUserClient = await createServerClient();
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) {
    return errorResponse('UNAUTHORIZED', 'sign-in required', 401);
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
    return errorResponse('HAPCARD_NOT_FOUND', `hapcard ${id} not found`, 404);
  }
  const parseResult = HapcardDbRowSchema.safeParse(hapcardRes.data);
  if (!parseResult.success) {
    console.error('hapcard_db_row_invalid', { id, issues: parseResult.error.issues });
    return errorResponse('INTERNAL_ERROR', 'hapcard data shape invalid', 500);
  }
  const hapcard = { ...hapcardRes.data, ...parseResult.data } as HapcardResult;

  // 4. idempotency 체크 — 오늘 이미 replay 존재 시 토큰 차감 없이 기존 반환
  const jinjin_date = todayKST();
  const idempotencyRes = await supabaseUserClient
    .from('hapcard_replays')
    .select('*')
    .eq('hapcard_id', id)
    .eq('jinjin_date', jinjin_date)
    .maybeSingle();
  if (idempotencyRes.data) {
    return NextResponse.json(idempotencyRes.data, { status: 200 });
  }

  // 5. LLM outage 게이트
  if (process.env.LLM_ALL_PROVIDERS_DOWN === 'true') {
    return errorResponse('REPLAY_DURING_OUTAGE', 'LLM providers unavailable', 503);
  }

  // 6. 토큰 차감 (-4p, spec §7 D2)
  const serviceClient = createServiceRoleClient();
  const { error: deductErr } = await serviceClient.rpc('deduct_tokens', {
    uid: userId,
    delta: -4,
    reason: 'replay_use',
    ref: id,
  });
  if (deductErr) {
    return errorResponse('INSUFFICIENT_TOKENS', deductErr.message, 402);
  }

  // 7. replay 생성 — 실패 시 토큰 환불 후 500
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

  try {
    const result = await buildReplay(input, deps);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    await serviceClient.rpc('refund_tokens', {
      uid: userId,
      delta: 4,
      reason: 'replay_refund',
      ref: id,
    });
    const message = err instanceof Error ? err.message : 'unknown error';
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
