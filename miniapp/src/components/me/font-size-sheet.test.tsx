import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { usePreferences } from '@/lib/preferences/use-preferences';
import { FONT_SCALE_STORAGE_KEY } from '@/lib/preferences/storage';
import { FontSizeSheet } from './font-size-sheet';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-font-scale');
  usePreferences.setState({ themePreference: null, resolvedTheme: 'light', fontScale: 'normal' });
});

describe('FontSizeSheet', () => {
  it('open 이면 보통·크게 옵션을 노출한다', () => {
    renderWithProviders(<FontSizeSheet open onOpenChange={() => {}} />);
    expect(screen.getByRole('button', { name: '보통' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '크게' })).toBeInTheDocument();
  });

  it('크게 선택 시 setFontScale 가 저장·적용된다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FontSizeSheet open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: '크게' }));

    expect(usePreferences.getState().fontScale).toBe('large');
    expect(localStorage.getItem(FONT_SCALE_STORAGE_KEY)).toBe('large');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('large');
  });

  it('open=false 면 옵션을 렌더하지 않는다', () => {
    renderWithProviders(<FontSizeSheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole('button', { name: '크게' })).not.toBeInTheDocument();
  });
});
