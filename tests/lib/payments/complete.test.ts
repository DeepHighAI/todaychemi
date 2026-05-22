import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payments/toss-server');

import { confirmPaymentForUser, PaymentFlowError } from '@/lib/payments/complete';
import { confirmTossPayment, getTossPayment, TossPaymentError } from '@/lib/payments/toss-server';
import type { Database } from '@/types/database.types';

const PAYMENT: Database['public']['Tables']['payments']['Row'] = {
  payment_id: 'payment-001',
  user_id: 'user-001',
  toss_order_id: 'osa_1_abcdef',
  toss_payment_key: null,
  product_id: 'tokens_10',
  amount_krw: 1000,
  token_amount: 10,
  status: 'pending',
  confirmed_at: null,
  receipt_url: null,
  failure_code: null,
  failure_message: null,
  created_at: '2026-05-21T00:00:00Z',
  updated_at: '2026-05-21T00:00:00Z',
};

function makeService(payment = PAYMENT) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: payment, error: null });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: 30, error: null });
  return { from, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(confirmTossPayment).mockResolvedValue({
    paymentKey: 'pay-key',
    orderId: 'osa_1_abcdef',
    status: 'DONE',
    totalAmount: 1000,
    approvedAt: '2026-05-21T01:00:00Z',
    receipt: { url: 'https://example.com/receipt' },
  });
  vi.mocked(getTossPayment).mockResolvedValue(null);
});

describe('confirmPaymentForUser', () => {
  it('Toss confirm 후 confirm_token_purchase RPC를 호출한다', async () => {
    const service = makeService();

    const result = await confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    });

    expect(result.status).toBe('confirmed');
    expect(confirmTossPayment).toHaveBeenCalledWith({
      paymentKey: 'pay-key',
      orderId: 'osa_1_abcdef',
      amount: 1000,
    });
    expect(service.rpc).toHaveBeenCalledWith('confirm_token_purchase', {
      uid: 'user-001',
      p_toss_order_id: 'osa_1_abcdef',
      p_toss_payment_key: 'pay-key',
      p_product_id: 'tokens_10',
      p_amount_krw: 1000,
      p_token_amount: 10,
      p_receipt_url: 'https://example.com/receipt',
      p_confirmed_at: '2026-05-21T01:00:00Z',
    });
  });

  it('이미 confirmed 주문은 중복 Toss/RPC 호출 없이 멱등 반환한다', async () => {
    const service = makeService({ ...PAYMENT, status: 'confirmed', toss_payment_key: 'pay-key' });

    const result = await confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    });

    expect(result.status).toBe('already_confirmed');
    expect(confirmTossPayment).not.toHaveBeenCalled();
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it('이미 confirmed 주문의 paymentKey가 다르면 멱등 성공으로 보지 않는다', async () => {
    const service = makeService({ ...PAYMENT, status: 'confirmed', toss_payment_key: 'other-pay-key' });

    await expect(confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    })).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_CONFIRMED_MISMATCH' });

    expect(confirmTossPayment).not.toHaveBeenCalled();
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it('success redirect 금액이 주문 금액과 다르면 승인 전 차단한다', async () => {
    const service = makeService();

    await expect(confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1,
      serviceClient: service as never,
    })).rejects.toBeInstanceOf(PaymentFlowError);

    expect(confirmTossPayment).not.toHaveBeenCalled();
  });

  it('Toss confirm 실패 후 조회 결과가 DONE이면 영구 실패로 보지 않고 충전한다', async () => {
    const service = makeService();
    vi.mocked(confirmTossPayment).mockRejectedValue(
      new TossPaymentError('ALREADY_PROCESSED_PAYMENT', 'already processed', 400),
    );
    vi.mocked(getTossPayment).mockResolvedValue({
      paymentKey: 'pay-key',
      orderId: 'osa_1_abcdef',
      status: 'DONE',
      totalAmount: 1000,
      approvedAt: '2026-05-21T01:00:00Z',
      receipt: { url: 'https://example.com/receipt' },
    });

    const result = await confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    });

    expect(result.status).toBe('confirmed');
    expect(getTossPayment).toHaveBeenCalledWith('pay-key');
    expect(service.rpc).toHaveBeenCalledOnce();
  });

  it('Toss confirm 실패 후 조회도 불가하면 재시도 가능 에러로 반환한다', async () => {
    const service = makeService();
    vi.mocked(confirmTossPayment).mockRejectedValue(
      new TossPaymentError('UNKNOWN_PAYMENT_ERROR', 'temporary failure', 502),
    );
    vi.mocked(getTossPayment).mockResolvedValue(null);

    await expect(confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    })).rejects.toMatchObject({ code: 'PAYMENT_CONFIRM_RETRYABLE' });

    expect(service.rpc).not.toHaveBeenCalled();
  });
});
