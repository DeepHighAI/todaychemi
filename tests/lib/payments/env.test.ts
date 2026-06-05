import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfigError } from '@/lib/config-error';
import { getTossPaymentsClientKey, getTossPaymentsSecretKey } from '@/lib/payments/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('TossPayments env helpers', () => {
  it('canonical TOSS_CLIENT_KEY / TOSS_SECRET_KEY를 우선 사용한다', () => {
    vi.stubEnv('TOSS_CLIENT_KEY', 'test_gck_canonical');
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', 'test_gck_public');
    vi.stubEnv('TOSS_PAYMENTS_CLIENT_KEY', 'test_gck_legacy');
    vi.stubEnv('TOSS_SECRET_KEY', 'test_gsk_canonical');
    vi.stubEnv('TOSS_PAYMENTS_SECRET_KEY', 'test_gsk_legacy');

    expect(getTossPaymentsClientKey()).toBe('test_gck_canonical');
    expect(getTossPaymentsSecretKey()).toBe('test_gsk_canonical');
  });

  it('TOSS_CLIENT_KEY가 없으면 NEXT_PUBLIC_TOSS_CLIENT_KEY를 client key fallback으로 허용한다', () => {
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', 'test_gck_public');

    expect(getTossPaymentsClientKey()).toBe('test_gck_public');
  });

  it('마이그레이션 기간에는 legacy alias를 fallback으로 허용한다', () => {
    vi.stubEnv('TOSS_PAYMENTS_CLIENT_KEY', 'test_gck_legacy');
    vi.stubEnv('TOSS_PAYMENTS_SECRET_KEY', 'test_gsk_legacy');

    expect(getTossPaymentsClientKey()).toBe('test_gck_legacy');
    expect(getTossPaymentsSecretKey()).toBe('test_gsk_legacy');
  });

  it('로컬/비프로덕션에서는 Toss docs widget key로 초기 렌더를 허용한다', () => {
    expect(getTossPaymentsClientKey()).toMatch(/^test_gck_docs_/);
    expect(getTossPaymentsSecretKey()).toMatch(/^test_gsk_docs_/);
  });

  it('프로덕션에서는 Toss key 누락 시 docs fallback을 사용하지 않는다', () => {
    vi.stubEnv('VERCEL_ENV', 'production');

    expect(() => getTossPaymentsClientKey()).toThrow(ConfigError);
    expect(() => getTossPaymentsSecretKey()).toThrow(ConfigError);
  });

  it('Payment Window용 test_ck/test_sk 키는 위젯 키로 허용하지 않는다', () => {
    vi.stubEnv('TOSS_CLIENT_KEY', 'test_ck_wrong_product');
    vi.stubEnv('TOSS_SECRET_KEY', 'test_sk_wrong_product');

    expect(() => getTossPaymentsClientKey()).toThrow(/Payment Widget key/);
    expect(() => getTossPaymentsSecretKey()).toThrow(/Payment Widget key/);
  });
});
