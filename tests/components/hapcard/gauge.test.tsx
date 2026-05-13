// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardGauge } from '@/components/hapcard/gauge';

const breakdown = { hap_chung_hyung_hae: 20, sipsin: 18, ohaeng: 22, mode_adjustment: 13, yunse_adjustment: 0 };

describe('HapcardGauge', () => {
  it('data-testid="hapcard-gauge" 렌더', () => {
    renderWithProviders(<HapcardGauge score={73} breakdown={breakdown} />);
    expect(document.querySelector('[data-testid="hapcard-gauge"]')).not.toBeNull();
  });

  it('점수 숫자(73) 표시', () => {
    renderWithProviders(<HapcardGauge score={73} breakdown={breakdown} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  it('score=73 → tier "좋음" 표시', () => {
    renderWithProviders(<HapcardGauge score={73} breakdown={breakdown} />);
    expect(screen.getByText('좋음')).toBeInTheDocument();
  });

  it('score=20 → tier "약함" 표시', () => {
    renderWithProviders(<HapcardGauge score={20} breakdown={breakdown} />);
    expect(screen.getByText('약함')).toBeInTheDocument();
  });

  it('score=50 → tier "보통" 표시', () => {
    renderWithProviders(<HapcardGauge score={50} breakdown={breakdown} />);
    expect(screen.getByText('보통')).toBeInTheDocument();
  });

  it('score=90 → tier "매우 좋음" 표시', () => {
    renderWithProviders(<HapcardGauge score={90} breakdown={breakdown} />);
    expect(screen.getByText('매우 좋음')).toBeInTheDocument();
  });

  it('breakdown 수치(20, 18, 22, 13) 표시', () => {
    renderWithProviders(<HapcardGauge score={73} breakdown={breakdown} />);
    expect(screen.getByText(/20/)).toBeInTheDocument();
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText(/22/)).toBeInTheDocument();
    expect(screen.getByText(/13/)).toBeInTheDocument();
  });

  it('ISSUE-2: 부동소수점 breakdown 값은 반올림하여 표시', () => {
    const floatBreakdown = {
      hap_chung_hyung_hae: 96.66666666666667,
      sipsin: 28.333333333333332,
      ohaeng: 15.0,
      mode_adjustment: 5.5,
      yunse_adjustment: 0,
    };
    renderWithProviders(<HapcardGauge score={73} breakdown={floatBreakdown} />);
    expect(screen.queryByText(/96\.666/)).not.toBeInTheDocument();
    expect(screen.queryByText(/28\.333/)).not.toBeInTheDocument();
    expect(screen.getByText(/97/)).toBeInTheDocument();
    expect(screen.getByText(/28/)).toBeInTheDocument();
  });
});
