import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { TodayHero } from './today-hero';
import type { DailyHapCard } from '@/types/dailyHap';

const EMPTY_RELATION_CARD: DailyHapCard = {
  headline: '오늘은 부드럽게 시작해요',
  headline_reason: '서두르지 않으면 흐름이 좋아요',
  avoid_phrase: '단정',
  avoid_phrase_reason: '테스트',
  favorable_action: '천천히 말하기',
  favorable_action_reason: '테스트',
  reused_from_yesterday: false,
};

describe('TodayHero', () => {
  it('인연 0건 CTA 는 다크 모드에서도 대비가 나는 primary 토큰 조합을 사용한다', () => {
    renderWithProviders(<TodayHero card={EMPTY_RELATION_CARD} />);

    const cta = screen.getByRole('link', { name: '인연 등록하고 오늘 케미 보기' });
    expect(cta.style.backgroundColor).toContain('var(--primary)');
    expect(cta.style.color).toContain('var(--primary-foreground)');
  });
});
