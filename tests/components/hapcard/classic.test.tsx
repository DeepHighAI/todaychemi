// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardClassic } from '@/components/hapcard/classic';

describe('HapcardClassic', () => {
  it('data-testid="hapcard-classic" 렌더', () => {
    renderWithProviders(<HapcardClassic citations={[]} />);
    expect(document.querySelector('[data-testid="hapcard-classic"]')).not.toBeNull();
  });

  it('빈 배열 → empty 카피', () => {
    renderWithProviders(<HapcardClassic citations={[]} />);
    expect(screen.getByText('관련 풀이 근거가 아직 준비되지 않았어요.')).toBeInTheDocument();
  });

  it('인용 1개 → source/original/modern 표시', () => {
    const citations = [
      { source: '적천수 제1장', original: '天干動而不靜', modern: '천간은 움직이며 멈추지 않는다.' },
    ];
    renderWithProviders(<HapcardClassic citations={citations} />);
    expect(screen.getByText('적천수 제1장')).toBeInTheDocument();
    expect(screen.getByText('天干動而不靜')).toBeInTheDocument();
    expect(screen.getByText('천간은 움직이며 멈추지 않는다.')).toBeInTheDocument();
  });
});
