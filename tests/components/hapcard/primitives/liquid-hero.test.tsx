// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiquidHero } from '@/components/hapcard/primitives/liquid-hero';

describe('LiquidHero', () => {
  it('점수 숫자를 렌더', () => {
    render(<LiquidHero score={73} tier="good" />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  it('tier 라벨(좋음)을 렌더', () => {
    render(<LiquidHero score={73} tier="good" />);
    expect(screen.getByText('좋음')).toBeInTheDocument();
  });

  it('bg-liquid-hero 클래스 적용', () => {
    const { container } = render(<LiquidHero score={73} tier="good" />);
    expect(container.querySelector('.bg-liquid-hero')).not.toBeNull();
  });

  it('children을 렌더 (breakdown 메타)', () => {
    render(
      <LiquidHero score={73} tier="good">
        <span data-testid="breakdown">메타 텍스트</span>
      </LiquidHero>,
    );
    expect(screen.getByTestId('breakdown')).toBeInTheDocument();
  });

  it('tier=weak → 약함', () => {
    render(<LiquidHero score={20} tier="weak" />);
    expect(screen.getByText('약함')).toBeInTheDocument();
  });

  it('tier=fair → 보통', () => {
    render(<LiquidHero score={50} tier="fair" />);
    expect(screen.getByText('보통')).toBeInTheDocument();
  });

  it('tier=great → 매우 좋음', () => {
    render(<LiquidHero score={90} tier="great" />);
    expect(screen.getByText('매우 좋음')).toBeInTheDocument();
  });
});
