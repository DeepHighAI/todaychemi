// @vitest-environment jsdom

import { afterEach, describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardOhaeng } from '@/components/hapcard/ohaeng';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

describe('HapcardOhaeng', () => {
  const interpretation = {
    title: '갑인 ↔ 병오 오행 해석',
    summary: '본인의 목 기운이 인연의 화 기운을 살려 주는 흐름입니다.',
    points: [
      { label: '중심 기질', body: '본인은 성장, 인연은 표현을 중심으로 움직입니다.' },
      { label: '균형 포인트', body: '서로 부족한 부분을 나누어 채울 수 있습니다.' },
      { label: '관계 흐름', body: '역할을 나누면 관계 흐름이 안정됩니다.' },
    ],
    tip: '대화 전에 기대치를 한 줄로 맞춰보세요.',
  };

  const props = {
    userCounts: mockChartCoreSelf.five_elements_counts,
    relationCounts: mockChartCoreRelation.five_elements_counts,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('공통 스케일 비교 그래프를 렌더', () => {
    renderWithProviders(<HapcardOhaeng {...props} />);
    expect(screen.getByTestId('ohaeng-comparison-chart')).toBeInTheDocument();
    expect(screen.getByTestId('ohaeng-row-목')).toBeInTheDocument();
    expect(screen.getByTestId('ohaeng-row-화')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(10);
  });

  it('본인과 인연 막대가 같은 최대값 기준으로 계산됨', () => {
    renderWithProviders(<HapcardOhaeng {...props} />);

    const userWood = screen.getByRole('progressbar', { name: '본인 목 3' });
    const relationWood = screen.getByRole('progressbar', { name: '인연 목 1' });
    const relationFire = screen.getByRole('progressbar', { name: '인연 화 3' });

    expect(userWood).toHaveAttribute('aria-valuemax', '3');
    expect(userWood).toHaveStyle({ width: '100%' });
    expect(relationWood).toHaveStyle({ width: '33%' });
    expect(relationFire).toHaveStyle({ width: '100%' });
  });

  it('저장된 오행 해석을 그래프 아래에 표시한다', () => {
    renderWithProviders(<HapcardOhaeng {...props} interpretation={interpretation} />);

    expect(screen.getByTestId('ohaeng-interpretation')).toBeInTheDocument();
    expect(screen.getByText('갑인 ↔ 병오 오행 해석')).toBeInTheDocument();
    expect(screen.getByText('중심 기질')).toBeInTheDocument();
    expect(screen.getByText('대화 전에 기대치를 한 줄로 맞춰보세요.')).toBeInTheDocument();
  });

  it('hapcardId가 있으면 규칙 해석 API를 호출해 표시한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ interpretation }), { status: 200 }),
    );

    renderWithProviders(<HapcardOhaeng {...props} hapcardId="hapcard-1" />);

    expect(await screen.findByText('갑인 ↔ 병오 오행 해석')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/hapcards/hapcard-1/ohaeng-interpretation');
  });
});
