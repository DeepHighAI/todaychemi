import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Database } from '@/types/database.types';

import { getTossProduct } from './products';
import { confirmTossPayment, getTossPayment, TossPaymentError, type TossConfirmResponse } from './toss-server';

type PaymentRow = Database['public']['Tables']['payments']['Row'];

export class PaymentFlowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'PaymentFlowError';
  }
}

export interface PaymentConfirmResult {
  status: 'confirmed' | 'already_confirmed';
  balance_after: number | null;
  payment: PaymentRow;
}

function assertPendingOrder(payment: PaymentRow | null): asserts payment is PaymentRow {
  if (!payment) {
    throw new PaymentFlowError('PAYMENT_NOT_FOUND', '결제 주문을 찾을 수 없습니다.', 404);
  }
}

export async function confirmPaymentForUser(input: {
  userId: string;
  orderId: string;
  paymentKey: string;
  amount: number;
  serviceClient?: SupabaseClient<Database>;
}): Promise<PaymentConfirmResult> {
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
  assertPendingOrder(payment);

  if (payment.status === 'confirmed') {
    if (payment.toss_payment_key !== input.paymentKey) {
      throw new PaymentFlowError(
        'PAYMENT_ALREADY_CONFIRMED_MISMATCH',
        '이미 다른 결제로 확정된 주문입니다.',
        409,
      );
    }
    return { status: 'already_confirmed', balance_after: null, payment };
  }

  const product = payment.product_id ? getTossProduct(payment.product_id) : null;
  if (!product) {
    throw new PaymentFlowError('PRODUCT_NOT_FOUND', '상품 정보를 찾을 수 없습니다.', 400);
  }
  if (payment.amount_krw !== product.amount_krw || payment.token_amount !== product.tokens) {
    throw new PaymentFlowError('PAYMENT_PRODUCT_MISMATCH', '주문 금액이 상품 정보와 다릅니다.', 400);
  }
  if (input.amount !== payment.amount_krw) {
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
    throw new PaymentFlowError('TOSS_CONFIRM_MISMATCH', '토스 승인 결과가 주문과 다릅니다.', 400);
  }

  const { data: balanceAfter, error: rpcError } = await service.rpc('confirm_token_purchase', {
    uid: input.userId,
    p_toss_order_id: input.orderId,
    p_toss_payment_key: input.paymentKey,
    p_product_id: product.product_id,
    p_amount_krw: product.amount_krw,
    p_token_amount: product.tokens,
    p_receipt_url: toss.receipt?.url ?? null,
    p_confirmed_at: toss.approvedAt ?? new Date().toISOString(),
  });

  if (rpcError) {
    throw new PaymentFlowError('PAYMENT_CONFIRM_RPC_FAILED', rpcError.message, 500);
  }

  return { status: 'confirmed', balance_after: balanceAfter ?? null, payment };
}

async function confirmOrQueryTossPayment(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResponse> {
  try {
    return await confirmTossPayment(input);
  } catch (err) {
    if (!(err instanceof TossPaymentError)) {
      throw err;
    }

    const queried = await getTossPayment(input.paymentKey).catch(() => null);
    if (queried) {
      return queried;
    }

    throw new PaymentFlowError(
      'PAYMENT_CONFIRM_RETRYABLE',
      err.message || '결제 승인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
      502,
    );
  }
}

export async function markPaymentFailedForUser(input: {
  userId: string;
  orderId: string;
  code: string;
  message: string;
  serviceClient?: SupabaseClient<Database>;
}): Promise<void> {
  const service = input.serviceClient ?? createServiceRoleClient();
  const { error } = await service
    .from('payments')
    .update({
      status: 'failed',
      failure_code: input.code.slice(0, 120),
      failure_message: input.message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .eq('toss_order_id', input.orderId)
    .eq('status', 'pending');

  if (error) {
    console.error('payment_fail_mark_failed', {
      user_id: input.userId,
      order_id: input.orderId,
      error: error.message,
    });
  }
}
