import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markPaymentFailedForUser } from '@/lib/payments/complete';

function makeService() {
  const updateIn = vi.fn().mockResolvedValue({ error: null });
  const updateEq2 = vi.fn().mockReturnValue({ in: updateIn });
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
  const update = vi.fn().mockReturnValue({ eq: updateEq1 });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, updateIn };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('markPaymentFailedForUser', () => {
  it('failUrl 실패 기록은 pending 주문만 failed로 전환한다', async () => {
    const service = makeService();

    await markPaymentFailedForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      code: 'PAYMENT_FAILED',
      message: '결제를 완료하지 못했습니다.',
      serviceClient: service as never,
    });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failure_code: 'PAYMENT_FAILED' }),
    );
    expect(service.updateIn).toHaveBeenCalledWith('status', ['pending']);
  });
});
