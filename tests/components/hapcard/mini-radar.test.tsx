// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { HapcardMiniRadar } from '@/components/hapcard/mini-radar';
import { renderWithIntl } from '../../utils/render-with-intl';

const USER = { 목: 30, 화: 20, 토: 20, 금: 15, 수: 15 };
const RELATION = { 목: 10, 화: 25, 토: 25, 금: 25, 수: 15 };

describe('HapcardMiniRadar', () => {
  it('i18n 타이틀 "오행 비교" 표시', () => {
    renderWithIntl(<HapcardMiniRadar user={USER} relation={RELATION} />);
    expect(screen.getByText('오행 비교')).toBeInTheDocument();
  });

  it('본인/인연 범례 라벨 표시', () => {
    renderWithIntl(<HapcardMiniRadar user={USER} relation={RELATION} />);
    expect(screen.getByText('본인')).toBeInTheDocument();
    expect(screen.getByText('인연')).toBeInTheDocument();
  });

  it('내부 MiniRadar SVG 렌더 (role=img)', () => {
    renderWithIntl(<HapcardMiniRadar user={USER} relation={RELATION} />);
    expect(screen.getByRole('img', { name: /오행 비교 오각형/ })).toBeInTheDocument();
  });

  it('전달된 user counts 가 user polygon 에 반영', () => {
    const { container } = renderWithIntl(<HapcardMiniRadar user={USER} relation={RELATION} />);
    const userPoly = container.querySelector('polygon[data-series="user"]');
    const relPoly = container.querySelector('polygon[data-series="relation"]');
    expect(userPoly?.getAttribute('points')).toBeTruthy();
    expect(relPoly?.getAttribute('points')).toBeTruthy();
    // user 와 relation counts 가 다르므로 polygon points 도 달라야 함
    expect(userPoly?.getAttribute('points')).not.toBe(relPoly?.getAttribute('points'));
  });
});
