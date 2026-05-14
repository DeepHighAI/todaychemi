// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

describe('MeHero', () => {
  it('IljuChip — 일주 값(甲戌 → 갑술) 렌더 (ADR-038: convertHanja 적용)', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.getByText('갑술')).toBeInTheDocument();
    expect(screen.queryByText('甲戌')).not.toBeInTheDocument();
  });

  it('eyebrow "일주" 렌더', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.getAllByText('일주').length).toBeGreaterThanOrEqual(1);
  });

  it('data-testid="me-hero" 존재', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.getByTestId('me-hero')).toBeInTheDocument();
  });

  it('eyebrow 라벨에 hanja title="日柱" (pillarDescriptor 사용 확인)', () => {
    const { container } = renderWithProviders(<MeHero chart={CHART} />);
    expect(container.querySelector('[title="日柱"]')).not.toBeNull();
  });

  it('onEditClick prop 없으면 연필 아이콘 버튼 미렌더', () => {
    renderWithProviders(<MeHero chart={CHART} />);
    expect(screen.queryByRole('button', { name: /수정/ })).toBeNull();
  });

  it('onEditClick prop 있을 때 연필 버튼 클릭 시 onEditClick 호출', () => {
    const onEditClick = vi.fn();
    renderWithProviders(<MeHero chart={CHART} onEditClick={onEditClick} />);
    const btn = screen.getByRole('button', { name: /수정/ });
    fireEvent.click(btn);
    expect(onEditClick).toHaveBeenCalledOnce();
  });
});
