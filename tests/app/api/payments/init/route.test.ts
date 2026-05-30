import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service-role');

import { POST } from '@/app/api/payments/init/route';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const USER_ID = 'user-payment-001';

function makeServerClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function makeServiceClient() {
  const single = vi.fn().mockResolvedValue({
      data: {
        payment_id: 'payment-001',
        toss_order_id: 'osa_1_abcdef',
        toss_customer_key: 'customer_00000000-0000-4000-8000-000000000001',
        product_id: 'tokens_50',
        amount_krw: 4500,
      token_amount: 55,
      status: 'pending',
    },
    error: null,
  });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from }, insert };
}

function request(body: unknown) {
  return new Request('http://localhost/api/payments/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/payments/init', () => {
  it('서버 상품 가격으로 pending 주문을 생성한다', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client as never);

    const res = await POST(request({ product_id: 'tokens_50' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(service.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        product_id: 'tokens_50',
        amount_krw: 4500,
        token_amount: 55,
        status: 'pending',
        toss_payment_key: null,
        toss_customer_key: expect.stringMatching(/^[A-Za-z0-9_=.@-]{2,300}$/),
        toss_order_id: expect.stringMatching(/^[A-Za-z0-9_-]{6,64}$/),
      }),
    );
    expect(body.payment.order_name).toBe('부적 55개');
    expect(body.payment.customer_key).toBe('customer_00000000-0000-4000-8000-000000000001');
  });

  it('클라이언트가 보낸 임의 가격 필드는 무시한다', async () => {
    const service = makeServiceClient();
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(service.client as never);

    await POST(request({ product_id: 'tokens_100', amount_krw: 1 }));

    expect(service.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'tokens_100',
        amount_krw: 8000,
        token_amount: 120,
      }),
    );
  });
});
