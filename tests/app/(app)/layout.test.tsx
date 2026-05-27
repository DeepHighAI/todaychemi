// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock('@/components/rewards/free-talisman-reward-gate', () => ({
  FreeTalismanRewardGate: () => null,
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => {
    const map: Record<string, Record<string, string>> = {
      'nav.tab': { home: '홈', feed: '너랑나랑', me: '내 사주맵' },
      home: { greeting: '오늘의 사이', add_relation: '+ 인연', reused_label: '어제 기준', yesterday: '어제' },
    };
    return map[ns]?.[key] ?? key;
  },
}));

describe('AppLayout', () => {
  it('TabBar를 렌더한다', async () => {
    const { default: AppLayout } = await import('@/app/(app)/layout');
    render(<AppLayout><div data-testid="child" /></AppLayout>);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /홈/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /너랑나랑/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내 사주맵/ })).toBeInTheDocument();
  });

  it('children을 렌더한다', async () => {
    const { default: AppLayout } = await import('@/app/(app)/layout');
    render(<AppLayout><div data-testid="child">content</div></AppLayout>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('main 영역에 TabBar 높이만큼 하단 패딩이 있다 (pb-20 이상)', async () => {
    const { default: AppLayout } = await import('@/app/(app)/layout');
    const { container } = render(<AppLayout><div /></AppLayout>);
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main?.className).toMatch(/pb-/);
  });
});
