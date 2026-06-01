import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payments/toss-server');

import { confirmFeaturePaymentForUser } from '@/lib/payments/feature-complete';
import { PaymentFlowError } from '@/lib/payments/complete';
import { confirmTossPayment } from '@/lib/payments/toss-server';
import type { Database } from '@/types/database.types';

const USER_ID = 'user-001';
const ORDER_ID = 'twoday_1_abcdef';
const PAYMENT_KEY = 'toss-pay-key-001';
const REF = 'cache-key-abc';

const FEATURE_PAYMENT: Database['public']['Tables']['payments']['Row'] = {
  payment_id: 'payment-feat-001',
  user_id: USER_ID,
  toss_order_id: ORDER_ID,
  toss_payment_key: null,
  product_id: null,
  charge_type: 'feature_use',
  feature_id: 'hapcard',
  feature_ref: REF,
  amount_krw: 800,
  token_amount: null,
  toss_customer_key: 'customer_x',
  status: 'pending',
  confirmed_at: null,
  receipt_url: null,
  failure_code: null,
  failure_message: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

function makeService(opts: { payment?: typeof FEATURE_PAYMENT; rpcResult?: string } = {}) {
  const payment = opts.payment === undefined ? FEATURE_PAYMENT : opts.payment;
  const maybeSingle = vi.fn().mockResolvedValue({ data: payment, error: null });
  const selEq2 = vi.fn().mockReturnValue({ maybeSingle });
  const selEq1 = vi.fn().mockReturnValue({ eq: selEq2 });
  const select = vi.fn().mockReturnValue({ eq: selEq1 });

  const updateIn = vi.fn().mockResolvedValue({ error: null });
  const updEq2 = vi.fn().mockReturnValue({ in: updateIn });
  const updEq1 = vi.fn().mockReturnValue({ eq: updEq2 });
  const update = vi.fn().mockReturnValue({ eq: updEq1 });

  const from = vi.fn().mockReturnValue({ select, update });
  const rpc = vi.fn().mockResolvedValue({ data: opts.rpcResult ?? 'confirmed', error: null });
  return { client: { from, rpc } as never, from, rpc, update };
}

function tossDone(overrides: Record<string, unknown> = {}) {
  return {
    paymentKey: PAYMENT_KEY,
    orderId: ORDER_ID,
    status: 'DONE',
    totalAmount: 800,
    approvedAt: '2026-06-01T01:00:00Z',
    receipt: { url: 'https://receipt' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('confirmFeaturePaymentForUser (피처 결제 확정 — 토큰 적립 없음)', () => {
  it('정상 → confirm_feature_payment RPC 로 확정, status=confirmed', async () => {
    const service = makeService();
    vi.mocked(confirmTossPayment).mockResolvedValue(tossDone() as never);

    const res = await confirmFeaturePaymentForUser({
      userId: USER_ID,
      orderId: ORDER_ID,
      paymentKey: PAYMENT_KEY,
      amount: 800,
      feature: 'hapcard',
      ref: REF,
      serviceClient: service.client,
    });

    expect(res.status).toBe('confirmed');
    expect(res.feature).toBe('hapcard');
    expect(res.ref).toBe(REF);
    expect(service.rpc).toHaveBeenCalledWith(
      'confirm_feature_payment',
      expect.objectContaining({
        uid: USER_ID,
        p_toss_order_id: ORDER_ID,
        p_feature_id: 'hapcard',
        p_feature_ref: REF,
        p_amount_krw: 800,
      }),
    );
  });

  it('멱등 — 이미 confirmed(같은 paymentKey) → already_confirmed, RPC/Toss 미호출', async () => {
    const service = makeService({
      payment: { ...FEATURE_PAYMENT, status: 'confirmed', toss_payment_key: PAYMENT_KEY },
    });

    const res = await confirmFeaturePaymentForUser({
      userId: USER_ID,
      orderId: ORDER_ID,
      paymentKey: PAYMENT_KEY,
      amount: 800,
      feature: 'hapcard',
      ref: REF,
      serviceClient: service.client,
    });

    expect(res.status).toBe('already_confirmed');
    expect(confirmTossPayment).not.toHaveBeenCalled();
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it('RPC 가 already_confirmed 반환(레이스) → status=already_confirmed', async () => {
    const service = makeService({ rpcResult: 'already_confirmed' });
    vi.mocked(confirmTossPayment).mockResolvedValue(tossDone() as never);

    const res = await confirmFeaturePaymentForUser({
      userId: USER_ID,
      orderId: ORDER_ID,
      paymentKey: PAYMENT_KEY,
      amount: 800,
      feature: 'hapcard',
      ref: REF,
      serviceClient: service.client,
    });

    expect(res.status).toBe('already_confirmed');
  });

  it('금액 변조(amount != 주문) → tampered 마킹 + PAYMENT_AMOUNT_MISMATCH', async () => {
    const service = makeService();

    await expect(
      confirmFeaturePaymentForUser({
        userId: USER_ID,
        orderId: ORDER_ID,
        paymentKey: PAYMENT_KEY,
        amount: 100,
        feature: 'hapcard',
        ref: REF,
        serviceClient: service.client,
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'tampered' }),
    );
    expect(confirmTossPayment).not.toHaveBeenCalled();
  });

  it('피처/ref 불일치 → invalid 마킹 + PAYMENT_FEATURE_MISMATCH', async () => {
    const service = makeService();

    await expect(
      confirmFeaturePaymentForUser({
        userId: USER_ID,
        orderId: ORDER_ID,
        paymentKey: PAYMENT_KEY,
        amount: 800,
        feature: 'whatif', // 주문은 hapcard
        ref: REF,
        serviceClient: service.client,
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FEATURE_MISMATCH' });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'invalid' }),
    );
  });

  it('Toss 승인 결과 non-DONE → invalid 마킹 + TOSS_CONFIRM_MISMATCH', async () => {
    const service = makeService();
    vi.mocked(confirmTossPayment).mockResolvedValue(tossDone({ status: 'CANCELED' }) as never);

    await expect(
      confirmFeaturePaymentForUser({
        userId: USER_ID,
        orderId: ORDER_ID,
        paymentKey: PAYMENT_KEY,
        amount: 800,
        feature: 'hapcard',
        ref: REF,
        serviceClient: service.client,
      }),
    ).rejects.toMatchObject({ code: 'TOSS_CONFIRM_MISMATCH' });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'invalid' }),
    );
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it('주문 없음 → PAYMENT_NOT_FOUND', async () => {
    const service = makeService({ payment: undefined as never });
    // payment=null
    const nullService = makeService();
    nullService.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        }),
      }),
      update: vi.fn(),
    });

    await expect(
      confirmFeaturePaymentForUser({
        userId: USER_ID,
        orderId: ORDER_ID,
        paymentKey: PAYMENT_KEY,
        amount: 800,
        feature: 'hapcard',
        ref: REF,
        serviceClient: nullService.client,
      }),
    ).rejects.toBeInstanceOf(PaymentFlowError);
    void service;
  });
});
