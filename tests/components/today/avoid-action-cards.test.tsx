// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { AvoidActionCards } from '@/components/today/avoid-action-cards';
import type { DailyHapCard } from '@/types/dailyHap';

const card: DailyHapCard = {
  headline: '좋은 에너지가 흐르는 날',
  headline_reason: '목기운이 강해요',
  avoid_phrase: '비난하는 말',
  avoid_phrase_reason: '갈등을 유발할 수 있어요',
  favorable_action: '새로운 시도',
  favorable_action_reason: '화기운이 도와줘요',
  reused_from_yesterday: false,
};

describe('AvoidActionCards', () => {
  it('"오늘 피할 말" 레이블을 렌더한다', () => {
    renderWithProviders(<AvoidActionCards card={card} />);
    expect(screen.getByText('오늘 피할 말')).toBeInTheDocument();
  });

  it('"오늘 좋은 행동" 레이블을 렌더한다', () => {
    renderWithProviders(<AvoidActionCards card={card} />);
    expect(screen.getByText('오늘 좋은 행동')).toBeInTheDocument();
  });

  it('avoid_phrase와 avoid_phrase_reason을 렌더한다', () => {
    renderWithProviders(<AvoidActionCards card={card} />);
    expect(screen.getByText('비난하는 말')).toBeInTheDocument();
    expect(screen.getByText('갈등을 유발할 수 있어요')).toBeInTheDocument();
  });

  it('favorable_action과 favorable_action_reason을 렌더한다', () => {
    renderWithProviders(<AvoidActionCards card={card} />);
    expect(screen.getByText('새로운 시도')).toBeInTheDocument();
    expect(screen.getByText('화기운이 도와줘요')).toBeInTheDocument();
  });

  it('두 카드가 별도 요소로 존재한다', () => {
    const { container } = renderWithProviders(<AvoidActionCards card={card} />);
    expect(container.querySelectorAll('[data-card]')).toHaveLength(2);
  });

  it('avoid_phrase의 한자를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<AvoidActionCards card={{ ...card, avoid_phrase: '火克金 충돌' }} />);
    expect(screen.getByText('화극금 충돌')).toBeInTheDocument();
  });

  it('avoid_phrase_reason의 한자를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<AvoidActionCards card={{ ...card, avoid_phrase_reason: '酉金이 火를 누르는 흐름' }} />);
    expect(screen.getByText('유금이 화를 누르는 흐름')).toBeInTheDocument();
  });

  it('favorable_action의 한자를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<AvoidActionCards card={{ ...card, favorable_action: '木의 기운 활용' }} />);
    expect(screen.getByText('목의 기운 활용')).toBeInTheDocument();
  });

  it('favorable_action_reason의 한자를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<AvoidActionCards card={{ ...card, favorable_action_reason: '日主 火의 따뜻함' }} />);
    expect(screen.getByText('일주 화의 따뜻함')).toBeInTheDocument();
  });

  it('빈 문구가 내려와도 기본 안내를 렌더한다', () => {
    renderWithProviders(
      <AvoidActionCards
        card={{
          ...card,
          avoid_phrase: '',
          avoid_phrase_reason: '',
          favorable_action: '',
          favorable_action_reason: '',
        }}
      />,
    );

    expect(screen.getByText('급하게 단정하는 말')).toBeInTheDocument();
    expect(screen.getByText(/중요한 판단은 조금 천천히/)).toBeInTheDocument();
    expect(screen.getByText('가벼운 정리부터 하기')).toBeInTheDocument();
    expect(screen.getByText(/하루 흐름을 안정적으로/)).toBeInTheDocument();
  });
});
