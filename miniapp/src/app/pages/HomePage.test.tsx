import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

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
  useMeChart: () => ({
    data: {
      year_pillar: '甲子',
      month_pillar: '乙丑',
      day_pillar: '丙寅',
      hour_pillar: '丁卯',
      day_master_element: '화',
      five_elements_counts: { 목: 2, 화: 0, 토: 2, 금: 1, 수: 3 },
      gender_normalized: 'F',
      yunse: {
        daeun: { start_age: 8, list: [], current_index: 0 },
        seyun: { current_pillar: '丙午', current_year: 2026 },
        wolun: { current_pillar: '甲午', current_month: '2026-06' },
        iliun: { today_pillar: '병자', today_date: '2026-06-30' },
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/components/ads/ad-banner', () => ({
  AdBannerListItem: () => null,
  AdBannerSlot: () => null,
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

  it('홈 히어로 안에 오늘의 액땜 부적 CTA를 노출한다', async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('button', { name: '액땜 부적 받기' })).toBeInTheDocument();
  });

  it('인연 0건 사용자에서 부적 리추얼은 인연 등록 유도(CTA) 아래에 온다(ADR-010 위계)', async () => {
    renderWithProviders(<HomePage />);

    const talismanSection = await screen.findByLabelText('오늘의 액땜 부적');
    const hero = talismanSection.parentElement;
    expect(hero).not.toBeNull();

    const registerCta = within(hero as HTMLElement)
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/relations/new');
    expect(registerCta).toBeDefined();

    // 부적 섹션이 인연 등록 CTA 보다 문서상 뒤에 위치해야 한다.
    const relation = registerCta as HTMLElement;
    expect(relation.compareDocumentPosition(talismanSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
