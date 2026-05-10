// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardCtaBar } from '@/components/hapcard/cta-bar';

describe('HapcardCtaBar', () => {
  it('primary action 클릭 시 onAction 콜백 호출', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onShare = vi.fn();
    renderWithProviders(<HapcardCtaBar onAction={onAction} onShare={onShare} />);
    await user.click(screen.getByText('이렇게 해봐'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('share 버튼 클릭 시 onShare 콜백 호출', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onShare = vi.fn();
    renderWithProviders(<HapcardCtaBar onAction={onAction} onShare={onShare} />);
    await user.click(screen.getByText('공유'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('fixed 위치 클래스 + safe-area inline style', () => {
    renderWithProviders(<HapcardCtaBar onAction={vi.fn()} onShare={vi.fn()} />);
    const root = screen.getByTestId('hapcard-cta-bar');
    expect(root.className).toContain('fixed');
    expect(root.className).toContain('left-0');
    expect(root.className).toContain('right-0');
    expect(root.className).toContain('z-40');
    expect(root).toHaveStyle({
      bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom))',
    });
  });

  it('a11y region + testid 렌더', () => {
    renderWithProviders(<HapcardCtaBar onAction={vi.fn()} onShare={vi.fn()} />);
    const root = screen.getByTestId('hapcard-cta-bar');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('role', 'region');
    expect(root).toHaveAttribute('aria-label', '합카드 액션');
  });
});
