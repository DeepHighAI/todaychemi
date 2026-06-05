import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ConfigError } from '@/lib/config-error';
import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createTossCustomerKey, createTossOrderId } from '@/lib/payments/ids';
import { getTossPaymentsClientKey, getTossPaymentsSecretKey } from '@/lib/payments/env';
import { FEATURE_PRICES_KRW, FeatureIdSchema } from '@/lib/payments/feature-prices';
import { verifyFeatureRefOwnership } from '@/lib/payments/feature-ref-ownership';
import type { FeaturePaymentInitResponse } from '@/types/feature-payment';

// pay-per-use 피처 결제 시작 (ADR-039, 모델 C). 잔액 부족(402) 이후 클라이언트가 호출.
const FeatureInitSchema = z.object({
  feature: FeatureIdSchema,
  ref: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = FeatureInitSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse('INVALID_BODY', parsed.error.message, 400);
  }
  const { feature, ref } = parsed.data;
  const price = FEATURE_PRICES_KRW[feature];

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiErrorResponse('UNAUTHORIZED', '', 401);
  }

  let clientKey: string;
  try {
    clientKey = getTossPaymentsClientKey();
    getTossPaymentsSecretKey();
  } catch (error) {
    if (error instanceof ConfigError) {
      return apiErrorResponse(
        'PAYMENT_CONFIG_MISSING',
        'payment provider is not configured',
        503,
      );
    }
    throw error;
  }

  const service = createServiceRoleClient();

  // ref 소유 검증 — 사용자가 실제로 선생성된 결과 행을 소유할 때만 결제 허용 (codex #4).
  // 정상 흐름은 선생성 후 402 → init 이므로 행이 항상 존재. 미존재 ref 결제(self-harm) 차단.
  const owns = await verifyFeatureRefOwnership(service, user.id, feature, ref);
  if (!owns) {
    return apiErrorResponse('PAYMENT_REF_NOT_FOUND', 'no pre-generated result for this ref', 404);
  }

  // 동일 (user, feature, ref) 의 열린 주문(pending/confirmed)은 하나만 — 중복 청구 방지(부분 unique).
  const { data: existing, error: lookupErr } = await service
    .from('payments')
    .select('toss_order_id, toss_customer_key, status')
    .eq('user_id', user.id)
    .eq('feature_id', feature)
    .eq('feature_ref', ref)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();
  if (lookupErr) {
    return apiErrorResponse('INTERNAL_ERROR', lookupErr.message, 500);
  }

  // 이미 확정결제됨 → 위젯 불필요, 재요청 시 캐시 본문.
  if (existing?.status === 'confirmed') {
    const unlockedBody: FeaturePaymentInitResponse = { ok: true, unlocked: true };
    return NextResponse.json(unlockedBody, { status: 200 });
  }

  let orderId: string;
  let customerKey: string;

  if (existing) {
    // 미결제 pending 재사용 (더블탭/재시도).
    orderId = existing.toss_order_id;
    customerKey = existing.toss_customer_key ?? createTossCustomerKey();
  } else {
    const newOrderId = createTossOrderId();
    const newCustomerKey = createTossCustomerKey();
    const { data: inserted, error: insertErr } = await service
      .from('payments')
      .insert({
        user_id: user.id,
        toss_order_id: newOrderId,
        toss_customer_key: newCustomerKey,
        toss_payment_key: null,
        charge_type: 'feature_use',
        feature_id: feature,
        feature_ref: ref,
        product_id: null,
        amount_krw: price.amount_krw,
        token_amount: null,
        status: 'pending',
        confirmed_at: null,
      })
      .select('toss_order_id, toss_customer_key')
      .single();
    if (insertErr) {
      // 동시 더블탭 — 부분 unique(payments_feature_open_uidx) 위반 시 기존 주문 재사용 (codex #7).
      if (insertErr.code !== '23505') {
        return apiErrorResponse('INTERNAL_ERROR', insertErr.message, 500);
      }
      const retry = await service
        .from('payments')
        .select('toss_order_id, toss_customer_key, status')
        .eq('user_id', user.id)
        .eq('feature_id', feature)
        .eq('feature_ref', ref)
        .in('status', ['pending', 'confirmed'])
        .maybeSingle();
      if (retry.data?.status === 'confirmed') {
        const unlockedBody: FeaturePaymentInitResponse = { ok: true, unlocked: true };
        return NextResponse.json(unlockedBody, { status: 200 });
      }
      if (!retry.data) {
        return apiErrorResponse('INTERNAL_ERROR', insertErr.message, 500);
      }
      orderId = retry.data.toss_order_id;
      customerKey = retry.data.toss_customer_key ?? newCustomerKey;
    } else if (!inserted) {
      return apiErrorResponse('INTERNAL_ERROR', '', 500);
    } else {
      orderId = inserted.toss_order_id;
      customerKey = inserted.toss_customer_key ?? newCustomerKey;
    }
  }

  const body: FeaturePaymentInitResponse = {
    ok: true,
    unlocked: false,
    payment: {
      order_id: orderId,
      customer_key: customerKey,
      client_key: clientKey,
      amount_krw: price.amount_krw,
      order_name: price.order_name,
      feature,
      ref,
    },
  };
  return NextResponse.json(body, { status: 201 });
}
