// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => {
    const map: Record<string, Record<string, string>> = {
      'nav.tab': { home: '홈', feed: '너랑나랑', me: '내 사주맵' },
    };
    return map[ns]?.[key] ?? key;
  },
}));

async function renderTabBar(pathname = '/') {
  mockPathname = pathname;
  const { TabBar } = await import('@/components/layout/tab-bar');
  return render(<TabBar />);
}

describe('TabBar', () => {
  it('3개 탭(홈·너랑나랑·내 사주맵)을 렌더한다', async () => {
    await renderTabBar('/');
    expect(screen.getByRole('link', { name: /홈/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /너랑나랑/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내 사주맵/ })).toBeInTheDocument();
  });

  it('홈 탭의 href는 /이다', async () => {
    await renderTabBar('/');
    const home = screen.getByRole('link', { name: /홈/ });
    expect(home).toHaveAttribute('href', '/');
  });

  it('너랑나랑 탭의 href는 /feed이다', async () => {
    await renderTabBar('/');
    const feed = screen.getByRole('link', { name: /너랑나랑/ });
    expect(feed).toHaveAttribute('href', '/feed');
  });

  it('내 사주맵 탭의 href는 /me이다', async () => {
    await renderTabBar('/');
    const me = screen.getByRole('link', { name: /내 사주맵/ });
    expect(me).toHaveAttribute('href', '/me');
  });

  it('현재 경로가 /이면 홈 탭이 aria-current="page"이다', async () => {
    await renderTabBar('/');
    const home = screen.getByRole('link', { name: /홈/ });
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('현재 경로가 /feed이면 너랑나랑 탭이 aria-current="page"이다', async () => {
    await renderTabBar('/feed');
    const feed = screen.getByRole('link', { name: /너랑나랑/ });
    expect(feed).toHaveAttribute('aria-current', 'page');
  });

  it('현재 경로가 /me이면 내 사주맵 탭이 aria-current="page"이다', async () => {
    await renderTabBar('/me');
    const me = screen.getByRole('link', { name: /내 사주맵/ });
    expect(me).toHaveAttribute('aria-current', 'page');
  });
});
