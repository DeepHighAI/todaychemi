import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Database } from '@/types/database.types';

import {
  PaymentFlowError,
  confirmOrQueryTossPayment,
  markPaymentInvalidForUser,
  markPaymentTamperedForUser,
} from './complete';
import { FEATURE_PRICES_KRW, type FeatureId } from './feature-prices';

export interface FeaturePaymentConfirmResult {
  status: 'confirmed' | 'already_confirmed';
  feature: FeatureId;
  ref: string;
}

// 피처 결제 확정 (ADR-039, 모델 C). 토큰충전의 confirmPaymentForUser 와 달리 토큰을 적립하지 않는다.
// 금액 검증은 서버 신뢰 단일 출처 FEATURE_PRICES_KRW 기준. 멱등 — 동일 주문 재확정은 already_confirmed.
export async function confirmFeaturePaymentForUser(input: {
  userId: string;
  orderId: string;
  paymentKey: string;
  amount: number;
  feature: FeatureId;
  ref: string;
  serviceClient?: SupabaseClient<Database>;
}): Promise<FeaturePaymentConfirmResult> {
  const price = FEATURE_PRICES_KRW[input.feature];
  const service = input.serviceClient ?? createServiceRoleClient();

  const { data: payment, error } = await service
    .from('payments')
    .select('*')
    .eq('user_id', input.userId)
    .eq('toss_order_id', input.orderId)
    .maybeSingle();

  if (error) {
    throw new PaymentFlowError('PAYMENT_LOOKUP_FAILED', error.message, 500);
  }
  if (!payment) {
    throw new PaymentFlowError('PAYMENT_NOT_FOUND', '결제 주문을 찾을 수 없습니다.', 404);
  }

  // 멱등: 이미 확정된 주문.
  if (payment.status === 'confirmed') {
    if (payment.toss_payment_key !== input.paymentKey) {
      throw new PaymentFlowError(
        'PAYMENT_ALREADY_CONFIRMED_MISMATCH',
        '이미 다른 결제로 확정된 주문입니다.',
        409,
      );
    }
    return { status: 'already_confirmed', feature: input.feature, ref: input.ref };
  }
  if (!['pending', 'failed'].includes(payment.status)) {
    throw new PaymentFlowError('PAYMENT_NOT_CONFIRMABLE', '확정할 수 없는 결제 상태입니다.', 409);
  }

  // 피처/ref 일치 — 다른 피처 주문으로 잠금해제하는 우회 차단.
  if (
    payment.charge_type !== 'feature_use' ||
    payment.feature_id !== input.feature ||
    payment.feature_ref !== input.ref
  ) {
    await markPaymentInvalidForUser({
      userId: input.userId,
      orderId: input.orderId,
      code: 'PAYMENT_FEATURE_MISMATCH',
      message: '주문의 피처 정보가 다릅니다.',
      serviceClient: service,
    });
    throw new PaymentFlowError('PAYMENT_FEATURE_MISMATCH', '주문의 피처 정보가 다릅니다.', 400);
  }
  // 주문 금액이 서버 가격과 다름.
  if (payment.amount_krw !== price.amount_krw) {
    await markPaymentInvalidForUser({
      userId: input.userId,
      orderId: input.orderId,
      code: 'PAYMENT_PRODUCT_MISMATCH',
      message: '주문 금액이 피처 가격과 다릅니다.',
      serviceClient: service,
    });
    throw new PaymentFlowError('PAYMENT_PRODUCT_MISMATCH', '주문 금액이 피처 가격과 다릅니다.', 400);
  }
  // 클라이언트가 보낸 결제 금액이 주문과 다름(변조).
  if (input.amount !== payment.amount_krw) {
    await markPaymentTamperedForUser({
      userId: input.userId,
      orderId: input.orderId,
      code: 'PAYMENT_AMOUNT_MISMATCH',
      message: '결제 금액이 주문과 다릅니다.',
      serviceClient: service,
    });
    throw new PaymentFlowError('PAYMENT_AMOUNT_MISMATCH', '결제 금액이 주문과 다릅니다.', 400);
  }

  const toss = await confirmOrQueryTossPayment({
    paymentKey: input.paymentKey,
    orderId: input.orderId,
    amount: payment.amount_krw,
  });
  if (
    toss.status !== 'DONE' ||
    toss.orderId !== input.orderId ||
    toss.paymentKey !== input.paymentKey ||
    toss.totalAmount !== payment.amount_krw
  ) {
    await markPaymentInvalidForUser({
      userId: input.userId,
      orderId: input.orderId,
      code: 'TOSS_CONFIRM_MISMATCH',
      message: '토스 승인 결과가 주문과 다릅니다.',
      serviceClient: service,
    });
    throw new PaymentFlowError('TOSS_CONFIRM_MISMATCH', '토스 승인 결과가 주문과 다릅니다.', 400);
  }

  const { data: rpcData, error: rpcError } = await service.rpc('confirm_feature_payment', {
    uid: input.userId,
    p_toss_order_id: input.orderId,
    p_toss_payment_key: input.paymentKey,
    p_feature_id: input.feature,
    p_feature_ref: input.ref,
    p_amount_krw: price.amount_krw,
    p_receipt_url: toss.receipt?.url ?? null,
    p_confirmed_at: toss.approvedAt ?? new Date().toISOString(),
  });
  if (rpcError) {
    throw new PaymentFlowError('PAYMENT_CONFIRM_RPC_FAILED', rpcError.message, 500);
  }

  const status = rpcData === 'already_confirmed' ? 'already_confirmed' : 'confirmed';
  return { status, feature: input.feature, ref: input.ref };
}
