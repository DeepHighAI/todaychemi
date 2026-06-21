import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import type { OhaengElement } from '@/lib/saju/elementLabel';
import { OhaengRadar } from './ohaeng-radar';

function counts(o: Partial<Record<OhaengElement, number>>): Record<OhaengElement, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...o };
}

describe('OhaengRadar (오행 5축 레이더)', () => {
  it('레이더 카드와 svg(오각맵)를 렌더한다', () => {
    renderWithProviders(<OhaengRadar data={counts({ 목: 3, 화: 2, 토: 1, 금: 1, 수: 1 })} />);
    const card = screen.getByTestId('ohaeng-radar');
    expect(within(card).getByRole('img', { name: '오행 오각맵' })).toBeInTheDocument();
  });

  it('5개 한글 원소 라벨을 순서대로 렌더한다', () => {
    const { container } = renderWithProviders(
      <OhaengRadar data={counts({ 목: 2, 화: 2, 토: 2, 금: 1, 수: 1 })} />,
    );
    const labels = Array.from(container.querySelectorAll('svg text')).map((n) => n.textContent);
    expect(labels).toEqual(['목', '화', '토', '금', '수']);
  });

  it('가장 강한/약한 기운 칩에 최다·최소 원소와 카운트를 표시한다', () => {
    renderWithProviders(<OhaengRadar data={counts({ 목: 4, 화: 2, 토: 1, 금: 1, 수: 0 })} />);
    expect(screen.getByText('가장 강한 기운')).toBeInTheDocument();
    expect(screen.getByText('가장 약한 기운')).toBeInTheDocument();
    // 최다=목(4), 최소=수(0)
    expect(screen.getByText('목 · 4')).toBeInTheDocument();
    expect(screen.getByText('수 · 0')).toBeInTheDocument();
  });

  it('한자(木火土金水)를 노출하지 않는다 (ADR-038)', () => {
    renderWithProviders(<OhaengRadar data={counts({ 목: 3, 화: 2, 토: 1, 금: 1, 수: 1 })} />);
    const card = screen.getByTestId('ohaeng-radar');
    expect(card.textContent ?? '').not.toMatch(/[木火土金水]/);
  });

  it('채움 다각형에 primary(--p-40) 색을 쓴다', () => {
    const { container } = renderWithProviders(
      <OhaengRadar data={counts({ 목: 3, 화: 2, 토: 2, 금: 1, 수: 0 })} />,
    );
    expect(container.querySelector('polygon[fill="var(--p-40)"]')).not.toBeNull();
  });

  it('칩에 원소 soft tone 배경을 적용한다', () => {
    renderWithProviders(<OhaengRadar data={counts({ 목: 4, 화: 1, 토: 1, 금: 1, 수: 1 })} />);
    const strongest = screen.getByText('가장 강한 기운').closest('div');
    expect(strongest?.style.background).toContain('var(--accent-wood-soft)');
  });
});
