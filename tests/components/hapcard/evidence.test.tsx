// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardEvidence } from '@/components/hapcard/evidence';

describe('HapcardEvidence', () => {
  it('data-testid="hapcard-evidence" 렌더', () => {
    renderWithProviders(<HapcardEvidence cards={[]} />);
    expect(document.querySelector('[data-testid="hapcard-evidence"]')).not.toBeNull();
  });

  it('빈 배열 → empty 카피 표시', () => {
    renderWithProviders(<HapcardEvidence cards={[]} />);
    expect(screen.getByText('근거가 아직 준비되지 않았어요.')).toBeInTheDocument();
  });

  it('카드 2개 → title/reason 모두 표시', () => {
    const cards = [
      { title: '오행 조화', reason: '목과 화가 잘 맞아요.' },
      { title: '일주 상생', reason: '갑인과 병오는 상생 관계.' },
    ];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.getByText('오행 조화')).toBeInTheDocument();
    expect(screen.getByText('목과 화가 잘 맞아요.')).toBeInTheDocument();
    expect(screen.getByText('일주 상생')).toBeInTheDocument();
    expect(screen.getByText('갑인과 병오는 상생 관계.')).toBeInTheDocument();
  });
});
