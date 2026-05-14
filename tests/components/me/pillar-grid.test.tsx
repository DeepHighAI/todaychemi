// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { PillarGrid } from '@/components/me/pillar-grid';
import type { ChartCore } from '@/types/chart';

const CHART: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: null,
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

describe('PillarGrid', () => {
  it('4개 柱 레이블(년주/월주/일주/시주) 렌더', () => {
    renderWithProviders(<PillarGrid chart={CHART} />);
    expect(screen.getByText('년주')).toBeInTheDocument();
    expect(screen.getByText('월주')).toBeInTheDocument();
    expect(screen.getAllByText('일주').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('시주')).toBeInTheDocument();
  });

  it('柱 값이 한글 reading으로 렌더 (ADR-038)', () => {
    renderWithProviders(<PillarGrid chart={CHART} />);
    expect(screen.getByText('신미')).toBeInTheDocument();
    expect(screen.getByText('계묘')).toBeInTheDocument();
    expect(screen.getByText('갑술')).toBeInTheDocument();
    expect(screen.queryByText('辛未')).not.toBeInTheDocument();
    expect(screen.queryByText('癸卯')).not.toBeInTheDocument();
    expect(screen.queryByText('甲戌')).not.toBeInTheDocument();
  });

  it('hour_pillar=null → "—" 렌더', () => {
    renderWithProviders(<PillarGrid chart={CHART} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('data-testid="pillar-grid" 존재', () => {
    renderWithProviders(<PillarGrid chart={CHART} />);
    expect(screen.getByTestId('pillar-grid')).toBeInTheDocument();
  });

  it('년주 라벨에 hanja title="年柱" (pillarDescriptor 사용 확인)', () => {
    const { container } = renderWithProviders(<PillarGrid chart={CHART} />);
    expect(container.querySelector('[title="年柱"]')).not.toBeNull();
  });

  it('일주 라벨에 hanja title="日柱"', () => {
    const { container } = renderWithProviders(<PillarGrid chart={CHART} />);
    expect(container.querySelector('[title="日柱"]')).not.toBeNull();
  });
});
