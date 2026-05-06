// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { TodayHero } from '@/components/today/today-hero';
import type { DailyHapCard } from '@/types/dailyHap';

const card: DailyHapCard = {
  headline: '좋은 에너지가 흐르는 날',
  headline_reason: '목기운이 강해 창의력이 높아요',
  avoid_phrase: '비난하는 말',
  avoid_phrase_reason: '갈등을 유발할 수 있어요',
  favorable_action: '새로운 시도',
  favorable_action_reason: '화기운이 도와줘요',
  reused_from_yesterday: false,
};

describe('TodayHero', () => {
  it('headline 텍스트를 렌더한다', () => {
    renderWithProviders(<TodayHero card={card} />);
    expect(screen.getByText('좋은 에너지가 흐르는 날')).toBeInTheDocument();
  });

  it('headline_reason 텍스트를 렌더한다', () => {
    renderWithProviders(<TodayHero card={card} />);
    expect(screen.getByText('목기운이 강해 창의력이 높아요')).toBeInTheDocument();
  });

  it('wrapper에 bg-liquid-hero 클래스가 있다', () => {
    const { container } = renderWithProviders(<TodayHero card={card} />);
    expect(container.querySelector('.bg-liquid-hero')).toBeInTheDocument();
  });

  it('reused_from_yesterday=true면 "어제 이어감" 칩을 렌더한다', () => {
    renderWithProviders(<TodayHero card={{ ...card, reused_from_yesterday: true }} />);
    expect(screen.getByText('어제 이어감')).toBeInTheDocument();
  });

  it('reused_from_yesterday=false면 칩을 렌더하지 않는다', () => {
    renderWithProviders(<TodayHero card={card} />);
    expect(screen.queryByText('어제 이어감')).toBeNull();
  });
});
