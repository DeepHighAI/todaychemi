import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { usePreferences } from '@/lib/preferences/use-preferences';
import { TodayAppBar } from './today-app-bar';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  usePreferences.setState({ themePreference: null, resolvedTheme: 'light', fontScale: 'normal' });
});

describe('TodayAppBar', () => {
  it('인사말을 렌더하고 테마 토글 버튼은 렌더하지 않는다', () => {
    renderWithProviders(<TodayAppBar />);
    expect(screen.getByRole('heading', { name: '오늘의 케미' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /모드로 전환/ })).not.toBeInTheDocument();
  });

  it('우측 상단 인연 등록 링크는 더 이상 렌더하지 않는다', () => {
    renderWithProviders(<TodayAppBar />);
    expect(screen.queryByRole('link', { name: '인연 등록' })).not.toBeInTheDocument();
  });
});
