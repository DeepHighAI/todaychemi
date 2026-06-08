// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';

const { setThemeMock } = vi.hoisted(() => ({ setThemeMock: vi.fn() }));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: setThemeMock }),
}));

import { ThemeToggle } from '@/components/layout/theme-toggle';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ThemeToggle', () => {
  it('마운트 후 라이트/다크/시스템 라디오를 렌더한다', async () => {
    renderWithIntl(<ThemeToggle />);
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: '테마 선택' })).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: '라이트' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '다크' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '시스템' })).toBeInTheDocument();
  });

  it('현재 테마(system) 라디오가 checked 상태다', async () => {
    renderWithIntl(<ThemeToggle />);
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '시스템' })).toBeChecked();
    });
    expect(screen.getByRole('radio', { name: '라이트' })).not.toBeChecked();
  });

  it('라디오 클릭이 setTheme를 해당 값으로 호출한다', async () => {
    renderWithIntl(<ThemeToggle />);
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '다크' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: '다크' }));
    expect(setThemeMock).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByRole('radio', { name: '라이트' }));
    expect(setThemeMock).toHaveBeenCalledWith('light');
  });
});
