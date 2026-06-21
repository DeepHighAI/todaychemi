import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import type { OhaengElement } from '@/lib/saju/elementLabel';
import { HapcardMiniRadar } from './mini-radar';

function counts(o: Partial<Record<OhaengElement, number>>): Record<OhaengElement, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...o };
}

describe('HapcardMiniRadar', () => {
  it('레이더 svg 와 본인/인연 범례를 렌더한다', () => {
    renderWithProviders(
      <HapcardMiniRadar user={counts({ 목: 3, 화: 2 })} relation={counts({ 수: 3, 금: 2 })} />,
    );
    const wrap = screen.getByTestId('hapcard-mini-radar');
    expect(wrap.querySelector('svg[aria-label="오행 비교 오각형"]')).not.toBeNull();
    expect(screen.getByText('본인')).toBeInTheDocument();
    expect(screen.getByText('인연')).toBeInTheDocument();
  });
});
