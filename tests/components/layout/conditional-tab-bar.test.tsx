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

async function renderConditionalTabBar(pathname: string) {
  mockPathname = pathname;
  const { ConditionalTabBar } = await import('@/components/layout/conditional-tab-bar');
  return render(<ConditionalTabBar />);
}

describe('ConditionalTabBar', () => {
  it('/에서 TabBar를 렌더한다', async () => {
    await renderConditionalTabBar('/');
    expect(screen.getByRole('link', { name: /너랑나랑/ })).toBeInTheDocument();
  });

  it('/feed에서 TabBar를 렌더한다', async () => {
    await renderConditionalTabBar('/feed');
    expect(screen.getByRole('link', { name: /너랑나랑/ })).toBeInTheDocument();
  });

  it('/me에서 TabBar를 렌더한다', async () => {
    await renderConditionalTabBar('/me');
    expect(screen.getByRole('link', { name: /내 사주맵/ })).toBeInTheDocument();
  });

  it('/onboarding에서 TabBar를 렌더하지 않는다', async () => {
    await renderConditionalTabBar('/onboarding');
    expect(screen.queryByRole('link', { name: /너랑나랑/ })).not.toBeInTheDocument();
  });

  it('/relations/new에서 TabBar를 렌더하지 않는다', async () => {
    await renderConditionalTabBar('/relations/new');
    expect(screen.queryByRole('link', { name: /너랑나랑/ })).not.toBeInTheDocument();
  });

  it('/onboarding/step 하위 경로에서 TabBar를 렌더하지 않는다', async () => {
    await renderConditionalTabBar('/onboarding/step');
    expect(screen.queryByRole('link', { name: /너랑나랑/ })).not.toBeInTheDocument();
  });
});
