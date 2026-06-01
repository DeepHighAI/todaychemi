import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payments/toss-server');

import { confirmPaymentForUser, markPaymentFailedForUser, PaymentFlowError } from '@/lib/payments/complete';
import { confirmTossPayment, getTossPayment, TossPaymentError } from '@/lib/payments/toss-server';
import type { Database } from '@/types/database.types';

const PAYMENT: Database['public']['Tables']['payments']['Row'] = {
  payment_id: 'payment-001',
  user_id: 'user-001',
  toss_order_id: 'osa_1_abcdef',
  toss_payment_key: null,
  product_id: 'tokens_10',
  charge_type: 'token_charge',
  feature_id: null,
  feature_ref: null,
  amount_krw: 1000,
  token_amount: 10,
  toss_customer_key: 'customer_00000000-0000-4000-8000-000000000001',
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
  const updateEq3 = vi.fn().mockResolvedValue({ error: null });
  const updateIn = vi.fn().mockResolvedValue({ error: null });
  const updateEq2 = vi.fn().mockReturnValue({ eq: updateEq3, in: updateIn });
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
  const update = vi.fn().mockReturnValue({ eq: updateEq1 });
  const from = vi.fn().mockReturnValue({ select, update });
  const rpc = vi.fn().mockResolvedValue({ data: 30, error: null });
  return { from, rpc, update, updateIn };
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

  it('tampered 주문은 이후 정상 금액 콜백으로도 승인하지 않는다', async () => {
    const service = makeService({ ...PAYMENT, status: 'tampered' });

    await expect(confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    })).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIRMABLE' });

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
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'tampered',
        failure_code: 'PAYMENT_AMOUNT_MISMATCH',
      }),
    );
  });

  it('failed 주문에서 success redirect 금액이 다르면 tampered로 전환한다', async () => {
    const service = makeService({ ...PAYMENT, status: 'failed' });

    await expect(confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1,
      serviceClient: service as never,
    })).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });

    expect(confirmTossPayment).not.toHaveBeenCalled();
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'tampered',
        failure_code: 'PAYMENT_AMOUNT_MISMATCH',
      }),
    );
    expect(service.updateIn).toHaveBeenCalledWith('status', ['pending', 'failed']);
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

  it('Toss query fallback 결과가 주문과 다르면 invalid로 저장하고 충전하지 않는다', async () => {
    const service = makeService({ ...PAYMENT, status: 'failed' });
    vi.mocked(confirmTossPayment).mockRejectedValue(
      new TossPaymentError('ALREADY_PROCESSED_PAYMENT', 'already processed', 400),
    );
    vi.mocked(getTossPayment).mockResolvedValue({
      paymentKey: 'pay-key',
      orderId: 'osa_1_abcdef',
      status: 'READY',
      totalAmount: 1000,
      approvedAt: null,
      receipt: null,
    });

    await expect(confirmPaymentForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      paymentKey: 'pay-key',
      amount: 1000,
      serviceClient: service as never,
    })).rejects.toMatchObject({ code: 'TOSS_CONFIRM_MISMATCH' });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'invalid',
        failure_code: 'TOSS_CONFIRM_MISMATCH',
      }),
    );
    expect(service.updateIn).toHaveBeenCalledWith('status', ['pending', 'failed']);
    expect(service.rpc).not.toHaveBeenCalled();
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

  it('failUrl 실패 기록은 pending 주문만 failed로 전환한다', async () => {
    const service = makeService({ ...PAYMENT, status: 'tampered' });

    await markPaymentFailedForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      code: 'PAYMENT_FAILED',
      message: '결제를 완료하지 못했습니다.',
      serviceClient: service as never,
    });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure_code: 'PAYMENT_FAILED',
      }),
    );
    expect(service.updateIn).toHaveBeenCalledWith('status', ['pending']);
  });
});
