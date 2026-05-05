// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardActions } from '@/components/hapcard/actions';

describe('HapcardActions', () => {
  it('data-testid="hapcard-actions" 렌더', () => {
    renderWithProviders(<HapcardActions actions={[]} />);
    expect(document.querySelector('[data-testid="hapcard-actions"]')).not.toBeNull();
  });

  it('빈 배열 → empty 카피', () => {
    renderWithProviders(<HapcardActions actions={[]} />);
    expect(screen.getByText('조언이 아직 준비되지 않았어요.')).toBeInTheDocument();
  });

  it('3개 → 번호(1·2·3) + 텍스트 표시', () => {
    const actions = ['함께 산책하기', '진심을 전하기', '작은 선물하기'];
    renderWithProviders(<HapcardActions actions={actions} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('함께 산책하기')).toBeInTheDocument();
    expect(screen.getByText('진심을 전하기')).toBeInTheDocument();
    expect(screen.getByText('작은 선물하기')).toBeInTheDocument();
  });
});
