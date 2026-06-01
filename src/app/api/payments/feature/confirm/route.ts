import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { confirmFeaturePaymentForUser } from '@/lib/payments/feature-complete';
import { PaymentFlowError } from '@/lib/payments/complete';
import { TossPaymentError } from '@/lib/payments/toss-server';
import { getFeaturePrice } from '@/lib/payments/feature-prices';
import { createClient } from '@/lib/supabase/server';

// pay-per-use 피처 결제 확정 콜백 (ADR-039, 모델 C). Toss 위젯 successUrl 이 여기로 복귀.
const FAILURE_REDIRECT_BASE = '/payments/fail';
const NEXT_FALLBACK = '/feed';
const REDIRECT_SEE_OTHER = 303;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const paymentKey = sp.get('paymentKey');
  const orderId = sp.get('orderId');
  const amount = Number(sp.get('amount'));
  const ref = sp.get('ref');
  const next = sp.get('next');
  const isReplay = sp.get('replay') === '1';

  // feature 는 클라이언트 문자열을 서버 신뢰 카탈로그로 재검증.
  const price = sp.get('feature') ? getFeaturePrice(sp.get('feature') as string) : null;

  if (!paymentKey || !orderId || !Number.isInteger(amount) || !price || !ref) {
    return redirectToFail(request, {
      orderId,
      code: 'PAYMENT_CONFIRM_INVALID',
      message: '결제 승인 정보가 올바르지 않습니다.',
    });
  }
  const feature = price.feature_id;

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
    await confirmFeaturePaymentForUser({
      userId: user.id,
      orderId,
      paymentKey,
      amount,
      feature,
      ref,
    });
  } catch (err) {
    const code =
      err instanceof TossPaymentError || err instanceof PaymentFlowError
        ? err.code
        : 'PAYMENT_CONFIRM_FAILED';
    const message = err instanceof Error ? err.message : '결제 승인에 실패했습니다.';
    Sentry.captureException(err, {
      tags: { area: 'payments', payment_step: 'feature_confirm' },
      extra: { order_id: orderId, code, feature },
    });
    return redirectToFail(request, { orderId, code, message });
  }

  // 성공 — allowlist 된 피처 내부 경로로만 복귀(open-redirect 방지). paid=ref 로 재요청 트리거.
  const target = resolveNext(next, request.nextUrl.origin);
  target.searchParams.set('paid', ref);
  if (isReplay) {
    target.searchParams.set('replay', '1');
  }
  return NextResponse.redirect(target, REDIRECT_SEE_OTHER);
}

function resolveNext(next: string | null, origin: string): URL {
  const fallback = new URL(NEXT_FALLBACK, origin);
  // 내부 경로만 허용. 프로토콜-상대(//) 및 절대 URL 차단.
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }
  const path = next.split('?')[0].split('#')[0];
  if (!/^\/(hapcard|whatif)(\/|$)/.test(path)) {
    return fallback;
  }
  try {
    return new URL(next, origin);
  } catch {
    return fallback;
  }
}

function redirectToFail(
  request: NextRequest,
  input: { orderId: string | null; code: string; message: string },
): NextResponse {
  const url = new URL(FAILURE_REDIRECT_BASE, request.nextUrl.origin);
  if (input.orderId) {
    url.searchParams.set('orderId', input.orderId);
  }
  url.searchParams.set('code', input.code);
  url.searchParams.set('message', input.message);
  return NextResponse.redirect(url, REDIRECT_SEE_OTHER);
}
