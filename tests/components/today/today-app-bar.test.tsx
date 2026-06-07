// @vitest-environment jsdom

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/render-with-providers';
import { TodayAppBar } from '@/components/today/today-app-bar';

const themeMock = vi.hoisted(() => ({
  resolvedTheme: 'light' as 'light' | 'dark',
  setTheme: vi.fn(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: themeMock.resolvedTheme,
    setTheme: themeMock.setTheme,
  }),
}));

describe('TodayAppBar', () => {
  beforeEach(() => {
    themeMock.resolvedTheme = 'light';
    themeMock.setTheme.mockClear();
  });

  it('"오늘의 케미" 제목을 h1로 렌더한다', () => {
    renderWithProviders(<TodayAppBar />);
    expect(screen.getByRole('heading', { level: 1, name: '오늘의 케미' })).toBeInTheDocument();
  });

  it('/relations/new 링크를 렌더한다', () => {
    renderWithProviders(<TodayAppBar />);
    const link = screen.getByRole('link', { name: '인연 등록' });
    expect(link).toHaveAttribute('href', '/relations/new');
  });

  it('우측 끝에 라이트/다크 전환 버튼을 렌더하고 클릭 시 다크 모드로 전환한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TodayAppBar />);

    const link = screen.getByRole('link', { name: '인연 등록' });
    const button = screen.getByRole('button', { name: '다크 모드로 전환' });
    const rightGroup = link.parentElement;

    expect(rightGroup).not.toBeNull();
    expect(within(rightGroup!).getByRole('button', { name: '다크 모드로 전환' })).toBe(button);
    expect(rightGroup!.lastElementChild).toBe(button);

    await user.click(button);

    expect(themeMock.setTheme).toHaveBeenCalledWith('dark');
  });
});
