import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmTossPayment, getTossPayment, TossPaymentError } from '@/lib/payments/toss-server';

const TOSS_PAYMENT = {
  paymentKey: 'pay-key',
  orderId: 'osa_1_abcdef',
  status: 'DONE',
  totalAmount: 1000,
  approvedAt: '2026-05-21T01:00:00Z',
  receipt: { url: 'https://example.com/receipt' },
};

beforeEach(() => {
  vi.stubEnv('TOSS_SECRET_KEY', 'test_sk_secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Toss server API utilities', () => {
  it('confirm API는 SECRET_KEY: trailing colon으로 Basic Auth를 만들고 Idempotency-Key를 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(TOSS_PAYMENT), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await confirmTossPayment({
      paymentKey: 'pay-key',
      orderId: 'osa_1_abcdef',
      amount: 1000,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe('POST');
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('test_sk_secret:', 'utf8').toString('base64')}`);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(JSON.parse(init.body as string)).toEqual({
      paymentKey: 'pay-key',
      orderId: 'osa_1_abcdef',
      amount: 1000,
    });
  });

  it('query API는 paymentKey로 결제 상태를 조회한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(TOSS_PAYMENT), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const payment = await getTossPayment('pay/key with space');

    expect(payment?.status).toBe('DONE');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tosspayments.com/v1/payments/pay%2Fkey%20with%20space',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('query API 404는 null로 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));

    await expect(getTossPayment('missing')).resolves.toBeNull();
  });

  it('Toss 오류 응답은 TossPaymentError로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'NOT_MATCHES_REQUESTED_AMOUNT', message: '금액이 다릅니다.' }), {
          status: 400,
        }),
      ),
    );

    await expect(confirmTossPayment({
      paymentKey: 'pay-key',
      orderId: 'osa_1_abcdef',
      amount: 1,
    })).rejects.toBeInstanceOf(TossPaymentError);
  });
});
