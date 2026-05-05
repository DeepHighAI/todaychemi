// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardOhaeng } from '@/components/hapcard/ohaeng';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

describe('HapcardOhaeng', () => {
  const props = {
    userCounts: mockChartCoreSelf.five_elements_counts,
    relationCounts: mockChartCoreRelation.five_elements_counts,
  };

  it('data-testid="hapcard-ohaeng" 렌더', () => {
    renderWithProviders(<HapcardOhaeng {...props} />);
    expect(document.querySelector('[data-testid="hapcard-ohaeng"]')).not.toBeNull();
  });

  it('"본인" 라벨 표시', () => {
    renderWithProviders(<HapcardOhaeng {...props} />);
    expect(screen.getByText('본인')).toBeInTheDocument();
  });

  it('"인연" 라벨 표시', () => {
    renderWithProviders(<HapcardOhaeng {...props} />);
    expect(screen.getByText('인연')).toBeInTheDocument();
  });

  it('OhaengBars가 2개 렌더 (본인 + 인연)', () => {
    renderWithProviders(<HapcardOhaeng {...props} />);
    // 각 set에 5개 bars × 2 set = 10개 progressbar
    expect(screen.getAllByRole('progressbar')).toHaveLength(10);
  });
});
