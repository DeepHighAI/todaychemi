import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTheme, usePreferences } from './use-preferences';
import { FONT_SCALE_STORAGE_KEY, THEME_STORAGE_KEY } from './storage';

function resetStore() {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-font-scale');
  usePreferences.setState({ themePreference: null, resolvedTheme: 'light', fontScale: 'normal' });
}

describe('resolveTheme', () => {
  afterEach(() => vi.restoreAllMocks());

  it('명시 다크 선호값도 light 로 해석한다', () => {
    expect(resolveTheme('dark')).toBe('light');
    expect(resolveTheme('light')).toBe('light');
  });

  it('null(시스템) 은 light 로 해석한다', () => {
    expect(resolveTheme(null)).toBe('light');
  });

  it('OS 다크 선호가 있어도 light 로 해석한다', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(resolveTheme(null)).toBe('light');
  });
});

describe('usePreferences', () => {
  beforeEach(() => resetStore());
  afterEach(() => vi.restoreAllMocks());

  it('setFontScale(large) 는 저장·상태·<html data-font-scale> 를 갱신한다', () => {
    usePreferences.getState().setFontScale('large');

    expect(usePreferences.getState().fontScale).toBe('large');
    expect(localStorage.getItem(FONT_SCALE_STORAGE_KEY)).toBe('large');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('large');
  });

  it('setFontScale(normal) 는 data-font-scale 속성을 제거한다', () => {
    usePreferences.getState().setFontScale('large');
    usePreferences.getState().setFontScale('normal');

    expect(usePreferences.getState().fontScale).toBe('normal');
    expect(localStorage.getItem(FONT_SCALE_STORAGE_KEY)).toBe('normal');
    expect(document.documentElement.hasAttribute('data-font-scale')).toBe(false);
  });

  it('reloadFromStorage 는 저장된 다크 선호를 무시하고 light 를 유지한다', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, 'large');

    usePreferences.getState().reloadFromStorage();

    expect(usePreferences.getState().themePreference).toBeNull();
    expect(usePreferences.getState().resolvedTheme).toBe('light');
    expect(usePreferences.getState().fontScale).toBe('large');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('large');
  });
});
