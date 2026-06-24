import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

const api = vi.hoisted(() => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.startsWith('/api/today')) {
      return {
        ok: true,
        card: {
          headline: '오늘은 부드럽게 시작해요',
          headline_reason: '테스트 카드',
          avoid_phrase: '단정',
          avoid_phrase_reason: '테스트 카드',
          favorable_action: '천천히 말하기',
          favorable_action_reason: '테스트 카드',
          reused_from_yesterday: false,
        },
      };
    }
    if (path === '/api/relations') {
      return { items: [] };
    }
    return {};
  }),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: api.apiFetch,
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'tok' }),
}));

vi.mock('@/lib/me/use-me-chart', () => ({
  useMeChart: () => ({ data: { day_pillar: '甲子' }, isLoading: false, isError: false }),
}));

vi.mock('@/components/ads/ad-banner', () => ({
  AdBannerListItem: () => null,
}));

vi.mock('@/components/ads/rewarded-ad', () => ({
  RewardedAdCard: () => <section aria-label="리워드 광고" />,
}));

import { renderWithProviders } from '@/test/render';
import { HomePage } from './HomePage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('HomePage', () => {
  it('첫 진입 시 소개 Dialog 를 자동으로 열지 않는다', async () => {
    localStorage.removeItem('home_intro_popup_seen_date_v2');

    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('heading', { name: '오늘의 케미' })).toBeInTheDocument();
    expect(screen.queryByText(/머릿속을 맴도는 그 질문/)).not.toBeInTheDocument();
  });
});
