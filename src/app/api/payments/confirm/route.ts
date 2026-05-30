import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { confirmPaymentForUser, PaymentFlowError } from '@/lib/payments/complete';
import { TossPaymentError } from '@/lib/payments/toss-server';
import { createClient } from '@/lib/supabase/server';

const FAILURE_REDIRECT_BASE = '/payments/fail';
const SUCCESS_REDIRECT_BASE = '/payments/success';

export async function GET(request: NextRequest) {
  const paymentKey = request.nextUrl.searchParams.get('paymentKey');
  const orderId = request.nextUrl.searchParams.get('orderId');
  const amountText = request.nextUrl.searchParams.get('amount');
  const amount = Number(amountText);

  if (!paymentKey || !orderId || !Number.isInteger(amount)) {
    return redirectToFail(request, {
      orderId,
      code: 'PAYMENT_CONFIRM_INVALID',
      message: '결제 승인 정보가 올바르지 않습니다.',
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToFail(request, {
      orderId,
      code: 'UNAUTHORIZED',
      message: '로그인이 필요합니다. 다시 로그인 후 결제를 확인해주세요.',
    });
  }

  try {
    await confirmPaymentForUser({
      userId: user.id,
      orderId,
      paymentKey,
      amount,
    });
  } catch (err) {
    const code = err instanceof TossPaymentError || err instanceof PaymentFlowError
      ? err.code
      : 'PAYMENT_CONFIRM_FAILED';
    const message = err instanceof Error ? err.message : '결제 승인에 실패했습니다.';
    Sentry.captureException(err, {
      tags: { area: 'payments', payment_step: 'confirm' },
      extra: { order_id: orderId, code },
    });
    return redirectToFail(request, { orderId, code, message });
  }

  return redirectWithQuery(request, SUCCESS_REDIRECT_BASE, { orderId });
}

function redirectToFail(
  request: NextRequest,
  input: { orderId: string | null; code: string; message: string },
): NextResponse {
  return redirectWithQuery(request, FAILURE_REDIRECT_BASE, {
    orderId: input.orderId ?? undefined,
    code: input.code,
    message: input.message,
  });
}

function redirectWithQuery(
  request: NextRequest,
  pathname: string,
  params: Record<string, string | undefined>,
): NextResponse {
  const url = new URL(pathname, request.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return NextResponse.redirect(url);
}
