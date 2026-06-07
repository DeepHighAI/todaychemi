import type { SupabaseClient } from '@supabase/supabase-js';

import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Database } from '@/types/database.types';

import { confirmTossPayment, getTossPayment, TossPaymentError, type TossConfirmResponse } from './toss-server';

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

type PaymentProblemStatus = 'failed' | 'tampered' | 'invalid';

const FAILURE_CODE_MAX_LENGTH = 120;
const FAILURE_MESSAGE_MAX_LENGTH = 500;

// 토스 승인(confirm) + 실패 시 조회(getTossPayment) 폴백. 피처결제(feature-complete) 가 공유.
export async function confirmOrQueryTossPayment(input: {
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
  return markPaymentProblemForUser({ ...input, status: 'failed', fromStatuses: ['pending'] });
}

export async function markPaymentTamperedForUser(input: {
  userId: string;
  orderId: string;
  code: string;
  message: string;
  serviceClient?: SupabaseClient<Database>;
}): Promise<void> {
  return markPaymentProblemForUser({ ...input, status: 'tampered', fromStatuses: ['pending', 'failed'] });
}

export async function markPaymentInvalidForUser(input: {
  userId: string;
  orderId: string;
  code: string;
  message: string;
  serviceClient?: SupabaseClient<Database>;
}): Promise<void> {
  return markPaymentProblemForUser({ ...input, status: 'invalid', fromStatuses: ['pending', 'failed'] });
}

async function markPaymentProblemForUser(input: {
  userId: string;
  orderId: string;
  code: string;
  message: string;
  status: PaymentProblemStatus;
  fromStatuses: string[];
  serviceClient?: SupabaseClient<Database>;
}): Promise<void> {
  const service = input.serviceClient ?? createServiceRoleClient();
  const { error } = await service
    .from('payments')
    .update({
      status: input.status,
      failure_code: input.code.slice(0, FAILURE_CODE_MAX_LENGTH),
      failure_message: input.message.slice(0, FAILURE_MESSAGE_MAX_LENGTH),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .eq('toss_order_id', input.orderId)
    .in('status', input.fromStatuses);

  if (error) {
    console.error('payment_mark_problem_failed', {
      user_id: input.userId,
      order_id: input.orderId,
      status: input.status,
      error: sanitizeErrorForLog(error.message),
    });
  }
}
