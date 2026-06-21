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

  // UIDesign(M3 Expressive) 타깃: 활성 탭은 아이콘 뒤에 둥근 캡슐 'pill' 인디케이터를 가진다.
  // pill 배경 = --p-90, 전경 = --p-10, 라벨 700. (system.css .tabbar .ti.on .ic)
  describe('활성 탭 M3 pill 인디케이터', () => {
    it('활성 탭은 아이콘 캡슐에 --p-90 배경 pill 을 가진다', () => {
      renderWithProviders(<AppNav items={items} />, { routerEntries: ['/feed'] });
      const tabs = screen.getAllByRole('tab');
      const active = tabs.find((t) => t.getAttribute('aria-current') === 'page');
      expect(active).toBeTruthy();
      const pill = active!.firstElementChild as HTMLElement;
      expect(pill.style.background).toContain('var(--p-90)');
    });

    it('비활성 탭의 아이콘 캡슐은 pill 배경(--p-90)이 없다', () => {
      renderWithProviders(<AppNav items={items} />, { routerEntries: ['/feed'] });
      const tabs = screen.getAllByRole('tab');
      const inactive = tabs.find((t) => t.getAttribute('aria-current') !== 'page');
      expect(inactive).toBeTruthy();
      const pill = inactive!.firstElementChild as HTMLElement;
      expect(pill.style.background).not.toContain('var(--p-90)');
    });

    it('활성 탭 라벨은 --p-10 색 + 700 굵기', () => {
      renderWithProviders(<AppNav items={items} />, { routerEntries: ['/me'] });
      const tabs = screen.getAllByRole('tab');
      const active = tabs.find((t) => t.getAttribute('aria-current') === 'page');
      expect(active!.style.color).toContain('var(--p-10)');
      expect(active!.style.fontWeight).toBe('700');
    });
  });
});
