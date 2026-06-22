import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { FEATURE_PRICES_KRW } from '@/lib/payments/feature-prices';
import { checkCashGenLimit } from '@/lib/payments/cash-gen-limit';
import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { todayKST } from '@/lib/today/kst-date';
import type { Database } from '@/types/database.types';

type ServiceClient = SupabaseClient<Database>;

export type ReplayPreflightResponse =
  | { mode: 'ready'; payment: null }
  | {
      mode: 'pay_required';
      payment: { feature: 'replay'; ref: string; amount_krw: number };
    };

async function getLatestTokenBalance(
  service: ServiceClient,
  userId: string,
): Promise<{ balance: number; error: string | null }> {
  const { data, error } = await service
    .from('token_ledger')
    .select('balance_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { balance: 0, error: error.message };

  const balance = typeof data?.balance_after === 'number' ? data.balance_after : 0;
  return { balance, error: null };
}

function replayPayment(ref: string): ReplayPreflightResponse {
  return {
    mode: 'pay_required',
    payment: {
      feature: 'replay',
      ref,
      amount_krw: FEATURE_PRICES_KRW.replay.amount_krw,
    },
  };
}

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
    if (await isFeatureUnlocked(serviceClient, userId, 'replay', ref)) {
      const body: ReplayPreflightResponse = { mode: 'ready', payment: null };
      return NextResponse.json(body);
    }
    return NextResponse.json(replayPayment(ref));
  }

  if (process.env.LLM_ALL_PROVIDERS_DOWN === 'true') {
    return apiErrorResponse('REPLAY_DURING_OUTAGE', 'LLM providers unavailable', 503);
  }

  if (await isFeatureUnlocked(serviceClient, userId, 'replay', ref)) {
    const body: ReplayPreflightResponse = { mode: 'ready', payment: null };
    return NextResponse.json(body);
  }

  const { balance, error } = await getLatestTokenBalance(serviceClient, userId);
  if (error) {
    return apiErrorResponse('INTERNAL_ERROR', error, 500);
  }

  if (balance >= FEATURE_PRICES_KRW.replay.token_cost) {
    const body: ReplayPreflightResponse = { mode: 'ready', payment: null };
    return NextResponse.json(body);
  }

  const limit = await checkCashGenLimit(serviceClient, userId);
  if (!limit.allowed) {
    return apiErrorResponse(
      'RATE_LIMITED',
      `daily pre-generation limit ${limit.count}/${limit.limit}`,
      429,
    );
  }

  return NextResponse.json(replayPayment(ref));
}
