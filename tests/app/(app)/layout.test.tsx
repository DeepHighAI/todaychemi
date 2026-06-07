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

vi.mock('@/components/welcome/welcome-popup', () => ({
  WelcomePopup: () => null,
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => {
    const map: Record<string, Record<string, string>> = {
      'nav.tab': { home: '홈', feed: '케미피드', me: '내 프로필' },
      home: { greeting: '오늘의 케미', add_relation: '+ 인연', reused_label: '어제 기준', yesterday: '어제' },
      'welcome.popup': {
        title: '오늘케미',
        body: '오늘케미는\n오늘 만나는 누군가와의 관계에 도움을 주기 위한 서비스입니다.',
        cta: '누군가와의 오늘을 미리 보세요',
        button: '시작하기',
      },
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
    expect(screen.getByRole('link', { name: /케미피드/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내 프로필/ })).toBeInTheDocument();
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
