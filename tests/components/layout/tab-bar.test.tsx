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

async function renderTabBar(pathname = '/') {
  mockPathname = pathname;
  const { TabBar } = await import('@/components/layout/tab-bar');
  return render(<TabBar />);
}

describe('TabBar', () => {
  it('3개 탭(홈·합피드·내사주)을 렌더한다', async () => {
    await renderTabBar('/');
    expect(screen.getByRole('link', { name: /홈/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /합피드/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내사주/ })).toBeInTheDocument();
  });

  it('홈 탭의 href는 /이다', async () => {
    await renderTabBar('/');
    const home = screen.getByRole('link', { name: /홈/ });
    expect(home).toHaveAttribute('href', '/');
  });

  it('합피드 탭의 href는 /feed이다', async () => {
    await renderTabBar('/');
    const feed = screen.getByRole('link', { name: /합피드/ });
    expect(feed).toHaveAttribute('href', '/feed');
  });

  it('내사주 탭의 href는 /me이다', async () => {
    await renderTabBar('/');
    const me = screen.getByRole('link', { name: /내사주/ });
    expect(me).toHaveAttribute('href', '/me');
  });

  it('현재 경로가 /이면 홈 탭이 aria-current="page"이다', async () => {
    await renderTabBar('/');
    const home = screen.getByRole('link', { name: /홈/ });
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('현재 경로가 /feed이면 합피드 탭이 aria-current="page"이다', async () => {
    await renderTabBar('/feed');
    const feed = screen.getByRole('link', { name: /합피드/ });
    expect(feed).toHaveAttribute('aria-current', 'page');
  });

  it('현재 경로가 /me이면 내사주 탭이 aria-current="page"이다', async () => {
    await renderTabBar('/me');
    const me = screen.getByRole('link', { name: /내사주/ });
    expect(me).toHaveAttribute('aria-current', 'page');
  });
});
