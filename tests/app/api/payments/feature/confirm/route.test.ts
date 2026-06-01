import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server');
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/payments/feature-complete');

import { GET } from '@/app/api/payments/feature/confirm/route';
import { confirmFeaturePaymentForUser } from '@/lib/payments/feature-complete';
import { PaymentFlowError } from '@/lib/payments/complete';
import { createClient } from '@/lib/supabase/server';

const USER_ID = 'user-feat-001';
const REF = 'cache-key-abc';

function makeClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function url(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/payments/feature/confirm?${qs}`);
}

const OK_PARAMS = {
  paymentKey: 'pay-key',
  orderId: 'twoday_1_abcd12',
  amount: '800',
  feature: 'hapcard',
  ref: REF,
  next: '/hapcard/abc',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue(makeClient() as never);
  vi.mocked(confirmFeaturePaymentForUser).mockResolvedValue({
    status: 'confirmed',
    feature: 'hapcard',
    ref: REF,
  });
});

describe('GET /api/payments/feature/confirm', () => {
  it('성공 → confirm 후 next(allowlist)로 303, paid=ref 부착', async () => {
    const res = await GET(url(OK_PARAMS));

    expect(confirmFeaturePaymentForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      orderId: 'twoday_1_abcd12',
      paymentKey: 'pay-key',
      amount: 800,
      feature: 'hapcard',
      ref: REF,
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`http://localhost/hapcard/abc?paid=${REF}`);
  });

  it('replay=1 → next 에 replay=1 부착', async () => {
    const res = await GET(url({ ...OK_PARAMS, feature: 'replay', next: '/hapcard/abc', replay: '1' }));

    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('paid=');
    expect(loc).toContain('replay=1');
  });

  it('open-redirect 방지 — allowlist 밖 next 는 /feed 로 대체', async () => {
    const res = await GET(url({ ...OK_PARAMS, next: '//evil.com/phish' }));

    const loc = res.headers.get('location') ?? '';
    expect(loc).not.toContain('evil.com');
    expect(loc).toContain('/feed');
    expect(loc).toContain(`paid=${REF}`);
    // 결제는 정상 확정됨 (돈은 실제로 받음)
    expect(confirmFeaturePaymentForUser).toHaveBeenCalled();
  });

  it('amount 가 정수 아니면 confirm 미호출, 실패 페이지', async () => {
    const res = await GET(url({ ...OK_PARAMS, amount: 'abc' }));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_CONFIRM_INVALID');
  });

  it('알 수 없는 feature → confirm 미호출, 실패 페이지', async () => {
    const res = await GET(url({ ...OK_PARAMS, feature: 'tokens_10' }));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
  });

  it('확정 실패(변조) → 실패 페이지 + 코드', async () => {
    vi.mocked(confirmFeaturePaymentForUser).mockRejectedValue(
      new PaymentFlowError('PAYMENT_AMOUNT_MISMATCH', '결제 금액이 주문과 다릅니다.', 400),
    );

    const res = await GET(url(OK_PARAMS));

    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_AMOUNT_MISMATCH');
  });

  it('미인증 → confirm 미호출, 실패 페이지 UNAUTHORIZED', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never);

    const res = await GET(url(OK_PARAMS));

    expect(confirmFeaturePaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('UNAUTHORIZED');
  });
});
