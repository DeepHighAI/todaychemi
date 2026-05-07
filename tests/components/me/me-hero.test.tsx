// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { MeHero } from '@/components/me/me-hero';
import type { ChartCore } from '@/types/chart';

const CHART: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
};

describe('MeHero', () => {
  it('IljuChip — 일주 값(甲戌) 렌더', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.getByText('甲戌')).toBeInTheDocument();
  });

  it('eyebrow "일주" 렌더', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.getAllByText('일주').length).toBeGreaterThanOrEqual(1);
  });

  it('data-testid="me-hero" 존재', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.getByTestId('me-hero')).toBeInTheDocument();
  });
});
