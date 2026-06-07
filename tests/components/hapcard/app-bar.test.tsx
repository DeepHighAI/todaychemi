// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardAppBar } from '@/components/hapcard/app-bar';

const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

describe('HapcardAppBar', () => {
  beforeEach(() => {
    mockBack.mockReset();
  });

  it('타이틀과 testid 렌더', () => {
    renderWithProviders(<HapcardAppBar />);
    expect(screen.getByTestId('hapcard-app-bar')).toBeInTheDocument();
    expect(screen.getByText('오늘 케미')).toBeInTheDocument();
  });

  it('back 버튼 클릭 시 router.back() 호출', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HapcardAppBar />);
    const backBtn = screen.getByRole('button', { name: '뒤로' });
    expect(backBtn).toBeInTheDocument();
    await user.click(backBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('share 버튼 클릭 시 onShare 콜백 호출', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    renderWithProviders(<HapcardAppBar onShare={onShare} />);
    const shareBtn = screen.getByRole('button', { name: '공유' });
    expect(shareBtn).toBeInTheDocument();
    await user.click(shareBtn);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('sticky 위치 클래스 포함', () => {
    renderWithProviders(<HapcardAppBar />);
    const root = screen.getByTestId('hapcard-app-bar');
    expect(root.className).toContain('sticky');
    expect(root.className).toContain('top-0');
    expect(root.className).toContain('z-40');
    expect(root.className).toContain('bg-background/80');
    expect(root.className).toContain('backdrop-blur-sm');
    expect(root.className).toContain('border-b');
    expect(root.className).toContain('border-border');
  });
});
