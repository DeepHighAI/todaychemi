// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardHeader } from '@/components/hapcard/header';

describe('HapcardHeader', () => {
  const defaultProps = {
    mode: '친구합',
    userPillar: '갑인',
    userElement: '목' as const,
    relationPillar: '병오',
    relationElement: '화' as const,
  };

  it('data-testid="hapcard-header" 렌더', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(document.querySelector('[data-testid="hapcard-header"]')).not.toBeNull();
  });

  it('본인 일주 텍스트(갑인) 표시', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('갑인')).toBeInTheDocument();
  });

  it('인연 일주 텍스트(병오) 표시', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('병오')).toBeInTheDocument();
  });

  it('mode 라벨 표시 (친구합)', () => {
    renderWithProviders(<HapcardHeader {...defaultProps} />);
    expect(screen.getByText('친구합')).toBeInTheDocument();
  });
});
