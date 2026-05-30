import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTossPaymentsClientKey, getTossPaymentsSecretKey } from '@/lib/payments/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('TossPayments env helpers', () => {
  it('canonical TOSS_CLIENT_KEY / TOSS_SECRET_KEY를 우선 사용한다', () => {
    vi.stubEnv('TOSS_CLIENT_KEY', 'test_ck_canonical');
    vi.stubEnv('TOSS_PAYMENTS_CLIENT_KEY', 'test_ck_legacy');
    vi.stubEnv('TOSS_SECRET_KEY', 'test_sk_canonical');
    vi.stubEnv('TOSS_PAYMENTS_SECRET_KEY', 'test_sk_legacy');

    expect(getTossPaymentsClientKey()).toBe('test_ck_canonical');
    expect(getTossPaymentsSecretKey()).toBe('test_sk_canonical');
  });

  it('마이그레이션 기간에는 legacy alias를 fallback으로 허용한다', () => {
    vi.stubEnv('TOSS_PAYMENTS_CLIENT_KEY', 'test_ck_legacy');
    vi.stubEnv('TOSS_PAYMENTS_SECRET_KEY', 'test_sk_legacy');

    expect(getTossPaymentsClientKey()).toBe('test_ck_legacy');
    expect(getTossPaymentsSecretKey()).toBe('test_sk_legacy');
  });
});
