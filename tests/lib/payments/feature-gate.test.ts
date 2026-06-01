import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payments/feature-unlock');

import { isFeatureUnlocked } from '@/lib/payments/feature-unlock';
import { resolveFeatureCharge } from '@/lib/payments/feature-gate';

const USER_ID = 'user-uuid-001';
const REF = 'cache-key-abc';

function makeService(deductResult: { data?: unknown; error?: unknown } = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: deductResult.data ?? null,
    error: deductResult.error ?? null,
  });
  return { service: { rpc } as never, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveFeatureCharge (하이브리드 과금 분기)', () => {
  it('이미 잠금해제됨 → mode=unlocked, 과금/deduct 호출 없음', async () => {
    vi.mocked(isFeatureUnlocked).mockResolvedValue(true);
    const { service, rpc } = makeService();

    const res = await resolveFeatureCharge(service, USER_ID, 'hapcard', REF);

    expect(res.mode).toBe('unlocked');
    expect(res.charged).toBe(false);
    expect(res.price.amount_krw).toBe(800);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('잔액 충분 + 신규 차감(inserted:true) → mode=free, charged=true', async () => {
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false);
    const { service, rpc } = makeService({ data: { balance_after: 92, inserted: true } });

    const res = await resolveFeatureCharge(service, USER_ID, 'hapcard', REF);

    expect(res.mode).toBe('free');
    expect(res.charged).toBe(true);
    expect(rpc).toHaveBeenCalledWith('deduct_tokens_once', {
      uid: USER_ID,
      delta: -8,
      reason: 'hapcard_use',
      ref: REF,
    });
  });

  it('멱등 재호출(inserted:false) → mode=free, charged=false (재환불 방지)', async () => {
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false);
    const { service } = makeService({ data: { balance_after: 92, inserted: false } });

    const res = await resolveFeatureCharge(service, USER_ID, 'whatif', REF);

    expect(res.mode).toBe('free');
    expect(res.charged).toBe(false);
  });

  it('잔액 부족(deduct error) → mode=pay_required, charged=false, price 반환', async () => {
    vi.mocked(isFeatureUnlocked).mockResolvedValue(false);
    const { service } = makeService({ error: { message: 'INSUFFICIENT_TOKENS', code: 'P0001' } });

    const res = await resolveFeatureCharge(service, USER_ID, 'replay', REF);

    expect(res.mode).toBe('pay_required');
    expect(res.charged).toBe(false);
    expect(res.price.amount_krw).toBe(400);
    expect(res.price.token_cost).toBe(4);
  });
});
