import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server');
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/payments/complete', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payments/complete')>('@/lib/payments/complete');
  return {
    ...actual,
    confirmPaymentForUser: vi.fn(),
  };
});

import { GET } from '@/app/api/payments/confirm/route';
import { confirmPaymentForUser, PaymentFlowError } from '@/lib/payments/complete';
import { createClient } from '@/lib/supabase/server';

const USER_ID = 'user-payment-001';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue(makeClient() as never);
  vi.mocked(confirmPaymentForUser).mockResolvedValue({
    status: 'confirmed',
    balance_after: 10,
    payment: {} as never,
  });
});

describe('GET /api/payments/confirm', () => {
  it('success redirect query를 서버 confirm으로 확정한 뒤 성공 페이지로 보낸다', async () => {
    const res = await GET(new NextRequest(
      'http://localhost/api/payments/confirm?paymentKey=pay-key&orderId=twoday_1_abcd12&amount=1000',
    ));

    expect(confirmPaymentForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      paymentKey: 'pay-key',
      orderId: 'twoday_1_abcd12',
      amount: 1000,
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/payments/success?orderId=twoday_1_abcd12');
  });

  it('query amount가 숫자가 아니면 confirm을 호출하지 않는다', async () => {
    const res = await GET(new NextRequest(
      'http://localhost/api/payments/confirm?paymentKey=pay-key&orderId=twoday_1_abcd12&amount=abc',
    ));

    expect(confirmPaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_CONFIRM_INVALID');
  });

  it('amount mismatch는 실패 페이지로 보낸다', async () => {
    vi.mocked(confirmPaymentForUser).mockRejectedValue(
      new PaymentFlowError('PAYMENT_AMOUNT_MISMATCH', '결제 금액이 주문과 다릅니다.', 400),
    );

    const res = await GET(new NextRequest(
      'http://localhost/api/payments/confirm?paymentKey=pay-key&orderId=twoday_1_abcd12&amount=1',
    ));

    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('PAYMENT_AMOUNT_MISMATCH');
  });

  it('로그인 사용자가 없으면 confirm을 호출하지 않는다', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never);

    const res = await GET(new NextRequest(
      'http://localhost/api/payments/confirm?paymentKey=pay-key&orderId=twoday_1_abcd12&amount=1000',
    ));

    expect(confirmPaymentForUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/payments/fail');
    expect(res.headers.get('location')).toContain('UNAUTHORIZED');
  });
});
