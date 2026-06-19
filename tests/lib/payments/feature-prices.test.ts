import { describe, expect, it } from 'vitest';

import {
  FEATURE_PRICES_KRW,
  FeatureIdSchema,
  FREE_RELATION_SLOTS,
  OPENING_DISCOUNT_LABEL,
  OPENING_DISCOUNT_PERCENT,
  getFeaturePrice,
} from '@/lib/payments/feature-prices';

describe('feature-prices catalog (pay-per-use 단일 출처)', () => {
  it('오픈초기 50% 할인 현금가: 케미카드 550 / 또 다른 나 440 / 케미 다시 맞추기 440 / 인연 등록 550', () => {
    expect(OPENING_DISCOUNT_PERCENT).toBe(50);
    expect(OPENING_DISCOUNT_LABEL).toBe('오픈초기 50% 할인');
    expect(FEATURE_PRICES_KRW.hapcard.amount_krw).toBe(550);
    expect(FEATURE_PRICES_KRW.whatif.amount_krw).toBe(440);
    expect(FEATURE_PRICES_KRW.replay.amount_krw).toBe(440);
    expect(FEATURE_PRICES_KRW.relation_slot.amount_krw).toBe(550);
  });

  it('정가 기준 금액은 결제창 원가 표시용으로 보존한다', () => {
    expect(FEATURE_PRICES_KRW.hapcard.list_amount_krw).toBe(1100);
    expect(FEATURE_PRICES_KRW.whatif.list_amount_krw).toBe(880);
    expect(FEATURE_PRICES_KRW.replay.list_amount_krw).toBe(880);
    expect(FEATURE_PRICES_KRW.relation_slot.list_amount_krw).toBe(1100);
  });

  it('token_cost 는 1부적 ≈ 100원 등가 (11 / 9 / 9 / 11)', () => {
    expect(FEATURE_PRICES_KRW.hapcard.token_cost).toBe(11);
    expect(FEATURE_PRICES_KRW.whatif.token_cost).toBe(9);
    expect(FEATURE_PRICES_KRW.replay.token_cost).toBe(9);
    expect(FEATURE_PRICES_KRW.relation_slot.token_cost).toBe(11);
  });

  it('각 항목은 자기 feature_id 와 비어있지 않은 order_name 을 가진다', () => {
    for (const f of ['hapcard', 'whatif', 'replay', 'relation_slot'] as const) {
      expect(FEATURE_PRICES_KRW[f].feature_id).toBe(f);
      expect(FEATURE_PRICES_KRW[f].order_name.length).toBeGreaterThan(0);
      expect(FEATURE_PRICES_KRW[f].discount_label).toBe(OPENING_DISCOUNT_LABEL);
    }
  });

  it('getFeaturePrice 는 유효한 feature id 의 항목을 반환한다', () => {
    expect(getFeaturePrice('hapcard')).toEqual(FEATURE_PRICES_KRW.hapcard);
    expect(getFeaturePrice('whatif')).toEqual(FEATURE_PRICES_KRW.whatif);
    expect(getFeaturePrice('relation_slot')).toEqual(FEATURE_PRICES_KRW.relation_slot);
  });

  it('getFeaturePrice 는 알 수 없는 id 에 null 을 반환한다 (레거시 토큰팩 포함)', () => {
    expect(getFeaturePrice('tokens_10')).toBeNull();
    expect(getFeaturePrice('')).toBeNull();
    expect(getFeaturePrice('deephap')).toBeNull();
  });

  it('인연 무료 슬롯은 2개 (모델 B — 3번째부터 과금)', () => {
    expect(FREE_RELATION_SLOTS).toBe(2);
  });

  it('llm_generated 플래그 — LLM 선생성 피처(3종)만 true, relation_slot 은 false', () => {
    // cash-gen 한도의 피처/reason 리스트가 이 플래그에서 파생된다 (3-list 드리프트 차단)
    expect(FEATURE_PRICES_KRW.hapcard.llm_generated).toBe(true);
    expect(FEATURE_PRICES_KRW.whatif.llm_generated).toBe(true);
    expect(FEATURE_PRICES_KRW.replay.llm_generated).toBe(true);
    expect(FEATURE_PRICES_KRW.relation_slot.llm_generated).toBe(false);
  });

  it('FeatureIdSchema 는 4개 피처만 허용한다', () => {
    expect(FeatureIdSchema.safeParse('hapcard').success).toBe(true);
    expect(FeatureIdSchema.safeParse('whatif').success).toBe(true);
    expect(FeatureIdSchema.safeParse('replay').success).toBe(true);
    expect(FeatureIdSchema.safeParse('relation_slot').success).toBe(true);
    expect(FeatureIdSchema.safeParse('tokens_10').success).toBe(false);
  });
});
