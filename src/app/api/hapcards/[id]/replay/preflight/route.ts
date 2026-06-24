import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { previewFeatureCharge, toPreflightJson } from '@/lib/payments/feature-preflight';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { todayKST } from '@/lib/today/kst-date';

export type ReplayPreflightResponse =
  | {
      mode: 'unlocked' | 'token_required';
      feature: 'replay';
      ref: string;
      token_cost: number;
      amount_krw: number;
      balance: number;
      shortage: 0;
      payment: null;
    }
  | {
      mode: 'pay_required';
      feature: 'replay';
      ref: string;
      token_cost: number;
      amount_krw: number;
      balance: number;
      shortage: number;
      payment: { feature: 'replay'; ref: string; amount_krw: number };
    };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabaseUserClient = await createServerClient();
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) {
    return apiErrorResponse('UNAUTHORIZED', 'sign-in required', 401);
  }
  const userId = userData.user.id;

  const hapcardRes = await supabaseUserClient
    .from('hapcards')
    .select('hapcard_id')
    .eq('hapcard_id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (hapcardRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', hapcardRes.error.message, 500);
  }
  if (!hapcardRes.data) {
    return apiErrorResponse('HAPCARD_NOT_FOUND', `hapcard ${id} not found`, 404);
  }

  const jinjinDate = todayKST();
  const ref = `replay:${id}:${jinjinDate}`;
  const serviceClient = createServiceRoleClient();

  const idempotencyRes = await supabaseUserClient
    .from('hapcard_replays')
    .select('replay_id')
    .eq('hapcard_id', id)
    .eq('jinjin_date', jinjinDate)
    .maybeSingle();
  if (idempotencyRes.error) {
    return apiErrorResponse('INTERNAL_ERROR', idempotencyRes.error.message, 500);
  }
  if (idempotencyRes.data) {
    const resolution = await previewFeatureCharge(serviceClient, userId, 'replay', ref);
    return NextResponse.json(toPreflightJson(resolution));
  }

  if (process.env.LLM_ALL_PROVIDERS_DOWN === 'true') {
    return apiErrorResponse('REPLAY_DURING_OUTAGE', 'LLM providers unavailable', 503);
  }

  const resolution = await previewFeatureCharge(serviceClient, userId, 'replay', ref);
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
}
