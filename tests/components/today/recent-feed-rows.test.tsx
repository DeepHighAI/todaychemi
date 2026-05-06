// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { RecentFeedRows } from '@/components/today/recent-feed-rows';

const rows = [
  { id: 'r1', nickname: '진수', interpreted: true },
  { id: 'r2', nickname: '민지', interpreted: false },
];

describe('RecentFeedRows', () => {
  it('섹션 제목을 렌더한다', () => {
    renderWithProviders(<RecentFeedRows rows={rows} />);
    expect(screen.getByText('오늘 흐름이 좋은 인연')).toBeInTheDocument();
  });

  it('두 인연의 별명이 모두 보인다', () => {
    renderWithProviders(<RecentFeedRows rows={rows} />);
    expect(screen.getByText('진수')).toBeInTheDocument();
    expect(screen.getByText('민지')).toBeInTheDocument();
  });

  it('interpreted=false 항목에 자물쇠 아이콘이 있다', () => {
    renderWithProviders(<RecentFeedRows rows={rows} />);
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('interpreted=true 항목에는 자물쇠 아이콘이 없다', () => {
    renderWithProviders(<RecentFeedRows rows={[{ id: 'r1', nickname: '진수', interpreted: true }]} />);
    expect(screen.queryByTestId('lock-icon')).toBeNull();
  });

  it('rows가 비어있으면 EmptyState를 렌더한다', () => {
    renderWithProviders(<RecentFeedRows rows={[]} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
