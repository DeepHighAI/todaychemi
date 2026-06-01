import { describe, expect, it } from 'vitest';

import {
  FEATURE_PRICES_KRW,
  FeatureIdSchema,
  getFeaturePrice,
} from '@/lib/payments/feature-prices';

describe('feature-prices catalog (pay-per-use 단일 출처)', () => {
  it('확정 1회 가격: 합카드 800 / 만약합 500 / 다시합 400', () => {
    expect(FEATURE_PRICES_KRW.hapcard.amount_krw).toBe(800);
    expect(FEATURE_PRICES_KRW.whatif.amount_krw).toBe(500);
    expect(FEATURE_PRICES_KRW.replay.amount_krw).toBe(400);
  });

  it('token_cost 는 레거시 FEATURE_TOKEN_COSTS 와 동일 (8 / 5 / 4)', () => {
    expect(FEATURE_PRICES_KRW.hapcard.token_cost).toBe(8);
    expect(FEATURE_PRICES_KRW.whatif.token_cost).toBe(5);
    expect(FEATURE_PRICES_KRW.replay.token_cost).toBe(4);
  });

  it('각 항목은 자기 feature_id 와 비어있지 않은 order_name 을 가진다', () => {
    for (const f of ['hapcard', 'whatif', 'replay'] as const) {
      expect(FEATURE_PRICES_KRW[f].feature_id).toBe(f);
      expect(FEATURE_PRICES_KRW[f].order_name.length).toBeGreaterThan(0);
    }
  });

  it('getFeaturePrice 는 유효한 feature id 의 항목을 반환한다', () => {
    expect(getFeaturePrice('hapcard')).toEqual(FEATURE_PRICES_KRW.hapcard);
    expect(getFeaturePrice('whatif')).toEqual(FEATURE_PRICES_KRW.whatif);
  });

  it('getFeaturePrice 는 알 수 없는 id 에 null 을 반환한다 (레거시 토큰팩 포함)', () => {
    expect(getFeaturePrice('tokens_10')).toBeNull();
    expect(getFeaturePrice('')).toBeNull();
    expect(getFeaturePrice('deephap')).toBeNull();
  });

  it('FeatureIdSchema 는 3개 피처만 허용한다', () => {
    expect(FeatureIdSchema.safeParse('hapcard').success).toBe(true);
    expect(FeatureIdSchema.safeParse('whatif').success).toBe(true);
    expect(FeatureIdSchema.safeParse('replay').success).toBe(true);
    expect(FeatureIdSchema.safeParse('tokens_10').success).toBe(false);
  });
});
