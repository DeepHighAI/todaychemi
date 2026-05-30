import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server');

import { GET } from '@/app/api/payments/order/route';
import { createClient } from '@/lib/supabase/server';

const USER_ID = 'user-payment-001';

function makePayment(status = 'pending') {
  return {
    payment_id: 'payment-001',
    toss_order_id: 'osa_1_abcdef',
    toss_customer_key: 'customer_00000000-0000-4000-8000-000000000001',
    product_id: 'tokens_10',
    amount_krw: 1000,
    token_amount: 10,
    status,
  };
}

function makeClient(opts: {
  userId?: string | null;
  payment?: unknown | null;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: opts.userId === null ? null : { id: opts.userId ?? USER_ID } },
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.payment ?? null, error: null });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  return { auth: { getUser }, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOSS_CLIENT_KEY', 'test_ck_widget');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/payments/order', () => {
  it('본인 pending 주문을 Toss checkout payload로 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({
        payment: makePayment('pending'),
      }) as never,
    );

    const res = await GET(new NextRequest('http://localhost/api/payments/order?orderId=osa_1_abcdef'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.order.client_key).toBe('test_ck_widget');
    expect(body.order.customer_key).toBe('customer_00000000-0000-4000-8000-000000000001');
    expect(body.order.order_name).toBe('부적 10개');
  });

  it('failed 주문은 재시도용 Toss checkout payload로 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ payment: makePayment('failed') }) as never,
    );

    const res = await GET(new NextRequest('http://localhost/api/payments/order?orderId=osa_1_abcdef'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.order.status).toBe('failed');
    expect(body.order.client_key).toBe('test_ck_widget');
  });

  it('confirmed 주문은 widget payload 대신 완료 상태를 반환한다', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ payment: makePayment('confirmed') }) as never,
    );

    const res = await GET(new NextRequest('http://localhost/api/payments/order?orderId=osa_1_abcdef'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe('PAYMENT_ALREADY_CONFIRMED');
    expect(body.order).toBeUndefined();
  });

  it.each(['tampered', 'invalid', 'refunded'])('%s 주문은 widget payload를 반환하지 않는다', async (status) => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ payment: makePayment(status) }) as never,
    );

    const res = await GET(new NextRequest('http://localhost/api/payments/order?orderId=osa_1_abcdef'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe('PAYMENT_NOT_PAYABLE');
    expect(body.order).toBeUndefined();
  });

  it('다른 사용자 주문이거나 없는 주문이면 404', async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient({ payment: null }) as never);

    const res = await GET(new NextRequest('http://localhost/api/payments/order?orderId=missing'));

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('PAYMENT_NOT_FOUND');
  });

  it('Toss client key 환경변수가 없으면 JSON 에러를 반환한다', async () => {
    vi.unstubAllEnvs();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createClient).mockResolvedValue(
      makeClient({
        payment: makePayment('pending'),
      }) as never,
    );

    const res = await GET(new NextRequest('http://localhost/api/payments/order?orderId=osa_1_abcdef'));

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });
});
