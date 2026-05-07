// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { DayMasterCard } from '@/components/me/day-master-card';

describe('DayMasterCard', () => {
  it('eyebrow "일간 (日干)" 렌더', () => {
    renderWithProviders(<DayMasterCard element="목" />);
    expect(screen.getByText('일간 (日干)')).toBeInTheDocument();
  });

  it('목 → 나무 기질 설명 렌더', () => {
    renderWithProviders(<DayMasterCard element="목" />);
    expect(screen.getByText('나무처럼 곧고 뻗어나가는 기질을 지니고 있어요.')).toBeInTheDocument();
  });

  it('화 → 불 기질 설명 렌더', () => {
    renderWithProviders(<DayMasterCard element="화" />);
    expect(screen.getByText('불처럼 밝고 활기찬 기질을 지니고 있어요.')).toBeInTheDocument();
  });

  it('토 → 땅 기질 설명 렌더', () => {
    renderWithProviders(<DayMasterCard element="토" />);
    expect(screen.getByText('땅처럼 안정적이고 신뢰가 두터운 기질을 지니고 있어요.')).toBeInTheDocument();
  });

  it('금 → 쇠 기질 설명 렌더', () => {
    renderWithProviders(<DayMasterCard element="금" />);
    expect(screen.getByText('쇠처럼 단단하고 결단력이 있는 기질을 지니고 있어요.')).toBeInTheDocument();
  });

  it('수 → 물 기질 설명 렌더', () => {
    renderWithProviders(<DayMasterCard element="수" />);
    expect(screen.getByText('물처럼 유연하고 지혜로운 기질을 지니고 있어요.')).toBeInTheDocument();
  });

  it('data-testid="day-master-card" 존재', () => {
    renderWithProviders(<DayMasterCard element="목" />);
    expect(screen.getByTestId('day-master-card')).toBeInTheDocument();
  });
});
