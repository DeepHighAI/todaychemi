import { describe, it, expect } from 'vitest';
import { DAILY_HAP_ERROR_CODES, type DailyHapCard } from '@/types/dailyHap';

describe('DAILY_HAP_ERROR_CODES', () => {
  it('3개 코드', () => {
    expect(DAILY_HAP_ERROR_CODES).toHaveLength(3);
  });

  it('UNAUTHORIZED 포함', () => {
    expect(DAILY_HAP_ERROR_CODES).toContain('UNAUTHORIZED');
  });

  it('CHART_NOT_FOUND 포함', () => {
    expect(DAILY_HAP_ERROR_CODES).toContain('CHART_NOT_FOUND');
  });

  it('INTERNAL_ERROR 포함', () => {
    expect(DAILY_HAP_ERROR_CODES).toContain('INTERNAL_ERROR');
  });
});

// G2 (Phase 3 / C1) — 오늘카드 인연 종합 필드 확장
describe('DailyHapCard 인연 종합 필드 (G2)', () => {
  const baseCard: DailyHapCard = {
    headline: '오늘 메시지',
    headline_reason: '근거',
    avoid_phrase: '피할 말',
    avoid_phrase_reason: '근거',
    favorable_action: '좋은 행동',
    favorable_action_reason: '근거',
    reused_from_yesterday: false,
  };

  it('relation_id (인연 식별자)를 string | null | undefined 로 받는다', () => {
    const withId: DailyHapCard = { ...baseCard, relation_id: 'rel-abc-123' };
    const withNull: DailyHapCard = { ...baseCard, relation_id: null };
    expect(withId.relation_id).toBe('rel-abc-123');
    expect(withNull.relation_id).toBeNull();
    expect(baseCard.relation_id).toBeUndefined();
  });

  it('relation_nickname (인연 별명)을 string | null | undefined 로 받는다', () => {
    const withNick: DailyHapCard = { ...baseCard, relation_nickname: '민지' };
    const withNull: DailyHapCard = { ...baseCard, relation_nickname: null };
    expect(withNick.relation_nickname).toBe('민지');
    expect(withNull.relation_nickname).toBeNull();
  });

  it('today_compat_score (케미온도)를 number | null | undefined 로 받는다', () => {
    const withScore: DailyHapCard = { ...baseCard, today_compat_score: 78 };
    const withNull: DailyHapCard = { ...baseCard, today_compat_score: null };
    expect(withScore.today_compat_score).toBe(78);
    expect(withNull.today_compat_score).toBeNull();
  });

  it('is_fallback 은 response-only boolean marker 로 받는다', () => {
    const fallback: DailyHapCard = { ...baseCard, is_fallback: true };
    expect(fallback.is_fallback).toBe(true);
    expect(baseCard.is_fallback).toBeUndefined();
  });

  it('인연 필드 3개 모두 동시 노출 + JSON serialize 라운드트립', () => {
    const card: DailyHapCard = {
      ...baseCard,
      relation_id: 'rel-xyz',
      relation_nickname: '지수',
      today_compat_score: 65,
    };
    const round = JSON.parse(JSON.stringify(card)) as DailyHapCard;
    expect(round.relation_id).toBe('rel-xyz');
    expect(round.relation_nickname).toBe('지수');
    expect(round.today_compat_score).toBe(65);
  });
});
