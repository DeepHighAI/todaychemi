import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { confirmFeaturePaymentForUser } from '@/lib/payments/feature-complete';
import { PaymentFlowError } from '@/lib/payments/complete';
import { TossPaymentError } from '@/lib/payments/toss-server';
import { getFeaturePrice } from '@/lib/payments/feature-prices';
import { materializeRelationSlot } from '@/lib/relations/materialize';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { redactSensitiveLogText, sanitizeErrorForReporting } from '@/lib/errors/sanitize-log';

// pay-per-use 피처 결제 확정 콜백 (ADR-039, 모델 C). Toss 위젯 successUrl 이 여기로 복귀.
const FAILURE_REDIRECT_BASE = '/payments/fail';
const NEXT_FALLBACK = '/feed';
const REDIRECT_SEE_OTHER = 303;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const paymentKey = sp.get('paymentKey');
  const orderId = sp.get('orderId');
  const amountParam = sp.get('amount');
  const amount = Number(amountParam);
  const ref = sp.get('ref');
  const next = sp.get('next');
  const isReplay = sp.get('replay') === '1';

  // feature 는 클라이언트 문자열을 서버 신뢰 카탈로그로 재검증.
  const price = sp.get('feature') ? getFeaturePrice(sp.get('feature') as string) : null;

  if (!paymentKey || !orderId || !amountParam || !Number.isInteger(amount) || !price || !ref) {
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
    const message =
      err instanceof Error
        ? redactSensitiveLogText(err.message).slice(0, 500)
        : '결제 승인에 실패했습니다.';
    const reportableError =
      err instanceof Error ? sanitizeErrorForReporting(err) : new Error(message);
    Sentry.captureException(reportableError, {
      tags: { area: 'payments', payment_step: 'feature_confirm' },
      extra: { order_id: orderId, code, feature },
    });
    return redirectToFail(request, { orderId, code, message });
  }

  // relation_slot — 결제 확정 직후 스테이징된 인연을 머티리얼라이즈 (ADR-039 Amended).
  // 돈이 이미 확정됐으므로 어떤 실패도 fail 리다이렉트로 보내지 않는다 — 로깅 후 진행.
  // 머티리얼라이즈 고아는 POST /api/relations 의 lazy recovery 가 다음 시도에서 전달한다.
  if (feature === 'relation_slot') {
    try {
      const pendingId = ref.split(':')[1] ?? '';
      await materializeRelationSlot(createServiceRoleClient(), user.id, pendingId);
    } catch (err) {
      const reportableError =
        err instanceof Error
          ? sanitizeErrorForReporting(err)
          : new Error('relation_slot materialize failed');
      Sentry.captureException(reportableError, {
        tags: { area: 'payments', payment_step: 'relation_slot_materialize' },
        extra: { order_id: orderId, ref },
      });
    }
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
  if (!/^\/(hapcard|whatif|feed)(\/|$)/.test(path)) {
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
