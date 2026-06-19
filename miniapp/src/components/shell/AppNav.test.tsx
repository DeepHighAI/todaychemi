import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { AppNav } from './AppNav';

const items = [
  { to: '/', label: '오늘', icon: <span /> },
  { to: '/feed', label: '피드', icon: <span /> },
  { to: '/me', label: '나', icon: <span /> },
];

describe('AppNav', () => {
  // 요구사항: "모든 팝업과 내용은 하단의 네비게이션 바 위로 위치해야 함".
  // 페이지 콘텐츠는 z 1~10, 모달/시트/오버레이는 z 40~60 이므로,
  // 탭바는 그 사이(콘텐츠 위·모달 아래)에 위치해야 모든 팝업이 탭바 위로 뜬다.
  it('탭바 z-index 는 모달/시트 레이어(40 이상) 아래여서 팝업이 탭바를 덮을 수 있다', () => {
    renderWithProviders(<AppNav items={items} />);
    const nav = screen.getByRole('tablist', { name: '메인 탭' });
    const z = Number(nav.style.zIndex);
    expect(Number.isNaN(z)).toBe(false);
    expect(z).toBeLessThan(40);
  });

  it('탭바는 페이지 콘텐츠(z 1~10) 위에 위치한다', () => {
    renderWithProviders(<AppNav items={items} />);
    const nav = screen.getByRole('tablist', { name: '메인 탭' });
    expect(Number(nav.style.zIndex)).toBeGreaterThan(10);
  });
});
