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

describe('AppLayout', () => {
  it('TabBar를 렌더한다', async () => {
    const { default: AppLayout } = await import('@/app/(app)/layout');
    render(<AppLayout><div data-testid="child" /></AppLayout>);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /홈/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /합피드/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내사주/ })).toBeInTheDocument();
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
