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

  it('DB update 실패 로그에 birth_date/birth_time/gender 원본을 남기지 않는다', async () => {
    const service = makeService();
    service.updateIn.mockResolvedValueOnce({
      error: { message: 'payment update failed birth_date=1991-03-15 birth_time=14:30 gender=F' },
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await markPaymentFailedForUser({
      userId: 'user-001',
      orderId: 'osa_1_abcdef',
      code: 'PAYMENT_FAILED',
      message: '결제를 완료하지 못했습니다.',
      serviceClient: service as never,
    });

    const calls = JSON.stringify(consoleSpy.mock.calls);
    expect(calls).not.toContain('1991-03-15');
    expect(calls).not.toContain('14:30');
    expect(calls).not.toContain('gender=F');
    expect(calls).toContain('birth_date=[redacted]');
    expect(calls).toContain('birth_time=[redacted]');
    expect(calls).toContain('gender=[redacted]');
  });
});
