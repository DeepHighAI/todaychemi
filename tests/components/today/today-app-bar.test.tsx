// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { TodayAppBar } from '@/components/today/today-app-bar';

describe('TodayAppBar', () => {
  it('"오늘의 합" 제목을 h1로 렌더한다', () => {
    renderWithProviders(<TodayAppBar />);
    expect(screen.getByRole('heading', { level: 1, name: '오늘의 합' })).toBeInTheDocument();
  });

  it('/relations/new 링크를 렌더한다', () => {
    renderWithProviders(<TodayAppBar />);
    const link = screen.getByRole('link', { name: '인연 등록' });
    expect(link).toHaveAttribute('href', '/relations/new');
  });
});
