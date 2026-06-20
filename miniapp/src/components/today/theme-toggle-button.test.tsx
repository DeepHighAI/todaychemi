import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { usePreferences } from '@/lib/preferences/use-preferences';
import { THEME_STORAGE_KEY } from '@/lib/preferences/storage';
import { ThemeToggleButton } from './theme-toggle-button';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  usePreferences.setState({ themePreference: null, resolvedTheme: 'light', fontScale: 'normal' });
});

describe('ThemeToggleButton', () => {
  it('라이트 상태에서 "다크 모드로 전환" 라벨을 노출한다', () => {
    renderWithProviders(<ThemeToggleButton />);
    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument();
  });

  it('클릭하면 다크로 전환되고 라벨·저장값이 바뀐다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggleButton />);

    await user.click(screen.getByRole('button', { name: '다크 모드로 전환' }));

    expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();
    expect(usePreferences.getState().resolvedTheme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
